package com.anook.backend.frontdesk.role.application.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateRoleCommand(
        @NotBlank(message = "부서 ID는 필수입니다.")
        String departmentId,

        @NotBlank(message = "역할 이름은 필수입니다.")
        @Size(max = 50, message = "역할 이름은 50자 이내여야 합니다.")
        String name
) {}
