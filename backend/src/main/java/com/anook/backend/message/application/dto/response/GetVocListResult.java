package com.anook.backend.message.application.dto.response;

import java.time.LocalDateTime;

public record GetVocListResult(
    Long id,
    String roomNo,
    Long guestId,
    String sentiment,
    String content,
    String aiReply,
    LocalDateTime createdAt
) {}
