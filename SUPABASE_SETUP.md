# Supabase 설정 가이드 (현장사진 업로드)

현장사진 업로드 기능을 사용하려면 Supabase에서 다음 설정이 필요합니다.

---

## 1️⃣ DB 마이그레이션 실행

Supabase 대시보드에서 SQL을 실행하여 `orders` 테이블에 `site_photos` 컬럼을 추가합니다.

### 방법:
1. **Supabase 대시보드** 접속: https://supabase.com/dashboard
2. 프로젝트 선택
3. 좌측 메뉴 **SQL Editor** 클릭
4. **New Query** 버튼 클릭
5. 아래 SQL 복사 & 붙여넣기:

```sql
-- orders 테이블에 site_photos 컬럼 추가
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS site_photos TEXT[];

-- 기본값: 빈 배열
UPDATE orders
SET site_photos = '{}'
WHERE site_photos IS NULL;

-- 코멘트 추가
COMMENT ON COLUMN orders.site_photos IS '현장사진 URL 배열 (Supabase Storage)';
```

6. **RUN** 버튼 클릭
7. "Success. No rows returned" 메시지 확인

---

## 2️⃣ Storage 버킷 생성

현장사진을 저장할 Storage 버킷을 만듭니다.

### 방법:
1. Supabase 대시보드에서 좌측 메뉴 **Storage** 클릭
2. **New bucket** 버튼 클릭
3. 버킷 정보 입력:
   - **Name**: `site-photos`
   - **Public bucket**: ✅ 체크 (공개 버킷으로 설정)
4. **Create bucket** 버튼 클릭

### 왜 공개 버킷인가요?
- 현장사진은 발주 관계자들이 볼 수 있어야 하므로 공개로 설정합니다
- URL만 알면 누구나 볼 수 있으니, 민감한 정보는 업로드하지 마세요!

---

## 3️⃣ Storage 정책 설정 (권한)

업로드/삭제 권한을 설정합니다.

### 방법:
1. Storage 메뉴에서 방금 만든 **site-photos** 버킷 클릭
2. 우측 상단 **Policies** 탭 클릭
3. **New Policy** 버튼 클릭

### 정책 1: 업로드 허용
- **Policy name**: `Allow authenticated users to upload`
- **Allowed operation**: INSERT
- **Target roles**: `authenticated`
- **USING expression**:
  ```sql
  (bucket_id = 'site-photos')
  ```
- **Save policy** 클릭

### 정책 2: 삭제 허용
- **Policy name**: `Allow authenticated users to delete`
- **Allowed operation**: DELETE
- **Target roles**: `authenticated`
- **USING expression**:
  ```sql
  (bucket_id = 'site-photos')
  ```
- **Save policy** 클릭

### 정책 3: 읽기 허용 (모든 사람)
- **Policy name**: `Allow public to read`
- **Allowed operation**: SELECT
- **Target roles**: `public`
- **USING expression**:
  ```sql
  (bucket_id = 'site-photos')
  ```
- **Save policy** 클릭

---

## 4️⃣ 환경변수 확인

`.env.local` 파일에 Supabase URL과 API Key가 설정되어 있는지 확인합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## 5️⃣ 테스트

1. 개발 서버 실행: `npm run dev`
2. 설치 관리 페이지 접속: http://localhost:3002/mellea/schedule
3. **설치예정** 또는 **설치완료** 탭 선택
4. "사진 업로드" 버튼 클릭
5. 이미지 업로드 테스트
6. Supabase Storage에서 업로드된 파일 확인:
   - Storage > site-photos > [발주ID] 폴더에 파일이 생성되어야 함

---

## 📁 Storage 폴더 구조

```
site-photos/
├── order-123/
│   ├── 1707123456789-photo1.jpg
│   └── 1707123457890-photo2.jpg
├── order-456/
│   └── 1707123458901-photo3.jpg
└── ...
```

- 발주 ID별로 폴더가 생성됩니다
- 파일명은 `타임스탬프-원본파일명` 형식입니다

---

## 🔧 문제 해결

### "Failed to upload: not allowed"
→ Storage 정책(Policies)을 확인하세요. authenticated 사용자에게 INSERT 권한이 있는지 확인

### "버킷을 찾을 수 없습니다"
→ 버킷 이름이 정확히 `site-photos`인지 확인 (대소문자 구분!)

### "이미지가 안 보여요"
→ 버킷이 Public으로 설정되어 있는지 확인
→ Storage 정책에서 public에게 SELECT 권한이 있는지 확인

---

## 📚 관련 파일

- `lib/supabase/storage.ts` — 파일 업로드/삭제 함수
- `components/schedule/site-photo-upload.tsx` — 업로드 UI 컴포넌트
- `supabase/002_add_site_photos.sql` — DB 마이그레이션 파일
