package com.anook.backend.message.adapter.in.web;

import com.anook.backend.global.exception.BusinessException;
import com.anook.backend.global.exception.ErrorCode;
import com.anook.backend.message.adapter.in.web.dto.request.SendMessageRequest;
import com.anook.backend.message.application.dto.request.SendMessageCommand;
import com.anook.backend.message.application.dto.response.MessageDto;
import com.anook.backend.message.application.dto.response.SendMessageResult;
import com.anook.backend.message.application.port.in.GetMessageHistoryUseCase;
import com.anook.backend.message.application.port.in.SendMessageUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * 고객 메시지 컨트롤러
 *
 * ❌ 비즈니스 로직 처리 금지 — UseCase에 위임
 * ❌ @RequestMapping에 /api 접두어 금지 (BFF가 제거하고 전달)
 * ❌ @RequestBody Map 금지 — 전용 Request DTO 사용
 */
@Slf4j
@RestController
@RequestMapping("/chat/{roomNo}/messages")
@RequiredArgsConstructor
public class GuestMessageController {

    private final SendMessageUseCase sendMessageUseCase;
    private final GetMessageHistoryUseCase getMessageHistoryUseCase;

    @PostMapping
    public ResponseEntity<SendMessageResult> sendMessage(
            @PathVariable String roomNo,
            @RequestBody SendMessageRequest request,
            Principal principal
    ) {
        validateRoomNo(principal, roomNo);
        if (request.content() == null || request.content().isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        Long guestId = Long.parseLong(principal.getName());
        String lang = request.language() != null ? request.language() : "ko";
        SendMessageCommand command = new SendMessageCommand(roomNo, guestId, request.content(), request.images(), lang);
        SendMessageResult result = sendMessageUseCase.send(command);

        return ResponseEntity.ok(result);
    }

    /**
     * 대화 내역 조회
     *
     * GET /chat/{roomNo}/messages
     */
    @GetMapping
    public ResponseEntity<List<MessageDto>> getHistory(
            @PathVariable String roomNo,
            Principal principal
    ) {
        validateRoomNo(principal, roomNo);
        Long guestId = Long.parseLong(principal.getName());
        List<MessageDto> messages = getMessageHistoryUseCase.getHistory(roomNo, guestId);
        return ResponseEntity.ok(messages);
    }

    /**
     * URL의 roomNo와 토큰의 roomNo 클레임이 일치하는지 검증 (격리 보안)
     */
    private void validateRoomNo(Principal principal, String roomNo) {
        if (principal instanceof UsernamePasswordAuthenticationToken auth) {
            Object details = auth.getDetails();
            if (details instanceof Map<?, ?> claims) {
                String tokenRoomNo = (String) claims.get("roomNo");
                if (tokenRoomNo != null && !tokenRoomNo.equals(roomNo)) {
                    log.warn("접근 거부: URL roomNo({}) != Token roomNo({})", roomNo, tokenRoomNo);
                    throw new BusinessException(ErrorCode.ACCESS_DENIED);
                }
            }
        }
    }
}
