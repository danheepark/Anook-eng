package com.anook.backend.frontdesk.emergency.application.port.in;

public interface HandleEmergencyActionUseCase {
    void startEmergencyResponse(Long taskId);
    void callEngineer(Long taskId);
    void completeEmergencyResponse(Long taskId);
}
