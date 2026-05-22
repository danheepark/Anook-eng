package com.anook.backend.frontdesk.request.adapter.out.persistence;

import com.anook.backend.frontdesk.message.adapter.out.persistence.FrontdeskMessageJpaRepository;
import com.anook.backend.frontdesk.message.adapter.out.persistence.entity.FrontdeskMessageJpaEntity;
import com.anook.backend.frontdesk.request.application.port.out.FrontdeskRequestMessagePort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * FrontdeskRequestMessagePort 구현체
 *
 * admin/request 모듈의 Port(Out) 인터페이스를 구현하여
 * message 테이블에 STAFF 메시지를 저장합니다.
 *
 * ⚠️ 같은 admin 패키지 내의 admin/message 엔티티를 사용하되,
 *    message 모듈(비-admin)의 코드는 import하지 않습니다.
 */
@Component
@RequiredArgsConstructor
public class FrontdeskRequestMessageAdapter implements FrontdeskRequestMessagePort {

    private final FrontdeskMessageJpaRepository adminMessageJpaRepository;

    @Override
    public void sendStaffMessage(String roomNo, String content) {
        // [SYSTEM] 메시지 중복 삽입 방지: 마지막 메시지가 동일 내용이면 건너뜀
        if (content != null && content.startsWith("[SYSTEM]")) {
            var lastMsg = adminMessageJpaRepository.findFirstByRoomNoOrderByCreatedAtDesc(roomNo);
            if (lastMsg.isPresent() && content.equals(lastMsg.get().getContent())) {
                return; // 이미 동일한 시스템 메시지가 있으므로 중복 삽입 방지
            }
        }

        FrontdeskMessageJpaEntity entity = FrontdeskMessageJpaEntity.createStaffMessage(roomNo, content);
        adminMessageJpaRepository.save(entity);
    }
}
