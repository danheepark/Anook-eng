package com.anook.backend.frontdesk.staff.adapter.out.persistence;

import com.anook.backend.frontdesk.staff.application.port.out.RoleQueryPort;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class RoleQueryAdapter implements RoleQueryPort {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public boolean existsById(Long roleId) {
        String sql = "SELECT COUNT(*) FROM staff_role WHERE id = ?";
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, roleId);
        return count != null && count > 0;
    }
}
