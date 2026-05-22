package com.anook.backend.knowledge.application.dto.request;

import java.util.List;

public record BatchRegisterKnowledgeCommand(
    List<Long> pendingKnowledgeIds,
    List<KnowledgeItem> items
) {
    public record KnowledgeItem(
        String question,
        String answer,
        String domainCode,
        String roomNo
    ) {}
}
