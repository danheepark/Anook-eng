package com.anook.backend.room.application.listener;

import com.anook.backend.guest.domain.event.GuestCheckedOutEvent;
import com.anook.backend.room.application.port.out.RoomDispatchPort;
import com.anook.backend.room.application.service.RoomInventoryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * 체크아웃 이벤트 리스너 (ANOOK 측)
 *
 * PMS에서 체크아웃이 발생하면 해당 객실의 QR 인증 세션을 무효화한다.
 * 해당 객실의 물품 사용량(Redis 키: room:inventory:{roomNo})을 초기화한다.
 * WebSocket을 통해 해당 객실 브라우저에 세션 만료 알림을 보낸다.
 *
 * ❌ SimpMessagingTemplate 직접 사용 금지 → RoomDispatchPort로 추상화
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class GuestCheckOutListener {

    private final RoomDispatchPort roomDispatchPort;
    private final RoomInventoryService roomInventoryService;

    @EventListener
    public void onGuestCheckedOut(GuestCheckedOutEvent event) {
        String roomNumber = event.roomNumber();

        // 1. WebSocket으로 해당 방 브라우저에 세션 만료 알림 전송
        roomDispatchPort.dispatchSessionExpired(roomNumber);

        // 2. 해당 객실의 물품 사용량 리셋
        roomInventoryService.resetInventory(roomNumber);

        log.info("[ANOOK] {}호 체크아웃 감지 → QR 세션 무효화 및 물품 사용량 리셋 완료", roomNumber);
    }
}
