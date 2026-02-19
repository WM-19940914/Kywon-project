/**
 * URL 경로별 역할 접근 제어
 *
 * 각 URL 패턴에 접근 가능한 역할 목록을 정의합니다.
 * 미들웨어에서 사용자 역할을 확인한 뒤, 이 매핑으로 접근 차단 여부를 판단합니다.
 *
 * ROLE_MENU_ACCESS (roles.ts)의 메뉴 그룹 → URL 매핑 기반입니다.
 */

import type { UserRole } from './roles'

/**
 * URL 패턴 → 허용 역할 매핑
 *
 * 패턴 규칙:
 * - 정확한 경로 (예: '/orders') 또는
 * - 와일드카드 접두사 (예: '/mellea/' → /mellea/로 시작하는 모든 경로)
 * - 배열 앞부터 순서대로 검사하며, 첫 매칭 규칙 적용
 */
interface RouteRule {
  pattern: string       // URL 패턴 ('/mellea/' 형태면 startsWith로 매칭)
  roles: UserRole[]     // 접근 허용 역할
}

const routeRules: RouteRule[] = [
  // ── 대시보드 — 모든 역할 접근 가능 ──
  { pattern: '/',        roles: ['admin', 'melea', 's1eng', 'kyowon', 'affiliate'] },

  // ── 관리자 전용 ──
  { pattern: '/admin/',  roles: ['admin'] },
  { pattern: '/settings', roles: ['admin', 'melea'] },

  // ── 교원그룹: admin, melea, kyowon, affiliate ──
  { pattern: '/orders',                  roles: ['admin', 'melea', 's1eng', 'kyowon', 'affiliate'] },
  { pattern: '/as',                      roles: ['admin', 'melea', 'kyowon', 'affiliate'] },
  { pattern: '/kyowon/stored-equipment', roles: ['admin', 'melea', 'kyowon', 'affiliate'] },
  { pattern: '/kyowon/price-table',      roles: ['admin', 'melea', 'kyowon', 'affiliate'] },

  // ── 교원 · 멜레아: admin, melea, kyowon ──
  { pattern: '/settlements',       roles: ['admin', 'melea', 'kyowon'] },
  { pattern: '/kyowon/prepurchase', roles: ['admin', 'melea', 'kyowon'] },

  // ── 멜레아 · 에스원: admin, melea, s1eng ──
  { pattern: '/mellea/schedule',          roles: ['admin', 'melea', 's1eng'] },
  { pattern: '/mellea/s1-settlement',     roles: ['admin', 'melea', 's1eng'] },
  { pattern: '/mellea/delivery',          roles: ['admin', 'melea', 's1eng'] },
  { pattern: '/mellea/inventory',         roles: ['admin', 'melea', 's1eng'] },
  { pattern: '/mellea/stored-equipment',  roles: ['admin', 'melea', 's1eng'] },
  { pattern: '/mellea/warehouses',        roles: ['admin', 'melea', 's1eng'] },

  // ── 멜레아 전용: admin, melea ──
  { pattern: '/price-table',    roles: ['admin', 'melea'] },
  { pattern: '/mellea/billing', roles: ['admin', 'melea'] },

  // ── 과거 자료: 모든 역할 ──
  { pattern: '/archive', roles: ['admin', 'melea', 's1eng', 'kyowon', 'affiliate'] },
]

/**
 * 주어진 경로에 해당 역할이 접근 가능한지 확인
 *
 * @param pathname - 요청 URL 경로 (예: '/mellea/billing')
 * @param role - 사용자 역할 (예: 's1eng')
 * @returns true면 접근 허용, false면 차단
 */
export function isRouteAllowed(pathname: string, role: UserRole): boolean {
  for (const rule of routeRules) {
    // 패턴이 '/'로 끝나면 접두사 매칭 (와일드카드)
    if (rule.pattern.endsWith('/') && pathname.startsWith(rule.pattern)) {
      return rule.roles.includes(role)
    }
    // 정확한 매칭 또는 하위 경로 매칭 (/orders → /orders/123도 허용)
    if (pathname === rule.pattern || pathname.startsWith(rule.pattern + '/')) {
      return rule.roles.includes(role)
    }
  }

  // 매칭되는 규칙이 없으면 허용 (로그인 페이지 등 공개 경로)
  return true
}
