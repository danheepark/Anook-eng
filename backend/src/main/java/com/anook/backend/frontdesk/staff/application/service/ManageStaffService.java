package com.anook.backend.frontdesk.staff.application.service;

import com.anook.backend.frontdesk.staff.application.dto.request.CreateStaffCommand;
import com.anook.backend.frontdesk.staff.application.dto.request.UpdateStaffCommand;
import com.anook.backend.frontdesk.staff.application.dto.response.GetStaffResult;
import com.anook.backend.frontdesk.staff.application.port.in.ManageStaffUseCase;
import com.anook.backend.frontdesk.staff.application.port.out.DepartmentQueryPort;
import com.anook.backend.frontdesk.staff.application.port.out.RoleQueryPort;
import com.anook.backend.frontdesk.staff.application.port.out.StaffRepositoryPort;
import com.anook.backend.frontdesk.staff.domain.model.Staff;
import com.anook.backend.global.exception.BusinessException;
import com.anook.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 직원 관리 서비스 — ManageStaffUseCase 구현체
 *
 * Port(Out)만 의존, JPA Repository 직접 import 금지
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ManageStaffService implements ManageStaffUseCase {

    private final StaffRepositoryPort staffRepositoryPort;
    private final DepartmentQueryPort departmentQueryPort;
    private final RoleQueryPort roleQueryPort;

    @Override
    @Transactional
    public GetStaffResult create(CreateStaffCommand command) {
        validateDepartmentExists(command.departmentId());
        validateRoleExists(command.roleId());

        // 1. 중복되지 않는 PIN 번호 생성 (최대 10번 재시도)
        String pin = generateUniquePin();

        // 2. 직원 도메인 모델 생성 및 저장 (초기 생성 시 JTI는 null)
        Staff staff = new Staff(null, command.name(), pin,
                command.roleId(), command.departmentId(), null);
        Staff saved = staffRepositoryPort.save(staff);

        return GetStaffResult.from(saved);
    }

    /**
     * 중복되지 않는 6자리 PIN 번호를 생성합니다.
     * 최대 10번까지 재시도하며, 실패 시 예외를 던집니다.
     */
    private String generateUniquePin() {
        int maxRetries = 10;
        for (int i = 0; i < maxRetries; i++) {
            String pin = generatePin();
            // DB에 해당 PIN이 존재하는지 확인 (Port 사용)
            if (!staffRepositoryPort.existsByPin(pin)) {
                return pin; // 중복되지 않으면 반환
            }
        }
        // 10번 시도 후에도 중복이면 비즈니스 예외 발생
        throw new BusinessException(ErrorCode.DUPLICATE_PIN);
    }

    @Override
    public List<GetStaffResult> getAll() {
        return staffRepositoryPort.findAll().stream()
                .map(GetStaffResult::from)
                .toList();
    }

    @Override
    public GetStaffResult getById(Long id) {
        Staff staff = findStaffOrThrow(id);
        return GetStaffResult.from(staff);
    }

    @Override
    public List<GetStaffResult> getByDepartmentId(String departmentId) {
        return staffRepositoryPort.findByDepartmentId(departmentId).stream()
                .map(GetStaffResult::from)
                .toList();
    }

    @Override
    @Transactional
    public GetStaffResult update(Long id, UpdateStaffCommand command) {
        Staff existing = findStaffOrThrow(id);

        // 부서 변경 시 존재 여부 확인
        String departmentId = command.departmentId() != null
                ? command.departmentId() : existing.getDepartmentId();
        if (command.departmentId() != null) {
            validateDepartmentExists(departmentId);
        }
        // 역할 변경 시 존재 여부 확인
        if (command.roleId() != null) {
            validateRoleExists(command.roleId());
        }

        Staff updated = new Staff(
                id,
                command.name() != null ? command.name() : existing.getName(),
                existing.getPin(),
                command.roleId() != null ? command.roleId() : existing.getRoleId(),
                departmentId,
                existing.getJti() // 기존 세션 식별자(JTI) 유지
        );

        Staff saved = staffRepositoryPort.save(updated);
        return GetStaffResult.from(saved);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        if (!staffRepositoryPort.existsById(id)) {
            throw new BusinessException(ErrorCode.STAFF_NOT_FOUND);
        }
        staffRepositoryPort.deleteById(id);
    }

    private Staff findStaffOrThrow(Long id) {
        return staffRepositoryPort.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.STAFF_NOT_FOUND));
    }

    private void validateDepartmentExists(String departmentId) {
        if (!departmentQueryPort.existsById(departmentId)) {
            throw new BusinessException(ErrorCode.DEPARTMENT_NOT_FOUND);
        }
    }

    private void validateRoleExists(Long roleId) {
        if (!roleQueryPort.existsById(roleId)) {
            throw new BusinessException(ErrorCode.ROLE_NOT_FOUND);
        }
    }

    /**
     * 6자리 숫자 PIN 자동 생성
     */
    private String generatePin() {
        int pin = ThreadLocalRandom.current().nextInt(100_000, 1_000_000);
        return String.valueOf(pin);
    }
}
