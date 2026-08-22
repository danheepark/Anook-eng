package com.anook.backend.request.application.listener;

import com.anook.backend.guest.domain.event.GuestCheckedOutEvent;
import com.anook.backend.request.application.dto.response.RequestSsePayload;
import com.anook.backend.request.application.port.out.DispatchPort;
import com.anook.backend.request.application.port.out.RequestRepositoryPort;
import com.anook.backend.request.domain.model.Request;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 체크아웃 이벤트 리스너 (Request 모듈)
 *
 * 투숙객이 체크아웃하면, 해당 객실의 모든 요청(Request)을 DB에서 완전 삭제(Hard Delete)하고
 * 프론트데스크 UI에 실시간 삭제 반영 알림을 보낸다.
 *
 * 사유: 체크아웃 후에는 객실에 사람이 없으므로 진행 중/완료 카드 목록에서 완전히 제거되어야 한다.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class RequestCheckOutListener {

    private final RequestRepositoryPort requestPort;
    private final DispatchPort dispatchPort;

    @EventListener
    @Transactional
    public void onGuestCheckedOut(GuestCheckedOutEvent event) {
        String roomNumber = event.roomNumber();

        List<Request> requests = requestPort.findByRoomNo(roomNumber);
        if (requests.isEmpty()) {
            log.info("[Request] {}호 체크아웃 — 요청 없음, 스킵", roomNumber);
            return;
        }

        log.info("[Request] {}호 체크아웃 — 요청 {}건 DB 완전 삭제 시작", roomNumber, requests.size());

        // 1. 해당 객실의 모든 요청 DB에서 완전 삭제
        requestPort.deleteByRoomNo(roomNumber);

        // 2. 프론트데스크 UI 실시간 업데이트 알림 발송 (STATUS_CHANGED -> DELETED 이벤트)
        RequestSsePayload payload = RequestSsePayload.statusChanged(
                null,
                "DELETED",
                null,
                "CheckOut Clear",
                roomNumber,
                "SYSTEM",
                "CHECKOUT"
        );

        dispatchPort.dispatchToFrontdesk(payload);

        log.info("[Request] {}호 체크아웃 — 요청 DB 완전 삭제 및 WebSocket 알림 완료", roomNumber);
    }
}
