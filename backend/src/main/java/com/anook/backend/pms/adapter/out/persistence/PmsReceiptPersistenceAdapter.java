package com.anook.backend.pms.adapter.out.persistence;

import com.anook.backend.pms.application.port.out.PmsReceiptRepositoryPort;
import com.anook.backend.pms.domain.model.PmsReceipt;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/**
 * PMS 영수증 Persistence Adapter
 *
 * pms_receipt 테이블 CRUD (JdbcTemplate 사용).
 * 메뉴명은 pms_menu JOIN으로 함께 조회.
 */
@Component
@RequiredArgsConstructor
public class PmsReceiptPersistenceAdapter implements PmsReceiptRepositoryPort {

    private final JdbcTemplate jdbcTemplate;

    private static final String SELECT_WITH_MENU = """
            SELECT r.id, r.room_no, r.menu_id, m.name AS menu_name,
                   r.quantity, r.total_price, m.price_usd AS unit_price_usd,
                   r.status, r.created_at
            FROM pms_receipt r
            JOIN pms_menu m ON r.menu_id = m.id
            """;

    private static final RowMapper<PmsReceipt> RECEIPT_ROW_MAPPER = (rs, rowNum) -> {
        double priceUsd = rs.getDouble("unit_price_usd");
        Double totalPriceUsd = rs.wasNull() ? null : priceUsd * rs.getInt("quantity");
        return new PmsReceipt(
                rs.getLong("id"),
                rs.getString("room_no"),
                rs.getLong("menu_id"),
                rs.getString("menu_name"),
                rs.getInt("quantity"),
                rs.getInt("total_price"),
                totalPriceUsd,
                rs.getString("status"),
                rs.getTimestamp("created_at").toLocalDateTime()
        );
    };

    @Override
    public void save(String roomNo, Long menuId, int quantity, int totalPrice) {
        jdbcTemplate.update(
                "INSERT INTO pms_receipt (room_no, menu_id, quantity, total_price, status) VALUES (?, ?, ?, ?, 'UNPAID')",
                roomNo, menuId, quantity, totalPrice
        );
    }

    @Override
    public List<PmsReceipt> findByRoomNo(String roomNo) {
        return jdbcTemplate.query(
                SELECT_WITH_MENU + "WHERE r.room_no = ? ORDER BY r.created_at DESC",
                RECEIPT_ROW_MAPPER,
                roomNo
        );
    }

    @Override
    public List<PmsReceipt> findUnpaidByRoomNo(String roomNo) {
        return jdbcTemplate.query(
                SELECT_WITH_MENU + "WHERE r.room_no = ? AND r.status = 'UNPAID' ORDER BY r.created_at DESC",
                RECEIPT_ROW_MAPPER,
                roomNo
        );
    }

    @Override
    public Optional<PmsReceipt> findById(Long id) {
        List<PmsReceipt> results = jdbcTemplate.query(
                SELECT_WITH_MENU + "WHERE r.id = ?",
                RECEIPT_ROW_MAPPER,
                id
        );
        return results.stream().findFirst();
    }

    @Override
    public boolean hasUnpaidReceipts(String roomNo) {
        Long count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM pms_receipt WHERE room_no = ? AND status = 'UNPAID'",
                Long.class,
                roomNo
        );
        return count != null && count > 0;
    }

    @Override
    public void updateStatusById(Long id, String status) {
        jdbcTemplate.update(
                "UPDATE pms_receipt SET status = ? WHERE id = ?",
                status, id
        );
    }

    @Override
    public void updateStatusByRoomNo(String roomNo, String fromStatus, String toStatus) {
        jdbcTemplate.update(
                "UPDATE pms_receipt SET status = ? WHERE room_no = ? AND status = ?",
                toStatus, roomNo, fromStatus
        );
    }
}
