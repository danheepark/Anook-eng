package com.anook.backend.knowledge.application.port.out;

import com.anook.backend.knowledge.domain.model.KnowledgeEntry;
import java.util.List;
import java.util.Optional;

public interface KnowledgeRepositoryPort {
    KnowledgeEntry save(KnowledgeEntry knowledgeEntry, float[] embedding);
    void update(KnowledgeEntry knowledgeEntry, float[] embedding);
    Optional<KnowledgeEntry> findById(Long id);
    List<KnowledgeEntry> findByDomainCode(String domainCode);
    List<KnowledgeEntry> findAll();
    void deleteById(Long id);
    boolean existsByDomainCodeAndQuestion(String domainCode, String question);
}
