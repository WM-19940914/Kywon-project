/**
 * 대시보드 셸 — 사이드바 + 메인 콘텐츠 영역 (클라이언트 컴포넌트)
 *
 * 기존 layout.tsx에 있던 사이드바 UI 코드를 여기로 이동했습니다.
 * 서버에서 받아온 사용자 정보(UserProfile)를 기반으로
 * 역할에 맞는 메뉴만 필터링해서 보여줍니다.
 *
 * 비유: "건물 내부" — 로비(사이드바)에서 자기 출입 가능한 층(메뉴)만 보이는 것
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, LogOut, User } from 'lucide-react'
import { Toaster } from 'sonner'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { menuItems, serverAdminMenuItem, archiveMenuItem } from '@/lib/menu-items'
import { AlertProvider } from '@/components/ui/custom-alert'
import { ROLE_MENU_ACCESS, ROLE_LABELS, type UserProfile } from '@/lib/auth/roles'
import { UserProvider } from '@/lib/auth/user-context'
import { logout } from '@/app/login/actions'

/** 그룹별 컬러 테마 — 도트 색상, 라벨 텍스트, 액티브 아이템 강조색 */
const GROUP_THEME: Record<string, { dot: string; label: string; active: string }> = {
  '교원그룹':       { dot: '#F4E285', label: 'text-gold-300/90',     active: '#F4E285' },
  '교원 · 멜레아':  { dot: '#F3933F', label: 'text-carrot-400/90',   active: '#F3933F' },
  '멜레아 · 에스원': { dot: '#5B8E7D', label: 'text-teal-400/90',    active: '#5B8E7D' },
  '공통 정보':      { dot: '#8CB369', label: 'text-olive-400/90',    active: '#8CB369' },
  '멜레아 전용':    { dot: '#BC4B51', label: 'text-brick-400/90',    active: '#BC4B51' },
}

interface DashboardShellProps {
  children: React.ReactNode
  user: UserProfile  // 서버에서 전달받은 사용자 정보
}

