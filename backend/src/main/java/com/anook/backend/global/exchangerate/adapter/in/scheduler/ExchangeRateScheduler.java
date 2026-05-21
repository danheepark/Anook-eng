package com.anook.backend.global.exchangerate.adapter.in.scheduler;

import com.anook.backend.global.exchangerate.application.port.in.RefreshExchangeRateUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 환율 갱신 스케줄러 (Inbound Adapter)
 *
 * - startup 완료 후 비동기로 첫 갱신 (별도 스레드로 fire-and-forget → startup 블록 방지)
 * - 이후 매일 오전 11:30 KST에 정기 갱신 (한국수출입은행은 영업일 11시 이후 당일 환율 제공)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ExchangeRateScheduler {

    private final RefreshExchangeRateUseCase refreshUseCase;

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        Thread initThread = new Thread(refreshUseCase::refresh, "exchange-rate-init");
        initThread.setDaemon(true);
        initThread.start();
        log.info("[ExchangeRate] startup 후 비동기 첫 갱신 트리거됨");
    }

    @Scheduled(cron = "0 30 11 * * *", zone = "Asia/Seoul")
    public void scheduledRefresh() {
        log.info("[ExchangeRate] 정기 스케줄 트리거 (매일 11:30 KST)");
        refreshUseCase.refresh();
    }
}
