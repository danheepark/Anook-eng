package com.anook.backend.frontdesk.request.application.dto.request;

import jakarta.validation.constraints.NotBlank;

/**
 * 우선순위 변경 Command
 */
public record ChangeRequestPriorityCommand(
        @NotBlank(message = "우선순위는 필수입니다.")
        String priority
) {}
