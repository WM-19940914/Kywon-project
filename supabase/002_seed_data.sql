-- ============================================================
-- 멜레아 에어컨 발주 관리 시스템 - 시드 데이터 (기존 mock 데이터 이전)
-- 001_create_tables.sql 실행 후에 이 파일을 실행하세요!
--
-- 참고: 날짜는 2026-02-02 기준 상대 날짜로 작성되었습니다.
--       실제 환경에서는 NOW() 기준으로 수정하거나 그대로 사용하세요.
-- ============================================================

-- ============================================================
-- 1. 창고 데이터 (14개)
-- ============================================================
INSERT INTO warehouses (id, name, address, manager_name, manager_phone, latitude, longitude) VALUES
  ('1',  '파주창고',     '경기도 파주시 재두루미길 546-10',                 '손지훈', '010-9000-7014', 37.830, 126.730),
  ('2',  '서울사무실',   '서울특별시 강서구 양천로 516',                    '김영찬', '010-9016-9977', 37.560, 126.870),
  ('4',  '충청도창고',   '대전광역시 중구 대종로 488',                     '권대혁', '010-7243-3699', 36.330, 127.430),
  ('5',  '전남창고',     '전라남도 순천시 해룡면 평화길 185',              '정종국', '010-9441-7448', 34.930, 127.520),
  ('6',  '전북창고',     '광주광역시 서구 운천로154번길 39',               '김인호', '010-7645-7753', 35.150, 126.850),
  ('7',  '안성창고',     '경기도 평택시 포승읍 평택항로 107',              '신창근', '010-8033-4401', 36.950, 126.900),
  ('8',  '강원창고',     '강원특별자치도 강릉시 경강로 2539',              '김주남', '010-2797-0598', 37.770, 128.900),
  ('9',  '강원창고',     '강원특별자치도 원주시 지정면 간현로 5',          '김성주', '010-9422-9709', 37.300, 127.880),
  ('10', '강원창고',     '강원특별자치도 춘천시 영서로 2594',              '방종환', '010-9119-5767', 37.870, 127.730),
  ('11', '강원창고',     '경기도 연천군 전곡읍 양연로 888',                '전광천', '010-3426-1119', 38.020, 127.070),
  ('12', '경상도창고',   '경상북도 경산시 진량읍 봉회길 66',               '정용주', '010-7257-5151', 35.870, 128.780),
  ('13', '아산창고',     '충청남도 아산시 배방읍 신흥길 112-19',           '이은창', '010-4087-2121', 36.780, 127.010),
  ('14', '평택창고',     '경기도 평택시 신평로 205',                       '김영찬', '010-9016-9977', 36.980, 127.090)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. 발주 데이터 (15건)
-- 날짜는 CURRENT_DATE 기준 상대값 사용
-- ============================================================
INSERT INTO orders (id, document_number, address, order_date, affiliate, business_name, contact_name, contact_phone, requested_install_date, status, notes, created_at, delivery_status, requested_delivery_date, confirmed_delivery_date, samsung_order_number, completion_date, settlement_date, settlement_month, quote_amount, actual_cost, install_schedule_date, install_complete_date, install_memo) VALUES
-- 1. 접수중 - Wells 영업 센트럴파크 (배송지연)
('1', 'DOC-2024-001', '서울시 강서구 화곡로 123',
  (CURRENT_DATE - 10)::TEXT, 'Wells 영업', 'Wells 영업 센트럴파크시티역 화교빌딩 센트럴파크지점',
  '김영희', '010-1234-5678', (CURRENT_DATE - 3)::TEXT, 'received',
  '주말 시공 요청. 오전 10시 이후 작업 가능', (CURRENT_DATE - 10)::TEXT || 'T09:00:00Z',
  'ordered', (CURRENT_DATE - 2)::TEXT, NULL, 'SO-2026-001',
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),

-- 2. 진행중 - Wells 영업 춘천지사 (오늘 입고 예정)
('2', 'DOC-2024-002', '강원도 춘천시 중앙로 456',
  (CURRENT_DATE - 14)::TEXT, 'Wells 영업', 'Wells 영업 춘천지사',
  '박민수', '010-2345-6789', (CURRENT_DATE - 7)::TEXT, 'in-progress',
  '층고 3.5m, 사다리차 필요', (CURRENT_DATE - 14)::TEXT || 'T10:30:00Z',
  'ordered', CURRENT_DATE::TEXT, CURRENT_DATE::TEXT, 'SO-2026-002',
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),

