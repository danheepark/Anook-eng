package com.anook.backend.room.adapter.out.sse;

import com.anook.backend.global.sse.SseConnectionManager;
import com.anook.backend.room.application.port.out.RoomDispatchPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class RoomSseDispatchAdapter implements RoomDispatchPort {

    private final SseConnectionManager sseConnectionManager;

    @Override
    public void dispatchSessionExpired(String roomNo) {
        String destination = "/topic/room/" + roomNo;
        Map<String, String> payload = Map.of("type", "SESSION_EXPIRED");
        log.info("[SSE-Room] → destination={}, type=SESSION_EXPIRED", destination);
        sseConnectionManager.sendToChannel(destination, payload);
    }
}
