package com.anook.backend.frontdesk.handover.domain.model;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class HandoverTask {
    private String roomNo;
    private String guestName;
    private String category;
    private String summary;
    private String status;
    private LocalDateTime createdAt;
}
