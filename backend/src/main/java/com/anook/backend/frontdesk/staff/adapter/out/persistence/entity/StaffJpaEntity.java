package com.anook.backend.frontdesk.staff.adapter.out.persistence.entity;

import com.anook.backend.frontdesk.staff.domain.model.Staff;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity(name = "FrontdeskStaff")
@Table(name = "staff")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StaffJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(nullable = false, length = 10)
    private String pin;

    @Column(name = "role_id", nullable = false)
    private Long roleId;

    @Column(name = "department_id", nullable = false, length = 20)
    private String departmentId;

    @Column(length = 100)
    private String jti; // JWT 식별자 (중복 로그인 방지)

    private StaffJpaEntity(Long id, String name, String pin, Long roleId, String departmentId, String jti) {
        this.id = id;
        this.name = name;
        this.pin = pin;
        this.roleId = roleId;
        this.departmentId = departmentId;
        this.jti = jti;
    }

    public Staff toDomain() {
        return new Staff(id, name, pin, roleId, departmentId, jti);
    }

    public static StaffJpaEntity fromDomain(Staff staff) {
        return new StaffJpaEntity(staff.getId(), staff.getName(), staff.getPin(),
                staff.getRoleId(), staff.getDepartmentId(), staff.getJti());
    }
}
