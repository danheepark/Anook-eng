package com.anook.backend.pms.adapter.in.web;

import com.anook.backend.pms.application.dto.response.GetBillingSummaryResult;
import com.anook.backend.pms.application.port.in.GetBillingUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * GET /pms/billing/summary?roomNo=xxx&category=xxx
 */
@RestController
@RequestMapping("/pms/billing")
@RequiredArgsConstructor
public class PmsBillingController {

    private final GetBillingUseCase getBillingUseCase;

    @GetMapping("/summary")
    public ResponseEntity<GetBillingSummaryResult> getBillingSummary(
            @RequestParam String roomNo,
            @RequestParam(required = false) String category,
            @RequestParam(required = false, defaultValue = "en") String language) {
        return ResponseEntity.ok(getBillingUseCase.getBillingSummary(roomNo, category, language));
    }
}
