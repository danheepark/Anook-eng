package com.anook.backend.knowledge.adapter.out.persistence;

import com.anook.backend.knowledge.application.port.out.KnowledgeRepositoryPort;
import com.anook.backend.knowledge.domain.model.KnowledgeEntry;
import com.anook.backend.knowledge.domain.model.KnowledgeStatus;
import com.anook.backend.knowledge.domain.model.DomainCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class KnowledgePersistenceAdapter implements KnowledgeRepositoryPort {

    private final KnowledgeJpaRepository knowledgeJpaRepository;

    @Override
    @Transactional
    public KnowledgeEntry save(KnowledgeEntry entry, float[] embedding) {
        KnowledgeJpaEntity entity = new KnowledgeJpaEntity(
                null, // 신규 등록이므로 id = null → DB 자동 생성
                entry.getQuestion(),
                entry.getAnswer(),
                entry.getDomainCode(),
                entry.getStatus() != null ? entry.getStatus().name() : KnowledgeStatus.PENDING.name(),
                entry.getApprovedBy()
        );

        KnowledgeJpaEntity savedEntity = knowledgeJpaRepository.saveAndFlush(entity);

        if (embedding != null && embedding.length > 0) {
            String embeddingStr = formatEmbedding(embedding);
            knowledgeJpaRepository.updateEmbedding(savedEntity.getId(), embeddingStr);
        }

        return mapToDomain(savedEntity);
    }

    @Override
    @Transactional
    public void update(KnowledgeEntry entry, float[] embedding) {
        KnowledgeJpaEntity entity = knowledgeJpaRepository.findById(entry.getId())
                .orElseThrow(() -> new IllegalArgumentException("Entity not found: " + entry.getId()));

        entity.updateFields(
                entry.getQuestion(),
                entry.getAnswer(),
                entry.getDomainCode(),
                entry.getStatus() != null ? entry.getStatus().name() : KnowledgeStatus.PENDING.name()
        );

        // Dirty checking에 의해 자동으로 UPDATE 쿼리가 실행되지만 명시적 save도 무방
        knowledgeJpaRepository.save(entity);

        if (embedding != null && embedding.length > 0) {
            String embeddingStr = formatEmbedding(embedding);
            knowledgeJpaRepository.updateEmbedding(entry.getId(), embeddingStr);
        }
    }

    @Override
    public Optional<KnowledgeEntry> findById(Long id) {
        return knowledgeJpaRepository.findById(id).map(this::mapToDomain);
    }

    @Override
    public List<KnowledgeEntry> findByDomainCode(String domainCode) {
        DomainCode code = DomainCode.valueOf(domainCode.toUpperCase());
        return knowledgeJpaRepository.findByDomainCodeOrderByCreatedAtDesc(code).stream()
                .map(this::mapToDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<KnowledgeEntry> findAll() {
        return knowledgeJpaRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::mapToDomain)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public void deleteById(Long id) {
        knowledgeJpaRepository.deleteById(id);
    }

    @Override
    public boolean existsByDomainCodeAndQuestion(String domainCode, String question) {
        DomainCode code = DomainCode.valueOf(domainCode.toUpperCase());
        return knowledgeJpaRepository.existsByDomainCodeAndQuestion(code, question);
    }

    private KnowledgeEntry mapToDomain(KnowledgeJpaEntity entity) {
        return KnowledgeEntry.builder()
                .id(entity.getId())
                .question(entity.getQuestion())
                .answer(entity.getAnswer())
                .domainCode(entity.getDomainCode())
                .status(KnowledgeStatus.valueOf(entity.getStatus()))
                .approvedBy(entity.getApprovedBy())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private String formatEmbedding(float[] embedding) {
        StringBuilder sb = new StringBuilder();
        sb.append("[");
        for (int i = 0; i < embedding.length; i++) {
            sb.append(embedding[i]);
            if (i < embedding.length - 1) {
                sb.append(",");
            }
        }
        sb.append("]");
        return sb.toString();
    }
}
