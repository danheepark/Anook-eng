package com.anook.backend.admin.message.adapter.in.web;

import com.anook.backend.admin.message.application.port.out.AdminMessageQueryPort;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 관리자 메시지 히스토리 Controller
 *
 * admin/message 모듈의 자체 Port를 통해 message 테이블을 조회합니다.
 * message 모듈의 UseCase/Port를 import하지 않고 독립적으로 동작합니다.
 */
import com.anook.backend.admin.message.application.port.in.DeleteAdminMessageUseCase;
import com.anook.backend.message.application.port.in.GetVocListUseCase;
import com.anook.backend.message.application.port.in.SendMessageUseCase;
import com.anook.backend.message.application.dto.request.SendStaffMessageCommand;
import com.anook.backend.message.application.dto.response.GetVocListResult;

@RestController
@RequestMapping("/admin/messages")
@RequiredArgsConstructor
public class AdminMessageController {

    private final AdminMessageQueryPort adminMessageQueryPort;
    private final SendMessageUseCase sendMessageUseCase;
    private final DeleteAdminMessageUseCase deleteAdminMessageUseCase;
    private final GetVocListUseCase getVocListUseCase;

    /**
     * 메시지가 있는 객실 목록 조회
     *
     * GET /admin/messages/rooms
     * 응답: [{ "roomId": 1, "roomNo": "101" }, ...]
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
     * GET /admin/messages/rooms/{roomNo}/messages
     */
    @GetMapping("/rooms/{roomNo}/messages")
    public ResponseEntity<List<Map<String, Object>>> getRoomMessages(@PathVariable String roomNo) {
        return ResponseEntity.ok(adminMessageQueryPort.findMessagesByRoomNo(roomNo));
    }

    /**
     * 관리자/직원이 특정 객실에 메시지를 전송
     *
     * POST /admin/messages/rooms/{roomNo}/messages
     * body: { "content": "메시지 내용" }
     */
    @PostMapping("/rooms/{roomNo}/messages")
    public ResponseEntity<Void> sendStaffMessage(
            @PathVariable String roomNo,
            @RequestBody Map<String, String> body) {
        String content = body.get("content");
        if (content == null || content.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        
        Long guestId = adminMessageQueryPort.getLatestGuestId(roomNo);
        // 번역 대상 언어는 현재 DB에 없으므로 기본값(en) 또는 ko 사용
        sendMessageUseCase.sendStaffMessage(
                new SendStaffMessageCommand(content, roomNo, guestId, "ko")
        );
        
        return ResponseEntity.ok().build();
    }
    /**
     * 관리자/직원이 특정 객실의 메시지 내역 삭제
     *
     * DELETE /admin/messages/rooms/{roomNo}
     */
    @DeleteMapping("/rooms/{roomNo}")
    public ResponseEntity<Void> deleteRoomMessages(@PathVariable String roomNo) {
        deleteAdminMessageUseCase.deleteRoomMessages(roomNo);
        return ResponseEntity.ok().build();
    }

    /**
     * 관리자 VOC 목록 조회
     *
     * GET /admin/messages/vocs
     */
    @GetMapping("/vocs")
    public ResponseEntity<List<GetVocListResult>> getVocList() {
        return ResponseEntity.ok(getVocListUseCase.getVocList());
    }
}
