[English](README.md) | **한국어 (Korean)**

# 🏨 아늑 (Anook) : AI 기반 지능형 호텔 통합 관리 시스템

> 고객 요청을 AI가 분석하여 태스크를 자동 생성하고, 적합한 직원에게 분배하며, 처리 과정을 추적하는 차세대 호텔 운영 시스템입니다.

---

## 📖 프로젝트 개요

**아늑(Anook)**은 다국어로 입력되는 비정형 데이터(투숙객의 자연어 요청)를 AI가 분석하여 정형화된 업무 지시서(Task)로 변환하고, 이를 호텔 내 각 담당 부서에 자동으로 라우팅해주는 플랫폼입니다.  
관리자는 AI 확신도(Confidence Score) 기반의 하이브리드 컨펌 시스템을 통해 유연한 업무 배분을 수행하며, 처리된 데이터는 RAG 기반 지식으로 자생적 진화를 이룹니다.

## ✨ 핵심 가치

- **One-pass 프로세싱**: 단일 AI 프롬프트로 다국어 번역, 의도(Intent) 분석, 식별자(Entity) 추출을 한 번에 처리
- **초경량 Task Code**: 복잡한 JSON이 아닌 `[부서]|[긴급도]|[분류]|[항목]|[수량]` 형태의 약속된 코드 포맷을 통한 토큰 80~90% 절약 및 시스템 안정성 확보
- **하이브리드 자동화**: AI 확신도(Confidence ≥ 0.8)에 따라 완전 자동 분배 또는 관리자 수동 컨펌(반자동) 체계 도입
- **데이터 플라이휠**: 미답변 데이터 및 처리 이력을 RAG에 반영하여 도메인 특화 지식망 자생적 튜닝 구축

---

## 👥 사용자 역할 (Roles)

| 역할 | 설명 | 인증 방식 | 디바이스 |
|------|------|-----------|----------|
| 🧑 **Guest (투숙객)** | 객실 QR 스캔을 통해 별도 앱 설치 없이 PWA로 즉시 접속하여 다국어 요청 | 객실번호 기반 자동 인증 (JWT) | 모바일 |
| 👷 **Staff (직원)** | 실시간 알림을 수신하고, 담당 부서로 할당된 태스크 수락 및 처리 | 관리자 발급 PIN (JWT) | PC, 모바일 |
| 🏨 **Admin (관리자)** | 전체 태스크 실시간 모니터링, AI 미분류/특이사항 건 수동 에스컬레이션 컨펌 | ID/PW (JWT) | PC |

---

## 🚀 주요 기능 (MVP)

1. **AI 챗봇 기반 고객 요청 접수 (Guest Chat)**: 투숙객이 모국어로 자연스럽게 요청하거나 빠른 버튼으로 즉시 요청
2. **태스크 자동 생성 및 부서 라우팅**: AI가 의도를 분석하여 하우스키핑, 시설관리, F&B, 프론트 등으로 업무 자동 배분
3. **AI 되묻기 (Clarification) 및 Fallback**: 필수 정보가 누락된 경우 AI가 투숙객에게 되물어 정보를 보완하거나 관리자에게 에스컬레이션
4. **실시간 상태 추적 (WebSocket)**: 투숙객과 직원 모두 현재 태스크 진행 상태(접수됨 → 배정됨 → 진행중 → 완료) 실시간 동기화
5. **Hybrid RAG 기반 FAQ 자동 응대**: 호텔 이용 정보를 Vector DB(pgvector) + Graph DB(Neo4j)로 검색해 할루시네이션 없는 정확한 AI 즉답
6. **교대 인수인계 자동화**: 이전 근무조의 미처리 잔여 업무, 특이사항, 주요 처리 내역을 AI가 취합하여 자연어 브리핑 생성
7. **다국어 PII 자동 마스킹**: 고객 메시지에서 개인정보(전화번호, 이름, 이메일 등)를 정규식으로 자동 마스킹 후 AI에 전달
8. **이미지 첨부 멀티모달 분석**: 투숙객이 고장 사진 등을 첨부하면 Gemini Vision API가 분석하여 시설관리 태스크 자동 생성

