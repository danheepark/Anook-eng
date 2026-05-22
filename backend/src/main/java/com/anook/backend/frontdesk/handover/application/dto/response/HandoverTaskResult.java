package com.anook.backend.frontdesk.handover.application.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class HandoverTaskResult {
    private String status;
    private String category;
    private String roomNo;
    private String summary;
    private String author;
    private String time;
}
