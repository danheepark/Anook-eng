-- ============================================================
-- 아늑(Aneuk) 초기 데이터
-- ============================================================

-- 부서 (UPSERT: 부서명/관리자 여부 변경 시 자동 반영)
INSERT INTO department (id, name, is_frontdesk) VALUES
    ('HK',        '하우스키핑',   FALSE),
    ('FB',        '식음료',       FALSE),
    ('FACILITY',  '시설관리',     FALSE),
    ('CONCIERGE', '컨시어지',     FALSE),
    ('FRONT',     '프론트데스크', TRUE),
    ('EMERGENCY', '긴급대응팀',   FALSE)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    is_frontdesk = EXCLUDED.is_frontdesk;

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
    ('James Carter', '000000', 2, 'FRONT')
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
    ('James Carter', '000000', 2, 'FRONT')
ON CONFLICT (pin) DO NOTHING;

-- 일반 직원 계정 (PIN: 111111)
INSERT INTO staff (name, pin, role_id, department_id) VALUES
    ('Sarah Williams', '111111', 1, 'HK')
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
    (1, 'Emma Brown', '1234', 1, 'HK')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PMS 룸서비스 메뉴 (더미 데이터)
-- ============================================================
INSERT INTO pms_menu (name, price, price_usd, category, allergens, options, available) VALUES
    -- MAIN (메인 요리)
    ('클래식 치즈버거',      15000, 11.5, 'MAIN',    '밀,유제품',        NULL,                          TRUE),
    ('트러플 머쉬룸 리조또', 28000, 21.5, 'MAIN',    '유제품',           NULL,                          TRUE),
    ('한우 불고기 덮밥',     22000, 17.0, 'MAIN',    '대두,밀',          NULL,                          TRUE),
    ('시저 샐러드',          14000, 10.8, 'MAIN',    '유제품,계란',      '[{"groupName": "드레싱", "isRequired": true, "items": ["시저", "발사믹", "없음"]}]',      TRUE),
    ('해산물 파스타',        25000, 19.2, 'MAIN',    '밀,갑각류,연체류', NULL,                          TRUE),
    ('스테이크 샌드위치',    20000, 15.4, 'MAIN',    '밀,유제품',        '[{"groupName": "굽기", "isRequired": true, "items": ["레어", "미디엄", "웰던"]}]',        TRUE),
    -- SIDE (사이드)
    ('감자튀김',             8000,  6.2,  'SIDE',    NULL,               NULL,                          TRUE),
    ('시즌 과일 플레이트',   12000, 9.2,  'SIDE',    NULL,               NULL,                          TRUE),
    ('모짜렐라 스틱',        10000, 7.7,  'SIDE',    '밀,유제품',        NULL,                          TRUE),
    -- DRINK (음료)
    ('콜라',                 4000,  3.1,  'DRINK',   NULL,               '[{"groupName": "종류", "isRequired": true, "items": ["일반", "제로"]}]',               TRUE),
    ('오렌지 주스',          6000,  4.6,  'DRINK',   NULL,               NULL,                          TRUE),
    ('아메리카노',           5000,  3.8,  'DRINK',   NULL,               '[{"groupName": "온도", "isRequired": true, "items": ["HOT", "ICE"]}]',                TRUE),
    ('캐모마일 티',          5000,  3.8,  'DRINK',   NULL,               '[{"groupName": "온도", "isRequired": true, "items": ["HOT", "ICE"]}]',                TRUE),
    -- DESSERT (디저트)
    ('뉴욕 치즈케이크',      12000, 9.2,  'DESSERT', '밀,유제품,계란',        NULL,                    TRUE),
    ('초콜릿 브라우니',      10000, 7.7,  'DESSERT', '밀,유제품,계란,견과류', NULL,                    TRUE),
    ('바닐라 아이스크림',    8000,  6.2,  'DESSERT', '유제품',               NULL,                    TRUE),
    -- HK (하우스키핑 유료 서비스)
    ('추가 수건',            1000,  0.8,  'HK_AMENITY',    NULL, NULL, TRUE),
    ('생수 추가',            2000,  1.5,  'HK_AMENITY',    NULL, NULL, TRUE),
    ('어메니티 팩',          3000,  2.3,  'HK_AMENITY',    NULL, NULL, TRUE),
    ('엑스트라 베드',        50000, 38.5, 'HK_FURNITURE',  NULL, NULL, TRUE),
    ('긴급 세탁',            10000, 7.7,  'HK_LAUNDRY',    NULL, NULL, TRUE),
    ('일반 세탁',            7000,  5.4,  'HK_LAUNDRY',    NULL, NULL, TRUE),
    ('미니바 맥주',          8000,  6.2,  'HK_MINIBAR',    NULL, NULL, TRUE),
    ('미니바 와인',          15000, 11.5, 'HK_MINIBAR',    NULL, NULL, TRUE),
    ('미니바 스낵',          5000,  3.8,  'HK_MINIBAR',    NULL, NULL, TRUE)
