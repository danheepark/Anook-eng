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
    ('FRONT', '긴급대응팀',   FALSE)
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
    ('Classic Cheeseburger',      15000, 11.5, 'MAIN',    '밀,유제품',        NULL,                          TRUE),
    ('Truffle Mushroom Risotto', 28000, 21.5, 'MAIN',    '유제품',           NULL,                          TRUE),
    ('Beef Bulgogi Rice Bowl',     22000, 17.0, 'MAIN',    '대두,밀',          NULL,                          TRUE),
    ('Caesar Salad',          14000, 10.8, 'MAIN',    '유제품,계란',      '[{"groupName": "Dressing", "isRequired": true, "items": ["Caesar", "Balsamic", "None"]}]',      TRUE),
    ('Seafood Pasta',        25000, 19.2, 'MAIN',    '밀,갑각류,연체류', NULL,                          TRUE),
    ('Steak Sandwich',    20000, 15.4, 'MAIN',    '밀,유제품',        '[{"groupName": "Doneness", "isRequired": true, "items": ["Rare", "Medium", "Well-done"]}]',        TRUE),
    -- SIDE (사이드)
    ('French Fries',             8000,  6.2,  'SIDE',    NULL,               NULL,                          TRUE),
    ('Seasonal Fruit Plate',   12000, 9.2,  'SIDE',    NULL,               NULL,                          TRUE),
    ('Mozzarella Sticks',        10000, 7.7,  'SIDE',    '밀,유제품',        NULL,                          TRUE),
    -- DRINK (음료)
    ('Coke',                 4000,  3.1,  'DRINK',   NULL,               '[{"groupName": "Type", "isRequired": true, "items": ["Regular", "Zero"]}]',               TRUE),
    ('Orange Juice',          6000,  4.6,  'DRINK',   NULL,               NULL,                          TRUE),
    ('Americano',           5000,  3.8,  'DRINK',   NULL,               '[{"groupName": "Temperature", "isRequired": true, "items": ["HOT", "ICE"]}]',                TRUE),
    ('Chamomile Tea',          5000,  3.8,  'DRINK',   NULL,               '[{"groupName": "Temperature", "isRequired": true, "items": ["HOT", "ICE"]}]',                TRUE),
    -- DESSERT (디저트)
    ('New York Cheesecake',      12000, 9.2,  'DESSERT', '밀,유제품,계란',        NULL,                    TRUE),
    ('Chocolate Brownie',      10000, 7.7,  'DESSERT', '밀,유제품,계란,견과류', NULL,                    TRUE),
    ('Vanilla Ice Cream',    8000,  6.2,  'DESSERT', '유제품',               NULL,                    TRUE),
    -- HK (하우스키핑 유료 서비스)
    ('Extra Towel',            1000,  0.8,  'HK_AMENITY',    NULL, NULL, TRUE),
    ('Extra Bottled Water',            2000,  1.5,  'HK_AMENITY',    NULL, NULL, TRUE),
    ('Amenity Pack',          3000,  2.3,  'HK_AMENITY',    NULL, NULL, TRUE),
    ('Extra Bed',        50000, 38.5, 'HK_FURNITURE',  NULL, NULL, TRUE),
    ('Express Laundry',            10000, 7.7,  'HK_LAUNDRY',    NULL, NULL, TRUE),
    ('Standard Laundry',            7000,  5.4,  'HK_LAUNDRY',    NULL, NULL, TRUE),
    ('Minibar Beer',          8000,  6.2,  'HK_MINIBAR',    NULL, NULL, TRUE),
    ('Minibar Wine',          15000, 11.5, 'HK_MINIBAR',    NULL, NULL, TRUE),
    ('Minibar Snack',          5000,  3.8,  'HK_MINIBAR',    NULL, NULL, TRUE)
ON CONFLICT (name) DO NOTHING;