export default function DashboardShell({ children, user }: DashboardShellProps) {
  const pathname = usePathname()

  /** 접힌 그룹 관리 (그룹 title → 접힘 여부) */
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggleGroup = (title: string) => {
    setCollapsed(prev => ({ ...prev, [title]: !prev[title] }))
  }

  // 사용자 역할에 따라 접근 가능한 메뉴 그룹만 필터링
  const menuAccess = ROLE_MENU_ACCESS[user.role] || {}
  const filteredMenuItems = menuItems.filter(group => {
    // 그룹 title이 없으면 대시보드 (모든 역할 접근 가능)
    if (!group.title) return true
    // 해당 그룹에 접근 권한이 있는지 확인
    return menuAccess[group.title] === true
  })

  return (
    <UserProvider user={user}>
    <AlertProvider>
    <SidebarProvider>
      <Sidebar>
        {/* ── 사이드바 상단 로고 — 그래디언트 박스 + 브랜드 텍스트 ── */}
        <SidebarHeader className="border-b border-sidebar-border px-5 py-4">
          <Link href="/" className="flex items-center gap-3">
            {/* MeLEA 브랜드 로고 */}
            <div className="flex items-center rounded-lg px-2.5 py-1.5 shadow-lg shadow-carrot-500/20" style={{ backgroundColor: '#E09520' }}>
              <span className="font-extrabold text-sm leading-none" style={{ color: '#2D2519' }}>M</span>
              <span className="font-bold italic leading-none" style={{ color: '#FFFFFF', fontSize: '0.95rem', paddingRight: '1.5px' }}>e</span>
              <span className="font-extrabold text-sm leading-none" style={{ color: '#2D2519' }}>LEA</span>
            </div>
            <div>
              <h2 className="font-semibold text-[13px] text-sidebar-foreground leading-tight">에어컨 발주</h2>
              <p className="text-[11px] text-sidebar-foreground/50">관리 시스템</p>
            </div>
          </Link>
        </SidebarHeader>

        {/* ── 사이드바 메뉴 (역할에 맞는 메뉴만 표시) ── */}
        <SidebarContent>
          {filteredMenuItems.map((group, groupIndex) => {
            const theme = group.title ? GROUP_THEME[group.title] : null

            return (
              <div key={group.title || 'home'}>
                {/* 그룹 간 구분선 */}
                {groupIndex > 0 && group.title && (
                  <div className="mx-4 my-2 border-t border-sidebar-border/60" />
                )}

                <SidebarGroup className="px-3 py-0.5">
                  {/* 그룹 라벨 — 컬러 도트 + 컬러 텍스트 + 쉐브론 접기 */}
                  {group.title && theme && (
                    <button
                      onClick={() => toggleGroup(group.title!)}
                      className="flex w-full items-center gap-2 px-2 py-1.5 mb-0.5 rounded-md hover:bg-white/[0.04] transition-colors"
                    >
                      {/* 컬러 도트 (은은한 글로우) */}
                      <span
                        className="h-[7px] w-[7px] rounded-full shrink-0"
                        style={{
                          backgroundColor: theme.dot,
                          boxShadow: `0 0 6px ${theme.dot}60`,
                        }}
                      />
                      <span className={`text-[11px] font-semibold tracking-wide ${theme.label}`}>
                        {group.title}
                      </span>
                      <ChevronDown
                        className={`ml-auto h-3 w-3 text-sidebar-foreground/30 transition-transform duration-200 ${
                          collapsed[group.title] ? '-rotate-90' : ''
                        }`}
                      />
                    </button>
                  )}

                  {/* 접힌 상태가 아닐 때만 메뉴 아이템 표시 */}
                  {!(group.title && collapsed[group.title]) && (
                    <SidebarGroupContent>
                      <SidebarMenu className="gap-0.5">
                        {group.items.map((item) => {
                          const isActive = pathname === item.url

                          /* 미구현(disabled) 메뉴 */
                          if (item.disabled) {
                            return (
                              <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton
                                  size="sm"
                                  className="opacity-30 cursor-not-allowed pointer-events-none text-[13px] rounded-lg"
                                  style={{ borderLeft: '3px solid transparent' }}
                                >
                                  <item.icon className="h-4 w-4" />
                                  <span>{item.title}</span>
                                  <span className="ml-auto text-[9px] bg-white/5 text-sidebar-foreground/40 px-1.5 py-0.5 rounded">
                                    준비중
                                  </span>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            )
                          }

                          /* 구현된 메뉴 — 액티브 시 그룹 컬러 좌측 보더 + 배경 틴트 */
                          return (
                            <SidebarMenuItem key={item.title}>
                              <SidebarMenuButton
                                asChild
                                isActive={isActive}
                                size="sm"
                                className="text-[13px] rounded-lg transition-all duration-150"
                                style={isActive && theme ? {
                                  borderLeft: `3px solid ${theme.active}`,
                                  background: `${theme.active}12`,
                                } : {
                                  borderLeft: '3px solid transparent',
                                }}
                              >
                                <Link href={item.url} className="flex items-center gap-2 w-full">
                                  <item.icon
                                    className="h-4 w-4 transition-colors shrink-0"
                                    style={isActive && theme ? { color: theme.active } : undefined}
                                  />
                                  <span>{item.title}</span>
                                  {item.badge === 'MeLEA' && (
                                    <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded" style={{ background: '#E09520' }}>
                                      <span style={{ color: '#2D2519', fontSize: '9px', fontWeight: 800, lineHeight: 1 }}>M</span>
                                      <span style={{ color: '#fff', fontSize: '10px', fontStyle: 'italic', fontWeight: 600, lineHeight: 1, paddingRight: '1px' }}>e</span>
                                      <span style={{ color: '#2D2519', fontSize: '9px', fontWeight: 800, lineHeight: 1 }}>LEA</span>
                                    </span>
                                  )}
                                  {item.badge === 'S1ENG' && (
                                    <span className="ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded" style={{ background: '#2563EB' }}>
                                      <span style={{ color: '#fff', fontSize: '9px', fontWeight: 800, lineHeight: 1 }}>S1</span>
                                      <span style={{ color: '#93C5FD', fontSize: '9px', fontWeight: 600, lineHeight: 1 }}>ENG</span>
                                    </span>
                                  )}
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          )
                        })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  )}
                </SidebarGroup>
              </div>
            )
          })}
        </SidebarContent>

        {/* ── 과거 자료 아카이브 메뉴 (맨 하단) ── */}
        <div className="px-3 pb-1">
          <div className="mx-1 mb-2 border-t border-sidebar-border/60" />
          <Link
            href={archiveMenuItem.url}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] transition-all duration-150 ${
              pathname === archiveMenuItem.url
                ? 'bg-white/[0.08] text-sidebar-foreground'
                : 'text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-white/[0.04]'
            }`}
          >
            <archiveMenuItem.icon className="h-3.5 w-3.5" />
            <span>{archiveMenuItem.title}</span>
          </Link>
        </div>

        {/* ── opendnals123 전용 서버관리 메뉴 ── */}
        {user.username === 'opendnals123' && (
          <div className="px-3 pb-1">
            <div className="mx-1 mb-2 border-t border-sidebar-border/60" />
            <Link
              href={serverAdminMenuItem.url}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] transition-all duration-150 ${
                pathname === serverAdminMenuItem.url
                  ? 'bg-white/[0.08] text-sidebar-foreground'
                  : 'text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-white/[0.04]'
              }`}
            >
              <serverAdminMenuItem.icon className="h-3.5 w-3.5" />
              <span>{serverAdminMenuItem.title}</span>
            </Link>
          </div>
        )}

        {/* ── 사이드바 하단 — 로그인한 사용자 정보 + 로그아웃 ── */}
        <SidebarFooter className="border-t border-sidebar-border px-5 py-3">
          <div className="flex items-center gap-2.5 px-2">
            {/* 사용자 아바타 */}
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-foreground/20 text-sidebar-foreground/70">
              <User className="h-4.5 w-4.5" />
            </div>
            {/* 이름 + 역할 */}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium truncate text-sidebar-foreground">
                {user.displayName}
              </p>
              <p className="text-[10px] text-sidebar-foreground/45 truncate">
                {ROLE_LABELS[user.role]}
              </p>
            </div>
            {/* 로그아웃 버튼 */}
            <form action={logout}>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-white/10 text-sidebar-foreground/40 hover:text-sidebar-foreground/70 transition-colors"
                title="로그아웃"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="text-[11px]">로그아웃</span>
              </button>
            </form>
          </div>
        </SidebarFooter>
      </Sidebar>

      {/* ── 오른쪽 메인 콘텐츠 영역 ── */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* 상단 헤더 — 블러 배경 */}
        <header className="sticky top-0 z-10 flex h-12 items-center border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-4">
          <SidebarTrigger />
        </header>

        <main className="flex-1 bg-slate-50/50 p-6">
          <div className="animate-page-enter">
            {children}
          </div>
        </main>
        <Toaster richColors position="top-right" toastOptions={{ duration: 3000 }} />
      </div>
    </SidebarProvider>
    </AlertProvider>
    </UserProvider>
  )
}
