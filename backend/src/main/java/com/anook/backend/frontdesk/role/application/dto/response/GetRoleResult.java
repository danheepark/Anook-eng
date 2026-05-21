package com.anook.backend.frontdesk.role.application.dto.response;

import com.anook.backend.frontdesk.role.domain.model.Role;

public record GetRoleResult(
        Long id,
        String departmentId,
        String name
) {
    public static GetRoleResult from(Role role) {
        return new GetRoleResult(role.getId(), role.getDepartmentId(), role.getName());
    }
}
