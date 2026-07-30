package com.anook.backend.request.application.service;

import com.anook.backend.message.application.event.RequestDetectedEvent;
import com.anook.backend.request.application.dto.response.RequestSsePayload;
import com.anook.backend.request.application.port.out.DispatchPort;
import com.anook.backend.request.application.port.out.RequestRepositoryPort;
import com.anook.backend.request.domain.model.DomainCode;
import com.anook.backend.request.domain.model.Priority;
import com.anook.backend.request.domain.model.Request;
import com.anook.backend.request.domain.model.RequestStatus;
import com.anook.backend.global.util.RedisImageCacheUtil;
import com.anook.backend.room.application.service.RoomInventoryService;
import com.anook.backend.room.application.service.InventoryPolicyProperties;
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

@Slf4j
@Service
@RequiredArgsConstructor
public class CreateRequestOnEventService {

    private final RequestRepositoryPort requestRepositoryPort;
    private final DispatchPort dispatchPort;
    private final GracePeriodScheduler gracePeriodScheduler;
    private final RedisImageCacheUtil redisImageCacheUtil;
    private final RoomInventoryService roomInventoryService;
    private final InventoryPolicyProperties inventoryPolicyProperties;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onRequestDetected(RequestDetectedEvent event) {
        log.info("요청 이벤트 수신: roomNo={}, domainCode={}, summary={}",
                event.getRoomNo(), event.getDomainCode(), event.getSummary());

        // DomainCode 파싱 (실패 시 예외 발생)
        DomainCode domainCode = DomainCode.from(event.getDomainCode());

        boolean forceEscalate = false;
        // [Cancel & Replace] AI가 기존 요청을 '수정(REPLACE)'하는 문맥이라고 판단했을 때만 자동 취소
        // [AN-380] ADD_DUPLICATE 이거나 REPLACE 인 경우 기존 요청 처리
        String analysisTargetRequestId = event.getTargetKeyword();
        List<String> modifiedItems = new java.util.ArrayList<>();
        
        if (analysisTargetRequestId != null && ("REPLACE".equals(event.getActionType()) || "ADD_DUPLICATE".equals(event.getActionType()))) {
            // [Keyword Targeting] targetKeyword가 있으면 키워드 매칭으로 대상 탐색
            java.util.Optional<Request> targetRequest = java.util.Optional.empty();

            if (event.getTargetKeyword() != null && !event.getTargetKeyword().isBlank()) {
                List<Request> cancellable = requestRepositoryPort
                        .findAllCancellableByRoomNoAndGuestId(event.getRoomNo(), event.getGuestId());
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
                if (existing.getStatus() == RequestStatus.CREATED || existing.getStatus() == RequestStatus.PENDING) {
                    try {
                        existing.changeStatus(RequestStatus.CANCELLED);
                        requestRepositoryPort.save(existing);

                        // Grace Period 타이머도 취소 (CREATED→PENDING 레이스 컨디션 방지)
                        gracePeriodScheduler.cancelGrace(existing.getId());

                        log.info("[Cancel&Replace] PENDING 요청 자동 취소 — id: {}, summary: {}, keyword: {}",
                                existing.getId(), existing.getSummary(), event.getTargetKeyword());

                        RequestSsePayload cancelPayload = RequestSsePayload.statusChanged(
                                existing.getId(),
                                RequestStatus.CANCELLED.name(),
                                existing.getDomainCode() != null ? existing.getDomainCode().name() : null,
                                existing.getSummary(),
                                existing.getRoomNo(),
                                "AI",
                                "REPLACED");
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

                        RequestSsePayload cancelPayload = RequestSsePayload.cancelRequestReceived(
                                existing.getId(),
                                existing.getDomainCode() != null ? existing.getDomainCode().name() : null,
                                existing.getSummary(),
                                existing.getRoomNo());
                        dispatchPort.dispatchToRoom(event.getRoomNo(), cancelPayload);
                        if (existing.getDepartmentId() != null) {
                            dispatchPort.dispatchToDepartment(existing.getDepartmentId(), cancelPayload);
                        }
                    } catch (Exception e) {
                        log.warn("[Cancel&Replace] IN_PROGRESS 기존 요청 취소 대기 실패: {}", e.getMessage());
                    }
                }
                
                // [AN-423] 수정된 항목 추출 (하단에서 엔티티에 주입됨)
                modifiedItems = computeModifiedItems(existing.getEntities(), event.getEntities());
            } else {
                log.info("[CreateRequest] 교체/추가할 대상(targetRequestId)이 없거나 유효하지 않아 일반 생성 진행 - EventTargetId: {}", analysisTargetRequestId);
            }
        }

        Map<String, Object> finalEntities = new java.util.HashMap<>(event.getEntities() != null ? event.getEntities() : new java.util.HashMap<>());
        if (!modifiedItems.isEmpty()) {
            finalEntities.put("highlight_items", modifiedItems);
        }

        String finalRawText = event.getRawText();
        String formattedEntities = formatEntities(finalEntities);

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
                finalEntities,
                event.getConfidence(),
                finalRawText,
                event.getSummary(),
                event.getReasoning());

