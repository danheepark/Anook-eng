package com.anook.backend.ailog.adapter.in.web;

import com.anook.backend.ailog.application.dto.response.AiLogDetailResult;
import com.anook.backend.ailog.application.dto.response.AiLogSummaryResult;
import com.anook.backend.ailog.application.port.in.GetAiLogListUseCase;
import com.anook.backend.ailog.application.port.in.GetAiLogSummaryUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/frontdesk/ai-logs")
@RequiredArgsConstructor
public class FrontdeskAiLogController {

    private final GetAiLogSummaryUseCase getAiLogSummaryUseCase;
    private final GetAiLogListUseCase getAiLogListUseCase;
    private final JdbcTemplate jdbcTemplate;

    @GetMapping("/summary")
    public ResponseEntity<AiLogSummaryResult> getSummary() {
        return ResponseEntity.ok(getAiLogSummaryUseCase.getSummary());
    }

    @GetMapping
    public ResponseEntity<Page<AiLogDetailResult>> getList(
            @PageableDefault(sort = "createdAt", direction = Sort.Direction.DESC, size = 10) Pageable pageable) {
        return ResponseEntity.ok(getAiLogListUseCase.getList(pageable));
    }

    /**
     * [AN-332] AI 피드백 별점 요약 + 목록 조회
     *
     * GET /frontdesk/ai-logs/ratings
     * 응답: { "averageRating": 4.2, "totalCount": 15, "ratings": [...] }
     */
    @GetMapping("/ratings")
    public ResponseEntity<Map<String, Object>> getAiRatings() {
        Double avg = jdbcTemplate.queryForObject(
                "SELECT COALESCE(AVG(rating), 0) FROM request WHERE department_id != 'FRONT' AND rating IS NOT NULL",
                Double.class
        );
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM request WHERE department_id != 'FRONT' AND rating IS NOT NULL",
                Integer.class
        );
        List<Map<String, Object>> ratings = jdbcTemplate.queryForList(
                "SELECT id AS \"requestId\", room_no AS \"roomNo\", department_id AS \"departmentId\", " +
                "summary, rating, created_at AS \"createdAt\" " +
                "FROM request " +
                "WHERE department_id != 'FRONT' AND rating IS NOT NULL " +
                "ORDER BY created_at DESC"
        );

        return ResponseEntity.ok(Map.of(
                "averageRating", avg != null ? Math.round(avg * 10.0) / 10.0 : 0,
                "totalCount", count != null ? count : 0,
                "ratings", ratings
        ));
    }
}
