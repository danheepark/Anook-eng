package com.anook.backend.frontdesk.handover.domain.model;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class HandoverTask {
    private String status;
    private String category;
    private String roomNo;
    private String summary;
    private String authorName;
    private LocalDateTime createdAt;
}
