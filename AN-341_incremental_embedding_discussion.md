# AN-341 Incremental Embedding 구현 논의 기록

이 문서는 `AN-341_incremental_embedding_plan.md`의 계획을 구현하면서 나눈 결정 과정과 후속 논의를 정리한 기록입니다.

---

## 1. 사전 코드 진단

### Vector DB (pgvector)
`ai/app/domains/*/seed_knowledge.py` 6개 파일 모두 동일한 All-or-Nothing 패턴 사용:
```python
cur.execute("SELECT COUNT(*) FROM knowledge_entry WHERE domain_code = %s", ("FB",))
if count > 0:
    return  # 🚨 데이터가 1개라도 있으면 신규 추가분 영원히 무시
```
→ `concierge/seed_knowledge.py`는 그 아래에 도달 불가능한 DELETE 문도 포함하고 있어 함께 정리 필요.

### Graph DB (Neo4j)
`ai/ingest_graph.py`는 매 실행마다 무조건 Gemini API를 호출. 캐싱 로직 부재 → 배포마다 토큰 비용 누적.

### 스키마 확인
`backend/src/main/resources/schema.sql` 기준 `knowledge_entry` 테이블:
- `(domain_code, question)` 조합에 **UNIQUE 제약 없음** → `ON CONFLICT` 대신 SELECT → 분기 방식 필요
- `updated_at`은 자동 갱신 되지 않음 → UPDATE 시 명시적으로 `NOW()` 설정 필요

---

## 2. 결정 사항

### 결정 1 — 공용 헬퍼 추출 (방식 B)

**선택**: 6개 도메인 파일에 중복 로직을 박지 않고, `ai/app/domains/rag/service.py`에 헬퍼 함수 하나만 두고 호출.

| 항목 | 방식 A (복붙) | 방식 B (헬퍼) ✅ |
|---|---|---|
| 작성량 | 6배 | 1배 |
| 로직 수정 시 | 6개 파일 수정 | 1개 파일 수정 |
| 버그 가능성 | 높음 (불일치) | 낮음 |

### 결정 2 — 작업 순서

**선택**: Step 1 (pgvector) → 검증 → Step 2 (Neo4j) **분리 진행**.
- 안전 우선. Vector DB 변경을 먼저 검증한 후 Neo4j 작업 진행.

### 결정 3 — Neo4j `data_count` 검증 단위 (옵션 A)

**선택**: 전체 노드 카운트로 단순 검증 (`MATCH (n) WHERE NOT n:SystemMeta RETURN count(n)`).

**이유**:
1. Neo4j는 단일 인스턴스라 "한 도메인만 날아가는" 시나리오가 없음 — 컨테이너 On/Off 시 모든 도메인이 함께 초기화됨.
2. Knowledge Graph 특성상 같은 엔티티(예: "하우스키핑")가 여러 도메인에 걸쳐 참조됨 → 노드에 `domain` 속성을 박으면 공유 노드 처리가 모호.
3. 구현 단순함 → 버그 가능성 낮음.
4. YAGNI: 정밀도가 필요한 시나리오가 없으면 추후 확장 가능.

---

## 3. 구현 결과

### Step 1 — pgvector 단건 Upsert

**신규**: `ai/app/domains/rag/service.py`에 헬퍼 추가
```python
def upsert_knowledge_entry(cur, domain_code: str, question: str, answer: str) -> str:
    """
    질문 단위로 SELECT → INSERT/UPDATE/SKIP 분기.
    반환값: "inserted" | "updated" | "skipped"
    """
```

**리팩토링** (6개 도메인):
- `ai/app/domains/fb/seed_knowledge.py`
- `ai/app/domains/housekeeping/seed_knowledge.py`
- `ai/app/domains/concierge/seed_knowledge.py` (도달 불가능한 DELETE 제거)
- `ai/app/domains/emergency/seed_knowledge.py`
- `ai/app/domains/facility/seed_knowledge.py`
- `ai/app/domains/front/seed_knowledge.py`

