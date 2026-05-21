package com.anook.backend.frontdesk.staff.domain.model;

import java.util.Objects;

/**
 * 직원 도메인 모델 — 순수 POJO
 *
 * DB: staff 테이블
 */
public class Staff {

    private final Long id;
    private final String name;
    private final String pin;
    private final Long roleId;
    private final String departmentId;
    private final String jti; // JWT 고유 식별자

    public Staff(Long id, String name, String pin, Long roleId, String departmentId, String jti) {
        this.id = id;
        this.name = Objects.requireNonNull(name, "직원 이름은 필수입니다.");
        this.pin = Objects.requireNonNull(pin, "PIN은 필수입니다.");
        this.roleId = Objects.requireNonNull(roleId, "역할 ID는 필수입니다.");
        this.departmentId = Objects.requireNonNull(departmentId, "부서 ID는 필수입니다.");
        this.jti = jti;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getPin() { return pin; }
    public Long getRoleId() { return roleId; }
    public String getDepartmentId() { return departmentId; }
    public String getJti() { return jti; }
}
