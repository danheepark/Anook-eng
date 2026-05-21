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
import com.anook.backend.message.application.port.out.MessageActiveRequestPort;
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
import com.anook.backend.request.application.port.in.ConfirmRequestUseCase;

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
    private final MessageActiveRequestPort activeRequestPort;
    private final ConfirmRequestUseCase confirmRequestUseCase;
    private final com.anook.backend.room.application.service.RoomInventoryService roomInventoryService;

    @Autowired
    @Lazy
    private SendMessageService self;

    /** 디바운스: 객실별 마지막 메시지 전송 시간 (roomNo → timestamp) */
    private final ConcurrentHashMap<String, Long> lastSendTimeMap = new ConcurrentHashMap<>();

    /** 디바운스 간격 (밀리초) — 같은 객실에서 1초 내 연타 방지 */
    private static final long DEBOUNCE_MS = 1000;

    /** 객실별 고객 언어 추적 (roomNo → 감지된 언어 코드, 예: "en", "ko") */
    private final ConcurrentHashMap<String, String> guestLanguageMap = new ConcurrentHashMap<>();

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
        Map<String, Object> guestPayload = Map.of(
                "type", "GUEST_MESSAGE",
                "roomNo", cmd.roomNo(), // 추가: 전체 대시보드 레드닷 표시용
                "messageId", guestMsg.getId(),
                "content", maskedContent);
        dispatchPort.sendToRoom(cmd.roomNo(), guestPayload);
        dispatchPort.sendToFrontdesk(guestPayload);

        // 2-2. 고객 언어 추적: 프론트에서 감지한 언어를 메모리에 저장 (직원 답장 시 번역 대상 언어로 사용)
        String guestLang = cmd.guestLanguage() != null && !cmd.guestLanguage().isBlank() ? cmd.guestLanguage() : "ko";
        guestLanguageMap.put(cmd.roomNo(), guestLang);
        log.info("[Message] 고객 언어 갱신 — room: {}, lang: {}", cmd.roomNo(), guestLang);

        // 2-3. 고객 메시지를 직원 언어로 번역하여 DB 및 WebSocket으로 전달 (비동기)
        self.translateGuestMessageForStaff(guestMsg.getId(), cmd.roomNo(), maskedContent, guestLang);

        // 3. AI 처리 — 직원이 실시간 상담 중인 방이면 AI 개입 스킵
        if (roomStatusPort.isStaffHandlingRoom(cmd.roomNo())) {
            log.info("[Message] 직원 상담 중 — AI 호출 스킵 (room: {})", cmd.roomNo());
            // 프론트엔드에 AI 스킵(직원 응대 중)임을 알려 타이핑 인디케이터를 해제
            dispatchPort.sendToRoom(cmd.roomNo(), Map.of("type", "AI_SKIPPED"));
        } else {
            // AI 처리는 비동기로 위임 (마스킹된 텍스트를 전송하여 외부 LLM 정보 유출 방지)
            self.processAiAsync(guestMsg.getId(), cmd.roomNo(), cmd.guestId(), maskedContent, guestLang, piiDetected, cmd.images());
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

            // 3-1. 취소 문맥 분석을 위한 현재 고객의 활성(대기 중인) 주문 목록 조회
            java.util.List<Map<String, Object>> activeRequests = activeRequestPort.findActiveRequests(roomNo, guestId);

            // 3-2. Stateful AI: 객실 일일 제한 물품(수건, 생수) 사용량 조회 (6 AM 리셋)
            Map<String, Integer> roomInventory = roomInventoryService.getInventory(roomNo);

            // AI 호출
            java.util.List<MessageAiResult> analyses = aiPort.analyze(content, roomNo, language, chatHistory, images, activeRequests, roomInventory);

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
                    "roomNo", roomNo, // 추가: 전체 대시보드 레드닷 표시용
                    "messageId", aiMsg.getId(),
                    "content", combinedReply
            ));

            // [AN-344] 중복 예약/주문 방지 및 이전 예약 카드 노출
            // AI가 targetRequestId를 반환하였고, 이것이 취소(CANCEL) 흐름이 아닌 경우
            Long conflictRequestId = null;
            boolean isAddDuplicate = false;
            for (MessageAiResult analysis : analyses) {
                if (analysis.targetRequestId() != null) {
                    conflictRequestId = analysis.targetRequestId();
                }
                if ("ADD_DUPLICATE".equals(analysis.actionType())) {
                    isAddDuplicate = true;
                }
            }

            if (conflictRequestId != null && !isAddDuplicate) {
                java.util.Map<String, Object> existingReq = activeRequestPort.findRequestById(conflictRequestId);
                if (existingReq != null) {
                    payload.put("uiType", "REQUEST_CARD");
                    
                    java.util.Map<String, Object> meta = new java.util.HashMap<>();
                    meta.put("requestId", existingReq.get("id"));
                    meta.put("domainCode", existingReq.get("departmentId"));
                    meta.put("summary", existingReq.get("summary"));
                    meta.put("status", existingReq.get("status"));
                    meta.put("priority", existingReq.get("priority"));
                    meta.put("entities", existingReq.get("entities"));
                    meta.put("graceRemaining", 0); // 수락/취소 버튼 제거
                    
                    payload.put("meta", meta);
                    log.info("[Message] 중복 요청 감지 — 기존 요청 ID: {}, uiType: REQUEST_CARD 지정", conflictRequestId);
                }
            }

            // [Contextual Pill Fix] Extract meta context for option pills (e.g. contextual cancellation/modification)
            String metaDomainCode = null;
            String metaSummary = null;
            String metaTargetKeyword = null;
            for (MessageAiResult analysis : analyses) {
                if (analysis.domainCode() != null && !analysis.domainCode().isBlank()) {
                    metaDomainCode = analysis.domainCode();
                }
                if (analysis.summary() != null && !analysis.summary().isBlank()) {
                    metaSummary = analysis.summary();
                }
                if (analysis.targetKeyword() != null && !analysis.targetKeyword().isBlank()) {
                    metaTargetKeyword = analysis.targetKeyword();
                }
            }

            if (!payload.containsKey("meta") && (metaDomainCode != null || metaSummary != null || metaTargetKeyword != null)) {
                java.util.Map<String, Object> meta = new java.util.HashMap<>();
                if (metaDomainCode != null) meta.put("domainCode", metaDomainCode);
                if (metaSummary != null) meta.put("summary", metaSummary);
                if (metaTargetKeyword != null) meta.put("targetKeyword", metaTargetKeyword);
                payload.put("meta", meta);
                log.info("[Message] Option context meta added to AI_RESPONSE payload: domainCode={}, summary={}, targetKeyword={}", metaDomainCode, metaSummary, metaTargetKeyword);
            }

            java.util.List<String> options = analyses.stream()
                    .map(MessageAiResult::clarificationOptions)
                    .filter(java.util.Objects::nonNull)
                    .flatMap(java.util.List::stream)
                    .toList();

            if (!options.isEmpty() && conflictRequestId == null) {
                payload.put("options", options);
            }

            dispatchPort.sendToRoom(roomNo, payload);
            dispatchPort.sendToFrontdesk(payload);

            // 6. 태스크형 요청 감지 시 이벤트 발행 (여기서 message 책임 끝!)
            for (MessageAiResult analysis : analyses) {
                if ("CANCEL_ALL_REQUESTS".equals(analysis.action())) {
                    eventPublisher.publishEvent(new com.anook.backend.message.application.event.AllRequestsCancelledByGuestEvent(this, roomNo, guestId));
                    log.info("[Message] AllRequestsCancelledByGuestEvent 발행 — room: {}", roomNo);
                } else if ("CANCEL_REQUEST".equals(analysis.action())) {
                    eventPublisher.publishEvent(new RequestCancelledByGuestEvent(
                            this, roomNo, guestId, analysis.domainCode(), analysis.targetKeyword(), analysis.targetRequestId()));
                    log.info("[Message] RequestCancelledByGuestEvent 발행 — room: {}, domain: {}, targetKeyword: {}, targetRequestId: {}", roomNo, analysis.domainCode(), analysis.targetKeyword(), analysis.targetRequestId());
                } else if (analysis.domainCode() != null) {
                    // 중복 요청 경고 시점(targetRequestId가 존재하고 취소가 아닌 경우)에는 신규 요청 생성을 스킵합니다.
                    // 단, 고객이 중복 추가를 확정한 경우(ADD_DUPLICATE)는 스킵하지 않고 진행합니다.
                    if (analysis.targetRequestId() != null 
                            && !"CANCEL_REQUEST".equals(analysis.action()) 
                            && !"CANCEL_ALL_REQUESTS".equals(analysis.action())
                            && !"ADD_DUPLICATE".equals(analysis.actionType())
                            && !"REPLACE".equals(analysis.actionType())) {
                        log.info("[Message] 중복 요청 발생으로 신규 생성 스킵 — targetRequestId: {}", analysis.targetRequestId());
                        continue;
                    }

                    // 수락 대기 중인 기존 요청이 있는 상황에서 AI가 주문을 확정(Finalize)한 경우,
                    // 새로운 요청을 추가로 발행하는 대신 기존 요청을 수락(Confirm) 처리합니다.
                    String domain = analysis.domainCode();
                    boolean isFinalized = analysis.guestReply() != null &&
                            analysis.guestReply().contains("[FORWARD_" + domain + "]");

                    // If the user explicitly confirmed a NEW duplicate request, we skip auto-confirm
                    if (isFinalized && !"ADD_DUPLICATE".equals(analysis.actionType())) {
                        java.util.Map<String, Object> pendingRequest = activeRequests.stream()
                                .filter(req -> "PENDING".equals(req.get("status")) && domain.equals(req.get("department_id")))
                                .findFirst()
                                .orElse(null);

                        if (pendingRequest != null) {
                            Long pendingRequestId = ((Number) pendingRequest.get("id")).longValue();
                            log.info("[Message] 기존 수락 대기 중인 요청 발견, 자동 수락 처리 진행 — ID: {}, room: {}", pendingRequestId, roomNo);
                            confirmRequestUseCase.confirmRequest(pendingRequestId, roomNo);
                            continue; // 새 요청 중복 생성 방지
                        }
                    }

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
        // ★ 고객의 실제 언어를 메모리에서 조회 (감지 이력 기반), 없으면 최근 고객 메시지로 감지
        String guestLang = guestLanguageMap.get(command.roomNo());
        if (guestLang == null) {
            guestLang = messagePort.findRecentByRoomNoAndGuestId(command.roomNo(), command.guestId(), 10)
                    .stream()
                    .filter(com.anook.backend.message.domain.model.Message::isFromGuest)
                    .findFirst()
                    .map(m -> detectLanguage(m.getContent()))
                    .orElse("ko");
            guestLanguageMap.put(command.roomNo(), guestLang);
        }
        log.info("[Message] 직원 메시지 전송 — room: {}, 고객 언어: {}", command.roomNo(), guestLang);

        // 0. 즉시 STAFF_TYPING 이벤트 전송 (번역 전 게스트에게 타이핑 인디케이터 표시)
        dispatchPort.sendToRoom(command.roomNo(), Map.of(
                "type", "STAFF_TYPING"));

        // 1. 번역 수행: 직원 메시지의 언어와 고객 언어가 다르면 고객 언어로 번역
        String translatedForGuest;
        String staffLang = detectLanguage(command.content());
        if (staffLang.equals(guestLang)) {
            log.info("[Message] 직원 언어({})와 고객 언어({})가 동일 — 번역 스킵", staffLang, guestLang);
            translatedForGuest = command.content();
        } else {
            translatedForGuest = aiPort.translate(command.content(), guestLang);
            log.info("[Message] 직원→고객 번역 완료: {} → {}", command.content(), translatedForGuest);
        }

        // 2. 메시지 도메인 생성 및 저장
        Message staffMsg = Message.createStaffMessage(command.roomNo(), command.guestId(), command.content());
        staffMsg.setTranslation(translatedForGuest);

        staffMsg = messagePort.save(staffMsg);
        log.info("[Message] Staff 메시지 저장 완료 — id: {}, room: {}", staffMsg.getId(), command.roomNo());

        // 3. WebSocket Push (투숙객에게 번역본 전달, 직원에게 원문 전달)
        dispatchPort.sendToRoom(command.roomNo(), Map.of(
                "type", "STAFF_MESSAGE",
                "messageId", staffMsg.getId(),
                "content", translatedForGuest,
                "originalContent", command.content()));
    }

    /**
     * 고객 메시지를 직원 언어(시스템 기본: 한국어)로 번역하여 DB에 저장하고 WebSocket으로 Push.
     * 직원 ChatPanel에서 고객 메시지를 직원 언어로 표시하기 위한 비동기 처리.
     */
    @Async("aiTaskExecutor")
    @Transactional
    public void translateGuestMessageForStaff(Long messageId, String roomNo, String content, String guestLang) {
        // 시스템 기본 직원 언어는 한국어 (향후 직원별 언어 설정 지원 시 변경 가능)
        String staffLang = "ko";

        if (guestLang.equals(staffLang)) {
            // 고객도 한국어 → 번역 불필요
            return;
        }

        try {
            String translatedForStaff = aiPort.translate(content, staffLang);
            log.info("[Message] 고객→직원 번역 완료 — msgId: {}, {} → {}", messageId, content, translatedForStaff);

            // DB에 translated_content 저장
            messagePort.findById(messageId).ifPresent(msg -> {
                msg.setTranslation(translatedForStaff);
                messagePort.save(msg);
            });

            // WebSocket Push: 직원 ChatPanel에 번역본 전달
            dispatchPort.sendToRoom(roomNo, Map.of(
                    "type", "GUEST_MESSAGE_TRANSLATED",
                    "messageId", messageId,
                    "translatedContent", translatedForStaff));
            dispatchPort.sendToFrontdesk(Map.of(
                    "type", "GUEST_MESSAGE_TRANSLATED",
                    "roomNo", roomNo,
                    "messageId", messageId,
                    "translatedContent", translatedForStaff));
        } catch (Exception e) {
            log.error("[Message] 고객→직원 번역 실패 — msgId: {}, error: {}", messageId, e.getMessage());
        }
    }

    /**
     * 텍스트의 주요 언어를 휴리스틱으로 감지합니다.
     * - 한글(AC00-D7A3) 문자가 하나라도 있으면 "ko"
     * - 일본어(히라가나/가타카나) 문자가 있으면 "ja"
     * - 중국어(CJK 통합 한자) 문자가 있으면 "zh"
     * - 영문 알파벳이 과반수이면 "en"
     * - 그 외 기본값 "ko"
     */
    private String detectLanguage(String text) {
        if (text == null || text.isBlank()) return "ko";
        for (char c : text.toCharArray()) {
            if (c >= '\uAC00' && c <= '\uD7A3') return "ko";
        }
        for (char c : text.toCharArray()) {
            if ((c >= '\u3040' && c <= '\u309F') || (c >= '\u30A0' && c <= '\u30FF')) return "ja";
        }
        for (char c : text.toCharArray()) {
            if (c >= '\u4E00' && c <= '\u9FFF') return "zh";
        }
        long alphaCount = text.chars().filter(c -> (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')).count();
        if (alphaCount > text.length() / 2) return "en";
        return "ko";
    }
}
