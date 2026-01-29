/**
 * 대시보드 레이아웃 - 사이드바 버전
 *
 * 이 파일은 전체 대시보드의 "뼈대"를 만듭니다.
 * 왼쪽에는 메뉴(사이드바), 오른쪽에는 내용(페이지)이 표시돼요.
 *
 * 구조:
 * ┌─────────────┬──────────────────┐
 * │             │    헤더 영역      │
 * │  사이드바   ├──────────────────┤
 * │   메뉴      │                  │
 * │             │   페이지 내용     │
 * │             │                  │
 * └─────────────┴──────────────────┘
 */

'use client'  // 클라이언트 컴포넌트로 만들어야 Link와 usePathname을 사용할 수 있어요

import Link from 'next/link'  // Next.js의 링크 (페이지 이동용)
import { usePathname } from 'next/navigation'  // 현재 페이지 주소를 알아내는 기능
import { Bell, Search } from 'lucide-react'  // 종 모양(알림), 돋보기(검색) 아이콘

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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 현재 페이지의 주소를 가져옵니다 (예: "/orders" 또는 "/orders/new")
  // 이걸 이용해서 현재 메뉴를 하이라이트할 거예요
  const pathname = usePathname()

  return (
    // SidebarProvider: 사이드바의 열림/닫힘 상태를 관리하는 "관리자"
    <SidebarProvider>
      {/* 왼쪽 사이드바 영역 */}
      <Sidebar>
        {/* 사이드바 상단: 로고와 제목 */}
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

        {/* 사이드바 중간: 메뉴 항목들 (스크롤 가능) */}
        <SidebarContent>
          {/* menuItems 배열을 순회하면서 각 그룹을 표시 */}
          {menuItems.map((group) => (
            <SidebarGroup key={group.title}>
              {/* 그룹 제목 (예: "발주 관리") */}
              <SidebarGroupLabel>{group.title}</SidebarGroupLabel>

              <SidebarGroupContent>
                <SidebarMenu>
                  {/* 각 그룹 안의 메뉴 항목들 */}
                  {group.items.map((item) => {
                    // 현재 페이지인지 확인 (예: pathname이 "/orders"이고 item.url도 "/orders"면 true)
                    const isActive = pathname === item.url

                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isActive}>
                          <Link href={item.url}>
                            {/* 아이콘 표시 */}
                            <item.icon className="h-4 w-4" />
                            {/* 메뉴 이름 */}
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        {/* 사이드바 하단: 사용자 정보와 설정 */}
        <SidebarFooter className="border-t border-sidebar-border p-4">
          <SidebarMenu>
            {/* 설정 메뉴 */}
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

          {/* 사용자 프로필 (나중에 실제 로그인 정보로 바꿀 거예요) */}
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
        {/* 상단 헤더 */}
        <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-white/80 backdrop-blur-md px-6">
          {/* 햄버거 메뉴 (모바일에서 사이드바를 여는 버튼) */}
          <SidebarTrigger />

          {/* 검색창 (나중에 구현 예정) */}
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

          {/* 알림 버튼 (나중에 구현 예정) */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {/* 읽지 않은 알림이 있을 때 표시할 뱃지 */}
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
          </Button>
        </header>

        {/* 페이지 내용이 표시되는 영역 */}
        <main className="flex-1 bg-slate-50/50 p-6">
          {children}
        </main>
      </div>
    </SidebarProvider>
  )
}
