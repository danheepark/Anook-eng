package com.anook.backend.pms.application.service;

import com.anook.backend.global.exception.BusinessException;
import com.anook.backend.global.exception.ErrorCode;
import com.anook.backend.global.exchangerate.application.port.in.GetExchangeRateUseCase;
import com.anook.backend.pms.application.dto.response.GetPmsMenuResult;
import com.anook.backend.pms.application.port.in.GetPmsMenuUseCase;
import com.anook.backend.pms.application.port.out.PmsMenuRepositoryPort;
import com.anook.backend.pms.domain.model.PmsMenu;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * PMS 메뉴 조회 서비스
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GetPmsMenuService implements GetPmsMenuUseCase {

    private final PmsMenuRepositoryPort menuRepository;
    private final GetExchangeRateUseCase exchangeRate;

    @Override
    public List<GetPmsMenuResult> getAllMenus() {
        return menuRepository.findAll().stream()
                .map(this::toResult)
                .toList();
    }

    @Override
    public List<GetPmsMenuResult> getAvailableMenus() {
        return menuRepository.findAllAvailable().stream()
                .map(this::toResult)
                .toList();
    }

    @Override
    public GetPmsMenuResult getMenuById(Long id) {
        PmsMenu menu = menuRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.MENU_NOT_FOUND, "menuId=" + id));
        return toResult(menu);
    }

    private GetPmsMenuResult toResult(PmsMenu menu) {
        Double usd = menu.priceUsd();
        if (usd == null) {
            double rate = exchangeRate.getUsdToKrwRate();
            usd = Math.round((menu.price() / rate) * 100.0) / 100.0;
        }
        return new GetPmsMenuResult(
                menu.id(),
                menu.name(),
                menu.price(),
                usd,
                menu.category(),
                menu.allergens(),
                menu.options(),
                menu.available()
        );
    }
}
