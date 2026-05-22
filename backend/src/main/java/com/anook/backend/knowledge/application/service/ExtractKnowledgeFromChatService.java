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
            List<ChatMessageDto> latestMessages = filterLatestSessionMessages(messages);
            if (!latestMessages.isEmpty()) {
                List<KnowledgeCandidateResult> candidates = knowledgeExtractPort.extractFromChat(latestMessages);
                allCandidates.addAll(candidates);
            }
        } else if (command.pendingIds() != null && !command.pendingIds().isEmpty()) {
            log.info("[RAG Extract] Extracting candidates for pendingIds: {}", command.pendingIds());
            
            for (Long id : command.pendingIds()) {
                knowledgeRepositoryPort.findById(id).ifPresent(entry -> {
                    // PENDING 항목의 경우, 저장된 대화 청크(질문/답변) 자체를 AI에게 전달하여 분석하게 합니다.
                    // 이렇게 하면 우산/자전거 등 각기 다른 세션에서 등록된 PENDING 항목들이 개별적으로 정확히 분석됩니다.
                    List<ChatMessageDto> messages = List.of(
                        new ChatMessageDto("GUEST", entry.getQuestion() != null ? entry.getQuestion() : "대화 내용 요약"),
                        new ChatMessageDto("STAFF", entry.getAnswer() != null ? entry.getAnswer() : "")
                    );
                    List<KnowledgeCandidateResult> candidates = knowledgeExtractPort.extractFromChat(messages);
                    allCandidates.addAll(candidates);
                });
            }
        }

        return allCandidates;
    }

    /**
     * 마지막 상담 세션의 메시지만 필터링합니다.
     * "[SYSTEM]" 완료 메시지를 기준으로 세션을 분할하고 가장 마지막 세션을 반환합니다.
     */
    private List<ChatMessageDto> filterLatestSessionMessages(List<ChatMessageDto> messages) {
        if (messages == null || messages.isEmpty()) {
            return messages;
        }

        List<List<ChatMessageDto>> chunks = new ArrayList<>();
        List<ChatMessageDto> currentChunk = new ArrayList<>();

        for (ChatMessageDto msg : messages) {
            String content = msg.content();
            if (content != null && (
                    content.contains("이전 상담 및 처리가 모두 완료되었습니다") ||
                    content.contains("[SYSTEM]")
            )) {
                if (!currentChunk.isEmpty()) {
                    chunks.add(new ArrayList<>(currentChunk));
                    currentChunk.clear();
                }
            } else {
                currentChunk.add(msg);
            }
        }
        
        if (!currentChunk.isEmpty()) {
            chunks.add(currentChunk);
        }

        if (chunks.isEmpty()) {
            return new ArrayList<>();
        }
        
        return chunks.get(chunks.size() - 1);
    }
}
