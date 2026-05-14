-- ============================================================
-- 아늑(Aneuk) 초기 데이터
-- ============================================================

-- 부서 (UPSERT: 부서명/관리자 여부 변경 시 자동 반영)
INSERT INTO department (id, name, is_admin) VALUES
    ('HK',        '하우스키핑',   FALSE),
    ('FB',        '식음료',       FALSE),
    ('FACILITY',  '시설관리',     FALSE),
    ('CONCIERGE', '컨시어지',     FALSE),
    ('FRONT',     '프론트데스크', TRUE),
    ('EMERGENCY', '긴급대응팀',   FALSE)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    is_admin = EXCLUDED.is_admin;

-- (room_type은 더 이상 사용하지 않음)

-- 직원 역할 (UPSERT: 역할명/부서 변경 시 자동 반영)
INSERT INTO staff_role (id, department_id, name) VALUES
    (1, 'FRONT', '직원'),
    (2, 'FRONT', '관리자'),
    (3, 'FACILITY', '팀장'),
    (4, 'HK', '매니저'),
    (5, 'FB', '메인 셰프'),
    (6, 'CONCIERGE', '시니어'),
    (7, 'FACILITY', '엔지니어'),
    (8, 'HK', '현장 스태프'),
    (9, 'FB', '캡틴'),
    (10, 'CONCIERGE', '컨시어지')
ON CONFLICT (id) DO UPDATE SET
    department_id = EXCLUDED.department_id,
    name = EXCLUDED.name;

-- 초기 관리자 계정 (PIN: 000000)
INSERT INTO staff (name, pin, role_id, department_id) VALUES
    ('관리자', '000000', 2, 'FRONT')
ON CONFLICT (pin) DO NOTHING;

-- 시퀀스 동기화 (수동 INSERT로 인해 시퀀스가 1로 남아있는 문제 해결)
SELECT setval('staff_role_id_seq', (SELECT COALESCE(MAX(id), 1) FROM staff_role));

-- ============================================================
-- ANOOK 객실 (호실 번호만 — PMS에서 수신한 목록)
-- ============================================================
INSERT INTO room (number) VALUES
    ('101'), ('102'), ('103'), ('104'), ('105'), ('106'),
    ('201'), ('202'), ('203'), ('204'), ('205'),
    ('301'), ('302'), ('303'), ('304'), ('305'),
    ('401'), ('402'), ('403'),
    ('501'), ('502'), ('503'),
    ('707')
ON CONFLICT (number) DO NOTHING;

-- ============================================================
-- ★ 테스트용 직원 데이터 (PIN 6자리 변경) ★
-- ============================================================

-- 관리자 계정 (PIN: 000000)
INSERT INTO staff (name, pin, role_id, department_id) VALUES
    ('최관리', '000000', 2, 'FRONT')
ON CONFLICT (pin) DO NOTHING;

-- 일반 직원 계정 (PIN: 111111)
INSERT INTO staff (name, pin, role_id, department_id) VALUES
    ('김직원', '111111', 1, 'HK')
ON CONFLICT (pin) DO NOTHING;
-- PMS 객실 (6개 타입 · 총 23실)
INSERT INTO pms_room (number, type) VALUES
    -- 1층: 스탠다드 (기본 객실)
    ('101', 'STANDARD'), ('102', 'STANDARD'), ('103', 'STANDARD'),
    ('104', 'STANDARD'), ('105', 'STANDARD'), ('106', 'STANDARD'),
    -- 2층: 슈페리어 (전망 좋은 객실)
    ('201', 'SUPERIOR'), ('202', 'SUPERIOR'), ('203', 'SUPERIOR'),
    ('204', 'SUPERIOR'), ('205', 'SUPERIOR'),
    -- 3층: 디럭스 (넓은 고급 객실)
    ('301', 'DELUXE'),   ('302', 'DELUXE'),   ('303', 'DELUXE'),
    ('304', 'DELUXE'),   ('305', 'DELUXE'),
    -- 4층: 패밀리 (가족용 넓은 객실)
    ('401', 'FAMILY'),   ('402', 'FAMILY'),   ('403', 'FAMILY'),
    -- 5층: 스위트 (거실+침실 분리)
    ('501', 'SUITE'),    ('502', 'SUITE'),    ('503', 'SUITE'),
    -- 7층: 프레지덴셜 (VIP 최상위)
    ('707', 'PRESIDENTIAL')
ON CONFLICT (number) DO NOTHING;

-- 테스트용 직원 1명 (직원 ID 1)
INSERT INTO staff (id, name, pin, role_id, department_id) VALUES
    (1, '김아늑', '1234', 1, 'HK')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PMS 룸서비스 메뉴 (더미 데이터)
