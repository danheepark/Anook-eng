package com.anook.backend.knowledge.adapter.out.persistence;

import com.anook.backend.knowledge.domain.model.DomainCode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface KnowledgeJpaRepository extends JpaRepository<KnowledgeJpaEntity, Long> {
    List<KnowledgeJpaEntity> findByDomainCodeOrderByCreatedAtDesc(DomainCode domainCode);
    List<KnowledgeJpaEntity> findAllByOrderByCreatedAtDesc();
    boolean existsByDomainCodeAndQuestion(DomainCode domainCode, String question);

    @Modifying
    @Query(value = "UPDATE knowledge_entry SET embedding = cast(?2 as vector) WHERE id = ?1", nativeQuery = true)
    void updateEmbedding(Long id, String embeddingStr);
}
