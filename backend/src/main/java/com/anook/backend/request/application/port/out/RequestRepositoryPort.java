package com.anook.backend.request.application.port.out;

import com.anook.backend.request.domain.model.Request;

import java.util.List;
import java.util.Optional;

/**
 * Request 영속성 포트 — 도메인 모델만 반환
 */
public interface RequestRepositoryPort {

    // === 기존 (정산 기능용) ===

    /**
     * ID로 요청의 현재 상태 조회 (경량 DTO)
     */
    Optional<RequestStatusDto> findStatusById(Long id);

    /**
     * 요청 상태 변경
     */
    void updateStatus(Long id, String status);

    // === 신규 (RQ-1 추가) ===

    /**
     * Request 도메인 모델 저장
     */
    Request save(Request request);

    /**
     * 방번호로 해당 객실의 모든 요청 조회 (직원용)
     */
    List<Request> findByRoomNo(String roomNo);

    /**
     * 방번호와 투숙객 ID로 해당 객실의 모든 요청 조회 (고객용 격리 조회)
     */
    List<Request> findByRoomNoAndGuestId(String roomNo, Long guestId);

    /**
     * ID로 Request 도메인 모델 조회
     */
    Optional<Request> findById(Long id);

    /**
     * 특정 객실, 투숙객의 가장 최근 생성된 취소 가능(PENDING) 상태의 요청 1건 조회
     */
    Optional<Request> findLatestCancellableByRoomNoAndGuestId(String roomNo, Long guestId);

    /**
     * 특정 객실, 투숙객의 모든 취소 가능 상태의 요청 목록 조회
     */
    List<Request> findAllCancellableByRoomNoAndGuestId(String roomNo, Long guestId);

    /**
     * 특정 객실, 투숙객, 특정 부서의 가장 최근 생성된 취소 가능 상태의 요청 1건 조회
     */
    Optional<Request> findLatestCancellableByRoomNoAndGuestIdAndDomainCode(String roomNo, Long guestId, String domainCode);

    /**
     * [Cancel & Replace] 같은 객실, 투숙객, 부서의 PENDING 상태 요청 목록 조회
     */
    List<Request> findPendingByRoomNoAndGuestIdAndDepartmentId(String roomNo, Long guestId, String departmentId);

    /**
     * 해당 객실의 모든 활성(미완료) 요청 조회 — 체크아웃 시 일괄 취소용
     * (guestId 무관: 체크아웃 시 guest가 이미 삭제될 수 있으므로)
     */
    List<Request> findActiveByRoomNo(String roomNo);

    /**
     * 해당 객실의 모든 요청 DB 삭제 (체크아웃 시 완전히 비우기)
     */
    void deleteByRoomNo(String roomNo);

    /**
     * 상태 조회 DTO (Port 레벨에서 사용하는 경량 DTO)
     */
    record RequestStatusDto(
            Long id,
            String status,
            String departmentId,
            String summary
    ) {}
}
