package com.anook.backend.frontdesk.staff.application.dto.response;

import com.anook.backend.frontdesk.staff.domain.model.Staff;

public record GetStaffResult(
        Long id,
        String name,
        String pin,
        Long roleId,
        String departmentId
) {
    public static GetStaffResult from(Staff staff) {
        return new GetStaffResult(
                staff.getId(),
                staff.getName(),
                staff.getPin(),
                staff.getRoleId(),
                staff.getDepartmentId()
        );
    }
}
