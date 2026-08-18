package com.anook.backend.guest.application.service;

import com.anook.backend.guest.application.dto.request.CheckInGuestCommand;
import com.anook.backend.guest.application.dto.response.CheckInGuestResult;
import com.anook.backend.guest.application.port.in.CheckInGuestUseCase;
import com.anook.backend.guest.application.port.out.GuestRepositoryPort;
import com.anook.backend.guest.application.port.out.RoomQueryPort;
import com.anook.backend.global.exception.BusinessException;
import com.anook.backend.global.exception.ErrorCode;
import com.anook.backend.guest.domain.model.Guest;
import com.anook.backend.room.application.service.RoomInventoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * PMS 투숙객 체크인 서비스
 *
 * ❌ JPA Repository 직접 import 금지
 * ✅ Port 인터페이스만 의존
 */
@Service
@RequiredArgsConstructor
@Transactional
public class CheckInGuestService implements CheckInGuestUseCase {

    private final GuestRepositoryPort guestRepository;
    private final RoomQueryPort roomQueryPort;
    private final RoomInventoryService roomInventoryService;

    @Override
    public CheckInGuestResult checkIn(CheckInGuestCommand command) {
        // 1) PMS 객실 존재 여부 확인
        if (!roomQueryPort.existsByNumber(command.roomNumber())) {
            throw new BusinessException(ErrorCode.ROOM_NOT_FOUND, "roomNumber=" + command.roomNumber());
        }

        // 2) 이미 해당 방에 투숙객이 있는지 확인
        if (guestRepository.existsByRoomNumber(command.roomNumber())) {
            throw new BusinessException(ErrorCode.ALREADY_CHECKED_IN);
        }

        // 3) 신규 투숙객 체크인 시 해당 객실의 기존 Redis 물품 인벤토리 카운터 강제 리셋
        roomInventoryService.resetInventory(command.roomNumber());

        // 4) 도메인 모델 생성 및 저장
        Guest guest = Guest.create(command.roomNumber(), command.name(), command.phone(), command.checkoutDate(), command.specialNotes());
        Guest saved = guestRepository.save(guest);

        return CheckInGuestResult.from(saved);
    }
}
