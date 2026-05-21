package com.anook.backend.knowledge.adapter.in.web;

import com.anook.backend.knowledge.application.dto.request.CreateKnowledgeCommand;
import com.anook.backend.knowledge.application.dto.request.UpdateKnowledgeCommand;
import com.anook.backend.knowledge.application.dto.response.CreateKnowledgeResult;
import com.anook.backend.knowledge.application.dto.response.GetKnowledgeDetailResult;
import com.anook.backend.knowledge.application.dto.response.GetKnowledgeResult;
import com.anook.backend.knowledge.application.port.in.CreateKnowledgeUseCase;
import com.anook.backend.knowledge.application.port.in.DeleteKnowledgeUseCase;
import com.anook.backend.knowledge.application.port.in.GetKnowledgeDetailUseCase;
import com.anook.backend.knowledge.application.port.in.GetKnowledgeListUseCase;
import com.anook.backend.knowledge.application.port.in.UpdateKnowledgeUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/frontdesk/knowledge")
@RequiredArgsConstructor
public class FrontdeskKnowledgeController {

    private final CreateKnowledgeUseCase createKnowledgeUseCase;
    private final GetKnowledgeListUseCase getKnowledgeListUseCase;
    private final GetKnowledgeDetailUseCase getKnowledgeDetailUseCase;
    private final UpdateKnowledgeUseCase updateKnowledgeUseCase;
    private final DeleteKnowledgeUseCase deleteKnowledgeUseCase;

    @PostMapping
    public ResponseEntity<CreateKnowledgeResult> createKnowledge(@RequestBody CreateKnowledgeCommand command) {
        CreateKnowledgeResult result = createKnowledgeUseCase.create(command);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @GetMapping
    public ResponseEntity<List<GetKnowledgeResult>> getKnowledgeList(@RequestParam(required = false) String domain) {
        List<GetKnowledgeResult> result;
        if (domain != null && !domain.trim().isEmpty()) {
            result = getKnowledgeListUseCase.getByDomain(domain);
        } else {
            result = getKnowledgeListUseCase.getAll();
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}")
    public ResponseEntity<GetKnowledgeDetailResult> getKnowledgeDetail(@PathVariable Long id) {
        GetKnowledgeDetailResult result = getKnowledgeDetailUseCase.getById(id);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Void> updateKnowledge(
            @PathVariable Long id,
            @RequestBody UpdateKnowledgeCommand command) {
        
        // ID 일치 여부 확인용 로직 혹은 DTO 직접 주입
        UpdateKnowledgeCommand updateCommand = new UpdateKnowledgeCommand(
                id,
                command.getQuestion(),
                command.getAnswer(),
                command.getDomainCode()
        );
        updateKnowledgeUseCase.update(updateCommand);
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteKnowledge(@PathVariable Long id) {
        deleteKnowledgeUseCase.delete(id);
        return ResponseEntity.noContent().build();
    }
}
