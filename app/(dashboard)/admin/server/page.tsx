/**
 * 관리자 페이지 — opendnals123(김우민) 전용
 *
 * 탭 구조: 계정관리 / DB관리
 * Supabase DB 함수를 통해 auth.users + user_profiles를 관리합니다.
 */

'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { Shield, UserPlus, Key, Trash2, Edit2, X, Check, RefreshCw, Users, Database, Table2, BarChart3, Globe, ExternalLink, Server, MapPin, Zap, Activity, Clock, HardDrive, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { fetchUsers, createUser, updateUserRole, resetPassword, deleteUser, fetchDbStats, fetchServerHealth, fetchRecentLogins, fetchSupabaseUsage } from './actions'
import type { HealthCheckResult, RecentLogin, SupabaseUsage } from './actions'
import { ROLE_MENU_ACCESS, type UserRole } from '@/lib/auth/roles'
import { menuItems, archiveMenuItem, serverAdminMenuItem } from '@/lib/menu-items'

/** 역할별 메뉴 권한 매트릭스에서 사용할 역할 순서 */
const ROLE_ORDER: UserRole[] = ['admin', 'melea', 's1eng', 'kyowon', 'affiliate']

/** 메뉴 그룹별 색상 도트 */
const GROUP_DOT_COLORS: Record<string, string> = {
  '': 'bg-gray-400',
  '교원그룹': 'bg-blue-400',
  '교원 · 멜레아': 'bg-violet-400',
  '멜레아 · 에스원': 'bg-emerald-400',
  '멜레아 전용': 'bg-orange-400',
}

/** 역할 옵션 */
const ROLE_OPTIONS = [
  { value: 'admin', label: '관리자' },
  { value: 'melea', label: '멜레아' },
  { value: 's1eng', label: '에스원이엔지' },
  { value: 'kyowon', label: '교원그룹' },
  { value: 'affiliate', label: '계열사' },
]

/** 역할 뱃지 색상 */
const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-500/15 text-red-400 border-red-500/20',
  melea: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  s1eng: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  kyowon: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  affiliate: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
}

/** 역할 한글 라벨 */
const ROLE_LABELS: Record<string, string> = {
  admin: '관리자', melea: '멜레아', s1eng: '에스원이엔지', kyowon: '교원그룹', affiliate: '계열사',
}

/** 테이블 한글명 */
const TABLE_LABELS: Record<string, string> = {
  orders: '발주', order_items: '발주 내역', equipment_items: '구성품/배송',
  customer_quotes: '견적서', quote_items: '견적 항목', installation_cost_items: '설치비',
  stored_equipment: '보관장비', inventory_events: '재고이벤트', warehouses: '창고',
  as_requests: 'AS 요청', price_table_sets: '단가표 SET', price_table_components: '단가표 구성품',
  user_profiles: '사용자', expense_reports: '지출결의서', expense_report_items: '지출결의 항목',
  purchase_reports: '매입내역', purchase_report_items: '매입 항목',
  prepurchase_equipment: '선구매 장비', prepurchase_usage: '선구매 사용',
  installation_price_items: '설치비 단가', settlement_confirmations: '정산 확인',
}

/** 발주 상태 한글명 */
const ORDER_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  received: { label: '접수중', color: 'bg-amber-500/15 text-amber-400' },
  in_progress: { label: '진행중', color: 'bg-blue-500/15 text-blue-400' },
  completed: { label: '완료', color: 'bg-violet-500/15 text-violet-400' },
  settled: { label: '정산완료', color: 'bg-emerald-500/15 text-emerald-400' },
  cancelled: { label: '발주취소', color: 'bg-red-500/15 text-red-400' },
}

/** 사용자 타입 */
interface UserRow {
  id: string
  username: string
  display_name: string
  role: string
  affiliate_name: string | null
  email: string
  last_sign_in_at: string | null
  created_at: string
  plain_password: string | null
}

