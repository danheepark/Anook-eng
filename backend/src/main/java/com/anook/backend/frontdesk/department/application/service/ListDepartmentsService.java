package com.anook.backend.frontdesk.department.application.service;

import com.anook.backend.frontdesk.department.application.dto.response.DepartmentInfo;
import com.anook.backend.frontdesk.department.application.port.in.ListDepartmentsUseCase;
import com.anook.backend.frontdesk.staff.application.port.out.DepartmentQueryPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 부서 목록 조회 서비스 — 읽기 전용
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ListDepartmentsService implements ListDepartmentsUseCase {

    private final DepartmentQueryPort departmentQueryPort;

    @Override
    public List<DepartmentInfo> getAll() {
        return departmentQueryPort.findAll();
    }
}