-- ============================================================
INSERT INTO pms_menu (name, price, category, allergens, options, available) VALUES
    -- MAIN (메인 요리)
    ('클래식 치즈버거',      15000, 'MAIN',    '밀,유제품',        NULL,                          TRUE),
    ('트러플 머쉬룸 리조또', 28000, 'MAIN',    '유제품',           NULL,                          TRUE),
    ('한우 불고기 덮밥',     22000, 'MAIN',    '대두,밀',          NULL,                          TRUE),
    ('시저 샐러드',          14000, 'MAIN',    '유제품,계란',      '드레싱:시저|발사믹|없음',      TRUE),
    ('해산물 파스타',        25000, 'MAIN',    '밀,갑각류,연체류', NULL,                          TRUE),
    ('스테이크 샌드위치',    20000, 'MAIN',    '밀,유제품',        '굽기:레어|미디엄|웰던',        TRUE),
    -- SIDE (사이드)
    ('감자튀김',             8000,  'SIDE',    NULL,               NULL,                          TRUE),
    ('시즌 과일 플레이트',   12000, 'SIDE',    NULL,               NULL,                          TRUE),
    ('모짜렐라 스틱',        10000, 'SIDE',    '밀,유제품',        NULL,                          TRUE),
    -- DRINK (음료)
    ('콜라',                 4000,  'DRINK',   NULL,               '종류:일반|제로',               TRUE),
    ('오렌지 주스',          6000,  'DRINK',   NULL,               NULL,                          TRUE),
    ('아메리카노',           5000,  'DRINK',   NULL,               '온도:HOT|ICE',                TRUE),
    ('캐모마일 티',          5000,  'DRINK',   NULL,               '온도:HOT|ICE',                TRUE),
    -- DESSERT (디저트)
    ('뉴욕 치즈케이크',      12000, 'DESSERT', '밀,유제품,계란',        NULL,                    TRUE),
    ('초콜릿 브라우니',      10000, 'DESSERT', '밀,유제품,계란,견과류', NULL,                    TRUE),
    ('바닐라 아이스크림',    8000,  'DESSERT', '유제품',               NULL,                    TRUE),
    -- HK (하우스키핑 유료 서비스)
    ('추가 수건',            1000,  'HK_AMENITY',    NULL, NULL, TRUE),
    ('생수 추가',            2000,  'HK_AMENITY',    NULL, NULL, TRUE),
    ('어메니티 팩',          3000,  'HK_AMENITY',    NULL, NULL, TRUE),
    ('엑스트라 베드',        50000, 'HK_FURNITURE',  NULL, NULL, TRUE),
    ('긴급 세탁',            10000, 'HK_LAUNDRY',    NULL, NULL, TRUE),
    ('일반 세탁',            7000,  'HK_LAUNDRY',    NULL, NULL, TRUE),
    ('미니바 맥주',          8000,  'HK_MINIBAR',    NULL, NULL, TRUE),
    ('미니바 와인',          15000, 'HK_MINIBAR',    NULL, NULL, TRUE),
    ('미니바 스낵',          5000,  'HK_MINIBAR',    NULL, NULL, TRUE)
ON CONFLICT DO NOTHING;



-- ============================================================
-- PMS 테스트 데이터 (투숙객 인증 테스트용)
-- ============================================================
INSERT INTO pms_guest (room_no, name, phone, access_code, checkout_date) VALUES
    ('707', '김철수', '010-1234-5678', 'test-guest-code-1234', '2024-12-31'),
    ('101', '테스트', '010-0000-0000', 'test-guest-code-1233', '2024-12-31')
ON CONFLICT (room_no) DO UPDATE SET
    access_code = EXCLUDED.access_code;

-- 시퀀스 동기화
SELECT setval('pms_guest_id_seq', (SELECT COALESCE(MAX(id), 1) FROM pms_guest));

-- ============================================================
-- AI 대화 메시지 시드 데이터 (격리 테스트용)
-- ============================================================
-- INSERT INTO message (sender_type, content, room_no, guest_id, created_at) VALUES
--     ('GUEST', '안녕하세요, 707호 홍길동입니다. 수건 좀 가져다주세요.', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), NOW() - INTERVAL '2 hours'),
--     ('AI',    '안녕하세요! 요청하신 대로 수건 2장을 하우스키핑 부서에 전달했습니다. 더 필요하신 게 있으신가요?', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), NOW() - INTERVAL '119 minutes'),
--     ('GUEST', '아, 그리고 스테이크 주문도 가능한가요?', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), NOW() - INTERVAL '60 minutes'),
--     ('AI',    '네, 가능합니다! 스테이크 굽기는 어떻게 해드릴까요?', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), NOW() - INTERVAL '59 minutes')
-- ON CONFLICT DO NOTHING;
