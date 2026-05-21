package com.anook.backend.pms.application.port.in;

import com.anook.backend.pms.application.dto.response.GetBillingSummaryResult;

public interface GetBillingUseCase {
    GetBillingSummaryResult getBillingSummary(String roomNo, String category, String language);
}