각 시딩 함수는 `신규 X건, 수정 Y건, 건너뜀 Z건` 통계 출력.

### Step 2 — Neo4j 해시 캐싱

**변경 파일**: `ai/ingest_graph.py`

**추가된 함수**:
| 함수 | 역할 |
|---|---|
| `compute_text_hash(text)` | SHA-256 해시 생성 |
| `connect_neo4j_with_retry(max_attempts=5, base_delay=1.0)` | 지수 백오프 재연결 (1→2→4→8→16s) |
| `should_skip_ingestion(session, domain, new_hash)` | 이중 검증: 해시 일치 AND 데이터 노드 존재 |
| `update_system_meta(session, domain, new_hash)` | SystemMeta 노드의 해시 갱신 |

**구조 변경**:
- Driver는 1회만 생성, 도메인별로 새 session을 열어 에러 격리.
- 도메인별 try/except로 한 도메인 실패가 전체 파이프라인을 멈추지 않게 함.

---

## 4. 잠재 문제 분석 (우선순위별)

구현 완료 후 발견한 잠재적 운영 문제들.

### 🔴 Critical

**#1. 삭제(Delete) 미반영 — 양쪽 모두 해당**
- 현재 로직은 INSERT/UPDATE/SKIP만, DELETE 없음.
- `knowledge_data.py`에서 항목을 지워도 pgvector/Neo4j에는 그대로 남음.
- → 시간이 지날수록 stale 데이터 누적.

**#2. 질문 글자 한 글자 변경 시 새 row 생성**
- `question` 문자열 정확 매칭이라 미세 수정 시 기존 row UPDATE가 아니라 신규 INSERT.
- → **다만 이는 #1과 별도로 재해석 필요 (섹션 5 참조)**

### 🟡 Medium

**#3. 부분 적재 후 SystemMeta 미갱신 (Neo4j)**
- Gemini 호출 성공 → `ingest_to_neo4j` 도중 일부 쿼리만 성공하고 에러 시, `update_system_meta`는 호출되지 않음.
- 다음 실행 때 재처리는 보장되지만 부분 적재된 노드가 남음.
- **완화책**: `ingest_to_neo4j + update_system_meta`를 `session.execute_write`로 트랜잭션 묶기.

**#4. 공유 노드 cross-contamination (옵션 A 선택의 trade-off)**
- "하우스키핑" 노드가 FB/HK 도메인 모두에서 참조될 때, HK만 재처리되어도 공유 노드의 주변 그래프는 변함.
- FB는 SKIP되지만 사실 검색 결과는 미묘하게 달라질 수 있음.
- 현실적 영향은 작음 (MERGE 기반이라 추가 방향).

**#5. 임베딩 모델/포맷 변경 시 강제 재임베딩 불가**
- 모델을 교체해도 `answer`가 같으면 SKIP됨.
- **완화책**: `--force` 플래그 또는 모델 버전 컬럼.

### 🟢 Low

**#6. UNIQUE 제약 부재 → 동시 실행 시 중복 가능**
- SELECT → INSERT 사이 race condition. 실질 위험은 낮음.
- 근본 해결: `UNIQUE(domain_code, question)` 제약 추가.

**#7. `status` 필드 일관성**
- 헬퍼는 신규 INSERT 시 `status='APPROVED'` 고정, UPDATE 시 `status`는 건드리지 않음.
- 어드민이 `REJECTED`로 바꾼 항목의 answer가 수정되면 status는 그대로 유지됨 (현재 동작은 안전한 편).

**#8. 해시는 항목 순서에 민감**
- `knowledge_data.py`에서 항목 순서만 바꿔도 해시 변동 → Gemini 재호출.
- **완화책**: 해시 전에 `sorted()` 적용.

