package com.anook.backend.frontdesk.role.application.service;

import com.anook.backend.frontdesk.role.application.dto.request.CreateRoleCommand;
import com.anook.backend.frontdesk.role.application.dto.request.UpdateRoleCommand;
import com.anook.backend.frontdesk.role.application.dto.response.GetRoleResult;
import com.anook.backend.frontdesk.role.application.port.in.ManageRoleUseCase;
import com.anook.backend.frontdesk.role.application.port.out.RoleRepositoryPort;
import com.anook.backend.frontdesk.role.domain.model.Role;
import com.anook.backend.global.exception.BusinessException;
import com.anook.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ManageRoleService implements ManageRoleUseCase {

    private final RoleRepositoryPort roleRepositoryPort;

    @Override
    @Transactional
    public GetRoleResult create(CreateRoleCommand command) {
        if (roleRepositoryPort.existsByName(command.name())) {
            throw new BusinessException(ErrorCode.ROLE_ALREADY_EXISTS);
        }
        Role role = new Role(null, command.departmentId(), command.name());
        return GetRoleResult.from(roleRepositoryPort.save(role));
    }

    @Override
    public List<GetRoleResult> getAll() {
        return roleRepositoryPort.findAll().stream()
                .map(GetRoleResult::from)
                .toList();
    }

    @Override
    public GetRoleResult getById(Long id) {
        Role role = roleRepositoryPort.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.ROLE_NOT_FOUND));
        return GetRoleResult.from(role);
    }

    @Override
    @Transactional
    public GetRoleResult update(Long id, UpdateRoleCommand command) {
        if (!roleRepositoryPort.existsById(id)) {
            throw new BusinessException(ErrorCode.ROLE_NOT_FOUND);
        }
        Role updated = new Role(id, command.departmentId(), command.name());
        return GetRoleResult.from(roleRepositoryPort.save(updated));
    }

    @Override
    @Transactional
    public void delete(Long id) {
        if (!roleRepositoryPort.existsById(id)) {
            throw new BusinessException(ErrorCode.ROLE_NOT_FOUND);
        }
        roleRepositoryPort.deleteById(id);
    }
}
