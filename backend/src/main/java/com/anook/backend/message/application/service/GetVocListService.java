package com.anook.backend.message.application.service;

import com.anook.backend.message.application.dto.response.GetVocListResult;
import com.anook.backend.message.application.port.in.GetVocListUseCase;
import com.anook.backend.message.application.port.out.MessageRepositoryPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class GetVocListService implements GetVocListUseCase {

    private final MessageRepositoryPort messageRepositoryPort;

    @Override
    @Transactional(readOnly = true)
    public List<GetVocListResult> getVocList() {
        return messageRepositoryPort.findVocs().stream()
                .map(msg -> {
                    // VOC 메시지 시점 기준으로 이전 메시지 조회 (시간 기반 역추적)
                    List<com.anook.backend.message.domain.model.Message> messagesBefore = 
                            messageRepositoryPort.findMessagesBeforeTimestamp(
                                    msg.getRoomNo(), msg.getGuestId(), msg.getCreatedAt(), 10);
                    
                    // AI 응답 찾기: VOC 메시지 직후의 최근 메시지에서 탐색
                    List<com.anook.backend.message.domain.model.Message> recent = 
                            messageRepositoryPort.findRecentByRoomNoAndGuestId(msg.getRoomNo(), msg.getGuestId(), 20);
                    String aiReply = "분석 중...";
                    for (com.anook.backend.message.domain.model.Message r : recent) {
                        if (r.isFromAi() && r.getCreatedAt().isAfter(msg.getCreatedAt())) {
                            aiReply = r.getContent();
                        }
                    }

                    String vocContent = msg.getContent();
                    // 만약 VOC 내용이 "아니요, 괜찮습니다"와 같은 역질문에 대한 짧은 대답이라면, 이전 진짜 불만 메시지를 찾아 표시
                    if (vocContent != null && vocContent.length() <= 20 && 
                        (vocContent.contains("아니") || vocContent.contains("괜찮") || vocContent.contains("됐") || vocContent.toLowerCase().contains("no") || vocContent.contains("그냥"))) {
                        
                        for (com.anook.backend.message.domain.model.Message r : messagesBefore) {
                            if (!r.isFromAi()) {
                                String prevContent = r.getContent();
                                // 이전 메시지도 사용자가 연달아 보낸 짧은 대답일 수 있으므로 건너뜀
                                if (prevContent != null && prevContent.length() <= 20 && 
                                    (prevContent.contains("아니") || prevContent.contains("괜찮") || prevContent.contains("됐") || prevContent.toLowerCase().contains("no"))) {
                                    continue;
                                }
                                vocContent = prevContent;
                                break;
                            }
                        }
                    }

                    return new GetVocListResult(
                            msg.getId(),
                            msg.getRoomNo(),
                            msg.getGuestId(),
                            msg.getSentiment(),
                            vocContent,
                            aiReply,
                            msg.getCreatedAt()
                    );
                })
                .toList();
    }
}
