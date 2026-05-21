package com.anook.backend.global.sse;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Slf4j
@Component
public class SseConnectionManager {

    // channel -> List of SseEmitters
    private final Map<String, List<SseEmitter>> emitters = new ConcurrentHashMap<>();

    // SSE 기본 타임아웃 30분
    private static final long DEFAULT_TIMEOUT = 30 * 60 * 1000L;

    public SseEmitter connect(String channel) {
        SseEmitter emitter = new SseEmitter(DEFAULT_TIMEOUT);

        emitters.computeIfAbsent(channel, k -> new CopyOnWriteArrayList<>()).add(emitter);

        emitter.onCompletion(() -> removeEmitter(channel, emitter));
        emitter.onTimeout(() -> removeEmitter(channel, emitter));
        emitter.onError(e -> removeEmitter(channel, emitter));

        try {
            // 초기 더미 데이터 전송 (연결 확인용 및 브라우저/Nginx 버퍼 비우기 용도)
            emitter.send(SseEmitter.event()
                    .name("CONNECT")
                    .data("connected"));
            log.info("[SSE] Connected to channel: {}, Current total in channel: {}", channel, emitters.get(channel).size());
        } catch (IOException e) {
            log.error("[SSE] Failed to send connect event to channel: {}", channel, e);
            removeEmitter(channel, emitter);
        }

        return emitter;
    }

    public void sendToChannel(String channel, Object payload) {
        List<SseEmitter> channelEmitters = emitters.get(channel);
        if (channelEmitters == null || channelEmitters.isEmpty()) {
            return;
        }

        for (SseEmitter emitter : channelEmitters) {
            try {
                emitter.send(SseEmitter.event()
                        .name("message")
                        .data(payload));
            } catch (IOException e) {
                log.warn("[SSE] Failed to send message to channel: {}, removing emitter", channel);
                removeEmitter(channel, emitter);
            }
        }
    }

    // Nginx 프록시 등에서 idle timeout으로 연결이 끊기는 것을 방지하기 위해 30초마다 더미 이벤트 발송
    @Scheduled(fixedRate = 30000)
    public void sendHeartbeat() {
        emitters.forEach((channel, channelEmitters) -> {
            for (SseEmitter emitter : channelEmitters) {
                try {
                    emitter.send(SseEmitter.event().name("ping").data("alive"));
                } catch (IOException e) {
                    removeEmitter(channel, emitter);
                }
            }
        });
    }

    private void removeEmitter(String channel, SseEmitter emitter) {
        List<SseEmitter> channelEmitters = emitters.get(channel);
        if (channelEmitters != null) {
            channelEmitters.remove(emitter);
            if (channelEmitters.isEmpty()) {
                emitters.remove(channel);
            }
            log.info("[SSE] Removed emitter from channel: {}. Remaining in channel: {}", channel, channelEmitters.size());
        }
    }
}
