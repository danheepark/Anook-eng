package com.anook.backend.pms.application.service;
 
import com.anook.backend.pms.application.port.in.GenerateReceiptUseCase;
import com.anook.backend.pms.application.port.out.PmsMenuRepositoryPort;
import com.anook.backend.pms.application.port.out.PmsReceiptRepositoryPort;
import com.anook.backend.pms.domain.model.PmsMenu;
import com.anook.backend.room.application.service.RoomInventoryService;
import com.anook.backend.room.application.service.InventoryPolicyProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
 
import java.util.List;
import java.util.Map;
 
/**
 * 통합 영수증 생성 서비스 — 모든 부서의 유료 서비스를 통합 처리
 *
 * 이벤트를 제거하고 UseCase를 직접 호출하는 방식으로 리팩토링 되었습니다.
 * 해당 요청의 엔티티(entities)에서 유료 항목(pms_menu에 존재하는 항목)을 추출하고 영수증(pms_receipt)을 생성합니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GenerateReceiptService implements GenerateReceiptUseCase {
 
    private final PmsMenuRepositoryPort menuRepository;
    private final PmsReceiptRepositoryPort receiptRepository;
    private final RoomInventoryService roomInventoryService;
    private final InventoryPolicyProperties policyProperties;
 
    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void generate(String roomNo, String departmentId, Map<String, Object> entities) {
        if (entities == null) {
            return;
        }
 
        // FB 룸서비스: entities.menu_items 기반 영수증 생성
        if ("FB".equals(departmentId)) {
            handleFbReceipt(roomNo, entities);
        }
        // HK 부서: entities.items 파싱하여 초과분 영수증 생성
        else if ("HK".equals(departmentId)) {
            handleHkReceipt(roomNo, entities);
        }
        // 기타 부서: entities.REQ_ITEM 기반 영수증 생성
        else {
            handleGenericReceipt(roomNo, departmentId, entities);
        }
    }

    /**
     * FB 룸서비스 영수증 처리 — menu_items 배열 기반
     */
    @SuppressWarnings("unchecked")
    private void handleFbReceipt(String roomNo, Map<String, Object> entities) {
        if (!"ROOM_SERVICE".equals(entities.get("intent"))) {
            return;
        }

        List<Map<String, Object>> menuItems = (List<Map<String, Object>>) entities.get("menu_items");
        if (menuItems == null || menuItems.isEmpty()) {
            log.info("[Billing] {}호 FB 완료 — 메뉴 항목 없음, 영수증 생략", roomNo);
            return;
        }

        List<PmsMenu> allMenus = menuRepository.findAll();

        for (Map<String, Object> item : menuItems) {
            String name = (String) item.get("name");
            int quantity = (item.get("quantity") instanceof Number)
                    ? ((Number) item.get("quantity")).intValue() : 1;

            allMenus.stream()
                    .filter(m -> m.name().equals(name))
                    .findFirst()
                    .ifPresentOrElse(menu -> {
                        int totalPrice = menu.price() * quantity;
                        receiptRepository.save(roomNo, menu.id(), quantity, totalPrice);
                        log.info("[Billing] FB 영수증 생성: {}호 / {} x{} = {}원",
                                roomNo, menu.name(), quantity, totalPrice);
                    }, () -> {
                        log.warn("[Billing] FB 메뉴 '{}'를 PMS에서 찾을 수 없어 영수증 생략", name);
                    });
        }
    }

    /**
     * HK 및 기타 부서 유료 서비스 영수증 처리 — REQ_ITEM 기반
     */
    @SuppressWarnings("unchecked")
    private void handleGenericReceipt(String roomNo, String departmentId, Map<String, Object> entities) {
        Object reqItemObj = entities.get("REQ_ITEM");
        if (reqItemObj == null) {
            return;
        }

        List<String> reqItems;
        if (reqItemObj instanceof List<?> list) {
            reqItems = list.stream().map(Object::toString).toList();
        } else if (reqItemObj instanceof String str) {
            reqItems = List.of(str);
        } else {
            return;
        }

        // 수량 추출
        int quantity = 1;
        Object qtyObj = entities.get("qty");
        if (qtyObj == null) qtyObj = entities.get("quantity");
        if (qtyObj instanceof Number num) {
            quantity = num.intValue();
        }

        List<PmsMenu> allMenus = menuRepository.findAll();

        for (String itemName : reqItems) {
            String trimmedName = itemName.trim();
            int finalQuantity = quantity;

            allMenus.stream()
                    .filter(m -> m.name().contains(trimmedName) || trimmedName.contains(m.name()))
                    .findFirst()
                    .ifPresent(menu -> {
                        int totalPrice = menu.price() * finalQuantity;
                        receiptRepository.save(roomNo, menu.id(), finalQuantity, totalPrice);
                        log.info("[Billing] {} 영수증 생성: {}호 / {} x{} = {}원",
                                departmentId, roomNo,
                                menu.name(), finalQuantity, totalPrice);
                    });
        }
    }

    /**
     * HK 부서의 유료 서비스 영수증 처리 — Redis와 인벤토리 정책 활용
     */
    @SuppressWarnings("unchecked")
    private void handleHkReceipt(String roomNo, Map<String, Object> entities) {
        List<Map<String, Object>> items = (List<Map<String, Object>>) entities.get("items");
        if (items == null || items.isEmpty()) {
            return;
        }

        // 전체 PMS 메뉴 조회
        List<PmsMenu> allMenus = menuRepository.findAll();

        for (Map<String, Object> item : items) {
            String name = (String) item.get("item");
            int quantity = (item.get("count") instanceof Number)
                    ? ((Number) item.get("count")).intValue() : 1;

            if (name == null || quantity <= 0) continue;

            for (InventoryPolicyProperties.PolicyItem policy : policyProperties.getPolicies()) {
                boolean matched = false;
                for (String alias : policy.getAliases()) {
                    if (name.equalsIgnoreCase(policy.getCode()) || name.toLowerCase().contains(alias.toLowerCase())) {
                        matched = true;
                        break;
                    }
                }

                if (matched) {
                    // Redis에서 현재 사용량 조회
                    Map<String, Integer> inventory = roomInventoryService.getInventory(roomNo);
                    String usedKey = "free_" + policy.getCode().toLowerCase() + "_used";
                    int currentUsed = inventory.getOrDefault(usedKey, 0);
                    int allowance = policy.getAllowance();

                    // 초과분 계산: 이번 주문에서 추가된 물량(quantity) 중에서 무료 제공량을 초과하는 부분
                    int prevUsed = Math.max(0, currentUsed - quantity);
                    int chargeableQty = 0;

                    if (prevUsed >= allowance) {
                        chargeableQty = quantity;
                    } else if (currentUsed > allowance) {
                        chargeableQty = currentUsed - allowance;
                    }

                    if (chargeableQty > 0) {
                        int finalChargeableQty = chargeableQty;
                        // pms_menu에서 이름 매칭 (예: "생수 추가", "추가 수건")
                        allMenus.stream()
                                .filter(m -> m.name().contains(policy.getAliases().get(0)) || policy.getAliases().get(0).contains(m.name()))
                                .findFirst()
                                .ifPresentOrElse(menu -> {
                                    int totalPrice = menu.price() * finalChargeableQty;
                                    receiptRepository.save(roomNo, menu.id(), finalChargeableQty, totalPrice);
                                    log.info("[Billing] HK 초과 영수증 생성: {}호 / {} x{} = {}원",
                                            roomNo, menu.name(), finalChargeableQty, totalPrice);
                                }, () -> {
                                    log.warn("[Billing] HK 메뉴 '{}'에 해당하는 PMS 메뉴를 찾을 수 없음", policy.getCode());
                                });
                    }
                    break;
                }
            }
        }
    }
}
