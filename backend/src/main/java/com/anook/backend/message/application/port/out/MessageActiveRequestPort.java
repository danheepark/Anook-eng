package com.anook.backend.message.application.port.out;

import java.util.List;
import java.util.Map;

/**
 * 활성 주문(취소 가능한 요청) 조회 Port
 *
 * message 모듈에서 현재 사용자의 취소 가능한 요청 목록을 조회하기 위한 읽기 전용 포트.
 * AI 서버 호출 시 Context Injection (활성 요청 목록 주입)을 위해 사용됩니다.
 */
public interface MessageActiveRequestPort {

    /**
     * 특정 객실의 활성화된(처리 중이거나 대기 중인) 예약/요청 내역 요약을 조회합니다.
     * @param roomNo 객실 번호
     * @return 활성화된 요청 요약 문자열 리스트 (예: ["택시 예약 (오후 3시)"])
     */
    List<String> getActiveRequestSummaries(String roomNo);

    /**
     * 해당 객실, 해당 고객의 PENDING 상태(또는 취소 가능한) 요청 목록을 조회
     *
     * @param roomNo 객실 번호
     * @param guestId 고객 ID
     * @return 활성 요청 목록 (id, department_id, summary, status 등 포함)
     */
    java.util.List<java.util.Map<String, Object>> findActiveRequests(String roomNo, Long guestId);

    /**
     * 특정 요청 ID를 기준으로 요청 상세 정보를 조회합니다.
     * @param requestId 요청 ID
     * @return 요청 상세 정보 Map
     */
    java.util.Map<String, Object> findRequestById(Long requestId);

}
