package com.anook.backend.request.adapter.out.persistence;

import com.anook.backend.request.application.port.out.RequestRepositoryPort;
import com.anook.backend.request.domain.model.Request;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/**
 * RequestRepositoryPort 구현체 — Request 영속성 어댑터
 *
 * Domain ↔ Entity 매핑을 담당합니다.
 */
@Component
@RequiredArgsConstructor
public class RequestPersistenceAdapter implements RequestRepositoryPort {

    private final RequestJpaRepository jpaRepository;

    // === 기존 (정산 기능용) ===

    @Override
    public Optional<RequestStatusDto> findStatusById(Long id) {
        return jpaRepository.findById(id)
                .map(entity -> new RequestStatusDto(
                        entity.getId(),
                        entity.getStatus(),
                        entity.getDepartmentId(),
                        entity.getSummary()
                ));
    }

    @Override
    public void updateStatus(Long id, String status) {
        RequestJpaEntity entity = jpaRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Request not found: " + id));
        entity.updateStatus(status);
        jpaRepository.save(entity);
    }

    // === 신규 (RQ-1 추가) ===

    @Override
    public Request save(Request request) {
        RequestJpaEntity entity = RequestJpaEntity.fromDomain(request);
        RequestJpaEntity saved = jpaRepository.save(entity);
        return saved.toDomain();
    }

    @Override
    public List<Request> findByRoomNo(String roomNo) {
        return jpaRepository.findByRoomNo(roomNo).stream()
                .map(RequestJpaEntity::toDomain)
                .toList();
    }

    @Override
    public List<Request> findByRoomNoAndGuestId(String roomNo, Long guestId) {
        return jpaRepository.findByRoomNoAndGuestId(roomNo, guestId).stream()
                .map(RequestJpaEntity::toDomain)
                .toList();
    }

    @Override
    public Optional<Request> findById(Long id) {
        return jpaRepository.findById(id)
                .map(RequestJpaEntity::toDomain);
    }

    @Override
    public Optional<Request> findLatestCancellableByRoomNoAndGuestId(String roomNo, Long guestId) {
        return jpaRepository.findFirstByRoomNoAndGuestIdAndStatusInOrderByCreatedAtDesc(
                roomNo, guestId, List.of("PENDING", "IN_PROGRESS", "ESCALATED")
        ).map(RequestJpaEntity::toDomain);
    }

    @Override
    public List<Request> findAllCancellableByRoomNoAndGuestId(String roomNo, Long guestId) {
        return jpaRepository.findByRoomNoAndGuestIdAndStatusIn(
                roomNo, guestId, List.of("PENDING", "IN_PROGRESS", "ESCALATED")
        ).stream().map(RequestJpaEntity::toDomain).toList();
    }

    @Override
    public Optional<Request> findLatestCancellableByRoomNoAndGuestIdAndDomainCode(String roomNo, Long guestId, String domainCode) {
        return jpaRepository.findFirstByRoomNoAndGuestIdAndDepartmentIdAndStatusInOrderByCreatedAtDesc(
                roomNo, guestId, domainCode, List.of("PENDING", "IN_PROGRESS", "ESCALATED")
        ).map(RequestJpaEntity::toDomain);
    }

    @Override
    public List<Request> findPendingByRoomNoAndGuestIdAndDepartmentId(String roomNo, Long guestId, String departmentId) {
        return jpaRepository.findByRoomNoAndGuestIdAndDepartmentIdAndStatus(roomNo, guestId, departmentId, "PENDING")
                .stream()
                .map(RequestJpaEntity::toDomain)
                .toList();
    }
}
