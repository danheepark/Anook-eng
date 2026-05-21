package com.anook.backend.request.application.service;

import com.anook.backend.request.application.port.in.RateRequestUseCase;
import com.anook.backend.request.application.port.out.RequestRepositoryPort;
import com.anook.backend.request.domain.model.Request;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 고객 피드백 별점 등록 서비스
 *
 * 모든 피드백은 request.rating 컬럼에 저장합니다.
 * - AI 처리 요청: /frontdesk/ai-routing 에서 조회
 * - 직원 상담 요청 (FRONT): /frontdesk/voc 별점 탭에서 조회
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RateRequestService implements RateRequestUseCase {

    private final RequestRepositoryPort requestRepositoryPort;

    @Override
    @Transactional
    public void rateRequest(Long requestId, String roomNo, int rating) {
        Request request = requestRepositoryPort.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("요청을 찾을 수 없습니다: " + requestId));

        // 본인 객실 검증
        if (!request.getRoomNo().equals(roomNo)) {
            throw new IllegalStateException("해당 객실의 요청이 아닙니다.");
        }

        request.rate(rating);
        requestRepositoryPort.save(request);

        log.info("[RateRequestService] 피드백 등록 — requestId: {}, rating: {}, department: {}",
                requestId, rating, request.getDomainCode());
    }
}
