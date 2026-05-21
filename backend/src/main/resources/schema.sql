-- ============================================================
-- 아늑(Aneuk) 호텔 AI 컨시어지 — DDL (PostgreSQL 16 + pgvector)
-- ============================================================

-- pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 1. 코드/룩업 테이블
-- ============================================================

-- 부서
CREATE TABLE IF NOT EXISTS department (
    id          VARCHAR(20)  PRIMARY KEY,
    name        VARCHAR(50)  NOT NULL,
    is_frontdesk BOOLEAN     NOT NULL DEFAULT FALSE
);

-- 직원 역할
CREATE TABLE IF NOT EXISTS staff_role (
    id            BIGSERIAL    PRIMARY KEY,
    department_id VARCHAR(20)  NOT NULL REFERENCES department(id),
    name          VARCHAR(50)  NOT NULL
);

-- ============================================================
-- 2. ANOOK 핵심 엔티티 테이블
-- ============================================================

-- 객실 (ANOOK) — 호실 번호만 보유. PMS에서 목록 수신.
CREATE TABLE IF NOT EXISTS room (
    number      VARCHAR(10)  PRIMARY KEY
);

-- 직원
CREATE TABLE IF NOT EXISTS staff (
    id              BIGSERIAL    PRIMARY KEY,
    name            VARCHAR(50)  NOT NULL,
    pin             VARCHAR(10)  NOT NULL UNIQUE,
    role_id         BIGINT       NOT NULL REFERENCES staff_role(id),
    department_id   VARCHAR(20)  NOT NULL REFERENCES department(id),
    jti             VARCHAR(100) -- 중복 로그인 방지를 위한 JWT ID
);

-- (guest 테이블은 pms_guest로 통합됨 — 아래 PMS 섹션 참조)

-- ============================================================
-- 3. 요청/메시지 테이블
-- ============================================================

