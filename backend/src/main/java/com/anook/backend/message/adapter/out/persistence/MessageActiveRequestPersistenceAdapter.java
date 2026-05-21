package com.anook.backend.message.adapter.out.persistence;

import com.anook.backend.message.application.port.out.MessageActiveRequestPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Repository
@RequiredArgsConstructor
public class MessageActiveRequestPersistenceAdapter implements MessageActiveRequestPort {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public List<String> getActiveRequestSummaries(String roomNo) {
        String sql = "SELECT entities->>'intent' as intent, summary FROM request WHERE room_no = ? AND status IN ('PENDING', 'IN_PROGRESS', 'ACCEPTED')";
        
        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            String intent = rs.getString("intent");
            if (intent == null) {
                intent = "UNKNOWN";
            }
            String summary = rs.getString("summary");
            return String.format("[%s] %s", intent, summary);
        }, roomNo);
    }
    @Override
    public java.util.List<java.util.Map<String, Object>> findActiveRequests(String roomNo, Long guestId) {
        String sql = "SELECT id, department_id, summary, status " +
                     "FROM request " +
                     "WHERE room_no = ? AND guest_id = ? AND status IN ('PENDING', 'IN_PROGRESS', 'ESCALATED') " +
                     "ORDER BY created_at DESC " +
                     "LIMIT 10"; // AI에 보낼 문맥이므로 최근 10개로 제한
                     
        return jdbcTemplate.queryForList(sql, roomNo, guestId);
    }

    @Override
    public java.util.Map<String, Object> findRequestById(Long requestId) {
        String sql = "SELECT id, room_no as \"roomNo\", department_id as \"departmentId\", summary, status, priority, entities, confidence " +
                     "FROM request WHERE id = ?";
        try {
            java.util.Map<String, Object> row = jdbcTemplate.queryForMap(sql, requestId);
            if (row.get("entities") != null) {
                Object entitiesObj = row.get("entities");
                if (entitiesObj.getClass().getName().equals("org.postgresql.util.PGobject")) {
                    try {
                        java.lang.reflect.Method getValueMethod = entitiesObj.getClass().getMethod("getValue");
                        String json = (String) getValueMethod.invoke(entitiesObj);
                        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                        row.put("entities", mapper.readValue(json, Map.class));
                    } catch (Exception e) {
                        log.warn("entities PGobject parsing failed: {}", e.getMessage());
                    }
                } else if (entitiesObj instanceof String json) {
                    try {
                        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                        row.put("entities", mapper.readValue(json, Map.class));
                    } catch (Exception e) {
                        log.warn("entities String parsing failed: {}", e.getMessage());
                    }
                }
            }
            return row;
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            return null;
        }
    }
}
