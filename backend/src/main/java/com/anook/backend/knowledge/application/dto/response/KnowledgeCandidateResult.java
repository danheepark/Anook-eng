package com.anook.backend.knowledge.application.dto.response;

public record KnowledgeCandidateResult(
    String question,
    String answer,
    String domainCode,
    double confidence
) {}
