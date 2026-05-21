package com.anook.backend.frontdesk.staff.application.port.out;

import com.anook.backend.frontdesk.department.application.dto.response.DepartmentInfo;

import java.util.List;

/**
 * 부서 조회 포트 — staff 모듈에서 department 테이블 읽기 전용 접근
 *
 * 다른 모듈(department)의 테이블을 직접 접근하지 않고,
 * 자기 모듈의 Port를 정의하여 의존 방향을 유지합니다.
 */
public interface DepartmentQueryPort {

    boolean existsById(String departmentId);

    List<DepartmentInfo> findAll();
}
