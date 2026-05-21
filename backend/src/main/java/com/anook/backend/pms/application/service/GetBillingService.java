package com.anook.backend.pms.application.service;

import com.anook.backend.global.exchangerate.application.port.in.GetExchangeRateUseCase;
import com.anook.backend.pms.application.dto.response.BillingItemResult;
import com.anook.backend.pms.application.dto.response.GetBillingSummaryResult;
import com.anook.backend.pms.application.port.in.GetBillingUseCase;
import com.anook.backend.pms.application.port.out.PmsMenuRepositoryPort;
import com.anook.backend.pms.application.port.out.PmsReceiptRepositoryPort;
import com.anook.backend.pms.domain.model.PmsMenu;
import com.anook.backend.pms.domain.model.PmsReceipt;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GetBillingService implements GetBillingUseCase {

    private static final double TAX_RATE = 0.10;
    private static final double SERVICE_CHARGE_RATE = 0.10;

    private final PmsReceiptRepositoryPort receiptRepositoryPort;
    private final PmsMenuRepositoryPort menuRepositoryPort;
    private final GetExchangeRateUseCase exchangeRate;

    @Override
    public GetBillingSummaryResult getBillingSummary(String roomNo, String category, String language) {
        List<PmsReceipt> receipts = receiptRepositoryPort.findByRoomNo(roomNo);

        Map<Long, PmsMenu> menuMap = menuRepositoryPort.findAll().stream()
                .collect(Collectors.toMap(PmsMenu::id, m -> m));

        String resolvedCategory = (category == null || category.isBlank()) ? "ALL" : category.toUpperCase();
        
        boolean isKorean = "ko".equalsIgnoreCase(language);
        double krwToUsd = exchangeRate.getKrwToUsdRate();
        String targetCurrency = isKorean ? "KRW" : "USD";

        List<BillingItemResult> items = receipts.stream()
                .filter(r -> {
                    if ("ALL".equals(resolvedCategory)) return true;
                    String itemCategory = getCategory(r, menuMap).toUpperCase();
                    if ("FB".equals(resolvedCategory) || "ROOM_SERVICE".equals(resolvedCategory)) {
                        return List.of("MAIN", "SIDE", "DRINK", "DESSERT").contains(itemCategory);
                    }
                    if ("HK".equals(resolvedCategory)) {
                        return itemCategory.startsWith("HK_");
                    }
                    return resolvedCategory.equals(itemCategory);
                })
                .map(r -> {
                    PmsMenu menu = menuMap.get(r.menuId());
                    String cat = menu != null ? menu.category() : "UNKNOWN";

                    double unitPriceKrw = menu != null ? menu.price() : 0.0;
                    double totalPriceKrw = r.totalPrice();

                    double unitPriceUsd;
                    double totalPriceUsd;
                    if (menu != null && menu.priceUsd() != null) {
                        unitPriceUsd = menu.priceUsd();
                        totalPriceUsd = r.totalPriceUsd() != null ? r.totalPriceUsd() : round2(unitPriceUsd * r.quantity());
                    } else {
                        unitPriceUsd = round2(unitPriceKrw * krwToUsd);
                        totalPriceUsd = round2(totalPriceKrw * krwToUsd);
                    }

                    double unitPrice = isKorean ? unitPriceKrw : unitPriceUsd;
                    double totalPrice = isKorean ? totalPriceKrw : totalPriceUsd;

                    return new BillingItemResult(
                            r.menuName(),
                            cat,
                            r.quantity(),
                            unitPrice,
                            totalPrice,
                            unitPriceKrw,
                            totalPriceKrw,
                            unitPriceUsd,
                            totalPriceUsd,
                            r.createdAt().toString()
                    );
                })
                .toList();

        double subtotalKrw = items.stream().mapToDouble(BillingItemResult::totalPriceKrw).sum();
        double taxKrw = round2(subtotalKrw * TAX_RATE);
        double serviceChargeKrw = round2(subtotalKrw * SERVICE_CHARGE_RATE);
        double totalAmountKrw = subtotalKrw + taxKrw + serviceChargeKrw;

        double subtotalUsd = round2(items.stream().mapToDouble(BillingItemResult::totalPriceUsd).sum());
        double taxUsd = round2(subtotalUsd * TAX_RATE);
        double serviceChargeUsd = round2(subtotalUsd * SERVICE_CHARGE_RATE);
        double totalAmountUsd = round2(subtotalUsd + taxUsd + serviceChargeUsd);

        double subtotal = isKorean ? subtotalKrw : subtotalUsd;
        double tax = isKorean ? taxKrw : taxUsd;
        double serviceCharge = isKorean ? serviceChargeKrw : serviceChargeUsd;
        double totalAmount = isKorean ? totalAmountKrw : totalAmountUsd;

        double currentExchangeRate = exchangeRate.getUsdToKrwRate();

        return new GetBillingSummaryResult(
                roomNo,
                resolvedCategory,
                items,
                subtotal,
                tax,
                serviceCharge,
                totalAmount,
                targetCurrency,
                subtotalKrw,
                subtotalUsd,
                taxKrw,
                taxUsd,
                serviceChargeKrw,
                serviceChargeUsd,
                totalAmountKrw,
                totalAmountUsd,
                currentExchangeRate
        );
    }

    private String getCategory(PmsReceipt receipt, Map<Long, PmsMenu> menuMap) {
        PmsMenu menu = menuMap.get(receipt.menuId());
        return menu != null ? menu.category() : "";
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
