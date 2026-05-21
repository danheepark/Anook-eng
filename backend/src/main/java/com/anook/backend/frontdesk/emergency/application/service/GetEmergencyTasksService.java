package com.anook.backend.frontdesk.emergency.application.service;

import com.anook.backend.frontdesk.emergency.application.dto.response.EmergencyTaskResult;
import com.anook.backend.frontdesk.emergency.application.port.in.GetEmergencyTasksUseCase;
import com.anook.backend.frontdesk.emergency.application.port.out.EmergencyRequestQueryPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GetEmergencyTasksService implements GetEmergencyTasksUseCase {

    private final EmergencyRequestQueryPort queryPort;

    @Override
    public List<EmergencyTaskResult> getActiveEmergencies() {
        return queryPort.findActiveEmergencyTasks().stream()
                .map(t -> new EmergencyTaskResult(
                        t.getId(),
                        t.getRoomNo(),
                        t.getSummary(),
                        t.getDescription(),
                        t.getStatus(),
                        t.getPriority(),
                        t.getCreatedAt()
                ))
                .collect(Collectors.toList());
    }
}
