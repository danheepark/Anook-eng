package com.anook.backend.frontdesk.role.adapter.in.web;

import com.anook.backend.frontdesk.role.application.dto.request.CreateRoleCommand;
import com.anook.backend.frontdesk.role.application.dto.request.UpdateRoleCommand;
import com.anook.backend.frontdesk.role.application.dto.response.GetRoleResult;
import com.anook.backend.frontdesk.role.application.port.in.ManageRoleUseCase;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/frontdesk/roles")
@RequiredArgsConstructor
public class FrontdeskRoleController {

    private final ManageRoleUseCase manageRoleUseCase;

    @PostMapping
    public ResponseEntity<GetRoleResult> create(@Valid @RequestBody CreateRoleCommand command) {
        return ResponseEntity.status(HttpStatus.CREATED).body(manageRoleUseCase.create(command));
    }

    @GetMapping
    public ResponseEntity<List<GetRoleResult>> getAll() {
        return ResponseEntity.ok(manageRoleUseCase.getAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<GetRoleResult> getById(@PathVariable Long id) {
        return ResponseEntity.ok(manageRoleUseCase.getById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<GetRoleResult> update(
            @PathVariable Long id, @Valid @RequestBody UpdateRoleCommand command) {
        return ResponseEntity.ok(manageRoleUseCase.update(id, command));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        manageRoleUseCase.delete(id);
        return ResponseEntity.noContent().build();
    }
}
