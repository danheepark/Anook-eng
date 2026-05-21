package com.anook.backend.security;

import com.anook.backend.security.dto.request.StaffLoginRequest;
import com.anook.backend.security.dto.response.LoginResponse;
import com.anook.backend.staff.application.port.out.StaffRepositoryPort;
import com.anook.backend.staff.domain.model.Staff;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * 직원/관리자 인증 서비스
 * PIN 검증 및 권한 기반 토큰 생성을 담당합니다.
 */
@Service
@Transactional(readOnly = true)
public class StaffAuthService {

    private final StaffRepositoryPort staffRepositoryPort;
    private final JwtProvider jwtProvider;

    public StaffAuthService(@Qualifier("staffPersistenceAdapter") StaffRepositoryPort staffRepositoryPort, JwtProvider jwtProvider) {
        this.staffRepositoryPort = staffRepositoryPort;
        this.jwtProvider = jwtProvider;
    }

    /**
     * PIN 번호로 직원을 조회하고 인증을 수행합니다.
     */
    @Transactional
    public LoginResponse login(StaffLoginRequest request) {
        // 1. PIN 번호로 직원 조회
        Staff staff = staffRepositoryPort.findByPin(request.pin())
                .orElseThrow(() -> new com.anook.backend.global.exception.BusinessException(
                        com.anook.backend.global.exception.ErrorCode.GUEST_NOT_FOUND)); // 임시로 NOT_FOUND 계열 사용

        // 2. 부서의 isFrontdesk 여부에 따라 권한(Role) 결정
        String role = staff.getDepartment().isFrontdesk() ? "FRONTDESK" : "STAFF";

        // 3. 중복 로그인 방지를 위한 새로운 JTI 생성
        String jti = UUID.randomUUID().toString();

        // 4. DB에 JTI 업데이트 (동일 PIN 다중 접속 제한의 핵심)
        // staff 도메인 모델에 jti를 설정하고 저장 (도메인이 불변이므로 새로 생성)
        Staff updatedStaff = Staff.builder()
                .id(staff.getId())
                .name(staff.getName())
                .pin(staff.getPin())
                .roleId(staff.getRoleId())
                .department(staff.getDepartment())
                .jti(jti)
                .build();
        staffRepositoryPort.save(updatedStaff);

        // 5. JWT 토큰 생성 (JTI 포함)
        String token = jwtProvider.generateToken(staff.getId().toString(), role, jti);

        // 6. 최종 응답 생성
        return new LoginResponse(
                token,
                role,
                staff.getName(),
                staff.getDepartment().getName(),
                staff.getDepartment().getId(),
                null // roomNo는 직원 로그인에서 사용 안 함
        );
    }
}
