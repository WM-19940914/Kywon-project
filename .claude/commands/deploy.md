# /deploy — 배포 전 점검

Vercel 배포 전 빌드 에러와 주요 문제를 사전 점검한다.

## 절차

1. **빌드 테스트**: `npm run build` 실행
2. **에러 분석**: 빌드 에러가 있으면 원인 분석 및 수정 제안
3. **린트 검사**: `npm run lint` 실행
4. **환경변수 확인**: `.env.local`에 필수 변수 존재 여부
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. **결과 요약**: 통과/실패 항목 리스트 출력

## 빌드 에러 자주 나는 패턴

- TypeScript 타입 에러 (특히 `types/order.ts` 변경 후)
- 미사용 import 경고
- `'use client'` 누락으로 서버 컴포넌트에서 hook 사용
- `next/image` 대신 `<img>` 태그 사용 경고

## 출력 형식

```
=== 배포 전 점검 결과 ===
✅ 빌드 테스트: 통과
✅ 린트 검사: 통과
✅ 환경변수: 정상
→ 배포 가능합니다!
```

또는

```
=== 배포 전 점검 결과 ===
❌ 빌드 테스트: 실패 (에러 2건)
  1. components/orders/order-form.tsx:45 — 타입 에러
  2. app/(dashboard)/mellea/delivery/page.tsx:12 — 미사용 import
→ 위 에러를 수정한 후 다시 점검하세요.
```
