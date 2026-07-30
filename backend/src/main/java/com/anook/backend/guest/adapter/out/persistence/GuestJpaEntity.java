package com.anook.backend.guest.adapter.out.persistence;

import com.anook.backend.guest.domain.model.Guest;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Guest JPA Entity — pms_guest 테이블 매핑 (PMS 전용)
 */
@Entity
@Table(name = "pms_guest")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class GuestJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "room_no", nullable = false, unique = true, length = 10)
    private String roomNumber;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(length = 20)
    private String phone;

    @Column(name = "access_code", unique = true, length = 100)
    private String accessCode;

    @Column(name = "checkin_date", nullable = false)
    private LocalDateTime checkinDate;

    @Column(name = "checkout_date", nullable = false)
    private LocalDate checkoutDate;

    @Column(name = "special_notes")
    private String specialNotes;

    // === Domain → Entity ===
    public static GuestJpaEntity from(Guest domain) {
        GuestJpaEntity entity = new GuestJpaEntity();
        entity.id = domain.getId();
        entity.roomNumber = domain.getRoomNumber();
        entity.name = domain.getName();
        entity.phone = domain.getPhone();
        entity.accessCode = domain.getAccessCode();
        entity.checkinDate = domain.getCheckinDate();
        entity.checkoutDate = domain.getCheckoutDate();
        entity.specialNotes = domain.getSpecialNotes();
        return entity;
    }

    // === Entity → Domain ===
    public Guest toDomain() {
        return new Guest(id, roomNumber, name, phone, accessCode, checkinDate, checkoutDate, specialNotes);
    }
}
