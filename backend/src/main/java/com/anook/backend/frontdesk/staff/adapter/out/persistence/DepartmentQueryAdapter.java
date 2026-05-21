package com.anook.backend.frontdesk.staff.adapter.out.persistence;

import com.anook.backend.frontdesk.department.application.dto.response.DepartmentInfo;
import com.anook.backend.frontdesk.staff.application.port.out.DepartmentQueryPort;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * DepartmentQueryPort 구현체 — JdbcTemplate 읽기 전용 조회
 *
 * 다른 모듈(department)의 JPA Entity/Repository를 import하지 않고,
 * 네이티브 쿼리로 department 테이블을 직접 조회합니다.
 */
@Component
@RequiredArgsConstructor
public class DepartmentQueryAdapter implements DepartmentQueryPort {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public boolean existsById(String departmentId) {
        String sql = "SELECT COUNT(*) FROM department WHERE id = ?";
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, departmentId);
        return count != null && count > 0;
    }

    @Override
    public List<DepartmentInfo> findAll() {
        String sql = "SELECT id, name FROM department ORDER BY id";
        return jdbcTemplate.query(sql, (rs, rowNum) ->
                new DepartmentInfo(rs.getString("id"), rs.getString("name")));
    }
}
