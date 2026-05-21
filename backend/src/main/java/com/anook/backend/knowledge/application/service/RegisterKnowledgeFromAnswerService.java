package com.anook.backend.knowledge.application.service;

import com.anook.backend.knowledge.application.dto.request.RegisterKnowledgeFromAnswerCommand;
import com.anook.backend.knowledge.application.dto.response.CreateKnowledgeResult;
import com.anook.backend.global.exception.BusinessException;
import com.anook.backend.global.exception.ErrorCode;
import com.anook.backend.knowledge.application.port.in.RegisterKnowledgeFromAnswerUseCase;
import com.anook.backend.knowledge.application.port.out.EmbeddingPort;
import com.anook.backend.knowledge.application.port.out.KnowledgeRepositoryPort;
import com.anook.backend.knowledge.domain.model.DomainCode;
import com.anook.backend.knowledge.domain.model.KnowledgeEntry;
import com.anook.backend.knowledge.domain.model.KnowledgeStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 직원 답변 기반 RAG 지식 등록 서비스
 *
 * 흐름:
 *   1. domainCode 기본값 처리 (null → COMMON)
 *   2. 질문 + 답변 조합하여 임베딩 생성 (EmbeddingPort → Python AI)
 *   3. KnowledgeEntry 도메인 모델 생성 (즉시 APPROVED)
 *   4. knowledge_entry 테이블에 저장 (임베딩 포함)
 *
 * ❌ JPA Repository 직접 import 금지 → Port(Out)만 의존
 * ❌ Spring Boot에서 Gemini API 직접 호출 금지 → EmbeddingPort 경유
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RegisterKnowledgeFromAnswerService implements RegisterKnowledgeFromAnswerUseCase {

    private final KnowledgeRepositoryPort knowledgeRepositoryPort;
    private final EmbeddingPort embeddingPort;

    @Override
    @Transactional
    public CreateKnowledgeResult register(RegisterKnowledgeFromAnswerCommand command) {
        // 1. 중복 질문 확인
        if (knowledgeRepositoryPort.existsByDomainCodeAndQuestion(
                command.domainCode() != null ? command.domainCode() : "COMMON",
                command.question())) {
            throw new BusinessException(ErrorCode.DUPLICATE_KNOWLEDGE);
        }

        // 2. domainCode 기본값 처리 — null 또는 빈 문자열이면 COMMON
        String domainCodeStr = (command.domainCode() != null && !command.domainCode().isBlank())
                ? command.domainCode().trim().toUpperCase()
                : "COMMON";
        DomainCode domainCode = DomainCode.from(domainCodeStr);

        // 3. status 결정 — "PENDING"이면 나중에 검토, 그 외 즉시 APPROVED
        boolean isPending = "PENDING".equalsIgnoreCase(command.status());
        KnowledgeStatus status = isPending ? KnowledgeStatus.PENDING : KnowledgeStatus.APPROVED;

        // 4. 임베딩 생성 (PENDING이면 스킵 — 승인 시 생성)
        float[] embedding = null;
        if (!isPending) {
            String contentToEmbed = "Q: " + command.question() + "\nA: " + command.answer();
            embedding = embeddingPort.generateEmbedding(contentToEmbed);
        }

        // 5. 도메인 모델 생성
        KnowledgeEntry entry = KnowledgeEntry.builder()
                .question(command.question())
                .answer(command.answer())
                .domainCode(domainCode)
                .status(status)
                .build();

        // 6. 저장 (PENDING은 임베딩 없이 저장)
        KnowledgeEntry saved = isPending
                ? knowledgeRepositoryPort.save(entry, new float[0])
                : knowledgeRepositoryPort.save(entry, embedding);

        log.info("[Knowledge] 직원 답변 기반 RAG {} — id: {}, room: {}, domain: {}, Q: {}",
                isPending ? "후보 등록 (PENDING)" : "즉시 등록 (APPROVED)",
                saved.getId(), command.roomNo(), domainCode, command.question());

        return new CreateKnowledgeResult(saved.getId());
    }
}
