/**
 * 대시보드 레이아웃 — 서버 컴포넌트
 *
 * 이 파일은 서버에서 실행됩니다. (비유: "건물 입구 보안게이트")
 * 1. 현재 로그인한 사용자 확인
 * 2. user_profiles 테이블에서 역할(role) 정보 조회
 * 3. DashboardShell(클라이언트 컴포넌트)에 사용자 정보 전달
 */

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardShell from './dashboard-shell'
import type { UserProfile } from '@/lib/auth/roles'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  // 현재 로그인한 사용자 확인
  const { data: { user } } = await supabase.auth.getUser()

  // 로그인 안 되어 있으면 로그인 페이지로 (미들웨어에서도 처리하지만 이중 안전)
  if (!user) {
    redirect('/login')
  }

  // user_profiles 테이블에서 역할 정보 가져오기
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()


  // 프로필이 없는 경우 기본값 (혹시 모를 예외 상황 대비)
  const userProfile: UserProfile = profile
    ? {
        id: profile.id,
        username: profile.username,
        displayName: profile.display_name,
        role: profile.role,
        affiliateName: profile.affiliate_name,
      }
    : {
        id: user.id,
        username: user.email?.split('@')[0] || 'unknown',
        displayName: '사용자',
        role: 'affiliate',   // 프로필 없으면 가장 제한적인 역할
      }

  return <DashboardShell user={userProfile}>{children}</DashboardShell>
}
