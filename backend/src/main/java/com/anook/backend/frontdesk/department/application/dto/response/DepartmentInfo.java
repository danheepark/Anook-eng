package com.anook.backend.frontdesk.department.application.dto.response;

/**
 * 부서 조회 결과 DTO — 읽기 전용
 */
public record DepartmentInfo(
        String id,
        String name
) {
}
