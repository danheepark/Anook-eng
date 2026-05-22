package com.anook.backend.knowledge.application.port.out;

import com.anook.backend.knowledge.application.dto.request.ChatMessageDto;
import com.anook.backend.knowledge.application.dto.response.KnowledgeCandidateResult;

import java.util.List;

public interface KnowledgeExtractPort {
    List<KnowledgeCandidateResult> extractFromChat(List<ChatMessageDto> messages);
}
