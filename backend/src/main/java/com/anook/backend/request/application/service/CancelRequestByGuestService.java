package com.anook.backend.request.application.service;

import com.anook.backend.global.exception.BusinessException;
import com.anook.backend.global.exception.ErrorCode;
import com.anook.backend.request.application.dto.response.RequestSsePayload;
import com.anook.backend.request.application.port.in.CancelRequestUseCase;
import com.anook.backend.request.application.port.out.DispatchPort;
import com.anook.backend.request.application.port.out.RequestRepositoryPort;
import com.anook.backend.request.domain.model.Request;
import com.anook.backend.request.domain.model.RequestStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 고객이 위젯 카드의 [취소]/[수정] 버튼을 눌러 직접 취소하는 서비스
 *
 * [AN-252] Grace Period 내 고객 주도 취소:
 * - 본인 요청만 취소 가능 (roomNo + guestId 교차 검증)
 * - 취소 성공 시 WebSocket으로 고객 + 부서 알림 발송
 * - Grace Period 만료 전 취소 시 직원에게 알림이 가지 않음
 * (GracePeriodScheduler가 DB 상태를 재확인하기 때문)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CancelRequestByGuestService implements CancelRequestUseCase {

    private final RequestRepositoryPort requestPort;
    private final DispatchPort dispatchPort;

    @Override
    @Transactional
    public void cancelByGuest(Long requestId, String roomNo, Long guestId) {
        log.info("[CancelByGuest] 취소 요청 — requestId: {}, roomNo: {}, guestId: {}", requestId, roomNo, guestId);

        // 1. 요청 조회
        Request request = requestPort.findById(requestId)
                .orElseThrow(() -> {
                    log.warn("[CancelByGuest] 요청을 찾을 수 없음 — requestId: {}", requestId);
                    return new BusinessException(ErrorCode.REQUEST_NOT_FOUND);
                });

        // 2. 본인 검증: 요청의 roomNo와 guestId가 JWT에서 추출된 값과 일치하는지 확인
        if (!request.getRoomNo().equals(roomNo) || !request.getGuestId().equals(guestId)) {
            log.warn("[CancelByGuest] 본인 요청이 아님 — requestId: {}, expectedRoom: {}, actualRoom: {}",
                    requestId, roomNo, request.getRoomNo());
            throw new BusinessException(ErrorCode.ACCESS_DENIED);
        }

        // 3. 도메인 로직: 상태 변경 (PENDING → CANCELLED)
        try {
            request.changeStatus(RequestStatus.CANCELLED);
        } catch (IllegalStateException e) {
            log.warn("[CancelByGuest] 취소 불가능한 상태 — requestId: {}, status: {}", requestId, request.getStatus());
            throw new BusinessException(ErrorCode.INVALID_SETTLEMENT); // 상태 전환 불가 (400)
        }

        requestPort.save(request);
        log.info("[CancelByGuest] 취소 완료 — requestId: {}, newStatus: CANCELLED", requestId);

        // 4. WebSocket 알림: 고객 UI 업데이트
        RequestSsePayload payload = RequestSsePayload.statusChanged(
                request.getId(),
                RequestStatus.CANCELLED.name(),
                request.getDomainCode() != null ? request.getDomainCode().name() : null,
                request.getSummary(),
                request.getRoomNo(),
                "GUEST");
        dispatchPort.dispatchToRoom(roomNo, payload);

        // 5. 이미 Grace Period가 만료되어 직원이 배정된 경우 → 직원에게도 취소 알림
        if (request.getDepartmentId() != null) {
            dispatchPort.dispatchToDepartment(request.getDepartmentId(), payload);
        }
    }
}
