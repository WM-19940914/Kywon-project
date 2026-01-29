/**
 * 브라우저에서 사용하는 Supabase 클라이언트
 *
 * 이 파일은 웹페이지(클라이언트)에서 Supabase와 통신할 때 사용합니다.
 * 예: 버튼 클릭, 폼 제출 등 사용자 액션에서 데이터 저장/조회
 */

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // .env.local 파일에서 환경 변수를 가져옵니다
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
