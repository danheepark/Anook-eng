package com.anook.backend.frontdesk.staff.adapter.out.persistence;

import com.anook.backend.frontdesk.staff.adapter.out.persistence.entity.StaffJpaEntity;
import com.anook.backend.frontdesk.staff.application.port.out.StaffRepositoryPort;
import com.anook.backend.frontdesk.staff.domain.model.Staff;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/**
 * StaffRepositoryPort 구현체 — Staff 영속성 어댑터
 */
@Component("adminStaffPersistenceAdapter")
@RequiredArgsConstructor
public class StaffPersistenceAdapter implements StaffRepositoryPort {

    private final FrontdeskStaffJpaRepository jpaRepository;

    @Override
    public Optional<Staff> findById(Long id) {
        return jpaRepository.findById(id).map(StaffJpaEntity::toDomain);
    }

    @Override
    public List<Staff> findAll() {
        return jpaRepository.findAll().stream()
                .map(StaffJpaEntity::toDomain)
                .toList();
    }

    @Override
    public List<Staff> findByDepartmentId(String departmentId) {
        return jpaRepository.findByDepartmentId(departmentId).stream()
                .map(StaffJpaEntity::toDomain)
                .toList();
    }

    @Override
    public Staff save(Staff staff) {
        StaffJpaEntity entity = StaffJpaEntity.fromDomain(staff);
        StaffJpaEntity saved = jpaRepository.save(entity);
        return saved.toDomain();
    }

    @Override
    public void deleteById(Long id) {
        jpaRepository.deleteById(id);
    }

    @Override
    public boolean existsById(Long id) {
        return jpaRepository.existsById(id);
    }

    @Override
    public boolean existsByPin(String pin) {
        return jpaRepository.existsByPin(pin);
    }
}
