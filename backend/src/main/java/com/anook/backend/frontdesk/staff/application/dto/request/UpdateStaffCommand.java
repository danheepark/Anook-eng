package com.anook.backend.frontdesk.staff.application.dto.request;

import jakarta.validation.constraints.Size;

/**
 * 직원 수정 Command DTO
 *
 * PIN은 자동 생성이므로 수정 불가 — 재발급은 별도 API로 처리
 */
public record UpdateStaffCommand(
        @Size(max = 50, message = "직원 이름은 50자 이내여야 합니다.")
        String name,

        Long roleId,

        String departmentId
) {}