---

## 🛠 기술 스택 (Tech Stack)

### Backend
- **Language & Framework**: Java 21, Spring Boot 3.2.4
- **Architecture**: Hexagonal Architecture (Ports & Adapters), DDD (Domain-Driven Design)
- **Database**: PostgreSQL 16 + pgvector (RAG용 벡터 DB), Spring Data JPA
- **Cache**: Redis (이미지 임시 저장, 세션)
- **Real-time**: WebSocket (STOMP)
- **Security**: Spring Security, JWT (HttpOnly Cookie)
- **Utilities**: Apache POI 5.2.5 (인수인계 엑셀 다운로드), WebFlux WebClient (AI 서버 HTTP 통신)

### Frontend
- **Framework**: Next.js 16.x (App Router, BFF 패턴)
- **Platform**: PWA (Progressive Web App) — 앱 설치 없이 QR 스캔으로 즉시 접속
- **State Management**: Zustand
- **Styling**: CSS Modules, CSS Variables
- **Offline**: IndexedDB (idb), Background Sync
- **Libraries**: iron-session (서버 세션), lucide-react (아이콘), qrcode.react (QR 생성)

### AI Server
- **Framework**: Python FastAPI + Uvicorn
- **AI Engine**: Google Gemini API (`gemini-2.5-flash`)
- **Vector DB**: pgvector (의미 유사도 검색)
- **Graph DB**: Neo4j 5 (메뉴·가격·알러지 관계 탐색 — Hybrid RAG)
- **AI Features**: Intent/Entity 분류, Clarification, 다국어 응답, PII 마스킹 가드, 멀티모달(이미지 분석), 인수인계 브리핑 요약
- **Libraries**: SQLAlchemy, pgvector, neo4j-python-driver, langchain-community

### Infrastructure
- **Container**: Docker, Docker Compose
- **Reverse Proxy**: Nginx (SSL 종단, WebSocket 프록시)
- **External API**: 한국수출입은행 환율 API (다국어 요금 조회 시 실시간 환율 변환)

---

## 🏗 시스템 아키텍처

### 4-Container 배포 구조

```
[Guest 모바일 / Staff 태블릿 / Admin PC]
              │ HTTPS
              ▼
┌──────────────────────────┐
│  Nginx (Reverse Proxy)   │  ← 유일한 외부 노출 포트 (80, 443)
│  - /** → next:3000       │
│  - /ws/** → app:8080     │  ← WebSocket 직행
└────────────┬─────────────┘
             │ 내부망
             ▼
┌──────────────────────────┐
│  Next.js (BFF · PWA)     │  ← /api/* 수신 후 /api 제거 → app:8080 프록시
└────────────┬─────────────┘
             │ 내부망 (HTTP)
             ▼
┌──────────────────────────┐
│  Spring Boot (app:8080)  │  ← REST API + WebSocket (STOMP)
└─────┬─────────────┬──────┘
      │              │ HTTP
      ▼              ▼
┌──────────┐  ┌──────────────────────────────┐
│PostgreSQL│  │  Python AI (FastAPI :8000)    │
│+ pgvector│  │  ┌─ Router (Gemini)           │
│          │  │  ├─ HK Agent                 │
│  Redis   │  │  ├─ FB Agent (Hybrid RAG)    │
│(캐시/세션)│  │  ├─ FACILITY Agent           │
│          │  │  ├─ CONCIERGE Agent          │
│          │  │  ├─ EMERGENCY Agent          │
│          │  │  └─ FRONT Agent (Fallback)   │
│          │  │  Neo4j (Graph RAG)           │
│          │  └──────────────────────────────┘
```

### 주요 방어 전략

