package com.anook.backend.knowledge.adapter.out.persistence;

import com.anook.backend.knowledge.application.dto.request.ChatMessageDto;
import com.anook.backend.knowledge.application.port.out.MessageQueryPort;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * 타 모듈의 message 테이블에 대한 읽기 전용 쿼리 어댑터
 * 
 * 헥사고날 아키텍처 규칙에 따라 타 모듈 테이블에 직접 JPA Repository 의존을 피하기 위해
 * JdbcTemplate 네이티브 쿼리를 사용하여 읽기 전용 접근을 수행합니다.
 */
@Repository
@RequiredArgsConstructor
public class MessageJdbcQueryAdapter implements MessageQueryPort {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public List<ChatMessageDto> findByRoomNo(String roomNo) {
        String sql = "SELECT sender_type, content FROM message WHERE room_no = ? ORDER BY created_at ASC";
        return jdbcTemplate.query(sql, (rs, rowNum) -> new ChatMessageDto(
                rs.getString("sender_type"),
                rs.getString("content")
        ), roomNo);
    }
}