**#9. Driver 1회 연결**
- 처리 중 Neo4j 재시작 시 그 이후 도메인 실패.
- 현재 도메인 수가 적어 현실적 위험은 낮음.

---

## 5. 핵심 인사이트 — "다양한 질문 표현은 권장 패턴"

처음에 #2를 "중복 row = 나쁨"으로 단순 분류했으나, **사용자 지적으로 재평가** 했습니다.

### 임베딩 검색의 본질

코사인 유사도 기반 검색이므로, 사용자가 같은 의미를 다양한 표현으로 묻습니다:
- "체크인 몇시에요?"
- "언제 체크인해요?"
- "체크인 시간 알려주세요"

DB에 표현 1개만 있으면 → 사용자 질의와 임베딩 유사도가 threshold(0.7) 아래로 떨어질 위험 → 검색 miss.
DB에 변형 5개가 있으면 → 어떤 표현으로 와도 그 중 하나와는 유사도가 충분히 높음 → 검색 hit률 향상.

이는 RAG 시스템에서 흔히 쓰는 **Query Augmentation / Multi-Query 패턴**이며, 의도된 사용 방식입니다.

→ **#2는 버그가 아니라 의도된 설계**로 재분류.

### 다만 진짜 follow-up 문제: 답변 정합성

같은 답변을 가진 N개 변형 질문이 있을 때:
```python
{"question": "체크인 시간 알려주세요",   "answer": "오후 3시부터입니다"},
{"question": "언제 체크인해요?",         "answer": "오후 3시부터입니다"},
{"question": "체크인 몇시부터예요?",      "answer": "오후 3시부터입니다"},
```

체크인 시간이 변경되면 **N개 항목의 answer를 모두 일괄 수정 필요**. 1개라도 빠지면 → 같은 질문인데 표현에 따라 다른 답변이 나오는 정합성 깨짐.

현재 헬퍼는 `question` 기준 매칭이라 "답변 일괄 수정"은 사람이 손으로 챙겨야 함.

### 자동 DELETE도 위험

이 맥락에서 #1의 자동 DELETE도 재고 필요:
- 의도적으로 만든 변형 표현을 사용자가 실수로 1개 지웠을 때 → 자동 DELETE되면 RAG 검색 hit률이 조용히 떨어짐.
- → 자동 DELETE 대신 **명시적 `--prune` 옵션**이 더 안전.

---

## 6. 본질적 해결책 (별도 티켓)

데이터 모델 자체가 `knowledge_entry`를 `(question, answer)` 1:1로 묶고 있어 구조적 한계 존재.

**제안 구조**:
```
knowledge_entry           question_variant
─────────────             ─────────────────
id                        id
canonical_question        knowledge_entry_id  ← FK
answer                    question_text
embedding (답변 기준)      embedding (질문 변형 기준)
domain_code
```

- 답변은 1곳에만 저장 → 수정 시 1곳만 손대면 됨
- 질문 변형은 N개 매핑 → 검색은 변형 임베딩으로 hit
- 정합성 + 검색 품질 둘 다 해결

**AN-341 스코프 밖** — 별도 마이그레이션 티켓 필요.

---

## 7. 정리

| 항목 | 현재 PR (AN-341) | 추후 |
|---|---|---|
| pgvector Upsert | ✅ 완료 | — |
| Neo4j 해시 캐싱 | ✅ 완료 | — |
| 자동 DELETE | ❌ 의도적 제외 | `--prune` 옵션 검토 |
| Neo4j 트랜잭션 묶기 | 미적용 | `session.execute_write` 적용 검토 |
| 해시 `sorted()` | 미적용 | 코드 1줄 추가 검토 |
| `--force` 플래그 | 미적용 | 모델 교체 일정 잡힐 때 |
| `UNIQUE` 제약 | 미적용 | 백엔드 팀 조율 |
| 1:N 데이터 모델 | 미적용 | 별도 티켓 |
