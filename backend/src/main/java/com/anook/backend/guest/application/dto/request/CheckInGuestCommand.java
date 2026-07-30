package com.anook.backend.guest.application.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

/**
 * PMS 체크인 요청 DTO
 */
public record CheckInGuestCommand(
        @NotBlank(message = "객실 번호는 필수입니다.")
        String roomNumber,

        @NotBlank(message = "투숙객 이름은 필수입니다.")
        String name,

        String phone,

        @NotNull(message = "예정 체크아웃 날짜는 필수입니다.")
        LocalDate checkoutDate,

        String specialNotes
) {}
