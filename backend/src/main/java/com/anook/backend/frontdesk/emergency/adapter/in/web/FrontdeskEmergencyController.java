package com.anook.backend.frontdesk.emergency.adapter.in.web;

import com.anook.backend.frontdesk.emergency.application.dto.response.EmergencyTaskResult;
import com.anook.backend.frontdesk.emergency.application.port.in.GetEmergencyTasksUseCase;
import com.anook.backend.frontdesk.emergency.application.port.in.HandleEmergencyActionUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/frontdesk/emergency")
public class FrontdeskEmergencyController {

    private final GetEmergencyTasksUseCase getEmergencyTasksUseCase;
    private final HandleEmergencyActionUseCase handleEmergencyActionUseCase;

    @GetMapping
    public ResponseEntity<List<EmergencyTaskResult>> getActiveEmergencies() {
        return ResponseEntity.ok(getEmergencyTasksUseCase.getActiveEmergencies());
    }

    @PostMapping("/{id}/start")
    public ResponseEntity<Void> startEmergencyResponse(@PathVariable Long id) {
        handleEmergencyActionUseCase.startEmergencyResponse(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/call-engineer")
    public ResponseEntity<Void> callEngineer(@PathVariable Long id) {
        handleEmergencyActionUseCase.callEngineer(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<Void> completeEmergencyResponse(@PathVariable Long id) {
        handleEmergencyActionUseCase.completeEmergencyResponse(id);
        return ResponseEntity.ok().build();
    }
}
