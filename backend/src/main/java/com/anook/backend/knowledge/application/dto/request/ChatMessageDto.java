package com.anook.backend.knowledge.application.dto.request;

public record ChatMessageDto(
    String senderType,
    String content
) {}
