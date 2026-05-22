package com.anook.backend.frontdesk.handover.application.service;

import com.anook.backend.frontdesk.handover.application.dto.response.HandoverBriefingResult;
import com.anook.backend.frontdesk.handover.application.dto.response.HandoverTaskResult;
import com.anook.backend.frontdesk.handover.application.port.in.GetHandoverBriefingUseCase;
import com.anook.backend.frontdesk.handover.application.port.out.HandoverRequestQueryPort;
import com.anook.backend.frontdesk.handover.domain.model.HandoverTask;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GetHandoverBriefingService implements GetHandoverBriefingUseCase {

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("H:mm");

    private final HandoverRequestQueryPort handoverRequestQueryPort;

    @Override
    public HandoverBriefingResult getBriefing(LocalDate targetDate, String shiftType) {
        LocalDateTime start;
        LocalDateTime end;
        String shiftTimeLabel;
        String shiftLabel;

        if ("DAY".equalsIgnoreCase(shiftType)) {
            start = targetDate.atTime(LocalTime.of(7, 0));
            end = targetDate.atTime(LocalTime.of(15, 0));
            shiftTimeLabel = "07:00 - 15:00";
            shiftLabel = "Morning";
        } else if ("EVENING".equalsIgnoreCase(shiftType)) {
            start = targetDate.atTime(LocalTime.of(15, 0));
            end = targetDate.atTime(LocalTime.of(23, 0));
            shiftTimeLabel = "15:00 - 23:00";
            shiftLabel = "Evening";
        } else { // NIGHT
            start = targetDate.atTime(LocalTime.of(23, 0));
            end = targetDate.plusDays(1).atTime(LocalTime.of(7, 0));
            shiftTimeLabel = "23:00 - 07:00";
            shiftLabel = "Night";
        }

        List<HandoverTask> tasks = handoverRequestQueryPort.findTasksByTimeRange(start, end);

        List<HandoverTaskResult> taskResults = tasks.stream()
                .map(t -> new HandoverTaskResult(
                        t.getStatus(),
                        t.getCategory(),
                        t.getRoomNo(),
                        t.getSummary(),
                        formatAuthor(t.getAuthorName(), shiftLabel),
                        formatTime(t.getCreatedAt())
                ))
                .collect(Collectors.toList());

        long pendingCount = tasks.stream()
                .filter(t -> "PENDING".equals(t.getStatus()))
                .count();

        String managerNames = tasks.stream()
                .map(HandoverTask::getAuthorName)
                .filter(name -> name != null && !name.isBlank())
                .distinct()
                .collect(Collectors.joining(", "));

        if (managerNames.isEmpty()) {
            managerNames = "미배정";
        }

        return new HandoverBriefingResult(
                shiftTimeLabel,
                taskResults.size(),
                (int) pendingCount,
                managerNames,
                taskResults
        );
    }

    private String formatAuthor(String authorName, String shiftLabel) {
        if (authorName == null || authorName.isBlank()) {
            return "미배정";
        }
        return authorName + " (" + shiftLabel + ")";
    }

    private String formatTime(LocalDateTime createdAt) {
        if (createdAt == null) {
            return "";
        }
        return createdAt.format(TIME_FORMATTER);
    }
}
