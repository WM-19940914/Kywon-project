-- ============================================================
-- 철거보관 장비: 제조사/제조년월 컬럼 추가
--
-- manufacturer: 제조사 (기본값: 삼성)
-- manufacturing_date: 제조년월 (YYYY-MM 형식, 예: 2020-06)
-- ============================================================

ALTER TABLE stored_equipment
  ADD COLUMN IF NOT EXISTS manufacturer TEXT DEFAULT '삼성',
  ADD COLUMN IF NOT EXISTS manufacturing_date TEXT;
