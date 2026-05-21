package com.anook.backend.frontdesk.handover.application.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;
import java.util.List;

@Getter
@AllArgsConstructor
public class HandoverBriefingResult {
    private String shiftTimeLabel;
    private int totalRequestCount;
    private int pendingCount;
    private List<HandoverTaskResult> tasks;
}
