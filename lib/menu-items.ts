/**
 * 사이드바 메뉴 구조 정의
 */

import {
  ClipboardList,  // 발주 관리
  Wrench,         // AS 관리
  CreditCard,     // 정산 관리
  FileText,       // 단가표
  Truck,          // 배송 관리
  Warehouse,      // 재고 관리
  Archive,        // 철거 보관
  CalendarCheck,  // 설치일정 관리
  Receipt,        // 에스원 정산관리
  ShoppingCart,   // 선구매 장비
  Settings,       // 설정
  Server,         // 서버관리
  FolderArchive,  // 과거 자료
  Briefcase,      // 운영 헤더
  Package,        // 재고 헤더
  ShieldCheck,    // 전용 헤더
  LayoutDashboard, // 대시보드 아이콘
} from 'lucide-react'
import { LucideIcon } from 'lucide-react'
import { UserRole } from './auth/roles'

/** 메뉴 아이템 타입 */
export interface MenuItem {
  title: string        // 메뉴 이름
  url: string          // 이동할 페이지 주소
  icon: LucideIcon     // 아이콘
  disabled?: boolean   // 미구현 메뉴 여부 (true면 클릭 불가 + "준비중" 표시)
  badge?: string       // 메뉴 옆 마크 표시 (예: 'MeLEA')
  roles?: UserRole[]   // 접근 가능한 역할 (없으면 모두 접근 가능)
}

/** 메뉴 그룹 타입 */
export interface MenuGroup {
  title: string        // 그룹 이름
  items: MenuItem[]    // 메뉴 아이템 목록
  icon?: LucideIcon    // 그룹 아이콘
}

/**
 * 메뉴 데이터
 * 사용 주체 및 업무 중요도 기준으로 재분류
 */
export const menuItems: MenuGroup[] = [
  // ── 대시보드 (최상단) ──
  {
    title: '',
    items: [
      {
        title: '발주 및 AS 접수',
        url: '/',
        icon: LayoutDashboard,
      },
    ],
  },

  // ── 교원 업무 ──
  {
    title: '교원 업무',
    icon: Briefcase,
    items: [
      {
        title: '설치 발주 및 현황',
        url: '/orders',
        icon: ClipboardList,
      },
      {
        title: 'AS 접수 및 현황',
        url: '/as',
        icon: Wrench,
      },
      {
        title: '월별 정산내역',
        url: '/settlements',
        icon: CreditCard,
        roles: ['admin', 'melea', 'kyowon'],
      },
      {
        title: '기준 단가표',
        url: '/kyowon/price-table',
        icon: FileText,
      },
    ],
  },

  // ── 교원그룹 자산 ──
  {
    title: '교원그룹 자산',
    icon: Package,
    items: [
      {
        title: '철거장비 보관내역',
        url: '/kyowon/stored-equipment',
        icon: Archive,
      },
      {
        title: '선구매 자산',
        url: '/kyowon/prepurchase',
        icon: ShoppingCart,
      },
    ],
  },

  // ── 에스원 설치/정산 ──
  {
    title: '에스원 설치/정산',
    icon: Wrench,
    items: [
      {
        title: '설치 일정/견적',
        url: '/mellea/schedule',
        icon: CalendarCheck,
        badge: 'S1ENG',
      },
      {
        title: '에스원 설치비 정산',
        url: '/mellea/s1-settlement',
        icon: Receipt,
        badge: 'S1ENG',
      },
      {
        title: '철거 보관 관리',
        url: '/mellea/stored-equipment',
        icon: Archive,
        badge: 'S1ENG',
      },
      {
        title: '재고현황',
        url: '/mellea/inventory',
        icon: Warehouse,
        badge: 'MeLEA',
      },
      {
        title: '설치팀 창고',
        url: '/mellea/warehouses',
        icon: Warehouse,
      },
    ],
  },

  // ── 멜레아 배송/재고 ──
  {
    title: '멜레아 배송/재고',
    icon: Truck,
    items: [
      {
        title: '배송관리',
        url: '/mellea/delivery',
        icon: Truck,
        badge: 'MeLEA',
      },
      {
        title: '재고현황',
        url: '/mellea/inventory',
        icon: Warehouse,
        badge: 'MeLEA',
      },
      {
        title: '설치팀 창고',
        url: '/mellea/warehouses',
        icon: Warehouse,
      },
    ],
  },

  // ── 멜레아 정산 ──
  {
    title: '멜레아 정산',
    icon: ShieldCheck,
    items: [
      {
        title: '멜레아 내부정산',
        url: '/mellea/billing',
        icon: CreditCard,
      },
      {
        title: '연간 단가표',
        url: '/price-table',
        icon: FileText,
      },
    ],
  },
]

/** 과거 자료 아카이브 메뉴 — 기존 사이트 이전 데이터 (사이드바 맨 하단) */
export const archiveMenuItem: MenuItem = {
  title: '과거 자료 (2020~2025)',
  url: '/archive',
  icon: FolderArchive,
}

/** 하단 설정 메뉴 */
export const settingsMenuItem: MenuItem = {
  title: '설정',
  url: '/settings',
  icon: Settings,
}

/** 관리자 페이지 메뉴 — opendnals123 전용 */
export const serverAdminMenuItem: MenuItem = {
  title: '관리자 페이지',
  url: '/admin/server',
  icon: Server,
}
