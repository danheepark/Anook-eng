package com.anook.backend.frontdesk.staff.application.port.out;

import com.anook.backend.frontdesk.staff.domain.model.Staff;

import java.util.List;
import java.util.Optional;

/**
 * Staff 영속성 포트 — 도메인 모델만 반환
 */
public interface StaffRepositoryPort {

    Optional<Staff> findById(Long id);

    List<Staff> findAll();

    List<Staff> findByDepartmentId(String departmentId);

    Staff save(Staff staff);

    void deleteById(Long id);

    boolean existsById(Long id);
    
    /**
     * PIN 번호 중복 여부 확인
     */
    boolean existsByPin(String pin);
}
