package com.anook.backend.frontdesk.staff.adapter.in.web;

import com.anook.backend.frontdesk.staff.application.dto.request.CreateStaffCommand;
import com.anook.backend.frontdesk.staff.application.dto.request.UpdateStaffCommand;
import com.anook.backend.frontdesk.staff.application.dto.response.GetStaffResult;
import com.anook.backend.frontdesk.staff.application.port.in.ManageStaffUseCase;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 관리자 직원 관리 Controller
 *
 * UseCase 인터페이스에만 의존 — 비즈니스 로직 없음
 */
@RestController
@RequestMapping("/frontdesk/staff")
@RequiredArgsConstructor
public class FrontdeskStaffController {

    private final ManageStaffUseCase manageStaffUseCase;

    @PostMapping
    public ResponseEntity<GetStaffResult> create(@Valid @RequestBody CreateStaffCommand command) {
        GetStaffResult result = manageStaffUseCase.create(command);
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @GetMapping
    public ResponseEntity<List<GetStaffResult>> getAll(
            @RequestParam(required = false) String departmentId) {
        if (departmentId != null) {
            return ResponseEntity.ok(manageStaffUseCase.getByDepartmentId(departmentId));
        }
        return ResponseEntity.ok(manageStaffUseCase.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<GetStaffResult> getById(@PathVariable Long id) {
        return ResponseEntity.ok(manageStaffUseCase.getById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<GetStaffResult> update(
            @PathVariable Long id,
            @Valid @RequestBody UpdateStaffCommand command) {
        return ResponseEntity.ok(manageStaffUseCase.update(id, command));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        manageStaffUseCase.delete(id);
        return ResponseEntity.noContent().build();
    }
}
