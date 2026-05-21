package com.anook.backend.frontdesk.request.application.port.in;

import com.anook.backend.frontdesk.request.application.dto.request.AssignRequestCommand;
import com.anook.backend.frontdesk.request.application.dto.request.ChangeRequestPriorityCommand;
import com.anook.backend.frontdesk.request.application.dto.request.CreateFrontdeskRequestCommand;
import com.anook.backend.frontdesk.request.application.dto.response.FrontdeskRequestDetailResult;
import com.anook.backend.frontdesk.request.application.dto.response.FrontdeskRequestListResult;
import com.anook.backend.frontdesk.request.application.dto.response.FrontdeskRequestStatsResult;

import java.util.List;

/**
 * 관리자 요청 관리 UseCase
 */
public interface ManageFrontdeskRequestUseCase {

    /**
     * 전체 요청 목록 조회 (필터링 + 정렬)
     */
    List<FrontdeskRequestListResult> getAllRequests(String status, String departmentId, String priority,
            List<String> exclude, String sort);

    /**
     * 단건 요청 상세 조회
     */
    FrontdeskRequestDetailResult getRequestDetail(Long id);

    /**
     * 담당자 배정/재배정
     */
    void assignRequest(Long id, AssignRequestCommand command);

    /**
     * 우선순위 변경
     */
    void changeRequestPriority(Long id, ChangeRequestPriorityCommand command);

    /**
     * 상태 변경 (프론트데스크 상담 라이프사이클 처리용)
     */
    void changeStatus(Long id, String status);

    /**
     * 요청 취소 (관리자 권한)
     * 
     * @param id              요청 ID
     * @param rejectionReason 반려 사유 (널 가능 — 에스컬레이션 반려 시만 사용)
     */
    void cancelRequest(Long id, String rejectionReason);

    /**
     * 부서 변경 (관리자 수동 배정) — summary/description도 함께 변경 가능
     */
    void changeDepartment(Long id, String departmentId, String summary, String description);

    /**
     * 요약(제목) 및 설명 변경
     */
    void updateSummary(Long id, String summary, String description);

    /**
     * 에스컬레이션 대상 목록 조회
     */
    List<FrontdeskRequestListResult> getEscalations();

    /**
     * 에스컬레이션 승인
     */
    void escalateRequest(Long id, String departmentId, String priority);

    /**
     * 직원 이관 요청 — 부서 변경 + ESCALATED 상태 전환 (관리자 승인 대기)
     */
    void requestEscalation(Long id, String targetDepartmentId);

    /**
     * 관리자 수동 요청 생성
     */
    FrontdeskRequestDetailResult createRequest(CreateFrontdeskRequestCommand command);

    /**
     * 대시보드 통계
     */
    FrontdeskRequestStatsResult getStats();

    /**
     * 고객의 취소 요청 승인
     *
     * @param id 요청 ID
     */
    void approveCancellation(Long id);

    /**
     * 고객의 취소 요청 반려
     *
     * @param id              요청 ID
     * @param rejectionReason 반려 사유
     */
    void rejectCancellation(Long id, String rejectionReason);
}
