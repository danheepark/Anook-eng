package com.anook.backend.frontdesk.emergency.domain.model;

import lombok.AllArgsConstructor;
import lombok.Getter;
import java.time.LocalDateTime;

@Getter
@AllArgsConstructor
public class EmergencyTask {
    private Long id;
    private String roomNo;
    private String summary;
    private String description;
    private String status;
    private String priority;
    private LocalDateTime createdAt;
}
