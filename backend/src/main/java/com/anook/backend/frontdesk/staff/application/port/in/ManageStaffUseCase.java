package com.anook.backend.frontdesk.staff.application.port.in;

import com.anook.backend.frontdesk.staff.application.dto.request.CreateStaffCommand;
import com.anook.backend.frontdesk.staff.application.dto.request.UpdateStaffCommand;
import com.anook.backend.frontdesk.staff.application.dto.response.GetStaffResult;

import java.util.List;

/**
 * 직원 관리 UseCase — Admin 전용 CRUD
 */
public interface ManageStaffUseCase {

    GetStaffResult create(CreateStaffCommand command);

    List<GetStaffResult> getAll();

    GetStaffResult getById(Long id);

    List<GetStaffResult> getByDepartmentId(String departmentId);

    GetStaffResult update(Long id, UpdateStaffCommand command);

    void delete(Long id);
}
