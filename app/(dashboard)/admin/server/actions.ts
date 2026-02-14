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

// ============================================================
// 서버관리 탭 — 모니터링 액션
// ============================================================

/** 서비스별 연결 상태 결과 */
export interface HealthCheckResult {
  db: { ok: boolean; message: string; latencyMs: number }
  auth: { ok: boolean; message: string }
  storage: { ok: boolean; message: string }
}

/** 시스템 상태 체크 — DB/Auth/Storage 연결 확인 */
export async function fetchServerHealth(): Promise<{ error: string | null; health: HealthCheckResult | null }> {
  try {
    const supabase = await requireAdmin()

    // DB 연결 체크 — 간단한 SELECT 쿼리 + 응답시간 측정
    const dbStart = Date.now()
    const { error: dbError } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1)
    const dbLatency = Date.now() - dbStart

    // Auth 연결 체크 — 현재 세션 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    // Storage 연결 체크 — 버킷 목록 조회
    const { error: storageError } = await supabase.storage.listBuckets()

    const health: HealthCheckResult = {
      db: {
        ok: !dbError,
        message: dbError ? dbError.message : '정상 연결',
        latencyMs: dbLatency,
      },
      auth: {
        ok: !authError && !!user,
        message: authError ? authError.message : '정상 연결',
      },
      storage: {
        ok: !storageError,
        message: storageError ? storageError.message : '정상 연결',
      },
    }

    return { error: null, health }
  } catch (err) {
    return { error: (err as Error).message, health: null }
  }
}

/** 최근 접속 기록 조회용 타입 */
export interface RecentLogin {
  id: string
  displayName: string
  username: string
  role: string
  affiliateName: string | null
  lastSignInAt: string | null
}

/** 최근 접속 기록 조회 — user_profiles의 last_sign_in_at 활용 */
export async function fetchRecentLogins(): Promise<{ error: string | null; logins: RecentLogin[] }> {
  try {
    const supabase = await requireAdmin()

    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, display_name, username, role, affiliate_name, last_sign_in_at')
      .order('last_sign_in_at', { ascending: false, nullsFirst: false })

    if (error) return { error: error.message, logins: [] }

    const logins: RecentLogin[] = (data || []).map((row) => ({
      id: row.id,
      displayName: row.display_name,
      username: row.username,
      role: row.role,
      affiliateName: row.affiliate_name,
      lastSignInAt: row.last_sign_in_at,
    }))

    return { error: null, logins }
  } catch (err) {
    return { error: (err as Error).message, logins: [] }
  }
}

/** Supabase 실시간 사용량 타입 */
export interface SupabaseUsage {
  db: { usedBytes: number; usedLabel: string; limitBytes: number; limitLabel: string }
  storage: { usedBytes: number; usedLabel: string; fileCount: number; limitBytes: number; limitLabel: string }
  auth: { userCount: number; limitCount: number }
}

/** Supabase 실시간 사용량 조회 — DB 용량, Storage 사용량, Auth 사용자 수 */
export async function fetchSupabaseUsage(): Promise<{ error: string | null; usage: SupabaseUsage | null }> {
  try {
    const supabase = await requireAdmin()

    // DB 용량 + Auth 사용자 수 동시 조회
    const [dbResult, authResult] = await Promise.all([
      supabase.rpc('admin_db_stats'),
      supabase
        .from('user_profiles')
        .select('id', { count: 'exact', head: true }),
    ])

    // DB 용량 파싱 (admin_db_stats에서 db_size 가져옴)
    const dbSizeStr = dbResult.data?.db_size || '0 bytes'
    const dbSizeBytes = parseDbSize(dbSizeStr)

    // Storage — 버킷별 파일 목록으로 크기 합산
    let storageTotalBytes = 0
    let storageFileCount = 0
    const { data: buckets } = await supabase.storage.listBuckets()
    if (buckets) {
      for (const bucket of buckets) {
        const { data: files } = await supabase.storage.from(bucket.name).list('', { limit: 1000 })
        if (files) {
          storageFileCount += files.filter(f => f.metadata).length
          storageTotalBytes += files.reduce((sum, f) => sum + (f.metadata?.size || 0), 0)
        }
      }
    }

    const usage: SupabaseUsage = {
      db: {
        usedBytes: dbSizeBytes,
        usedLabel: dbSizeStr,
        limitBytes: 500 * 1024 * 1024, // 500 MB
        limitLabel: '500 MB',
      },
      storage: {
        usedBytes: storageTotalBytes,
        usedLabel: formatBytes(storageTotalBytes),
        fileCount: storageFileCount,
        limitBytes: 1 * 1024 * 1024 * 1024, // 1 GB
        limitLabel: '1 GB',
      },
      auth: {
        userCount: authResult.count || 0,
        limitCount: 50000,
      },
    }

    return { error: null, usage }
  } catch (err) {
    return { error: (err as Error).message, usage: null }
  }
}

/** DB 크기 문자열 → 바이트 변환 (예: "13 MB" → 13631488) */
function parseDbSize(sizeStr: string): number {
  const match = sizeStr.match(/([\d.]+)\s*(bytes|kB|MB|GB)/i)
  if (!match) return 0
  const value = parseFloat(match[1])
  const unit = match[2].toLowerCase()
  const multipliers: Record<string, number> = {
    bytes: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024,
  }
  return Math.round(value * (multipliers[unit] || 1))
}

/** 바이트 → 사람이 읽기 좋은 형태 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 bytes'
  if (bytes < 1024) return `${bytes} bytes`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
