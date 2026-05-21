package com.anook.backend.frontdesk.handover.application.port.in;

import com.anook.backend.frontdesk.handover.application.dto.response.HandoverBriefingResult;
import java.time.LocalDate;

public interface GetHandoverBriefingUseCase {
    HandoverBriefingResult getBriefing(LocalDate targetDate, String shiftType);
}
