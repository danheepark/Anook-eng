package com.anook.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.ResponseEntity;

@RestController
public class HealthCheckController {

    @GetMapping("/api/health")
    public String healthCheck() {
        return "Backend is running successfully! 🚀";
    }

    @GetMapping("/api/ai-status")
    public String aiStatusCheck() {
        try {
            RestTemplate restTemplate = new RestTemplate();
            String baseUrl = System.getenv("AI_SERVER_URL");
            if (baseUrl == null) {
                baseUrl = "http://localhost:8000"; // 로컬 개발 시 기본값
            }
            String aiUrl = baseUrl + "/api/v1/test-ai";
            ResponseEntity<String> response = restTemplate.getForEntity(aiUrl, String.class);
            return "✅ Backend successfully communicated with hidden AI server! AI Response: " + response.getBody();
        } catch (Exception e) {
            return "❌ Failed to reach hidden AI server from Backend. Error: " + e.getMessage();
        }
    }

    @GetMapping("/api/auth/test")
    public String authTest() {
        return "✅ 이곳은 누구나 들어올 수 있는 로비입니다! (인증/토큰 불필요)";
    }

    @GetMapping("/api/frontdesk/test")
    public String frontdeskTest() {
        return "🚨 이곳은 관리자 전용 비밀의 방입니다! (ADMIN 권한 토큰이 있어야만 이 글씨가 보입니다)";
    }
}
