package com.anook.backend.message.application.listener;

import com.anook.backend.guest.domain.event.GuestCheckedOutEvent;
import com.anook.backend.message.application.port.out.MessageRepositoryPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 체크아웃 이벤트 리스너 (Message 모듈)
 *
 * 투숙객이 체크아웃하면, 해당 객실의 모든 대화 메시지 기록을 DB에서 완전 삭제(Reset)한다.
 * 사유: 체크아웃 후 다음 투숙객이나 이전 기록에 대화 내용이 남아있지 않도록 보장한다.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class MessageCheckOutListener {

    private final MessageRepositoryPort messageRepositoryPort;

    @EventListener
    @Transactional
    public void onGuestCheckedOut(GuestCheckedOutEvent event) {
        String roomNumber = event.roomNumber();
        log.info("[Message] {}호 체크아웃 — 대화 메시지 DB 완전 삭제(Reset) 시작", roomNumber);
        messageRepositoryPort.deleteByRoomNo(roomNumber);
        log.info("[Message] {}호 체크아웃 — 대화 메시지 DB 완전 삭제(Reset) 완료", roomNumber);
    }
}
