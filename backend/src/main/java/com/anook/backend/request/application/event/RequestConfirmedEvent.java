package com.anook.backend.request.application.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class RequestConfirmedEvent extends ApplicationEvent {
    private final String roomNo;
    private final Long guestId;
    private final String summary;
    private final String domainCode;

    public RequestConfirmedEvent(Object source, String roomNo, Long guestId, String summary, String domainCode) {
        super(source);
        this.roomNo = roomNo;
        this.guestId = guestId;
        this.summary = summary;
        this.domainCode = domainCode;
    }
}
