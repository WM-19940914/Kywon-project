# 🚀 상용화 전 보안 체크리스트

> ⚠️ **중요**: 현재는 테스트용으로 보안이 느슨합니다. 실제 운영 전에 반드시 아래 작업을 완료하세요!

---

## ❌ 현재 문제점 (테스트 환경)

### Storage 보안 문제
- **누구나** 현장사진을 업로드/삭제할 수 있음
- 악의적인 사용자가 파일을 무단 삭제하거나 대용량 파일을 업로드할 수 있음
- URL만 알면 누구나 사진을 볼 수 있음 (현재는 괜찮지만, 민감한 사진이면 문제)

### 현재 Storage 정책
```sql
-- ⚠️ 테스트용: 모든 사람에게 모든 권한 허용
CREATE POLICY "Allow all operations on site-photos"
ON storage.objects
FOR ALL
TO public
USING (bucket_id = 'site-photos')
WITH CHECK (bucket_id = 'site-photos');
```

---

## ✅ 상용화 전 필수 작업

### 1️⃣ 인증 시스템 구축 (Supabase Auth)

#### 왜 필요한가요?
- 로그인한 사용자만 사진을 업로드/삭제할 수 있게 해야 해요
- 현재는 누구나 할 수 있어서 보안에 취약합니다

#### 구현 방법:
1. **Supabase Auth 설정**
   - Supabase 대시보드 > Authentication > Providers
   - Email/Password 또는 OAuth (Google, Kakao 등) 활성화

2. **로그인 페이지 만들기**
   ```typescript
   // app/login/page.tsx
   import { createClient } from '@/lib/supabase/client'

   async function signIn(email: string, password: string) {
     const supabase = createClient()
     const { data, error } = await supabase.auth.signInWithPassword({
       email,
       password,
     })
   }
   ```

3. **로그아웃 기능**
   ```typescript
   async function signOut() {
     const supabase = createClient()
     await supabase.auth.signOut()
   }
   ```

4. **인증 상태 확인**
   ```typescript
   const supabase = createClient()
   const { data: { session } } = await supabase.auth.getSession()
   ```

---

### 2️⃣ Storage 정책 변경 (authenticated로)

#### Supabase SQL Editor에서 실행:

```sql
-- ============================================================
-- 상용화용 Storage 정책 (로그인한 사용자만)
-- ============================================================

-- 기존 테스트용 정책 삭제
DROP POLICY IF EXISTS "Allow all operations on site-photos" ON storage.objects;

-- 1. 로그인한 사용자만 업로드 가능
CREATE POLICY "Authenticated users can upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'site-photos' AND
  auth.role() = 'authenticated'
);

-- 2. 로그인한 사용자만 자신의 파일 삭제 가능
CREATE POLICY "Authenticated users can delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'site-photos' AND
  auth.role() = 'authenticated'
);

-- 3. 로그인한 사용자만 읽기 가능 (옵션)
-- 민감한 사진이면 이 정책 사용, 아니면 public 유지
CREATE POLICY "Authenticated users can read"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'site-photos');

-- 또는 모든 사람 읽기 가능 (현재처럼)
-- CREATE POLICY "Public can read"
-- ON storage.objects
-- FOR SELECT
-- TO public
-- USING (bucket_id = 'site-photos');
```

---

### 3️⃣ 파일 크기 제한 추가

#### lib/supabase/storage.ts 수정:

```typescript
// 파일 크기 제한 (예: 10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function uploadSitePhoto(file: File, orderId: string): Promise<string | null> {
  // 파일 크기 확인
  if (file.size > MAX_FILE_SIZE) {
    console.error('파일 크기 초과:', `${(file.size / 1024 / 1024).toFixed(2)}MB`)
    alert('파일 크기는 10MB 이하여야 합니다.')
    return null
  }

  // 파일 타입 확인
  if (!file.type.startsWith('image/')) {
    alert('이미지 파일만 업로드 가능합니다.')
    return null
  }

  // ... 기존 업로드 로직
}
```

---

### 4️⃣ 역할별 권한 분리 (옵션)

#### 더 세밀한 권한 관리가 필요하면:

```sql
-- 예: 멜레아와 에스원만 업로드 가능
CREATE POLICY "Only mellea and s1 can upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'site-photos' AND
  auth.jwt() ->> 'role' IN ('mellea', 's1_engineer')
);
```

---

### 5️⃣ 환경변수 보안 강화

#### .env.local (개발용)
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx... (anon key)
```

#### .env.production (운영용 — Vercel에 등록)
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx... (anon key)
SUPABASE_SERVICE_ROLE_KEY=eyJxxx... (절대 클라이언트에 노출 금지!)
```

---

## 📋 상용화 체크리스트

실제 운영 전에 아래 항목을 모두 확인하세요:

### 보안
- [ ] Supabase Auth 설정 완료 (로그인 기능)
- [ ] Storage 정책을 authenticated로 변경
- [ ] 파일 크기 제한 추가 (10MB)
- [ ] 파일 타입 검증 (이미지만)
- [ ] 환경변수 분리 (개발/운영)

### 기능
- [ ] 로그인/로그아웃 UI 구현
- [ ] 인증되지 않은 사용자 접근 차단
- [ ] 에러 처리 개선 (사용자 친화적 메시지)
- [ ] 로딩 상태 표시

### 성능
- [ ] 이미지 압축 (업로드 전)
- [ ] 썸네일 생성 (옵션)
- [ ] CDN 설정 (Supabase는 기본 제공)

### 모니터링
- [ ] 업로드 실패 로그 수집
- [ ] Storage 용량 모니터링
- [ ] 비정상 업로드 감지

---

## 🆘 도움이 필요하면?

상용화 작업할 때 이 문서를 다시 열어서 단계별로 진행하세요!
각 단계별로 도움이 필요하면 언제든지 물어보세요.

---

## 📚 참고 문서

- [Supabase Auth 공식 문서](https://supabase.com/docs/guides/auth)
- [Storage 보안 정책](https://supabase.com/docs/guides/storage/security/access-control)
- [Next.js + Supabase 인증](https://supabase.com/docs/guides/auth/server-side/nextjs)