-- 3. 진행중 - 교육플랫폼 본사 (오늘 입고 예정)
('3', 'DOC-2024-003', '경기도 성남시 분당구 판교역로 789',
  (CURRENT_DATE - 7)::TEXT, '교육플랫폼', '교육플랫폼 본사',
  '최지훈', '010-3456-7890', (CURRENT_DATE - 1)::TEXT, 'in-progress',
  '사무실 전체 교체', (CURRENT_DATE - 7)::TEXT || 'T14:20:00Z',
  'ordered', CURRENT_DATE::TEXT, CURRENT_DATE::TEXT, 'SO-2026-003',
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),

-- 4. 완료 - Wells 서비스 인천센터 (입고완료)
('4', 'DOC-2024-004', '인천시 연수구 송도국제대로 321',
  (CURRENT_DATE - 20)::TEXT, 'Wells 서비스', 'Wells 서비스 인천센터',
  '정수진', '010-4567-8901', (CURRENT_DATE - 10)::TEXT, 'completed',
  '신축 건물, 배관 작업 완료됨', (CURRENT_DATE - 20)::TEXT || 'T11:15:00Z',
  'ordered', (CURRENT_DATE - 15)::TEXT, (CURRENT_DATE - 15)::TEXT, 'SO-2026-004',
  (CURRENT_DATE - 10)::TEXT, NULL, '2024-01', NULL, NULL, NULL, NULL, NULL),

-- 5. 정산완료 - 구몬 마포지국 (입고완료)
('5', 'DOC-2024-005', '서울시 마포구 상암동 654',
  (CURRENT_DATE - 30)::TEXT, '구몬', '구몬 마포지국',
  '이영호', '010-5678-9012', (CURRENT_DATE - 20)::TEXT, 'settled',
  '펜트하우스, 실외기 옥상 설치', (CURRENT_DATE - 30)::TEXT || 'T09:45:00Z',
  'ordered', (CURRENT_DATE - 25)::TEXT, (CURRENT_DATE - 25)::TEXT, 'SO-2026-005',
  (CURRENT_DATE - 20)::TEXT, (CURRENT_DATE - 15)::TEXT, '2024-01', 3200000, 3280000, NULL, NULL, NULL),

-- 6. 접수중 - 대한냉난방 (발주대기)
('6', 'DOC-2024-006', '경기도 고양시 일산동구 중앙로 987',
  (CURRENT_DATE - 3)::TEXT, '기타', '대한냉난방',
  '송미경', '010-6789-0123', (CURRENT_DATE + 4)::TEXT, 'received',
  '기존 에어컨 철거 후 설치', (CURRENT_DATE - 3)::TEXT || 'T16:00:00Z',
  'pending', (CURRENT_DATE + 5)::TEXT, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),

-- 7. 진행중 - 구몬 송파지국 (내일 입고 예정)
('7', 'DOC-2024-007', '서울시 송파구 올림픽로 147, 상가 1층',
  (CURRENT_DATE - 8)::TEXT, '구몬', '구몬 송파지국',
  '강동현', '010-7890-1234', (CURRENT_DATE - 1)::TEXT, 'in-progress',
  '영업시간 외 작업 필수 (저녁 8시 이후)', (CURRENT_DATE - 8)::TEXT || 'T13:30:00Z',
  'ordered', (CURRENT_DATE + 1)::TEXT, (CURRENT_DATE + 1)::TEXT, 'SO-2026-007',
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),

-- 8. 완료 - Wells 영업 수원지사 (입고완료)
('8', 'DOC-2024-008', '경기도 수원시 영통구 광교중앙로 258',
  (CURRENT_DATE - 25)::TEXT, 'Wells 영업', 'Wells 영업 수원지사',
  '윤서연', '010-8901-2345', (CURRENT_DATE - 15)::TEXT, 'completed',
  '친환경 모델, 정부 보조금 대상', (CURRENT_DATE - 25)::TEXT || 'T10:00:00Z',
  'ordered', (CURRENT_DATE - 20)::TEXT, (CURRENT_DATE - 20)::TEXT, 'SO-2026-008',
  (CURRENT_DATE - 15)::TEXT, NULL, '2024-01', NULL, NULL, NULL, NULL, NULL),

