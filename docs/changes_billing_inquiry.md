# AN-321 가상 PMS 비용 조회 기능 변경 내역

## 개요

AI 컨시어지가 고객의 비용 문의(`BILLING_INQUIRY`)를 인식하면, 백엔드 PMS 데이터를 실시간으로 조회하여 자연어로 안내하는 기능을 추가했습니다.

---

## 변경 파일 목록

| 구분 | 파일 | 변경 유형 |
|------|------|-----------|
| AI | `ai/app/api/analyze.py` | 수정 |
| AI | `ai/app/core/router_engine.py` | 수정 |
| AI | `ai/app/prompts/router_prompt.py` | 수정 |
| AI | `ai/app/schemas/router.py` | 수정 |
| AI | `ai/app/domains/billing/service.py` | 신규 |
| AI | `ai/app/prompts/billing_prompt.py` | 신규 |
| Backend | `pms/adapter/in/web/PmsBillingController.java` | 신규 |
| Backend | `pms/application/port/in/GetBillingUseCase.java` | 신규 |
| Backend | `pms/application/service/GetBillingService.java` | 신규 |
| Backend | `pms/application/dto/response/BillingItemResult.java` | 신규 |
| Backend | `pms/application/dto/response/GetBillingSummaryResult.java` | 신규 |

---

## AI 서버 변경 내용

### 1. `router_engine.py` — BILLING_INQUIRY 라우트 타입 등록

`VALID_ROUTE_TYPES` 상수에 `"BILLING_INQUIRY"` 추가.
티켓을 생성하지 않는 유형으로 처리 (`create_ticket=False`, `domain=None`).

```python
# 변경 전
VALID_ROUTE_TYPES = {"DEPARTMENT", ..., "VOC"}

# 변경 후
VALID_ROUTE_TYPES = {"DEPARTMENT", ..., "VOC", "BILLING_INQUIRY"}
```

---

### 2. `router_prompt.py` — 라우터 프롬프트에 BILLING_INQUIRY 분류 기준 추가

10번 카테고리로 `BILLING_INQUIRY` 규칙 추가.

- **트리거 예시:** "지금까지 쓴 비용 얼마야?", "룸서비스 얼마 나왔어?", "미니바 얼마야?"
- 특정 카테고리(룸서비스, 미니바 등)가 언급되면 `entities.category`에 추출
- `create_ticket=False`, 정적 RAG 응답 아님 → 실시간 PMS 조회 필요

출력 스키마의 `route_type` 허용값에도 `BILLING_INQUIRY` 추가.

---

### 3. `schemas/router.py` — RouterOutputSchema에 entities 필드 추가

```python
entities: Optional[dict] = Field(
    default_factory=dict,
    description="라우터가 추출한 추가 엔티티 (예: BILLING_INQUIRY 시 category 등)."
)
```

카테고리 필터링 등 추가 정보를 라우터가 직접 추출해 전달할 수 있도록 스키마 확장.

---

### 4. `api/analyze.py` — BILLING_INQUIRY 처리 로직 추가 (STEP 3-f2)

`BILLING_INQUIRY` 라우트 타입 감지 시 아래 순서로 처리:

1. `entities.category`에서 카테고리 추출 (없으면 전체 조회)
2. `fetch_billing_summary(room_no, category)` 호출 → 백엔드 PMS API 연동
3. 조회 결과가 없으면 "이용 내역 없음" 메시지 반환
4. 결과가 있으면 `build_billing_prompt()`로 프롬프트 생성 → Gemini 호출 → 자연어 응답 생성
5. 예외 발생 시 "프런트 데스크 문의" 안내 메시지로 fallback

---

### 5. `domains/billing/service.py` — 백엔드 Billing API 호출 모듈 (신규)

```python
async def fetch_billing_summary(room_no: str, category: str = None) -> dict:
    # GET {BACKEND_URL}/pms/billing/summary?roomNo=xxx&category=xxx
```

- `httpx`로 백엔드 REST API 비동기 호출
- 타임아웃 5초, 예외 발생 시 상위로 전파

---

### 6. `prompts/billing_prompt.py` — 비용 안내 프롬프트 빌더 (신규)

`build_billing_prompt(billing_data, language)`:
- 한국어(`ko`) / 영어 분기 응답 생성
- 항목별 금액, 소계, 부가세(10%), 봉사료(10%), 최종 결제 예정 금액 포함
- "체크아웃 시 일괄 정산" 안내 문구 포함

---

## Backend 변경 내용

### API 엔드포인트

```
GET /pms/billing/summary?roomNo={roomNo}&category={category}
```

- `roomNo`: 필수. 조회할 객실 번호
- `category`: 선택. 없으면 전체 내역 조회

---

### `PmsBillingController` (신규)

`/pms/billing` 경로에 매핑된 REST 컨트롤러.
`GetBillingUseCase` 포트를 통해 서비스 호출 후 `ResponseEntity`로 반환.

---

### `GetBillingUseCase` (신규)

```java
GetBillingSummaryResult getBillingSummary(String roomNo, String category);
```

헥사고날 아키텍처의 인바운드 포트 인터페이스.

---

### `GetBillingService` (신규)

비용 조회 핵심 로직:

1. `PmsReceiptRepositoryPort`로 해당 객실의 영수증 목록 조회
2. `PmsMenuRepositoryPort`로 메뉴 정보 맵 생성
3. `category` 필터 적용 (없으면 `ALL`)
4. 항목별 `BillingItemResult` 변환
5. 소계 계산 후 **부가세 10%**, **봉사료 10%** 적용하여 최종 금액 산출

---

### DTO (신규)

**`BillingItemResult`**
```
menuName, category, quantity, unitPrice, totalPrice, createdAt
```

**`GetBillingSummaryResult`**
```
roomNo, category, items[], subtotal, tax, serviceCharge, totalAmount, currency
```

---

## 전체 흐름 요약

```
고객 메시지 ("룸서비스 얼마야?")
        ↓
  AI Router (router_engine + router_prompt)
  → route_type = "BILLING_INQUIRY"
  → entities = {"category": "룸서비스"}
        ↓
  analyze.py STEP 3-f2
        ↓
  fetch_billing_summary(room_no, "룸서비스")
        ↓
  Backend GET /pms/billing/summary?roomNo=xxx&category=룸서비스
        ↓
  GetBillingService → PMS DB 조회 → 금액 계산
        ↓
  build_billing_prompt() → Gemini 호출
        ↓
  자연어 응답 → 고객에게 전달
```
