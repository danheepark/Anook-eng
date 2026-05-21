package com.anook.backend.message.adapter.out.sse;

import com.anook.backend.global.sse.SseConnectionManager;
import com.anook.backend.message.application.port.out.MessageDispatchPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class MessageSseDispatchAdapter implements MessageDispatchPort {

    private final SseConnectionManager sseConnectionManager;

    @Override
    public void sendToRoom(String roomNo, Object payload) {
        String destination = "/topic/room/" + roomNo;
        log.info("[SSE-Message] → {} | payload: {}", destination, payload);
        sseConnectionManager.sendToChannel(destination, payload);
    }

    @Override
    public void sendToDept(String deptCode, Object payload) {
        String destination = "/topic/dept/" + deptCode;
        log.info("[SSE-Message] → {} | payload: {}", destination, payload);
        sseConnectionManager.sendToChannel(destination, payload);
    }

    @Override
    public void sendToFrontdesk(Object payload) {
        String destination = "/topic/frontdesk";
        log.info("[SSE-Message] → {} | payload: {}", destination, payload);
        sseConnectionManager.sendToChannel(destination, payload);
    }
}
