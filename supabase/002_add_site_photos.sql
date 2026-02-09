-- ============================================================
-- 현장사진 컬럼 추가 마이그레이션
-- Supabase 대시보드 > SQL Editor에서 실행하세요!
-- ============================================================

-- orders 테이블에 site_photos 컬럼 추가
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS site_photos TEXT[]; -- 현장사진 URL 배열

-- 기본값: 빈 배열
UPDATE orders
SET site_photos = '{}'
WHERE site_photos IS NULL;

-- 코멘트 추가 (문서화 목적)
COMMENT ON COLUMN orders.site_photos IS '현장사진 URL 배열 (Supabase Storage)';
