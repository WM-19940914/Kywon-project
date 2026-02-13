/**
 * Supabase 미들웨어 헬퍼 — 쿠키 기반 세션 갱신
 *
 * Next.js 미들웨어에서 Supabase 세션(로그인 상태)을 확인하고 갱신합니다.
 * 비유: "건물 입구의 보안 게이트" — 들어올 때마다 출입증(세션)을 확인하고 갱신해줍니다.
 *
 * @supabase/ssr 패키지의 createServerClient를 사용합니다.
 */

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // 응답 객체 생성 (쿠키를 수정할 수 있도록)
  let supabaseResponse = NextResponse.next({ request })

  // 미들웨어용 Supabase 클라이언트 생성
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // 요청에서 쿠키 읽기
        getAll() {
          return request.cookies.getAll()
        },
        // 응답에 쿠키 설정 (세션 갱신 시)
        setAll(cookiesToSet) {
          // 요청 쿠키에도 설정 (서버 컴포넌트에서 읽을 수 있도록)
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // 응답 객체 재생성
          supabaseResponse = NextResponse.next({ request })
          // 응답 쿠키에도 설정 (브라우저에 전달)
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 현재 로그인한 사용자 정보 확인
  // ⚠️ getUser()는 매 요청마다 Supabase Auth 서버에 확인합니다 (보안 강화)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── 라우트 보호 로직 ──

  const pathname = request.nextUrl.pathname

  // 로그인 안 한 상태 + /login이 아닌 페이지 → /login으로 보내기
  if (!user && pathname !== '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 로그인한 상태 + /login 페이지 → 대시보드(/)로 보내기
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
