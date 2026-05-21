package com.anook.backend.global.exchangerate.application.port.in;

/**
 * 환율 캐시 갱신 UseCase (In Port)
 *
 * 외부 API에서 최신 USD 환율을 가져와 캐시를 갱신한다.
 * 스케줄러 등 inbound adapter가 트리거한다.
 */
public interface RefreshExchangeRateUseCase {
    void refresh();
}
