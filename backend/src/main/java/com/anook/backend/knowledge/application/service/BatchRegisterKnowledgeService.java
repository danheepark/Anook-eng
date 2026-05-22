package com.anook.backend.knowledge.application.service;

import com.anook.backend.knowledge.application.dto.request.BatchRegisterKnowledgeCommand;
import com.anook.backend.knowledge.application.dto.response.CreateKnowledgeResult;
import com.anook.backend.knowledge.application.port.in.BatchRegisterKnowledgeUseCase;
import com.anook.backend.knowledge.application.port.out.EmbeddingPort;
import com.anook.backend.knowledge.application.port.out.KnowledgeRepositoryPort;
import com.anook.backend.knowledge.domain.model.DomainCode;
import com.anook.backend.knowledge.domain.model.KnowledgeEntry;
import com.anook.backend.knowledge.domain.model.KnowledgeStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * AI 추출 RAG 지식 일괄 등록 및 기존 PENDING 항목 정리 서비스
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BatchRegisterKnowledgeService implements BatchRegisterKnowledgeUseCase {

    private final KnowledgeRepositoryPort knowledgeRepositoryPort;
    private final EmbeddingPort embeddingPort;

    @Override
    @Transactional
    public List<CreateKnowledgeResult> registerBatch(BatchRegisterKnowledgeCommand command) {
        List<CreateKnowledgeResult> results = new ArrayList<>();

        if (command.items() == null || command.items().isEmpty()) {
            return results;
        }

        // 1. 후보 지식 일괄 등록 (APPROVED 상태로 저장 및 임베딩 생성)
        for (BatchRegisterKnowledgeCommand.KnowledgeItem item : command.items()) {
            String domainCodeStr = (item.domainCode() != null && !item.domainCode().isBlank())
                    ? item.domainCode().trim().toUpperCase()
                    : "COMMON";
            DomainCode domainCode = DomainCode.from(domainCodeStr);

            // 임베딩 생성
            String contentToEmbed = "Q: " + item.question() + "\nA: " + item.answer();
            float[] embedding = embeddingPort.generateEmbedding(contentToEmbed);

            KnowledgeEntry entry = KnowledgeEntry.builder()
                    .question(item.question())
                    .answer(item.answer())
                    .domainCode(domainCode)
                    .status(KnowledgeStatus.APPROVED)
                    .build();

            KnowledgeEntry saved = knowledgeRepositoryPort.save(entry, embedding);
            results.add(new CreateKnowledgeResult(saved.getId()));
            
            log.info("[RAG Batch] Registered knowledge entry: id: {}, Q: {}", saved.getId(), saved.getQuestion());
        }

        // 2. 분석에 활용되었던 원본 PENDING 목록 일괄 삭제 (더 이상 검토 대기가 아님)
        if (command.pendingKnowledgeIds() != null && !command.pendingKnowledgeIds().isEmpty()) {
            for (Long id : command.pendingKnowledgeIds()) {
                log.info("[RAG Batch] Deleting analyzed pending knowledge entry: {}", id);
                try {
                    knowledgeRepositoryPort.deleteById(id);
                } catch (Exception e) {
                    log.error("[RAG Batch] Failed to delete pending entry: {}", id, e);
                }
            }
        }

        return results;
    }
}
