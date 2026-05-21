package com.anook.backend.pms.adapter.out.persistence;

import com.anook.backend.pms.application.port.out.PmsMenuRepositoryPort;
import com.anook.backend.pms.domain.model.PmsMenu;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;
import java.util.Optional;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.anook.backend.pms.domain.model.MenuOptionGroup;

/**
 * PMS 메뉴 Persistence Adapter
 *
 * pms_menu 테이블 조회 (JdbcTemplate 사용).
 */
@Component
@RequiredArgsConstructor
public class PmsMenuPersistenceAdapter implements PmsMenuRepositoryPort {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    private RowMapper<PmsMenu> getRowMapper() {
        return (rs, rowNum) -> {
            String optionsJson = rs.getString("options");
            List<MenuOptionGroup> optionsList = Collections.emptyList();
            if (optionsJson != null && !optionsJson.isBlank()) {
                try {
                    optionsList = objectMapper.readValue(optionsJson, new TypeReference<>() {});
                } catch (Exception e) {
                    // JSON parsing error -> return empty list safely
                }
            }
            double priceUsd = rs.getDouble("price_usd");
            Double priceUsdObj = rs.wasNull() ? null : priceUsd;
            return new PmsMenu(
                    rs.getLong("id"),
                    rs.getString("name"),
                    rs.getInt("price"),
                    priceUsdObj,
                    rs.getString("category"),
                    rs.getString("allergens"),
                    optionsList,
                    rs.getBoolean("available")
            );
        };
    }

    @Override
    public List<PmsMenu> findAllAvailable() {
        return jdbcTemplate.query(
                "SELECT id, name, price, price_usd, category, allergens, options, available FROM pms_menu WHERE available = TRUE ORDER BY category, name",
                getRowMapper()
        );
    }

    @Override
    public List<PmsMenu> findAll() {
        return jdbcTemplate.query(
                "SELECT id, name, price, price_usd, category, allergens, options, available FROM pms_menu ORDER BY category, name",
                getRowMapper()
        );
    }

    @Override
    public Optional<PmsMenu> findById(Long id) {
        List<PmsMenu> results = jdbcTemplate.query(
                "SELECT id, name, price, price_usd, category, allergens, options, available FROM pms_menu WHERE id = ?",
                getRowMapper(),
                id
        );
        return results.stream().findFirst();
    }
}
