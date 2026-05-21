package com.anook.backend.knowledge.adapter.in.web;

import com.anook.backend.knowledge.application.dto.request.RegisterKnowledgeFromAnswerCommand;
import com.anook.backend.knowledge.application.dto.response.CreateKnowledgeResult;
import com.anook.backend.knowledge.application.port.in.RegisterKnowledgeFromAnswerUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * 직원용 RAG 지식 등록 컨트롤러
 *
 * 직원(프론트데스크)이 고객의 미답변 질문에 답변한 후,
 * "RAG 데이터로 등록하시겠어요?" 모달에서 확인을 눌렀을 때 호출된다.
 *
 * 경로: /staff/knowledge/** (SecurityConfig에서 ROLE_STAFF 이상 접근 가능)
 * 역할 계층: ROLE_FRONTDESK > ROLE_STAFF → 관리자도 접근 가능
 *
 * ❌ Controller에서 비즈니스 로직 처리 금지 — UseCase에 위임
 */
@RestController
@RequestMapping("/staff/knowledge")
@RequiredArgsConstructor
public class StaffKnowledgeController {

    private final RegisterKnowledgeFromAnswerUseCase registerKnowledgeFromAnswerUseCase;

    /**
     * 직원 답변 기반 RAG 지식 등록
     *
     * POST /staff/knowledge/register-from-answer
     *
     * Request Body:
     * {
     *   "question": "수영장 몇 시까지 해요?",
     *   "answer": "수영장은 오전 6시부터 오후 10시까지 운영됩니다.",
     *   "domainCode": "FACILITY",   ← (선택) null이면 COMMON
     *   "roomNo": "301"
     * }
     *
     * Response (201 Created):
     * {
     *   "id": 42
     * }
     */
    @PostMapping("/register-from-answer")
    public ResponseEntity<CreateKnowledgeResult> registerFromAnswer(
            @RequestBody RegisterKnowledgeFromAnswerCommand command) {

        CreateKnowledgeResult result = registerKnowledgeFromAnswerUseCase.register(command);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }
}
