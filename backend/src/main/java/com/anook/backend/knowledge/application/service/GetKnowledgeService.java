package com.anook.backend.knowledge.application.service;

import com.anook.backend.knowledge.application.dto.response.GetKnowledgeDetailResult;
import com.anook.backend.knowledge.application.dto.response.GetKnowledgeResult;
import com.anook.backend.knowledge.application.port.in.GetKnowledgeDetailUseCase;
import com.anook.backend.knowledge.application.port.in.GetKnowledgeListUseCase;
import com.anook.backend.knowledge.application.port.out.KnowledgeRepositoryPort;
import com.anook.backend.knowledge.domain.model.KnowledgeEntry;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GetKnowledgeService implements GetKnowledgeListUseCase, GetKnowledgeDetailUseCase {

    private final KnowledgeRepositoryPort knowledgeRepositoryPort;

    @Override
    public List<GetKnowledgeResult> getByDomain(String domainCode) {
        return knowledgeRepositoryPort.findByDomainCode(domainCode).stream()
                .map(this::mapToListResult)
                .collect(Collectors.toList());
    }

    @Override
    public List<GetKnowledgeResult> getAll() {
        return knowledgeRepositoryPort.findAll().stream()
                .map(this::mapToListResult)
                .collect(Collectors.toList());
    }

    @Override
    public GetKnowledgeDetailResult getById(Long id) {
        KnowledgeEntry entry = knowledgeRepositoryPort.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Knowledge entry not found: " + id));
        
        return GetKnowledgeDetailResult.builder()
                .id(entry.getId())
                .question(entry.getQuestion())
                .answer(entry.getAnswer())
                .domainCode(entry.getDomainCode().name())
                .status(entry.getStatus().name())
                .approvedBy(entry.getApprovedBy())
                .createdAt(entry.getCreatedAt())
                .updatedAt(entry.getUpdatedAt())
                .build();
    }

    private GetKnowledgeResult mapToListResult(KnowledgeEntry entry) {
        return GetKnowledgeResult.builder()
                .id(entry.getId())
                .question(entry.getQuestion())
                .answer(entry.getAnswer())
                .domainCode(entry.getDomainCode().name())
                .status(entry.getStatus().name())
                .roomNo(entry.getRoomNo())
                .updatedAt(entry.getUpdatedAt())
                .build();
    }
}
