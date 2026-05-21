package com.anook.backend.frontdesk.message.application.service;

import com.anook.backend.frontdesk.message.application.port.in.DeleteFrontdeskMessageUseCase;
import com.anook.backend.frontdesk.message.application.port.out.FrontdeskMessageCommandPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DeleteFrontdeskMessageService implements DeleteFrontdeskMessageUseCase {

    private final FrontdeskMessageCommandPort commandPort;

    @Override
    @Transactional
    public void deleteRoomMessages(String roomNo) {
        commandPort.deleteMessagesByRoomNo(roomNo);
    }
}
