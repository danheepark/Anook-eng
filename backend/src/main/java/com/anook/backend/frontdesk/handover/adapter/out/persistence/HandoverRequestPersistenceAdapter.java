package com.anook.backend.frontdesk.handover.adapter.out.persistence;

import com.anook.backend.frontdesk.handover.application.port.out.HandoverRequestQueryPort;
import com.anook.backend.frontdesk.handover.domain.model.HandoverTask;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Repository
@RequiredArgsConstructor
public class HandoverRequestPersistenceAdapter implements HandoverRequestQueryPort {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public List<HandoverTask> findTasksByTimeRange(LocalDateTime start, LocalDateTime end) {
        String sql = "SELECT r.room_no, g.name as guest_name, r.entities, r.summary, r.status, r.created_at " +
                "FROM request r " +
                "LEFT JOIN pms_guest g ON r.room_no = g.room_no " +
                "WHERE r.created_at >= ? AND r.created_at < ? " +
                "  AND ( r.status = 'ESCALATED' OR r.priority = 'URGENT' ) " +
                "ORDER BY r.created_at DESC";

        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            String entitiesJson = rs.getString("entities");
            String category = "기타";
            try {
                if (entitiesJson != null && !entitiesJson.isEmpty()) {
                    Map<String, List<String>> entities = objectMapper.readValue(entitiesJson, Map.class);
                    if (entities.containsKey("REQ_ITEM") && !entities.get("REQ_ITEM").isEmpty()) {
                        category = entities.get("REQ_ITEM").get(0);
                    }
                }
            } catch (Exception e) {
                // Ignore parse errors, fallback to "기타"
            }

            Timestamp createdAtTs = rs.getTimestamp("created_at");

            return new HandoverTask(
                    rs.getString("room_no"),
                    rs.getString("guest_name"),
                    category,
                    rs.getString("summary"),
                    rs.getString("status"),
                    createdAtTs != null ? createdAtTs.toLocalDateTime() : null);
        }, start, end);
    }
}
