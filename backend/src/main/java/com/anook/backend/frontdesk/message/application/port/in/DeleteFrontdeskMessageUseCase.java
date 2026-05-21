package com.anook.backend.frontdesk.message.application.port.in;

public interface DeleteFrontdeskMessageUseCase {
    void deleteRoomMessages(String roomNo);
}
