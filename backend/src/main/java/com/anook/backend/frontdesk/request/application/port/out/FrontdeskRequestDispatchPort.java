package com.anook.backend.frontdesk.request.application.port.out;

public interface FrontdeskRequestDispatchPort {
    void dispatchCancelRejected(String roomNo, Long requestId, String domainCode, String summary);
    void dispatchStaffMessage(String roomNo, Long messageId, String content);
    void dispatchCancelSuccess(String roomNo, Long requestId, String domainCode, String summary);
}
