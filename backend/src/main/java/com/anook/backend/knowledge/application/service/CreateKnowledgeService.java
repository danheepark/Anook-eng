package com.anook.backend.knowledge.application.service;

import com.anook.backend.knowledge.application.dto.request.CreateKnowledgeCommand;
import com.anook.backend.knowledge.application.dto.response.CreateKnowledgeResult;
import com.anook.backend.knowledge.application.port.in.CreateKnowledgeUseCase;
import com.anook.backend.global.exception.BusinessException;
import com.anook.backend.global.exception.ErrorCode;
import com.anook.backend.knowledge.application.port.out.EmbeddingPort;
import com.anook.backend.knowledge.application.port.out.KnowledgeRepositoryPort;
import com.anook.backend.knowledge.domain.model.KnowledgeEntry;
import com.anook.backend.knowledge.domain.model.KnowledgeStatus;
import com.anook.backend.knowledge.domain.model.DomainCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CreateKnowledgeService implements CreateKnowledgeUseCase {

    private final KnowledgeRepositoryPort knowledgeRepositoryPort;
    private final EmbeddingPort embeddingPort;

    @Override
    @Transactional
    public CreateKnowledgeResult create(CreateKnowledgeCommand command) {
        // 1. 중복 질문 확인
        if (knowledgeRepositoryPort.existsByDomainCodeAndQuestion(command.getDomainCode(), command.getQuestion())) {
            throw new BusinessException(ErrorCode.DUPLICATE_KNOWLEDGE);
        }

        // 2. 임베딩 생성 (질문과 답변을 조합하여 생성)
        String contentToEmbed = "Q: " + command.getQuestion() + "\nA: " + command.getAnswer();
        float[] embedding = embeddingPort.generateEmbedding(contentToEmbed);

        // 3. 도메인 모델 생성 (즉시 APPROVED)
        KnowledgeEntry entry = KnowledgeEntry.builder()
                .question(command.getQuestion())
                .answer(command.getAnswer())
                .domainCode(DomainCode.valueOf(command.getDomainCode()))
                .status(KnowledgeStatus.APPROVED)
                .build();

        // 4. 저장
        KnowledgeEntry savedEntry = knowledgeRepositoryPort.save(entry, embedding);

        return new CreateKnowledgeResult(savedEntry.getId());
    }
}
