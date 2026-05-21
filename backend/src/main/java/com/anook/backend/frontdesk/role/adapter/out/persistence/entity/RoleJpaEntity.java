package com.anook.backend.frontdesk.role.adapter.out.persistence.entity;

import com.anook.backend.frontdesk.role.domain.model.Role;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity(name = "FrontdeskRole")
@Table(name = "staff_role")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RoleJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20)
    private String departmentId;

    @Column(nullable = false, length = 50)
    private String name;

    private RoleJpaEntity(Long id, String departmentId, String name) {
        this.id = id;
        this.departmentId = departmentId;
        this.name = name;
    }

    public Role toDomain() {
        return new Role(id, departmentId, name);
    }

    public static RoleJpaEntity fromDomain(Role role) {
        return new RoleJpaEntity(role.getId(), role.getDepartmentId(), role.getName());
    }
}
