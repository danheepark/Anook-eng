package com.anook.backend.request.application.port.in;

/**
 * 고객 피드백 별점 등록 UseCase
 */
public interface RateRequestUseCase {

    /**
     * 특정 요청에 별점(1~5)을 등록합니다.
     */
    void rateRequest(Long requestId, String roomNo, int rating);
}
