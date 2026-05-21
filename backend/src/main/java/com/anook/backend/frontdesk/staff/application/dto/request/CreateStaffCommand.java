package com.anook.backend.frontdesk.staff.application.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * 직원 생성 Command DTO
 *
 * PIN은 서버에서 자동 생성 (Admin-Provisioning 원칙)
 */
public record CreateStaffCommand(
        @NotBlank(message = "직원 이름은 필수입니다.")
        @Size(max = 50, message = "직원 이름은 50자 이내여야 합니다.")
        String name,

        @NotNull(message = "역할을 선택해주세요.")
        Long roleId,

        @NotBlank(message = "부서를 선택해주세요.")
        String departmentId
) {}
