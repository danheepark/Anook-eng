package com.anook.backend.frontdesk.emergency.application.service;

import com.anook.backend.frontdesk.emergency.application.port.in.HandleEmergencyActionUseCase;
import com.anook.backend.frontdesk.emergency.application.port.out.EmergencyRequestCommandPort;
import com.anook.backend.request.application.dto.response.RequestSsePayload;
import com.anook.backend.request.application.port.out.DispatchPort;
import com.anook.backend.request.application.port.out.RequestRepositoryPort;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class HandleEmergencyActionService implements HandleEmergencyActionUseCase {

    private final EmergencyRequestCommandPort commandPort;
    private final RequestRepositoryPort requestRepositoryPort;
    private final DispatchPort dispatchPort;

    @Override
    @Transactional
    public void startEmergencyResponse(Long taskId) {
        commandPort.updateTaskStatus(taskId, "IN_PROGRESS");
        broadcastStatusChanged(taskId, "IN_PROGRESS");
    }

    @Override
    @Transactional
    public void callEngineer(Long taskId) {
        commandPort.callEngineer(taskId);
    }

    @Override
    @Transactional
    public void completeEmergencyResponse(Long taskId) {
        commandPort.updateTaskStatus(taskId, "COMPLETED");
        broadcastStatusChanged(taskId, "COMPLETED");
    }

    private void broadcastStatusChanged(Long taskId, String status) {
        requestRepositoryPort.findById(taskId).ifPresent(request -> {
            RequestSsePayload payload = RequestSsePayload.statusChanged(
                    request.getId(),
                    status,
                    request.getDomainCode() != null ? request.getDomainCode().name() : null,
                    request.getSummary(),
                    request.getRoomNo()
            );
            dispatchPort.dispatchToRoom(request.getRoomNo(), payload);
        });
    }
}
