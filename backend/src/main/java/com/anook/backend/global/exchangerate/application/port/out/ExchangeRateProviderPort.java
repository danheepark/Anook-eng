package com.anook.backend.global.exchangerate.application.port.out;

import com.anook.backend.global.exchangerate.domain.model.ExchangeRate;

import java.util.Optional;

/**
 * 환율 외부 제공자 Port (Out)
 *
 * 한국수출입은행 등 외부 API에서 최신 USD 환율을 조회한다.
 * 영업일/공휴일 등으로 응답이 비어있으면 Optional.empty() 반환.
 */
public interface ExchangeRateProviderPort {
    Optional<ExchangeRate> fetchLatestUsdRate();
}
