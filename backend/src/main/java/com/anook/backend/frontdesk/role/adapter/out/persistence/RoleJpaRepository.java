package com.anook.backend.frontdesk.role.adapter.out.persistence;

import com.anook.backend.frontdesk.role.adapter.out.persistence.entity.RoleJpaEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleJpaRepository extends JpaRepository<RoleJpaEntity, Long> {

    boolean existsByName(String name);
}
