package com.anook.backend.frontdesk.message.application.port.out;

public interface FrontdeskMessageCommandPort {
    void deleteMessagesByRoomNo(String roomNo);
}
