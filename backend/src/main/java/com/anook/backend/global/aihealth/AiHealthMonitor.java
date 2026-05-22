package com.anook.backend.global.aihealth;

import com.anook.backend.global.sse.SseConnectionManager;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * AI 서버(Python) 연결 상태 모니터.
 *
 * 감지 방식:
 *   - 평소: 백그라운드 호출 없음
 *   - analyze() 타임아웃 발생 시: /health 1회 확인 → 실패면 UNHEALTHY 전환
 *   - UNHEALTHY 상태: 30초 간격으로 /health 폴링 → 성공 시 HEALTHY 복귀
 *   - analyze() 실제 성공이 들어오면 즉시 HEALTHY 복귀
 *
 * 상태 변경 시 /topic/frontdesk 채널로 SSE 이벤트(AI_SERVER_STATUS) 전파.
 */
@Slf4j
@Component
public class AiHealthMonitor {

    private static final long RECOVERY_POLL_INTERVAL_SEC = 30;
    private static final Duration PROBE_TIMEOUT = Duration.ofSeconds(5);
    private static final String FRONTDESK_CHANNEL = "/topic/frontdesk";

    private final SseConnectionManager sseConnectionManager;
    private final WebClient webClient;

    private final AtomicReference<AiServerStatus> status = new AtomicReference<>(AiServerStatus.HEALTHY);
    private final AtomicReference<Instant> unhealthySince = new AtomicReference<>(null);
    private final AtomicReference<ScheduledFuture<?>> pollingTask = new AtomicReference<>(null);

    private ScheduledExecutorService scheduler;

    public AiHealthMonitor(
            SseConnectionManager sseConnectionManager,
            @Value("${ai.service.url:http://localhost:8000}") String aiServiceUrl
    ) {
        this.sseConnectionManager = sseConnectionManager;
        this.webClient = WebClient.builder().baseUrl(aiServiceUrl).build();
    }

    @PostConstruct
    public void init() {
        this.scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "ai-health-monitor");
            t.setDaemon(true);
            return t;
        });
    }

    @PreDestroy
    public void shutdown() {
        cancelPolling();
        if (scheduler != null) {
            scheduler.shutdownNow();
        }
    }

    /**
     * PythonAiHttpAdapter에서 analyze() 호출이 실패(타임아웃/5xx 등)했을 때 호출.
     * 현재 HEALTHY 상태라면 /health 한 번 더 확인해서 진짜로 다운됐는지 판단한다.
     */
    public void onAnalyzeFailure() {
        if (status.get() == AiServerStatus.UNHEALTHY) {
            return; // 이미 인지 중
        }
        scheduler.execute(() -> {
            boolean healthy = probeHealth();
            if (!healthy) {
                markUnhealthy();
            }
        });
    }

    /**
     * PythonAiHttpAdapter에서 analyze()가 정상 응답을 받았을 때 호출.
     * UNHEALTHY 상태였다면 즉시 회복으로 판정한다.
     */
    public void onAnalyzeSuccess() {
        if (status.get() == AiServerStatus.UNHEALTHY) {
            markHealthy();
        }
    }

    /**
     * 현재 상태 조회. /api/ai-status 엔드포인트와 수동 확인 버튼에서 사용.
     */
    public AiHealthSnapshot getSnapshot() {
        return new AiHealthSnapshot(status.get(), unhealthySince.get());
    }

    /**
     * 수동 확인 — /health를 즉시 한 번 호출하여 결과 반환.
     * 결과에 따라 상태도 동기화한다.
     */
    public AiHealthSnapshot checkNow() {
        boolean healthy = probeHealth();
        if (healthy && status.get() == AiServerStatus.UNHEALTHY) {
            markHealthy();
        } else if (!healthy && status.get() == AiServerStatus.HEALTHY) {
            markUnhealthy();
        }
        return getSnapshot();
    }

    private boolean probeHealth() {
        try {
            Integer statusCode = webClient.get()
                    .uri("/health")
                    .exchangeToMono(resp -> reactor.core.publisher.Mono.just(resp.statusCode().value()))
                    .timeout(PROBE_TIMEOUT)
                    .block();
            return statusCode != null && statusCode >= 200 && statusCode < 300;
        } catch (Exception e) {
            log.warn("[AiHealthMonitor] /health 확인 실패: {}", e.getMessage());
            return false;
        }
    }

    private synchronized void markUnhealthy() {
        if (status.get() == AiServerStatus.UNHEALTHY) {
            return;
        }
        status.set(AiServerStatus.UNHEALTHY);
        unhealthySince.set(Instant.now());
        log.warn("[AiHealthMonitor] AI 서버 UNHEALTHY 전환");
        dispatchStatus();
        startRecoveryPolling();
    }

    private synchronized void markHealthy() {
        if (status.get() == AiServerStatus.HEALTHY) {
            return;
        }
        status.set(AiServerStatus.HEALTHY);
        unhealthySince.set(null);
        log.info("[AiHealthMonitor] AI 서버 HEALTHY 복귀");
        cancelPolling();
        dispatchStatus();
    }

    private void startRecoveryPolling() {
        cancelPolling();
        ScheduledFuture<?> task = scheduler.scheduleAtFixedRate(() -> {
            try {
                if (probeHealth()) {
                    markHealthy();
                }
            } catch (Exception e) {
                log.warn("[AiHealthMonitor] 복구 폴링 중 오류: {}", e.getMessage());
            }
        }, RECOVERY_POLL_INTERVAL_SEC, RECOVERY_POLL_INTERVAL_SEC, TimeUnit.SECONDS);
        pollingTask.set(task);
    }

    private void cancelPolling() {
        ScheduledFuture<?> task = pollingTask.getAndSet(null);
        if (task != null) {
            task.cancel(false);
        }
    }

    private void dispatchStatus() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "AI_SERVER_STATUS");
        payload.put("status", status.get().name());
        Instant since = unhealthySince.get();
        payload.put("since", since != null ? since.toString() : null);
        sseConnectionManager.sendToChannel(FRONTDESK_CHANNEL, payload);
    }
}
