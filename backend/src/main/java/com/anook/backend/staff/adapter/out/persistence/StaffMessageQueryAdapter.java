package com.anook.backend.staff.adapter.out.persistence;

import com.anook.backend.staff.application.port.out.StaffMessageQueryPort;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * staff 모듈의 메시지 조회 어댑터 (읽기 전용).
 * 다른 모듈의 JPA Repository를 import하지 않고 JdbcTemplate으로 직접 조회.
 */
@Component
@RequiredArgsConstructor
public class StaffMessageQueryAdapter implements StaffMessageQueryPort {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public List<Map<String, Object>> findMessagesByRoomNo(String roomNo) {
        String sql = """
                SELECT id, sender_type, content, translated_content, created_at
                FROM message
                WHERE room_no = ?
                ORDER BY created_at ASC
                """;

        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", rs.getLong("id"));
            map.put("senderType", rs.getString("sender_type"));
            map.put("content", rs.getString("content"));
            map.put("translatedContent", rs.getString("translated_content"));
            map.put("createdAt", rs.getTimestamp("created_at"));
            return map;
        }, roomNo);
    }
}
