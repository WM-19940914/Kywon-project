/**
 * 관리자 페이지 Server Actions — 계정 관리
 *
 * Supabase DB 함수(SECURITY DEFINER)를 호출하여
 * 계정 생성/수정/삭제/비밀번호 초기화를 처리합니다.
 *
 * 모든 액션은 admin 역할 체크 후 실행됩니다.
 */

'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/** 관리자 권한 체크 — admin이 아니면 에러 */
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('로그인이 필요합니다.')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') throw new Error('관리자 권한이 필요합니다.')
  return supabase
}

/** 사용자 목록 조회 */
export async function fetchUsers() {
  const supabase = await requireAdmin()
  const { data, error } = await supabase.rpc('admin_list_users')
  if (error) return { error: error.message, users: [] }
  return { error: null, users: data || [] }
}

/** 신규 계정 생성 */
export async function createUser(formData: FormData) {
  const supabase = await requireAdmin()

  const username = (formData.get('username') as string)?.trim()
  const password = (formData.get('password') as string)?.trim()
  const displayName = (formData.get('displayName') as string)?.trim()
  const role = (formData.get('role') as string)?.trim()
  const affiliateName = (formData.get('affiliateName') as string)?.trim() || null

  if (!username || !password || !displayName || !role) {
    return { error: '모든 필수 항목을 입력해주세요.' }
  }

  if (password.length < 6) {
    return { error: '비밀번호는 6자 이상이어야 합니다.' }
  }

  const { error } = await supabase.rpc('admin_create_user', {
    p_username: username,
    p_password: password,
    p_display_name: displayName,
    p_role: role,
    p_affiliate_name: affiliateName,
  })

  if (error) {
    if (error.message.includes('duplicate') || error.message.includes('unique')) {
      return { error: '이미 존재하는 사용자이름입니다.' }
    }
    return { error: `계정 생성 실패: ${error.message}` }
  }

  revalidatePath('/admin/server')
  return { error: null }
}

/** 역할 변경 */
export async function updateUserRole(userId: string, role: string, displayName?: string, affiliateName?: string) {
  const supabase = await requireAdmin()

  const { error } = await supabase.rpc('admin_update_user_role', {
    p_user_id: userId,
    p_role: role,
    p_display_name: displayName || null,
    p_affiliate_name: affiliateName || null,
  })

  if (error) return { error: `역할 변경 실패: ${error.message}` }

  revalidatePath('/admin/server')
  return { error: null }
}

/** 비밀번호 초기화 */
export async function resetPassword(userId: string, newPassword: string) {
  const supabase = await requireAdmin()

  if (newPassword.length < 6) {
    return { error: '비밀번호는 6자 이상이어야 합니다.' }
  }

  const { error } = await supabase.rpc('admin_reset_password', {
    p_user_id: userId,
    p_new_password: newPassword,
  })

  if (error) return { error: `비밀번호 초기화 실패: ${error.message}` }
  return { error: null }
}

/** DB 통계 조회 */
export async function fetchDbStats() {
  const supabase = await requireAdmin()
  const { data, error } = await supabase.rpc('admin_db_stats')
  if (error) return { error: error.message, stats: null }
  return { error: null, stats: data }
}

/** 계정 삭제 */
export async function deleteUser(userId: string) {
  const supabase = await requireAdmin()

  const { error } = await supabase.rpc('admin_delete_user', {
    p_user_id: userId,
  })

  if (error) return { error: `계정 삭제 실패: ${error.message}` }

  revalidatePath('/admin/server')
  return { error: null }
}
