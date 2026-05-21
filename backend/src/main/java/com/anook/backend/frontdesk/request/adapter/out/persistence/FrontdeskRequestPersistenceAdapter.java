package com.anook.backend.frontdesk.request.adapter.out.persistence;

import com.anook.backend.frontdesk.request.adapter.out.persistence.entity.FrontdeskRequestJpaEntity;
import com.anook.backend.frontdesk.request.application.port.out.FrontdeskRequestQueryPort;
import com.anook.backend.frontdesk.request.domain.model.FrontdeskRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/**
 * FrontdeskRequestQueryPort 구현체 — JPA 기반
 *
 * request 테이블에 대한 읽기/쓰기를 JPA Entity로 처리합니다.
 * 부서명/직원명 등 다른 모듈 데이터는 Service에서 별도 Port로 조회합니다.
 */
@Component
@RequiredArgsConstructor
public class FrontdeskRequestPersistenceAdapter implements FrontdeskRequestQueryPort {

    private final FrontdeskRequestJpaRepository jpaRepository;

    @Override
    public List<FrontdeskRequest> findAll(String status, String departmentId, String priority, List<String> exclude, String sort) {
        List<FrontdeskRequestJpaEntity> entities = jpaRepository.findAllWithFilters(
                (status != null && !status.isBlank()) ? status.toUpperCase() : null,
                (departmentId != null && !departmentId.isBlank()) ? departmentId.toUpperCase() : null,
                (priority != null && !priority.isBlank()) ? priority.toUpperCase() : null
        );

        java.util.stream.Stream<FrontdeskRequestJpaEntity> stream = entities.stream();
        
        if (exclude != null && !exclude.isEmpty()) {
            stream = stream.filter(e -> !exclude.contains(e.getDepartmentId()));
        }

        return stream
                .map(FrontdeskRequestJpaEntity::toDomain)
                .toList();
    }

    @Override
    public Optional<FrontdeskRequest> findById(Long id) {
        return jpaRepository.findById(id)
                .map(FrontdeskRequestJpaEntity::toDomain);
    }

    @Override
    public void assignStaff(Long requestId, Long staffId, String staffDepartmentId) {
        FrontdeskRequestJpaEntity entity = jpaRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("요청을 찾을 수 없습니다. id=" + requestId));
        entity.updateAssignedStaff(staffId, staffDepartmentId);
        jpaRepository.save(entity);
    }

    @Override
    public void updatePriority(Long requestId, String priority) {
        FrontdeskRequestJpaEntity entity = jpaRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("요청을 찾을 수 없습니다. id=" + requestId));
        entity.updatePriority(priority);
        jpaRepository.save(entity);
    }

    @Override
    public void cancel(Long requestId) {
        FrontdeskRequestJpaEntity entity = jpaRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("요청을 찾을 수 없습니다. id=" + requestId));
        entity.cancel();
        jpaRepository.save(entity);
    }

    @Override
    public void approveCancellation(Long requestId) {
        FrontdeskRequestJpaEntity entity = jpaRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("요청을 찾을 수 없습니다. id=" + requestId));
        entity.approveCancellation();
        jpaRepository.save(entity);
    }

    @Override
    public void rejectCancellation(Long requestId) {
        FrontdeskRequestJpaEntity entity = jpaRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("요청을 찾을 수 없습니다. id=" + requestId));
        entity.rejectCancellation();
        jpaRepository.save(entity);
    }

    @Override
    public void updateSummary(Long requestId, String summary, String description) {
        FrontdeskRequestJpaEntity entity = jpaRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("요청을 찾을 수 없습니다. id=" + requestId));
        entity.updateSummary(summary, description);
        jpaRepository.save(entity);
    }

    @Override
    public void changeDepartment(Long requestId, String departmentId) {
        FrontdeskRequestJpaEntity entity = jpaRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("요청을 찾을 수 없습니다. id=" + requestId));
        entity.changeDepartment(departmentId);
        jpaRepository.save(entity);
    }

    @Override
    public void escalate(Long requestId, String departmentId, String priority) {
        FrontdeskRequestJpaEntity entity = jpaRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("요청을 찾을 수 없습니다. id=" + requestId));
        entity.approveEscalation(departmentId, priority);
        jpaRepository.save(entity);
    }

    @Override
    public void requestEscalation(Long requestId, String targetDepartmentId) {
        FrontdeskRequestJpaEntity entity = jpaRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("요청을 찾을 수 없습니다. id=" + requestId));
        entity.changeDepartment(targetDepartmentId);
        entity.requestEscalation();
        jpaRepository.save(entity);
    }

    @Override
    public void updateStatus(Long requestId, String status) {
        FrontdeskRequestJpaEntity entity = jpaRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("요청을 찾을 수 없습니다. id=" + requestId));
        entity.updateStatus(status);
        jpaRepository.save(entity);
    }

    @Override
    public List<FrontdeskRequest> findEscalations() {
        List<FrontdeskRequestJpaEntity> escalated = jpaRepository.findByStatusOrderByCreatedAtDesc("ESCALATED");
        return escalated.stream()
                .map(FrontdeskRequestJpaEntity::toDomain)
                .toList();
    }

    @Override
    public FrontdeskRequest save(String departmentId, String roomNo, String summary,
                             String rawText, String priority, Long assignedStaffId, Long guestId) {
        FrontdeskRequestJpaEntity entity = FrontdeskRequestJpaEntity.createManual(
                departmentId, roomNo, summary, rawText, priority, assignedStaffId, guestId);
        return jpaRepository.save(entity).toDomain();
    }

    @Override
    public Long findGuestIdByRoomNo(String roomNo) {
        return jpaRepository.findFirstGuestIdByRoomNo(roomNo);
    }

    // === 통계 ===

    @Override
    public long countAll() {
        return jpaRepository.count();
    }

    @Override
    public List<Object[]> countByStatus() {
        return jpaRepository.countGroupByStatus();
    }

    @Override
    public List<Object[]> countByDepartment() {
        return jpaRepository.countGroupByDepartment();
    }

    @Override
    public List<Object[]> countByPriority() {
        return jpaRepository.countGroupByPriority();
    }
}
