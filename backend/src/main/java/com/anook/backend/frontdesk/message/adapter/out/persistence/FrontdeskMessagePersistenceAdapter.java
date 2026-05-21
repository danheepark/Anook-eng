package com.anook.backend.frontdesk.message.adapter.out.persistence;

import com.anook.backend.frontdesk.message.adapter.out.persistence.entity.FrontdeskMessageJpaEntity;
import com.anook.backend.frontdesk.message.application.port.out.FrontdeskMessageCommandPort;
import com.anook.backend.frontdesk.message.application.port.out.FrontdeskMessageQueryPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 관리자 메시지 PersistenceAdapter
 *
 * FrontdeskMessageQueryPort 구현체.
 * message 테이블에 room_no가 직접 있으므로 room 테이블 JOIN 불필요.
 * message 모듈의 코드를 import하지 않음 (독립성 유지).
 */
@Component
@RequiredArgsConstructor
public class FrontdeskMessagePersistenceAdapter implements FrontdeskMessageQueryPort, FrontdeskMessageCommandPort {

    private final FrontdeskMessageJpaRepository jpaRepository;

    @Override
    public List<Map<String, Object>> findRoomsWithMessages() {
        List<String> roomNos = jpaRepository.findDistinctRoomNos();

        return roomNos.stream().map(roomNo -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("roomNo", roomNo);
            return map;
        }).toList();
    }

    @Override
    public List<Map<String, Object>> findRoomsWithMessages(java.time.LocalDate date) {
        java.time.LocalDateTime start = date.atStartOfDay();
        java.time.LocalDateTime end = date.atTime(java.time.LocalTime.MAX);
        
        List<String> roomNos = jpaRepository.findDistinctRoomNosByDate(start, end);

        return roomNos.stream().map(roomNo -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("roomNo", roomNo);
            return map;
        }).toList();
    }

    @Override
    public List<Map<String, Object>> findMessagesByRoomNo(String roomNo) {
        List<FrontdeskMessageJpaEntity> entities = jpaRepository.findByRoomNoOrderByCreatedAtAsc(roomNo);

        return entities.stream().map(e -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", e.getId());
            map.put("senderType", e.getSenderType());
            map.put("content", e.getContent());
            map.put("translatedContent", e.getTranslatedContent());
            map.put("createdAt", e.getCreatedAt());
            return map;
        }).toList();
    }

    @Override
    public Long getLatestGuestId(String roomNo) {
        return jpaRepository.findFirstByRoomNoOrderByCreatedAtDesc(roomNo)
                .map(FrontdeskMessageJpaEntity::getGuestId)
                .orElse(1L); // fallback
    }

    @Override
    public void deleteMessagesByRoomNo(String roomNo) {
        jpaRepository.deleteByRoomNo(roomNo);
    }
}
