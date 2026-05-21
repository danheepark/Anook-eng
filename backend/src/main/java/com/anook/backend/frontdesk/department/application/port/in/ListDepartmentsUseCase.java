package com.anook.backend.frontdesk.department.application.port.in;

import com.anook.backend.frontdesk.department.application.dto.response.DepartmentInfo;

import java.util.List;

/**
 * 부서 목록 조회 UseCase — 읽기 전용
 */
public interface ListDepartmentsUseCase {

    List<DepartmentInfo> getAll();
}
