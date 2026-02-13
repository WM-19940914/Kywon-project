/**
 * 로그인/로그아웃 서버 액션
 *
 * Next.js의 Server Action을 사용합니다.
 * 비유: "경비실 뒤편의 출입관리 시스템" — 실제 인증 처리를 담당합니다.
 *
 * 사용자가 입력한 "사용자이름"을 "{username}@mellea.local" 형태로 변환해서
 * Supabase Auth에 로그인 요청을 보냅니다.
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * 로그인 처리
 * @param prevState - 이전 상태 (에러 메시지 등)
 * @param formData - 폼 데이터 (username, password)
 */
export async function login(
  prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const supabase = await createClient()

  // 폼에서 사용자이름과 비밀번호 추출
  const username = formData.get('username') as string
  const password = formData.get('password') as string

  // 빈 값 체크
  if (!username || !password) {
    return { error: '사용자이름과 비밀번호를 입력해주세요.' }
  }

  // 사용자이름 → 이메일 변환 (예: opendnals123 → opendnals123@mellea.local)
  const email = `${username}@mellea.local`

  // Supabase Auth로 로그인 시도
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: '사용자이름 또는 비밀번호가 올바르지 않습니다.' }
  }

  // 로그인 성공 → 대시보드로 이동
  redirect('/')
}

/**
 * 로그아웃 처리
 */
export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
