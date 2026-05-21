package com.anook.backend.frontdesk.handover.application.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class HandoverTaskResult {
    private String roomNo;
    private String guestName;
    private String category;
    private String summary;
    private String status;
}