ON CONFLICT (name) DO NOTHING;

-- [2026-05-20] 기존 메뉴 데이터에 price_usd 정보 반영 (로컬 인스턴스 마이그레이션용)
UPDATE pms_menu SET price_usd = 11.5 WHERE name = '클래식 치즈버거' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 21.5 WHERE name = '트러플 머쉬룸 리조또' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 17.0 WHERE name = '한우 불고기 덮밥' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 10.8 WHERE name = '시저 샐러드' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 19.2 WHERE name = '해산물 파스타' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 15.4 WHERE name = '스테이크 샌드위치' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 6.2 WHERE name = '감자튀김' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 9.2 WHERE name = '시즌 과일 플레이트' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 7.7 WHERE name = '모짜렐라 스틱' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 3.1 WHERE name = '콜라' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 4.6 WHERE name = '오렌지 주스' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 3.8 WHERE name = '아메리카노' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 3.8 WHERE name = '캐모마일 티' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 9.2 WHERE name = '뉴욕 치즈케이크' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 7.7 WHERE name = '초콜릿 브라우니' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 6.2 WHERE name = '바닐라 아이스크림' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 0.8 WHERE name = '추가 수건' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 1.5 WHERE name = '생수 추가' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 2.3 WHERE name = '어메니티 팩' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 38.5 WHERE name = '엑스트라 베드' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 7.7 WHERE name = '긴급 세탁' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 5.4 WHERE name = '일반 세탁' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 6.2 WHERE name = '미니바 맥주' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 11.5 WHERE name = '미니바 와인' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 3.8 WHERE name = '미니바 스낵' AND price_usd IS NULL;




-- ============================================================4ㄱ
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

