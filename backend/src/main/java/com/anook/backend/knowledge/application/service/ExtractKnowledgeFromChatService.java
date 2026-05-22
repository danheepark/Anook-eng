package com.anook.backend.knowledge.application.service;

import com.anook.backend.knowledge.application.dto.request.ChatMessageDto;
import com.anook.backend.knowledge.application.dto.request.ExtractKnowledgeFromChatCommand;
import com.anook.backend.knowledge.application.dto.response.KnowledgeCandidateResult;
import com.anook.backend.knowledge.application.port.in.ExtractKnowledgeFromChatUseCase;
import com.anook.backend.knowledge.application.port.out.KnowledgeExtractPort;
import com.anook.backend.knowledge.application.port.out.KnowledgeRepositoryPort;
import com.anook.backend.knowledge.application.port.out.MessageQueryPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 대화 내역 기반 RAG 지식 추출 서비스
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ExtractKnowledgeFromChatService implements ExtractKnowledgeFromChatUseCase {

    private final MessageQueryPort messageQueryPort;
    private final KnowledgeExtractPort knowledgeExtractPort;
    private final KnowledgeRepositoryPort knowledgeRepositoryPort;

    @Override
    public List<KnowledgeCandidateResult> extract(ExtractKnowledgeFromChatCommand command) {
        List<KnowledgeCandidateResult> allCandidates = new ArrayList<>();

        if (command.roomNo() != null && !command.roomNo().isBlank()) {
            log.info("[RAG Extract] Extracting candidates for roomNo: {}", command.roomNo());
            List<ChatMessageDto> messages = messageQueryPort.findByRoomNo(command.roomNo());
            if (!messages.isEmpty()) {
                List<KnowledgeCandidateResult> candidates = knowledgeExtractPort.extractFromChat(messages);
                allCandidates.addAll(candidates);
            }
        } else if (command.pendingIds() != null && !command.pendingIds().isEmpty()) {
            log.info("[RAG Extract] Extracting candidates for pendingIds: {}", command.pendingIds());
            
            // 동일한 방의 대화가 여러 개 적재 검토 대상일 경우 한 번만 분석하도록 방번호 세트로 중복 방지
            Set<String> processedRooms = new HashSet<>();

            for (Long id : command.pendingIds()) {
                knowledgeRepositoryPort.findById(id).ifPresent(entry -> {
                    String roomNo = entry.getRoomNo();
                    if (roomNo != null && !roomNo.isBlank() && !processedRooms.contains(roomNo)) {
                        processedRooms.add(roomNo);
                        List<ChatMessageDto> messages = messageQueryPort.findByRoomNo(roomNo);
                        if (!messages.isEmpty()) {
                            List<KnowledgeCandidateResult> candidates = knowledgeExtractPort.extractFromChat(messages);
                            allCandidates.addAll(candidates);
                        }
                    }
                });
            }
        }

        return allCandidates;
    }
}
