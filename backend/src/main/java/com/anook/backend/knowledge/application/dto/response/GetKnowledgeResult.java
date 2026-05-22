package com.anook.backend.knowledge.application.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
@AllArgsConstructor
public class GetKnowledgeResult {
    private Long id;
    private String question;
    private String answer;
    private String domainCode;
    private String status;
    private String roomNo;
    private LocalDateTime updatedAt;
}
