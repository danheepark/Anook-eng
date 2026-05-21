package com.anook.backend.frontdesk.emergency.application.port.out;

public interface EmergencyRequestCommandPort {
    void updateTaskStatus(Long taskId, String newStatus);
    void callEngineer(Long taskId);
}
