package com.anook.backend.request.application.service;

import com.anook.backend.request.application.dto.response.RequestSsePayload;
import com.anook.backend.request.application.port.out.DispatchPort;
import com.anook.backend.request.application.port.out.RequestRepositoryPort;
import com.anook.backend.request.domain.model.Request;
import com.anook.backend.request.domain.model.RequestStatus;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/**
 * Grace Period 스케줄러 — 요청 생성 후 직원 알림을 지연시키는 Delay Queue
 *
 * [AN-252] Gmail의 '보내기 취소(Undo)' 패턴과 동일한 UX.
 * 요청 생성 직후 10초간 고객에게 수정/취소 기회를 주고,
 * 10초가 지나면 직원에게 알림을 발송한다.
 *
 * URGENT 요청은 이 스케줄러를 거치지 않고 즉시 알림이 전달된다.
 */
@Slf4j
@Service
public class GracePeriodScheduler {

    /** Grace Period 기본 대기 시간 (초) */
    public static final int GRACE_SECONDS = 10;

    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
    private final ConcurrentHashMap<Long, ScheduledFuture<?>> scheduledTasks = new ConcurrentHashMap<>();
    
    private final RequestRepositoryPort requestPort;
    private final DispatchPort dispatchPort;

    public GracePeriodScheduler(RequestRepositoryPort requestPort, DispatchPort dispatchPort) {
        this.requestPort = requestPort;
        this.dispatchPort = dispatchPort;
    }

    /**
     * Grace Period 만료 작업을 스케줄링한다.
     *
     * @param requestId  대기 중인 요청 ID
     * @param roomNo     고객 객실 번호 (GRACE_EXPIRED 알림 전송용)
     * @param deptCode   부서 코드 (직원 알림 전송용)
     * @param payload    직원에게 보낼 원본 WebSocket 페이로드
     */
    public void scheduleGraceExpiry(Long requestId, String roomNo,
                                     String deptCode, RequestSsePayload payload) {
        log.info("[GracePeriod] 스케줄 등록 — requestId: {}, {}초 후 직원 알림 발송 예정", requestId, GRACE_SECONDS);

        ScheduledFuture<?> future = scheduler.schedule(() -> {
            scheduledTasks.remove(requestId);
            try {
                Optional<Request> requestOpt = requestPort.findById(requestId);

                if (requestOpt.isEmpty()) {
                    log.warn("[GracePeriod] 요청을 찾을 수 없음 — requestId: {}", requestId);
                    return;
                }

                Request request = requestOpt.get();

                if (request.getStatus() == RequestStatus.PENDING) {
                    // Grace Period 만료 — 직원에게 알림 발송
                    log.info("[GracePeriod] 만료 → 직원 알림 발송 — requestId: {}, dept: {}", requestId, deptCode);

                    dispatchPort.dispatchToDepartment(deptCode, payload);
                    dispatchPort.dispatchToFrontdesk(payload);

                    // 고객 UI에 Grace 만료 알림 (버튼 숨기기)
                    RequestSsePayload graceExpired = RequestSsePayload.graceExpired(requestId, roomNo);
                    dispatchPort.dispatchToRoom(roomNo, graceExpired);
                } else {
                    // 고객이 이미 취소했거나 상태가 바뀐 경우 — 아무것도 안 함
                    log.info("[GracePeriod] 이미 상태 변경됨 → 직원 알림 생략 — requestId: {}, status: {}",
                            requestId, request.getStatus());
                }
            } catch (Exception e) {
                log.error("[GracePeriod] 만료 처리 중 오류 — requestId: {}, error: {}", requestId, e.getMessage(), e);
            }
        }, GRACE_SECONDS, TimeUnit.SECONDS);

        scheduledTasks.put(requestId, future);
    }

    /**
     * 고객이 10초 대기를 스킵하고 수락(Confirm) 버튼을 누른 경우,
     * 스케줄을 즉시 취소하고 즉시 직원에게 알림을 발송한다.
     */
    public void confirmEarly(Long requestId, String roomNo) {
        ScheduledFuture<?> future = scheduledTasks.remove(requestId);
        if (future != null) {
            future.cancel(false);
            log.info("[GracePeriod] 스케줄 취소(고객 수락) — requestId: {}", requestId);
        }

        try {
            Optional<Request> requestOpt = requestPort.findById(requestId);
            if (requestOpt.isPresent()) {
                Request request = requestOpt.get();
                if (request.getStatus() == RequestStatus.PENDING) {
                    String deptCode = request.getDomainCode() != null ? request.getDomainCode().name() : "UNKNOWN";
                    
                    log.info("[GracePeriod] 수락하기 즉시 발송 — requestId: {}, dept: {}", requestId, deptCode);

                    // 직원 대시보드 발송 시 graceRemaining을 0으로 설정하여 보냄
                    RequestSsePayload payload = RequestSsePayload.newRequest(
                            request.getId(),
                            request.getStatus().name(),
                            deptCode,
                            request.getSummary(),
                            request.getRoomNo(),
                            request.getEntities(),
                            0, // 남은 시간 0
                            request.getPriority().name()
                    );

                    dispatchPort.dispatchToDepartment(deptCode, payload);
                    dispatchPort.dispatchToFrontdesk(payload);

                    // 고객 UI에 완료(만료) 알림
                    RequestSsePayload graceExpired = RequestSsePayload.graceExpired(requestId, roomNo);
                    dispatchPort.dispatchToRoom(roomNo, graceExpired);
                }
            }
        } catch (Exception e) {
            log.error("[GracePeriod] 고객 수락 처리 중 오류 — requestId: {}, error: {}", requestId, e.getMessage(), e);
        }
    }

    /**
     * 애플리케이션 종료 시 스케줄러 정리
     */
    @PreDestroy
    public void shutdown() {
        scheduler.shutdown();
        try {
            if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
                scheduler.shutdownNow();
            }
        } catch (InterruptedException e) {
            scheduler.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }
}
