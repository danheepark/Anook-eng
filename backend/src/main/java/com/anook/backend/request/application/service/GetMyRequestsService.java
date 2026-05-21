package com.anook.backend.request.application.service;

import com.anook.backend.request.application.dto.response.GetMyRequestsResult;
import com.anook.backend.request.application.port.in.GetMyRequestsUseCase;
import com.anook.backend.request.application.port.out.RequestRepositoryPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GetMyRequestsService implements GetMyRequestsUseCase {

    private final RequestRepositoryPort requestRepositoryPort;

    @Override
    public List<GetMyRequestsResult> getMyRequests(String roomNo, Long guestId) {
        return requestRepositoryPort.findByRoomNoAndGuestId(roomNo, guestId).stream()
                .map(request -> new GetMyRequestsResult(
                        request.getId(),
                        request.getStatus().name(),
                        request.getDomainCode() != null ? request.getDomainCode().name() : "UNKNOWN",
                        request.getSummary(),
                        request.getEntities(),
                        request.getPriority() != null ? request.getPriority().name() : "NORMAL",
                        request.getCreatedAt(),
                        request.getUpdatedAt()
                ))
                .toList();
    }
}
