/**
 * 역할(Role) 시스템 — 사용자 역할 정의 + 메뉴 접근 권한
 *
 * 각 사용자는 하나의 역할(role)을 가지며,
 * 역할에 따라 사이드바에 보이는 메뉴가 달라집니다.
 *
 * 비유: "직원 ID카드에 적힌 직급"에 따라 출입 가능한 층이 다른 것처럼,
 *       역할에 따라 접근 가능한 메뉴가 다릅니다.
 */

/** 사용자 역할 타입 */
export type UserRole = 'admin' | 'melea' | 's1eng' | 'kyowon' | 'affiliate'

/** 역할별 한글 라벨 */
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: '관리자',
  melea: '멜레아',
  s1eng: '에스원이엔지',
  kyowon: '교원그룹',
  affiliate: '계열사',
}

/**
 * 역할별 메뉴 그룹 접근 권한
 *
 * 메뉴 그룹 title(사이드바에 보이는 그룹명)을 키로 사용합니다.
 * true면 해당 그룹의 메뉴가 보이고, false면 안 보입니다.
 *
 * | 메뉴 그룹       | admin | melea | s1eng | kyowon | affiliate |
 * |----------------|-------|-------|-------|--------|-----------|
 * | 대시보드 ('')    | O     | O     | O     | O      | O         |
 * | 교원그룹         | O     | O     | X     | O      | O         |
 * | 교원 · 멜레아    | O     | O     | X     | O      | X         |
 * | 멜레아 · 에스원  | O     | O     | O     | X      | X         |
 * | 멜레아 전용      | O     | O     | X     | X      | X         |
 */
export const ROLE_MENU_ACCESS: Record<UserRole, Record<string, boolean>> = {
  admin: {
    '': true,           // 대시보드
    '교원그룹': true,
    '교원 · 멜레아': true,
    '멜레아 · 에스원': true,
    '멜레아 전용': true,
  },
  melea: {
    '': true,
    '교원그룹': true,
    '교원 · 멜레아': true,
    '멜레아 · 에스원': true,
    '멜레아 전용': true,
  },
  s1eng: {
    '': true,
    '교원그룹': true,
    '교원 · 멜레아': false,
    '멜레아 · 에스원': true,
    '멜레아 전용': false,
  },
  kyowon: {
    '': true,
    '교원그룹': true,
    '교원 · 멜레아': true,
    '멜레아 · 에스원': false,
    '멜레아 전용': false,
  },
  affiliate: {
    '': true,
    '교원그룹': true,
    '교원 · 멜레아': false,
    '멜레아 · 에스원': false,
    '멜레아 전용': false,
  },
}

/** 사용자 프로필 인터페이스 — user_profiles 테이블과 1:1 대응 */
export interface UserProfile {
  id: string           // auth.users의 UUID
  username: string     // 로그인 아이디 (예: opendnals123)
  displayName: string  // 화면에 표시될 이름 (예: 관리자)
  role: UserRole       // 역할
  affiliateName?: string // 계열사명 (affiliate 역할일 때만)
}
