# RAG 파이프라인 데이터 적재 고도화 계획 (Incremental Upsert)

현재 아늑(Anook) 프로젝트의 RAG 지식 데이터 적재 프로세스는 배포 시 전체 데이터를 덮어쓰거나 통째로 스킵하는 한계(All-or-Nothing)가 있습니다. 이를 해결하여 API 호출 비용을 최적화하고 배포 시간을 단축하기 위한 **단건 단위 Upsert 및 해시 기반 캐싱 로직** 구현 계획입니다.

---

## 1. Vector DB (pgvector) - 단건 단위 Upsert 처리

### 🚨 현재 문제점 (All-or-Nothing 버그)
현재 `ai/app/domains/*/seed_knowledge.py` 스크립트에는 `SELECT COUNT(*) FROM knowledge_entry` 로 데이터가 1개라도 있으면 전체 부서를 통째로 스킵(`return`)해버리는 로직이 들어있습니다. 
이로 인해 **기존에 데이터가 10개 있는 상태에서 새로운 질문(11번째)을 코드로 추가해도, "이미 데이터가 있다"고 판단하여 전체를 무시해버리는 치명적인 문제**가 발생합니다. 즉, 신규 규정집 내용이 영원히 DB에 업데이트되지 않습니다. 이를 **질문 단위 개별 검증** 방식으로 변경합니다.

### 🛠️ 구현 전략
데이터베이스(`knowledge_entry` 테이블)에 있는 기존 데이터와 파이썬 딕셔너리(`*_KNOWLEDGE`)를 1:1로 비교합니다.

1. **조회**: `domain_code`와 `question`을 조건으로 기존 데이터를 `SELECT` 합니다.
2. **Insert (신규 등록)**: 
   - 기존 DB에 없는 질문이라면 새로 임베딩(`embed_text`)을 생성하고 `INSERT` 합니다.
3. **Update (내용 수정)**: 
   - 질문은 있지만 `answer`가 달라졌다면 내용이 수정된 것이므로 다시 임베딩을 생성하고 `UPDATE` 합니다.
4. **Skip (변경 없음)**:
   - 질문이 존재하고 `answer`도 동일하다면 재임베딩 없이 **안전하게 패스(Skip)** 합니다.

### 📝 변경 대상 파일
- `ai/app/domains/*/seed_knowledge.py` (모든 부서별 시딩 파일)

---

## 2. Graph DB (Neo4j) - 해시(Hash) 기반 텍스트 파싱 스킵

`ai/ingest_graph.py`는 도메인 전체 텍스트를 하나로 합친 뒤 Gemini API에게 엔티티(Entity)와 관계(Relation)를 추출하도록 지시합니다. 현재는 아무 검증 로직이 없어 배포마다 수백~수천 토큰의 API 비용이 무의미하게 발생하고 있습니다.

### 🛠️ 구현 전략
Gemini로 텍스트를 보내기 전에, 해당 텍스트 덩어리의 지문(Hash)을 만들어서 이전과 동일한 텍스트인지 비교합니다. 단, 팀원이 작업 중인 **Neo4j의 재시작(컨테이너 On/Off) 및 초기화 변수를 반드시 고려**하여 이중 검증 로직을 구축합니다.

1. **해시 생성**: 도메인별 전체 텍스트를 `SHA-256` 방식으로 해싱(Hashing)합니다.
2. **Neo4j 연결 재시도(Retry) 로직**:
   - Neo4j 컨테이너가 껐다 켜지는 상황을 대비해, 연결 실패 시 즉시 종료하지 않고 최대 3~5회 지수 백오프(Exponential Backoff) 방식으로 연결을 재시도합니다.
3. **이중 스킵 판단 (Hash + Data Check)**:
   - `MATCH (m:SystemMeta {domain: 'FB'}) RETURN m.hash` 쿼리로 해시를 가져옵니다.
   - 단, Neo4j가 초기화되어 기존 데이터가 날아갔을 수 있으므로 `MATCH (n) WHERE NOT n:SystemMeta RETURN count(n)`으로 실제 데이터 노드가 존재하는지도 함께 확인합니다.
   - **스킵 조건**: `이전 해시 == 현재 해시` 이면서 `데이터 노드 개수 > 0` 일 때만 Gemini API 호출 및 적재를 100% 스킵합니다.
   - 해시가 다르거나 데이터가 날아갔다면 Gemini에 분석을 요청(`extract_entities_and_relations`)하고 다시 적재합니다.
4. **상태 업데이트**:
   - 그래프 노드 병합이 완료되면 `MERGE (m:SystemMeta {domain: 'FB'}) SET m.hash = '새로운해시'` 로 성공 상태를 남깁니다.

### 📝 변경 대상 파일
- `ai/ingest_graph.py`

---

## 3. 기대 효과
* 💰 **비용 절감**: 데이터 변경이 없을 경우 Gemini API 호출을 완벽하게 차단하여 토큰 과금을 방지합니다.
* ⚡ **배포 속도 향상**: 기존에 1~2분씩 걸리던 데이터 적재 파이프라인이 변경사항이 없을 경우 1초 이내로 즉시 종료됩니다.
* 🛡️ **안정성 보장**: 기존 DB 구조나 모델을 바꾸지 않으면서도 스마트한 Incremental Update(증분 업데이트)가 완성됩니다.
