package com.anook.backend.request.application.service;

import com.anook.backend.message.application.event.RequestStatusCheckByGuestEvent;
import com.anook.backend.request.application.event.RequestStatusCheckedEvent;
import com.anook.backend.request.application.port.out.RequestRepositoryPort;
import com.anook.backend.request.domain.model.Request;
import com.anook.backend.request.domain.model.RequestStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.scheduling.annotation.Async;



@Slf4j
@Service
@RequiredArgsConstructor
public class CheckStatusOnEventService {

    private final RequestRepositoryPort requestPort;
    private final ApplicationEventPublisher eventPublisher;

    @Async("aiTaskExecutor")
    @EventListener
    @Transactional
    public void onGuestStatusCheck(RequestStatusCheckByGuestEvent event) {
        log.info("[Request] RequestStatusCheckByGuestEvent 수신 — room: {}, guest: {}", event.getRoomNo(), event.getGuestId());

        try {
            // 약간의 딜레이를 주어 AI가 "확인해 드리겠습니다"라고 한 뒤에 진짜로 확인하는 느낌을 줌
            Thread.sleep(1500);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        // 1. 해당 객실의 모든 요청 조회 후 최신순 정렬
        java.util.List<Request> allRequests = new java.util.ArrayList<>(requestPort.findByRoomNoAndGuestId(event.getRoomNo(), event.getGuestId()));
        allRequests.sort((r1, r2) -> r2.getCreatedAt().compareTo(r1.getCreatedAt()));

        Request matchedRequest = null;
        String userMsg = event.getUserMessage() != null ? event.getUserMessage() : "";

        // 2. 키워드 매칭 시도 (주로 명사 위주 매칭)
        for (Request req : allRequests) {
            if (req.getStatus() == RequestStatus.PENDING || req.getStatus() == RequestStatus.IN_PROGRESS) {
                String summary = req.getSummary() != null ? req.getSummary() : "";
                String entities = req.getEntities() != null ? req.getEntities().toString() : "";
                
                boolean matched = false;
                for (String word : userMsg.split("\\s+")) {
                    if (word.length() >= 2 && (summary.contains(word) || entities.contains(word))) {
                        matched = true;
                        break;
                    }
                }
                
                if (matched) {
                    matchedRequest = req;
                    break;
                }
            }
        }

        // 3. 매칭된 요청이 없으면:
        //    (a) 먼저 활성 상태(PENDING, IN_PROGRESS, ESCALATED)인 요청 중 가장 최근 것 선택
        //    (b) 활성 요청이 없으면 전체 요청 중 가장 최근 것 선택
        if (matchedRequest == null && !allRequests.isEmpty()) {
            for (Request req : allRequests) {
                if (req.getStatus() == RequestStatus.PENDING || 
                    req.getStatus() == RequestStatus.IN_PROGRESS || 
                    req.getStatus() == RequestStatus.ESCALATED) {
                    matchedRequest = req;
                    break;
                }
            }
            if (matchedRequest == null) {
                matchedRequest = allRequests.get(0);
            }
        }

        String replyMessage;

        if (matchedRequest != null) {
            String prefix = matchedRequest.getSummary() != null ? "[" + matchedRequest.getSummary() + "] 건 확인 결과, " : "확인 결과, ";
            if (matchedRequest.getStatus() == RequestStatus.PENDING) {
                replyMessage = prefix + "요청이 접수되어 담당 부서 배정을 기다리고 있습니다. 곧 처리가 시작될 예정이니 조금만 더 기다려 주시면 감사하겠습니다.";
            } else if (matchedRequest.getStatus() == RequestStatus.IN_PROGRESS) {
                replyMessage = prefix + "현재 담당 직원이 요청을 처리하고 있습니다. 보통 15~30분 정도 소요되니 조금만 더 기다려 주시면 감사하겠습니다.";
            } else if (matchedRequest.getStatus() == RequestStatus.ESCALATED) {
                replyMessage = prefix + "더 빠르고 정확한 처리를 위해 프론트 데스크 담당 직원이 직접 확인 중입니다. 확인 후 신속하게 도와드리겠습니다.";
            } else if (matchedRequest.getStatus() == RequestStatus.COMPLETED || matchedRequest.getStatus() == RequestStatus.SETTLED) {
                replyMessage = "가장 최근 접수된 " + (matchedRequest.getSummary() != null ? "[" + matchedRequest.getSummary() + "] " : "") + "요청은 이미 처리가 완료되었습니다. 혹시 추가로 필요한 사항이 있으시다면 언제든지 말씀해 주세요.";
            } else if (matchedRequest.getStatus() == RequestStatus.CANCELLED) {
                replyMessage = "해당 요청은 취소 처리되었습니다. 새로운 요청이 필요하시면 언제든지 말씀해 주세요.";
            } else {
                replyMessage = "현재 요청의 상태를 정확히 확인하기 어렵습니다. 프론트 데스크(내선 0번)로 문의해 주시면 감사하겠습니다.";
            }
        } else {
            replyMessage = "현재 접수된 요청 내역이 없습니다. 필요하신 사항이 있으시다면 편하게 말씀해 주세요.";
        }

        log.info("[Request] 상태 기반 추가 응답 생성 — reply: {}", replyMessage);

        // 4. Message 모듈에 전달할 이벤트 발행
        eventPublisher.publishEvent(new RequestStatusCheckedEvent(this, event.getRoomNo(), event.getGuestId(), replyMessage));
    }
}
