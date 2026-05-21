package com.anook.backend.frontdesk.emergency.adapter.out.persistence;

import com.anook.backend.frontdesk.emergency.application.port.out.EmergencyRequestCommandPort;
import com.anook.backend.frontdesk.emergency.application.port.out.EmergencyRequestQueryPort;
import com.anook.backend.frontdesk.emergency.domain.model.EmergencyTask;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.util.List;

@Repository
@RequiredArgsConstructor
public class EmergencyRequestPersistenceAdapter implements EmergencyRequestQueryPort, EmergencyRequestCommandPort {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public List<EmergencyTask> findActiveEmergencyTasks() {
        String sql = "SELECT r.id, r.room_no, r.summary, r.raw_text, r.status, r.priority, r.created_at " +
                     "FROM request r " +
                     "WHERE r.priority = 'EMERGENCY' " +
                     "ORDER BY r.created_at DESC";

        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            Timestamp createdAtTs = rs.getTimestamp("created_at");
            return new EmergencyTask(
                rs.getLong("id"),
                rs.getString("room_no"),
                rs.getString("summary"),
                rs.getString("raw_text"), // raw_text를 description으로 사용
                rs.getString("status"),
                rs.getString("priority"),
                createdAtTs != null ? createdAtTs.toLocalDateTime() : null
            );
        });
    }

    @Override
    public void updateTaskStatus(Long taskId, String newStatus) {
        String sql = "UPDATE request SET status = ?, updated_at = NOW() WHERE id = ?";
        jdbcTemplate.update(sql, newStatus, taskId);
    }

    @Override
    public void callEngineer(Long taskId) {
        // 긴급 대응 건에 대해 시설팀 호출 (에스컬레이션 로그 남기거나 상태 업데이트)
        // MVP 단계에서는 일단 assigned_staff_id를 시설팀 관리자로 하거나 단순 상태 변경 처리 가능.
        // 현재는 간소하게 status를 ASSIGNED로, priority를 URGENT로 유지하며 로그만 남김.
        String sql = "UPDATE request SET department_id = 'FACILITY', updated_at = NOW() WHERE id = ?";
        jdbcTemplate.update(sql, taskId);
    }
}
