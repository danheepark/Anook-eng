package com.anook.backend.request.adapter.out.sse;

import com.anook.backend.global.sse.SseConnectionManager;
import com.anook.backend.request.application.dto.response.RequestSsePayload;
import com.anook.backend.request.application.port.out.DispatchPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class RequestSseDispatchAdapter implements DispatchPort {

    private final SseConnectionManager sseConnectionManager;

    @Override
    public void dispatchToRoom(String roomNo, RequestSsePayload payload) {
        String destination = "/topic/room/" + roomNo;
        log.info("[SSE-Request] → destination={}, payload={}", destination, payload);
        sseConnectionManager.sendToChannel(destination, payload);
    }

    @Override
    public void dispatchToDepartment(String deptCode, RequestSsePayload payload) {
        String destination = "/topic/dept/" + deptCode;
        log.info("[SSE-Request] → destination={}, payload={}", destination, payload);
        sseConnectionManager.sendToChannel(destination, payload);
    }

    @Override
    public void dispatchToFrontdesk(RequestSsePayload payload) {
        String destination = "/topic/frontdesk";
        log.info("[SSE-Request] → destination={}, payload={}", destination, payload);
        sseConnectionManager.sendToChannel(destination, payload);
    }
}
