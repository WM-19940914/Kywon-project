-- ============================================================
-- 멜레아 에어컨 발주 관리 시스템 - 테이블 생성 스크립트
-- Supabase 대시보드 > SQL Editor에서 실행하세요!
-- ============================================================

-- 1. 창고 테이블 (다른 테이블에서 참조하므로 먼저 생성)
CREATE TABLE IF NOT EXISTS warehouses (
  id TEXT PRIMARY KEY,                    -- 창고 고유번호 (기존 '1', '2' 등 유지)
  name TEXT NOT NULL,                     -- 창고명 (예: 파주창고)
  address TEXT NOT NULL,                  -- 도로명주소
  address_detail TEXT,                    -- 상세주소
  manager_name TEXT,                      -- 담당자명
  manager_phone TEXT,                     -- 담당자 연락처
  capacity INTEGER DEFAULT 100,           -- 수용 가능 용량
  current_stock INTEGER DEFAULT 0,        -- 현재 재고 수량
  notes TEXT,                             -- 비고
  latitude NUMERIC,                       -- 위도
  longitude NUMERIC,                      -- 경도
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 발주 메인 테이블
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,                            -- 발주 고유번호
  document_number TEXT NOT NULL UNIQUE,            -- 문서번호 (DOC-2024-001)
  address TEXT NOT NULL,                           -- 설치 주소
  order_date TEXT,                                 -- 발주일 (YYYY-MM-DD)
  affiliate TEXT NOT NULL,                         -- 계열사
  business_name TEXT NOT NULL,                     -- 사업자명 (현장명)
  contact_name TEXT,                               -- 담당자명
  contact_phone TEXT,                              -- 담당자 연락처
  building_manager_phone TEXT,                     -- 건물관리인 연락처
  requested_install_date TEXT,                     -- 설치요청일
  status TEXT NOT NULL DEFAULT 'received',         -- received/in-progress/completed/settled
  notes TEXT,                                      -- 특이사항
  created_at TEXT,                                 -- 등록일시

  -- 금액 정보
  quote_amount INTEGER,                            -- 견적 금액
  actual_cost INTEGER,                             -- 실제 공사비

  -- 완료/정산 정보
  completion_date TEXT,                            -- 설치완료일
  settlement_date TEXT,                            -- 정산처리일
  settlement_month TEXT,                           -- 정산월 (예: 2024-01)
  is_preliminary_quote BOOLEAN DEFAULT FALSE,      -- 사전견적건 여부

  -- 수익성
  profit_margin NUMERIC,                           -- 마진률 (%)
  profit_amount INTEGER,                           -- 이익금

  -- 배송 정보 (Order 레벨)
  delivery_status TEXT DEFAULT 'pending',           -- pending/ordered
  requested_delivery_date TEXT,                     -- 배송요청일
  confirmed_delivery_date TEXT,                     -- 배송확정일
  samsung_order_number TEXT,                        -- 삼성 주문번호

  -- 설치일정 (설치팀 입력)
  install_schedule_date TEXT,                       -- 설치예정일
  install_complete_date TEXT,                       -- 설치완료일
  install_memo TEXT,                                -- 설치메모

  -- 발주 취소 정보
  cancel_reason TEXT,                               -- 취소 사유
  cancelled_at TEXT,                                -- 취소 일시

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 발주 내역 테이블 (작업종류/품목/모델)
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  work_type TEXT NOT NULL,                -- 작업종류 (신규설치/이전설치/철거보관/철거폐기)
  category TEXT NOT NULL,                 -- 품목 (스탠드에어컨 등)
  model TEXT NOT NULL,                    -- 모델명
  size TEXT,                              -- 평형
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 구성품별 배송 정보 테이블
CREATE TABLE IF NOT EXISTS equipment_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  set_model TEXT,                         -- SET 모델명
  component_name TEXT NOT NULL,           -- 구성품명 (실외기/실내기 등)
  component_model TEXT,                   -- 부품 모델명
  supplier TEXT DEFAULT '삼성전자',       -- 매입처
  order_number TEXT,                      -- 개별 주문번호
  order_date TEXT,                        -- 발주일
  requested_delivery_date TEXT,           -- 배송요청일
  scheduled_delivery_date TEXT,           -- 배송예정일
  confirmed_delivery_date TEXT,           -- 배송확정일 (실제 입고일)
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price INTEGER,                     -- 매입단가
  total_price INTEGER,                    -- 매입금액
  warehouse_id TEXT REFERENCES warehouses(id), -- 입고 창고
  delivery_status TEXT DEFAULT 'none',    -- none/ordered/scheduled/confirmed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 소비자 견적서 테이블
CREATE TABLE IF NOT EXISTS customer_quotes (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  total_amount INTEGER DEFAULT 0,         -- 총 견적 금액
  issued_date TEXT,                       -- 발행일
  valid_until TEXT,                       -- 유효기간
  notes TEXT,                             -- 비고
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 견적서 항목 테이블
CREATE TABLE IF NOT EXISTS quote_items (
  id TEXT PRIMARY KEY,
  quote_id TEXT NOT NULL REFERENCES customer_quotes(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,                -- 항목명
  category TEXT NOT NULL,                 -- equipment / installation
  quantity INTEGER DEFAULT 1,
  unit_price INTEGER DEFAULT 0,           -- 판매단가
  total_price INTEGER DEFAULT 0,          -- 판매금액
  description TEXT,                       -- 추가 설명
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 설치비 항목 테이블
CREATE TABLE IF NOT EXISTS installation_cost_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  unit_price INTEGER DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  total_price INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 재고 이벤트 테이블 (특수 케이스 관리)
-- 선입금 / 취소·미배정 / 대체사용 / 타창고 이동 등을 기록
CREATE TABLE IF NOT EXISTS inventory_events (
  id TEXT PRIMARY KEY DEFAULT ('ie-' || substr(md5(random()::text), 1, 12)),
  event_type TEXT NOT NULL,              -- prepaid / cancelled / substitution / transfer_out / transfer_return
  equipment_item_id TEXT REFERENCES equipment_items(id), -- 관련 구성품 (선입금은 null)
  source_order_id TEXT REFERENCES orders(id),   -- 원래 발주
  target_order_id TEXT REFERENCES orders(id),   -- 새 발주 (대체사용/연결 시)
  source_warehouse_id TEXT REFERENCES warehouses(id), -- 출발 창고
  target_warehouse_id TEXT REFERENCES warehouses(id), -- 도착 창고
  prepaid_amount NUMERIC,                -- 선입금 금액
  affiliate TEXT,                        -- 입금처/계열사 (선입금용)
  model_name TEXT,                       -- 모델명 (표시용)
  site_name TEXT,                        -- 현장명 (표시용)
  status TEXT NOT NULL DEFAULT 'active', -- active / resolved
  notes TEXT,                            -- 메모
  event_date DATE DEFAULT CURRENT_DATE,  -- 이벤트 발생일
  resolved_date DATE,                    -- 처리 완료일
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 인덱스 (검색 속도 향상)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_status ON orders(delivery_status);
CREATE INDEX IF NOT EXISTS idx_orders_settlement_month ON orders(settlement_month);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_equipment_items_order_id ON equipment_items(order_id);
CREATE INDEX IF NOT EXISTS idx_equipment_items_warehouse_id ON equipment_items(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_customer_quotes_order_id ON customer_quotes(order_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_installation_cost_items_order_id ON installation_cost_items(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_events_event_type ON inventory_events(event_type);
CREATE INDEX IF NOT EXISTS idx_inventory_events_status ON inventory_events(status);
CREATE INDEX IF NOT EXISTS idx_inventory_events_event_date ON inventory_events(event_date);

-- ============================================================
-- RLS (Row Level Security) - 일단 비활성화 (나중에 역할별 권한 추가)
-- ============================================================
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE installation_cost_items ENABLE ROW LEVEL SECURITY;

-- 모든 사용자에게 읽기/쓰기 허용 (개발 단계)
CREATE POLICY "Allow all for warehouses" ON warehouses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for order_items" ON order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for equipment_items" ON equipment_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for customer_quotes" ON customer_quotes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for quote_items" ON quote_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for installation_cost_items" ON installation_cost_items FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE inventory_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for inventory_events" ON inventory_events FOR ALL USING (true) WITH CHECK (true);
