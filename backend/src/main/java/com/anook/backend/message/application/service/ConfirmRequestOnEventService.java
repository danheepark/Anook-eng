package com.anook.backend.message.application.service;

import com.anook.backend.message.application.port.out.MessageDispatchPort;
import com.anook.backend.message.application.port.out.MessageRepositoryPort;
import com.anook.backend.message.domain.model.Message;
import com.anook.backend.request.application.event.RequestConfirmedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ConfirmRequestOnEventService {

    private final MessageRepositoryPort messagePort;
    private final MessageDispatchPort dispatchPort;

    /**
     * 주문이 확정(수락)되어 PENDING 상태로 넘어갔을 때,
     * AI가 자동으로 주문이 등록되었다는 메시지를 전송합니다.
     */
    @Async
    @EventListener
    @Transactional
    public void onGuestRequestConfirmed(RequestConfirmedEvent event) {
        log.info("[Message] RequestConfirmedEvent 수신 — room: {}, summary: {}", event.getRoomNo(), event.getSummary());

        String replyMessage = "Your order has been successfully registered. We will prepare it shortly.";

        // AI 메시지 생성 및 저장
        Message aiMsg = Message.createAiReply(event.getRoomNo(), event.getGuestId(), replyMessage);
        aiMsg = messagePort.save(aiMsg);

        // WebSocket Push -> 고객 채팅 화면에 실시간 전달
        Map<String, Object> payload = new HashMap<>(Map.of(
                "type", "AI_RESPONSE",
                "roomNo", event.getRoomNo(),
                "messageId", aiMsg.getId(),
                "content", replyMessage
        ));

        dispatchPort.sendToRoom(event.getRoomNo(), payload);
        dispatchPort.sendToFrontdesk(payload);
        
        log.info("[Message] Order confirmation message sent successfully — room: {}", event.getRoomNo());
    }
}
