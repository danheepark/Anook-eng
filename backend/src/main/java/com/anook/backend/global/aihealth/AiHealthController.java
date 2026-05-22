package com.anook.backend.global.aihealth;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/frontdesk/ai-status")
@RequiredArgsConstructor
public class AiHealthController {

    private final AiHealthMonitor aiHealthMonitor;

    @GetMapping
    public Map<String, Object> getStatus() {
        return toResponse(aiHealthMonitor.getSnapshot());
    }

    /**
     * 수동 확인 버튼용 — /health를 즉시 호출하여 결과를 반환한다.
     */
    @PostMapping("/check")
    public Map<String, Object> checkNow() {
        return toResponse(aiHealthMonitor.checkNow());
    }

    private Map<String, Object> toResponse(AiHealthSnapshot snapshot) {
        Map<String, Object> body = new HashMap<>();
        body.put("status", snapshot.status().name());
        body.put("since", snapshot.unhealthySince() != null ? snapshot.unhealthySince().toString() : null);
        return body;
    }
}
