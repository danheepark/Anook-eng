package com.anook.backend.global.exchangerate.application.service;

import com.anook.backend.global.exchangerate.application.port.in.GetExchangeRateUseCase;
import com.anook.backend.global.exchangerate.application.port.in.RefreshExchangeRateUseCase;
import com.anook.backend.global.exchangerate.application.port.out.ExchangeRateProviderPort;
import com.anook.backend.global.exchangerate.domain.model.ExchangeRate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 환율 캐시 서비스
 *
 * 메모리에 최신 USD 환율을 보관한다.
 * 캐시 미존재 또는 외부 호출 실패 시 1 USD = 1400 KRW fallback.
 *
 * 갱신 트리거는 ExchangeRateScheduler가 RefreshExchangeRateUseCase를 통해 담당
 * (startup 후 비동기 1회 + 매일 11:30 KST).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExchangeRateService implements GetExchangeRateUseCase, RefreshExchangeRateUseCase {

    private static final double FALLBACK_USD_TO_KRW = 1400.0;

    private final ExchangeRateProviderPort provider;
    private final AtomicReference<ExchangeRate> cache = new AtomicReference<>();

    @Override
    public void refresh() {
        Optional<ExchangeRate> latest = provider.fetchLatestUsdRate();
        if (latest.isPresent()) {
            cache.set(latest.get());
            log.info("[ExchangeRate] 캐시 갱신 — 1 USD = {} KRW (기준일 {})",
                    latest.get().usdToKrw(), latest.get().baseDate());
        } else {
            log.warn("[ExchangeRate] 외부 조회 실패 — 기존 캐시 유지 ({})", cache.get());
        }
    }

    @Override
    public double getKrwToUsdRate() {
        ExchangeRate current = cache.get();
        if (current == null) {
            return 1.0 / FALLBACK_USD_TO_KRW;
        }
        return current.krwToUsd();
    }

    @Override
    public double getUsdToKrwRate() {
        ExchangeRate current = cache.get();
        if (current == null) {
            return FALLBACK_USD_TO_KRW;
        }
        return current.usdToKrw();
    }
}
