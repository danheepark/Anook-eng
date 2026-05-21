package com.anook.backend.global.exchangerate.adapter.out.koreaexim;

import com.anook.backend.global.exchangerate.application.port.out.ExchangeRateProviderPort;
import com.anook.backend.global.exchangerate.domain.model.ExchangeRate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 한국수출입은행 환율 API 어댑터
 *
 * 엔드포인트: GET https://www.koreaexim.go.kr/site/program/financial/exchangeJSON
 * 파라미터: authkey, searchdate(YYYYMMDD), data=AP01
 *
 * 특성:
 *  - 영업일 오전 11시 이후 당일 환율 제공
 *  - 그 전/주말/공휴일에는 빈 배열 반환 → 직전 영업일로 최대 7일 재시도
 *  - 응답 필드 deal_bas_r(매매기준율) 사용
 */
@Slf4j
@Component
public class KoreaeximExchangeRateAdapter implements ExchangeRateProviderPort {

    private static final String USD_CURRENCY_UNIT = "USD";
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final int MAX_RETRY_DAYS = 7;

    private final WebClient webClient;
    private final String authKey;

    public KoreaeximExchangeRateAdapter(
            @Value("${koreaexim.base-url:https://oapi.koreaexim.go.kr}") String baseUrl,
            @Value("${koreaexim.auth-key:}") String authKey
    ) {
        this.webClient = WebClient.builder().baseUrl(baseUrl).build();
        this.authKey = authKey;
    }

    @Override
    public Optional<ExchangeRate> fetchLatestUsdRate() {
        if (authKey == null || authKey.isBlank()) {
            log.warn("[Koreaexim] auth key 미설정 — 외부 호출 생략");
            return Optional.empty();
        }

        LocalDate targetDate = LocalDate.now();
        for (int i = 0; i < MAX_RETRY_DAYS; i++) {
            Optional<ExchangeRate> result = fetchForDate(targetDate);
            if (result.isPresent()) {
                return result;
            }
            targetDate = targetDate.minusDays(1);
        }

        log.warn("[Koreaexim] 최근 {}일간 USD 환율 응답 없음", MAX_RETRY_DAYS);
        return Optional.empty();
    }

    private Optional<ExchangeRate> fetchForDate(LocalDate date) {
        String searchDate = date.format(DATE_FORMAT);
        try {
            List<Map<String, Object>> response = webClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/site/program/financial/exchangeJSON")
                            .queryParam("authkey", authKey)
                            .queryParam("searchdate", searchDate)
                            .queryParam("data", "AP01")
                            .build())
                    .retrieve()
                    .bodyToMono(new ParameterizedTypeReference<List<Map<String, Object>>>() {})
                    .timeout(Duration.ofSeconds(10))
                    .block();

            if (response == null || response.isEmpty()) {
                log.debug("[Koreaexim] {} 응답 비어있음 — 직전 영업일로 재시도", searchDate);
                return Optional.empty();
            }

            return response.stream()
                    .filter(row -> USD_CURRENCY_UNIT.equals(row.get("cur_unit")))
                    .findFirst()
                    .flatMap(row -> parseRate(row, date));

        } catch (Exception e) {
            log.error("[Koreaexim] {} 호출 실패 — {}", searchDate, e.getMessage());
            return Optional.empty();
        }
    }

    private Optional<ExchangeRate> parseRate(Map<String, Object> row, LocalDate date) {
        Object raw = row.get("deal_bas_r");
        if (raw == null) {
            return Optional.empty();
        }
        try {
            double rate = Double.parseDouble(raw.toString().replace(",", ""));
            if (rate <= 0) {
                return Optional.empty();
            }
            log.info("[Koreaexim] USD 매매기준율 조회 성공 — {} = {} KRW", date, rate);
            return Optional.of(new ExchangeRate(rate, date));
        } catch (NumberFormatException e) {
            log.warn("[Koreaexim] deal_bas_r 파싱 실패 — value: {}", raw);
            return Optional.empty();
        }
    }
}
