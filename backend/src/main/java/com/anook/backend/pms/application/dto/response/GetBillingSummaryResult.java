package com.anook.backend.pms.application.dto.response;

import java.util.List;

public record GetBillingSummaryResult(
        String roomNo,
        String category,
        List<BillingItemResult> items,
        double subtotal,
        double tax,
        double serviceCharge,
        double totalAmount,
        String currency,
        double subtotalKrw,
        double subtotalUsd,
        double taxKrw,
        double taxUsd,
        double serviceChargeKrw,
        double serviceChargeUsd,
        double totalAmountKrw,
        double totalAmountUsd,
        double exchangeRate
) {}
