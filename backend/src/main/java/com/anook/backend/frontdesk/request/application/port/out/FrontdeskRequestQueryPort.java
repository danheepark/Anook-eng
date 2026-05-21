package com.anook.backend.frontdesk.request.application.port.out;

import com.anook.backend.frontdesk.request.domain.model.FrontdeskRequest;

import java.util.List;
import java.util.Optional;

/**
 * 관리자 요청 영속성 포트
 *
 * request 테이블에 대한 읽기/쓰기 접근을 추상화합니다.
 * frontdesk 모듈의 JPA Entity(FrontdeskRequestJpaEntity)를 통해 구현됩니다.
 */
public interface FrontdeskRequestQueryPort {

    // === 읽기 ===

    /**
     * 전체 요청 목록 조회 (필터링 + 정렬)
     */
    List<FrontdeskRequest> findAll(String status, String departmentId, String priority, List<String> exclude, String sort);

    /**
     * 단건 조회
     */
    Optional<FrontdeskRequest> findById(Long id);

    // === 쓰기 ===

    /**
     * 담당자 배정/재배정
     */
    void assignStaff(Long requestId, Long staffId, String staffDepartmentId);

    /**
     * 우선순위 변경
     */
    void updatePriority(Long requestId, String priority);

    /**
     * 요청 취소
     */
    void cancel(Long requestId);

    /**
     * 고객의 취소 요청 승인
     */
    void approveCancellation(Long requestId);

    /**
     * 고객의 취소 요청 반려
     */
    void rejectCancellation(Long requestId);

    /**
     * 요약(제목) 및 설명 변경
     */
    void updateSummary(Long requestId, String summary, String description);

    /**
     * 부서 변경 (관리자 수동 배정)
     */
    void changeDepartment(Long requestId, String departmentId);

    /**
     * 에스컬레이션 승인
     */
    void escalate(Long requestId, String departmentId, String priority);

    /**
     * 직원 이관 요청 (부서 변경 + 상태를 ESCALATED로 전환 → 관리자 승인 대기)
     */
    void requestEscalation(Long requestId, String targetDepartmentId);

    /**
     * 상태 변경 (프론트데스크 상담 라이프사이클 처리용)
     */
    void updateStatus(Long requestId, String status);

    /**
     * 에스컬레이션 대상 목록 (ESCALATED 상태)
     */
    List<FrontdeskRequest> findEscalations();

    /**
     * 요청 저장 — 수동 생성
     */
    FrontdeskRequest save(String departmentId, String roomNo, String summary,
                      String rawText, String priority, Long assignedStaffId, Long guestId);

    /**
     * 방 번호로 투숙객 ID 조회 — 기존 요청에서 guest_id를 찾아 반환
     */
    Long findGuestIdByRoomNo(String roomNo);

    // === 통계 ===

    long countAll();
    List<Object[]> countByStatus();
    List<Object[]> countByDepartment();
    List<Object[]> countByPriority();
}
