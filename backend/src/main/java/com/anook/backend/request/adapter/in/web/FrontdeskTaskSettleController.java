package com.anook.backend.request.adapter.in.web;

import com.anook.backend.request.application.dto.response.SettleRequestResult;
import com.anook.backend.request.application.port.in.SettleRequestUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 정산 API — 프론트 직원이 유료 서비스 결제 완료 후 호출 (부서 무관)
 *
 * ❌ /api 접두어 없음 (BFF가 제거)
 */
@RestController
@RequestMapping("/frontdesk/tasks")
@RequiredArgsConstructor
public class FrontdeskTaskSettleController {

    private final SettleRequestUseCase settleRequestUseCase;

    /**
     * 정산 처리 — PATCH /frontdesk/tasks/{taskId}/settle
     *
     * COMPLETED 상태의 요청을 SETTLED로 변경 (부서 무관)
     */
    @PatchMapping("/{taskId}/settle")
    public ResponseEntity<SettleRequestResult> settle(@PathVariable Long taskId) {
        SettleRequestResult result = settleRequestUseCase.settle(taskId);
        return ResponseEntity.ok(result);
    }
}