        // 긴급 상황 Pre-Filter 감지 여부
        boolean isEmergencyDetected = event.getEntities() != null
                && event.getEntities().containsKey("emergency_category");

        // 에스컬레이션 조건: confidence < 0.7 이거나 event.isEscalated() 가 true인 경우, 또는
        // forceEscalate 가 true인 경우
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

        // [Stateful Inventory] HK 요청 시 즉시 Redis 카운트 증가
        if (domainCode == DomainCode.HK && savedRequest.getEntities() != null) {
            Object itemsObj = savedRequest.getEntities().get("items");
            if (itemsObj instanceof List<?> items) {
                for (Object itemObj : items) {
                    if (itemObj instanceof Map<?, ?> itemMap) {
                        String name = (String) itemMap.get("item");
                        Object countObj = itemMap.get("count");
                        if (name != null && countObj != null) {
                            int quantity = 0;
                            if (countObj instanceof Integer)
                                quantity = (Integer) countObj;
                            else if (countObj instanceof Double)
                                quantity = ((Double) countObj).intValue();
                            else if (countObj instanceof String) {
                                try {
                                    quantity = Integer.parseInt((String) countObj);
                                } catch (Exception ignored) {
                                }
                            }

                            if (quantity > 0) {
                                boolean matched = false;
                                for (InventoryPolicyProperties.PolicyItem policy : inventoryPolicyProperties
                                        .getPolicies()) {
                                    for (String alias : policy.getAliases()) {
                                        if (name.equalsIgnoreCase(policy.getCode())
                                                || name.toLowerCase().contains(alias.toLowerCase())) {
                                            roomInventoryService.incrementItem(savedRequest.getRoomNo(),
                                                    policy.getCode(), quantity);
                                            log.info("[Inventory] 즉시 인벤토리 반영: 객실 {} / {} x{}", savedRequest.getRoomNo(),
                                                    policy.getCode(), quantity);
                                            matched = true;
                                            break;
                                        }
                                    }
                                    if (matched)
                                        break;
                                }
                            }
                        }
                    }
                }
            }
        }

        if (event.getImages() != null && !event.getImages().isEmpty()) {
            java.time.Duration ttl = java.time.Duration.ofDays(3); // 최대 3일, 체크아웃 시 자동 파기
            for (String base64Image : event.getImages()) {
                redisImageCacheUtil.saveImage(savedRequest.getRoomNo(), savedRequest.getId(), base64Image, ttl);
            }
        }

        boolean isEmergency = savedRequest.getPriority() == Priority.EMERGENCY;
        boolean isComplaint = savedRequest.getEntities() != null && "COMPLAINT".equalsIgnoreCase(String.valueOf(savedRequest.getEntities().get("intent")));

        boolean isFbOrConcierge = savedRequest.getDomainCode() == DomainCode.FB
                || savedRequest.getDomainCode() == DomainCode.CONCIERGE;

        boolean isPaidHk = savedRequest.getDomainCode() == DomainCode.HK &&
                savedRequest.getEntities() != null &&
                ("true".equalsIgnoreCase(String.valueOf(savedRequest.getEntities().get("has_extra_charge"))));

        boolean requiresExplicitConfirm = isFbOrConcierge || isPaidHk;
        boolean skipGrace = isEmergency || isComplaint;

        String deptCode = savedRequest.getDomainCode() != null ? savedRequest.getDomainCode().name() : "UNKNOWN";
        int graceRemaining;
        if (skipGrace) {
            graceRemaining = 0;
        } else if (requiresExplicitConfirm) {
            graceRemaining = -1; // 고객 확인 대기 (타이머 없음)
        } else {
            graceRemaining = GracePeriodScheduler.GRACE_SECONDS;
        }

