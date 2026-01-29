/**
 * 서버에서 사용하는 Supabase 클라이언트
 *
 * 이 파일은 Next.js 서버(백엔드)에서 Supabase와 통신할 때 사용합니다.
 * 예: 페이지 로드 시 데이터 미리 가져오기, API 라우트에서 데이터 처리
 *
 * 왜 브라우저용과 따로 만들까요?
 * - 서버는 쿠키를 사용해서 사용자 로그인 정보를 안전하게 보관합니다
 * - 브라우저는 쿠키 접근 방식이 다르기 때문에 별도 클라이언트가 필요합니다
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  // Next.js의 쿠키 저장소를 가져옵니다
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // 모든 쿠키 읽어오기
        getAll() {
          return cookieStore.getAll()
        },
        // 쿠키 저장하기 (로그인 정보 등)
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // 서버 컴포넌트에서는 쿠키 설정이 안 될 수 있어서 에러 무시
          }
        },
      },
    }
  )
}
