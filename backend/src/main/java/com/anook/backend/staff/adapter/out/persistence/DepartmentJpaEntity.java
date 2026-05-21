package com.anook.backend.staff.adapter.out.persistence;

import com.anook.backend.staff.domain.model.Department;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "department")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DepartmentJpaEntity {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(name = "is_frontdesk", nullable = false)
    private boolean isFrontdesk;

    public Department toDomain() {
        return Department.builder()
                .id(id)
                .name(name)
                .isFrontdesk(isFrontdesk)
                .build();
    }
}
