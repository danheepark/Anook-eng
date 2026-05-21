package com.anook.backend.global.sse.adapter.in.web;

import com.anook.backend.global.sse.SseConnectionManager;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.HandlerMapping;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequiredArgsConstructor
public class SseConnectionController {

    private final SseConnectionManager sseConnectionManager;

    @GetMapping(value = "/events/subscribe/**", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribe(HttpServletRequest request) {
        String path = (String) request.getAttribute(HandlerMapping.PATH_WITHIN_HANDLER_MAPPING_ATTRIBUTE);
        
        // path is something like "/events/subscribe/room/707"
        // we want to extract "room/707"
        String channel = "";
        if (path != null) {
            channel = path.replaceFirst("^/events/subscribe/", "");
        }
        
        // Add prefix `/topic/` to match existing websocket paths for easy migration
        // The existing websocket adapters send to "/topic/room/707"
        // So we subscribe to "/topic/" + channel
        String fullChannel = "/topic/" + channel;
        
        return sseConnectionManager.connect(fullChannel);
    }
}
