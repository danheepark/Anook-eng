package com.anook.backend.frontdesk.staff.application.port.out;

/**
 * 역할 조회 포트 — staff 모듈에서 role 존재 여부 확인용
 */
public interface RoleQueryPort {

    boolean existsById(Long roleId);
}
