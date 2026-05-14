package com.anook.backend.message.application.service;

import com.anook.backend.message.application.port.out.MessageDispatchPort;
import com.anook.backend.message.application.event.RequestCancelledByGuestEvent;
import com.anook.backend.message.application.event.RequestStatusCheckByGuestEvent;
import com.anook.backend.message.application.event.RequestDetectedEvent;
import com.anook.backend.message.application.dto.request.SendMessageCommand;
import com.anook.backend.message.application.dto.response.SendMessageResult;
import com.anook.backend.message.application.port.in.SendMessageUseCase;
import com.anook.backend.message.application.port.out.MessageAiPort;
import com.anook.backend.message.application.port.out.MessageAiResult;
import com.anook.backend.message.application.port.out.MessageRepositoryPort;
import com.anook.backend.message.application.port.out.MessageRoomStatusPort;
import com.anook.backend.global.util.PiiMaskingUtil;
import com.anook.backend.message.domain.model.Message;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import com.anook.backend.ailog.application.service.AsyncAiLoggingService;
import com.anook.backend.ailog.domain.model.AiLog;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.context.annotation.Lazy;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 메시지 전송 서비스
 *
 * 흐름 (비동기):
 * [동기] 1. 디바운스 검증 (같은 객실 1초 내 연타 방지)
 * [동기] 2. 고객 메시지 저장 (GUEST) → 즉시 HTTP 응답 반환
 * [비동기] 3. AI 분석 호출 (MessageAiPort)
 * [비동기] 4. AI 응답 메시지 저장 (AI)
 * [비동기] 5. WebSocket Push → /topic/room/{roomNo} (AI_RESPONSE)
 * [비동기] 6. 태스크형 요청 감지 시 RequestDetectedEvent 발행
 * [비동기] 7. AI 로그 분리 저장 (AsyncAiLoggingService)
 *
 * ❌ JPA Repository 직접 import 금지 → Port(Out)만 의존
 * ❌ Request 도메인 직접 접근 금지 → 이벤트로 통신
 * ❌ SimpMessagingTemplate 직접 사용 금지 → DispatchPort로 추상화
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SendMessageService implements SendMessageUseCase {

    private final MessageRepositoryPort messagePort;
    private final MessageAiPort aiPort;
    private final MessageDispatchPort dispatchPort;
    private final ApplicationEventPublisher eventPublisher;
    private final AsyncAiLoggingService asyncAiLoggingService;
    private final MessageRoomStatusPort roomStatusPort;

    @Autowired
    @Lazy
    private SendMessageService self;

    /** 디바운스: 객실별 마지막 메시지 전송 시간 (roomNo → timestamp) */
    private final ConcurrentHashMap<String, Long> lastSendTimeMap = new ConcurrentHashMap<>();

    /** 디바운스 간격 (밀리초) — 같은 객실에서 1초 내 연타 방지 */
    private static final long DEBOUNCE_MS = 1000;

    @Override
    @Transactional
    public SendMessageResult send(SendMessageCommand cmd) {
        // 1. 디바운스 검증
        checkDebounce(cmd.roomNo());

        // ★ PII 마스킹 선처리: 이후 로직(DB 저장, 웹소켓 전송, AI 호출)에서 모두 마스킹된 텍스트를 사용
        String originalContent = cmd.content();
        String maskedContent = PiiMaskingUtil.maskPii(originalContent);
        boolean piiDetected = originalContent != null && !originalContent.equals(maskedContent);

        // 2. Guest 메시지 저장 (마스킹된 텍스트로 DB 저장) → 즉시 반환
        Message guestMsg = Message.createGuestMessage(cmd.roomNo(), cmd.guestId(), maskedContent);
        guestMsg = messagePort.save(guestMsg);
        log.info("[Message] Guest 메시지 저장 완료 — id: {}, room: {}", guestMsg.getId(), cmd.roomNo());

        // 2-1. WebSocket Push → 직원 ChatModal에 고객 메시지 실시간 전달 (직원도 마스킹된 내용 확인)
        dispatchPort.sendToRoom(cmd.roomNo(), Map.of(
                "type", "GUEST_MESSAGE",
                "messageId", guestMsg.getId(),
                "content", maskedContent));

        // 3. AI 처리 — 직원이 실시간 상담 중인 방이면 AI 개입 스킵
        if (roomStatusPort.isStaffHandlingRoom(cmd.roomNo())) {
            log.info("[Message] 직원 상담 중 — AI 호출 스킵 (room: {})", cmd.roomNo());
        } else {
            // AI 처리는 비동기로 위임 (마스킹된 텍스트를 전송하여 외부 LLM 정보 유출 방지)
            self.processAiAsync(guestMsg.getId(), cmd.roomNo(), cmd.guestId(), maskedContent, cmd.guestLanguage(), piiDetected, cmd.images());
        }

        return new SendMessageResult(guestMsg.getId());
    }

    /**
     * AI 호출 + 응답 저장 + WebSocket Push + 이벤트 발행 (비동기)
     *
     * @Async → aiTaskExecutor 스레드풀에서 실행
     *        ⚠️ @Async는 같은 클래스 내부 호출 시 프록시를 타지 않으므로,
     *        @Lazy로 주입받은 self 인스턴스를 통해 호출하여 프록시를 통과하게 합니다.
     */
    @Async("aiTaskExecutor")
    @Transactional
    public void processAiAsync(Long messageId, String roomNo, Long guestId, String content, String language, boolean piiDetected, java.util.List<String> images) {
        try {
            // 3. AI 호출을 위해 최근 10개 메시지 조회 (대화 맥락 확장)
            java.util.List<Message> recentMessages = new java.util.ArrayList<>(
                    messagePort.findRecentByRoomNoAndGuestId(roomNo, guestId, 10));

            // 방금 저장한 현재 메시지는 AI가 'Current Request'로 중복 인식하지 않도록 제외
            if (!recentMessages.isEmpty() && recentMessages.get(0).getContent().equals(content)) {
                recentMessages.remove(0);
            }

            // DB에서 최신순(DESC)으로 가져왔으므로, AI가 문맥을 읽기 편하게 시간순(ASC)으로 뒤집기
            java.util.Collections.reverse(recentMessages);

            java.util.List<Map<String, String>> chatHistory = recentMessages.stream()
                    .map(m -> Map.of(
                            "role",
                            m.getSenderType().equals(com.anook.backend.message.domain.model.SenderType.GUEST) ? "user"
                                    : "ai",
                            "content", m.getContent()))
                    .toList();

            // AI 호출
            java.util.List<MessageAiResult> analyses = aiPort.analyze(content, roomNo, language, chatHistory, images);

            // 4. AI 응답 메시지 저장
            String combinedReply = analyses.stream()
                    .map(MessageAiResult::guestReply)
                    .filter(reply -> reply != null && !reply.isBlank())
                    .distinct()
                    .collect(java.util.stream.Collectors.joining("\n"));
            
            if (combinedReply.isEmpty()) {
                combinedReply = "알겠습니다.";
            }

            if (piiDetected) {
                combinedReply += "\n\n[안내] 개인정보보호법에 의해 고객님의 개인정보는 열람 및 저장이 불가하여 안전하게 마스킹(***) 처리되었습니다. 상세한 문의나 긴급 연락은 객실 내선 전화를 통해 프론트데스크로 문의해 주시기 바랍니다.";
            }

            Message aiMsg = Message.createAiReply(roomNo, guestId, combinedReply);
            aiMsg = messagePort.save(aiMsg);
            log.info("[Message] AI 응답 저장 완료 — id: {}, reply: {}", aiMsg.getId(), combinedReply);

            // 5. WebSocket Push → 고객 채팅 화면에 AI 응답 실시간 전달
            Map<String, Object> payload = new java.util.HashMap<>(Map.of(
                    "type", "AI_RESPONSE",
                    "messageId", aiMsg.getId(),
                    "content", combinedReply
            ));

            java.util.List<String> options = analyses.stream()
                    .map(MessageAiResult::clarificationOptions)
                    .filter(java.util.Objects::nonNull)
                    .flatMap(java.util.List::stream)
                    .toList();

            if (!options.isEmpty()) {
                payload.put("options", options);
            }

            dispatchPort.sendToRoom(roomNo, payload);

            // 6. 태스크형 요청 감지 시 이벤트 발행 (여기서 message 책임 끝!)
            for (MessageAiResult analysis : analyses) {
                if ("CANCEL_ALL_REQUESTS".equals(analysis.action())) {
                    eventPublisher.publishEvent(new com.anook.backend.message.application.event.AllRequestsCancelledByGuestEvent(this, roomNo, guestId));
                    log.info("[Message] AllRequestsCancelledByGuestEvent 발행 — room: {}", roomNo);
                } else if ("CANCEL_REQUEST".equals(analysis.action())) {
                    eventPublisher.publishEvent(new RequestCancelledByGuestEvent(this, roomNo, guestId, analysis.domainCode(), analysis.targetKeyword()));
                    log.info("[Message] RequestCancelledByGuestEvent 발행 — room: {}, domain: {}, targetKeyword: {}", roomNo, analysis.domainCode(), analysis.targetKeyword());
                } else if (analysis.domainCode() != null) {
                    boolean escalated = analysis.confidence() < 0.7;

                    eventPublisher.publishEvent(new RequestDetectedEvent(
                            this,
                            roomNo,
                            guestId,
                            analysis.domainCode(),
                            analysis.priority(),
                            analysis.entities(),
                            analysis.confidence(),
                            content,
                            analysis.summary(),
                            escalated,
                            analysis.actionType(),
                            analysis.targetKeyword(),
                            images,
                            analysis.reasoning()));
                    log.info("[Message] RequestDetectedEvent 발행 — domain: {}, escalated: {}, actionType: {}, targetKeyword: {}",
                            analysis.domainCode(), escalated, analysis.actionType(), analysis.targetKeyword());
                } else if ("STATUS_CHECK".equals(analysis.action())) {
                    eventPublisher.publishEvent(new RequestStatusCheckByGuestEvent(this, roomNo, guestId, content));
                    log.info("[Message] RequestStatusCheckByGuestEvent 발행 — room: {}", roomNo);
                } else if ("VOC_FEEDBACK".equals(analysis.action())) {
                    String sentiment = (String) analysis.entities().get("sentiment");
                    messagePort.findById(messageId).ifPresent(msg -> {
                        msg.setSentiment(sentiment);
                        messagePort.save(msg);
                    });
                    log.info("[Message] VOC 태그 부착 완료 — msgId: {}, sentiment: {}", messageId, sentiment);
                }

                // 7. AI 로그 비동기 분리 저장
                if (analysis.aiLogMeta() != null) {
                    Map<String, Object> meta = analysis.aiLogMeta();
                    AiLog aiLog = AiLog.builder()
                            .requestId(null)
                            .modelName((String) meta.get("model_name"))
                            .rawPrompt((String) meta.get("raw_prompt"))
                            .rawResponse((String) meta.get("raw_response"))
                            .promptTokens(meta.get("prompt_tokens") != null ? ((Number) meta.get("prompt_tokens")).intValue() : 0)
                            .completionTokens(meta.get("completion_tokens") != null ? ((Number) meta.get("completion_tokens")).intValue() : 0)
                            .latencyMs(meta.get("latency_ms") != null ? ((Number) meta.get("latency_ms")).intValue() : 0)
                            .isFallback(meta.get("is_fallback") != null && (Boolean) meta.get("is_fallback"))
                            .build();
                            
                    asyncAiLoggingService.saveAiLogAsync(aiLog);
                }
            }
        } catch (Exception e) {
            log.error("[Message] AI 비동기 처리 실패 — room: {}, error: {}", roomNo, e.getMessage(), e);

            // AI 실패 시에도 고객에게 안내 메시지 전달
            dispatchPort.sendToRoom(roomNo, Map.of(
                    "type", "AI_ERROR",
                    "content", "죄송합니다. 잠시 후 다시 시도해 주세요."));
        }
    }

    /**
     * 디바운스 검증 — 같은 객실에서 DEBOUNCE_MS 이내 재전송 시 예외 발생
     */
    private void checkDebounce(String roomNo) {
        long now = System.currentTimeMillis();
        Long lastTime = lastSendTimeMap.get(roomNo);

        if (lastTime != null && (now - lastTime) < DEBOUNCE_MS) {
            log.warn("[Message] 디바운스 차단 — room: {}, interval: {}ms", roomNo, (now - lastTime));
            throw new com.anook.backend.global.exception.BusinessException(
                    com.anook.backend.global.exception.ErrorCode.DEBOUNCE_ERROR);
        }

        lastSendTimeMap.put(roomNo, now);
    }

    @Override
    @Transactional
    public void sendStaffMessage(com.anook.backend.message.application.dto.request.SendStaffMessageCommand command) {
        String targetLang = command.targetLanguage();
        if (targetLang == null || targetLang.isBlank()) {
            targetLang = "ko"; // 기본값 (추후 팀원이 다국어 지원 시 수정 예정)
        }

        // 1. 번역 수행
        String translatedContent = aiPort.translate(command.content(), targetLang);

        // 2. 메시지 도메인 생성 및 저장
        Message staffMsg = Message.createStaffMessage(command.roomNo(), command.guestId(), command.content());
        staffMsg.setTranslation(translatedContent);

        staffMsg = messagePort.save(staffMsg);
        log.info("[Message] Staff 메시지 저장 완료 — id: {}, room: {}", staffMsg.getId(), command.roomNo());

        // 3. WebSocket Push (투숙객에게 번역본 전달)
        dispatchPort.sendToRoom(command.roomNo(), Map.of(
                "type", "STAFF_MESSAGE",
                "messageId", staffMsg.getId(),
                "content", translatedContent,
                "originalContent", command.content()));
    }
}
