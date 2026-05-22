package com.anook.backend.knowledge.application.port.in;

import com.anook.backend.knowledge.application.dto.request.ExtractKnowledgeFromChatCommand;
import com.anook.backend.knowledge.application.dto.response.KnowledgeCandidateResult;

import java.util.List;

public interface ExtractKnowledgeFromChatUseCase {
    List<KnowledgeCandidateResult> extract(ExtractKnowledgeFromChatCommand command);
}
