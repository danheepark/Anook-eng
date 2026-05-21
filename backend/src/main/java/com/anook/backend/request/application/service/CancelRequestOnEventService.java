package com.anook.backend.request.application.service;
 
import com.anook.backend.message.application.event.RequestCancelledByGuestEvent;
import com.anook.backend.request.application.dto.response.RequestSsePayload;
import com.anook.backend.request.application.port.out.DispatchPort;
import com.anook.backend.request.application.port.out.RequestRepositoryPort;
import com.anook.backend.request.domain.model.Request;
import com.anook.backend.request.domain.model.RequestStatus;
import com.anook.backend.request.domain.model.DomainCode;
import com.anook.backend.room.application.service.RoomInventoryService;
import com.anook.backend.room.application.service.InventoryPolicyProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
 
 
import java.util.Optional;
 
/**
 * Message 모듈에서 발생한 '요청 취소' 이벤트를 구독하여 처리하는 서비스.
 *
 * 고객이 AI 챗봇을 통해 취소 의사를 밝히면(MessageAiResult action="CANCEL_REQUEST"),
 * 이 서비스가 가장 최근 취소 가능한 요청을 찾아 취소(CANCELLED) 처리하고 UI에 알림을 보냅니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CancelRequestOnEventService {
 
    private final RequestRepositoryPort requestPort;
    private final DispatchPort dispatchPort;
    private final RoomInventoryService roomInventoryService;
    private final InventoryPolicyProperties inventoryPolicyProperties;

    @EventListener
    @Transactional
    public void onGuestCancel(RequestCancelledByGuestEvent event) {
        log.info("[Request] RequestCancelledByGuestEvent 수신 — room: {}, guest: {}, domain: {}, targetKeyword: {}, targetRequestId: {}",
                event.getRoomNo(), event.getGuestId(), event.getDomainCode(), event.getTargetKeyword(), event.getTargetRequestId());

        // [ID Targeting] 최우선 순위: AI가 확정한 targetRequestId가 있으면 해당 요청 핀포인트 취소
        if (event.getTargetRequestId() != null) {
            Optional<Request> matched = requestPort.findById(event.getTargetRequestId());
            if (matched.isPresent()) {
                Request req = matched.get();
                // 권한 검증: 본인(동일 객실/고객)의 취소 가능한 요청인지 확인
                if (req.getRoomNo().equals(event.getRoomNo()) && req.getGuestId().equals(event.getGuestId()) && 
                    (req.getStatus() == RequestStatus.PENDING || req.getStatus() == RequestStatus.IN_PROGRESS || req.getStatus() == RequestStatus.ESCALATED)) {
                    cancelSingleRequest(req, event.getRoomNo());
                    return;
                }
            }
            log.warn("[Request] targetRequestId '{}' 매칭 실패 또는 권한 없음 → 최신 건 폴백", event.getTargetRequestId());
        }

        // [Keyword Targeting] ID가 없을 경우 대비 레거시 폴백: 단순 문자열 포함 여부 검사 (동의어 하드코딩 제거)
        if (event.getTargetKeyword() != null && !event.getTargetKeyword().isBlank()) {
            Optional<Request> matched = findByKeywordFallback(event.getRoomNo(), event.getGuestId(), event.getTargetKeyword());
            if (matched.isPresent()) {
                cancelSingleRequest(matched.get(), event.getRoomNo());
                return;
            }
            log.info("[Request] 키워드 '{}' 매칭 실패 → 최신 건 폴백", event.getTargetKeyword());
        }

        // 키워드 없거나 매칭 실패 시 기존 로직 (최신 건 취소)
        Optional<Request> latestRequest;
        if (event.getDomainCode() != null && !event.getDomainCode().isBlank()) {
            latestRequest = requestPort.findLatestCancellableByRoomNoAndGuestIdAndDomainCode(event.getRoomNo(), event.getGuestId(), event.getDomainCode());
        } else {
            latestRequest = requestPort.findLatestCancellableByRoomNoAndGuestId(event.getRoomNo(), event.getGuestId());
        }

        if (latestRequest.isPresent()) {
            cancelSingleRequest(latestRequest.get(), event.getRoomNo());
        } else {
            log.info("[Request] 취소 가능한 요청이 없습니다 — room: {}", event.getRoomNo());
        }
    }

    /**
     * [Fallback] ID 매칭 실패 시 사용할 단순 키워드 폴백.
     * (동의어 하드코딩은 AI 라우터로 이관되어 제거됨)
     */
    private Optional<Request> findByKeywordFallback(String roomNo, Long guestId, String keyword) {
        java.util.List<Request> cancellable = requestPort.findAllCancellableByRoomNoAndGuestId(roomNo, guestId);
        String lowerKeyword = keyword.toLowerCase();
        
        return cancellable.stream()
                .filter(r -> {
                    if (r.getSummary() == null) return false;
                    return r.getSummary().toLowerCase().contains(lowerKeyword);
                })
                .findFirst(); // findAllCancellableByRoomNoAndGuestId는 최신순 정렬
    }

    private void cancelSingleRequest(Request request, String roomNo) {
        try {
            if (request.getStatus() == RequestStatus.PENDING || request.getStatus() == RequestStatus.ESCALATED) {
                request.changeStatus(RequestStatus.CANCELLED);
                requestPort.save(request);

                log.info("[Request] 최근 요청 취소 완료 — id: {}, newStatus: {}", request.getId(), request.getStatus());

                // [Stateful Inventory] Redis 물품 차감 원복
                if (request.getDomainCode() == DomainCode.HK && request.getEntities() != null) {
                    Object itemsObj = request.getEntities().get("items");
                    if (itemsObj instanceof java.util.List<?> items) {
                        for (Object itemObj : items) {
                            if (itemObj instanceof java.util.Map<?, ?> itemMap) {
                                String name = (String) itemMap.get("item");
                                Object countObj = itemMap.get("count");
                                if (name != null && countObj != null) {
                                    int quantity = 0;
                                    if (countObj instanceof Integer) quantity = (Integer) countObj;
                                    else if (countObj instanceof Double) quantity = ((Double) countObj).intValue();
                                    else if (countObj instanceof String) {
                                        try { quantity = Integer.parseInt((String) countObj); } catch (Exception ignored) {}
                                    }

                                    if (quantity > 0) {
                                        boolean matched = false;
                                        for (InventoryPolicyProperties.PolicyItem policy : inventoryPolicyProperties.getPolicies()) {
                                            for (String alias : policy.getAliases()) {
                                                if (name.equalsIgnoreCase(policy.getCode()) || name.toLowerCase().contains(alias.toLowerCase())) {
                                                    roomInventoryService.decrementItem(request.getRoomNo(), policy.getCode(), quantity);
                                                    log.info("[Inventory] 취소 원복 반영: 객실 {} / {} x{}", request.getRoomNo(), policy.getCode(), quantity);
                                                    matched = true;
                                                    break;
                                                }
                                            }
                                            if (matched) break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // 웹소켓 발송: 프론트엔드 UI(게이지바) 업데이트용
                RequestSsePayload payload = RequestSsePayload.statusChanged(
                        request.getId(), request.getStatus().name(),
                        request.getDomainCode() != null ? request.getDomainCode().name() : null,
                        request.getSummary(), request.getRoomNo()
                );
                dispatchPort.dispatchToRoom(roomNo, payload);

                // 관리자 대시보드 쪽에도 취소되었다는 알림 전송 (필요 시)
                if (request.getDepartmentId() != null) {
                    dispatchPort.dispatchToDepartment(request.getDepartmentId(), payload);
                }
                dispatchPort.dispatchToFrontdesk(payload);
            } else if (request.getStatus() == RequestStatus.IN_PROGRESS) {
                request.requestCancellation();
                requestPort.save(request);

                log.info("[Request] 최근 요청 취소 승인 대기 처리 완료 — id: {}", request.getId());

                RequestSsePayload payload = RequestSsePayload.cancelRequestReceived(
                        request.getId(),
                        request.getDomainCode() != null ? request.getDomainCode().name() : null,
                        request.getSummary(), request.getRoomNo()
                );
                dispatchPort.dispatchToRoom(roomNo, payload);

                if (request.getDepartmentId() != null) {
                    dispatchPort.dispatchToDepartment(request.getDepartmentId(), payload);
                }
                dispatchPort.dispatchToFrontdesk(payload);
            }

        } catch (IllegalStateException e) {
            log.warn("[Request] 취소 불가능한 상태이거나 도메인 규칙 위반 — id: {}, reason: {}", request.getId(), e.getMessage());
        }
    }

    @EventListener
    @Transactional
    public void onGuestCancelAll(com.anook.backend.message.application.event.AllRequestsCancelledByGuestEvent event) {
        log.info("[Request] AllRequestsCancelledByGuestEvent 수신 — room: {}, guest: {}", event.getRoomNo(), event.getGuestId());

        java.util.List<Request> allPending = requestPort.findAllCancellableByRoomNoAndGuestId(event.getRoomNo(), event.getGuestId());
        if (allPending.isEmpty()) {
            log.info("[Request] 취소 가능한 전체 요청이 없습니다 — room: {}", event.getRoomNo());
            return;
        }
        
        for (Request request : allPending) {
            cancelSingleRequest(request, event.getRoomNo());
        }
    }
}
