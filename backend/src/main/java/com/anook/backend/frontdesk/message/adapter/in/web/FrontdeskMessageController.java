package com.anook.backend.frontdesk.message.adapter.in.web;

import com.anook.backend.frontdesk.message.application.port.in.DeleteFrontdeskMessageUseCase;
import com.anook.backend.frontdesk.message.application.port.out.FrontdeskMessageQueryPort;
import com.anook.backend.message.application.dto.request.SendStaffMessageCommand;
import com.anook.backend.message.application.dto.response.GetVocListResult;
import com.anook.backend.message.application.port.in.GetVocListUseCase;
import com.anook.backend.message.application.port.in.SendMessageUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 관리자 메시지 히스토리 Controller
 *
 * admin/message 모듈의 자체 Port를 통해 message 테이블을 조회합니다.
 */
@RestController
@RequestMapping("/frontdesk/messages")
@RequiredArgsConstructor
public class FrontdeskMessageController {

    private final FrontdeskMessageQueryPort adminMessageQueryPort;
    private final SendMessageUseCase sendMessageUseCase;
    private final DeleteFrontdeskMessageUseCase deleteFrontdeskMessageUseCase;
    private final GetVocListUseCase getVocListUseCase;
    private final JdbcTemplate jdbcTemplate;

    /**
     * 메시지가 있는 객실 목록 조회
     *
     * GET /frontdesk/messages/rooms
     */
    @GetMapping("/rooms")
    public ResponseEntity<List<Map<String, Object>>> getMessageRooms(
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate date) {
        if (date != null) {
            return ResponseEntity.ok(adminMessageQueryPort.findRoomsWithMessages(date));
        }
        return ResponseEntity.ok(adminMessageQueryPort.findRoomsWithMessages());
    }

    /**
     * 특정 객실의 메시지 목록 조회
     *
     * GET /frontdesk/messages/rooms/{roomNo}/messages
     */
    @GetMapping("/rooms/{roomNo}/messages")
    public ResponseEntity<List<Map<String, Object>>> getRoomMessages(@PathVariable String roomNo) {
        return ResponseEntity.ok(adminMessageQueryPort.findMessagesByRoomNo(roomNo));
    }

    /**
     * 관리자/직원이 특정 객실에 메시지를 전송
     *
     * POST /frontdesk/messages/rooms/{roomNo}/messages
     * body: { "content": "메시지 내용" }
     */
    @PostMapping("/rooms/{roomNo}/messages")
    public ResponseEntity<Void> sendStaffMessage(
            @org.springframework.security.core.annotation.AuthenticationPrincipal String staffIdStr,
            @PathVariable String roomNo,
            @RequestBody Map<String, String> body) {
        String content = body.get("content");
        if (content == null || content.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        
        Long guestId = adminMessageQueryPort.getLatestGuestId(roomNo);
        sendMessageUseCase.sendStaffMessage(
                new SendStaffMessageCommand(content, roomNo, guestId, null)
        );
        
        try {
            Long staffId = Long.parseLong(staffIdStr);
            String sql = "UPDATE request SET assigned_staff_id = ?, status = 'IN_PROGRESS', updated_at = NOW() " +
                         "WHERE room_no = ? AND department_id = 'FRONT' AND status IN ('PENDING', 'IN_PROGRESS') AND assigned_staff_id IS NULL";
            jdbcTemplate.update(sql, staffId, roomNo);
        } catch (Exception e) {
            // 무시 (로깅 불필요)
        }
        
        return ResponseEntity.ok().build();
    }

    /**
     * 관리자/직원이 특정 객실의 메시지 내역 삭제
     *
     * DELETE /frontdesk/messages/rooms/{roomNo}
     */
    @DeleteMapping("/rooms/{roomNo}")
    public ResponseEntity<Void> deleteRoomMessages(@PathVariable String roomNo) {
        deleteFrontdeskMessageUseCase.deleteRoomMessages(roomNo);
        return ResponseEntity.ok().build();
    }

    /**
     * 관리자 VOC 목록 조회
     *
     * GET /frontdesk/messages/vocs
     */
    @GetMapping("/vocs")
    public ResponseEntity<List<GetVocListResult>> getVocList() {
        return ResponseEntity.ok(getVocListUseCase.getVocList());
    }

    /**
     * [AN-332] 직원 상담 별점 피드백 조회
     *
     * GET /frontdesk/messages/ratings
     */
    @GetMapping("/ratings")
    public ResponseEntity<List<Map<String, Object>>> getStaffRatings() {
        List<Map<String, Object>> ratings = jdbcTemplate.queryForList(
                "SELECT r.id AS \"requestId\", r.room_no AS \"roomNo\", r.summary, r.rating, " +
                "r.created_at AS \"createdAt\", r.updated_at AS \"updatedAt\", " +
                "COALESCE(s.name, '관리자') AS \"staffName\" " +
                "FROM request r " +
                "LEFT JOIN staff s ON r.assigned_staff_id = s.id " +
                "WHERE r.department_id = 'FRONT' AND r.rating IS NOT NULL " +
                "ORDER BY r.created_at DESC"
        );
        return ResponseEntity.ok(ratings);
    }
}