- **동시성 제어**: `@Version` 기반 JPA 낙관적 락(Optimistic Locking) — 다중 직원의 태스크 상태 경합 해결
- **개인정보 보호(PII)**: 정규식 1차 마스킹 후 AI 전달, API 응답에서 민감 정보 미노출
- **오프라인-퍼스트**: IndexedDB + Background Sync — 네트워크 단절 시에도 안정적인 앱 UX 보장
- **AI 안정성**: Confidence Score 기반 하이브리드 컨펌 (≥ 0.8 자동 배분 / 미달 시 관리자 컨펌)

---

## ⚡ 빠른 시작 (Quick Start)

### 사전 요구사항

- Docker & Docker Compose
- [Google AI Studio](https://aistudio.google.com/) — `GEMINI_API_KEY` 발급
- [한국수출입은행 OpenAPI](https://www.koreaexim.go.kr/ir/HPHKIR020M01) — `KOREAEXIM_AUTH_KEY` 발급 (다국어 요금 조회 기능 사용 시)

### 1. 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열고 아래 항목을 채웁니다:

```env
# 필수
GEMINI_API_KEY=your_gemini_api_key_here
JWT_SECRET=your_random_secret_32chars_or_more

# Neo4j (Graph RAG) — 로컬 기본값: neo4j / anook2026
NEO4J_USER=neo4j
NEO4J_PASSWORD=anook2026

# 선택 (환율 조회 기능)
KOREAEXIM_AUTH_KEY=your_koreaexim_authkey_here

# DB (기본값 그대로 사용 가능)
POSTGRES_USER=anook_user
POSTGRES_PASSWORD=anook_password
POSTGRES_DB=anook_db
```

### 2. 전체 실행 (Docker — 권장)

```bash
# 로컬 개발 환경 (포트 전체 오픈 + Neo4j UI 포함)
docker-compose -f docker-compose.yml -f docker-compose.local.yml up -d

# 빌드 포함 (최초 실행 또는 코드 변경 시)
docker-compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

### 3. 로컬 개발 환경 (개별 실행)

백엔드 (Spring Boot)와 프론트엔드(Next.js)를 IDE에서 직접 실행하고, DB/AI 서버만 Docker로 띄울 때:

```bash
# DB + AI 서버 + Neo4j만 Docker로 실행
docker-compose -f docker-compose.yml -f docker-compose.local.yml up -d db redis ai neo4j

# 백엔드 (별도 터미널)
cd backend && ./gradlew bootRun

# 프론트엔드 (별도 터미널)
cd frontend && npm install && npm run dev
```

### 4. 서비스 접속 URL

| 서비스 | URL | 비고 |
|--------|-----|------|
| 웹앱 (전체) | `http://localhost` | Nginx 통해 접속 |
| 웹앱 (개발) | `http://localhost:3000` | Next.js 직접 실행 시 |
| AI 서버 (Swagger) | `http://localhost:8000/docs` | FastAPI 자동 문서 |
| Neo4j Browser | `http://localhost:7474` | Graph DB 시각화 |
| PostgreSQL | `localhost:5432` | DB 포트 (로컬 compose) |
| Redis | `localhost:6379` | 캐시 (로컬 compose) |

---

## 🔑 테스트 계정 & 서비스 플로우

> 아래 계정은 `backend/src/main/resources/data.sql`에 시드 데이터로 자동 등록됩니다.

### 테스트 계정

| 역할 | 이름 | PIN | 접속 URL | 비고 |
|------|------|-----|----------|------|
| 🏨 관리자 | 최관리 | `000000` | `/admin` | 전체 모니터링 · 체크인 · 인수인계 |
| 👷 직원 | 김아늑 | `1234` | `/staff` | 하우스키핑 (HK) |
| 👷 직원 | 김직원 | `111111` | `/staff` | 하우스키핑 (HK) |
| 🧑 투숙객 | — | QR 자동 인증 | `/chat/{객실번호}` | 체크인 후 접속 가능 |

---

### 서비스 전체 플로우

아늑의 서비스는 **관리자의 체크인 → 투숙객의 QR 접속 → AI 대화 → 직원 처리** 순서로 흐릅니다.

```
[STEP 1] 관리자 — 투숙객 체크인 (PMS)
[STEP 2] 투숙객 — QR 스캔 → AI 채팅
[STEP 3] AI    — 요청 분석 → 태스크 자동 생성
[STEP 4] 직원  — 태스크 수락 → 처리 → 완료
[STEP 5] 투숙객 — 실시간 상태 확인
```

---

#### STEP 1 — 관리자: 투숙객 체크인 (PMS)

관리자가 `/admin` 로그인 후 투숙객 관리(`/admin/guests`) 페이지에서 체크인을 등록합니다.

```
1. http://localhost/admin 접속
2. PIN: 000000 입력 → 로그인
3. 좌측 메뉴 → [투숙객 관리] → [체크인 등록]
4. 객실 번호(예: 302) + 투숙객 이름 + 언어 선택 → 등록
5. 생성된 QR 코드 확인 (인쇄 또는 화면 공유)
```

> 체크인이 완료되면 해당 객실 QR이 활성화됩니다.  
> 체크아웃 처리 시 QR이 즉시 비활성화되어 재접속이 차단됩니다 (빈 방 보호).

---

#### STEP 2 — 투숙객: QR 스캔 → AI 채팅 진입

투숙객은 객실에 비치된 QR 코드를 스캔하거나, 직접 URL을 입력해 채팅에 접속합니다.

```
# QR 스캔 시 자동으로 이동되는 URL (예: 302호)
http://localhost/chat/302

# 별도 로그인 없이 자동 인증 → AI 채팅 화면 즉시 진입
```

> 브라우저 언어 설정을 감지하여 **한·영·일·중 4개 언어 UI가 자동 적용**됩니다.

---

#### STEP 3 — AI: 요청 분석 → 태스크 자동 생성

투숙객이 자연어로 요청하면 Gemini AI가 의도를 분석하고 담당 부서로 자동 라우팅합니다.

| 투숙객 입력 예시 | AI 분류 | 배정 부서 |
|----------------|---------|----------|
| `"수건 2개 더 가져다주세요"` | 어메니티 요청 | 하우스키핑 (HK) |
| `"화장실 불이 깜빡거려요"` | 시설 고장 신고 | 시설관리 (FACILITY) |
| `"룸서비스로 파스타 주문할게요"` | 식음료 주문 | F&B |
| `"Can I get extra pillows?"` | 다국어 → 자동 번역 후 처리 | 하우스키핑 (HK) |
| `"내일 체크아웃 비용이 얼마예요?"` | 요금 조회 (환율 변환 포함) | 프론트데스크 (FRONT) |

> AI 확신도 ≥ 0.8이면 해당 부서로 **즉시 자동 배분**,  
> 미달 시 관리자 대시보드의 **컨펌 큐**에 올라가 수동 처리됩니다.

---

#### STEP 4 — 직원: 태스크 수락 → 처리 → 완료

직원은 `/staff` 로그인 후 배정된 태스크를 실시간으로 수신하고 처리합니다.

```
1. http://localhost/staff 접속
2. PIN: 1234 입력 → 로그인
3. 대시보드에서 신규 태스크 수신 확인 (WebSocket 실시간 알림)
4. 태스크 카드 클릭 → [수락] → [완료] 처리
5. 필요 시 다른 부서로 [전달] 또는 투숙객에게 [직접 답장]
```

---

#### STEP 5 — 투숙객: 실시간 상태 확인

투숙객은 채팅 화면에서 자신의 요청이 어떤 상태인지 실시간으로 확인할 수 있습니다.

```
접수됨 → 배정됨 → 진행 중 → 완료
```

> WebSocket(STOMP)으로 직원의 상태 변경이 투숙객 화면에 즉시 동기화됩니다.

---

## 🗂 프로젝트 구조

```
team3-Anook/
├── backend/                    # Spring Boot (Java 21)
│   └── src/main/java/com/anook/
│       ├── config/             # Security, WebSocket, Gemini 설정
│       ├── security/           # JWT, 인증 서비스·컨트롤러
│       ├── guest/              # 투숙 세션 (체크인/아웃)
│       ├── message/            # 고객 AI 대화
│       ├── request/            # 고객 요청 접수 + AI 라우팅
│       ├── knowledge/          # RAG 지식 검색 + 승인 관리
│       ├── staff/request/      # 직원 요청 수락·완료·전달
│       └── admin/              # 관리자 모니터링·인수인계·직원관리
│
├── frontend/                   # Next.js 16 (App Router · PWA)
│   └── src/
│       ├── app/
│       │   ├── chat/[roomNo]/  # 투숙객 채팅 (QR 자동 인증)
│       │   ├── staff/          # 직원 대시보드
│       │   ├── admin/          # 관리자 대시보드
│       │   └── api/[...path]/  # BFF 프록시 (→ Spring Boot)
│       ├── components/         # 공유 컴포넌트
│       └── stores/             # Zustand 전역 상태
│
├── ai/                         # Python FastAPI (AI 서버)
│   └── app/
│       ├── domains/            # 부서별 AI 에이전트 (HK, FB, FACILITY ...)
│       ├── core/               # 라우터, Hybrid RAG 파이프라인
│       ├── prompts/            # Gemini 프롬프트 템플릿
        └── infrastructure/     # DB 연결 (pgvector, Neo4j)
│
├── nginx/                      # Nginx 설정
├── docs/                       # 설계 문서 모음
├── docker-compose.yml          # 프로덕션 배포용
├── docker-compose.local.yml    # 로컬 개발용 오버라이드
└── .env.example                # 환경 변수 템플릿
```

---

## 🧠 핵심 기술적 결정 (ADR)

### 1. Hybrid RAG — 할루시네이션 0% 달성

**문제**: Vector DB(pgvector) 단독 사용 시 F&B 메뉴 가격·알러지 정보가 텍스트 파편으로 분산되어 AI가 잘못된 정보를 조합하는 할루시네이션 발생  
→ 예시: "새우 알러지 있는데 파스타 괜찮나요?" → "안전합니다" (오답)

**해결**: Neo4j Graph DB 추가 도입

| DB | 역할 |
|----|------|
| **Vector DB** (pgvector) | 고객 의도의 의미 유사도 검색 |
| **Graph DB** (Neo4j) | `[파스타] ──HAS_ALLERGY──> [새우]` 등 1:1 관계 탐색 |

**결과**: F&B 메뉴·가격·알러지 오안내 할루시네이션 발생률 **0%** 달성

---

### 2. Gemini 2.5 vs 3.5 Flash A/B 테스트

**방법**: `.env`의 `GEMINI_AB_MODEL`로 챌린저 모델 지정, 요청마다 50/50 랜덤 분기, `ai_log.model_name`으로 자동 집계

| 항목 | Gemini 2.5 Flash | Gemini 3.5 Flash |
|------|-----------------|-----------------|
| 평균 응답 속도 | **3,916ms** ✅ | 8,704ms |
| 토큰 사용량 | 많음 | **적음** ✅ |
| 속도 차이 | 기준 | **2.2배 느림** |

**결정**: **Gemini 2.5 Flash 유지** — 호텔 실시간 서비스 특성상 응답 속도가 비용 절감보다 우선

---

### 3. 2-Pass AI 구조 유지 (1-Pass 통합 시도 → 원복)

**시도**: 라우터 + 도메인 에이전트 2회 호출을 1회로 통합해 속도 50% 단축 기대  
**결과**: 6개 부서 규칙을 하나의 프롬프트로 합치면서 입력 토큰이 폭증 → 오히려 더 느려짐  
**결론**: 기존 직렬 2-Pass 구조가 더 효율적 — 원복

---

### 4. RAG Incremental Upsert (All-or-Nothing 버그 해결)

**문제**: 기존 시딩 스크립트가 DB에 데이터가 1개라도 있으면 전체를 스킵 → 신규 지식이 영원히 반영 안 됨  
**해결**: 질문 단위 개별 검증으로 변경 (Insert / Update / Skip 3분기)  
**추가**: Neo4j는 SHA-256 해시 기반 스킵 + 데이터 노드 존재 여부 이중 검증으로 불필요한 Gemini API 호출 완전 차단

---

## 📚 관련 문서

| 문서 | 내용 |
|------|------|
| [아키텍처 구조](docs/아키텍처_구조_제안.md) | 헥사고날 패키지 맵, 프론트엔드 구조, 의존성 규칙 |
| [API 명세서](docs/API_명세서.md) | 전체 REST API 엔드포인트 목록 |
| [ERD](docs/ERD.md) | 데이터베이스 스키마 (Mermaid) |
| [RAG 워크플로우](docs/RAG_workflow.md) | Vector + Graph Hybrid RAG 파이프라인 |
| [AI 모델 비교 리포트](docs/AI_model_comparison_report.md) | Gemini 2.5 vs 3.5 A/B 테스트 결과 |
| [AI 지연 최적화](docs/AI_latency_optimization.md) | Thinking Budget, 병렬화 검토 등 |
| [프론트엔드 디자인 가이드](docs/FRONTEND_DESIGN_GUIDE.md) | 컴포넌트 구조, 네이밍, 스타일 규칙 |
| [인증·보안 구현 플랜](docs/인증_보안_구현_플랜.md) | JWT, PII 마스킹, 오프라인 인증 전략 |
| [DB 스키마 변경 가이드](docs/DB_스키마_변경_가이드.md) | 마이그레이션 절차 |

---

## 🏗 환경 변수 전체 목록

| 변수명 | 필수 | 설명 | 예시 |
|--------|------|------|------|
| `GEMINI_API_KEY` | ✅ | Google Gemini API 키 | `AIza...` |
| `JWT_SECRET` | ✅ | JWT 서명 시크릿 (32자 이상 권장) | `my-secret-key-...` |
| `POSTGRES_USER` | ✅ | PostgreSQL 유저명 | `anook_user` |
| `POSTGRES_PASSWORD` | ✅ | PostgreSQL 비밀번호 | `anook_password` |
| `POSTGRES_DB` | ✅ | PostgreSQL DB명 | `anook_db` |
| `NEO4J_USER` | ✅ | Neo4j 유저명 | `neo4j` |
| `NEO4J_PASSWORD` | ✅ | Neo4j 비밀번호 | `anook2026` |
| `KOREAEXIM_AUTH_KEY` | ⬜ | 한국수출입은행 환율 API 키 | `your_key` |
| `FRONTEND_PORT` | ⬜ | 프론트 외부 포트 (기본 3000) | `3000` |
| `SPRING_PROFILE` | ⬜ | Spring 프로파일 (기본 prod) | `prod` / `local` |
| `DISABLE_SECURE_COOKIE` | ⬜ | HTTP 환경에서 쿠키 허용 (로컬) | `true` |
| `GEMINI_AB_MODEL` | ⬜ | A/B 테스트용 챌린저 모델명 | `gemini-3.5-flash` |

---

## 🔧 자주 발생하는 문제

### AI 서버가 시작되지 않는 경우

```bash
# Neo4j 헬스체크를 기다리지 못하는 경우 — 로그 확인
docker logs anook-ai

# Neo4j가 완전히 뜰 때까지 기다린 후 AI 서버만 재시작
docker-compose restart ai
```

### pgvector 임베딩이 초기화되지 않는 경우

```bash
# AI 서버 컨테이너 내부에서 시딩 수동 실행
docker exec -it anook-ai python seed_all.py
```

### Neo4j 그래프 데이터가 비어있는 경우

```bash
# Graph RAG 인제스트 수동 실행
docker exec -it anook-ai python ingest_graph.py
```

### 로컬에서 쿠키 인증이 안 되는 경우 (HTTP)

`.env`에 아래 항목 추가:
```env
DISABLE_SECURE_COOKIE=true
```

---

*(이 README는 `docs/아키텍처_구조_제안.md`, `docs/기술_스펙_정리안.md`, `docs/AI_model_comparison_report.md`를 바탕으로 작성되었습니다.)*