-- 고객 요청 (핵심 테이블)
CREATE TABLE IF NOT EXISTS request (
    id                  BIGSERIAL    PRIMARY KEY,
    status              VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    priority            VARCHAR(10)  NOT NULL DEFAULT 'NORMAL',
    department_id       VARCHAR(20)  NOT NULL REFERENCES department(id),
    entities            JSONB,
    raw_text            TEXT,
    summary             TEXT,
    confidence          REAL,
    room_no             VARCHAR(10)  NOT NULL REFERENCES room(number),
    assigned_staff_id   BIGINT       REFERENCES staff(id),
    guest_id            BIGINT,      -- PMS 투숙객 ID (RAG 및 이력 관리용)
    version             INT          NOT NULL DEFAULT 0,
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- AI 대화 메시지
CREATE TABLE IF NOT EXISTS message (
    id                  BIGSERIAL    PRIMARY KEY,
    sender_type         VARCHAR(10)  NOT NULL,
    content             TEXT         NOT NULL,
    translated_content  TEXT,
    room_no             VARCHAR(10)  NOT NULL REFERENCES room(number),
    guest_id            BIGINT,      -- PMS 투숙객 ID (데이터 격리 및 RAG용)
    request_id          BIGINT       REFERENCES request(id),
    sentiment           VARCHAR(10), -- 'POSITIVE' | 'NEGATIVE' (VOC 필터링용)
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. AI 지식/학습 테이블
-- ============================================================

-- RAG 지식 DB (벡터 검색)
CREATE TABLE IF NOT EXISTS knowledge_entry (
    id              BIGSERIAL    PRIMARY KEY,
    question        TEXT         NOT NULL,
    answer          TEXT         NOT NULL,
    embedding       vector(768),
    domain_code     VARCHAR(20),
    status          VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    approved_by     BIGINT       REFERENCES staff(id),
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- 미답변 질문 (플라이휠)
CREATE TABLE IF NOT EXISTS unanswered_question (
    id                  BIGSERIAL    PRIMARY KEY,
    question            TEXT         NOT NULL,
    domain_code         VARCHAR(20),
    cluster_id          VARCHAR(50),
    suggested_answer    TEXT,
    status              VARCHAR(20)  NOT NULL DEFAULT 'NEW',
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- AI 자가 튜닝용 Few-Shot 데이터
CREATE TABLE IF NOT EXISTS fewshot_example (
    id              BIGSERIAL    PRIMARY KEY,
    input_text      TEXT         NOT NULL,
    correct_output  JSONB        NOT NULL,
    domain_code     VARCHAR(20)  NOT NULL,
    corrected_by    BIGINT       REFERENCES staff(id),
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. 운영/감사 테이블
-- ============================================================

-- AI 통신 및 성능 기록 로그 (비즈니스 로직과 분리)
CREATE TABLE IF NOT EXISTS ai_log (
    id                  BIGSERIAL    PRIMARY KEY,
    request_id          BIGINT       REFERENCES request(id),
    model_name          VARCHAR(100),
    raw_prompt          TEXT,
    raw_response        TEXT,
    prompt_tokens       INT,
    completion_tokens   INT,
    latency_ms          INT,
    is_fallback         BOOLEAN,
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- 교대 인수인계 브리핑 (AI 자동 생성)
CREATE TABLE IF NOT EXISTS handover_briefing (
    id                      BIGSERIAL    PRIMARY KEY,
    shift_start             TIMESTAMP    NOT NULL,
    shift_end               TIMESTAMP    NOT NULL,
    total_request_count     INT          NOT NULL DEFAULT 0,
    pending_count           INT          NOT NULL DEFAULT 0,
    escalated_count         INT          NOT NULL DEFAULT 0,
    summary                 TEXT,
    created_at              TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- 실시간 알림 발송 이력 (감사 로그)
CREATE TABLE IF NOT EXISTS dispatch_log (
    id          BIGSERIAL    PRIMARY KEY,
    target      VARCHAR(100) NOT NULL,
    event_type  VARCHAR(30)  NOT NULL,
    payload     TEXT,
    sent_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. PMS 테이블 (발표용 더미 데이터 — ANOOK과 분리)
-- ============================================================

-- PMS 객실
CREATE TABLE IF NOT EXISTS pms_room (
    number      VARCHAR(10)  PRIMARY KEY,
    type        VARCHAR(20)  NOT NULL
);

-- PMS 투숙객 (개인정보 포함 — ANOOK 접근 불가)
CREATE TABLE IF NOT EXISTS pms_guest (
    id              BIGSERIAL       PRIMARY KEY,
    room_no         VARCHAR(10)     NOT NULL UNIQUE
                                    REFERENCES pms_room(number)
                                    ON DELETE CASCADE,
    name            VARCHAR(50)     NOT NULL,
    phone           VARCHAR(20),
    access_code     VARCHAR(100)    UNIQUE,
    checkin_date    TIMESTAMP       NOT NULL DEFAULT NOW(),
    checkout_date   DATE            NOT NULL
);

-- PMS 메뉴 (룸서비스 메뉴 마스터)
CREATE TABLE IF NOT EXISTS pms_menu (
    id          BIGSERIAL    PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    price       INTEGER      NOT NULL,
    price_usd   DOUBLE PRECISION,
    category    VARCHAR(30)  NOT NULL,
    allergens   VARCHAR(200),
    options     TEXT,
    available   BOOLEAN      NOT NULL DEFAULT TRUE
);

-- PMS 영수증 (룸서비스 주문 내역 — 결제 관리)
CREATE TABLE IF NOT EXISTS pms_receipt (
    id          BIGSERIAL    PRIMARY KEY,
    room_no     VARCHAR(10)  NOT NULL REFERENCES pms_room(number),
    menu_id     BIGINT       NOT NULL REFERENCES pms_menu(id),
    quantity    INTEGER      NOT NULL DEFAULT 1,
    total_price INTEGER      NOT NULL,
    status      VARCHAR(20)  NOT NULL DEFAULT 'UNPAID',
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. 인덱스 및 스키마 마이그레이션
-- ============================================================

-- [2026-05-04] 신규 컬럼 마이그레이션 (인덱스 생성 전 실행 필요)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS jti VARCHAR(100);
ALTER TABLE pms_guest ADD COLUMN IF NOT EXISTS access_code VARCHAR(100) UNIQUE;
ALTER TABLE request ADD COLUMN IF NOT EXISTS guest_id BIGINT;
ALTER TABLE message ADD COLUMN IF NOT EXISTS guest_id BIGINT;


-- 요청 조회 성능
CREATE INDEX IF NOT EXISTS idx_request_status ON request(status);
CREATE INDEX IF NOT EXISTS idx_request_room_no ON request(room_no);
CREATE INDEX IF NOT EXISTS idx_request_department_id ON request(department_id);
CREATE INDEX IF NOT EXISTS idx_request_created_at ON request(created_at DESC);

-- 메시지 조회 성능
CREATE INDEX IF NOT EXISTS idx_message_room_no ON message(room_no);
CREATE INDEX IF NOT EXISTS idx_message_guest_id ON message(guest_id);
CREATE INDEX IF NOT EXISTS idx_message_request_id ON message(request_id);

-- 지식 도메인별 필터링
CREATE INDEX IF NOT EXISTS idx_knowledge_domain ON knowledge_entry(domain_code);
CREATE INDEX IF NOT EXISTS idx_knowledge_status ON knowledge_entry(status);
CREATE INDEX IF NOT EXISTS idx_unanswered_status ON unanswered_question(status);
CREATE INDEX IF NOT EXISTS idx_dispatch_sent_at ON dispatch_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_log_request_id ON ai_log(request_id);

-- PMS 영수증 조회 성능
CREATE INDEX IF NOT EXISTS idx_receipt_room_no ON pms_receipt(room_no);
CREATE INDEX IF NOT EXISTS idx_receipt_status ON pms_receipt(status);

-- ============================================================
-- 8. 스키마 마이그레이션 (신규 컬럼/인덱스)
-- ============================================================
-- ↓↓↓ 새 변경사항은 날짜와 작성자를 기록하고 여기에 추가하세요 ↓↓↓
-- 참고: docs/DB_스키마_변경_가이드.md

-- 예시:

-- [2026-05-06] 고객 취소 요청 승인 워크플로우
ALTER TABLE request ADD COLUMN IF NOT EXISTS cancel_requested BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE request ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMP;
-- [2026-05-07] F&B 메뉴 선택옵션(options) 컬럼 추가 (혜연)
ALTER TABLE pms_menu ADD COLUMN IF NOT EXISTS options VARCHAR(500);

-- [2026-05-13] AI 판단 근거 저장
ALTER TABLE request ADD COLUMN IF NOT EXISTS reasoning TEXT;

-- [2026-05-14] VOC 감성 분석 컬럼 추가
ALTER TABLE message ADD COLUMN IF NOT EXISTS sentiment VARCHAR(10);

-- [2026-05-15] 고객 피드백 별점 컬럼 추가 (1~5, NULL=미평가)
ALTER TABLE request ADD COLUMN IF NOT EXISTS rating SMALLINT;

-- [2026-05-19] Admin 역할을 Frontdesk로 변경 (안전한 교체 방식)
ALTER TABLE department ADD COLUMN IF NOT EXISTS is_frontdesk BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE department DROP COLUMN IF EXISTS is_admin;

-- [2026-05-20] RAG 동시성 보장을 위한 복합 UNIQUE 인덱스 추가 (AN-351)
-- UNIQUE 제약을 걸기 전에 기존 중복 데이터를 먼저 제거 (가장 큰 id 1건만 유지).
-- 이 DELETE 가 없으면 이미 중복이 있는 환경에서 인덱스 생성 시 PSQLException 발생 → 백엔드 부팅 실패.
DELETE FROM knowledge_entry a
USING knowledge_entry b
WHERE a.id < b.id
  AND a.domain_code = b.domain_code
  AND a.question = b.question;

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_entry_unique_domain_question
ON knowledge_entry(domain_code, question);

-- [2026-05-20] 메뉴 테이블에 달러 가격(price_usd) 컬럼 추가
ALTER TABLE pms_menu ADD COLUMN IF NOT EXISTS price_usd DOUBLE PRECISION;