-- [2026-05-20] 기존 메뉴 데이터에 price_usd 정보 반영 (로컬 인스턴스 마이그레이션용)
UPDATE pms_menu SET price_usd = 11.5 WHERE name = 'Classic Cheeseburger' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 21.5 WHERE name = 'Truffle Mushroom Risotto' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 17.0 WHERE name = 'Beef Bulgogi Rice Bowl' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 10.8 WHERE name = 'Caesar Salad' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 19.2 WHERE name = 'Seafood Pasta' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 15.4 WHERE name = 'Steak Sandwich' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 6.2 WHERE name = 'French Fries' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 9.2 WHERE name = 'Seasonal Fruit Plate' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 7.7 WHERE name = 'Mozzarella Sticks' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 3.1 WHERE name = 'Coke' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 4.6 WHERE name = 'Orange Juice' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 3.8 WHERE name = 'Americano' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 3.8 WHERE name = 'Chamomile Tea' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 9.2 WHERE name = 'New York Cheesecake' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 7.7 WHERE name = 'Chocolate Brownie' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 6.2 WHERE name = 'Vanilla Ice Cream' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 0.8 WHERE name = 'Extra Towel' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 1.5 WHERE name = 'Extra Bottled Water' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 2.3 WHERE name = 'Amenity Pack' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 38.5 WHERE name = 'Extra Bed' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 7.7 WHERE name = 'Express Laundry' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 5.4 WHERE name = 'Standard Laundry' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 6.2 WHERE name = 'Minibar Beer' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 11.5 WHERE name = 'Minibar Wine' AND price_usd IS NULL;
UPDATE pms_menu SET price_usd = 3.8 WHERE name = 'Minibar Snack' AND price_usd IS NULL;




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
INSERT INTO request (id, status, priority, department_id, raw_text, summary, entities, room_no, guest_id, rating, reasoning, created_at, updated_at) VALUES
    (101, 'DONE', 'NORMAL', 'HK', 'Could you bring 2 extra bath towels to my room?', 'Need 2 extra towels', '{"items": [{"item": "Bath Towel", "count": 2}]}', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 5, 'Guest requested basic amenity', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
    (103, 'PENDING', 'NORMAL', 'FB', 'I want to order a Classic Cheeseburger for room service.', 'Room service: Cheeseburger', '{"menu_items": [{"name": "Classic Cheeseburger", "quantity": 1}]}', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), NULL, 'Food and beverage order', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes'),
    (105, 'DONE', 'NORMAL', 'CONCIERGE', 'Can you recommend a nice Italian restaurant nearby?', 'Restaurant recommendation', '{"intent": "RESTAURANT", "restaurant_name": "Italian Restaurant"}', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 5, 'Concierge service requested', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
    (106, 'DONE', 'NORMAL', 'HK', 'The bathroom was not cleaned properly. There is hair in the tub.', 'Bathroom cleaning complaint', '{"tasks": ["Bathroom deep cleaning"]}', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 1, 'Housekeeping complaint', NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days'),
    (107, 'DONE', 'NORMAL', 'FRONT', 'Can I request a late checkout for tomorrow?', 'Late checkout request', '{"intent": "LATE_CHECKOUT", "time": "1:00 PM"}', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 5, 'Guest requested late checkout', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours')
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
INSERT INTO request (id, status, priority, department_id, raw_text, summary, entities, room_no, guest_id, reasoning, created_at, updated_at) VALUES
    (108, 'PENDING', 'NORMAL', 'HK', 'Can I get an extra bed for my room?', 'Extra bed request', '{"items": [{"item": "Extra Bed", "count": 1}]}', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 'Guest requested furniture', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '10 minutes'),
    (110, 'PENDING', 'NORMAL', 'CONCIERGE', 'I need a taxi to the airport at 5 AM tomorrow.', 'Airport taxi booking', '{"intent": "TAXI", "destination": "Airport", "time": "5:00 AM"}', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 'Transportation assistance', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),
    (112, 'IN_PROGRESS', 'NORMAL', 'FB', 'Could you bring a bucket of ice and two wine glasses?', 'Ice bucket and glasses', '{"menu_items": [{"name": "Ice Bucket", "quantity": 1}, {"name": "Wine Glass", "quantity": 2}]}', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 'Room service amenity', NOW() - INTERVAL '40 minutes', NOW() - INTERVAL '15 minutes'),
    (113, 'PENDING', 'NORMAL', 'FRONT', 'The guest in the next room is playing very loud music.', 'Noise complaint', '{"intent": "NOISE", "issue": "Loud music from next room"}', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 'Guest disturbance', NOW() - INTERVAL '12 minutes', NOW() - INTERVAL '12 minutes')
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

-- ============================================================
-- BULK GENERATED HOTEL DUMMY DATA
-- ============================================================

-- 10. MASSIVE BULK TICKETS (150 Items)
INSERT INTO request (id, status, priority, department_id, raw_text, summary, entities, room_no, guest_id, reasoning, created_at, updated_at) VALUES
(116, 'IN_PROGRESS', 'NORMAL', 'FB', 'Two Club Sandwiches and a Coke, please.', 'Food order', '{"menu_items": [{"name": "Club Sandwich", "quantity": 2}, {"name": "Coke", "quantity": 1}]}', '103', NULL, 'Room service: Food', NOW() - INTERVAL '12550 minutes', NOW() - INTERVAL '3992 minutes'),
(117, 'DONE', 'NORMAL', 'FB', 'I''d like to order a bottle of red wine.', 'Wine order', '{"menu_items": [{"name": "Red Wine", "quantity": 1}]}', '204', NULL, 'Room service: Beverage', NOW() - INTERVAL '439 minutes', NOW() - INTERVAL '236 minutes'),
(120, 'DONE', 'NORMAL', 'CONCIERGE', 'Is there a good jogging route around here?', 'Jogging route', '{"intent": "TOUR_INFO", "category": "Jogging", "area": "Nearby"}', '105', NULL, 'Local recommendation', NOW() - INTERVAL '9457 minutes', NOW() - INTERVAL '6045 minutes'),
(121, 'DONE', 'NORMAL', 'FB', 'Allergic to peanuts, please make sure the salad is safe.', 'Allergy instruction', '{"menu_items": [{"name": "Caesar Salad", "quantity": 1}], "allergy_note": "peanut allergy"}', '201', NULL, 'Dietary request', NOW() - INTERVAL '10747 minutes', NOW() - INTERVAL '6881 minutes'),
(123, 'CANCELED', 'NORMAL', 'FRONT', 'Could you print a document for me?', 'Printing request', '{"intent": "PRINTING", "issue": "Document printing"}', '105', NULL, 'Business center service', NOW() - INTERVAL '12235 minutes', NOW() - INTERVAL '1602 minutes'),
(124, 'CANCELED', 'NORMAL', 'CONCIERGE', 'Can you book a table at a sushi restaurant?', 'Restaurant booking', '{"intent": "RESTAURANT", "restaurant_name": "Sushi Restaurant"}', '205', NULL, 'Dining reservation', NOW() - INTERVAL '1247 minutes', NOW() - INTERVAL '632 minutes'),
(126, 'PENDING', 'NORMAL', 'FB', 'Please clear the room service trays.', 'Tray clearance', '{"tasks": ["Tray clearance"]}', '302', NULL, 'FB housekeeping', NOW() - INTERVAL '2204 minutes', NOW() - INTERVAL '1551 minutes'),
(127, 'DONE', 'NORMAL', 'CONCIERGE', 'I need tickets to the museum.', 'Museum tickets', '{"intent": "RESERVATION", "target": "Museum"}', '401', NULL, 'Tour booking', NOW() - INTERVAL '5749 minutes', NOW() - INTERVAL '451 minutes'),
(128, 'DONE', 'NORMAL', 'FACILITY', 'Light bulb is flickering in the bathroom.', 'Flickering light', '{"intent": "ELECTRICAL", "issue": "Flickering light bulb"}', '203', NULL, 'Electrical maintenance', NOW() - INTERVAL '11786 minutes', NOW() - INTERVAL '2307 minutes'),
(129, 'DONE', 'NORMAL', 'CONCIERGE', 'I need tickets to the museum.', 'Museum tickets', '{"intent": "RESERVATION", "target": "Museum"}', '201', NULL, 'Tour booking', NOW() - INTERVAL '3269 minutes', NOW() - INTERVAL '3101 minutes'),
(132, 'DONE', 'NORMAL', 'FACILITY', 'Light bulb is flickering in the bathroom.', 'Flickering light', '{"intent": "ELECTRICAL", "issue": "Flickering light bulb"}', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 'Electrical maintenance', NOW() - INTERVAL '8711 minutes', NOW() - INTERVAL '8478 minutes'),
(133, 'PENDING', 'NORMAL', 'CONCIERGE', 'Is there a good jogging route around here?', 'Jogging route', '{"intent": "TOUR_INFO", "category": "Jogging", "area": "Nearby"}', '102', NULL, 'Local recommendation', NOW() - INTERVAL '3545 minutes', NOW() - INTERVAL '3058 minutes'),
(135, 'PENDING', 'NORMAL', 'FB', 'I''d like to order a bottle of red wine.', 'Wine order', '{"menu_items": [{"name": "Red Wine", "quantity": 1}]}', '201', NULL, 'Room service: Beverage', NOW() - INTERVAL '9229 minutes', NOW() - INTERVAL '1197 minutes'),
(136, 'DONE', 'NORMAL', 'FACILITY', 'The TV remote is not working.', 'TV remote issue', '{"intent": "ELECTRONICS", "issue": "TV remote not working"}', '301', NULL, 'Battery or remote replacement', NOW() - INTERVAL '1808 minutes', NOW() - INTERVAL '1456 minutes'),
(137, 'CANCELED', 'NORMAL', 'FACILITY', 'The shower head is leaking water.', 'Shower leak', '{"intent": "PLUMBING", "issue": "Shower head leaking"}', '502', NULL, 'Plumbing maintenance', NOW() - INTERVAL '7067 minutes', NOW() - INTERVAL '5589 minutes'),
(138, 'DONE', 'NORMAL', 'FB', 'Please clear the room service trays.', 'Tray clearance', '{"tasks": ["Tray clearance"]}', '503', NULL, 'FB housekeeping', NOW() - INTERVAL '1323 minutes', NOW() - INTERVAL '128 minutes'),
(139, 'DONE', 'NORMAL', 'FB', 'I''d like to order a bottle of red wine.', 'Wine order', '{"menu_items": [{"name": "Red Wine", "quantity": 1}]}', '501', NULL, 'Room service: Beverage', NOW() - INTERVAL '3359 minutes', NOW() - INTERVAL '998 minutes'),
(143, 'PENDING', 'NORMAL', 'CONCIERGE', 'Where can I buy a local SIM card?', 'SIM card info', '{"intent": "TOUR_INFO", "category": "SIM card", "area": "Local"}', '106', NULL, 'Local guidance', NOW() - INTERVAL '519 minutes', NOW() - INTERVAL '230 minutes'),
(144, 'CANCELED', 'NORMAL', 'FRONT', 'Can I get a late checkout until 2 PM?', 'Late checkout', '{"intent": "LATE_CHECKOUT", "time": "2:00 PM"}', '202', NULL, 'Checkout time extension', NOW() - INTERVAL '8272 minutes', NOW() - INTERVAL '1228 minutes'),
(146, 'CANCELED', 'NORMAL', 'FB', 'Two Club Sandwiches and a Coke, please.', 'Food order', '{"menu_items": [{"name": "Club Sandwich", "quantity": 2}, {"name": "Coke", "quantity": 1}]}', '203', NULL, 'Room service: Food', NOW() - INTERVAL '9179 minutes', NOW() - INTERVAL '8063 minutes'),
(148, 'PENDING', 'NORMAL', 'HK', 'I need extra pillows.', 'Extra pillows requested', '{"items": [{"item": "Pillow", "count": 2}]}', '302', NULL, 'Guest requested bedding', NOW() - INTERVAL '4872 minutes', NOW() - INTERVAL '674 minutes'),
(149, 'PENDING', 'NORMAL', 'FB', 'Please clear the room service trays.', 'Tray clearance', '{"tasks": ["Tray clearance"]}', '102', NULL, 'FB housekeeping', NOW() - INTERVAL '12697 minutes', NOW() - INTERVAL '369 minutes'),
(151, 'PENDING', 'NORMAL', 'HK', 'Please make up my room.', 'Room makeup', '{"tasks": ["Room cleaning"]}', '305', NULL, 'Standard cleaning request', NOW() - INTERVAL '13004 minutes', NOW() - INTERVAL '3921 minutes'),
(152, 'CANCELED', 'NORMAL', 'FACILITY', 'Room is too cold, thermostat doesn''t work.', 'Heating issue', '{"intent": "HVAC", "issue": "Thermostat not working"}', '105', NULL, 'HVAC maintenance', NOW() - INTERVAL '4741 minutes', NOW() - INTERVAL '2716 minutes'),
(153, 'PENDING', 'NORMAL', 'FACILITY', 'Room is too cold, thermostat doesn''t work.', 'Heating issue', '{"intent": "HVAC", "issue": "Thermostat not working"}', '305', NULL, 'HVAC maintenance', NOW() - INTERVAL '1678 minutes', NOW() - INTERVAL '464 minutes'),
(155, 'CANCELED', 'NORMAL', 'FACILITY', 'The TV remote is not working.', 'TV remote issue', '{"intent": "ELECTRONICS", "issue": "TV remote not working"}', '403', NULL, 'Battery or remote replacement', NOW() - INTERVAL '14127 minutes', NOW() - INTERVAL '8612 minutes'),
(158, 'DONE', 'NORMAL', 'FRONT', 'Lost my room key at the pool.', 'Lost key', '{"intent": "KEY_REPLACEMENT", "issue": "Lost key"}', '102', NULL, 'Key card replacement', NOW() - INTERVAL '3659 minutes', NOW() - INTERVAL '2704 minutes'),
(159, 'DONE', 'NORMAL', 'FACILITY', 'Sink is draining very slowly.', 'Slow drain', '{"intent": "PLUMBING", "issue": "Slow drain"}', '503', NULL, 'Plumbing issue', NOW() - INTERVAL '3588 minutes', NOW() - INTERVAL '2482 minutes'),
(162, 'DONE', 'NORMAL', 'FB', 'Please clear the room service trays.', 'Tray clearance', '{"tasks": ["Tray clearance"]}', '303', NULL, 'FB housekeeping', NOW() - INTERVAL '2478 minutes', NOW() - INTERVAL '299 minutes'),
(163, 'CANCELED', 'NORMAL', 'CONCIERGE', 'Is there a good jogging route around here?', 'Jogging route', '{"intent": "TOUR_INFO", "category": "Jogging", "area": "Nearby"}', '103', NULL, 'Local recommendation', NOW() - INTERVAL '3384 minutes', NOW() - INTERVAL '1341 minutes'),
(164, 'PENDING', 'NORMAL', 'FB', 'Please clear the room service trays.', 'Tray clearance', '{"tasks": ["Tray clearance"]}', '305', NULL, 'FB housekeeping', NOW() - INTERVAL '13576 minutes', NOW() - INTERVAL '6252 minutes'),
(165, 'DONE', 'NORMAL', 'HK', 'Please make up my room.', 'Room makeup', '{"tasks": ["Room cleaning"]}', '104', NULL, 'Standard cleaning request', NOW() - INTERVAL '1711 minutes', NOW() - INTERVAL '714 minutes'),
(166, 'PENDING', 'NORMAL', 'FB', 'Two Club Sandwiches and a Coke, please.', 'Food order', '{"menu_items": [{"name": "Club Sandwich", "quantity": 2}, {"name": "Coke", "quantity": 1}]}', '203', NULL, 'Room service: Food', NOW() - INTERVAL '4163 minutes', NOW() - INTERVAL '3774 minutes'),
(168, 'DONE', 'NORMAL', 'FRONT', 'Could you print a document for me?', 'Printing request', '{"intent": "PRINTING", "issue": "Document printing"}', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 'Business center service', NOW() - INTERVAL '6284 minutes', NOW() - INTERVAL '1182 minutes'),
(169, 'CANCELED', 'NORMAL', 'FB', 'Allergic to peanuts, please make sure the salad is safe.', 'Allergy instruction', '{"menu_items": [{"name": "Caesar Salad", "quantity": 1}], "allergy_note": "peanut allergy"}', '202', NULL, 'Dietary request', NOW() - INTERVAL '13165 minutes', NOW() - INTERVAL '11305 minutes'),
(170, 'PENDING', 'NORMAL', 'HK', 'I need extra pillows.', 'Extra pillows requested', '{"items": [{"item": "Pillow", "count": 2}]}', '201', NULL, 'Guest requested bedding', NOW() - INTERVAL '13630 minutes', NOW() - INTERVAL '7188 minutes'),
(171, 'DONE', 'NORMAL', 'FACILITY', 'Room is too cold, thermostat doesn''t work.', 'Heating issue', '{"intent": "HVAC", "issue": "Thermostat not working"}', '503', NULL, 'HVAC maintenance', NOW() - INTERVAL '23 minutes', NOW() - INTERVAL '13 minutes'),
(173, 'IN_PROGRESS', 'NORMAL', 'FRONT', 'Wi-Fi keeps disconnecting.', 'Wi-Fi issue', '{"intent": "WIFI", "issue": "Keeps disconnecting"}', '303', NULL, 'Internet connection problem', NOW() - INTERVAL '13103 minutes', NOW() - INTERVAL '5720 minutes'),
(175, 'CANCELED', 'NORMAL', 'HK', 'There are no fresh towels left.', 'Towels requested', '{"items": [{"item": "Bath Towel", "count": 2}]}', '203', NULL, 'Amenity refill', NOW() - INTERVAL '1353 minutes', NOW() - INTERVAL '343 minutes'),
(177, 'DONE', 'NORMAL', 'FRONT', 'Can I get a late checkout until 2 PM?', 'Late checkout', '{"intent": "LATE_CHECKOUT", "time": "2:00 PM"}', '302', NULL, 'Checkout time extension', NOW() - INTERVAL '7799 minutes', NOW() - INTERVAL '1327 minutes'),
(180, 'PENDING', 'NORMAL', 'CONCIERGE', 'I need tickets to the museum.', 'Museum tickets', '{"intent": "RESERVATION", "target": "Museum"}', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 'Tour booking', NOW() - INTERVAL '7690 minutes', NOW() - INTERVAL '5083 minutes'),
(181, 'IN_PROGRESS', 'NORMAL', 'HK', 'Could I get an iron and ironing board?', 'Iron requested', '{"items": [{"item": "Iron", "count": 1}, {"item": "Ironing Board", "count": 1}]}', '105', NULL, 'Appliance requested', NOW() - INTERVAL '4401 minutes', NOW() - INTERVAL '1555 minutes'),
(183, 'IN_PROGRESS', 'NORMAL', 'FACILITY', 'Curtains are stuck and won''t close.', 'Curtain repair', '{"intent": "FURNITURE", "issue": "Curtains stuck"}', '401', NULL, 'Furniture maintenance', NOW() - INTERVAL '11597 minutes', NOW() - INTERVAL '6406 minutes'),
(184, 'CANCELED', 'NORMAL', 'FB', 'Please clear the room service trays.', 'Tray clearance', '{"tasks": ["Tray clearance"]}', '402', NULL, 'FB housekeeping', NOW() - INTERVAL '8464 minutes', NOW() - INTERVAL '2886 minutes'),
(185, 'DONE', 'NORMAL', 'FACILITY', 'Light bulb is flickering in the bathroom.', 'Flickering light', '{"intent": "ELECTRICAL", "issue": "Flickering light bulb"}', '303', NULL, 'Electrical maintenance', NOW() - INTERVAL '6780 minutes', NOW() - INTERVAL '3618 minutes'),
(187, 'DONE', 'NORMAL', 'FACILITY', 'Safe box won''t open.', 'Safe locked', '{"intent": "SECURITY", "issue": "Safe will not open"}', '501', NULL, 'Security / Safe unlock', NOW() - INTERVAL '7334 minutes', NOW() - INTERVAL '1774 minutes'),
(189, 'DONE', 'NORMAL', 'CONCIERGE', 'Any recommendations for kid-friendly activities?', 'Activity recommendation', '{"intent": "TOUR_INFO", "category": "Activities", "area": "Nearby"}', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 'Family planning', NOW() - INTERVAL '2797 minutes', NOW() - INTERVAL '1113 minutes'),
(191, 'DONE', 'NORMAL', 'FACILITY', 'Curtains are stuck and won''t close.', 'Curtain repair', '{"intent": "FURNITURE", "issue": "Curtains stuck"}', '402', NULL, 'Furniture maintenance', NOW() - INTERVAL '2016 minutes', NOW() - INTERVAL '1376 minutes'),
(192, 'PENDING', 'NORMAL', 'FACILITY', 'Light bulb is flickering in the bathroom.', 'Flickering light', '{"intent": "ELECTRICAL", "issue": "Flickering light bulb"}', '203', NULL, 'Electrical maintenance', NOW() - INTERVAL '813 minutes', NOW() - INTERVAL '491 minutes'),
(193, 'PENDING', 'NORMAL', 'HK', 'Please make up my room.', 'Room makeup', '{"tasks": ["Room cleaning"]}', '503', NULL, 'Standard cleaning request', NOW() - INTERVAL '7113 minutes', NOW() - INTERVAL '1608 minutes'),
(195, 'IN_PROGRESS', 'NORMAL', 'CONCIERGE', 'Where can I buy a local SIM card?', 'SIM card info', '{"intent": "TOUR_INFO", "category": "SIM card", "area": "Local"}', '403', NULL, 'Local guidance', NOW() - INTERVAL '10385 minutes', NOW() - INTERVAL '6530 minutes'),
(197, 'DONE', 'NORMAL', 'CONCIERGE', 'Any recommendations for kid-friendly activities?', 'Activity recommendation', '{"intent": "TOUR_INFO", "category": "Activities", "area": "Nearby"}', '401', NULL, 'Family planning', NOW() - INTERVAL '5181 minutes', NOW() - INTERVAL '1768 minutes'),
(200, 'IN_PROGRESS', 'NORMAL', 'FRONT', 'The guests next door are shouting.', 'Noise complaint', '{"intent": "NOISE", "issue": "Loud noise from neighbor"}', '401', NULL, 'Guest disturbance', NOW() - INTERVAL '13484 minutes', NOW() - INTERVAL '4274 minutes'),
(201, 'DONE', 'NORMAL', 'CONCIERGE', 'I need tickets to the museum.', 'Museum tickets', '{"intent": "RESERVATION", "target": "Museum"}', '401', NULL, 'Tour booking', NOW() - INTERVAL '11577 minutes', NOW() - INTERVAL '11241 minutes'),
(202, 'PENDING', 'NORMAL', 'FRONT', 'Is it possible to switch to a room with a better view?', 'Room change', '{"intent": "ROOM_CHANGE", "issue": "Better view requested"}', '204', NULL, 'Accommodation modification', NOW() - INTERVAL '6839 minutes', NOW() - INTERVAL '5098 minutes'),
(203, 'IN_PROGRESS', 'NORMAL', 'FB', 'Two Club Sandwiches and a Coke, please.', 'Food order', '{"menu_items": [{"name": "Club Sandwich", "quantity": 2}, {"name": "Coke", "quantity": 1}]}', '301', NULL, 'Room service: Food', NOW() - INTERVAL '381 minutes', NOW() - INTERVAL '370 minutes'),
(205, 'DONE', 'NORMAL', 'FACILITY', 'Room is too cold, thermostat doesn''t work.', 'Heating issue', '{"intent": "HVAC", "issue": "Thermostat not working"}', '304', NULL, 'HVAC maintenance', NOW() - INTERVAL '2255 minutes', NOW() - INTERVAL '525 minutes'),
(206, 'DONE', 'NORMAL', 'FACILITY', 'Sink is draining very slowly.', 'Slow drain', '{"intent": "PLUMBING", "issue": "Slow drain"}', '304', NULL, 'Plumbing issue', NOW() - INTERVAL '8591 minutes', NOW() - INTERVAL '7618 minutes'),
(212, 'DONE', 'NORMAL', 'HK', 'The trash bin is overflowing.', 'Trash removal', '{"items": [{"item": "Trash bag", "count": 1}], "tasks": ["Trash removal"]}', '502', NULL, 'Cleaning request', NOW() - INTERVAL '7289 minutes', NOW() - INTERVAL '850 minutes'),
(215, 'PENDING', 'NORMAL', 'FRONT', 'Can I get a late checkout until 2 PM?', 'Late checkout', '{"intent": "LATE_CHECKOUT", "time": "2:00 PM"}', '202', NULL, 'Checkout time extension', NOW() - INTERVAL '12407 minutes', NOW() - INTERVAL '82 minutes'),
(218, 'DONE', 'NORMAL', 'FB', 'Please clear the room service trays.', 'Tray clearance', '{"tasks": ["Tray clearance"]}', '105', NULL, 'FB housekeeping', NOW() - INTERVAL '2048 minutes', NOW() - INTERVAL '2020 minutes'),
(220, 'DONE', 'NORMAL', 'CONCIERGE', 'I need tickets to the museum.', 'Museum tickets', '{"intent": "RESERVATION", "target": "Museum"}', '103', NULL, 'Tour booking', NOW() - INTERVAL '12193 minutes', NOW() - INTERVAL '5273 minutes'),
(224, 'PENDING', 'NORMAL', 'FB', 'I''d like to order a bottle of red wine.', 'Wine order', '{"menu_items": [{"name": "Red Wine", "quantity": 1}]}', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 'Room service: Beverage', NOW() - INTERVAL '2517 minutes', NOW() - INTERVAL '1299 minutes'),
(225, 'PENDING', 'NORMAL', 'HK', 'The trash bin is overflowing.', 'Trash removal', '{"items": [{"item": "Trash bag", "count": 1}], "tasks": ["Trash removal"]}', '106', NULL, 'Cleaning request', NOW() - INTERVAL '10486 minutes', NOW() - INTERVAL '6660 minutes'),
(227, 'IN_PROGRESS', 'NORMAL', 'FACILITY', 'Safe box won''t open.', 'Safe locked', '{"intent": "SECURITY", "issue": "Safe will not open"}', '106', NULL, 'Security / Safe unlock', NOW() - INTERVAL '3675 minutes', NOW() - INTERVAL '2715 minutes'),
(229, 'DONE', 'NORMAL', 'FB', 'Two Club Sandwiches and a Coke, please.', 'Food order', '{"menu_items": [{"name": "Club Sandwich", "quantity": 2}, {"name": "Coke", "quantity": 1}]}', '304', NULL, 'Room service: Food', NOW() - INTERVAL '3733 minutes', NOW() - INTERVAL '404 minutes'),
(230, 'CANCELED', 'NORMAL', 'CONCIERGE', 'Is there a good jogging route around here?', 'Jogging route', '{"intent": "TOUR_INFO", "category": "Jogging", "area": "Nearby"}', '302', NULL, 'Local recommendation', NOW() - INTERVAL '3475 minutes', NOW() - INTERVAL '1470 minutes'),
(231, 'DONE', 'NORMAL', 'HK', 'Please make up my room.', 'Room makeup', '{"tasks": ["Room cleaning"]}', '203', NULL, 'Standard cleaning request', NOW() - INTERVAL '12461 minutes', NOW() - INTERVAL '3579 minutes'),
(233, 'CANCELED', 'NORMAL', 'HK', 'I need extra pillows.', 'Extra pillows requested', '{"items": [{"item": "Pillow", "count": 2}]}', '302', NULL, 'Guest requested bedding', NOW() - INTERVAL '6675 minutes', NOW() - INTERVAL '5554 minutes'),
(234, 'DONE', 'NORMAL', 'FB', 'Please clear the room service trays.', 'Tray clearance', '{"tasks": ["Tray clearance"]}', '102', NULL, 'FB housekeeping', NOW() - INTERVAL '10688 minutes', NOW() - INTERVAL '681 minutes'),
(236, 'IN_PROGRESS', 'NORMAL', 'CONCIERGE', 'I need tickets to the museum.', 'Museum tickets', '{"intent": "RESERVATION", "target": "Museum"}', '205', NULL, 'Tour booking', NOW() - INTERVAL '6829 minutes', NOW() - INTERVAL '3510 minutes'),
(237, 'DONE', 'NORMAL', 'CONCIERGE', 'I need tickets to the museum.', 'Museum tickets', '{"intent": "RESERVATION", "target": "Museum"}', '502', NULL, 'Tour booking', NOW() - INTERVAL '12150 minutes', NOW() - INTERVAL '3084 minutes'),
(238, 'PENDING', 'NORMAL', 'CONCIERGE', 'Can you book a table at a sushi restaurant?', 'Restaurant booking', '{"intent": "RESTAURANT", "restaurant_name": "Sushi Restaurant"}', '103', NULL, 'Dining reservation', NOW() - INTERVAL '7686 minutes', NOW() - INTERVAL '4746 minutes'),
(243, 'IN_PROGRESS', 'NORMAL', 'CONCIERGE', 'Is there a good jogging route around here?', 'Jogging route', '{"intent": "TOUR_INFO", "category": "Jogging", "area": "Nearby"}', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 'Local recommendation', NOW() - INTERVAL '14340 minutes', NOW() - INTERVAL '9617 minutes'),
(244, 'CANCELED', 'NORMAL', 'CONCIERGE', 'Where can I buy a local SIM card?', 'SIM card info', '{"intent": "TOUR_INFO", "category": "SIM card", "area": "Local"}', '301', NULL, 'Local guidance', NOW() - INTERVAL '6386 minutes', NOW() - INTERVAL '1120 minutes'),
(246, 'PENDING', 'NORMAL', 'HK', 'Please make up my room.', 'Room makeup', '{"tasks": ["Room cleaning"]}', '105', NULL, 'Standard cleaning request', NOW() - INTERVAL '8612 minutes', NOW() - INTERVAL '1686 minutes'),
(248, 'DONE', 'NORMAL', 'FACILITY', 'Light bulb is flickering in the bathroom.', 'Flickering light', '{"intent": "ELECTRICAL", "issue": "Flickering light bulb"}', '302', NULL, 'Electrical maintenance', NOW() - INTERVAL '13433 minutes', NOW() - INTERVAL '10830 minutes'),
(249, 'DONE', 'NORMAL', 'HK', 'Out of shampoo and body wash.', 'Amenity refill', '{"items": [{"item": "Shampoo", "count": 1}, {"item": "Body Wash", "count": 1}]}', '302', NULL, 'Bathroom amenity refill', NOW() - INTERVAL '3613 minutes', NOW() - INTERVAL '2657 minutes'),
(250, 'PENDING', 'NORMAL', 'CONCIERGE', 'Can you send my luggage to the airport?', 'Luggage delivery', '{"intent": "LUGGAGE_STORAGE", "action": "store", "count": 2}', '503', NULL, 'Logistics service', NOW() - INTERVAL '644 minutes', NOW() - INTERVAL '344 minutes'),
(252, 'DONE', 'NORMAL', 'CONCIERGE', 'I need tickets to the museum.', 'Museum tickets', '{"intent": "RESERVATION", "target": "Museum"}', '204', NULL, 'Tour booking', NOW() - INTERVAL '13970 minutes', NOW() - INTERVAL '1608 minutes'),
(254, 'IN_PROGRESS', 'NORMAL', 'FB', 'Allergic to peanuts, please make sure the salad is safe.', 'Allergy instruction', '{"menu_items": [{"name": "Caesar Salad", "quantity": 1}], "allergy_note": "peanut allergy"}', '302', NULL, 'Dietary request', NOW() - INTERVAL '11443 minutes', NOW() - INTERVAL '4297 minutes'),
(255, 'PENDING', 'NORMAL', 'FRONT', 'Wi-Fi keeps disconnecting.', 'Wi-Fi issue', '{"intent": "WIFI", "issue": "Keeps disconnecting"}', '503', NULL, 'Internet connection problem', NOW() - INTERVAL '3360 minutes', NOW() - INTERVAL '2134 minutes'),
(256, 'DONE', 'NORMAL', 'HK', 'I need extra pillows.', 'Extra pillows requested', '{"items": [{"item": "Pillow", "count": 2}]}', '202', NULL, 'Guest requested bedding', NOW() - INTERVAL '12232 minutes', NOW() - INTERVAL '2966 minutes'),
(257, 'DONE', 'NORMAL', 'FACILITY', 'Light bulb is flickering in the bathroom.', 'Flickering light', '{"intent": "ELECTRICAL", "issue": "Flickering light bulb"}', '302', NULL, 'Electrical maintenance', NOW() - INTERVAL '3193 minutes', NOW() - INTERVAL '737 minutes'),
(258, 'DONE', 'NORMAL', 'FACILITY', 'The shower head is leaking water.', 'Shower leak', '{"intent": "PLUMBING", "issue": "Shower head leaking"}', '103', NULL, 'Plumbing maintenance', NOW() - INTERVAL '8416 minutes', NOW() - INTERVAL '6649 minutes'),
(259, 'DONE', 'NORMAL', 'FRONT', 'Lost my room key at the pool.', 'Lost key', '{"intent": "KEY_REPLACEMENT", "issue": "Lost key"}', '106', NULL, 'Key card replacement', NOW() - INTERVAL '558 minutes', NOW() - INTERVAL '275 minutes'),
(260, 'CANCELED', 'NORMAL', 'FACILITY', 'The TV remote is not working.', 'TV remote issue', '{"intent": "ELECTRONICS", "issue": "TV remote not working"}', '303', NULL, 'Battery or remote replacement', NOW() - INTERVAL '12224 minutes', NOW() - INTERVAL '3360 minutes'),
(261, 'DONE', 'NORMAL', 'FB', 'Can I get breakfast in bed tomorrow at 8 AM?', 'Breakfast order', '{"menu_items": [{"name": "Breakfast Set", "quantity": 1}]}', '304', NULL, 'Room service: Food', NOW() - INTERVAL '8533 minutes', NOW() - INTERVAL '3853 minutes'),
(262, 'DONE', 'NORMAL', 'HK', 'Please make up my room.', 'Room makeup', '{"tasks": ["Room cleaning"]}', '105', NULL, 'Standard cleaning request', NOW() - INTERVAL '12588 minutes', NOW() - INTERVAL '561 minutes'),
(263, 'IN_PROGRESS', 'NORMAL', 'HK', 'Out of shampoo and body wash.', 'Amenity refill', '{"items": [{"item": "Shampoo", "count": 1}, {"item": "Body Wash", "count": 1}]}', '201', NULL, 'Bathroom amenity refill', NOW() - INTERVAL '7647 minutes', NOW() - INTERVAL '2185 minutes')
ON CONFLICT (id) DO NOTHING;

SELECT setval('request_id_seq', (SELECT COALESCE(MAX(id), 263) FROM request));

-- 11. MASSIVE BULK CHAT HISTORY
INSERT INTO message (sender_type, content, room_no, guest_id, request_id, sentiment, created_at) VALUES
('GUEST', 'My wife just slipped in the bathroom and can''t get up.', '202', NULL, 114, 'NEUTRAL', NOW() - INTERVAL '1962 minutes'),
('AI', 'We have received your request regarding: Fall injury. We will assist you shortly.', '202', NULL, 114, 'POSITIVE', NOW() - INTERVAL '1960 minutes'),
('GUEST', 'Safe box won''t open.', '501', NULL, 115, 'NEUTRAL', NOW() - INTERVAL '2421 minutes'),
('AI', 'We have received your request regarding: Safe locked. We will assist you shortly.', '501', NULL, 115, 'POSITIVE', NOW() - INTERVAL '2419 minutes'),
('GUEST', 'Two Club Sandwiches and a Coke, please.', '103', NULL, 116, 'NEUTRAL', NOW() - INTERVAL '12550 minutes'),
('AI', 'We have received your request regarding: Food order. We will assist you shortly.', '103', NULL, 116, 'POSITIVE', NOW() - INTERVAL '12548 minutes'),
('GUEST', 'I''d like to order a bottle of red wine.', '204', NULL, 117, 'NEUTRAL', NOW() - INTERVAL '439 minutes'),
('AI', 'We have received your request regarding: Wine order. We will assist you shortly.', '204', NULL, 117, 'POSITIVE', NOW() - INTERVAL '437 minutes'),
('GUEST', 'Can you send my luggage to the airport?', '402', NULL, 118, 'NEUTRAL', NOW() - INTERVAL '7976 minutes'),
('AI', 'We have received your request regarding: Luggage delivery. We will assist you shortly.', '402', NULL, 118, 'POSITIVE', NOW() - INTERVAL '7974 minutes'),
('GUEST', 'I smell smoke in the hallway.', '102', NULL, 119, 'NEUTRAL', NOW() - INTERVAL '3198 minutes'),
('AI', 'We have received your request regarding: Smoke report. We will assist you shortly.', '102', NULL, 119, 'POSITIVE', NOW() - INTERVAL '3196 minutes'),
('GUEST', 'Is there a good jogging route around here?', '105', NULL, 120, 'NEUTRAL', NOW() - INTERVAL '9457 minutes'),
('AI', 'We have received your request regarding: Jogging route. We will assist you shortly.', '105', NULL, 120, 'POSITIVE', NOW() - INTERVAL '9455 minutes'),
('GUEST', 'Allergic to peanuts, please make sure the salad is safe.', '201', NULL, 121, 'NEUTRAL', NOW() - INTERVAL '10747 minutes'),
('AI', 'We have received your request regarding: Allergy instruction. We will assist you shortly.', '201', NULL, 121, 'POSITIVE', NOW() - INTERVAL '10745 minutes'),
('GUEST', 'I cut my hand deeply, I need a first aid kit!', '202', NULL, 122, 'NEUTRAL', NOW() - INTERVAL '13993 minutes'),
('AI', 'We have received your request regarding: Medical emergency. We will assist you shortly.', '202', NULL, 122, 'POSITIVE', NOW() - INTERVAL '13991 minutes'),
('GUEST', 'Could you print a document for me?', '105', NULL, 123, 'NEUTRAL', NOW() - INTERVAL '12235 minutes'),
('AI', 'We have received your request regarding: Printing request. We will assist you shortly.', '105', NULL, 123, 'POSITIVE', NOW() - INTERVAL '12233 minutes'),
('GUEST', 'Can you book a table at a sushi restaurant?', '205', NULL, 124, 'NEUTRAL', NOW() - INTERVAL '1247 minutes'),
('AI', 'We have received your request regarding: Restaurant booking. We will assist you shortly.', '205', NULL, 124, 'POSITIVE', NOW() - INTERVAL '1245 minutes'),
('GUEST', 'I cut my hand deeply, I need a first aid kit!', '301', NULL, 125, 'NEUTRAL', NOW() - INTERVAL '8494 minutes'),
('AI', 'We have received your request regarding: Medical emergency. We will assist you shortly.', '301', NULL, 125, 'POSITIVE', NOW() - INTERVAL '8492 minutes'),
('GUEST', 'Please clear the room service trays.', '302', NULL, 126, 'NEUTRAL', NOW() - INTERVAL '2204 minutes'),
('AI', 'We have received your request regarding: Tray clearance. We will assist you shortly.', '302', NULL, 126, 'POSITIVE', NOW() - INTERVAL '2202 minutes'),
('GUEST', 'I need tickets to the museum.', '401', NULL, 127, 'NEUTRAL', NOW() - INTERVAL '5749 minutes'),
('AI', 'We have received your request regarding: Museum tickets. We will assist you shortly.', '401', NULL, 127, 'POSITIVE', NOW() - INTERVAL '5747 minutes'),
('GUEST', 'Light bulb is flickering in the bathroom.', '203', NULL, 128, 'NEUTRAL', NOW() - INTERVAL '11786 minutes'),
('AI', 'We have received your request regarding: Flickering light. We will assist you shortly.', '203', NULL, 128, 'POSITIVE', NOW() - INTERVAL '11784 minutes'),
('GUEST', 'I need tickets to the museum.', '201', NULL, 129, 'NEUTRAL', NOW() - INTERVAL '3269 minutes'),
('AI', 'We have received your request regarding: Museum tickets. We will assist you shortly.', '201', NULL, 129, 'POSITIVE', NOW() - INTERVAL '3267 minutes'),
('GUEST', 'Safe box won''t open.', '402', NULL, 130, 'NEUTRAL', NOW() - INTERVAL '9384 minutes'),
('AI', 'We have received your request regarding: Safe locked. We will assist you shortly.', '402', NULL, 130, 'POSITIVE', NOW() - INTERVAL '9382 minutes'),
('GUEST', 'The elevator is stuck between floors.', '305', NULL, 131, 'NEUTRAL', NOW() - INTERVAL '3933 minutes'),
('AI', 'We have received your request regarding: Stuck elevator. We will assist you shortly.', '305', NULL, 131, 'POSITIVE', NOW() - INTERVAL '3931 minutes'),
('GUEST', 'Light bulb is flickering in the bathroom.', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 132, 'NEUTRAL', NOW() - INTERVAL '8711 minutes'),
('AI', 'We have received your request regarding: Flickering light. We will assist you shortly.', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 132, 'POSITIVE', NOW() - INTERVAL '8709 minutes'),
('GUEST', 'Is there a good jogging route around here?', '102', NULL, 133, 'NEUTRAL', NOW() - INTERVAL '3545 minutes'),
('AI', 'We have received your request regarding: Jogging route. We will assist you shortly.', '102', NULL, 133, 'POSITIVE', NOW() - INTERVAL '3543 minutes'),
('GUEST', 'Can we have a bucket of ice sent up?', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 134, 'NEUTRAL', NOW() - INTERVAL '7999 minutes'),
('AI', 'We have received your request regarding: Ice bucket. We will assist you shortly.', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 134, 'POSITIVE', NOW() - INTERVAL '7997 minutes'),
('GUEST', 'I''d like to order a bottle of red wine.', '201', NULL, 135, 'NEUTRAL', NOW() - INTERVAL '9229 minutes'),
('AI', 'We have received your request regarding: Wine order. We will assist you shortly.', '201', NULL, 135, 'POSITIVE', NOW() - INTERVAL '9227 minutes'),
('GUEST', 'The TV remote is not working.', '301', NULL, 136, 'NEUTRAL', NOW() - INTERVAL '1808 minutes'),
('AI', 'We have received your request regarding: TV remote issue. We will assist you shortly.', '301', NULL, 136, 'POSITIVE', NOW() - INTERVAL '1806 minutes'),
('GUEST', 'The shower head is leaking water.', '502', NULL, 137, 'NEUTRAL', NOW() - INTERVAL '7067 minutes'),
('AI', 'We have received your request regarding: Shower leak. We will assist you shortly.', '502', NULL, 137, 'POSITIVE', NOW() - INTERVAL '7065 minutes'),
('GUEST', 'Please clear the room service trays.', '503', NULL, 138, 'NEUTRAL', NOW() - INTERVAL '1323 minutes'),
('AI', 'We have received your request regarding: Tray clearance. We will assist you shortly.', '503', NULL, 138, 'POSITIVE', NOW() - INTERVAL '1321 minutes'),
('GUEST', 'I''d like to order a bottle of red wine.', '501', NULL, 139, 'NEUTRAL', NOW() - INTERVAL '3359 minutes'),
('AI', 'We have received your request regarding: Wine order. We will assist you shortly.', '501', NULL, 139, 'POSITIVE', NOW() - INTERVAL '3357 minutes'),
('GUEST', 'Can you send my luggage to the airport?', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 140, 'NEUTRAL', NOW() - INTERVAL '825 minutes'),
('AI', 'We have received your request regarding: Luggage delivery. We will assist you shortly.', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 140, 'POSITIVE', NOW() - INTERVAL '823 minutes'),
('GUEST', 'Please clear the room service trays.', '402', NULL, 141, 'NEUTRAL', NOW() - INTERVAL '5807 minutes'),
('AI', 'We have received your request regarding: Tray clearance. We will assist you shortly.', '402', NULL, 141, 'POSITIVE', NOW() - INTERVAL '5805 minutes'),
('GUEST', 'My wife just slipped in the bathroom and can''t get up.', '103', NULL, 142, 'NEUTRAL', NOW() - INTERVAL '12221 minutes'),
('AI', 'We have received your request regarding: Fall injury. We will assist you shortly.', '103', NULL, 142, 'POSITIVE', NOW() - INTERVAL '12219 minutes'),
('GUEST', 'Where can I buy a local SIM card?', '106', NULL, 143, 'NEUTRAL', NOW() - INTERVAL '519 minutes'),
('AI', 'We have received your request regarding: SIM card info. We will assist you shortly.', '106', NULL, 143, 'POSITIVE', NOW() - INTERVAL '517 minutes'),
('GUEST', 'Can I get a late checkout until 2 PM?', '202', NULL, 144, 'NEUTRAL', NOW() - INTERVAL '8272 minutes'),
('AI', 'We have received your request regarding: Late checkout. We will assist you shortly.', '202', NULL, 144, 'POSITIVE', NOW() - INTERVAL '8270 minutes'),
('GUEST', 'I smell smoke in the hallway.', '202', NULL, 145, 'NEUTRAL', NOW() - INTERVAL '10108 minutes'),
('AI', 'We have received your request regarding: Smoke report. We will assist you shortly.', '202', NULL, 145, 'POSITIVE', NOW() - INTERVAL '10106 minutes'),
('GUEST', 'Two Club Sandwiches and a Coke, please.', '203', NULL, 146, 'NEUTRAL', NOW() - INTERVAL '9179 minutes'),
('AI', 'We have received your request regarding: Food order. We will assist you shortly.', '203', NULL, 146, 'POSITIVE', NOW() - INTERVAL '9177 minutes'),
('GUEST', 'I need tickets to the museum.', '106', NULL, 147, 'NEUTRAL', NOW() - INTERVAL '9937 minutes'),
('AI', 'We have received your request regarding: Museum tickets. We will assist you shortly.', '106', NULL, 147, 'POSITIVE', NOW() - INTERVAL '9935 minutes'),
('GUEST', 'I need extra pillows.', '302', NULL, 148, 'NEUTRAL', NOW() - INTERVAL '4872 minutes'),
('AI', 'We have received your request regarding: Extra pillows requested. We will assist you shortly.', '302', NULL, 148, 'POSITIVE', NOW() - INTERVAL '4870 minutes'),
('GUEST', 'Please clear the room service trays.', '102', NULL, 149, 'NEUTRAL', NOW() - INTERVAL '12697 minutes'),
('AI', 'We have received your request regarding: Tray clearance. We will assist you shortly.', '102', NULL, 149, 'POSITIVE', NOW() - INTERVAL '12695 minutes'),
('GUEST', 'Could you print a document for me?', '304', NULL, 150, 'NEUTRAL', NOW() - INTERVAL '6226 minutes'),
('AI', 'We have received your request regarding: Printing request. We will assist you shortly.', '304', NULL, 150, 'POSITIVE', NOW() - INTERVAL '6224 minutes'),
('GUEST', 'Please make up my room.', '305', NULL, 151, 'NEUTRAL', NOW() - INTERVAL '13004 minutes'),
('AI', 'We have received your request regarding: Room makeup. We will assist you shortly.', '305', NULL, 151, 'POSITIVE', NOW() - INTERVAL '13002 minutes'),
('GUEST', 'Room is too cold, thermostat doesn''t work.', '105', NULL, 152, 'NEUTRAL', NOW() - INTERVAL '4741 minutes'),
('AI', 'We have received your request regarding: Heating issue. We will assist you shortly.', '105', NULL, 152, 'POSITIVE', NOW() - INTERVAL '4739 minutes'),
('GUEST', 'Room is too cold, thermostat doesn''t work.', '305', NULL, 153, 'NEUTRAL', NOW() - INTERVAL '1678 minutes'),
('AI', 'We have received your request regarding: Heating issue. We will assist you shortly.', '305', NULL, 153, 'POSITIVE', NOW() - INTERVAL '1676 minutes'),
('GUEST', 'Someone is trying to open my door.', '304', NULL, 154, 'NEUTRAL', NOW() - INTERVAL '13895 minutes'),
('AI', 'We have received your request regarding: Security alert. We will assist you shortly.', '304', NULL, 154, 'POSITIVE', NOW() - INTERVAL '13893 minutes'),
('GUEST', 'The TV remote is not working.', '403', NULL, 155, 'NEUTRAL', NOW() - INTERVAL '14127 minutes'),
('AI', 'We have received your request regarding: TV remote issue. We will assist you shortly.', '403', NULL, 155, 'POSITIVE', NOW() - INTERVAL '14125 minutes'),
('GUEST', 'My wife just slipped in the bathroom and can''t get up.', '503', NULL, 156, 'NEUTRAL', NOW() - INTERVAL '1506 minutes'),
('AI', 'We have received your request regarding: Fall injury. We will assist you shortly.', '503', NULL, 156, 'POSITIVE', NOW() - INTERVAL '1504 minutes'),
('GUEST', 'The trash bin is overflowing.', '204', NULL, 157, 'NEUTRAL', NOW() - INTERVAL '8706 minutes'),
('AI', 'We have received your request regarding: Trash removal. We will assist you shortly.', '204', NULL, 157, 'POSITIVE', NOW() - INTERVAL '8704 minutes'),
('GUEST', 'Lost my room key at the pool.', '102', NULL, 158, 'NEUTRAL', NOW() - INTERVAL '3659 minutes'),
('AI', 'We have received your request regarding: Lost key. We will assist you shortly.', '102', NULL, 158, 'POSITIVE', NOW() - INTERVAL '3657 minutes'),
('GUEST', 'Sink is draining very slowly.', '503', NULL, 159, 'NEUTRAL', NOW() - INTERVAL '3588 minutes'),
('AI', 'We have received your request regarding: Slow drain. We will assist you shortly.', '503', NULL, 159, 'POSITIVE', NOW() - INTERVAL '3586 minutes'),
('GUEST', 'Could you print a document for me?', '401', NULL, 160, 'NEUTRAL', NOW() - INTERVAL '2401 minutes'),
('AI', 'We have received your request regarding: Printing request. We will assist you shortly.', '401', NULL, 160, 'POSITIVE', NOW() - INTERVAL '2399 minutes'),
('GUEST', 'Spilled wine on the carpet, need cleaning.', '301', NULL, 161, 'NEUTRAL', NOW() - INTERVAL '3719 minutes'),
('AI', 'We have received your request regarding: Carpet cleaning. We will assist you shortly.', '301', NULL, 161, 'POSITIVE', NOW() - INTERVAL '3717 minutes'),
('GUEST', 'Please clear the room service trays.', '303', NULL, 162, 'NEUTRAL', NOW() - INTERVAL '2478 minutes'),
('AI', 'We have received your request regarding: Tray clearance. We will assist you shortly.', '303', NULL, 162, 'POSITIVE', NOW() - INTERVAL '2476 minutes'),
('GUEST', 'Is there a good jogging route around here?', '103', NULL, 163, 'NEUTRAL', NOW() - INTERVAL '3384 minutes'),
('AI', 'We have received your request regarding: Jogging route. We will assist you shortly.', '103', NULL, 163, 'POSITIVE', NOW() - INTERVAL '3382 minutes'),
('GUEST', 'Please clear the room service trays.', '305', NULL, 164, 'NEUTRAL', NOW() - INTERVAL '13576 minutes'),
('AI', 'We have received your request regarding: Tray clearance. We will assist you shortly.', '305', NULL, 164, 'POSITIVE', NOW() - INTERVAL '13574 minutes'),
('GUEST', 'Please make up my room.', '104', NULL, 165, 'NEUTRAL', NOW() - INTERVAL '1711 minutes'),
('AI', 'We have received your request regarding: Room makeup. We will assist you shortly.', '104', NULL, 165, 'POSITIVE', NOW() - INTERVAL '1709 minutes'),
('GUEST', 'Two Club Sandwiches and a Coke, please.', '203', NULL, 166, 'NEUTRAL', NOW() - INTERVAL '4163 minutes'),
('AI', 'We have received your request regarding: Food order. We will assist you shortly.', '203', NULL, 166, 'POSITIVE', NOW() - INTERVAL '4161 minutes'),
('GUEST', 'Could I get an iron and ironing board?', '401', NULL, 167, 'NEUTRAL', NOW() - INTERVAL '9734 minutes'),
('AI', 'We have received your request regarding: Iron requested. We will assist you shortly.', '401', NULL, 167, 'POSITIVE', NOW() - INTERVAL '9732 minutes'),
('GUEST', 'Could you print a document for me?', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 168, 'NEUTRAL', NOW() - INTERVAL '6284 minutes'),
('AI', 'We have received your request regarding: Printing request. We will assist you shortly.', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 168, 'POSITIVE', NOW() - INTERVAL '6282 minutes'),
('GUEST', 'Allergic to peanuts, please make sure the salad is safe.', '202', NULL, 169, 'NEUTRAL', NOW() - INTERVAL '13165 minutes'),
('AI', 'We have received your request regarding: Allergy instruction. We will assist you shortly.', '202', NULL, 169, 'POSITIVE', NOW() - INTERVAL '13163 minutes'),
('GUEST', 'I need extra pillows.', '201', NULL, 170, 'NEUTRAL', NOW() - INTERVAL '13630 minutes'),
('AI', 'We have received your request regarding: Extra pillows requested. We will assist you shortly.', '201', NULL, 170, 'POSITIVE', NOW() - INTERVAL '13628 minutes'),
('GUEST', 'Room is too cold, thermostat doesn''t work.', '503', NULL, 171, 'NEUTRAL', NOW() - INTERVAL '23 minutes'),
('AI', 'We have received your request regarding: Heating issue. We will assist you shortly.', '503', NULL, 171, 'POSITIVE', NOW() - INTERVAL '21 minutes'),
('GUEST', 'My wife just slipped in the bathroom and can''t get up.', '204', NULL, 172, 'NEUTRAL', NOW() - INTERVAL '13311 minutes'),
('AI', 'We have received your request regarding: Fall injury. We will assist you shortly.', '204', NULL, 172, 'POSITIVE', NOW() - INTERVAL '13309 minutes'),
('GUEST', 'Wi-Fi keeps disconnecting.', '303', NULL, 173, 'NEUTRAL', NOW() - INTERVAL '13103 minutes'),
('AI', 'We have received your request regarding: Wi-Fi issue. We will assist you shortly.', '303', NULL, 173, 'POSITIVE', NOW() - INTERVAL '13101 minutes'),
('GUEST', 'Wi-Fi keeps disconnecting.', '302', NULL, 174, 'NEUTRAL', NOW() - INTERVAL '13445 minutes'),
('AI', 'We have received your request regarding: Wi-Fi issue. We will assist you shortly.', '302', NULL, 174, 'POSITIVE', NOW() - INTERVAL '13443 minutes'),
('GUEST', 'There are no fresh towels left.', '203', NULL, 175, 'NEUTRAL', NOW() - INTERVAL '1353 minutes'),
('AI', 'We have received your request regarding: Towels requested. We will assist you shortly.', '203', NULL, 175, 'POSITIVE', NOW() - INTERVAL '1351 minutes'),
('GUEST', 'Room is too cold, thermostat doesn''t work.', '303', NULL, 176, 'NEUTRAL', NOW() - INTERVAL '14266 minutes'),
('AI', 'We have received your request regarding: Heating issue. We will assist you shortly.', '303', NULL, 176, 'POSITIVE', NOW() - INTERVAL '14264 minutes'),
('GUEST', 'Can I get a late checkout until 2 PM?', '302', NULL, 177, 'NEUTRAL', NOW() - INTERVAL '7799 minutes'),
('AI', 'We have received your request regarding: Late checkout. We will assist you shortly.', '302', NULL, 177, 'POSITIVE', NOW() - INTERVAL '7797 minutes'),
('GUEST', 'Where can I buy a local SIM card?', '303', NULL, 178, 'NEUTRAL', NOW() - INTERVAL '13007 minutes'),
('AI', 'We have received your request regarding: SIM card info. We will assist you shortly.', '303', NULL, 178, 'POSITIVE', NOW() - INTERVAL '13005 minutes'),
('GUEST', 'Someone is trying to open my door.', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 179, 'NEUTRAL', NOW() - INTERVAL '2437 minutes'),
('AI', 'We have received your request regarding: Security alert. We will assist you shortly.', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 179, 'POSITIVE', NOW() - INTERVAL '2435 minutes'),
('GUEST', 'I need tickets to the museum.', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 180, 'NEUTRAL', NOW() - INTERVAL '7690 minutes'),
('AI', 'We have received your request regarding: Museum tickets. We will assist you shortly.', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 180, 'POSITIVE', NOW() - INTERVAL '7688 minutes'),
('GUEST', 'Could I get an iron and ironing board?', '105', NULL, 181, 'NEUTRAL', NOW() - INTERVAL '4401 minutes'),
('AI', 'We have received your request regarding: Iron requested. We will assist you shortly.', '105', NULL, 181, 'POSITIVE', NOW() - INTERVAL '4399 minutes'),
('GUEST', 'Out of shampoo and body wash.', '503', NULL, 182, 'NEUTRAL', NOW() - INTERVAL '6532 minutes'),
('AI', 'We have received your request regarding: Amenity refill. We will assist you shortly.', '503', NULL, 182, 'POSITIVE', NOW() - INTERVAL '6530 minutes'),
('GUEST', 'Curtains are stuck and won''t close.', '401', NULL, 183, 'NEUTRAL', NOW() - INTERVAL '11597 minutes'),
('AI', 'We have received your request regarding: Curtain repair. We will assist you shortly.', '401', NULL, 183, 'POSITIVE', NOW() - INTERVAL '11595 minutes'),
('GUEST', 'Please clear the room service trays.', '402', NULL, 184, 'NEUTRAL', NOW() - INTERVAL '8464 minutes'),
('AI', 'We have received your request regarding: Tray clearance. We will assist you shortly.', '402', NULL, 184, 'POSITIVE', NOW() - INTERVAL '8462 minutes'),
('GUEST', 'Light bulb is flickering in the bathroom.', '303', NULL, 185, 'NEUTRAL', NOW() - INTERVAL '6780 minutes'),
('AI', 'We have received your request regarding: Flickering light. We will assist you shortly.', '303', NULL, 185, 'POSITIVE', NOW() - INTERVAL '6778 minutes'),
('GUEST', 'Please make up my room.', '503', NULL, 186, 'NEUTRAL', NOW() - INTERVAL '11130 minutes'),
('AI', 'We have received your request regarding: Room makeup. We will assist you shortly.', '503', NULL, 186, 'POSITIVE', NOW() - INTERVAL '11128 minutes'),
('GUEST', 'Safe box won''t open.', '501', NULL, 187, 'NEUTRAL', NOW() - INTERVAL '7334 minutes'),
('AI', 'We have received your request regarding: Safe locked. We will assist you shortly.', '501', NULL, 187, 'POSITIVE', NOW() - INTERVAL '7332 minutes'),
('GUEST', 'Could I get an iron and ironing board?', '102', NULL, 188, 'NEUTRAL', NOW() - INTERVAL '11985 minutes'),
('AI', 'We have received your request regarding: Iron requested. We will assist you shortly.', '102', NULL, 188, 'POSITIVE', NOW() - INTERVAL '11983 minutes'),
('GUEST', 'Any recommendations for kid-friendly activities?', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 189, 'NEUTRAL', NOW() - INTERVAL '2797 minutes'),
('AI', 'We have received your request regarding: Activity recommendation. We will assist you shortly.', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 189, 'POSITIVE', NOW() - INTERVAL '2795 minutes'),
('GUEST', 'Need some extra coffee pods for the machine.', '502', NULL, 190, 'NEUTRAL', NOW() - INTERVAL '4594 minutes'),
('AI', 'We have received your request regarding: Coffee pods. We will assist you shortly.', '502', NULL, 190, 'POSITIVE', NOW() - INTERVAL '4592 minutes'),
('GUEST', 'Curtains are stuck and won''t close.', '402', NULL, 191, 'NEUTRAL', NOW() - INTERVAL '2016 minutes'),
('AI', 'We have received your request regarding: Curtain repair. We will assist you shortly.', '402', NULL, 191, 'POSITIVE', NOW() - INTERVAL '2014 minutes'),
('GUEST', 'Light bulb is flickering in the bathroom.', '203', NULL, 192, 'NEUTRAL', NOW() - INTERVAL '813 minutes'),
('AI', 'We have received your request regarding: Flickering light. We will assist you shortly.', '203', NULL, 192, 'POSITIVE', NOW() - INTERVAL '811 minutes'),
('GUEST', 'Please make up my room.', '503', NULL, 193, 'NEUTRAL', NOW() - INTERVAL '7113 minutes'),
('AI', 'We have received your request regarding: Room makeup. We will assist you shortly.', '503', NULL, 193, 'POSITIVE', NOW() - INTERVAL '7111 minutes'),
('GUEST', 'The elevator is stuck between floors.', '104', NULL, 194, 'NEUTRAL', NOW() - INTERVAL '8155 minutes'),
('AI', 'We have received your request regarding: Stuck elevator. We will assist you shortly.', '104', NULL, 194, 'POSITIVE', NOW() - INTERVAL '8153 minutes'),
('GUEST', 'Where can I buy a local SIM card?', '403', NULL, 195, 'NEUTRAL', NOW() - INTERVAL '10385 minutes'),
('AI', 'We have received your request regarding: SIM card info. We will assist you shortly.', '403', NULL, 195, 'POSITIVE', NOW() - INTERVAL '10383 minutes'),
('GUEST', 'Light bulb is flickering in the bathroom.', '304', NULL, 196, 'NEUTRAL', NOW() - INTERVAL '5229 minutes'),
('AI', 'We have received your request regarding: Flickering light. We will assist you shortly.', '304', NULL, 196, 'POSITIVE', NOW() - INTERVAL '5227 minutes'),
('GUEST', 'Any recommendations for kid-friendly activities?', '401', NULL, 197, 'NEUTRAL', NOW() - INTERVAL '5181 minutes'),
('AI', 'We have received your request regarding: Activity recommendation. We will assist you shortly.', '401', NULL, 197, 'POSITIVE', NOW() - INTERVAL '5179 minutes'),
('GUEST', 'Allergic to peanuts, please make sure the salad is safe.', '402', NULL, 198, 'NEUTRAL', NOW() - INTERVAL '2060 minutes'),
('AI', 'We have received your request regarding: Allergy instruction. We will assist you shortly.', '402', NULL, 198, 'POSITIVE', NOW() - INTERVAL '2058 minutes'),
('GUEST', 'Can we have a bucket of ice sent up?', '303', NULL, 199, 'NEUTRAL', NOW() - INTERVAL '10473 minutes'),
('AI', 'We have received your request regarding: Ice bucket. We will assist you shortly.', '303', NULL, 199, 'POSITIVE', NOW() - INTERVAL '10471 minutes'),
('GUEST', 'The guests next door are shouting.', '401', NULL, 200, 'NEUTRAL', NOW() - INTERVAL '13484 minutes'),
('AI', 'We have received your request regarding: Noise complaint. We will assist you shortly.', '401', NULL, 200, 'POSITIVE', NOW() - INTERVAL '13482 minutes'),
('GUEST', 'I need tickets to the museum.', '401', NULL, 201, 'NEUTRAL', NOW() - INTERVAL '11577 minutes'),
('AI', 'We have received your request regarding: Museum tickets. We will assist you shortly.', '401', NULL, 201, 'POSITIVE', NOW() - INTERVAL '11575 minutes'),
('GUEST', 'Is it possible to switch to a room with a better view?', '204', NULL, 202, 'NEUTRAL', NOW() - INTERVAL '6839 minutes'),
('AI', 'We have received your request regarding: Room change. We will assist you shortly.', '204', NULL, 202, 'POSITIVE', NOW() - INTERVAL '6837 minutes'),
('GUEST', 'Two Club Sandwiches and a Coke, please.', '301', NULL, 203, 'NEUTRAL', NOW() - INTERVAL '381 minutes'),
('AI', 'We have received your request regarding: Food order. We will assist you shortly.', '301', NULL, 203, 'POSITIVE', NOW() - INTERVAL '379 minutes'),
('GUEST', 'Someone is trying to open my door.', '301', NULL, 204, 'NEUTRAL', NOW() - INTERVAL '2857 minutes'),
('AI', 'We have received your request regarding: Security alert. We will assist you shortly.', '301', NULL, 204, 'POSITIVE', NOW() - INTERVAL '2855 minutes'),
('GUEST', 'Room is too cold, thermostat doesn''t work.', '304', NULL, 205, 'NEUTRAL', NOW() - INTERVAL '2255 minutes'),
('AI', 'We have received your request regarding: Heating issue. We will assist you shortly.', '304', NULL, 205, 'POSITIVE', NOW() - INTERVAL '2253 minutes'),
('GUEST', 'Sink is draining very slowly.', '304', NULL, 206, 'NEUTRAL', NOW() - INTERVAL '8591 minutes'),
('AI', 'We have received your request regarding: Slow drain. We will assist you shortly.', '304', NULL, 206, 'POSITIVE', NOW() - INTERVAL '8589 minutes'),
('GUEST', 'I cut my hand deeply, I need a first aid kit!', '304', NULL, 207, 'NEUTRAL', NOW() - INTERVAL '3822 minutes'),
('AI', 'We have received your request regarding: Medical emergency. We will assist you shortly.', '304', NULL, 207, 'POSITIVE', NOW() - INTERVAL '3820 minutes'),
('GUEST', 'Can I get breakfast in bed tomorrow at 8 AM?', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 208, 'NEUTRAL', NOW() - INTERVAL '4001 minutes'),
('AI', 'We have received your request regarding: Breakfast order. We will assist you shortly.', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 208, 'POSITIVE', NOW() - INTERVAL '3999 minutes'),
('GUEST', 'I need a wake-up call at 6 AM tomorrow.', '501', NULL, 209, 'NEUTRAL', NOW() - INTERVAL '9759 minutes'),
('AI', 'We have received your request regarding: Wake-up call. We will assist you shortly.', '501', NULL, 209, 'POSITIVE', NOW() - INTERVAL '9757 minutes'),
('GUEST', 'The elevator is stuck between floors.', '302', NULL, 210, 'NEUTRAL', NOW() - INTERVAL '1503 minutes'),
('AI', 'We have received your request regarding: Stuck elevator. We will assist you shortly.', '302', NULL, 210, 'POSITIVE', NOW() - INTERVAL '1501 minutes'),
('GUEST', 'Out of shampoo and body wash.', '301', NULL, 211, 'NEUTRAL', NOW() - INTERVAL '14149 minutes'),
('AI', 'We have received your request regarding: Amenity refill. We will assist you shortly.', '301', NULL, 211, 'POSITIVE', NOW() - INTERVAL '14147 minutes'),
('GUEST', 'The trash bin is overflowing.', '502', NULL, 212, 'NEUTRAL', NOW() - INTERVAL '7289 minutes'),
('AI', 'We have received your request regarding: Trash removal. We will assist you shortly.', '502', NULL, 212, 'POSITIVE', NOW() - INTERVAL '7287 minutes'),
('GUEST', 'The guests next door are shouting.', '105', NULL, 213, 'NEUTRAL', NOW() - INTERVAL '7212 minutes'),
('AI', 'We have received your request regarding: Noise complaint. We will assist you shortly.', '105', NULL, 213, 'POSITIVE', NOW() - INTERVAL '7210 minutes'),
('GUEST', 'Curtains are stuck and won''t close.', '202', NULL, 214, 'NEUTRAL', NOW() - INTERVAL '1582 minutes'),
('AI', 'We have received your request regarding: Curtain repair. We will assist you shortly.', '202', NULL, 214, 'POSITIVE', NOW() - INTERVAL '1580 minutes'),
('GUEST', 'Can I get a late checkout until 2 PM?', '202', NULL, 215, 'NEUTRAL', NOW() - INTERVAL '12407 minutes'),
('AI', 'We have received your request regarding: Late checkout. We will assist you shortly.', '202', NULL, 215, 'POSITIVE', NOW() - INTERVAL '12405 minutes'),
('GUEST', 'The elevator is stuck between floors.', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 216, 'NEUTRAL', NOW() - INTERVAL '6922 minutes'),
('AI', 'We have received your request regarding: Stuck elevator. We will assist you shortly.', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 216, 'POSITIVE', NOW() - INTERVAL '6920 minutes'),
('GUEST', 'Allergic to peanuts, please make sure the salad is safe.', '501', NULL, 217, 'NEUTRAL', NOW() - INTERVAL '4645 minutes'),
('AI', 'We have received your request regarding: Allergy instruction. We will assist you shortly.', '501', NULL, 217, 'POSITIVE', NOW() - INTERVAL '4643 minutes'),
('GUEST', 'Please clear the room service trays.', '105', NULL, 218, 'NEUTRAL', NOW() - INTERVAL '2048 minutes'),
('AI', 'We have received your request regarding: Tray clearance. We will assist you shortly.', '105', NULL, 218, 'POSITIVE', NOW() - INTERVAL '2046 minutes'),
('GUEST', 'Can you book a table at a sushi restaurant?', '501', NULL, 219, 'NEUTRAL', NOW() - INTERVAL '3418 minutes'),
('AI', 'We have received your request regarding: Restaurant booking. We will assist you shortly.', '501', NULL, 219, 'POSITIVE', NOW() - INTERVAL '3416 minutes'),
('GUEST', 'I need tickets to the museum.', '103', NULL, 220, 'NEUTRAL', NOW() - INTERVAL '12193 minutes'),
('AI', 'We have received your request regarding: Museum tickets. We will assist you shortly.', '103', NULL, 220, 'POSITIVE', NOW() - INTERVAL '12191 minutes'),
('GUEST', 'The elevator is stuck between floors.', '105', NULL, 221, 'NEUTRAL', NOW() - INTERVAL '2628 minutes'),
('AI', 'We have received your request regarding: Stuck elevator. We will assist you shortly.', '105', NULL, 221, 'POSITIVE', NOW() - INTERVAL '2626 minutes'),
('GUEST', 'I cut my hand deeply, I need a first aid kit!', '106', NULL, 222, 'NEUTRAL', NOW() - INTERVAL '5252 minutes'),
('AI', 'We have received your request regarding: Medical emergency. We will assist you shortly.', '106', NULL, 222, 'POSITIVE', NOW() - INTERVAL '5250 minutes'),
('GUEST', 'Safe box won''t open.', '402', NULL, 223, 'NEUTRAL', NOW() - INTERVAL '1921 minutes'),
('AI', 'We have received your request regarding: Safe locked. We will assist you shortly.', '402', NULL, 223, 'POSITIVE', NOW() - INTERVAL '1919 minutes'),
('GUEST', 'I''d like to order a bottle of red wine.', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 224, 'NEUTRAL', NOW() - INTERVAL '2517 minutes'),
('AI', 'We have received your request regarding: Wine order. We will assist you shortly.', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 224, 'POSITIVE', NOW() - INTERVAL '2515 minutes'),
('GUEST', 'The trash bin is overflowing.', '106', NULL, 225, 'NEUTRAL', NOW() - INTERVAL '10486 minutes'),
('AI', 'We have received your request regarding: Trash removal. We will assist you shortly.', '106', NULL, 225, 'POSITIVE', NOW() - INTERVAL '10484 minutes'),
('GUEST', 'The TV remote is not working.', '201', NULL, 226, 'NEUTRAL', NOW() - INTERVAL '2054 minutes'),
('AI', 'We have received your request regarding: TV remote issue. We will assist you shortly.', '201', NULL, 226, 'POSITIVE', NOW() - INTERVAL '2052 minutes'),
('GUEST', 'Safe box won''t open.', '106', NULL, 227, 'NEUTRAL', NOW() - INTERVAL '3675 minutes'),
('AI', 'We have received your request regarding: Safe locked. We will assist you shortly.', '106', NULL, 227, 'POSITIVE', NOW() - INTERVAL '3673 minutes'),
('GUEST', 'The elevator is stuck between floors.', '201', NULL, 228, 'NEUTRAL', NOW() - INTERVAL '9762 minutes'),
('AI', 'We have received your request regarding: Stuck elevator. We will assist you shortly.', '201', NULL, 228, 'POSITIVE', NOW() - INTERVAL '9760 minutes'),
('GUEST', 'Two Club Sandwiches and a Coke, please.', '304', NULL, 229, 'NEUTRAL', NOW() - INTERVAL '3733 minutes'),
('AI', 'We have received your request regarding: Food order. We will assist you shortly.', '304', NULL, 229, 'POSITIVE', NOW() - INTERVAL '3731 minutes'),
('GUEST', 'Is there a good jogging route around here?', '302', NULL, 230, 'NEUTRAL', NOW() - INTERVAL '3475 minutes'),
('AI', 'We have received your request regarding: Jogging route. We will assist you shortly.', '302', NULL, 230, 'POSITIVE', NOW() - INTERVAL '3473 minutes'),
('GUEST', 'Please make up my room.', '203', NULL, 231, 'NEUTRAL', NOW() - INTERVAL '12461 minutes'),
('AI', 'We have received your request regarding: Room makeup. We will assist you shortly.', '203', NULL, 231, 'POSITIVE', NOW() - INTERVAL '12459 minutes'),
('GUEST', 'Two Club Sandwiches and a Coke, please.', '402', NULL, 232, 'NEUTRAL', NOW() - INTERVAL '10644 minutes'),
('AI', 'We have received your request regarding: Food order. We will assist you shortly.', '402', NULL, 232, 'POSITIVE', NOW() - INTERVAL '10642 minutes'),
('GUEST', 'I need extra pillows.', '302', NULL, 233, 'NEUTRAL', NOW() - INTERVAL '6675 minutes'),
('AI', 'We have received your request regarding: Extra pillows requested. We will assist you shortly.', '302', NULL, 233, 'POSITIVE', NOW() - INTERVAL '6673 minutes'),
('GUEST', 'Please clear the room service trays.', '102', NULL, 234, 'NEUTRAL', NOW() - INTERVAL '10688 minutes'),
('AI', 'We have received your request regarding: Tray clearance. We will assist you shortly.', '102', NULL, 234, 'POSITIVE', NOW() - INTERVAL '10686 minutes'),
('GUEST', 'Allergic to peanuts, please make sure the salad is safe.', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 235, 'NEUTRAL', NOW() - INTERVAL '1612 minutes'),
('AI', 'We have received your request regarding: Allergy instruction. We will assist you shortly.', '707', (SELECT id FROM pms_guest WHERE room_no = '707'), 235, 'POSITIVE', NOW() - INTERVAL '1610 minutes'),
('GUEST', 'I need tickets to the museum.', '205', NULL, 236, 'NEUTRAL', NOW() - INTERVAL '6829 minutes'),
('AI', 'We have received your request regarding: Museum tickets. We will assist you shortly.', '205', NULL, 236, 'POSITIVE', NOW() - INTERVAL '6827 minutes'),
('GUEST', 'I need tickets to the museum.', '502', NULL, 237, 'NEUTRAL', NOW() - INTERVAL '12150 minutes'),
('AI', 'We have received your request regarding: Museum tickets. We will assist you shortly.', '502', NULL, 237, 'POSITIVE', NOW() - INTERVAL '12148 minutes'),
('GUEST', 'Can you book a table at a sushi restaurant?', '103', NULL, 238, 'NEUTRAL', NOW() - INTERVAL '7686 minutes'),
('AI', 'We have received your request regarding: Restaurant booking. We will assist you shortly.', '103', NULL, 238, 'POSITIVE', NOW() - INTERVAL '7684 minutes'),
('GUEST', 'Can you book a table at a sushi restaurant?', '202', NULL, 239, 'NEUTRAL', NOW() - INTERVAL '3009 minutes'),
('AI', 'We have received your request regarding: Restaurant booking. We will assist you shortly.', '202', NULL, 239, 'POSITIVE', NOW() - INTERVAL '3007 minutes'),
('GUEST', 'Someone is trying to open my door.', '103', NULL, 240, 'NEUTRAL', NOW() - INTERVAL '12281 minutes'),
('AI', 'We have received your request regarding: Security alert. We will assist you shortly.', '103', NULL, 240, 'POSITIVE', NOW() - INTERVAL '12279 minutes'),
('GUEST', 'Room is too cold, thermostat doesn''t work.', '201', NULL, 241, 'NEUTRAL', NOW() - INTERVAL '820 minutes'),
('AI', 'We have received your request regarding: Heating issue. We will assist you shortly.', '201', NULL, 241, 'POSITIVE', NOW() - INTERVAL '818 minutes'),
('GUEST', 'Could you print a document for me?', '304', NULL, 242, 'NEUTRAL', NOW() - INTERVAL '1408 minutes'),
('AI', 'We have received your request regarding: Printing request. We will assist you shortly.', '304', NULL, 242, 'POSITIVE', NOW() - INTERVAL '1406 minutes'),
('GUEST', 'Is there a good jogging route around here?', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 243, 'NEUTRAL', NOW() - INTERVAL '14340 minutes'),
('AI', 'We have received your request regarding: Jogging route. We will assist you shortly.', '101', (SELECT id FROM pms_guest WHERE room_no = '101'), 243, 'POSITIVE', NOW() - INTERVAL '14338 minutes'),
('GUEST', 'Where can I buy a local SIM card?', '301', NULL, 244, 'NEUTRAL', NOW() - INTERVAL '6386 minutes'),
('AI', 'We have received your request regarding: SIM card info. We will assist you shortly.', '301', NULL, 244, 'POSITIVE', NOW() - INTERVAL '6384 minutes'),
('GUEST', 'My wife just slipped in the bathroom and can''t get up.', '302', NULL, 245, 'NEUTRAL', NOW() - INTERVAL '8251 minutes'),
('AI', 'We have received your request regarding: Fall injury. We will assist you shortly.', '302', NULL, 245, 'POSITIVE', NOW() - INTERVAL '8249 minutes'),
('GUEST', 'Please make up my room.', '105', NULL, 246, 'NEUTRAL', NOW() - INTERVAL '8612 minutes'),
('AI', 'We have received your request regarding: Room makeup. We will assist you shortly.', '105', NULL, 246, 'POSITIVE', NOW() - INTERVAL '8610 minutes'),
('GUEST', 'Can we have a bucket of ice sent up?', '106', NULL, 247, 'NEUTRAL', NOW() - INTERVAL '10988 minutes'),
('AI', 'We have received your request regarding: Ice bucket. We will assist you shortly.', '106', NULL, 247, 'POSITIVE', NOW() - INTERVAL '10986 minutes'),
('GUEST', 'Light bulb is flickering in the bathroom.', '302', NULL, 248, 'NEUTRAL', NOW() - INTERVAL '13433 minutes'),
('AI', 'We have received your request regarding: Flickering light. We will assist you shortly.', '302', NULL, 248, 'POSITIVE', NOW() - INTERVAL '13431 minutes'),
('GUEST', 'Out of shampoo and body wash.', '302', NULL, 249, 'NEUTRAL', NOW() - INTERVAL '3613 minutes'),
('AI', 'We have received your request regarding: Amenity refill. We will assist you shortly.', '302', NULL, 249, 'POSITIVE', NOW() - INTERVAL '3611 minutes'),
('GUEST', 'Can you send my luggage to the airport?', '503', NULL, 250, 'NEUTRAL', NOW() - INTERVAL '644 minutes'),
('AI', 'We have received your request regarding: Luggage delivery. We will assist you shortly.', '503', NULL, 250, 'POSITIVE', NOW() - INTERVAL '642 minutes'),
('GUEST', 'I cut my hand deeply, I need a first aid kit!', '104', NULL, 251, 'NEUTRAL', NOW() - INTERVAL '5605 minutes'),
('AI', 'We have received your request regarding: Medical emergency. We will assist you shortly.', '104', NULL, 251, 'POSITIVE', NOW() - INTERVAL '5603 minutes'),
('GUEST', 'I need tickets to the museum.', '204', NULL, 252, 'NEUTRAL', NOW() - INTERVAL '13970 minutes'),
('AI', 'We have received your request regarding: Museum tickets. We will assist you shortly.', '204', NULL, 252, 'POSITIVE', NOW() - INTERVAL '13968 minutes'),
('GUEST', 'The elevator is stuck between floors.', '403', NULL, 253, 'NEUTRAL', NOW() - INTERVAL '9966 minutes'),
('AI', 'We have received your request regarding: Stuck elevator. We will assist you shortly.', '403', NULL, 253, 'POSITIVE', NOW() - INTERVAL '9964 minutes'),
('GUEST', 'Allergic to peanuts, please make sure the salad is safe.', '302', NULL, 254, 'NEUTRAL', NOW() - INTERVAL '11443 minutes'),
('AI', 'We have received your request regarding: Allergy instruction. We will assist you shortly.', '302', NULL, 254, 'POSITIVE', NOW() - INTERVAL '11441 minutes'),
('GUEST', 'Wi-Fi keeps disconnecting.', '503', NULL, 255, 'NEUTRAL', NOW() - INTERVAL '3360 minutes'),
('AI', 'We have received your request regarding: Wi-Fi issue. We will assist you shortly.', '503', NULL, 255, 'POSITIVE', NOW() - INTERVAL '3358 minutes'),
('GUEST', 'I need extra pillows.', '202', NULL, 256, 'NEUTRAL', NOW() - INTERVAL '12232 minutes'),
('AI', 'We have received your request regarding: Extra pillows requested. We will assist you shortly.', '202', NULL, 256, 'POSITIVE', NOW() - INTERVAL '12230 minutes'),
('GUEST', 'Light bulb is flickering in the bathroom.', '302', NULL, 257, 'NEUTRAL', NOW() - INTERVAL '3193 minutes'),
('AI', 'We have received your request regarding: Flickering light. We will assist you shortly.', '302', NULL, 257, 'POSITIVE', NOW() - INTERVAL '3191 minutes'),
('GUEST', 'The shower head is leaking water.', '103', NULL, 258, 'NEUTRAL', NOW() - INTERVAL '8416 minutes'),
('AI', 'We have received your request regarding: Shower leak. We will assist you shortly.', '103', NULL, 258, 'POSITIVE', NOW() - INTERVAL '8414 minutes'),
('GUEST', 'Lost my room key at the pool.', '106', NULL, 259, 'NEUTRAL', NOW() - INTERVAL '558 minutes'),
('AI', 'We have received your request regarding: Lost key. We will assist you shortly.', '106', NULL, 259, 'POSITIVE', NOW() - INTERVAL '556 minutes'),
('GUEST', 'The TV remote is not working.', '303', NULL, 260, 'NEUTRAL', NOW() - INTERVAL '12224 minutes'),
('AI', 'We have received your request regarding: TV remote issue. We will assist you shortly.', '303', NULL, 260, 'POSITIVE', NOW() - INTERVAL '12222 minutes'),
('GUEST', 'Can I get breakfast in bed tomorrow at 8 AM?', '304', NULL, 261, 'NEUTRAL', NOW() - INTERVAL '8533 minutes'),
('AI', 'We have received your request regarding: Breakfast order. We will assist you shortly.', '304', NULL, 261, 'POSITIVE', NOW() - INTERVAL '8531 minutes'),
('GUEST', 'Please make up my room.', '105', NULL, 262, 'NEUTRAL', NOW() - INTERVAL '12588 minutes'),
('AI', 'We have received your request regarding: Room makeup. We will assist you shortly.', '105', NULL, 262, 'POSITIVE', NOW() - INTERVAL '12586 minutes'),
('GUEST', 'Out of shampoo and body wash.', '201', NULL, 263, 'NEUTRAL', NOW() - INTERVAL '7647 minutes'),
('AI', 'We have received your request regarding: Amenity refill. We will assist you shortly.', '201', NULL, 263, 'POSITIVE', NOW() - INTERVAL '7645 minutes');
