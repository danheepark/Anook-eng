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
    private final com.anook.backend.guest.application.port.out.GuestRepositoryPort guestRepositoryPort;

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
        self.translateMessageForStaff(guestMsg.getId(), cmd.roomNo(), maskedContent, guestLang);

        // 3. AI 처리 — 직원이 실시간 상담 중인 방이면 AI 개입 스킵
        if (roomStatusPort.isStaffHandlingRoom(cmd.roomNo())) {
            log.info("[Message] 직원 상담 중 — AI 호출 스킵 (room: {})", cmd.roomNo());
            // 프론트엔드에 AI 스킵(직원 응대 중)임을 알려 타이핑 인디케이터를 해제
            dispatchPort.sendToRoom(cmd.roomNo(), Map.of("type", "AI_SKIPPED"));
        } else {
            // AI 처리는 비동기로 위임 (마스킹된 텍스트를 전송하여 외부 LLM 정보 유출 방지)
            self.processAiAsync(guestMsg.getId(), cmd.roomNo(), cmd.guestId(), maskedContent, guestLang, piiDetected,
                    cmd.images());
        }

        return new SendMessageResult(guestMsg.getId(), maskedContent);
    }

    /**
     * AI 호출 + 응답 저장 + WebSocket Push + 이벤트 발행 (비동기)
     *
     * @Async → aiTaskExecutor 스레드풀에서 실행
     *        ⚠️ @Async는 같은 클래스 내부 호출 시 프록시를 타지 않으므로,
     * @Lazy로 주입받은 self 인스턴스를 통해 호출하여 프록시를 통과하게 합니다.
     */
    @Async("aiTaskExecutor")
    @Transactional
    public void processAiAsync(Long messageId, String roomNo, Long guestId, String content, String language,
            boolean piiDetected, java.util.List<String> images) {
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
            Map<String, Object> roomInventory = roomInventoryService.getInventory(roomNo);

            // 3-3. PMS 투숙객 특이사항/메모(special_notes) 조회
            String specialNotes = guestRepositoryPort.findByRoomNumber(roomNo)
                    .map(com.anook.backend.guest.domain.model.Guest::getSpecialNotes)
                    .orElse(null);

            // AI 호출
            java.util.List<MessageAiResult> analyses = aiPort.analyze(content, roomNo, language, chatHistory, images,
                    activeRequests, roomInventory, specialNotes);

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

            // AI 응답 메시지도 직원 언어(한국어)로 번역하여 DB 저장 및 웹소켓 전송 (비동기)
            self.translateMessageForStaff(aiMsg.getId(), roomNo, combinedReply, language);

            // 5. WebSocket Push → 고객 채팅 화면에 AI 응답 실시간 전달
            Map<String, Object> payload = new java.util.HashMap<>(Map.of(
                    "type", "AI_RESPONSE",
                    "roomNo", roomNo, // 추가: 전체 대시보드 레드닷 표시용
                    "messageId", aiMsg.getId(),
                    "content", combinedReply));

            // [AN-344] 중복 예약/주문 방지 및 이전 예약 카드 노출
            // AI가 targetRequestId를 반환하였고, 이것이 취소(CANCEL) 흐름이 아닌 경우
            Long conflictRequestId = null;
            boolean isAddDuplicate = false;

            java.util.List<MessageAiResult> validatedAnalyses = new java.util.ArrayList<>();
            for (MessageAiResult analysis : analyses) {
                Long validTargetRequestId = analysis.targetRequestId();

                // [AN-380] ADD, REPLACE 로직은 아이템이 똑같을 때만 적용되어야 함.
                // AI가 완전 다른 아이템(수건 vs 물)에 대해 targetRequestId를 설정한 경우 무시.
                if (validTargetRequestId != null) {
                    boolean isCancel = "CANCEL_REQUEST".equals(analysis.action())
                            || "CANCEL_ALL_REQUESTS".equals(analysis.action());
                    if (!isCancel) {
                        java.util.Map<String, Object> existingReq = activeRequestPort
                                .findRequestById(validTargetRequestId);
                        if (existingReq != null) {
                            String existingSummary = existingReq.get("summary") != null
                                    ? existingReq.get("summary").toString()
                                    : "";
                            String newSummary = analysis.summary() != null ? analysis.summary() : "";

                            // 텍스트 기반 단순 동일성 검증
                            boolean seemsSameRequest = newSummary.isEmpty()
                                    || existingSummary.contains(newSummary)
                                    || newSummary.contains(existingSummary);

                            if (!seemsSameRequest) {
                                // 키워드 기반 동일성 검증 (핵심 서비스가 같은 경우 허용) - 다국어(영어/일어/중어) 포함 및 대소문자 무시
                                java.util.List<String> coreKeywords = java.util.Arrays.asList(
                                        "택시", "taxi", "タクシー", "出租车",
                                        "수건", "타올", "towel", "タオル", "毛巾",
                                        "물", "생수", "water", "水",
                                        "짐", "luggage", "荷物", "行李",
                                        "보관", "storage", "保管", "寄存",
                                        "모닝콜", "wake up call", "モーニングコール", "叫醒服务",
                                        "배달", "delivery", "配達", "送货",
                                        "식당", "restaurant", "レストラン", "餐厅",
                                        "예약", "reservation", "予約", "预订",
                                        "가운", "robe", "ガウン", "浴衣",
                                        "이불", "blanket", "布団", "被子",
                                        "베개", "pillow", "枕", "枕头",
                                        "슬리퍼", "slipper", "スリッパ", "拖鞋", "꽃", "flower", "꽃배달", "장미", "rose", "장미꽃");
                                String lowerExisting = existingSummary.toLowerCase();
                                String lowerNew = newSummary.toLowerCase();
                                for (String kw : coreKeywords) {
                                    if (lowerExisting.contains(kw) && lowerNew.contains(kw)) {
                                        seemsSameRequest = true;
                                        break;
                                    }
                                }
                            }

                            boolean isFb = "FB".equals(analysis.domainCode());
                            if (!seemsSameRequest && !isFb) {
                                log.info(
                                        "[Message] targetRequestId={} ignored due to item mismatch (existing: '{}', new: '{}')",
                                        validTargetRequestId, existingSummary, newSummary);
                                validTargetRequestId = null; // 무효화
                            }
                        }
                    }
                }

                // 검증된 targetRequestId로 새 객체 생성 (record 이므로)
                MessageAiResult validatedAnalysis = java.util.Objects.equals(validTargetRequestId,
                        analysis.targetRequestId()) ? analysis
                                : new MessageAiResult(
                                        analysis.guestReply(), analysis.summary(), analysis.domainCode(),
                                        analysis.priority(),
                                        analysis.entities(), analysis.confidence(), analysis.action(),
                                        analysis.actionType(), analysis.needsClarification(),
                                        analysis.aiLogMeta(), analysis.targetKeyword(), validTargetRequestId,
                                        analysis.clarificationOptions(),
                                        analysis.reasoning());

                validatedAnalyses.add(validatedAnalysis);

                if (validatedAnalysis.targetRequestId() != null) {
                    conflictRequestId = validatedAnalysis.targetRequestId();
                }
                if ("ADD_DUPLICATE".equals(validatedAnalysis.actionType()) || "ADD".equals(validatedAnalysis.actionType())) {
                    isAddDuplicate = true;
                }
            }
            analyses = validatedAnalyses;

            java.util.List<String> options = analyses.stream()
                    .map(MessageAiResult::clarificationOptions)
                    .filter(java.util.Objects::nonNull)
                    .flatMap(java.util.List::stream)
                    .map(String::trim)
                    .map(opt -> opt.equals("아니요") ? "아니오" : opt)
                    .distinct()
                    .toList();



            // [Contextual Pill Fix] Extract meta context for option pills (e.g. contextual
            // cancellation/modification)
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

            if (!payload.containsKey("meta")
                    && (metaDomainCode != null || metaSummary != null || metaTargetKeyword != null)) {
                java.util.Map<String, Object> meta = new java.util.HashMap<>();
                if (metaDomainCode != null)
                    meta.put("domainCode", metaDomainCode);
                if (metaSummary != null)
                    meta.put("summary", metaSummary);
                if (metaTargetKeyword != null)
                    meta.put("targetKeyword", metaTargetKeyword);
                payload.put("meta", meta);
                log.info(
                        "[Message] Option context meta added to AI_RESPONSE payload: domainCode={}, summary={}, targetKeyword={}",
                        metaDomainCode, metaSummary, metaTargetKeyword);
            }

            if (!options.isEmpty()) {
                payload.put("options", options);
            }

            String uiType = null;
            for (MessageAiResult analysis : analyses) {
                if (analysis.entities() != null && "MENU_INQUIRY".equals(analysis.entities().get("intent"))) {
                    uiType = "MENU_CARD";
                }
            }
            if (combinedReply != null && combinedReply.contains("[MENU_CARD]")) {
                uiType = "MENU_CARD";
            }
            if (uiType != null) {
                payload.put("uiType", uiType);
            }

            dispatchPort.sendToRoom(roomNo, payload);
            dispatchPort.sendToFrontdesk(payload);

            // 6. 태스크형 요청 감지 시 이벤트 발행 (여기서 message 책임 끝!)
            for (MessageAiResult analysis : analyses) {
                if ("CANCEL_ALL_REQUESTS".equals(analysis.action())) {
                    eventPublisher.publishEvent(
                            new com.anook.backend.message.application.event.AllRequestsCancelledByGuestEvent(this,
                                    roomNo, guestId));
                    log.info("[Message] AllRequestsCancelledByGuestEvent 발행 — room: {}", roomNo);
                } else if ("CANCEL_REQUEST".equals(analysis.action())) {
                    eventPublisher.publishEvent(new RequestCancelledByGuestEvent(
                            this, roomNo, guestId, analysis.domainCode(), analysis.targetKeyword(),
                            analysis.targetRequestId()));
                    log.info(
                            "[Message] RequestCancelledByGuestEvent 발행 — room: {}, domain: {}, targetKeyword: {}, targetRequestId: {}",
                            roomNo, analysis.domainCode(), analysis.targetKeyword(), analysis.targetRequestId());
                } else if (analysis.domainCode() != null) {
                    // [AN-421] AI가 추가 질문(수량 확인, 옵션 확인, 중복 확인 등)을 하는 단계라면
                    // 아직 주문을 확정(생성)하면 안 되므로 이벤트를 발행하지 않고 스킵합니다.
                    if (analysis.needsClarification()) {
                        log.info("[Message] AI needs clarification. Skipping RequestDetectedEvent.");
                        continue;
                    }

                    // [AN-342] targetRequestId가 존재 + actionType=ADD인 경우:
                    // 고객이 "추가요"로 기존 요청에 추가를 확정한 것이므로 ADD_DUPLICATE로 자동 전환.
                    // 이전에는 무조건 스킵했지만, 이는 고객의 확인 응답을 무시하는 버그였음.
                    if (analysis.targetRequestId() != null
                            && !isAddDuplicate
                            && !"CANCEL_REQUEST".equals(analysis.action())
                            && !"CANCEL_ALL_REQUESTS".equals(analysis.action())
                            && !"REPLACE".equals(analysis.actionType())) {
                        if ("ADD".equals(analysis.actionType())) {
                            // ADD + targetRequestId = 고객이 기존 요청에 추가 확인 → ADD_DUPLICATE로 전환
                            log.info("[Message] targetRequestId 존재 + ADD → ADD_DUPLICATE로 자동 전환 — targetRequestId: {}",
                                    analysis.targetRequestId());
                            isAddDuplicate = true;
                        } else {
                            log.info("[Message] 중복 요청 발생으로 신규 생성 스킵 — targetRequestId: {}", analysis.targetRequestId());
                            continue;
                        }
                    }

                    // 수락 대기 중인 기존 요청이 있는 상황에서 AI가 주문을 확정(Finalize)한 경우,
                    // 새로운 요청을 추가로 발행하는 대신 기존 요청을 수락(Confirm) 처리합니다.
                    String domain = analysis.domainCode();
                    // [안전 장치] 고객 원문이 짧은 긍정 응답("네", "응" 등)이고 동일 도메인의 CREATED(확인 대기 중) 요청이 있는 경우,
                    // LLM의 [FORWARD_...] 응답 누락 여부와 무관하게 수락 확정으로 처리하여 중복 생성 방어
                    boolean isShortConfirmation = content != null && content.trim().toLowerCase()
                            .matches("^(네|응|어|예|ㅇㅇ|ok|okay|yes|yep|y|확인|진행|진행해|진행해줘|부탁해|알겠어|좋아|맞아|확인했습니다|수락|승인|sure|agree|confirm|はい|ええ|そうだ|お願い|お願いします|確認|是的|对|好|好的|没문제|是|确认|동의)$".replace("문제", "문제"));
                    
                    boolean hasPendingCreatedRequest = activeRequests.stream()
                            .anyMatch(req -> "CREATED".equals(req.get("status")) && domain.equals(req.get("department_id")));

                    boolean isFinalized = (analysis.guestReply() != null &&
                            analysis.guestReply().contains("[FORWARD_" + domain + "]"))
                            || (isShortConfirmation && hasPendingCreatedRequest);

                    // If the user explicitly confirmed a NEW duplicate request, skip auto-confirm.
                    // For REPLACE requests, we can auto-confirm the pending replacement request
                    // that was already
                    // created in the database during the confirmation stage. If no pending request
                    // exists,
                    // it will naturally fall through and publish the RequestDetectedEvent.
                    if (isFinalized && !"ADD_DUPLICATE".equals(analysis.actionType()) && !"ADD".equals(analysis.actionType()) && !"REPLACE".equals(analysis.actionType()) && !isAddDuplicate) {
                        java.util.Map<String, Object> pendingRequest = activeRequests.stream()
                                .filter(req -> ("CREATED".equals(req.get("status"))
                                        || "PENDING".equals(req.get("status")))
                                        && domain.equals(req.get("department_id")))
                                .findFirst()
                                .orElse(null);

                        // 고객의 원문이 단순 수락/확인 응답인지 판별 (다국어 임시 지원)
                        // 한국어, 영어, 일본어, 중국어의 대표적인 수락/긍정 단어 포함
                        // isShortConfirmation is already declared above
                        if (pendingRequest != null) {
                            // 기존 CREATED/PENDING 요청과 동일 요청에 대한 확인인지 검증
                            // 다른 아이템의 신규 주문(수건 vs 물)이면 auto-confirm 하지 않고 새 요청 생성
                            String existingSummary = pendingRequest.get("summary") != null
                                    ? pendingRequest.get("summary").toString()
                                    : "";
                            String newSummary = analysis.summary() != null ? analysis.summary() : "";

                            boolean seemsSameRequest = newSummary.isEmpty()
                                    || existingSummary.contains(newSummary)
                                    || newSummary.contains(existingSummary);

                            if (!seemsSameRequest) {
                                java.util.List<String> coreKeywords = java.util.Arrays.asList(
                                        "택시", "taxi", "タクシー", "出租车",
                                        "수건", "타올", "towel", "タオル", "毛巾",
                                        "물", "생수", "water", "水",
                                        "짐", "luggage", "荷物", "行李",
                                        "보관", "storage", "保管", "寄存",
                                        "모닝콜", "wake up call", "モーニングコール", "叫醒服务",
                                        "배달", "delivery", "配達", "送货",
                                        "식당", "restaurant", "レストラン", "餐厅",
                                        "예약", "reservation", "予約", "预订",
                                        "가운", "robe", "ガウン", "浴衣",
                                        "이불", "blanket", "布団", "被子",
                                        "베개", "pillow", "枕", "枕头",
                                        "슬리퍼", "slipper", "スリッパ", "拖鞋", "꽃", "flower", "꽃배달", "장미", "rose", "장미꽃");
                                String lowerExisting = existingSummary.toLowerCase();
                                String lowerNew = newSummary.toLowerCase();
                                for (String kw : coreKeywords) {
                                    if (lowerExisting.contains(kw) && lowerNew.contains(kw)) {
                                        seemsSameRequest = true;
                                        break;
                                    }
                                }
                            }

                            if (seemsSameRequest) {
                                Long pendingRequestId = ((Number) pendingRequest.get("id")).longValue();
                                log.info("[Message] 기존 수락 대기 중인 요청 발견, 자동 수락 처리 진행 — ID: {}, room: {}",
                                        pendingRequestId, roomNo);
                                confirmRequestUseCase.confirmRequest(pendingRequestId, roomNo);
                                continue; // 새 요청 중복 생성 방지
                            }
                            log.info(
                                    "[Message] 동일 도메인이지만 다른 아이템 → auto-confirm 스킵, 신규 요청 생성 — existing: '{}', new: '{}'",
                                    existingSummary, newSummary);
                            // fall through → RequestDetectedEvent 발행 (신규 아이템 요청 생성)
                        }
                        // 나머지: 새 아이템이 포함된 신규 주문이거나 auto-confirm 대상이 없으면 → fall through →
                        // RequestDetectedEvent 발행
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
                    log.info(
                            "[Message] RequestDetectedEvent 발행 — domain: {}, escalated: {}, actionType: {}, targetKeyword: {}",
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
                            .promptTokens(
                                    meta.get("prompt_tokens") != null ? ((Number) meta.get("prompt_tokens")).intValue()
                                            : 0)
                            .completionTokens(meta.get("completion_tokens") != null
                                    ? ((Number) meta.get("completion_tokens")).intValue()
                                    : 0)
                            .latencyMs(
                                    meta.get("latency_ms") != null ? ((Number) meta.get("latency_ms")).intValue() : 0)
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

    @Async("aiTaskExecutor")
    @Transactional
    public void translateMessageForStaff(Long messageId, String roomNo, String content, String guestLang) {
        // 시스템 기본 직원 언어는 한국어 (향후 직원별 언어 설정 지원 시 변경 가능)
        String staffLang = "en";

        if (guestLang.equals(staffLang)) {
            // 고객도 한국어 → 번역 불필요
            return;
        }

        try {
            String translatedForStaff = aiPort.translate(content, staffLang);
            log.info("[Message] 고객/AI→직원 번역 완료 — msgId: {}, {} → {}", messageId, content, translatedForStaff);

            // DB에 translated_content 저장
            messagePort.findById(messageId).ifPresent(msg -> {
                msg.setTranslation(translatedForStaff);
                messagePort.save(msg);
            });

            // WebSocket Push: 직원 ChatPanel에 번역본 전달
            dispatchPort.sendToRoom(roomNo, Map.of(
                    "type", "MESSAGE_TRANSLATED",
                    "messageId", messageId,
                    "translatedContent", translatedForStaff));
            dispatchPort.sendToFrontdesk(Map.of(
                    "type", "MESSAGE_TRANSLATED",
                    "roomNo", roomNo,
                    "messageId", messageId,
                    "translatedContent", translatedForStaff));
        } catch (Exception e) {
            log.error("[Message] 고객/AI→직원 번역 실패 — msgId: {}, error: {}", messageId, e.getMessage());
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
        if (text == null || text.isBlank())
            return "ko";
        for (char c : text.toCharArray()) {
            if (c >= '\uAC00' && c <= '\uD7A3')
                return "ko";
        }
        for (char c : text.toCharArray()) {
            if ((c >= '\u3040' && c <= '\u309F') || (c >= '\u30A0' && c <= '\u30FF'))
                return "ja";
        }
        for (char c : text.toCharArray()) {
            if (c >= '\u4E00' && c <= '\u9FFF')
                return "zh";
        }
        long alphaCount = text.chars().filter(c -> (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')).count();
        if (alphaCount > text.length() / 2)
            return "en";
        return "ko";
    }
}
