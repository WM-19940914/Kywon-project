/**
 * 사이드바 메뉴 구조 정의
 *
 * 이 파일은 왼쪽 사이드바에 표시될 메뉴 항목들을 정의합니다.
 * 마치 식당 메뉴판처럼 "어떤 페이지들이 있는지" 목록을 만드는 거예요.
 *
 * 메뉴 구조:
 * - 대시보드 (단독 메뉴)
 * - 핵심 기능: 발주 관리, AS 관리
 * - 부가 기능: 지점 관리, 장비 관리, 업체 관리
 * - 정산: 정산 관리
 * - 연간 단가표 (독립 섹션)
 * - 멜레아 관리: 배송관리, 정산관리
 */

import {
  Home,           // 대시보드
  ClipboardList,  // 발주 관리
  Wrench,         // AS 관리
  MapPin,         // 지점 관리
  Package,        // 장비 관리
  Users,          // 업체 관리
  CreditCard,     // 정산 관리
  FileText,       // 단가표
  Truck,          // 배송 관리
  Warehouse,      // 창고 관리
  Settings        // 설정
} from 'lucide-react'
import { LucideIcon } from 'lucide-react'

// 메뉴 아이템의 타입 정의 (어떤 정보를 담을지 설계도를 그리는 것)
export interface MenuItem {
  title: string        // 메뉴 이름 (예: "발주 목록")
  url: string         // 이동할 페이지 주소 (예: "/orders")
  icon: LucideIcon    // 아이콘 (예: 📝)
}

// 메뉴 그룹의 타입 정의
export interface MenuGroup {
  title: string       // 그룹 이름 (예: "발주 관리")
  items: MenuItem[]   // 이 그룹에 속한 메뉴 아이템들
}

/**
 * 실제 메뉴 데이터
 *
 * 교원그룹 지점 관리에 최적화된 메뉴 구조
 * - 핵심: 발주/AS 관리 (매일 사용하는 메인 기능)
 * - 부가: 지점/장비/업체 관리 (참조용, 통계용)
 * - 정산: 월말 정산 관리
 * - 연간 단가표: 단가표 조회
 * - 멜레아 관리: 배송/정산 관리
 */
export const menuItems: MenuGroup[] = [
  // ==========================================
  // 대시보드 (단독 메뉴)
  // ==========================================
  {
    title: '홈',
    items: [
      {
        title: '대시보드',
        url: '/',
        icon: Home  // 🏠 홈 아이콘
      }
    ]
  },

  // ==========================================
  // 핵심 기능 (발주, AS)
  // ==========================================
  {
    title: '핵심 기능',
    items: [
      {
        title: '발주 관리',
        url: '/orders',
        icon: ClipboardList  // 📋 발주 관리 (목록 + 등록 통합)
      },
      {
        title: 'AS 관리',
        url: '/as',
        icon: Wrench  // 🔧 AS 관리 (목록 + 등록 통합)
      }
    ]
  },

  // ==========================================
  // 부가 기능 (지점, 장비, 업체)
  // ==========================================
  {
    title: '부가 기능',
    items: [
      {
        title: '지점 관리',
        url: '/branches',
        icon: MapPin  // 📍 지점 (발주 시 자동 생성)
      },
      {
        title: '장비 관리',
        url: '/equipment',
        icon: Package  // 📦 장비
      },
      {
        title: '업체 관리',
        url: '/contractors',
        icon: Users  // 👷 시공업체
      }
    ]
  },

  // ==========================================
  // 정산 관리
  // ==========================================
  {
    title: '정산',
    items: [
      {
        title: '정산 관리',
        url: '/settlements',
        icon: CreditCard  // 💳 정산
      }
    ]
  },

  // ==========================================
  // 연간 단가표 (독립 섹션)
  // ==========================================
  {
    title: '연간 단가표',
    items: [
      {
        title: '연간 단가표',
        url: '/price-table',
        icon: FileText  // 📄 단가표
      }
    ]
  },

  // ==========================================
  // 멜레아 관리
  // ==========================================
  {
    title: '멜레아 관리',
    items: [
      {
        title: '배송관리',
        url: '/mellea/delivery',
        icon: Truck  // 🚚 배송
      },
      {
        title: '창고관리',
        url: '/mellea/warehouses',
        icon: Warehouse  // 🏭 창고
      },
      {
        title: '정산관리',
        url: '/mellea/settlements',
        icon: CreditCard  // 💳 정산
      }
    ]
  }
]

/**
 * 하단 설정 메뉴
 *
 * 사이드바 맨 아래에 표시될 설정 메뉴입니다.
 * 나중에 사용자 프로필, 로그아웃 등이 추가될 수 있어요.
 */
export const settingsMenuItem: MenuItem = {
  title: '설정',
  url: '/settings',
  icon: Settings  // ⚙️ 톱니바퀴 아이콘
}
