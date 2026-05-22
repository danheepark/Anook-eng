package com.anook.backend.frontdesk.handover.adapter.out.persistence;

import com.anook.backend.frontdesk.handover.application.port.out.HandoverRequestQueryPort;
import com.anook.backend.frontdesk.handover.domain.model.HandoverTask;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.List;

@Repository
@RequiredArgsConstructor
public class HandoverRequestPersistenceAdapter implements HandoverRequestQueryPort {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public List<HandoverTask> findTasksByTimeRange(LocalDateTime start, LocalDateTime end) {
        String sql = "SELECT r.status, d.name AS category, r.room_no, r.summary, " +
                "s.name AS author_name, r.created_at " +
                "FROM request r " +
                "LEFT JOIN department d ON r.department_id = d.id " +
                "LEFT JOIN staff s ON r.assigned_staff_id = s.id " +
                "WHERE r.created_at >= ? AND r.created_at < ? " +
                "ORDER BY r.created_at DESC";

        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            Timestamp createdAtTs = rs.getTimestamp("created_at");

            return new HandoverTask(
                    rs.getString("status"),
                    rs.getString("category") != null ? rs.getString("category") : "기타",
                    rs.getString("room_no"),
                    rs.getString("summary"),
                    rs.getString("author_name"),
                    createdAtTs != null ? createdAtTs.toLocalDateTime() : null);
        }, start, end);
    }
}
