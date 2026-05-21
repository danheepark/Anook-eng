package com.anook.backend.frontdesk.handover.adapter.in.web;

import com.anook.backend.frontdesk.handover.application.dto.response.HandoverBriefingResult;
import com.anook.backend.frontdesk.handover.application.port.in.GetHandoverBriefingUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequiredArgsConstructor
public class FrontdeskHandoverController {

    private final GetHandoverBriefingUseCase getHandoverBriefingUseCase;

    @GetMapping("/frontdesk/handover")
    public ResponseEntity<HandoverBriefingResult> getHandoverBriefing(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam String shiftType) {
        
        HandoverBriefingResult result = getHandoverBriefingUseCase.getBriefing(date, shiftType);
        return ResponseEntity.ok(result);
    }
}
