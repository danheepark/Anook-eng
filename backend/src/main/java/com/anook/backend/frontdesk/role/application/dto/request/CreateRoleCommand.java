package com.anook.backend.frontdesk.role.application.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 역할 생성 Command — id는 BIGSERIAL 자동 생성
 */
public record CreateRoleCommand(
        @NotBlank(message = "부서 ID는 필수입니다.")
        String departmentId,

        @NotBlank(message = "역할 이름은 필수입니다.")
        @Size(max = 50, message = "역할 이름은 50자 이내여야 합니다.")
        String name
) {}