-- 9. 진행중 - 교육플랫폼 강서지사 (발주대기)
('9', 'DOC-2024-009', '서울시 강서구 공항대로 369',
  (CURRENT_DATE - 5)::TEXT, '교육플랫폼', '교육플랫폼 강서지사',
  '한재민', '010-9012-3456', (CURRENT_DATE + 2)::TEXT, 'in-progress',
  '원룸형, 간단 설치', (CURRENT_DATE - 5)::TEXT || 'T15:20:00Z',
  'pending', (CURRENT_DATE + 3)::TEXT, NULL, NULL,
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),

-- 10. 정산완료 - Wells 서비스 여의도센터
('10', 'DOC-2024-010', '서울시 영등포구 여의도동 753, 오피스 빌딩 12층',
  (CURRENT_DATE - 40)::TEXT, 'Wells 서비스', 'Wells 서비스 여의도센터',
  '임하늘', '010-0123-4567', (CURRENT_DATE - 30)::TEXT, 'settled',
  '사무실용 대형, 시스템 에어컨', (CURRENT_DATE - 40)::TEXT || 'T08:30:00Z',
  'ordered', (CURRENT_DATE - 35)::TEXT, (CURRENT_DATE - 35)::TEXT, 'SO-2026-010',
  (CURRENT_DATE - 30)::TEXT, (CURRENT_DATE - 25)::TEXT, '2024-01', 5800000, 5750000, NULL, NULL, NULL),

-- 11. 정산완료 - 구몬 강남지국 (작년 12월)
('11', 'DOC-2023-099', '서울시 강남구 테헤란로 427, 위워크 2층',
  '2023-12-15', '구몬', '구몬 강남지국',
  '오준석', '010-1111-2222', '2023-12-22', 'settled',
  '공유 오피스, 3개 룸', '2023-12-15T09:00:00Z',
  'ordered', '2023-12-18', '2023-12-18', NULL,
  '2023-12-22', '2023-12-28', '2023-12', 2400000, 2350000, NULL, NULL, NULL),

-- 12. 정산완료 - 교육플랫폼 분당지사 (작년 12월)
('12', 'DOC-2023-098', '경기도 성남시 분당구 정자일로 95',
  '2023-12-10', '교육플랫폼', '교육플랫폼 분당지사',
  '신유진', '010-2222-3333', '2023-12-18', 'settled',
  '층간 이동 작업', '2023-12-10T14:00:00Z',
  NULL, NULL, NULL, NULL,
  '2023-12-18', '2023-12-26', '2023-12', 800000, 820000, NULL, NULL, NULL),

-- 13. 정산완료 - Wells 영업 부산지사 (작년 11월)
('13', 'DOC-2023-085', '부산시 해운대구 센텀중앙로 78',
  '2023-11-20', 'Wells 영업', 'Wells 영업 부산지사',
  '배승현', '010-3333-4444', '2023-11-28', 'settled',
  '기존 장비 전부 철거 후 교체', '2023-11-20T10:30:00Z',
  'ordered', '2023-11-23', '2023-11-23', NULL,
  '2023-11-28', '2023-11-30', '2023-11', 4200000, 4180000, NULL, NULL, NULL),

-- 14. 진행중 - Wells 서비스 광주센터 (이번 주 입고)
('14', 'DOC-2024-014', '광주광역시 서구 상무중앙로 110',
  (CURRENT_DATE - 6)::TEXT, 'Wells 서비스', 'Wells 서비스 광주센터',
  '장미래', '010-4444-5555', (CURRENT_DATE + 1)::TEXT, 'in-progress',
  '사무실 2개층 설치', (CURRENT_DATE - 6)::TEXT || 'T09:00:00Z',
  'ordered', (CURRENT_DATE + 4)::TEXT, (CURRENT_DATE + 4)::TEXT, 'SO-2026-014',
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),

