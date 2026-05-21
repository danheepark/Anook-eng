package com.anook.backend.global.exchangerate.application.port.in;

/**
 * 환율 조회 UseCase (In Port)
 *
 * 캐시된 KRW → USD 환율을 반환한다.
 * 캐시 미존재 시 하드코딩 fallback(1/1400)을 반환한다.
 */
public interface GetExchangeRateUseCase {
    double getKrwToUsdRate();
    double getUsdToKrwRate();
}
