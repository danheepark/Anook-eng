package com.anook.backend.fb.adapter.out.persistence;

import com.anook.backend.fb.application.dto.response.MenuInfo;
import com.anook.backend.fb.application.port.out.MenuQueryPort;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class MenuQueryAdapter implements MenuQueryPort {

    private final JdbcTemplate jdbcTemplate;

    private final RowMapper<MenuInfo> menuInfoRowMapper = (rs, rowNum) -> {
        double priceUsd = rs.getDouble("price_usd");
        Double priceUsdObj = rs.wasNull() ? null : priceUsd;
        return new MenuInfo(
                rs.getLong("id"),
                rs.getString("name"),
                rs.getInt("price"),
                priceUsdObj,
                rs.getString("category"),
                rs.getString("allergens"),
                rs.getString("options")
        );
    };

    @Override
    public List<MenuInfo> findAvailableMenus() {
        String sql = "SELECT id, name, price, price_usd, category, allergens, options FROM pms_menu WHERE available = TRUE";
        return jdbcTemplate.query(sql, menuInfoRowMapper);
    }

    @Override
    public Optional<MenuInfo> findById(Long menuId) {
        String sql = "SELECT id, name, price, price_usd, category, allergens, options FROM pms_menu WHERE id = ?";
        List<MenuInfo> results = jdbcTemplate.query(sql, menuInfoRowMapper, menuId);
        return results.stream().findFirst();
    }
}
