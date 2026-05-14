package com.anook.backend.message.adapter.out.persistence;

import com.anook.backend.message.application.port.out.MessageRoomStatusPort;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * MessageRoomStatusPort 구현체
 *
 * 다른 모듈(request)의 테이블을 읽기 전용으로 조회하기 위해
 * JdbcTemplate 네이티브 쿼리를 사용합니다 (JPA Entity 중복 방지).
 */
@Component
@RequiredArgsConstructor
public class RoomStatusJdbcAdapter implements MessageRoomStatusPort {

    private final JdbcTemplate jdbcTemplate;

    /**
     * 해당 객실에 FRONT 부서의 IN_PROGRESS 요청이 존재하는지 확인합니다.
     * FRONT + IN_PROGRESS = 직원이 실시간 상담을 인수한 상태이므로 AI 개입 불필요.
     */
    @Override
    public boolean isStaffHandlingRoom(String roomNo) {
        String sql = "SELECT COUNT(*) FROM request " +
                     "WHERE room_no = ? AND department_id = 'FRONT' AND status = 'IN_PROGRESS'";
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, roomNo);
        return count != null && count > 0;
    }
}
