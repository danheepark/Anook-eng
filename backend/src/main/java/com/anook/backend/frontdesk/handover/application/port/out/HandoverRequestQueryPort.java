package com.anook.backend.frontdesk.handover.application.port.out;

import com.anook.backend.frontdesk.handover.domain.model.HandoverTask;
import java.time.LocalDateTime;
import java.util.List;

public interface HandoverRequestQueryPort {
    List<HandoverTask> findTasksByTimeRange(LocalDateTime start, LocalDateTime end);
}
