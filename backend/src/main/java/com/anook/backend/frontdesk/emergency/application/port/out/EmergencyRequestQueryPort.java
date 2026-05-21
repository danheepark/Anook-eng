package com.anook.backend.frontdesk.emergency.application.port.out;

import com.anook.backend.frontdesk.emergency.domain.model.EmergencyTask;
import java.util.List;

public interface EmergencyRequestQueryPort {
    List<EmergencyTask> findActiveEmergencyTasks();
}
