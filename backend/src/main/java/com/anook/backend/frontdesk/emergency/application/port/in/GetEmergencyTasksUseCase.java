package com.anook.backend.frontdesk.emergency.application.port.in;

import com.anook.backend.frontdesk.emergency.application.dto.response.EmergencyTaskResult;
import java.util.List;

public interface GetEmergencyTasksUseCase {
    List<EmergencyTaskResult> getActiveEmergencies();
}