type TabType = 'accounts' | 'database' | 'server'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>('accounts')

  return (
    <div className="p-4 sm:p-6 max-w-[1200px] mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold">관리자 페이지</h1>
          <p className="text-sm text-muted-foreground">시스템 관리 · opendnals123 전용</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-5 border-b">
        <button
          onClick={() => setActiveTab('accounts')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'accounts'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="h-4 w-4" />
          계정관리
        </button>
        <button
          onClick={() => setActiveTab('database')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'database'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Database className="h-4 w-4" />
          DB관리
        </button>
        <button
          onClick={() => setActiveTab('server')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'server'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Globe className="h-4 w-4" />
          서버관리
        </button>
      </div>

      {/* 탭 내용 */}
      {activeTab === 'accounts' && <AccountsTab />}
      {activeTab === 'database' && <DatabaseTab />}
      {activeTab === 'server' && <ServerTab />}
    </div>
  )
}

// ============================================================
// 계정관리 탭
// ============================================================

function AccountsTab() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const result = await fetchUsers()
    if (result.error) setMessage({ type: 'error', text: result.error })
    else setUsers(result.users)
    setLoading(false)
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])
  useEffect(() => {
    if (message) { const t = setTimeout(() => setMessage(null), 3000); return () => clearTimeout(t) }
  }, [message])

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <>
      {/* 상단 액션 */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">총 {users.length}개 계정</p>
        <div className="flex gap-2">
          <button onClick={loadUsers} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm hover:bg-accent transition-colors">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">새로고침</span>
          </button>
          <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
            <UserPlus className="h-3.5 w-3.5" /> 계정 추가
          </button>
        </div>
      </div>

      {/* 알림 */}
      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
          {message.text}
        </div>
      )}

      {/* 테이블 */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">이름</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">아이디</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">비밀번호</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">역할</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">계열사</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">마지막 로그인</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">생성일</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground w-[140px]">관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">불러오는 중...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">등록된 계정이 없습니다.</td></tr>
              ) : users.map((user) => (
                <tr key={user.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium">{user.display_name}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{user.username}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{user.plain_password || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium border ${ROLE_COLORS[user.role] || 'bg-gray-500/15 text-gray-400'}`}>
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{user.affiliate_name || '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">{formatDate(user.last_sign_in_at)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">{formatDate(user.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setEditingUser(user)} className="p-1.5 rounded-md hover:bg-blue-500/10 text-muted-foreground hover:text-blue-400 transition-colors" title="수정">
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setResetTarget(user)} className="p-1.5 rounded-md hover:bg-orange-500/10 text-muted-foreground hover:text-orange-400 transition-colors" title="비밀번호 초기화">
                        <Key className="h-3.5 w-3.5" />
                      </button>
                      {user.username !== 'opendnals123' && (
                        <button onClick={() => setDeleteTarget(user)} className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors" title="삭제">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 역할별 메뉴 권한 매트릭스 */}
      <RoleMenuMatrix />

      {/* 모달들 */}
      {showCreateModal && <CreateUserModal onClose={() => setShowCreateModal(false)} onSuccess={(msg) => { setMessage({ type: 'success', text: msg }); setShowCreateModal(false); loadUsers() }} onError={(msg) => setMessage({ type: 'error', text: msg })} />}
      {editingUser && <EditRoleModal user={editingUser} onClose={() => setEditingUser(null)} onSuccess={(msg) => { setMessage({ type: 'success', text: msg }); setEditingUser(null); loadUsers() }} onError={(msg) => setMessage({ type: 'error', text: msg })} />}
      {resetTarget && <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} onSuccess={(msg) => { setMessage({ type: 'success', text: msg }); setResetTarget(null) }} onError={(msg) => setMessage({ type: 'error', text: msg })} />}
      {deleteTarget && <DeleteUserModal user={deleteTarget} onClose={() => setDeleteTarget(null)} onSuccess={(msg) => { setMessage({ type: 'success', text: msg }); setDeleteTarget(null); loadUsers() }} onError={(msg) => setMessage({ type: 'error', text: msg })} />}
    </>
  )
}

// ============================================================
// 역할별 메뉴 권한 매트릭스 — 어떤 역할이 어떤 메뉴를 볼 수 있는지 시각화
// ============================================================

function RoleMenuMatrix() {
  /** 역할이 특정 메뉴 그룹에 접근 가능한지 확인 */
  const hasAccess = (role: UserRole, groupTitle: string) => {
    return ROLE_MENU_ACCESS[role]?.[groupTitle] ?? false
  }

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Shield className="h-4 w-4 text-violet-400" />
        역할별 메뉴 권한
      </h3>

      {/* ── 데스크톱: 매트릭스 테이블 (md 이상) ── */}
      <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[200px]">메뉴</th>
                {ROLE_ORDER.map(role => (
                  <th key={role} className="text-center px-3 py-3 min-w-[90px]">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium border ${ROLE_COLORS[role]}`}>
                      {ROLE_LABELS[role]}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* 메뉴 그룹별 행 */}
              {menuItems.map((group) => (
                <Fragment key={`group-${group.title || 'dashboard'}`}>
                  {/* 그룹 헤더 행 */}
                  <tr className="bg-muted/15">
                    <td className="px-4 py-2" colSpan={1 + ROLE_ORDER.length}>
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${GROUP_DOT_COLORS[group.title] || 'bg-gray-400'}`} />
                        <span className="text-xs font-semibold text-muted-foreground">
                          {group.title || '대시보드'}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {/* 개별 메뉴 아이템 행 */}
                  {group.items.map((item) => {
                    const Icon = item.icon
                    return (
                      <tr key={item.url} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5 pl-4">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs">{item.title}</span>
                            {item.disabled && (
                              <span className="text-[10px] text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded">준비중</span>
                            )}
                          </div>
                        </td>
                        {ROLE_ORDER.map(role => (
                          <td key={role} className="text-center px-3 py-2.5">
                            {hasAccess(role, group.title) ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" />
                            ) : (
                              <XCircle className="h-4 w-4 text-muted-foreground/25 mx-auto" />
                            )}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </Fragment>
              ))}

              {/* 구분선 */}
              <tr className="bg-muted/15">
                <td className="px-4 py-2" colSpan={1 + ROLE_ORDER.length}>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-gray-500" />
                    <span className="text-xs font-semibold text-muted-foreground">기타</span>
                  </div>
                </td>
              </tr>

              {/* 과거자료 — 모든 역할 접근 가능 */}
              <tr className="border-b hover:bg-muted/10 transition-colors">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5 pl-4">
                    <archiveMenuItem.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs">{archiveMenuItem.title}</span>
                  </div>
                </td>
                {ROLE_ORDER.map(role => (
                  <td key={role} className="text-center px-3 py-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" />
                  </td>
                ))}
              </tr>

              {/* 관리자페이지 — admin만 접근 */}
              <tr className="hover:bg-muted/10 transition-colors">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5 pl-4">
                    <serverAdminMenuItem.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs">{serverAdminMenuItem.title}</span>
                    <span className="text-[10px] text-red-400/70 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/15">
                      opendnals123 전용
                    </span>
                  </div>
                </td>
                {ROLE_ORDER.map(role => (
                  <td key={role} className="text-center px-3 py-2.5">
                    {role === 'admin' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 mx-auto" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground/25 mx-auto" />
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 모바일: 역할별 카드 (md 미만) ── */}
      <div className="md:hidden space-y-3">
        {ROLE_ORDER.map(role => (
          <div key={role} className="rounded-xl border bg-card overflow-hidden">
            {/* 카드 헤더: 역할 뱃지 */}
            <div className="px-4 py-3 border-b bg-muted/30 flex items-center gap-2">
              <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium border ${ROLE_COLORS[role]}`}>
                {ROLE_LABELS[role]}
              </span>
            </div>
            <div className="p-3 space-y-3">
              {menuItems.map(group => {
                const accessible = hasAccess(role, group.title)
                return (
                  <div key={group.title || 'dashboard'}>
                    {/* 그룹명 */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`h-2 w-2 rounded-full ${GROUP_DOT_COLORS[group.title] || 'bg-gray-400'}`} />
                      <span className={`text-[11px] font-semibold ${accessible ? 'text-muted-foreground' : 'text-muted-foreground/40'}`}>
                        {group.title || '대시보드'}
                      </span>
                      {!accessible && (
                        <XCircle className="h-3 w-3 text-muted-foreground/30" />
                      )}
                    </div>
                    {/* 메뉴 아이템 목록 */}
                    <div className="pl-4 space-y-1">
                      {group.items.map(item => {
                        const Icon = item.icon
                        return (
                          <div key={item.url} className={`flex items-center gap-2 py-0.5 ${!accessible ? 'opacity-30 line-through' : ''}`}>
                            <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="text-xs">{item.title}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              {/* 기타: 과거자료 + 관리자페이지 */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="h-2 w-2 rounded-full bg-gray-500" />
                  <span className="text-[11px] font-semibold text-muted-foreground">기타</span>
                </div>
                <div className="pl-4 space-y-1">
                  <div className="flex items-center gap-2 py-0.5">
                    <archiveMenuItem.icon className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs">{archiveMenuItem.title}</span>
                  </div>
                  <div className={`flex items-center gap-2 py-0.5 ${role !== 'admin' ? 'opacity-30 line-through' : ''}`}>
                    <serverAdminMenuItem.icon className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs">{serverAdminMenuItem.title}</span>
                    {role === 'admin' && (
                      <span className="text-[9px] text-red-400/70 bg-red-500/10 px-1 py-0.5 rounded">전용</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// DB관리 탭
// ============================================================

/* eslint-disable @typescript-eslint/no-explicit-any */
function DatabaseTab() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    setLoading(true)
    const result = await fetchDbStats()
    if (result.error) setError(result.error)
    else setStats(result.stats)
    setLoading(false)
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  if (loading) return <div className="text-center py-12 text-muted-foreground">불러오는 중...</div>
  if (error) return <div className="text-center py-12 text-red-400">{error}</div>
  if (!stats) return null

  const tables = stats.tables || []
  const orderStats = stats.order_stats || {}
  const dbSize = stats.db_size || '-'
  const totalRows = tables.reduce((sum: number, t: any) => sum + (t.count || 0), 0)

  return (
    <div className="space-y-5">
      {/* 상단 Supabase 로고 + 새로고침 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Supabase 번개 로고 */}
          <svg width="20" height="20" viewBox="0 0 109 113" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M63.708 110.284C60.727 114.083 54.426 112.046 54.362 107.261L53.508 44.181H100.944C109.494 44.181 114.23 54.14 108.86 60.782L63.708 110.284Z" fill="url(#paint0_linear)" />
            <path d="M63.708 110.284C60.727 114.083 54.426 112.046 54.362 107.261L53.508 44.181H100.944C109.494 44.181 114.23 54.14 108.86 60.782L63.708 110.284Z" fill="url(#paint1_linear)" fillOpacity="0.2" />
            <path d="M45.317 2.071C48.298 -1.728 54.599 0.309 54.663 5.094L55.056 68.174H8.082C-0.468 68.174 -5.204 58.215 0.166 51.573L45.317 2.071Z" fill="#3ECF8E" />
            <defs>
              <linearGradient id="paint0_linear" x1="53.508" y1="54.181" x2="94.363" y2="71.746" gradientUnits="userSpaceOnUse">
                <stop stopColor="#249361" />
                <stop offset="1" stopColor="#3ECF8E" />
              </linearGradient>
              <linearGradient id="paint1_linear" x1="36.156" y1="30.578" x2="54.484" y2="65.081" gradientUnits="userSpaceOnUse">
                <stop />
                <stop offset="1" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
          <span className="text-lg font-semibold" style={{ color: '#3ECF8E' }}>Supabase</span>
        </div>
        <button onClick={loadStats} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm hover:bg-accent transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> 새로고침
        </button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Database className="h-4 w-4" />
            <span className="text-xs font-medium">DB 용량</span>
          </div>
          <p className="text-lg font-bold">{dbSize}</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Table2 className="h-4 w-4" />
            <span className="text-xs font-medium">테이블 수</span>
          </div>
          <p className="text-lg font-bold">{tables.length}개</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <BarChart3 className="h-4 w-4" />
            <span className="text-xs font-medium">총 레코드</span>
          </div>
          <p className="text-lg font-bold">{totalRows.toLocaleString()}건</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Users className="h-4 w-4" />
            <span className="text-xs font-medium">등록 계정</span>
          </div>
          <p className="text-lg font-bold">{tables.find((t: any) => t.name === 'user_profiles')?.count || 0}명</p>
        </div>
      </div>

      {/* 발주 상태별 통계 */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-400" />
            발주 상태별 현황
          </h3>
        </div>
        <div className="p-4">
          <div className="flex flex-wrap gap-3">
            {Object.entries(ORDER_STATUS_LABELS).map(([key, { label, color }]) => (
              <div key={key} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${color}`}>
                <span className="text-xs font-medium">{label}</span>
                <span className="text-lg font-bold">{orderStats[key] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 테이블별 데이터 건수 */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Table2 className="h-4 w-4 text-emerald-400" />
            테이블별 데이터 건수
          </h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {tables
              .sort((a: any, b: any) => b.count - a.count)
              .map((t: any) => (
                <div key={t.name} className="flex items-center justify-between px-3 py-2 rounded-lg border bg-muted/10">
                  <span className="text-xs text-muted-foreground truncate mr-2">{TABLE_LABELS[t.name] || t.name}</span>
                  <span className={`text-sm font-bold tabular-nums ${t.count > 0 ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                    {t.count}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

    </div>
  )
}

// ============================================================
// 서버관리 탭
// ============================================================

/** 관리 사이트 바로가기 목록 */
const ADMIN_LINKS = [
  {
    name: 'Vercel 대시보드',
    description: '배포 상태, 빌드 로그, 도메인 설정',
    url: 'https://vercel.com/dashboard',
    icon: '▲',
    color: 'bg-black text-white',
  },
  {
    name: 'Supabase 대시보드',
    description: 'DB 관리, 인증, 스토리지, API',
    url: 'https://app.supabase.com/project/amllpfihdjohjuypcawv',
    icon: '⚡',
    color: 'bg-emerald-500/15 text-emerald-400',
  },
  {
    name: '카카오 디벨로퍼',
    description: '카카오맵 API 키, 도메인 설정',
    url: 'https://developers.kakao.com/console/app',
    icon: '🗺️',
    color: 'bg-yellow-500/15 text-yellow-600',
  },
  {
    name: 'GitHub 저장소',
    description: '소스 코드, 커밋 내역, 이슈 관리',
    url: 'https://github.com/WM-19940914/Kywon-project',
    icon: '🐙',
    color: 'bg-violet-500/15 text-violet-400',
  },
]

function ServerTab() {
  const [health, setHealth] = useState<HealthCheckResult | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const [logins, setLogins] = useState<RecentLogin[]>([])
  const [loginsLoading, setLoginsLoading] = useState(true)
  const [sbUsage, setSbUsage] = useState<SupabaseUsage | null>(null)
  const [sbUsageLoading, setSbUsageLoading] = useState(true)

  /** 시스템 상태 + 접속기록 + Supabase 사용량 동시 로드 */
  const loadMonitoring = useCallback(async () => {
    setHealthLoading(true)
    setLoginsLoading(true)
    setSbUsageLoading(true)

    const [healthResult, loginsResult, usageResult] = await Promise.all([
      fetchServerHealth(),
      fetchRecentLogins(),
      fetchSupabaseUsage(),
    ])

    if (!healthResult.error) setHealth(healthResult.health)
    setHealthLoading(false)

    if (!loginsResult.error) setLogins(loginsResult.logins)
    setLoginsLoading(false)

    if (!usageResult.error) setSbUsage(usageResult.usage)
    setSbUsageLoading(false)
  }, [])

  useEffect(() => { loadMonitoring() }, [loadMonitoring])

  /** 날짜 포맷 (상대시간) */
  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return '기록 없음'
    const now = new Date()
    const d = new Date(dateStr)
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHour = Math.floor(diffMs / 3600000)
    const diffDay = Math.floor(diffMs / 86400000)

    if (diffMin < 1) return '방금 전'
    if (diffMin < 60) return `${diffMin}분 전`
    if (diffHour < 24) return `${diffHour}시간 전`
    if (diffDay < 30) return `${diffDay}일 전`
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  return (
    <div className="space-y-5">

      {/* ===== 섹션 1: 시스템 상태 체크 ===== */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-400" />
            시스템 상태
          </h3>
          <button onClick={loadMonitoring} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs hover:bg-accent transition-colors">
            <RefreshCw className={`h-3 w-3 ${healthLoading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>
        <div className="p-4">
          {healthLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> 연결 상태 확인 중...
            </div>
          ) : health ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* DB 연결 */}
              <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${health.db.ok ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${health.db.ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                  {health.db.ok ? <CheckCircle2 className="h-4.5 w-4.5" /> : <XCircle className="h-4.5 w-4.5" />}
                </div>
                <div>
                  <p className="text-sm font-medium">Database</p>
                  <p className={`text-xs ${health.db.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {health.db.ok ? `정상 (${health.db.latencyMs}ms)` : health.db.message}
                  </p>
                </div>
              </div>
              {/* Auth 연결 */}
              <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${health.auth.ok ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${health.auth.ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                  {health.auth.ok ? <CheckCircle2 className="h-4.5 w-4.5" /> : <XCircle className="h-4.5 w-4.5" />}
                </div>
                <div>
                  <p className="text-sm font-medium">Authentication</p>
                  <p className={`text-xs ${health.auth.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {health.auth.message}
                  </p>
                </div>
              </div>
              {/* Storage 연결 */}
              <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${health.storage.ok ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${health.storage.ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                  {health.storage.ok ? <CheckCircle2 className="h-4.5 w-4.5" /> : <XCircle className="h-4.5 w-4.5" />}
                </div>
                <div>
                  <p className="text-sm font-medium">Storage</p>
                  <p className={`text-xs ${health.storage.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                    {health.storage.message}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-red-400 text-center py-4">상태 조회 실패</p>
          )}
        </div>
      </div>

      {/* ===== 섹션 2: 최근 접속 기록 ===== */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-400" />
            최근 접속 기록
          </h3>
        </div>
        <div className="p-4">
          {loginsLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground text-sm gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> 불러오는 중...
            </div>
          ) : logins.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">접속 기록이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {logins.map((login) => (
                <div key={login.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border bg-muted/10 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold">
                      {login.displayName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{login.displayName}</p>
                      <p className="text-xs text-muted-foreground">{login.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium border ${ROLE_COLORS[login.role] || 'bg-gray-500/15 text-gray-400'}`}>
                      {ROLE_LABELS[login.role] || login.role}
                    </span>
                    <span className="text-xs text-muted-foreground min-w-[70px] text-right">
                      {formatRelativeTime(login.lastSignInAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== 섹션 3: 무료 플랜 사용량 안내 ===== */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-orange-400" />
            무료 플랜 한도 · 영한 번역 가이드
          </h3>
        </div>
        <div className="p-4 space-y-5">
          {/* Vercel 한도 — 영한 번역 테이블 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-black text-white px-1.5 py-0.5 rounded">▲</span>
                <span className="text-sm font-medium">Vercel Hobby</span>
              </div>
              <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-400 hover:underline">
                사용량 보기 <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30 border-b">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">대시보드 표기 (영어)</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">뜻</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">무료 한도</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { en: 'Fluid Active CPU', ko: '서버 CPU 사용시간', limit: '4시간/월' },
                    { en: 'Function Invocations', ko: '함수 호출 횟수', limit: '100만회/월' },
                    { en: 'Edge Requests', ko: '엣지 요청 횟수', limit: '100만회/월' },
                    { en: 'Fast Origin Transfer', ko: '데이터 전송량 (대역폭)', limit: '10 GB/월' },
                  ].map((row) => (
                    <tr key={row.en} className="border-b last:border-0 hover:bg-muted/10">
                      <td className="px-3 py-2 font-mono text-muted-foreground">{row.en}</td>
                      <td className="px-3 py-2 font-medium">{row.ko}</td>
                      <td className="px-3 py-2 text-right font-bold">{row.limit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground/60 mt-2">
              * Vercel은 사용량 API를 제공하지 않아 자동 연동 불가. 위 대시보드에서 직접 확인하세요.
            </p>
          </div>

          {/* Supabase 실시간 사용량 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: '#3ECF8E', color: '#fff' }}>⚡</span>
                <span className="text-sm font-medium">Supabase Free — 실시간 사용량</span>
              </div>
              <a href="https://app.supabase.com/project/amllpfihdjohjuypcawv" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-emerald-400 hover:underline">
                대시보드 <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            {sbUsageLoading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground text-sm gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> 사용량 조회 중...
              </div>
            ) : sbUsage ? (
              <div className="space-y-3">
                {/* DB 용량 */}
                <UsageBar
                  label="DB 용량"
                  used={sbUsage.db.usedLabel}
                  limit={sbUsage.db.limitLabel}
                  percent={Math.min((sbUsage.db.usedBytes / sbUsage.db.limitBytes) * 100, 100)}
                  color="emerald"
                />
                {/* Storage */}
                <UsageBar
                  label={`파일 저장소 (${sbUsage.storage.fileCount}개 파일)`}
                  used={sbUsage.storage.usedLabel}
                  limit={sbUsage.storage.limitLabel}
                  percent={Math.min((sbUsage.storage.usedBytes / sbUsage.storage.limitBytes) * 100, 100)}
                  color="blue"
                />
                {/* Auth 사용자 */}
                <UsageBar
                  label="등록 사용자"
                  used={`${sbUsage.auth.userCount}명`}
                  limit={`${sbUsage.auth.limitCount.toLocaleString()}명`}
                  percent={Math.min((sbUsage.auth.userCount / sbUsage.auth.limitCount) * 100, 100)}
                  color="violet"
                />
              </div>
            ) : (
              <p className="text-sm text-red-400 text-center py-4">사용량 조회 실패</p>
            )}
          </div>
        </div>
      </div>

      {/* Vercel 로고 + 제목 */}
      <div className="flex items-center gap-2">
        <span className="text-lg font-bold">▲</span>
        <span className="text-lg font-semibold">Vercel</span>
      </div>

      {/* 서버 상태 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Globe className="h-4 w-4" />
            <span className="text-xs font-medium">사이트 URL</span>
          </div>
          <a
            href="https://melea.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-bold text-blue-400 hover:underline break-all"
          >
            melea.vercel.app
          </a>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Server className="h-4 w-4" />
            <span className="text-xs font-medium">프레임워크</span>
          </div>
          <p className="text-sm font-bold">Next.js 14</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <MapPin className="h-4 w-4" />
            <span className="text-xs font-medium">서버 위치</span>
          </div>
          <p className="text-sm font-bold">서울 (icn1)</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Zap className="h-4 w-4" />
            <span className="text-xs font-medium">요금제</span>
          </div>
          <p className="text-sm font-bold">Hobby (무료)</p>
        </div>
      </div>

      {/* 배포 방법 안내 */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-400" />
            배포 방법
          </h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-400 text-xs font-bold">1</span>
            <div>
              <p className="text-sm font-medium">코드 수정</p>
              <p className="text-xs text-muted-foreground">내 컴퓨터에서 코드 수정 후 localhost:3002에서 확인</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-400 text-xs font-bold">2</span>
            <div>
              <p className="text-sm font-medium">git push</p>
              <p className="text-xs text-muted-foreground">GitHub에 코드 올리기</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-bold">3</span>
            <div>
              <p className="text-sm font-medium">자동 배포</p>
              <p className="text-xs text-muted-foreground">Vercel이 자동 감지하여 1~2분 내 배포 완료</p>
            </div>
          </div>
        </div>
      </div>

      {/* 환경변수 목록 */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Key className="h-4 w-4 text-orange-400" />
            환경변수 (Vercel에 등록됨)
          </h3>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            {[
              { name: 'NEXT_PUBLIC_SUPABASE_URL', desc: 'Supabase 프로젝트 URL' },
              { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', desc: 'Supabase 공개 API 키' },
              { name: 'NEXT_PUBLIC_KAKAO_MAP_KEY', desc: '카카오맵 JavaScript 키' },
            ].map((env) => (
              <div key={env.name} className="flex items-center justify-between px-3 py-2 rounded-lg border bg-muted/10">
                <code className="text-xs font-mono text-foreground">{env.name}</code>
                <span className="text-xs text-muted-foreground hidden sm:inline">{env.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 관리 사이트 바로가기 */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-violet-400" />
            관리 사이트 바로가기
          </h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ADMIN_LINKS.map((link) => (
              <a
                key={link.name}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 rounded-xl border hover:bg-accent/50 transition-colors group"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg ${link.color}`}>
                  {link.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium group-hover:text-primary transition-colors">{link.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{link.description}</p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 모달 컴포넌트들
// ============================================================

/** 사용량 진행바 — Supabase 사용량 시각화용 */
function UsageBar({ label, used, limit, percent, color }: {
  label: string; used: string; limit: string; percent: number
  color: 'emerald' | 'blue' | 'violet' | 'orange'
}) {
  const barColors = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    violet: 'bg-violet-500',
    orange: 'bg-orange-500',
  }
  const textColors = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    violet: 'text-violet-400',
    orange: 'text-orange-400',
  }

  return (
    <div className="px-3 py-2.5 rounded-lg border bg-muted/10">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          <span className={`font-bold ${textColors[color]}`}>{used}</span>
          {' / '}
          {limit}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColors[color]}`}
          style={{ width: `${Math.max(percent, 0.5)}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground/60 mt-1 text-right">{percent.toFixed(1)}% 사용</p>
    </div>
  )
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function CreateUserModal({ onClose, onSuccess, onError }: { onClose: () => void; onSuccess: (msg: string) => void; onError: (msg: string) => void }) {
  const [saving, setSaving] = useState(false)
  const [role, setRole] = useState('affiliate')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    formData.set('role', role)
    const result = await createUser(formData)
    setSaving(false)
    if (result.error) onError(result.error)
    else onSuccess('계정이 생성되었습니다.')
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold flex items-center gap-2"><UserPlus className="h-5 w-5 text-primary" /> 계정 추가</h2>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-accent"><X className="h-4 w-4" /></button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">사용자이름 (로그인 ID)</label>
          <input name="username" required placeholder="예: hong123" className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">비밀번호</label>
          <input name="password" type="password" required minLength={6} placeholder="6자 이상" className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">표시 이름</label>
          <input name="displayName" required placeholder="예: 홍길동" className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">역할</label>
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map(opt => (
              <button key={opt.value} type="button" onClick={() => setRole(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${role === opt.value ? ROLE_COLORS[opt.value] : 'border-border text-muted-foreground hover:bg-accent'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {role === 'affiliate' && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">계열사명</label>
            <input name="affiliateName" placeholder="예: 교원구몬" className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        )}
        <button type="submit" disabled={saving} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
          {saving ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> 생성 중...</> : <><Check className="h-3.5 w-3.5" /> 계정 생성</>}
        </button>
      </form>
    </ModalOverlay>
  )
}

function EditRoleModal({ user, onClose, onSuccess, onError }: { user: UserRow; onClose: () => void; onSuccess: (msg: string) => void; onError: (msg: string) => void }) {
  const [saving, setSaving] = useState(false)
  const [role, setRole] = useState(user.role)
  const [displayName, setDisplayName] = useState(user.display_name)
  const [affiliateName, setAffiliateName] = useState(user.affiliate_name || '')

  const handleSave = async () => {
    setSaving(true)
    const result = await updateUserRole(user.id, role, displayName, affiliateName || undefined)
    setSaving(false)
    if (result.error) onError(result.error)
    else onSuccess(`${displayName} 계정이 수정되었습니다.`)
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold flex items-center gap-2"><Edit2 className="h-5 w-5 text-blue-400" /> 계정 수정</h2>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-accent"><X className="h-4 w-4" /></button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">아이디</label>
          <input disabled value={user.username} className="w-full px-3 py-2.5 rounded-lg border bg-muted text-sm text-muted-foreground" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">표시 이름</label>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">역할</label>
          <div className="flex flex-wrap gap-2">
            {ROLE_OPTIONS.map(opt => (
              <button key={opt.value} type="button" onClick={() => setRole(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${role === opt.value ? ROLE_COLORS[opt.value] : 'border-border text-muted-foreground hover:bg-accent'}`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        {role === 'affiliate' && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">계열사명</label>
            <input value={affiliateName} onChange={e => setAffiliateName(e.target.value)} placeholder="예: 교원구몬" className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        )}
        <button onClick={handleSave} disabled={saving} className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
          {saving ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> 저장 중...</> : <><Check className="h-3.5 w-3.5" /> 저장</>}
        </button>
      </div>
    </ModalOverlay>
  )
}

function ResetPasswordModal({ user, onClose, onSuccess, onError }: { user: UserRow; onClose: () => void; onSuccess: (msg: string) => void; onError: (msg: string) => void }) {
  const [saving, setSaving] = useState(false)
  const [password, setPassword] = useState('')

  const handleReset = async () => {
    if (password.length < 6) { onError('비밀번호는 6자 이상이어야 합니다.'); return }
    setSaving(true)
    const result = await resetPassword(user.id, password)
    setSaving(false)
    if (result.error) onError(result.error)
    else onSuccess(`${user.display_name}의 비밀번호가 초기화되었습니다.`)
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold flex items-center gap-2"><Key className="h-5 w-5 text-orange-400" /> 비밀번호 초기화</h2>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-accent"><X className="h-4 w-4" /></button>
      </div>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground"><strong className="text-foreground">{user.display_name}</strong> ({user.username})의 비밀번호를 변경합니다.</p>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">새 비밀번호</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="6자 이상" minLength={6} className="w-full px-3 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <button onClick={handleReset} disabled={saving || password.length < 6} className="w-full py-2.5 rounded-lg bg-orange-600 text-white text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
          {saving ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> 변경 중...</> : <><Key className="h-3.5 w-3.5" /> 비밀번호 변경</>}
        </button>
      </div>
    </ModalOverlay>
  )
}

function DeleteUserModal({ user, onClose, onSuccess, onError }: { user: UserRow; onClose: () => void; onSuccess: (msg: string) => void; onError: (msg: string) => void }) {
  const [saving, setSaving] = useState(false)

  const handleDelete = async () => {
    setSaving(true)
    const result = await deleteUser(user.id)
    setSaving(false)
    if (result.error) onError(result.error)
    else onSuccess(`${user.display_name} 계정이 삭제되었습니다.`)
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold flex items-center gap-2 text-red-400"><Trash2 className="h-5 w-5" /> 계정 삭제</h2>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-accent"><X className="h-4 w-4" /></button>
      </div>
      <div className="space-y-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-sm text-red-400"><strong>{user.display_name}</strong> ({user.username}) 계정을 삭제하면 복구할 수 없습니다.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border text-sm font-medium hover:bg-accent transition-colors">취소</button>
          <button onClick={handleDelete} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {saving ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> 삭제 중...</> : <><Trash2 className="h-3.5 w-3.5" /> 삭제</>}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}
