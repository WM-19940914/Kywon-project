-- ============================================================
-- Storage 정책 수정: public 업로드/삭제 허용 (테스트용)
-- ============================================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Allow authenticated users to upload" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete" ON storage.objects;

-- public 사용자도 업로드/삭제 가능하게 변경
CREATE POLICY "Allow public to upload"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'site-photos');

CREATE POLICY "Allow public to delete"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'site-photos');
