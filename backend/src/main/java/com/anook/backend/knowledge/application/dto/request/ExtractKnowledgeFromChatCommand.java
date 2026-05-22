package com.anook.backend.knowledge.application.dto.request;

import java.util.List;

public record ExtractKnowledgeFromChatCommand(
    String roomNo,
    List<Long> pendingIds
) {}