-- ============================================================
-- HOTEL OPERATIONS DUMMY DATA (English)
-- ============================================================
-- 1. REQUESTS (Task Tickets)
INSERT INTO request (id, status, priority, department_id, raw_text, summary, room_no, guest_id, rating, reasoning, created_at, updated_at) VALUES
    (101, 'DONE', 'NORMAL', 'HK', 'Could you bring 2 extra bath towels to my room?', 'Need 2 extra towels', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 5, 'Guest requested basic amenity', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
    (102, 'DONE', 'URGENT', 'FACILITY', 'The air conditioning unit is making a rattling noise.', 'AC noise issue', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 4, 'Maintenance requested due to noise', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
    (103, 'PENDING', 'NORMAL', 'FB', 'I want to order a Classic Cheeseburger for room service.', 'Room service: Cheeseburger', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), NULL, 'Food and beverage order', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes'),
    (104, 'IN_PROGRESS', 'URGENT', 'FRONT', 'My room key card is not working anymore.', 'Key card issue', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), NULL, 'Front desk assistance required', NOW() - INTERVAL '15 minutes', NOW() - INTERVAL '10 minutes'),
    (105, 'DONE', 'NORMAL', 'CONCIERGE', 'Can you recommend a nice Italian restaurant nearby?', 'Restaurant recommendation', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 5, 'Concierge service requested', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
    (106, 'DONE', 'NORMAL', 'HK', 'The bathroom was not cleaned properly. There is hair in the tub.', 'Bathroom cleaning complaint', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 1, 'Housekeeping complaint', NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days'),
    (107, 'DONE', 'NORMAL', 'FRONT', 'Can I request a late checkout for tomorrow?', 'Late checkout request', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 5, 'Guest requested late checkout', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours')
ON CONFLICT (id) DO NOTHING;

SELECT setval('request_id_seq', (SELECT COALESCE(MAX(id), 107) FROM request));

-- 2. MESSAGES (Chat History & VOC)
INSERT INTO message (sender_type, content, translated_content, room_no, guest_id, request_id, sentiment, created_at) VALUES
    ('GUEST', 'Could you bring 2 extra bath towels to my room?', '수건 2장 더 주시겠어요?', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 101, 'NEUTRAL', NOW() - INTERVAL '3 days 1 hour'),
    ('AI', 'Absolutely. I have dispatched a housekeeping staff member with the towels.', '물론입니다. 하우스키핑 직원이 수건을 가져다 드릴 것입니다.', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 101, 'POSITIVE', NOW() - INTERVAL '3 days 59 minutes'),
    ('GUEST', 'The air conditioning unit is making a rattling noise. It is impossible to sleep.', '에어컨에서 덜그럭 소리가 납니다. 잠을 잘 수가 없어요.', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 102, 'NEGATIVE', NOW() - INTERVAL '2 days 2 hours'),
    ('AI', 'I sincerely apologize for the inconvenience. A technician is on the way.', '불편을 드려 진심으로 사과드립니다. 기술자가 가고 있습니다.', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 102, 'NEUTRAL', NOW() - INTERVAL '2 days 1 hour 55 minutes'),
    ('GUEST', 'I want to order a Classic Cheeseburger for room service.', '클래식 치즈버거를 방으로 주문하고 싶습니다.', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 103, 'NEUTRAL', NOW() - INTERVAL '35 minutes'),
    ('AI', 'Your order is confirmed. It will take approximately 20 minutes.', '주문이 확인되었습니다. 약 20분 정도 소요될 예정입니다.', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 103, 'POSITIVE', NOW() - INTERVAL '34 minutes'),
    ('GUEST', 'My room key card is not working anymore. I am stuck outside.', '키 카드가 작동하지 않아요. 밖에 갇혔습니다.', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 104, 'NEGATIVE', NOW() - INTERVAL '20 minutes'),
    ('AI', 'I am so sorry. A front desk staff will come up with a replacement key immediately.', '정말 죄송합니다. 프론트 데스크 직원이 즉시 새 키를 가지고 올라갈 것입니다.', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 104, 'NEUTRAL', NOW() - INTERVAL '19 minutes'),
    ('GUEST', 'Can you recommend a nice Italian restaurant nearby?', '근처에 맛있는 이탈리안 레스토랑 추천해 주시겠어요?', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 105, 'NEUTRAL', NOW() - INTERVAL '1 day 2 hours'),
    ('AI', 'I recommend "La Trattoria" which is just a 5-minute walk from our hotel.', '호텔에서 도보 5분 거리에 있는 "La Trattoria"를 추천합니다.', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 105, 'POSITIVE', NOW() - INTERVAL '1 day 1 hour 55 minutes'),
    ('GUEST', 'The bathroom was not cleaned properly. There is hair in the tub. This is unacceptable.', '욕실 청소가 제대로 안 되어 있네요. 욕조에 머리카락이 있습니다. 용납할 수 없어요.', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 106, 'NEGATIVE', NOW() - INTERVAL '4 days 2 hours'),
    ('AI', 'I am incredibly sorry for the poor condition. We will send housekeeping right away to clean it thoroughly.', '상태가 불량하여 대단히 죄송합니다. 즉시 하우스키핑을 보내 깨끗하게 청소하겠습니다.', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 106, 'NEUTRAL', NOW() - INTERVAL '4 days 1 hour 55 minutes'),
    ('GUEST', 'Can I request a late checkout for tomorrow? Like 1 PM?', '내일 오후 1시로 레이트 체크아웃 요청할 수 있을까요?', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 107, 'NEUTRAL', NOW() - INTERVAL '5 hours 10 minutes'),
    ('AI', 'Yes, I have extended your checkout time to 1:00 PM free of charge.', '네, 체크아웃 시간을 오후 1시로 무료 연장해 드렸습니다.', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 107, 'POSITIVE', NOW() - INTERVAL '5 hours 5 minutes');

-- 3. KNOWLEDGE ENTRY (RAG Knowledge base)
INSERT INTO knowledge_entry (question, answer, domain_code, status, approved_by, created_at, updated_at) VALUES
    ('Is there a swimming pool in the hotel?', 'Yes, the hotel has an indoor swimming pool on the 3rd floor. It is open from 6:00 AM to 10:00 PM daily.', 'FACILITY', 'APPROVED', 1, NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days'),
    ('Do you provide airport shuttle service?', 'Yes, we provide complimentary airport shuttle service every hour from 5:00 AM to 11:00 PM. Please book in advance at the front desk.', 'CONCIERGE', 'APPROVED', 1, NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days'),
    ('What are the breakfast hours?', 'Breakfast is served at the main restaurant on the 1st floor from 6:30 AM to 10:00 AM.', 'FB', 'APPROVED', 1, NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days'),
    ('Are pets allowed in the rooms?', 'Pets are not allowed in standard rooms. However, we have specific pet-friendly suites. Please contact the front desk for availability.', 'FRONT', 'APPROVED', 1, NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days'),
    ('How much does laundry service cost?', 'Laundry service costs vary by item. A standard shirt costs $5. For same-day service, please leave items by 9:00 AM.', 'HK', 'PENDING', NULL, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day');

-- 4. UNANSWERED QUESTIONS
INSERT INTO unanswered_question (question, domain_code, cluster_id, suggested_answer, status, created_at) VALUES
    ('Can I rent a bicycle from the hotel?', 'CONCIERGE', 'c_rent_bike', 'We are planning to partner with a local rental service next month.', 'NEW', NOW() - INTERVAL '2 days'),
    ('Do you have vegan options for room service?', 'FB', 'c_vegan_menu', 'We offer a vegan salad and a plant-based burger. Would you like to see the full menu?', 'NEW', NOW() - INTERVAL '1 day'),
    ('Is the rooftop bar open during winter?', 'FB', 'c_rooftop_winter', NULL, 'NEW', NOW() - INTERVAL '5 hours');

-- 5. FEW-SHOT EXAMPLES (AI Tuning)
INSERT INTO fewshot_example (input_text, correct_output, domain_code, corrected_by, created_at) VALUES
    ('My TV is broken.', '{"intent": "MAINTENANCE", "department": "FACILITY", "priority": "URGENT", "summary": "TV broken"}', 'FACILITY', 1, NOW() - INTERVAL '5 days'),
    ('I need some extra pillows.', '{"intent": "AMENITY", "department": "HK", "priority": "NORMAL", "summary": "Extra pillows requested"}', 'HK', 1, NOW() - INTERVAL '4 days');

-- 6. AI LOG (Performance & Audit)
INSERT INTO ai_log (request_id, model_name, raw_prompt, raw_response, prompt_tokens, completion_tokens, latency_ms, is_fallback, created_at) VALUES
    (101, 'gemini-2.5-flash', 'User requested 2 extra bath towels. Parse intent.', '{"intent": "AMENITY", "department": "HK"}', 150, 45, 1200, FALSE, NOW() - INTERVAL '3 days 59 minutes'),
    (102, 'gemini-2.5-flash', 'User complains about AC rattling noise. Parse intent.', '{"intent": "MAINTENANCE", "department": "FACILITY"}', 160, 50, 1350, FALSE, NOW() - INTERVAL '2 days 1 hour 55 minutes'),
    (106, 'gemini-2.5-flash', 'User angry about hair in tub. Parse intent.', '{"intent": "COMPLAINT", "department": "HK"}', 180, 55, 1420, FALSE, NOW() - INTERVAL '4 days 1 hour 55 minutes');

-- 7. HANDOVER BRIEFING (Shift Handover)
INSERT INTO handover_briefing (shift_start, shift_end, total_request_count, pending_count, escalated_count, summary, created_at) VALUES
    (NOW() - INTERVAL '16 hours', NOW() - INTERVAL '8 hours', 24, 0, 1, 'Night shift was mostly quiet. One AC issue reported in Room 101, passed to day shift maintenance. Late checkout confirmed for 707.', NOW() - INTERVAL '8 hours'),
    (NOW() - INTERVAL '24 hours', NOW() - INTERVAL '16 hours', 45, 2, 3, 'Busy afternoon. Multiple room service requests. A housekeeping complaint for 101 was resolved.', NOW() - INTERVAL '16 hours');

-- 8. DISPATCH LOG (Websocket/Push Notifications)
INSERT INTO dispatch_log (target, event_type, payload, sent_at) VALUES
    ('/topic/dept/HK', 'NEW_REQUEST', '{"requestId": 101, "message": "New towel request"}', NOW() - INTERVAL '3 days 1 hour'),
    ('/topic/dept/FACILITY', 'NEW_REQUEST', '{"requestId": 102, "message": "AC issue reported"}', NOW() - INTERVAL '2 days 2 hours'),
    ('/topic/dept/FRONT', 'ESCALATION', '{"requestId": 104, "message": "Guest locked out"}', NOW() - INTERVAL '20 minutes');

-- 9. ADDITIONAL ACTIVE REQUESTS (Task Tickets)
INSERT INTO request (id, status, priority, department_id, raw_text, summary, room_no, guest_id, reasoning, created_at, updated_at) VALUES
    (108, 'PENDING', 'NORMAL', 'HK', 'Can I get an extra bed for my room?', 'Extra bed request', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 'Guest requested furniture', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '10 minutes'),
    (109, 'IN_PROGRESS', 'URGENT', 'FACILITY', 'The toilet is clogged and overflowing.', 'Clogged toilet', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 'Urgent plumbing issue', NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '5 minutes'),
    (110, 'PENDING', 'NORMAL', 'CONCIERGE', 'I need a taxi to the airport at 5 AM tomorrow.', 'Airport taxi booking', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 'Transportation assistance', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),
    (111, 'PENDING', 'URGENT', 'EMERGENCY', 'My child has a high fever, do you have a doctor?', 'Medical assistance needed', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 'Health and safety emergency', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '5 minutes'),
    (112, 'IN_PROGRESS', 'NORMAL', 'FB', 'Could you bring a bucket of ice and two wine glasses?', 'Ice bucket and glasses', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 'Room service amenity', NOW() - INTERVAL '40 minutes', NOW() - INTERVAL '15 minutes'),
    (113, 'PENDING', 'NORMAL', 'FRONT', 'The guest in the next room is playing very loud music.', 'Noise complaint', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 'Guest disturbance', NOW() - INTERVAL '12 minutes', NOW() - INTERVAL '12 minutes')
ON CONFLICT (id) DO NOTHING;

SELECT setval('request_id_seq', (SELECT COALESCE(MAX(id), 113) FROM request));

INSERT INTO message (sender_type, content, translated_content, room_no, guest_id, request_id, sentiment, created_at) VALUES
    ('GUEST', 'Can I get an extra bed for my room?', '방에 엑스트라 베드 하나 추가할 수 있을까요?', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 108, 'NEUTRAL', NOW() - INTERVAL '11 minutes'),
    ('AI', 'An extra bed costs $38.5. Shall I request it for you?', '엑스트라 베드는 $38.5 입니다. 요청해 드릴까요?', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 108, 'NEUTRAL', NOW() - INTERVAL '10 minutes 30 seconds'),
    ('GUEST', 'Yes, please.', '네, 부탁합니다.', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 108, 'POSITIVE', NOW() - INTERVAL '10 minutes'),
    
    ('GUEST', 'The toilet is clogged and overflowing.', '변기가 막혀서 넘치고 있어요.', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 109, 'NEGATIVE', NOW() - INTERVAL '26 minutes'),
    ('AI', 'I am dispatching the facility team immediately. Please step outside the bathroom.', '즉시 시설팀을 파견하겠습니다. 욕실 밖으로 나와 계셔주세요.', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 109, 'NEUTRAL', NOW() - INTERVAL '25 minutes'),
    
    ('GUEST', 'I need a taxi to the airport at 5 AM tomorrow.', '내일 오전 5시에 공항으로 가는 택시가 필요합니다.', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 110, 'NEUTRAL', NOW() - INTERVAL '1 hour 2 minutes'),
    ('AI', 'I have forwarded your request to the concierge. They will arrange it for you.', '컨시어지 부서에 요청을 전달했습니다. 택시 배차를 도와드릴 것입니다.', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 110, 'POSITIVE', NOW() - INTERVAL '1 hour'),
    
    ('GUEST', 'My child has a high fever, do you have a doctor?', '아이가 고열이 납니다. 의사가 있나요?', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 111, 'NEGATIVE', NOW() - INTERVAL '6 minutes'),
    ('AI', 'I am contacting the emergency response team right now. Please stay calm.', '지금 즉시 긴급 대응팀에 연락 중입니다. 진정하시기 바랍니다.', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 111, 'NEUTRAL', NOW() - INTERVAL '5 minutes'),
    
    ('GUEST', 'Could you bring a bucket of ice and two wine glasses?', '얼음 바스켓과 와인잔 두 개 가져다 주시겠어요?', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 112, 'NEUTRAL', NOW() - INTERVAL '41 minutes'),
    ('AI', 'I will have the Food and Beverage team bring them up to your room.', '식음료 팀에서 방으로 가져다 드리도록 하겠습니다.', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 112, 'POSITIVE', NOW() - INTERVAL '40 minutes'),
    
    ('GUEST', 'The guest in the next room is playing very loud music.', '옆 방 손님이 너무 시끄러운 음악을 틀고 있어요.', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 113, 'NEGATIVE', NOW() - INTERVAL '13 minutes'),
    ('AI', 'I apologize for the disturbance. I will notify the front desk to handle it.', '소음으로 불편을 드려 죄송합니다. 프론트 데스크에 알리겠습니다.', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 113, 'NEUTRAL', NOW() - INTERVAL '12 minutes');
