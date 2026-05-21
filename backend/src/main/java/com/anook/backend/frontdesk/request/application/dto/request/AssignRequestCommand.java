package com.anook.backend.frontdesk.request.application.dto.request;

import jakarta.validation.constraints.NotNull;

/**
 * 담당자 배정/재배정 Command
 */
public record AssignRequestCommand(
        @NotNull(message = "담당 직원 ID는 필수입니다.")
        Long staffId
) {}
