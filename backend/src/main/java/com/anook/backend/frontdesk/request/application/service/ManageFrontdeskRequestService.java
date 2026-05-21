package com.anook.backend.frontdesk.request.application.service;

import com.anook.backend.frontdesk.department.application.dto.response.DepartmentInfo;
import com.anook.backend.frontdesk.department.application.port.in.ListDepartmentsUseCase;
import com.anook.backend.frontdesk.request.application.dto.request.AssignRequestCommand;
import com.anook.backend.frontdesk.request.application.dto.request.ChangeRequestPriorityCommand;
import com.anook.backend.frontdesk.request.application.dto.request.CreateFrontdeskRequestCommand;
import com.anook.backend.frontdesk.request.application.dto.response.FrontdeskRequestDetailResult;
import com.anook.backend.frontdesk.request.application.dto.response.FrontdeskRequestListResult;
import com.anook.backend.frontdesk.request.application.dto.response.FrontdeskRequestStatsResult;
import com.anook.backend.frontdesk.request.application.port.in.ManageFrontdeskRequestUseCase;
import com.anook.backend.frontdesk.request.application.port.out.FrontdeskRequestQueryPort;
import com.anook.backend.frontdesk.request.application.port.out.FrontdeskRequestMessagePort;
import com.anook.backend.frontdesk.request.application.port.out.FrontdeskRequestDispatchPort;
import com.anook.backend.frontdesk.request.domain.model.FrontdeskRequest;
import com.anook.backend.request.application.dto.response.RequestSsePayload;
import com.anook.backend.request.application.port.out.DispatchPort;
import com.anook.backend.frontdesk.staff.application.dto.response.GetStaffResult;
import com.anook.backend.frontdesk.staff.application.port.in.ManageStaffUseCase;
import com.anook.backend.global.util.RedisImageCacheUtil;
import com.anook.backend.pms.application.port.in.GenerateReceiptUseCase;
import com.anook.backend.global.exception.BusinessException;
import com.anook.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 관리자 요청 관리 Service
 *
 * 부서명/직원명은 다른 모듈의 UseCase(Port In)를 통해 조회합니다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ManageFrontdeskRequestService implements ManageFrontdeskRequestUseCase {

    private final FrontdeskRequestQueryPort frontdeskRequestQueryPort;
    private final FrontdeskRequestMessagePort frontdeskRequestMessagePort;
    private final FrontdeskRequestDispatchPort frontdeskRequestDispatchPort;
    private final ListDepartmentsUseCase listDepartmentsUseCase;
    private final ManageStaffUseCase manageStaffUseCase;
    private final DispatchPort dispatchPort;
    private final RedisImageCacheUtil redisImageCacheUtil;
    private final GenerateReceiptUseCase generateReceiptUseCase;

    @Override
    public List<FrontdeskRequestListResult> getAllRequests(String status, String departmentId, String priority, List<String> exclude, String sort) {
        List<FrontdeskRequest> requests = frontdeskRequestQueryPort.findAll(status, departmentId, priority, exclude, sort);

        // 부서명/직원명 조회용 Map 구성
        Map<String, String> deptNameMap = buildDeptNameMap();
        Map<Long, String> staffNameMap = buildStaffNameMap();

        return requests.stream()
                .map(r -> toListResult(r, deptNameMap, staffNameMap))
                .toList();
    }

    @Override
    public FrontdeskRequestDetailResult getRequestDetail(Long id) {
        FrontdeskRequest request = frontdeskRequestQueryPort.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.REQUEST_NOT_FOUND));

        Map<String, String> deptNameMap = buildDeptNameMap();
        Map<Long, String> staffNameMap = buildStaffNameMap();

        FrontdeskRequestDetailResult detail = toDetailResult(request, deptNameMap, staffNameMap);
        String base64Image = redisImageCacheUtil.getImage(request.getRoomNo(), request.getId());
        if (base64Image != null) {
            String imageUrl = base64Image.startsWith("data:") ? base64Image : "data:image/jpeg;base64," + base64Image;
            return new FrontdeskRequestDetailResult(
                    detail.id(), detail.status(), detail.priority(), detail.departmentId(), detail.departmentName(),
                    detail.entities(), detail.rawText(), detail.summary(), detail.confidence(), detail.roomNo(),
                    detail.assignedStaffId(), detail.assignedStaffName(), detail.version(), detail.cancelRequested(),
                    detail.cancelRequestedAt(), detail.createdAt(), detail.updatedAt(), imageUrl, detail.reasoning()
            );
        }
        return detail;
    }

    @Override
    @Transactional
    public void assignRequest(Long id, AssignRequestCommand command) {
        FrontdeskRequest request = frontdeskRequestQueryPort.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.REQUEST_NOT_FOUND));

        if (!request.isAssignable()) {
            throw new IllegalStateException("현재 상태에서는 담당자를 배정할 수 없습니다: " + request.getStatus());
        }

        // 직원 부서를 조회하여 해당 부서로 요청의 소속을 변경 (부서간 업무 이관 지원)
        com.anook.backend.frontdesk.staff.application.dto.response.GetStaffResult staff = 
                manageStaffUseCase.getById(command.staffId());

        frontdeskRequestQueryPort.assignStaff(id, command.staffId(), staff.departmentId());
        
        RequestSsePayload payload = RequestSsePayload.statusChanged(
                id, "IN_PROGRESS", staff.departmentId(), request.getSummary(), request.getRoomNo(), "STAFF"
        );
        dispatchPort.dispatchToRoom(request.getRoomNo(), payload);
        dispatchPort.dispatchToDepartment(staff.departmentId(), payload);
        dispatchPort.dispatchToFrontdesk(payload);
    }

    @Override
    @Transactional
    public void changeRequestPriority(Long id, ChangeRequestPriorityCommand command) {
        frontdeskRequestQueryPort.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.REQUEST_NOT_FOUND));

        frontdeskRequestQueryPort.updatePriority(id, command.priority().toUpperCase());
    }

    @Override
    @Transactional
    public void changeStatus(Long id, String status) {
        FrontdeskRequest request = frontdeskRequestQueryPort.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.REQUEST_NOT_FOUND));

        frontdeskRequestQueryPort.updateStatus(id, status.toUpperCase());

        // COMPLETED 상태로 변경 시 → PMS 모듈의 UseCase를 직접 호출하여 영수증 생성 및 AI 컨텍스트 리셋
        if ("COMPLETED".equalsIgnoreCase(status)) {
            generateReceiptUseCase.generate(request.getRoomNo(), request.getDepartmentId(), request.getEntities());
            
            // [AN-337] 상담 완료 시 AI 컨텍스트 리셋을 위한 시스템 마커 메시지 삽입 (프론트엔드에서 필터링됨)
            frontdeskRequestMessagePort.sendStaffMessage(request.getRoomNo(), "[SYSTEM] 이전 상담 및 처리가 모두 완료되었습니다.");
        }

        RequestSsePayload payload = RequestSsePayload.statusChanged(
                id, status.toUpperCase(), request.getDepartmentId(), request.getSummary(), request.getRoomNo(), "STAFF"
        );
        dispatchPort.dispatchToRoom(request.getRoomNo(), payload);
        dispatchPort.dispatchToDepartment(request.getDepartmentId(), payload);
        dispatchPort.dispatchToFrontdesk(payload);
    }

    @Override
    @Transactional
    public void cancelRequest(Long id, String rejectionReason) {
        FrontdeskRequest request = frontdeskRequestQueryPort.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.REQUEST_NOT_FOUND));

        if (!request.isCancellable()) {
            throw new IllegalStateException("이미 취소되었거나 정산 완료된 요청입니다: " + request.getStatus());
        }

        frontdeskRequestQueryPort.cancel(id);

        RequestSsePayload payload = RequestSsePayload.statusChanged(
                id, "CANCELLED", request.getDepartmentId(), request.getSummary(), request.getRoomNo(), "STAFF"
        );
        dispatchPort.dispatchToRoom(request.getRoomNo(), payload);
        dispatchPort.dispatchToDepartment(request.getDepartmentId(), payload);
        dispatchPort.dispatchToFrontdesk(payload);

        // 반려 사유가 있으면 해당 객실의 대화 내역에 STAFF 메시지로 저장
        if (rejectionReason != null && !rejectionReason.isBlank()) {
            String formattedMessage = "[요청 반려] " + rejectionReason;
            frontdeskRequestMessagePort.sendStaffMessage(request.getRoomNo(), formattedMessage);
        }
    }

    @Override
    @Transactional
    public void changeDepartment(Long id, String departmentId, String summary, String description) {
        FrontdeskRequest before = frontdeskRequestQueryPort.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.REQUEST_NOT_FOUND));
        String previousDeptId = before.getDepartmentId();

        // summary/description이 전달되면 같은 트랜잭션에서 먼저 업데이트
        if (summary != null && !summary.isBlank()) {
            frontdeskRequestQueryPort.updateSummary(id, summary, description);
        }

        frontdeskRequestQueryPort.changeDepartment(id, departmentId);

        // Re-fetch — summary + department 모두 반영된 최신 데이터
        FrontdeskRequest updated = frontdeskRequestQueryPort.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.REQUEST_NOT_FOUND));

        // entities, priority를 포함한 full payload (Guest RequestCard 렌더링용)
        RequestSsePayload payload = RequestSsePayload.newRequest(
                id, updated.getStatus(), departmentId, updated.getSummary(), updated.getRoomNo(),
                updated.getEntities(), 0, updated.getPriority()
        );
        dispatchPort.dispatchToRoom(updated.getRoomNo(), payload);
        dispatchPort.dispatchToDepartment(departmentId, payload);
        // 이전 부서에도 알림 (프론트 데스크 → 타 부서 이관 시 원래 부서에서 제거용)
        if (!departmentId.equals(previousDeptId)) {
            dispatchPort.dispatchToDepartment(previousDeptId, payload);
        }
        dispatchPort.dispatchToFrontdesk(payload);
    }

    @Override
    @Transactional
    public void updateSummary(Long id, String summary, String description) {
        frontdeskRequestQueryPort.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.REQUEST_NOT_FOUND));

        frontdeskRequestQueryPort.updateSummary(id, summary, description);
    }

    @Override
    @Transactional
    public void approveCancellation(Long id) {
        FrontdeskRequest request = frontdeskRequestQueryPort.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.REQUEST_NOT_FOUND));

        frontdeskRequestQueryPort.approveCancellation(id);

        RequestSsePayload payload = RequestSsePayload.cancelApproved(
                id, request.getDepartmentId(), request.getSummary(), request.getRoomNo(), "STAFF"
        );
        dispatchPort.dispatchToRoom(request.getRoomNo(), payload);
        dispatchPort.dispatchToDepartment(request.getDepartmentId(), payload);
        dispatchPort.dispatchToFrontdesk(payload);
    }

    @Override
    @Transactional
    public void rejectCancellation(Long id, String rejectionReason) {
        FrontdeskRequest request = frontdeskRequestQueryPort.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.REQUEST_NOT_FOUND));

        frontdeskRequestQueryPort.rejectCancellation(id);

        RequestSsePayload payload = RequestSsePayload.cancelRejected(
                id, request.getDepartmentId(), request.getSummary(), request.getRoomNo(), "STAFF"
        );
        dispatchPort.dispatchToRoom(request.getRoomNo(), payload);
        dispatchPort.dispatchToDepartment(request.getDepartmentId(), payload);
        dispatchPort.dispatchToFrontdesk(payload);

        if (rejectionReason != null && !rejectionReason.isBlank()) {
            String formattedMessage = "[취소 반려] " + rejectionReason;
            frontdeskRequestMessagePort.sendStaffMessage(request.getRoomNo(), formattedMessage);
            // DB 저장 후 WebSocket으로도 실시간 전송 (게스트 챗봇에 반려 사유 표시)
            frontdeskRequestDispatchPort.dispatchStaffMessage(
                    request.getRoomNo(), null, formattedMessage
            );
        }
    }

    @Override
    public List<FrontdeskRequestListResult> getEscalations() {
        List<FrontdeskRequest> escalations = frontdeskRequestQueryPort.findEscalations();

        Map<String, String> deptNameMap = buildDeptNameMap();
        Map<Long, String> staffNameMap = buildStaffNameMap();

        return escalations.stream()
                .map(r -> toListResult(r, deptNameMap, staffNameMap))
                .toList();
    }

    @Override
    @Transactional
    public void escalateRequest(Long id, String departmentId, String priority) {
        FrontdeskRequest request = frontdeskRequestQueryPort.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.REQUEST_NOT_FOUND));

        frontdeskRequestQueryPort.escalate(id, departmentId, priority);

        RequestSsePayload payload = RequestSsePayload.statusChanged(
                id, request.getStatus(), departmentId, request.getSummary(), request.getRoomNo(), "STAFF"
        );
        dispatchPort.dispatchToRoom(request.getRoomNo(), payload);
        dispatchPort.dispatchToDepartment(departmentId, payload);
        if (!departmentId.equals(request.getDepartmentId())) {
            dispatchPort.dispatchToDepartment(request.getDepartmentId(), payload);
        }
        dispatchPort.dispatchToFrontdesk(payload);
    }

    @Override
    @Transactional
    public void requestEscalation(Long id, String targetDepartmentId) {
        FrontdeskRequest request = frontdeskRequestQueryPort.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.REQUEST_NOT_FOUND));

        frontdeskRequestQueryPort.requestEscalation(id, targetDepartmentId);

        RequestSsePayload payload = RequestSsePayload.statusChanged(
                id, "ESCALATED", targetDepartmentId, request.getSummary(), request.getRoomNo(), "STAFF"
        );
        dispatchPort.dispatchToRoom(request.getRoomNo(), payload);
        dispatchPort.dispatchToDepartment(targetDepartmentId, payload);
        if (!targetDepartmentId.equals(request.getDepartmentId())) {
            dispatchPort.dispatchToDepartment(request.getDepartmentId(), payload);
        }
        dispatchPort.dispatchToFrontdesk(payload);
    }

    @Override
    @Transactional
    public FrontdeskRequestDetailResult createRequest(CreateFrontdeskRequestCommand command) {
        // 방 번호로 투숙객 ID 조회 (기존 요청에서 guest_id를 가져옴)
        Long guestId = frontdeskRequestQueryPort.findGuestIdByRoomNo(command.roomNo());

        FrontdeskRequest saved = frontdeskRequestQueryPort.save(
                command.departmentId().toUpperCase(),
                command.roomNo(),
                command.summary(),
                command.rawText(),
                command.priority(),
                command.assignedStaffId(),
                guestId
        );

        // [AN-307] 수동 생성 시 WebSocket 알림 발송 (고객 & 부서)
        RequestSsePayload payload = RequestSsePayload.newRequest(
                saved.getId(),
                saved.getStatus(),
                saved.getDepartmentId(),
                saved.getSummary(),
                saved.getRoomNo(),
                saved.getEntities(),
                0, // 수동 생성은 Grace Period 없음
                saved.getPriority()
        );
        dispatchPort.dispatchToRoom(saved.getRoomNo(), payload);
        dispatchPort.dispatchToDepartment(saved.getDepartmentId(), payload);
        dispatchPort.dispatchToFrontdesk(payload);

        Map<String, String> deptNameMap = buildDeptNameMap();
        Map<Long, String> staffNameMap = buildStaffNameMap();

        return toDetailResult(saved, deptNameMap, staffNameMap);
    }

    @Override
    public FrontdeskRequestStatsResult getStats() {
        long total = frontdeskRequestQueryPort.countAll();

        Map<String, Long> byStatus = toMap(frontdeskRequestQueryPort.countByStatus());
        Map<String, Long> byDept = toMap(frontdeskRequestQueryPort.countByDepartment());
        Map<String, Long> byPriority = toMap(frontdeskRequestQueryPort.countByPriority());

        long overdueCount = frontdeskRequestQueryPort.findEscalations().size();

        // 전체 데이터 조회하여 실제 통계 계산
        List<com.anook.backend.frontdesk.request.domain.model.FrontdeskRequest> allRequests = 
                frontdeskRequestQueryPort.findAll(null, null, null, null, null);

        // 4. 최다 요청 항목 동적 추출 (AI 엔티티 기반)
        Map<String, Long> itemCounts = new java.util.HashMap<>();
        
        for (com.anook.backend.frontdesk.request.domain.model.FrontdeskRequest r : allRequests) {
            Map<String, Object> entities = r.getEntities();
            if (entities != null && entities.containsKey("REQ_ITEM")) {
                Object reqItemObj = entities.get("REQ_ITEM");
                if (reqItemObj instanceof java.util.List<?> list) {
                    for (Object item : list) {
                        String itemStr = item.toString().trim();
                        if (!itemStr.isEmpty()) {
                            itemCounts.put(itemStr, itemCounts.getOrDefault(itemStr, 0L) + 1);
                        }
                    }
                } else if (reqItemObj instanceof String itemStr) {
                    itemStr = itemStr.trim();
                    if (!itemStr.isEmpty()) {
                        itemCounts.put(itemStr, itemCounts.getOrDefault(itemStr, 0L) + 1);
                    }
                }
            }
        }

        // 카운트 기준으로 내림차순 정렬
        List<Map.Entry<String, Long>> sortedItems = new java.util.ArrayList<>(itemCounts.entrySet());
        sortedItems.sort((e1, e2) -> e2.getValue().compareTo(e1.getValue()));

        Map<String, Long> frequentRequests = new java.util.LinkedHashMap<>();
        long otherCount = 0;
        
        // 상위 4개 추출, 나머지는 '기타'로 합산
        for (int i = 0; i < sortedItems.size(); i++) {
            if (i < 4) {
                frequentRequests.put(sortedItems.get(i).getKey(), sortedItems.get(i).getValue());
            } else {
                otherCount += sortedItems.get(i).getValue();
            }
        }
        
        if (otherCount > 0 || frequentRequests.isEmpty()) {
            frequentRequests.put("기타", otherCount);
        }
        
        long completedCount = allRequests.stream()
                .filter(r -> "COMPLETED".equals(r.getStatus()))
                .count();

        // 1. 해결률 (%)
        double resolutionRatePct = total > 0 ? ((double) completedCount / total) * 100.0 : 0.0;

        // 2. 평균 응답 시간 (분) - COMPLETED 상태인 항목들의 (updatedAt - createdAt) 평균
        double avgResolutionTimeMins = allRequests.stream()
                .filter(r -> "COMPLETED".equals(r.getStatus()) && r.getUpdatedAt() != null && r.getCreatedAt() != null)
                .mapToLong(r -> java.time.Duration.between(r.getCreatedAt(), r.getUpdatedAt()).toMinutes())
                .average()
                .orElse(0.0);

        // 3. 고객 만족도 (5.0 만점) - 평균 처리 시간을 기반으로 점수 산정 (빠를수록 높음)
        double customerSatisfaction = 4.5;
        if (completedCount > 0) {
            double penalty = avgResolutionTimeMins / 30.0; // 30분마다 1점 감점
            customerSatisfaction = Math.max(3.0, Math.min(5.0, 5.0 - penalty));
        }

        // 오늘 / 어제 기준일 계산
        java.time.LocalDateTime startOfToday = java.time.LocalDate.now().atStartOfDay();
        java.time.LocalDateTime startOfYesterday = startOfToday.minusDays(1);

        List<com.anook.backend.frontdesk.request.domain.model.FrontdeskRequest> todayRequests = allRequests.stream()
                .filter(r -> r.getCreatedAt() != null && !r.getCreatedAt().isBefore(startOfToday))
                .toList();
        List<com.anook.backend.frontdesk.request.domain.model.FrontdeskRequest> yesterdayRequests = allRequests.stream()
                .filter(r -> r.getCreatedAt() != null && !r.getCreatedAt().isBefore(startOfYesterday) && r.getCreatedAt().isBefore(startOfToday))
                .toList();

        // 1. 총 요청 증감률
        long todayTotal = todayRequests.size();
        long yesterdayTotal = yesterdayRequests.size();
        String totalChange = "+0%";
        if (yesterdayTotal > 0) {
            long diff = todayTotal - yesterdayTotal;
            totalChange = (diff > 0 ? "+" : "") + Math.round(((double) diff / yesterdayTotal) * 100) + "%";
        } else if (todayTotal > 0) {
            totalChange = "+100%";
        }

        // 지표 계산을 위한 헬퍼 클래스 (내부 레코드)
        record Metrics(double avgTime, double resRate, double satisfaction) {}
        
        java.util.function.Function<List<com.anook.backend.frontdesk.request.domain.model.FrontdeskRequest>, Metrics> calcMetrics = (reqs) -> {
            long count = reqs.size();
            long compCount = reqs.stream().filter(r -> "COMPLETED".equals(r.getStatus())).count();
            double rate = count > 0 ? ((double) compCount / count) * 100.0 : 0.0;
            double avgTime = reqs.stream()
                    .filter(r -> "COMPLETED".equals(r.getStatus()) && r.getUpdatedAt() != null && r.getCreatedAt() != null)
                    .mapToLong(r -> java.time.Duration.between(r.getCreatedAt(), r.getUpdatedAt()).toMinutes())
                    .average().orElse(0.0);
            double sat = 4.5;
            if (compCount > 0) sat = Math.max(3.0, Math.min(5.0, 5.0 - (avgTime / 30.0)));
            return new Metrics(avgTime, rate, sat);
        };

        Metrics todayMetrics = calcMetrics.apply(todayRequests);
        Metrics yesterdayMetrics = calcMetrics.apply(yesterdayRequests);

        // 증감 텍스트 생성
        String avgResolutionTimeChange = String.format("%s%.1fm", (todayMetrics.avgTime() >= yesterdayMetrics.avgTime() ? "+" : ""), todayMetrics.avgTime() - yesterdayMetrics.avgTime());
        String resolutionRateChange = String.format("%s%.1f%%", (todayMetrics.resRate() >= yesterdayMetrics.resRate() ? "+" : ""), todayMetrics.resRate() - yesterdayMetrics.resRate());
        String customerSatisfactionChange = String.format("%s%.1f", (todayMetrics.satisfaction() >= yesterdayMetrics.satisfaction() ? "+" : ""), todayMetrics.satisfaction() - yesterdayMetrics.satisfaction());

        // 소수점 1자리 반올림
        avgResolutionTimeMins = Math.round(avgResolutionTimeMins * 10.0) / 10.0;
        resolutionRatePct = Math.round(resolutionRatePct * 10.0) / 10.0;
        customerSatisfaction = Math.round(customerSatisfaction * 10.0) / 10.0;

        return new FrontdeskRequestStatsResult(
                total, byStatus, byDept, byPriority, frequentRequests, overdueCount,
                avgResolutionTimeMins, resolutionRatePct, customerSatisfaction,
                totalChange, avgResolutionTimeChange, resolutionRateChange, customerSatisfactionChange
        );
    }

    private Map<String, Long> toMap(List<Object[]> rows) {
        return rows.stream()
                .collect(Collectors.toMap(
                        r -> (String) r[0],
                        r -> (Long) r[1]
                ));
    }

    // === 다른 모듈 데이터 조회 ===

    private Map<String, String> buildDeptNameMap() {
        return listDepartmentsUseCase.getAll().stream()
                .collect(Collectors.toMap(DepartmentInfo::id, DepartmentInfo::name));
    }

    private Map<Long, String> buildStaffNameMap() {
        return manageStaffUseCase.getAll().stream()
                .collect(Collectors.toMap(GetStaffResult::id, GetStaffResult::name));
    }

    // === Domain → DTO 변환 (이름 매핑 포함) ===

    private FrontdeskRequestListResult toListResult(FrontdeskRequest r, Map<String, String> deptMap, Map<Long, String> staffMap) {
        return new FrontdeskRequestListResult(
                r.getId(), r.getStatus(), r.getPriority(),
                r.getDepartmentId(),
                deptMap.getOrDefault(r.getDepartmentId(), r.getDepartmentId()),
                r.getSummary(), r.getRawText(), r.getRoomNo(),
                r.getAssignedStaffId(),
                r.getAssignedStaffId() != null ? staffMap.get(r.getAssignedStaffId()) : null,
                r.isCancelRequested(),
                r.getCancelRequestedAt(),
                r.getCreatedAt(), r.getUpdatedAt(),
                r.getVersion(),
                r.getEntities()
        );
    }

    private FrontdeskRequestDetailResult toDetailResult(FrontdeskRequest r, Map<String, String> deptMap, Map<Long, String> staffMap) {
        return new FrontdeskRequestDetailResult(
                r.getId(), r.getStatus(), r.getPriority(),
                r.getDepartmentId(),
                deptMap.getOrDefault(r.getDepartmentId(), r.getDepartmentId()),
                r.getEntities(), r.getRawText(), r.getSummary(),
                r.getConfidence(), r.getRoomNo(),
                r.getAssignedStaffId(),
                r.getAssignedStaffId() != null ? staffMap.get(r.getAssignedStaffId()) : null,
                r.getVersion(),
                r.isCancelRequested(), r.getCancelRequestedAt(),
                r.getCreatedAt(), r.getUpdatedAt(), null, r.getReasoning()
        );
    }
}
