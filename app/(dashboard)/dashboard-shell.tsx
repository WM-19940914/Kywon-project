/**
 * 대시보드 셸 — 사이드바 + 메인 콘텐츠 영역 (클라이언트 컴포넌트)
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
} from '@/components/ui/sidebar'
import { menuItems, serverAdminMenuItem, archiveMenuItem } from '@/lib/menu-items'
import { AlertProvider } from '@/components/ui/custom-alert'
import { ROLE_MENU_ACCESS, ROLE_LABELS, type UserProfile } from '@/lib/auth/roles'
import { UserProvider } from '@/lib/auth/user-context'
import { logout } from '@/app/login/actions'

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
        {/* ── 사이드바 상단 로고 — 최적화된 수직 공간 ── */}
        <SidebarHeader className="border-b border-sidebar-border/60 px-6 py-3">
          <Link href="/" className="flex items-center gap-3.5 group/logo">
            {/* MeLEA 브랜드 로고 — 콤팩트 스케일 */}
            <div className="flex items-center rounded-lg px-2.5 py-1.5 shadow-lg shadow-carrot-500/20 transition-transform duration-300 group-hover/logo:scale-105" style={{ backgroundColor: '#E09520' }}>
              <span className="font-black text-[11px] leading-none tracking-tight" style={{ color: '#2D2519' }}>M</span>
              <span className="font-bold italic leading-none" style={{ color: '#FFFFFF', fontSize: '0.95rem', paddingRight: '1px', marginLeft: '0.5px' }}>e</span>
              <span className="font-black text-[11px] leading-none tracking-tight" style={{ color: '#2D2519' }}>LEA</span>
            </div>
            {/* 브랜드 네임 — 정교한 타이포그래피 */}
            <div className="flex flex-col">
              <h2 className="font-black text-[14px] text-slate-900 tracking-tight leading-none">
                에어컨 발주
              </h2>
              <p className="text-[11px] font-bold text-slate-400 tracking-tighter leading-none mt-1">
                관리 시스템
              </p>
            </div>
          </Link>
        </SidebarHeader>

        {/* ── 사이드바 메뉴 (역할에 맞는 메뉴만 표시) ── */}
        <SidebarContent className="py-1">
          {filteredMenuItems.map((group, groupIndex) => {
            return (
              <div key={group.title || 'home'} className={groupIndex > 0 ? "mt-2.5" : "mt-0.5"}>
                {/* 그룹 간 구분선 — 아주 얇고 깨끗하게 */}
                {groupIndex > 0 && group.title && (
                  <div className="mx-5 mb-1.5 border-t border-sidebar-border/20" />
                )}

                <SidebarGroup className="px-3 py-0">
                  {/* 그룹 라벨 — 명암 대비와 위계가 잡힌 헤더 */}
                  {group.title && (
                    <button
                      onClick={() => toggleGroup(group.title!)}
                      className="flex w-full items-center px-2 py-1.5 mb-1 rounded-lg bg-sidebar-accent/50 border border-sidebar-border/10 shadow-inner hover:bg-sidebar-accent/80 transition-all duration-200 group/header"
                    >
                      {/* 그룹 아이콘 — 브랜드 컬러 적용 */}
                      {group.icon && (
                        <group.icon 
                          className="h-4 w-4 mr-2.5 shrink-0 transition-colors" 
                          style={{ 
                            color: (group.title === '교원 업무' || group.title === '교원그룹 자산') ? '#231F20' :
                                   (group.title === '에스원 설치/정산') ? '#2563EB' :
                                   (group.title === '멜레아 배송/재고' || group.title === '멜레아 정산') ? '#E09520' : 
                                   'currentColor'
                          }}
                          strokeWidth={2.5} 
                        />
                      )}

                      <span className="text-[13.5px] font-black tracking-tight text-sidebar-foreground/80 uppercase">
                        {group.title}
                      </span>

                      {/* 소속 뱃지 (그룹 우측 표기) — 고정된 크기 */}
                      <div className="ml-auto flex items-center gap-1.5 opacity-90 group-hover/header:opacity-100 transition-opacity">
                        {(group.title === '교원 업무' || group.title === '교원그룹 자산') && (
                          <span className="inline-flex items-center justify-center w-[68px] h-[20px] rounded-md bg-[#231F20] shadow-sm border border-white/10">
                            <span className="text-[10px] font-black text-white leading-none tracking-tighter">KY</span>
                            <span className="text-[10px] font-black text-[#F37021] leading-none mx-[0.5px]">O</span>
                            <span className="text-[10px] font-black text-white leading-none tracking-tighter">WON</span>
                          </span>
                        )}
                        {group.title === '에스원 설치/정산' && (
                          <span className="inline-flex items-center justify-center gap-0.5 w-[68px] h-[20px] rounded-md bg-[#2563EB] shadow-sm border border-white/10">
                            <span className="text-[10px] font-black text-white leading-none">S1</span>
                            <span className="text-[10px] font-bold text-blue-100 leading-none tracking-tighter">ENG</span>
                          </span>
                        )}
                        {(group.title === '멜레아 배송/재고' || group.title === '멜레아 정산') && (
                          <span className="inline-flex items-center justify-center w-[68px] h-[20px] rounded-md bg-[#E09520] shadow-sm border border-black/5">
                            <span className="text-[10px] font-black text-[#2D2519] leading-none">M</span>
                            <span className="text-[11px] font-bold italic text-white leading-none tracking-tighter pr-0.5">e</span>
                            <span className="text-[10px] font-black text-[#2D2519] leading-none">LEA</span>
                          </span>
                        )}
                        <ChevronDown
                          className={`h-3 w-3 text-sidebar-foreground/30 transition-transform duration-200 ${
                            collapsed[group.title] ? '-rotate-90' : ''
                          }`}
                        />
                      </div>
                    </button>
                  )}

                  {/* 접힌 상태가 아닐 때만 메뉴 아이템 표시 */}
                  {!(group.title && collapsed[group.title]) && (
                    <SidebarGroupContent>
                      <SidebarMenu className="gap-0">
                        {/* 아이템 레벨 권한 필터링 적용 — affiliate는 정산 메뉴가 여기서 걸러짐 */}
                        {group.items.filter(item => !item.roles || item.roles.includes(user.role)).map((item) => {
                          const isActive = pathname === item.url

                          /* 미구현(disabled) 메뉴 — 미니멀 도트 적용 */
                          if (item.disabled) {
                            return (
                              <SidebarMenuItem key={item.title}>
                                <SidebarMenuButton
                                  size="sm"
                                  className="opacity-40 cursor-not-allowed pointer-events-none text-[12.5px] pl-8.5 pr-3 py-1.5 rounded-md"
                                >
                                  <div className="h-1 w-1 rounded-full bg-slate-300 mr-2.5 shrink-0" />
                                  <span>{item.title}</span>
                                  <span className="ml-auto text-[8.5px] font-bold bg-sidebar-accent text-sidebar-foreground/50 px-1 py-0.5 rounded">
                                    준비중
                                  </span>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            )
                          }

                          /* 구현된 메뉴 — 미니멀 도트 스타일 */
                          return (
                            <SidebarMenuItem key={item.title}>
                              <SidebarMenuButton
                                asChild
                                isActive={isActive}
                                size="sm"
                                className={`text-[12.5px] font-semibold pl-8.5 pr-3 py-1.5 rounded-md transition-all duration-200 ${
                                  isActive
                                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                                }`}
                              >
                                <Link href={item.url} className="flex items-center w-full">
                                  {/* 최상단 메뉴는 아이콘 그대로 표시, 하위 메뉴는 도트 표시 */}
                                  {!group.title ? (
                                    <item.icon className={`h-4 w-4 mr-2.5 transition-colors ${isActive ? 'text-slate-900' : 'text-slate-400'}`} strokeWidth={2.5} />
                                  ) : (
                                    <div className={`h-1 w-1 rounded-full mr-2.5 shrink-0 transition-colors ${isActive ? 'bg-slate-900' : 'bg-slate-300'}`} />
                                  )}
                                  <span>{item.title}</span>
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
          <div className="mx-1 mb-1 border-t border-sidebar-border/30" />
          <Link
            href={archiveMenuItem.url}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] transition-all duration-150 ${
              pathname === archiveMenuItem.url
                ? 'bg-white/[0.08] text-sidebar-foreground'
                : 'text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-white/[0.04]'
            }`}
          >
            <archiveMenuItem.icon className="h-3.5 w-3.5" />
            <span>{archiveMenuItem.title}</span>
          </Link>
        </div>

        {/* ── 관리자 전용 서버관리 메뉴 (맨 하단) ── */}
        {user.role === 'admin' && (
          <div className="px-3 pb-0.5">
            <div className="mx-1 mb-1 border-t border-sidebar-border/30" />
            <Link
              href={serverAdminMenuItem.url}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[11px] transition-all duration-150 ${
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

        {/* ── 사이드바 하단 — 초슬림 유저 프로필 ── */}
        <SidebarFooter className="border-t border-sidebar-border/30 px-5 py-2.5">
          <div className="flex items-center gap-3 px-1">
            {/* 사용자 아바타 — 더 콤팩트하게 */}
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent/80 text-sidebar-foreground/60 border border-sidebar-border/50">
              <User className="h-4.5 w-4.5" strokeWidth={2} />
            </div>
            {/* 이름 + 역할 */}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold truncate text-sidebar-foreground leading-none">
                {user.displayName}
              </p>
              <p className="text-[10px] font-bold text-sidebar-foreground/40 truncate uppercase tracking-tighter mt-1">
                {ROLE_LABELS[user.role]}
              </p>
            </div>
            {/* 로그아웃 버튼 */}
            <form action={logout}>
              <button
                type="submit"
                className="flex items-center justify-center h-6 w-6 rounded-md hover:bg-rose-50 hover:text-rose-500 text-sidebar-foreground/30 transition-all duration-200"
                title="로그아웃"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        </SidebarFooter>
      </Sidebar>

      {/* ── 오른쪽 메인 콘텐츠 영역 ── */}
      <div className="flex-1 flex flex-col min-h-screen">
        <main className="flex-1 bg-slate-50/50 p-8">
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
