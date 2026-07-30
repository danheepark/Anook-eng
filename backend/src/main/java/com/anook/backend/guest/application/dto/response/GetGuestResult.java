package com.anook.backend.guest.application.dto.response;

import com.anook.backend.guest.domain.model.Guest;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * PMS 투숙객 조회 응답 DTO
 */
public record GetGuestResult(
        Long id,
        String roomNumber,
        String name,
        String phone,
        String accessCode, // ★ QR 코드 생성을 위한 랜덤 코드 추가
        LocalDateTime checkinDate,
        LocalDate checkoutDate,
        String specialNotes
) {
    public static GetGuestResult from(Guest guest) {
        return new GetGuestResult(
                guest.getId(),
                guest.getRoomNumber(),
                guest.getName(),
                guest.getPhone(),
                guest.getAccessCode(), // ★ 매핑 추가
                guest.getCheckinDate(),
                guest.getCheckoutDate(),
                guest.getSpecialNotes()
        );
    }
}
