package com.anook.backend.knowledge.application.port.out;

import com.anook.backend.knowledge.application.dto.request.ChatMessageDto;

import java.util.List;

public interface MessageQueryPort {
    List<ChatMessageDto> findByRoomNo(String roomNo);
}
