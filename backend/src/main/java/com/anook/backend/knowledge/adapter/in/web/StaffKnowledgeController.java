package com.anook.backend.knowledge.adapter.in.web;

import com.anook.backend.knowledge.application.dto.request.RegisterKnowledgeFromAnswerCommand;
import com.anook.backend.knowledge.application.dto.response.CreateKnowledgeResult;
import com.anook.backend.knowledge.application.port.in.RegisterKnowledgeFromAnswerUseCase;
import com.anook.backend.knowledge.application.dto.request.ExtractKnowledgeFromChatCommand;
import com.anook.backend.knowledge.application.dto.request.BatchRegisterKnowledgeCommand;
import com.anook.backend.knowledge.application.dto.response.KnowledgeCandidateResult;
import com.anook.backend.knowledge.application.port.in.ExtractKnowledgeFromChatUseCase;
import com.anook.backend.knowledge.application.port.in.BatchRegisterKnowledgeUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
    private final ExtractKnowledgeFromChatUseCase extractKnowledgeFromChatUseCase;
    private final BatchRegisterKnowledgeUseCase batchRegisterKnowledgeUseCase;

    /**
     * 직원 답변 기반 RAG 지식 등록
     *
     * POST /staff/knowledge/register-from-answer
     */
    @PostMapping("/register-from-answer")
    public ResponseEntity<CreateKnowledgeResult> registerFromAnswer(
            @RequestBody RegisterKnowledgeFromAnswerCommand command) {

        CreateKnowledgeResult result = registerKnowledgeFromAnswerUseCase.register(command);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    /**
     * 대화 내역 기반 RAG 지식 추출
     *
     * POST /staff/knowledge/extract-from-chat
     */
    @PostMapping("/extract-from-chat")
    public ResponseEntity<List<KnowledgeCandidateResult>> extractFromChat(
            @RequestBody ExtractKnowledgeFromChatCommand command) {

        List<KnowledgeCandidateResult> result = extractKnowledgeFromChatUseCase.extract(command);
        return ResponseEntity.ok(result);
    }

    /**
     * 추출된 RAG 지식 일괄 등록
     *
     * POST /staff/knowledge/batch-register
     */
    @PostMapping("/batch-register")
    public ResponseEntity<List<CreateKnowledgeResult>> batchRegister(
            @RequestBody BatchRegisterKnowledgeCommand command) {

        List<CreateKnowledgeResult> result = batchRegisterKnowledgeUseCase.registerBatch(command);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }
}
