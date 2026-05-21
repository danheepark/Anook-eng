package com.anook.backend.pms.application.service;

import com.anook.backend.global.exception.BusinessException;
import com.anook.backend.global.exception.ErrorCode;
import com.anook.backend.pms.application.dto.request.CreateReceiptCommand;
import com.anook.backend.pms.application.dto.response.GetPmsReceiptResult;
import com.anook.backend.pms.application.port.in.ManagePmsReceiptUseCase;
import com.anook.backend.pms.application.port.out.PmsMenuRepositoryPort;
import com.anook.backend.pms.application.port.out.PmsReceiptRepositoryPort;
import com.anook.backend.pms.domain.model.PmsMenu;
import com.anook.backend.pms.domain.model.PmsReceipt;
import com.anook.backend.global.exchangerate.application.port.in.GetExchangeRateUseCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * PMS 영수증 관리 서비스
 *
 * ❌ JPA Repository 직접 import 금지
 * ✅ Port 인터페이스만 의존
 */
@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class ManagePmsReceiptService implements ManagePmsReceiptUseCase {

    private final PmsReceiptRepositoryPort receiptRepository;
    private final PmsMenuRepositoryPort menuRepository;
    private final GetExchangeRateUseCase exchangeRateUseCase;

    @Override
    public void createReceipt(CreateReceiptCommand command) {
        // 메뉴 존재 확인 + 가격 계산
        PmsMenu menu = menuRepository.findById(command.menuId())
                .orElseThrow(() -> new BusinessException(ErrorCode.MENU_NOT_FOUND, "menuId=" + command.menuId()));

        int totalPrice = menu.price() * command.quantity();

        receiptRepository.save(command.roomNo(), command.menuId(), command.quantity(), totalPrice);
        log.info("[PMS] 영수증 생성: {}호 / {} x{} = {}원",
                command.roomNo(), menu.name(), command.quantity(), totalPrice);
    }

    @Override
    @Transactional(readOnly = true)
    public List<GetPmsReceiptResult> getReceiptsByRoomNo(String roomNo) {
        return receiptRepository.findByRoomNo(roomNo).stream()
                .map(this::toResult)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<GetPmsReceiptResult> getUnpaidReceiptsByRoomNo(String roomNo) {
        return receiptRepository.findUnpaidByRoomNo(roomNo).stream()
                .map(this::toResult)
                .toList();
    }

    @Override
    public void payReceipt(Long receiptId) {
        PmsReceipt receipt = receiptRepository.findById(receiptId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RECEIPT_NOT_FOUND, "receiptId=" + receiptId));

        if ("PAID".equals(receipt.status())) {
            log.warn("[PMS] 이미 결제된 영수증: id={}", receiptId);
            return;
        }

        receiptRepository.updateStatusById(receiptId, "PAID");
        log.info("[PMS] 개별 결제 완료: id={}, {}호 / {} {}원",
                receiptId, receipt.roomNo(), receipt.menuName(), receipt.totalPrice());
    }

    @Override
    public void payAllByRoomNo(String roomNo) {
        receiptRepository.updateStatusByRoomNo(roomNo, "UNPAID", "PAID");
        log.info("[PMS] {}호 전체 일괄 결제 완료", roomNo);
    }

    private GetPmsReceiptResult toResult(PmsReceipt receipt) {
        Double totalPriceUsd = receipt.totalPriceUsd();
        if (totalPriceUsd == null) {
            double krwToUsdRate = exchangeRateUseCase.getKrwToUsdRate();
            totalPriceUsd = receipt.totalPrice() * krwToUsdRate;
        }
        return new GetPmsReceiptResult(
                receipt.id(),
                receipt.roomNo(),
                receipt.menuId(),
                receipt.menuName(),
                receipt.quantity(),
                receipt.totalPrice(),
                totalPriceUsd,
                receipt.status(),
                receipt.createdAt()
        );
    }
}
