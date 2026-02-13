/**
 * Next.js 미들웨어 — 모든 페이지 요청 전에 실행됩니다
 *
 * 비유: "건물 정문의 경비실"
 * - 출입증(로그인) 없으면 → 로그인 페이지로 안내
 * - 이미 로그인했는데 로그인 페이지 가면 → 대시보드로 안내
 * - 정적 파일(이미지, CSS 등)은 검사 안 함
 */

import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

/**
 * 미들웨어가 실행될 경로 설정
 * - 정적 파일(_next/static, 이미지 등)은 제외
 * - favicon.ico도 제외
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
