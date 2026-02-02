/**
 * 대시보드 레이아웃 - 사이드바 버전
 *
 * 왼쪽 사이드바 메뉴를 역할(사용자 그룹) 기준으로 분류합니다.
 * - 교원그룹 / 교원·멜레아 / 멜레아·에스원 / 공통 정보
 * - 미구현 메뉴는 비활성 처리 + "준비중" 표시
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, Search } from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { menuItems, settingsMenuItem } from '@/lib/menu-items'
import { AlertProvider } from '@/components/ui/custom-alert'

/** 각 역할 그룹별 색상 테마 */
const GROUP_COLORS: Record<string, { label: string; bar: string; bg: string }> = {
  '교원그룹':       { label: 'text-blue-400/80',    bar: 'bg-blue-500',    bg: 'bg-blue-500/[0.06]' },
  '교원 · 멜레아':  { label: 'text-violet-400/80',   bar: 'bg-violet-500',   bg: 'bg-violet-500/[0.06]' },
  '멜레아 · 에스원': { label: 'text-emerald-400/80',  bar: 'bg-emerald-500',  bg: 'bg-emerald-500/[0.06]' },
  '공통 정보':      { label: 'text-amber-400/80',    bar: 'bg-amber-500',    bg: 'bg-amber-500/[0.06]' },
  '멜레아 전용':    { label: 'text-rose-400/80',     bar: 'bg-rose-500',     bg: 'bg-rose-500/[0.06]' },
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()

  return (
    <AlertProvider>
    <SidebarProvider>
      <Sidebar>
        {/* 사이드바 상단 로고 */}
        <SidebarHeader className="border-b border-sidebar-border px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold text-sm shadow-lg">
              AC
            </div>
            <div>
              <h2 className="font-semibold text-sm text-sidebar-foreground">에어컨 발주</h2>
              <p className="text-xs text-sidebar-foreground/60">관리 시스템</p>
            </div>
          </Link>
        </SidebarHeader>

        {/* 사이드바 메뉴 */}
        <SidebarContent>
          {menuItems.map((group, groupIndex) => (
            <div key={group.title || 'home'}>
              {/* 역할 그룹 사이 구분선 (대시보드 단독 그룹 제외하고 그룹 시작 전에) */}
              {groupIndex > 0 && group.title && (
                <Separator className="mx-4 my-3 bg-sidebar-border" />
              )}

              <SidebarGroup className={`${group.title && GROUP_COLORS[group.title] ? `rounded-xl mx-2 px-2 py-1.5 ${GROUP_COLORS[group.title].bg}` : ''}`}>
                {/* 그룹 라벨 (title이 있을 때만 표시) */}
                {group.title && (
                  <SidebarGroupLabel className={`text-xs tracking-wider font-semibold ${GROUP_COLORS[group.title]?.label || 'text-sidebar-foreground/40'}`}>
                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${GROUP_COLORS[group.title]?.bar || 'bg-sidebar-foreground/30'}`} />
                    {group.title}
                  </SidebarGroupLabel>
                )}

                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const isActive = pathname === item.url

                      // 미구현(disabled) 메뉴
                      if (item.disabled) {
                        return (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                              className="opacity-40 cursor-not-allowed pointer-events-none text-[13px] rounded-lg"
                            >
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                              <span className="ml-auto text-[10px] bg-sidebar-accent/60 text-sidebar-foreground/50 px-1.5 py-0.5 rounded">
                                준비중
                              </span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        )
                      }

                      // 구현된 메뉴
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild isActive={isActive} className="text-[13px] rounded-lg">
                            <Link href={item.url}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </div>
          ))}
        </SidebarContent>

        {/* 사이드바 하단 */}
        <SidebarFooter className="border-t border-sidebar-border p-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href={settingsMenuItem.url}>
                  <settingsMenuItem.icon className="h-4 w-4" />
                  <span>{settingsMenuItem.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>

          <Separator className="my-2 bg-sidebar-border" />

          <div className="flex items-center gap-2 px-2 py-1.5">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-blue-500/20 text-blue-300 text-xs font-semibold">
                우민
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-sidebar-foreground">우민님</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">관리자</p>
            </div>
          </div>
        </SidebarFooter>
      </Sidebar>

      {/* 오른쪽 메인 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-white/80 backdrop-blur-md px-6">
          <SidebarTrigger />

          <div className="flex-1 flex items-center gap-4">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                placeholder="발주 검색..."
                className="w-full rounded-xl border-0 bg-muted/60 pl-10 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
          </Button>
        </header>

        <main className="flex-1 bg-slate-50/50 p-6">
          {children}
        </main>
      </div>
    </SidebarProvider>
    </AlertProvider>
  )
}