        // [AN-252] Generative UI: entities 포함 WebSocket payload 생성
        RequestSsePayload payload = RequestSsePayload.newRequest(
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

        if (skipGrace) {
            // URGENT / FRONT 에스컬레이션: 즉시 직원/관리자 알림 (Grace Period 없음)
            // CREATED → PENDING 즉시 전환 (ESCALATED는 이미 markEmergency()에서 전환됨)
            if (savedRequest.getStatus() == RequestStatus.CREATED) {
                savedRequest.confirmGrace();
                savedRequest = requestRepositoryPort.save(savedRequest);
            }
            log.info("[GracePeriod] 즉시 발송 (emergency={}) — id: {}", isEmergency,
                    savedRequest.getId());
            if (savedRequest.getDomainCode() != null) {
                dispatchPort.dispatchToDepartment(deptCode, payload);
            }
            dispatchPort.dispatchToFrontdesk(payload);
        } else if (requiresExplicitConfirm) {
            // FB/CONCIERGE: 고객 확인 대기 — 타이머 없이 "진행" 버튼 클릭 시 confirmEarly로 발송
            log.info("[GracePeriod] 고객 확인 대기 (domain={}) — id: {}", deptCode, savedRequest.getId());
        } else {
            // 일반(HK, FACILITY 등): Grace Period 적용 — 10초 후 직원 알림
            log.info("[GracePeriod] 일반 요청 → {}초 후 직원 알림 예정 — id: {}", graceRemaining, savedRequest.getId());
            gracePeriodScheduler.scheduleGraceExpiry(
                    savedRequest.getId(),
                    savedRequest.getRoomNo(),
                    deptCode,
                    payload);
        }
    }

    private String formatEntities(Map<String, Object> entities) {
        if (entities == null || entities.isEmpty())
            return "";
        StringBuilder sb = new StringBuilder("[주문 상세]");

        // 특별 취급: FB 메뉴 (menu_items 배열 구조)
        if (entities.containsKey("menu_items")) {
            Object menuItems = entities.get("menu_items");
            if (menuItems instanceof List<?> items) {
                sb.append("\n- 메뉴: ");
                List<String> menuStrs = new ArrayList<>();
                for (Object itemObj : items) {
                    if (itemObj instanceof Map<?, ?> item) {
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
                if ("intent".equals(entry.getKey()))
                    continue;
                if ("allergen_warning".equals(entry.getKey()))
                    continue;
                if ("special_requests".equals(entry.getKey()))
                    continue; // 아래에서 별도 처리

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

    @SuppressWarnings("unchecked")
    private List<String> computeModifiedItems(Map<String, Object> oldEntities, Map<String, Object> newEntities) {
        List<String> modifiedItems = new ArrayList<>();
        if (oldEntities == null || newEntities == null) return modifiedItems;

        // F&B (menu_items)
        if (newEntities.containsKey("menu_items") && oldEntities.containsKey("menu_items")) {
            Map<String, Integer> oldCounts = new java.util.HashMap<>();
            Object oldMenu = oldEntities.get("menu_items");
            if (oldMenu instanceof List) {
                for (Object obj : (List<?>) oldMenu) {
                    if (obj instanceof Map) {
                        Map<String, Object> item = (Map<String, Object>) obj;
                        String name = (String) item.get("name");
                        Object qtyObj = item.get("quantity");
                        if (name != null) {
                            int qty = (qtyObj instanceof Number) ? ((Number) qtyObj).intValue() : 1;
                            oldCounts.put(name, oldCounts.getOrDefault(name, 0) + qty);
                        }
                    }
                }
            }

            Object newMenu = newEntities.get("menu_items");
            if (newMenu instanceof List) {
                for (Object obj : (List<?>) newMenu) {
                    if (obj instanceof Map) {
                        Map<String, Object> item = (Map<String, Object>) obj;
                        String name = (String) item.get("name");
                        Object qtyObj = item.get("quantity");
                        if (name != null) {
                            int qty = (qtyObj instanceof Number) ? ((Number) qtyObj).intValue() : 1;
                            if (!oldCounts.containsKey(name) || oldCounts.get(name) != qty) {
                                modifiedItems.add(name);
                            }
                        }
                    }
                }
            }
        }

        // HK (items)
        if (newEntities.containsKey("items") && oldEntities.containsKey("items")) {
            Map<String, Integer> oldCounts = new java.util.HashMap<>();
            Object oldItems = oldEntities.get("items");
            if (oldItems instanceof List) {
                for (Object obj : (List<?>) oldItems) {
                    if (obj instanceof Map) {
                        Map<String, Object> item = (Map<String, Object>) obj;
                        String name = (String) item.get("item");
                        Object qtyObj = item.get("count");
                        if (name != null) {
                            int qty = (qtyObj instanceof Number) ? ((Number) qtyObj).intValue() : 1;
                            oldCounts.put(name, oldCounts.getOrDefault(name, 0) + qty);
                        }
                    }
                }
            }

            Object newItems = newEntities.get("items");
            if (newItems instanceof List) {
                for (Object obj : (List<?>) newItems) {
                    if (obj instanceof Map) {
                        Map<String, Object> item = (Map<String, Object>) obj;
                        String name = (String) item.get("item");
                        Object qtyObj = item.get("count");
                        if (name != null) {
                            int qty = (qtyObj instanceof Number) ? ((Number) qtyObj).intValue() : 1;
                            if (!oldCounts.containsKey(name) || oldCounts.get(name) != qty) {
                                modifiedItems.add(name);
                            }
                        }
                    }
                }
            }
        }

        return modifiedItems;
    }
}
