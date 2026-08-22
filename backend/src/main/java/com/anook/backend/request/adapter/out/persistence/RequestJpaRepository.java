package com.anook.backend.request.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Request JPA Repository — request 모듈 전용
 */
public interface RequestJpaRepository extends JpaRepository<RequestJpaEntity, Long> {

    /**
     * 방번호로 해당 객실의 모든 요청 조회 (직원용)
     */
    List<RequestJpaEntity> findByRoomNo(String roomNo);

    /**
     * 방번호와 투숙객 ID로 해당 객실의 모든 요청 조회 (고객용 격리 조회)
     */
    List<RequestJpaEntity> findByRoomNoAndGuestId(String roomNo, Long guestId);

    /**
     * 특정 객실, 투숙객의 가장 최근 생성된 취소 가능(PENDING) 상태의 요청 1건 조회
     */
    java.util.Optional<RequestJpaEntity> findFirstByRoomNoAndGuestIdAndStatusInOrderByCreatedAtDesc(String roomNo, Long guestId, List<String> statuses);

    /**
     * 특정 객실, 투숙객의 모든 취소 가능 상태의 요청 목록 조회
     */
    List<RequestJpaEntity> findByRoomNoAndGuestIdAndStatusIn(String roomNo, Long guestId, List<String> statuses);

    /**
     * 특정 객실, 투숙객, 특정 부서의 가장 최근 생성된 취소 가능 상태의 요청 1건 조회
     */
    java.util.Optional<RequestJpaEntity> findFirstByRoomNoAndGuestIdAndDepartmentIdAndStatusInOrderByCreatedAtDesc(String roomNo, Long guestId, String departmentId, List<String> statuses);

    /**
     * [Cancel & Replace] 같은 객실, 투숙객, 부서의 PENDING 상태 요청 목록 조회
     */
    List<RequestJpaEntity> findByRoomNoAndGuestIdAndDepartmentIdAndStatus(String roomNo, Long guestId, String departmentId, String status);

    /**
     * 해당 객실의 활성 상태 요청 조회 (체크아웃 일괄 취소용)
     */
    List<RequestJpaEntity> findByRoomNoAndStatusIn(String roomNo, List<String> statuses);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(value = "UPDATE message SET request_id = NULL WHERE room_no = :roomNo", nativeQuery = true)
    void nullifyMessageRequestIdByRoomNo(@org.springframework.data.repository.query.Param("roomNo") String roomNo);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(value = "UPDATE ai_log SET request_id = NULL WHERE request_id IN (SELECT id FROM request WHERE room_no = :roomNo)", nativeQuery = true)
    void nullifyAiLogRequestIdByRoomNo(@org.springframework.data.repository.query.Param("roomNo") String roomNo);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("DELETE FROM RequestJpaEntity r WHERE r.roomNo = :roomNo")
    void deleteByRoomNo(@org.springframework.data.repository.query.Param("roomNo") String roomNo);
}
