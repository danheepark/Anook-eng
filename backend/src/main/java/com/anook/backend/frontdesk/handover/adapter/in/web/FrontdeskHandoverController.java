package com.anook.backend.frontdesk.handover.adapter.in.web;

import com.anook.backend.frontdesk.handover.application.dto.response.HandoverBriefingResult;
import com.anook.backend.frontdesk.handover.application.port.in.GetHandoverBriefingUseCase;
import com.anook.backend.frontdesk.handover.application.service.HandoverExcelService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@RestController
@RequiredArgsConstructor
public class FrontdeskHandoverController {

    private final GetHandoverBriefingUseCase getHandoverBriefingUseCase;
    private final HandoverExcelService handoverExcelService;

    @GetMapping("/frontdesk/handover")
    public ResponseEntity<HandoverBriefingResult> getHandoverBriefing(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam String shiftType) {

        HandoverBriefingResult result = getHandoverBriefingUseCase.getBriefing(date, shiftType);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/frontdesk/handover/export")
    public ResponseEntity<byte[]> exportHandoverExcel(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam String shiftType) throws IOException {

        byte[] excelBytes = handoverExcelService.generateExcel(date, shiftType);

        String fileName = "handover_" + date.format(DateTimeFormatter.ofPattern("yyyyMMdd"))
                + "_" + shiftType.toUpperCase() + ".xlsx";

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDisposition(
                ContentDisposition.attachment().filename(fileName).build());

        return ResponseEntity.ok().headers(headers).body(excelBytes);
    }
}
