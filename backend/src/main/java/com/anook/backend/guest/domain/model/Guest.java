package com.anook.backend.guest.domain.model;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * 투숙객 도메인 모델 (순수 POJO — JPA 의존 없음)
 *
 * pms_guest 테이블과 1:1 매핑됩니다.
 * 체크아웃 시 Hard Delete로 PII를 최소화합니다.
 */
public class Guest {

    private Long id;
    private String roomNumber;      // pms_guest.room_no
    private String name;            // pms_guest.name
    private String phone;           // pms_guest.phone
    private String accessCode;      // pms_guest.access_code (QR 인증용)
    private LocalDateTime checkinDate;  // pms_guest.checkin_date
    private LocalDate checkoutDate;     // pms_guest.checkout_date
    private String specialNotes;        // pms_guest.special_notes (투숙객 특이사항/메모)

    // === 기본 생성자 (프레임워크용) ===
    protected Guest() {
    }

    // === 전체 필드 생성자 (Entity → Domain 변환용) ===
    public Guest(Long id, String roomNumber, String name, String phone,
                 String accessCode, LocalDateTime checkinDate, LocalDate checkoutDate, String specialNotes) {
        this.id = id;
        this.roomNumber = roomNumber;
        this.name = name;
        this.phone = phone;
        this.accessCode = accessCode;
        this.checkinDate = checkinDate;
        this.checkoutDate = checkoutDate;
        this.specialNotes = specialNotes;
    }

    /**
     * 팩토리 메서드 (PMS 체크인 시 사용)
     * 보안을 위한 랜덤 접속 코드(UUID)를 자동으로 생성합니다.
     */
    public static Guest create(String roomNumber, String name, String phone, LocalDate checkoutDate, String specialNotes) {
        Guest guest = new Guest();
        guest.roomNumber = roomNumber;
        guest.name = name;
        guest.phone = phone;
        guest.accessCode = UUID.randomUUID().toString(); // ★ QR 인증용 랜덤 코드 자동 생성
        guest.checkinDate = LocalDateTime.now();
        guest.checkoutDate = checkoutDate;
        guest.specialNotes = specialNotes;
        return guest;
    }

    // === Getters ===
    public Long getId() { return id; }
    public String getRoomNumber() { return roomNumber; }
    public String getName() { return name; }
    public String getPhone() { return phone; }
    public String getAccessCode() { return accessCode; }
    public LocalDateTime getCheckinDate() { return checkinDate; }
    public LocalDate getCheckoutDate() { return checkoutDate; }
    public String getSpecialNotes() { return specialNotes; }
}
