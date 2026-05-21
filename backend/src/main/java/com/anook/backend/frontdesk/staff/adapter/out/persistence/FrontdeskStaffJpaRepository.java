package com.anook.backend.frontdesk.staff.adapter.out.persistence;

import com.anook.backend.frontdesk.staff.adapter.out.persistence.entity.StaffJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Staff JPA Repository — admin/staff 모듈 전용 (이름 충돌 방지를 위해 Admin 접두어 추가)
 */
public interface FrontdeskStaffJpaRepository extends JpaRepository<StaffJpaEntity, Long> {

    List<StaffJpaEntity> findByDepartmentId(String departmentId);
    
    boolean existsByPin(String pin);
}
