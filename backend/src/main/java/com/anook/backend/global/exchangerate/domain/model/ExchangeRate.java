package com.anook.backend.global.exchangerate.domain.model;

import java.time.LocalDate;

/**
 * 환율 도메인 모델
 *
 * usdToKrw: 1 USD = N KRW (예: 1380.50)
 * baseDate: 환율 기준일 (한국수출입은행이 응답한 searchdate)
 */
public record ExchangeRate(
        double usdToKrw,
        LocalDate baseDate
) {
    public double krwToUsd() {
        return 1.0 / usdToKrw;
    }
}
