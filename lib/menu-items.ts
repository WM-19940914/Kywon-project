/**
 * 사이드바 메뉴 구조 정의
 *
 * 역할(사용자 그룹) 기준으로 메뉴를 분류합니다.
 * - 교원그룹: 발주/AS 관리
 * - 교원·멜레아: 정산 관리
 * - 멜레아·에스원: 배송/설치비 관리
 * - 공통 정보: 단가표, 재고 관리
 */

import {
  Home,           // 대시보드
  ClipboardList,  // 발주 관리
  Wrench,         // AS 관리
  CreditCard,     // 정산 관리
  FileText,       // 단가표
  Truck,          // 배송 관리
  Warehouse,      // 재고 관리
  Archive,        // 철거 보관
  CalendarCheck,  // 설치일정 관리
  Receipt,        // 에스원 정산관리
  Settings        // 설정
} from 'lucide-react'
import { LucideIcon } from 'lucide-react'

/** 메뉴 아이템 타입 */
export interface MenuItem {
  title: string        // 메뉴 이름
  url: string          // 이동할 페이지 주소
  icon: LucideIcon     // 아이콘
  disabled?: boolean   // 미구현 메뉴 여부 (true면 클릭 불가 + "준비중" 표시)
}

/** 메뉴 그룹 타입 */
export interface MenuGroup {
  title: string        // 그룹 이름
  items: MenuItem[]    // 메뉴 아이템 목록
}

/**
 * 메뉴 데이터
 * 역할(사용자 그룹) 기준으로 분류
 */
export const menuItems: MenuGroup[] = [
  // ── 대시보드 (최상단 단독) ──
  {
    title: '',
    items: [
      {
        title: '대시보드',
        url: '/',
        icon: Home,
      },
    ],
  },

  // ── 교원그룹 ──
  {
    title: '교원그룹',
    items: [
      {
        title: '발주 관리',
        url: '/orders',
        icon: ClipboardList,
      },
      {
        title: 'AS 관리',
        url: '/as',
        icon: Wrench,
        disabled: true,
      },
    ],
  },

  // ── 교원 · 멜레아 ──
  {
    title: '교원 · 멜레아',
    items: [
      {
        title: '정산 관리',
        url: '/settlements',
        icon: CreditCard,
      },
    ],
  },

  // ── 멜레아 · 에스원 ──
  {
    title: '멜레아 · 에스원',
    items: [
      {
        title: '설치 관리/견적 관리',
        url: '/mellea/schedule',
        icon: CalendarCheck,
      },
      {
        title: '에스원 정산관리',
        url: '/mellea/s1-settlement',
        icon: Receipt,
      },
      {
        title: '배송 관리',
        url: '/mellea/delivery',
        icon: Truck,
      },
      {
        title: '재고 관리',
        url: '/mellea/inventory',
        icon: Warehouse,
      },
      {
        title: '철거 보관',
        url: '/mellea/stored-equipment',
        icon: Archive,
      },
    ],
  },

  // ── 공통 정보 ──
  {
    title: '공통 정보',
    items: [
      {
        title: '연간 단가표',
        url: '/price-table',
        icon: FileText,
      },
      {
        title: '전국 설치팀 창고',
        url: '/mellea/warehouses',
        icon: Warehouse,
      },
    ],
  },
  // ── 멜레아 전용 ──
  {
    title: '멜레아 전용',
    items: [
      {
        title: '정산하러가기',
        url: '/mellea/billing',
        icon: CreditCard,
        disabled: true,
      },
    ],
  },
]

/** 하단 설정 메뉴 */
export const settingsMenuItem: MenuItem = {
  title: '설정',
  url: '/settings',
  icon: Settings,
}
