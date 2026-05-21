package com.anook.backend.staff.request.adapter.out.persistence;

import com.anook.backend.staff.request.adapter.in.web.dto.response.StaffTaskResult;
import com.anook.backend.staff.request.application.port.out.RequestQueryPort;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
public class StaffRequestQueryAdapter implements RequestQueryPort {

    private final JdbcTemplate jdbcTemplate;

    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    @Override
    public List<StaffTaskResult> findRequests(String departmentId, String status, String priority) {
        StringBuilder sql = new StringBuilder(
                "SELECT r.id, r.status, r.priority, r.department_id, r.summary, r.raw_text, r.room_no, r.assigned_staff_id, r.confidence, r.created_at, r.version, r.cancel_requested, r.cancel_requested_at, r.entities, r.reasoning " +
                "FROM request r WHERE 1=1"
        );
        List<Object> params = new ArrayList<>();

        if (!"ALL".equalsIgnoreCase(departmentId)) {
            sql.append(" AND r.department_id = ?");
            params.add(departmentId);
        }
        if (!"ALL".equalsIgnoreCase(status)) {
            sql.append(" AND r.status = ?");
            params.add(status);
        }
        if (!"ALL".equalsIgnoreCase(priority)) {
            sql.append(" AND r.priority = ?");
            params.add(priority);
        } else if (!"EMERGENCY".equalsIgnoreCase(departmentId)) {
            // ALL일 경우, 일반 부서에서는 긴급(EMERGENCY) 업무 제외 (EMERGENCY 부서 직원에게는 보이도록 허용)
            sql.append(" AND r.priority != 'EMERGENCY'");
        }

        sql.append(" ORDER BY r.created_at DESC");

        return jdbcTemplate.query(sql.toString(), (rs, rowNum) -> {
            Long rId = rs.getLong("id");
            String rStatus = rs.getString("status");
            String rPriority = rs.getString("priority");
            String rDeptId = rs.getString("department_id");
            String rSummary = rs.getString("summary");
            String rRawText = rs.getString("raw_text");
            String rRoomNo = rs.getString("room_no");
            Long rAssignedStaffId = rs.getObject("assigned_staff_id") != null ? rs.getLong("assigned_staff_id") : null;
            Float rConfidence = rs.getObject("confidence") != null ? rs.getFloat("confidence") : null;
            LocalDateTime rCreatedAt = rs.getTimestamp("created_at").toLocalDateTime();
            Integer rVersion = rs.getInt("version");
            boolean rCancelRequested = rs.getBoolean("cancel_requested");
            LocalDateTime rCancelRequestedAt = rs.getTimestamp("cancel_requested_at") != null
                    ? rs.getTimestamp("cancel_requested_at").toLocalDateTime()
                    : null;
            String rReasoning = rs.getString("reasoning");

            java.util.Map<String, Object> rEntities = java.util.Collections.emptyMap();
            String entitiesJson = rs.getString("entities");
            if (entitiesJson != null && !entitiesJson.isBlank()) {
                try {
                    rEntities = objectMapper.readValue(entitiesJson, new com.fasterxml.jackson.core.type.TypeReference<>() {});
                } catch (Exception e) {
                    // JSON 파싱 에러 무시
                }
            }

            return new StaffTaskResult(
                rId,
                rStatus,
                rPriority,
                rDeptId,
                rSummary,
                rRawText,
                rRoomNo,
                rAssignedStaffId,
                rConfidence,
                rCreatedAt,
                rVersion,
                rCancelRequested,
                rCancelRequestedAt,
                rEntities,
                null,
                rReasoning
            );
        }, params.toArray());
    }
}
