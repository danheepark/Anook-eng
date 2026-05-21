package com.anook.backend.frontdesk.emergency.application.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;
import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class EmergencyTaskResult {
    private Long id;
    private String roomNo;
    private String title;
    private String description;
    private String status;
    private String priority;
    private LocalDateTime createdAt;
}
