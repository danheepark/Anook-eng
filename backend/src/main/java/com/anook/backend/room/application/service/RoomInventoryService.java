package com.anook.backend.room.application.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class RoomInventoryService {

    private final StringRedisTemplate redisTemplate;
    private final InventoryPolicyProperties policyProperties;

    private static final String REDIS_KEY_PREFIX = "room:inventory:";

    /**
     * 해당 객실의 물품 사용량을 증가시킵니다. (오전 6시 리셋)
     */
    public void incrementItem(String roomNo, String item, int count) {
        String key = REDIS_KEY_PREFIX + roomNo;
        String hashKey = item;

        // Redis Hash에서 기존 값을 가져와 증가시킴
        redisTemplate.opsForHash().increment(key, hashKey, count);

        // 만료 시간이 설정되지 않았으면 다음 오전 6시로 만료 시간 설정
        Long expire = redisTemplate.getExpire(key);
        if (expire == null || expire < 0) {
            LocalDateTime now = LocalDateTime.now();
            LocalDateTime next6AM = now.with(LocalTime.of(6, 0));
            
            // 만약 현재 시간이 오전 6시 이후라면, 다음 날 오전 6시로 설정
            if (now.isAfter(next6AM) || now.isEqual(next6AM)) {
                next6AM = next6AM.plusDays(1);
            }

            redisTemplate.expire(key, Duration.between(now, next6AM));
            log.info("[RoomInventory] {} 키 만료 시간 설정 완료: {}", key, next6AM);
        }
    }

    /**
     * 해당 객실의 물품 사용량을 감소시킵니다. (오전 6시 리셋, 취소 대응)
     */
    public void decrementItem(String roomNo, String item, int count) {
        String key = REDIS_KEY_PREFIX + roomNo;
        String hashKey = item;

        Object rawValue = redisTemplate.opsForHash().get(key, hashKey);
        if (rawValue != null) {
            int currentVal = 0;
            try {
                currentVal = Integer.parseInt(rawValue.toString());
            } catch (NumberFormatException ignored) {}

            int newVal = Math.max(0, currentVal - count);
            redisTemplate.opsForHash().put(key, hashKey, String.valueOf(newVal));
            log.info("[RoomInventory] {} 키 감량 완료: {} -> {}", key, hashKey, newVal);
        }
    }

    /**
     * 현재 객실의 물품 사용량 조회
     */
    public Map<String, Integer> getInventory(String roomNo) {
        String key = REDIS_KEY_PREFIX + roomNo;
        Map<Object, Object> rawMap = redisTemplate.opsForHash().entries(key);
        
        Map<String, Integer> inventory = new HashMap<>();

        for (InventoryPolicyProperties.PolicyItem policy : policyProperties.getPolicies()) {
            String code = policy.getCode(); // e.g. "WATER", "TOWEL"
            String allowanceKey = "free_" + code.toLowerCase() + "_allowance";
            String usedKey = "free_" + code.toLowerCase() + "_used";
            String extraChargeKey = "free_" + code.toLowerCase() + "_extra_charge";

            inventory.put(allowanceKey, policy.getAllowance());
            inventory.put(usedKey, 0);
            inventory.put(extraChargeKey, policy.getExtraCharge());

            Object rawCount = rawMap.get(code);
            if (rawCount != null) {
                int count = 0;
                if (rawCount instanceof Number) {
                    count = ((Number) rawCount).intValue();
                } else {
                    try {
                        count = Integer.parseInt(rawCount.toString());
                    } catch (NumberFormatException ignored) {}
                }
                inventory.put(usedKey, count);
            }
        }
        return inventory;
    }
}
