package com.anook.backend.frontdesk.role.domain.model;

import java.util.Objects;

/**
 * 직원 역할 도메인 모델 — 순수 POJO
 *
 * DB: staff_role 테이블 (id BIGSERIAL PK, name VARCHAR(50))
 */
public class Role {

    private final Long id;
    private final String departmentId;
    private final String name;

    public Role(Long id, String departmentId, String name) {
        this.id = id;
        this.departmentId = Objects.requireNonNull(departmentId, "부서 ID는 필수입니다.");
        this.name = Objects.requireNonNull(name, "역할 이름은 필수입니다.");
    }

    public Long getId() { return id; }
    public String getDepartmentId() { return departmentId; }
    public String getName() { return name; }
}