-- 15. 접수중 - 구몬 대구지국 (이번 주 입고)
('15', 'DOC-2024-015', '대구광역시 수성구 달구벌대로 2200',
  (CURRENT_DATE - 4)::TEXT, '구몬', '구몬 대구지국',
  '조하늘', '010-5555-6666', (CURRENT_DATE + 3)::TEXT, 'received',
  '1층 상가, 주차 편리', (CURRENT_DATE - 4)::TEXT || 'T11:00:00Z',
  'ordered', (CURRENT_DATE + 5)::TEXT, NULL, 'SO-2026-015',
  NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. 발주 내역 데이터 (order_items)
-- ============================================================
INSERT INTO order_items (id, order_id, work_type, category, model, size, quantity) VALUES
  ('1-1', '1', '신규설치', '스탠드에어컨', 'AP072BAPPBH2S', '18평', 2),
  ('1-2', '1', '철거폐기', '벽걸이에어컨', 'OLD-001', '9평', 1),
  ('2-1', '2', '신규설치', '스탠드에어컨', 'AP083BAPPBH2S', '23평', 3),
  ('3-1', '3', '신규설치', '스탠드에어컨', 'AP052BAPPBH2S', '13평', 5),
  ('4-1', '4', '신규설치', '벽걸이에어컨', 'AR60F09C13WS', '9평', 4),
  ('5-1', '5', '신규설치', '스탠드에어컨', 'AP110BAPPBH2S', '30평', 1),
  ('5-2', '5', '철거보관', '스탠드에어컨', 'OLD-002', '30평', 1),
  ('6-1', '6', '이전설치', '벽걸이에어컨', 'AR60F09C13WS', '9평', 3),
  ('7-1', '7', '신규설치', '스탠드에어컨', 'AP145BAPPHH2S', '40평', 2),
  ('8-1', '8', '신규설치', '스탠드에어컨', 'AP060BAPPBH2S', '15평', 2),
  ('9-1', '9', '신규설치', '벽걸이에어컨', 'AR60F07C14WS', '7평', 1),
  ('10-1', '10', '신규설치', '스탠드에어컨', 'AP290DAPDHH1S', '83평', 1),
  ('10-2', '10', '신규설치', '벽걸이에어컨', 'AR60F16C14WS', '16평', 3),
  ('11-1', '11', '신규설치', '벽걸이에어컨', 'AR60F13C13WS', '13평', 3),
  ('12-1', '12', '이전설치', '스탠드에어컨', 'AP060BAPPBH2S', '15평', 2),
  ('13-1', '13', '신규설치', '스탠드에어컨', 'AP130BAPPHH2S', '36평', 2),
  ('13-2', '13', '철거폐기', '스탠드에어컨', 'OLD-003', '36평', 2),
  ('14-1', '14', '신규설치', '스탠드에어컨', 'AP110BAPPHH2S', '30평', 2),
  ('15-1', '15', '신규설치', '벽걸이에어컨', 'AR60F11C13WS', '11평', 2)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 4. 구성품 배송 데이터 (equipment_items)
-- ============================================================
INSERT INTO equipment_items (id, order_id, set_model, component_name, component_model, supplier, order_number, order_date, requested_delivery_date, scheduled_delivery_date, confirmed_delivery_date, quantity, unit_price, total_price, warehouse_id, delivery_status) VALUES
-- Order 1: AP072BAPPBH2S x2 (6 구성품)
('eq-1-1', '1', 'AP072BAPPBH2S', '실외기', 'AC072BXAPBH5', '삼성전자', 'SO-2026-001', (CURRENT_DATE-10)::TEXT, (CURRENT_DATE-2)::TEXT, NULL, NULL, 1, 728857, 728857, '1', 'scheduled'),
('eq-1-2', '1', 'AP072BAPPBH2S', '실내기', 'AP072BNPPBH1', '삼성전자', 'SO-2026-001', (CURRENT_DATE-10)::TEXT, (CURRENT_DATE-2)::TEXT, NULL, NULL, 1, 417457, 417457, '1', 'scheduled'),
('eq-1-3', '1', 'AP072BAPPBH2S', '자재박스', 'FPH-1458XS1', '삼성전자', 'SO-2026-001', (CURRENT_DATE-10)::TEXT, (CURRENT_DATE-2)::TEXT, NULL, NULL, 1, 71286, 71286, '1', 'scheduled'),
('eq-1-4', '1', 'AP072BAPPBH2S', '실외기', 'AC072BXAPBH5', '삼성전자', 'SO-2026-001-2', (CURRENT_DATE-10)::TEXT, (CURRENT_DATE-2)::TEXT, NULL, NULL, 1, 728857, 728857, '1', 'ordered'),
('eq-1-5', '1', 'AP072BAPPBH2S', '실내기', 'AP072BNPPBH1', '삼성전자', 'SO-2026-001-2', (CURRENT_DATE-10)::TEXT, NULL, NULL, NULL, 1, 417457, 417457, '1', 'ordered'),
('eq-1-6', '1', 'AP072BAPPBH2S', '자재박스', 'FPH-1458XS1', '삼성전자', 'SO-2026-001-2', (CURRENT_DATE-10)::TEXT, NULL, NULL, NULL, 1, 71286, 71286, '1', 'ordered'),

-- Order 2: AP083BAPPBH2S x3 (3 구성품)
('eq-2-1', '2', 'AP083BAPPBH2S', '실외기', 'AP083BXPPBH3', '삼성전자', 'SO-2026-002', (CURRENT_DATE-14)::TEXT, CURRENT_DATE::TEXT, NULL, CURRENT_DATE::TEXT, 3, 744621, 2233863, '2', 'scheduled'),
('eq-2-2', '2', 'AP083BAPPBH2S', '실내기', 'AP083BNPPBH1', '삼성전자', 'SO-2026-002', (CURRENT_DATE-14)::TEXT, CURRENT_DATE::TEXT, NULL, CURRENT_DATE::TEXT, 3, 462568, 1387704, '2', 'scheduled'),
('eq-2-3', '2', 'AP083BAPPBH2S', '자재박스', 'FPH-3858XS5', '삼성전자', 'SO-2026-002', (CURRENT_DATE-14)::TEXT, CURRENT_DATE::TEXT, NULL, CURRENT_DATE::TEXT, 3, 116411, 349233, '2', 'scheduled'),

-- Order 3: AP052BAPPBH2S x5 (3 구성품)
('eq-3-1', '3', 'AP052BAPPBH2S', '실외기', 'AP052BXPPBH3', '삼성전자', 'SO-2026-003', (CURRENT_DATE-7)::TEXT, CURRENT_DATE::TEXT, NULL, CURRENT_DATE::TEXT, 5, 651559, 3257795, '4', 'scheduled'),
('eq-3-2', '3', 'AP052BAPPBH2S', '실내기', 'AP052BNPPBH1', '삼성전자', 'SO-2026-003', (CURRENT_DATE-7)::TEXT, CURRENT_DATE::TEXT, NULL, CURRENT_DATE::TEXT, 5, 338472, 1692360, '4', 'scheduled'),
('eq-3-3', '3', 'AP052BAPPBH2S', '자재박스', 'FPH-1412XS3', '삼성전자', 'SO-2026-003-B', (CURRENT_DATE-7)::TEXT, CURRENT_DATE::TEXT, NULL, CURRENT_DATE::TEXT, 5, 86669, 433345, '4', 'scheduled'),

-- Order 4: AR60F09C13WS x4 (4 구성품 - 입고완료)
('eq-4-1', '4', 'AR60F09C13WS', '실외기', 'AR60F09C13WXKO', '삼성전자', 'SO-2026-004', (CURRENT_DATE-20)::TEXT, (CURRENT_DATE-15)::TEXT, NULL, (CURRENT_DATE-15)::TEXT, 4, 466692, 1866768, '1', 'confirmed'),
('eq-4-2', '4', 'AR60F09C13WS', '실내기', 'AR60F09C13WNKO', '삼성전자', 'SO-2026-004', (CURRENT_DATE-20)::TEXT, (CURRENT_DATE-15)::TEXT, NULL, (CURRENT_DATE-15)::TEXT, 4, 254885, 1019540, '1', 'confirmed'),
('eq-4-3', '4', 'AR60F09C13WS', '자재박스', 'FRH-1438NH3', '삼성전자', 'SO-2026-004', (CURRENT_DATE-20)::TEXT, (CURRENT_DATE-15)::TEXT, NULL, (CURRENT_DATE-15)::TEXT, 4, 28207, 112828, '1', 'confirmed'),
('eq-4-4', '4', 'AR60F09C13WS', '리모컨', 'ARR-WK8F', '삼성전자', 'SO-2026-004-R', (CURRENT_DATE-20)::TEXT, (CURRENT_DATE-15)::TEXT, NULL, (CURRENT_DATE-15)::TEXT, 4, 24616, 98464, '1', 'confirmed'),

-- Order 7: AP145BAPPHH2S x2 (3 구성품)
('eq-7-1', '7', 'AP145BAPPHH2S', '실외기', 'AC145BXAPHH5', '삼성전자', 'SO-2026-007', (CURRENT_DATE-8)::TEXT, (CURRENT_DATE+1)::TEXT, NULL, (CURRENT_DATE+1)::TEXT, 2, 1032356, 2064712, '1', 'scheduled'),
('eq-7-2', '7', 'AP145BAPPHH2S', '실내기', 'AP145BNPPHH1', '삼성전자', 'SO-2026-007', (CURRENT_DATE-8)::TEXT, (CURRENT_DATE+1)::TEXT, NULL, (CURRENT_DATE+1)::TEXT, 2, 823628, 1647256, '1', 'scheduled'),
('eq-7-3', '7', 'AP145BAPPHH2S', '자재박스', 'FPH-3858XS5', '삼성전자', 'SO-2026-007', (CURRENT_DATE-8)::TEXT, (CURRENT_DATE+1)::TEXT, NULL, NULL, 2, 116416, 232832, '1', 'scheduled'),

-- Order 14: AP110BAPPHH2S x2 (3 구성품)
('eq-14-1', '14', 'AP110BAPPHH2S', '실외기', 'AC110BXAPHH3', '삼성전자', 'SO-2026-014', (CURRENT_DATE-6)::TEXT, (CURRENT_DATE+4)::TEXT, NULL, (CURRENT_DATE+4)::TEXT, 2, 857482, 1714964, '5', 'scheduled'),
('eq-14-2', '14', 'AP110BAPPHH2S', '실내기', 'AP110RNPPHH1', '삼성전자', 'SO-2026-014', (CURRENT_DATE-6)::TEXT, (CURRENT_DATE+4)::TEXT, NULL, (CURRENT_DATE+4)::TEXT, 2, 682601, 1365202, '5', 'scheduled'),
('eq-14-3', '14', 'AP110BAPPHH2S', '자재박스', 'FPH-3858XS5', '삼성전자', 'SO-2026-014', (CURRENT_DATE-6)::TEXT, (CURRENT_DATE+4)::TEXT, NULL, (CURRENT_DATE+4)::TEXT, 2, 116417, 232834, '5', 'scheduled'),

-- Order 15: AR60F11C13WS x2 (4 구성품)
('eq-15-1', '15', 'AR60F11C13WS', '실외기', 'AR60F11C13WXKO', '삼성전자', 'SO-2026-015', (CURRENT_DATE-4)::TEXT, (CURRENT_DATE+5)::TEXT, NULL, NULL, 2, 523123, 1046246, '5', 'scheduled'),
('eq-15-2', '15', 'AR60F11C13WS', '실내기', 'AR60F11C13WNKO', '삼성전자', 'SO-2026-015', (CURRENT_DATE-4)::TEXT, (CURRENT_DATE+5)::TEXT, NULL, NULL, 2, 289769, 579538, '5', 'scheduled'),
('eq-15-3', '15', 'AR60F11C13WS', '자재박스', 'FRH-1412NA3', '삼성전자', 'SO-2026-015', (CURRENT_DATE-4)::TEXT, (CURRENT_DATE+5)::TEXT, NULL, NULL, 2, 39491, 78982, '5', 'scheduled'),
('eq-15-4', '15', 'AR60F11C13WS', '리모컨', 'ARR-WK8F', '삼성전자', 'SO-2026-015-R', (CURRENT_DATE-4)::TEXT, (CURRENT_DATE+5)::TEXT, NULL, NULL, 2, 24617, 49234, '5', 'scheduled')
ON CONFLICT (id) DO NOTHING;
