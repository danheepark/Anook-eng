package com.anook.backend.request.application.service;

import com.anook.backend.message.application.event.RequestDetectedEvent;
import com.anook.backend.request.application.dto.response.RequestWebSocketPayload;
import com.anook.backend.request.application.port.out.DispatchPort;
import com.anook.backend.request.application.port.out.RequestRepositoryPort;
import com.anook.backend.request.domain.model.DomainCode;
import com.anook.backend.request.domain.model.Priority;
import com.anook.backend.request.domain.model.Request;
import com.anook.backend.request.domain.model.RequestStatus;
import com.anook.backend.global.util.RedisImageCacheUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.List;
import java.util.Map;
import java.util.ArrayList;
/**
 * Message 도메인에서 발행한 RequestDetectedEvent를 수신하여 Request 생성
 *
 * [AN-252] Grace Period + Generative UI 적용:
 * - URGENT 요청: 즉시 직원 알림 (Grace Period 스킵)
 * - 일반 요청: 10초 Grace Period 후 직원 알림 (고객에게 수정/취소 기회 제공)
 * - WebSocket payload에 entities, graceRemaining, priority 포함 (위젯 카드 렌더링용)
 *
 * [Cancel & Replace] 대화형 수정 패턴:
 * - 같은 객실+게스트+부서에 PENDING 상태 요청이 이미 있으면 자동 취소 후 새 요청 생성
 * - "수건 2장" → "아니 3장으로 바꿔줘" 시나리오를 매끄럽게 처리
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CreateRequestOnEventService {

    private final RequestRepositoryPort requestRepositoryPort;
    private final DispatchPort dispatchPort;
    private final GracePeriodScheduler gracePeriodScheduler;
    private final RedisImageCacheUtil redisImageCacheUtil;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onRequestDetected(RequestDetectedEvent event) {
        log.info("요청 이벤트 수신: roomNo={}, domainCode={}, summary={}",
                event.getRoomNo(), event.getDomainCode(), event.getSummary());

        // DomainCode 파싱 (실패 시 예외 발생)
        DomainCode domainCode = DomainCode.from(event.getDomainCode());

        boolean forceEscalate = false;
        // [Cancel & Replace] AI가 기존 요청을 '수정(REPLACE)'하는 문맥이라고 판단했을 때만 자동 취소
        // "수건 2장 줘" → "아니 3장 줘" = REPLACE (기존 요청 취소)
        // "수건 줘" → "물도 줘" = ADD (기존 요청 유지)
        if ("REPLACE".equalsIgnoreCase(event.getActionType())) {
            // [Keyword Targeting] targetKeyword가 있으면 키워드 매칭으로 대상 탐색
            java.util.Optional<Request> targetRequest = java.util.Optional.empty();
            
            if (event.getTargetKeyword() != null && !event.getTargetKeyword().isBlank()) {
                List<Request> cancellable = requestRepositoryPort.findAllCancellableByRoomNoAndGuestId(event.getRoomNo(), event.getGuestId());
                String lowerKeyword = event.getTargetKeyword().toLowerCase();
                targetRequest = cancellable.stream()
                        .filter(r -> r.getDomainCode() == domainCode)
                        .filter(r -> r.getSummary() != null && r.getSummary().toLowerCase().contains(lowerKeyword))
                        .findFirst();
                
                if (targetRequest.isEmpty()) {
                    log.info("[Cancel&Replace] 키워드 '{}' 매칭 실패 → 최신 건 폴백", event.getTargetKeyword());
                }
            }
            
            // 키워드 매칭 실패 시 최신 건 폴백
            if (targetRequest.isEmpty()) {
                targetRequest = requestRepositoryPort.findLatestCancellableByRoomNoAndGuestIdAndDomainCode(
                        event.getRoomNo(), event.getGuestId(), domainCode.name());
            }
            
            if (targetRequest.isPresent()) {
                Request existing = targetRequest.get();
                if (existing.getStatus() == RequestStatus.PENDING) {
                    try {
                        existing.changeStatus(RequestStatus.CANCELLED);
                        requestRepositoryPort.save(existing);

                        log.info("[Cancel&Replace] PENDING 요청 자동 취소 — id: {}, summary: {}, keyword: {}",
                                existing.getId(), existing.getSummary(), event.getTargetKeyword());

                        RequestWebSocketPayload cancelPayload = RequestWebSocketPayload.statusChanged(
                                existing.getId(),
                                RequestStatus.CANCELLED.name(),
                                existing.getDomainCode() != null ? existing.getDomainCode().name() : null,
                                existing.getSummary(),
                                existing.getRoomNo());
                        dispatchPort.dispatchToRoom(event.getRoomNo(), cancelPayload);
                    } catch (Exception e) {
                        log.warn("[Cancel&Replace] 기존 요청 자동 취소 실패: {}", e.getMessage());
                    }
                } else if (existing.getStatus() == RequestStatus.IN_PROGRESS) {
                    // IN_PROGRESS 상태의 요청을 변경하려는 경우 — 취소 승인 대기 처리만 하고
                    // 새 요청은 일반 PENDING으로 생성 (forceEscalate 하지 않음: URGENT는 직원 대시보드에서 필터링됨)
                    try {
                        existing.requestCancellation();
                        requestRepositoryPort.save(existing);
                        
                        log.info("[Cancel&Replace] IN_PROGRESS 요청 취소 승인 대기 처리 — id: {}", existing.getId());
                        
                        RequestWebSocketPayload cancelPayload = RequestWebSocketPayload.cancelRequestReceived(
                                existing.getId(),
                                existing.getDomainCode() != null ? existing.getDomainCode().name() : null,
                                existing.getSummary(), 
                                existing.getRoomNo());
                        dispatchPort.dispatchToRoom(event.getRoomNo(), cancelPayload);
                        if (existing.getDepartmentId() != null) {
                            dispatchPort.dispatchToDepartment(existing.getDepartmentId(), cancelPayload);
                        }
                    } catch (Exception e) {
                        log.warn("[Cancel&Replace] 기존 요청 취소 대기 실패 — id: {}, reason: {}", existing.getId(), e.getMessage());
                    }
                }
            }
        }

        // 무의미하게 짧은 단답("응", "네")은 숨기고 상세 내역만 표시.
        // 긴 문장일 경우에는 원문과 AI가 추출한 상세 내역을 모두 표시하여 직원의 가독성을 높임.
        String finalRawText = event.getRawText();
        String formattedEntities = formatEntities(event.getEntities());
        
        if (finalRawText != null && finalRawText.length() <= 3) {
            finalRawText = formattedEntities.trim(); // "응"은 버리고 상세 내역만 사용
        } else if (formattedEntities != null && !formattedEntities.isEmpty()) {
            finalRawText = finalRawText + "\n\n" + formattedEntities.trim();
        }

        // Request 도메인 객체 생성
        Request request = Request.create(
                event.getRoomNo(),
                event.getGuestId(),
                domainCode,
                event.getPriority(),
                event.getEntities(),
                event.getConfidence(),
                finalRawText,
                event.getSummary(),
                event.getReasoning());

        // 긴급 상황 Pre-Filter 감지 여부
        boolean isEmergencyDetected = event.getEntities() != null
                && event.getEntities().containsKey("emergency_category");

        // 에스컬레이션 조건: confidence < 0.7 이거나 event.isEscalated() 가 true인 경우, 또는 forceEscalate 가 true인 경우
        boolean isEscalated = event.isEscalated() || event.getConfidence() < 0.7 || forceEscalate;

        if (isEmergencyDetected) {
            log.warn("🚨 [EMERGENCY] 긴급 상황 자동 에스컬레이션 — category: {}",
                    event.getEntities().get("emergency_category"));
            request.markEmergency((String) event.getEntities().get("emergency_category"));
        } else if (isEscalated) {
            log.warn("에스컬레이션 발생! 확신도: {}", event.getConfidence());
            request.escalate("AI 확신도 부족: " + event.getConfidence());
        }

        // DB 저장
        Request savedRequest = requestRepositoryPort.save(request);
        log.info("Request 생성 완료: id={}", savedRequest.getId());

        if (event.getImages() != null && !event.getImages().isEmpty()) {
            java.time.Duration ttl = java.time.Duration.ofDays(3); // 최대 3일, 체크아웃 시 자동 파기
            for (String base64Image : event.getImages()) {
                redisImageCacheUtil.saveImage(savedRequest.getRoomNo(), savedRequest.getId(), base64Image, ttl);
            }
        }


        // [AN-252] URGENT 판별: priority가 EMERGENCY인 경우에만 Grace Period 생략
        boolean isUrgent = savedRequest.getPriority() == Priority.EMERGENCY;
        String deptCode = savedRequest.getDomainCode() != null ? savedRequest.getDomainCode().name() : "UNKNOWN";
        int graceRemaining = isUrgent ? 0 : GracePeriodScheduler.GRACE_SECONDS;

        // [AN-252] Generative UI: entities 포함 WebSocket payload 생성
        RequestWebSocketPayload payload = RequestWebSocketPayload.newRequest(
                savedRequest.getId(),
                savedRequest.getStatus().name(),
                deptCode,
                savedRequest.getSummary(),
                savedRequest.getRoomNo(),
                savedRequest.getEntities(),
                graceRemaining,
                savedRequest.getPriority().name());

        // 고객에게는 항상 즉시 알림 (위젯 카드 렌더링)
        dispatchPort.dispatchToRoom(savedRequest.getRoomNo(), payload);

        if (isUrgent) {
            // URGENT: 즉시 직원/관리자 알림 (Grace Period 없음)
            log.info("[GracePeriod] URGENT 요청 → 즉시 직원 알림 발송 — id: {}", savedRequest.getId());
            if (savedRequest.getDomainCode() != null) {
                dispatchPort.dispatchToDepartment(deptCode, payload);
            }
            dispatchPort.dispatchToAdmin(payload);
        } else {
            // 일반: Grace Period 적용 — 10초 후 직원 알림
            log.info("[GracePeriod] 일반 요청 → {}초 후 직원 알림 예정 — id: {}", graceRemaining, savedRequest.getId());
            gracePeriodScheduler.scheduleGraceExpiry(
                    savedRequest.getId(),
                    savedRequest.getRoomNo(),
                    deptCode,
                    payload);
        }
    }



    private String formatEntities(Map<String, Object> entities) {
        if (entities == null || entities.isEmpty()) return "";
        StringBuilder sb = new StringBuilder("[주문 상세]");
        
        // 특별 취급: FB 메뉴 (menu_items 배열 구조)
        if (entities.containsKey("menu_items")) {
            Object menuItems = entities.get("menu_items");
            if (menuItems instanceof List<?> items) {
                sb.append("\n- 메뉴: ");
                List<String> menuStrs = new ArrayList<>();
                for (Object itemObj : items) {
                    if (itemObj instanceof Map<?,?> item) {
                        String name = (String) item.get("name");
                        Object qty = item.get("quantity");
                        String opt = (String) item.get("selected_option");
                        String menuStr = name + " " + qty + "개";
                        if (opt != null && !opt.isBlank() && !"없음".equals(opt)) {
                            menuStr += "(" + opt + ")";
                        }
                        menuStrs.add(menuStr);
                    }
                }
                sb.append(String.join(", ", menuStrs));
            }
        } else {
            // 다른 부서는 key-value 순차 출력 (intent, allergen_warning 제외)
            for (Map.Entry<String, Object> entry : entities.entrySet()) {
                if ("intent".equals(entry.getKey())) continue;
                if ("allergen_warning".equals(entry.getKey())) continue;
                if ("special_requests".equals(entry.getKey())) continue; // 아래에서 별도 처리
                
                sb.append("\n- ").append(entry.getKey()).append(": ").append(entry.getValue());
            }
        }
        
        // 추가 요청 사항이 있으면 표시
        if (entities.containsKey("special_requests")) {
            Object specialReq = entities.get("special_requests");
            if (specialReq != null && !specialReq.toString().isBlank() && !"없음".equals(specialReq.toString())) {
                sb.append("\n- 추가 요청: ").append(specialReq);
            }
        }
        
        return sb.toString();
    }
}
