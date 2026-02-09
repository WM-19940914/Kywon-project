-- ============================================================
-- 철거보관 장비 관리 테이블 (stored_equipment)
--
-- 철거보관 장비를 추적합니다:
-- - 어느 창고에 보관 중인지
-- - 장비 상태 (양호/불량)
-- - 출고 이력 (재설치/폐기/반납)
-- ============================================================

CREATE TABLE IF NOT EXISTS stored_equipment (
  -- 기본 정보
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id         TEXT REFERENCES orders(id) ON DELETE SET NULL,  -- 연결된 발주 (직접 입력 시 null)
  site_name        TEXT NOT NULL,                                  -- 현장명 (예: 구몬 화곡지국)
  affiliate        TEXT,                                           -- 계열사 (예: 구몬, Wells 영업)
  address          TEXT,                                           -- 현장 주소
  category         TEXT NOT NULL,                                  -- 품목 (스탠드에어컨, 벽걸이에어컨 등)
  model            TEXT,                                           -- 모델명
  size             TEXT,                                           -- 평형 (예: 18평)
  quantity         INTEGER NOT NULL DEFAULT 1,                     -- 수량

  -- 보관 정보
  warehouse_id     TEXT REFERENCES warehouses(id) ON DELETE SET NULL,  -- 보관 창고
  storage_start_date TEXT,                                         -- 보관 시작일 (YYYY-MM-DD)
  condition        TEXT NOT NULL DEFAULT 'good',                   -- 장비 상태: good(양호) / poor(불량)
  removal_reason   TEXT,                                           -- 철거 사유
  notes            TEXT,                                           -- 메모

  -- 출고 정보
  status           TEXT NOT NULL DEFAULT 'stored',                 -- stored(보관중) / released(출고완료)
  release_type     TEXT,                                           -- 출고 유형: reinstall(재설치) / dispose(폐기) / return(반납)
  release_date     TEXT,                                           -- 출고일 (YYYY-MM-DD)
  release_destination TEXT,                                        -- 출고 목적지 (재설치 현장명 등)
  release_notes    TEXT,                                           -- 출고 메모

  -- 시스템
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- 인덱스: 상태별/창고별 빠른 조회
CREATE INDEX IF NOT EXISTS idx_stored_equipment_status ON stored_equipment(status);
CREATE INDEX IF NOT EXISTS idx_stored_equipment_warehouse ON stored_equipment(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stored_equipment_order ON stored_equipment(order_id);

-- RLS 비활성화 (테스트 단계)
ALTER TABLE stored_equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stored_equipment_public_access" ON stored_equipment FOR ALL USING (true) WITH CHECK (true);
