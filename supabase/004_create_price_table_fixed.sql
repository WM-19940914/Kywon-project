-- ============================================================
-- 연간 단가표 테이블 생성 (수정본)
-- Supabase 대시보드 > SQL Editor에서 실행하세요!
-- ============================================================

-- 혹시 이전에 테이블을 만들었다면 삭제 (주의!)
-- DROP TABLE IF EXISTS price_table_components;
-- DROP TABLE IF EXISTS price_table_sets;

-- 1. SET 모델 단가표
CREATE TABLE IF NOT EXISTS price_table_sets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  category TEXT NOT NULL,              -- 품목 (스탠드형 냉난방, 벽걸이형 등)
  model TEXT NOT NULL UNIQUE,          -- SET 모델명 (예: AP290DAPDHH1S)
  size TEXT NOT NULL,                  -- 평형 (예: 83평)
  price INTEGER NOT NULL,              -- SET 판매가 (VAT 별도)
  year INTEGER DEFAULT 2026,           -- 연도 (기본 2026)
  is_active BOOLEAN DEFAULT true,      -- 활성화 여부
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 구성품 단가표 (SET에 속함)
CREATE TABLE IF NOT EXISTS price_table_components (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  set_model TEXT NOT NULL REFERENCES price_table_sets(model) ON DELETE CASCADE,
  model TEXT NOT NULL,                 -- 구성품 모델명 (예: AP290DNPDHH1)
  type TEXT NOT NULL,                  -- 구성품 타입 (실내기, 실외기, 자재박스 등)
  unit_price INTEGER NOT NULL,         -- 출하가
  sale_price INTEGER NOT NULL,         -- 판매가 (VAT 별도)
  quantity INTEGER DEFAULT 1,          -- 수량
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성 (조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_price_sets_category ON price_table_sets(category);
CREATE INDEX IF NOT EXISTS idx_price_sets_year ON price_table_sets(year);
CREATE INDEX IF NOT EXISTS idx_price_sets_active ON price_table_sets(is_active);
CREATE INDEX IF NOT EXISTS idx_price_components_set_model ON price_table_components(set_model);
CREATE INDEX IF NOT EXISTS idx_price_components_type ON price_table_components(type);

-- 코멘트 추가 (문서화)
COMMENT ON TABLE price_table_sets IS '연간 단가표 - SET 모델';
COMMENT ON TABLE price_table_components IS '연간 단가표 - 구성품';
COMMENT ON COLUMN price_table_sets.is_active IS '활성화 여부 (false면 목록에 안 보임)';
COMMENT ON COLUMN price_table_sets.year IS '단가표 적용 연도';
