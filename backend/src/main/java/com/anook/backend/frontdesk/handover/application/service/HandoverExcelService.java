package com.anook.backend.frontdesk.handover.application.service;

import com.anook.backend.frontdesk.handover.application.port.out.HandoverRequestQueryPort;
import com.anook.backend.frontdesk.handover.domain.model.HandoverTask;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class HandoverExcelService {

    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("HH:mm");
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final HandoverRequestQueryPort handoverRequestQueryPort;

    public byte[] generateExcel(LocalDate targetDate, String shiftType) throws IOException {

        // ── 1. 시간 범위 계산 ──────────────────────────────────────────
        LocalDateTime start;
        LocalDateTime end;
        String shiftLabel;
        String shiftTimeLabel;

        if ("DAY".equalsIgnoreCase(shiftType)) {
            start = targetDate.atTime(LocalTime.of(7, 0));
            end   = targetDate.atTime(LocalTime.of(15, 0));
            shiftLabel     = "주간";
            shiftTimeLabel = "07:00 - 15:00";
        } else if ("EVENING".equalsIgnoreCase(shiftType)) {
            start = targetDate.atTime(LocalTime.of(15, 0));
            end   = targetDate.atTime(LocalTime.of(23, 0));
            shiftLabel     = "야간";
            shiftTimeLabel = "15:00 - 23:00";
        } else {
            start = targetDate.atTime(LocalTime.of(23, 0));
            end   = targetDate.plusDays(1).atTime(LocalTime.of(7, 0));
            shiftLabel     = "심야";
            shiftTimeLabel = "23:00 - 07:00";
        }

        // ── 2. 데이터 조회 ────────────────────────────────────────────
        List<HandoverTask> tasks = handoverRequestQueryPort.findTasksByTimeRange(start, end);

        // 객실번호 기준으로 그룹화 → 그룹 내 시간순 정렬
        Map<String, List<HandoverTask>> grouped = tasks.stream()
                .collect(Collectors.groupingBy(
                        HandoverTask::getRoomNo,
                        LinkedHashMap::new,
                        Collectors.collectingAndThen(
                                Collectors.toList(),
                                list -> list.stream()
                                        .sorted(Comparator.comparing(
                                                t -> t.getCreatedAt() != null ? t.getCreatedAt() : LocalDateTime.MIN
                                        ))
                                        .collect(Collectors.toList())
                        )
                ));

        // ── 3. 워크북 / 시트 생성 ────────────────────────────────────
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("인수인계");
            sheet.setDefaultColumnWidth(18);
            sheet.setColumnWidth(3, 55 * 256); // 내용 컬럼 넓게

            // ── 스타일 정의 ────────────────────────────────────────────
            CellStyle titleStyle   = makeTitleStyle(wb);
            CellStyle infoStyle    = makeInfoStyle(wb);
            CellStyle headerStyle  = makeHeaderStyle(wb);
            CellStyle roomStyle    = makeRoomStyle(wb);
            CellStyle dataStyle    = makeDataStyle(wb);
            CellStyle pendingStyle = makePendingStyle(wb);
            CellStyle doneStyle    = makeDoneStyle(wb);

            int rowIdx = 0;

            // ── 행 0: 제목 ────────────────────────────────────────────
            Row titleRow = sheet.createRow(rowIdx++);
            titleRow.setHeightInPoints(36);
            Cell titleCell = titleRow.createCell(0);
            titleCell.setCellValue("인수인계 보고서");
            titleCell.setCellStyle(titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 4));

            // ── 행 1: 날짜 / 근무 시간대 ─────────────────────────────
            Row infoRow = sheet.createRow(rowIdx++);
            infoRow.setHeightInPoints(22);
            Cell infoCell = infoRow.createCell(0);
            infoCell.setCellValue(
                    "날짜: " + targetDate.format(DATE_FMT)
                    + "    근무: " + shiftLabel + " (" + shiftTimeLabel + ")"
            );
            infoCell.setCellStyle(infoStyle);
            sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, 4));

            // ── 행 2: 요약 카운트 ─────────────────────────────────────
            long pendingCount = tasks.stream()
                    .filter(t -> "PENDING".equalsIgnoreCase(t.getStatus()))
                    .count();
            Row countRow = sheet.createRow(rowIdx++);
            countRow.setHeightInPoints(20);
            Cell countCell = countRow.createCell(0);
            countCell.setCellValue("총 이슈: " + tasks.size() + "건    대기 중: " + pendingCount + "건");
            countCell.setCellStyle(infoStyle);
            sheet.addMergedRegion(new CellRangeAddress(2, 2, 0, 4));

            // ── 행 3: 빈 줄 ──────────────────────────────────────────
            rowIdx++;

            // ── 행 4: 헤더 ───────────────────────────────────────────
            Row headerRow = sheet.createRow(rowIdx++);
            headerRow.setHeightInPoints(24);
            String[] headers = {"객실번호", "시간", "부서", "내용", "상태"};
            for (int i = 0; i < headers.length; i++) {
                Cell c = headerRow.createCell(i);
                c.setCellValue(headers[i]);
                c.setCellStyle(headerStyle);
            }

            // ── 행 5~: 데이터 (객실 기준 그룹, 시간순) ───────────────
            for (Map.Entry<String, List<HandoverTask>> entry : grouped.entrySet()) {
                String roomNo = entry.getKey();
                List<HandoverTask> roomTasks = entry.getValue();

                int groupStart = rowIdx;

                for (int i = 0; i < roomTasks.size(); i++) {
                    HandoverTask task = roomTasks.get(i);
                    Row row = sheet.createRow(rowIdx++);
                    row.setHeightInPoints(20);

                    // 객실번호: 그룹 첫 행에만 표시
                    Cell roomCell = row.createCell(0);
                    if (i == 0) {
                        roomCell.setCellValue(roomNo);
                    }
                    roomCell.setCellStyle(roomStyle);

                    // 시간
                    Cell timeCell = row.createCell(1);
                    timeCell.setCellValue(
                            task.getCreatedAt() != null ? task.getCreatedAt().format(TIME_FMT) : "-"
                    );
                    timeCell.setCellStyle(dataStyle);

                    // 부서
                    Cell categoryCell = row.createCell(2);
                    categoryCell.setCellValue(task.getCategory() != null ? task.getCategory() : "-");
                    categoryCell.setCellStyle(dataStyle);

                    // 내용
                    Cell summaryCell = row.createCell(3);
                    summaryCell.setCellValue(task.getSummary() != null ? task.getSummary() : "-");
                    summaryCell.setCellStyle(dataStyle);

                    // 상태
                    Cell statusCell = row.createCell(4);
                    String statusKo = toKoreanStatus(task.getStatus());
                    statusCell.setCellValue(statusKo);
                    statusCell.setCellStyle(
                            "대기중".equals(statusKo) ? pendingStyle :
                            "처리완료".equals(statusKo) ? doneStyle : dataStyle
                    );
                }

                // 같은 객실 행들의 객실번호 셀 머지
                if (roomTasks.size() > 1) {
                    sheet.addMergedRegion(new CellRangeAddress(groupStart, rowIdx - 1, 0, 0));
                }
            }

            // ── 빈 결과 처리 ─────────────────────────────────────────
            if (tasks.isEmpty()) {
                Row emptyRow = sheet.createRow(rowIdx);
                Cell emptyCell = emptyRow.createCell(0);
                emptyCell.setCellValue("해당 근무 시간대에 이슈가 없습니다.");
                emptyCell.setCellStyle(infoStyle);
                sheet.addMergedRegion(new CellRangeAddress(rowIdx, rowIdx, 0, 4));
            }

            // ── 바이트 배열로 변환 ────────────────────────────────────
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        }
    }

    // ── 상태 한글 변환 ───────────────────────────────────────────────
    private String toKoreanStatus(String status) {
        if (status == null) return "-";
        return switch (status.toUpperCase()) {
            case "PENDING"     -> "대기중";
            case "IN_PROGRESS" -> "진행중";
            case "COMPLETED", "DONE" -> "처리완료";
            case "ESCALATED"   -> "에스컬레이션";
            case "CANCELLED"   -> "취소";
            default            -> status;
        };
    }

    // ── 스타일 팩토리 메서드 ─────────────────────────────────────────

    private CellStyle makeTitleStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont();
        f.setBold(true);
        f.setFontHeightInPoints((short) 18);
        s.setFont(f);
        s.setAlignment(HorizontalAlignment.CENTER);
        s.setVerticalAlignment(VerticalAlignment.CENTER);
        s.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        Font whiteFont = wb.createFont();
        whiteFont.setBold(true);
        whiteFont.setFontHeightInPoints((short) 18);
        whiteFont.setColor(IndexedColors.WHITE.getIndex());
        s.setFont(whiteFont);
        return s;
    }

    private CellStyle makeInfoStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont();
        f.setFontHeightInPoints((short) 11);
        s.setFont(f);
        s.setAlignment(HorizontalAlignment.LEFT);
        s.setVerticalAlignment(VerticalAlignment.CENTER);
        s.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return s;
    }

    private CellStyle makeHeaderStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont();
        f.setBold(true);
        f.setFontHeightInPoints((short) 11);
        f.setColor(IndexedColors.WHITE.getIndex());
        s.setFont(f);
        s.setAlignment(HorizontalAlignment.CENTER);
        s.setVerticalAlignment(VerticalAlignment.CENTER);
        s.setFillForegroundColor(IndexedColors.CORNFLOWER_BLUE.getIndex());
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        setBorder(s);
        return s;
    }

    private CellStyle makeRoomStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        Font f = wb.createFont();
        f.setBold(true);
        f.setFontHeightInPoints((short) 11);
        s.setFont(f);
        s.setAlignment(HorizontalAlignment.CENTER);
        s.setVerticalAlignment(VerticalAlignment.CENTER);
        s.setFillForegroundColor(IndexedColors.LIGHT_CORNFLOWER_BLUE.getIndex());
        s.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        s.setWrapText(false);
        setBorder(s);
        return s;
    }

    private CellStyle makeDataStyle(Workbook wb) {
        CellStyle s = wb.createCellStyle();
        s.setAlignment(HorizontalAlignment.LEFT);
        s.setVerticalAlignment(VerticalAlignment.CENTER);
        s.setWrapText(true);
        setBorder(s);
        return s;
    }

    private CellStyle makePendingStyle(Workbook wb) {
        CellStyle s = makeDataStyle(wb);
        Font f = wb.createFont();
        f.setBold(true);
        f.setColor(IndexedColors.RED.getIndex());
        s.setFont(f);
        s.setAlignment(HorizontalAlignment.CENTER);
        return s;
    }

    private CellStyle makeDoneStyle(Workbook wb) {
        CellStyle s = makeDataStyle(wb);
        Font f = wb.createFont();
        f.setColor(IndexedColors.GREEN.getIndex());
        s.setFont(f);
        s.setAlignment(HorizontalAlignment.CENTER);
        return s;
    }

    private void setBorder(CellStyle s) {
        s.setBorderTop(BorderStyle.THIN);
        s.setBorderBottom(BorderStyle.THIN);
        s.setBorderLeft(BorderStyle.THIN);
        s.setBorderRight(BorderStyle.THIN);
    }
}
