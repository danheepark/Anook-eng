package com.anook.backend.pms.adapter.in.web;

import com.anook.backend.pms.application.dto.request.CreateReceiptCommand;
import com.anook.backend.pms.application.dto.response.GetPmsReceiptResult;
import com.anook.backend.pms.application.port.in.ManagePmsReceiptUseCase;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * PMS 영수증 Controller
 *
 * POST   /pms/receipts                    주문 내역 생성
 * GET    /pms/receipts?roomNo=xxx         객실별 영수증 조회 (unpaid 필터 옵션)
 * PATCH  /pms/receipts/{id}/pay           개별 결제
 * PATCH  /pms/receipts/pay-all?roomNo=xxx 객실 전체 일괄 결제
 */
@RestController
@RequestMapping("/pms/receipts")
@RequiredArgsConstructor
public class PmsReceiptController {

    private final ManagePmsReceiptUseCase managePmsReceiptUseCase;

    @PostMapping
    public ResponseEntity<Void> createReceipt(@RequestBody CreateReceiptCommand command) {
        managePmsReceiptUseCase.createReceipt(command);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    @GetMapping
    public ResponseEntity<List<GetPmsReceiptResult>> getReceipts(
            @RequestParam(required = false) String roomNo,
            @RequestParam(name = "unpaid", required = false) Boolean unpaidOnly) {

        if (roomNo == null || roomNo.isBlank()) {
            return ResponseEntity.ok(List.of());
        }

        List<GetPmsReceiptResult> receipts;
        if (Boolean.TRUE.equals(unpaidOnly)) {
            receipts = managePmsReceiptUseCase.getUnpaidReceiptsByRoomNo(roomNo);
        } else {
            receipts = managePmsReceiptUseCase.getReceiptsByRoomNo(roomNo);
        }
        return ResponseEntity.ok(receipts);
    }

    @PatchMapping("/{id}/pay")
    public ResponseEntity<Void> payReceipt(@PathVariable Long id) {
        managePmsReceiptUseCase.payReceipt(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/pay-all")
    public ResponseEntity<Void> payAll(@RequestParam(required = false) String roomNo) {
        if (roomNo != null && !roomNo.isBlank()) {
            managePmsReceiptUseCase.payAllByRoomNo(roomNo);
        }
        return ResponseEntity.noContent().build();
    }
}
