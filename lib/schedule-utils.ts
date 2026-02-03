/**
 * 설치일정 관련 유틸리티 함수들
 *
 * 설치일정 관리 페이지에서 사용하는 핵심 로직:
 * - 설치일정 상태 판정 (일정미정/설치예정/설치완료)
 * - 긴급도 판정 (지연/오늘/내일/장비미도착)
 * - 장비상태 뱃지 계산
 * - 행 스타일 계산
 */

import type { Order, InstallScheduleStatus } from '@/types/order'
import { getToday, daysDiff } from '@/lib/delivery-utils'

// ──────────────────────────────────────────────────
// 1. 설치일정 상태 판정
// ──────────────────────────────────────────────────

/**
 * 발주건의 설치일정 상태를 자동 판정합니다.
 *
 * 규칙:
 * - installCompleteDate 있음 → 'completed' (설치완료)
 * - installScheduleDate 있음 → 'scheduled' (설치예정)
 * - 둘 다 없음 → 'unscheduled' (일정미정)
 *
 * @param order - 발주 정보
 * @returns 설치일정 상태
 */
export function computeInstallScheduleStatus(order: Order): InstallScheduleStatus {
  if (order.installCompleteDate) return 'completed'
  // status가 in-progress여야 설치예정 탭 (버튼으로 명시적 이동)
  if (order.status === 'in-progress' && order.installScheduleDate) return 'scheduled'
  return 'unscheduled'
}

// ──────────────────────────────────────────────────
// 2. 긴급도 판정 (행 왼쪽 보더 색상용)
// ──────────────────────────────────────────────────

/**
 * 긴급도 타입
 * - overdue: 일정 지연 (설치예정일 지났는데 완료 안 됨)
 * - today: 오늘 설치
 * - tomorrow: 내일 설치
 * - no-equipment: 장비 미도착 (신규설치인데 전체 입고 안 됨)
 * - none: 긴급 아님
 */
export type ScheduleUrgency = 'overdue' | 'today' | 'tomorrow' | 'no-equipment' | 'none'

/**
 * 발주건의 긴급도를 판정합니다.
 *
 * 우선순위:
 * 1. 설치예정일 지남 + 완료 안 됨 → 'overdue'
 * 2. 설치예정일 = 오늘 → 'today'
 * 3. 설치예정일 = 내일 → 'tomorrow'
 * 4. 신규설치 + 장비 전체 입고 안 됨 → 'no-equipment'
 * 5. 그 외 → 'none'
 *
 * @param order - 발주 정보
 * @returns 긴급도 타입
 */
export function getScheduleUrgency(order: Order): ScheduleUrgency {
  const today = getToday()

  // 설치예정일이 있는 경우만 날짜 기반 긴급도 판정
  if (order.installScheduleDate && !order.installCompleteDate) {
    const diff = daysDiff(order.installScheduleDate, today)

    // 설치예정일이 지남 → 지연
    if (diff < 0) return 'overdue'
    // 오늘 설치
    if (diff === 0) return 'today'
    // 내일 설치
    if (diff === 1) return 'tomorrow'
  }

  // 신규설치 + 장비 미도착 판정
  const hasNewInstall = order.items.some(item => item.workType === '신규설치')
  if (hasNewInstall && !order.installCompleteDate) {
    const equipStatus = getEquipmentStatusInfo(order)
    if (equipStatus.type !== 'all-delivered' && equipStatus.type !== 'not-applicable') {
      return 'no-equipment'
    }
  }

  return 'none'
}

/**
 * 긴급도별 행 스타일 (왼쪽 보더 + 배경색)
 */
export const URGENCY_ROW_STYLES: Record<ScheduleUrgency, string> = {
  'overdue': 'border-l-4 border-l-red-500 bg-red-50/50',
  'today': 'border-l-4 border-l-orange-400 bg-orange-50/50',
  'tomorrow': 'border-l-4 border-l-blue-400 bg-blue-50/30',
  'no-equipment': 'border-l-4 border-l-yellow-400 bg-yellow-50/30',
  'none': '',
}

// ──────────────────────────────────────────────────
// 3. 장비상태 뱃지 계산
// ──────────────────────────────────────────────────

/**
 * 장비상태 정보 타입
 * - not-applicable: 신규설치 아님 (뱃지: '-')
 * - no-items: 구성품 미등록 (뱃지: '미등록')
 * - partial: 일부 입고 (뱃지: '2/4 입고')
 * - all-delivered: 전체 입고 (뱃지: '입고완료')
 */
export type EquipmentStatusType = 'not-applicable' | 'no-items' | 'partial' | 'all-delivered'

export interface EquipmentStatusInfo {
  type: EquipmentStatusType
  label: string        // 뱃지 텍스트
  colorClass: string   // 뱃지 색상 클래스
}

/**
 * 발주건의 장비상태 정보를 계산합니다.
 *
 * 규칙:
 * 1. 신규설치가 없으면 → '-' (회색)
 * 2. 신규설치인데 구성품 미등록 → '미등록' (빨간)
 * 3. 구성품 있고 일부만 입고(confirmed) → 'n/전체 입고' (주황)
 * 4. 전체 입고(confirmed) → '입고완료' (초록)
 *
 * @param order - 발주 정보
 * @returns 장비상태 정보
 */
export function getEquipmentStatusInfo(order: Order): EquipmentStatusInfo {
  // 신규설치 작업이 있는지 확인
  const hasNewInstall = order.items.some(item => item.workType === '신규설치')

  if (!hasNewInstall) {
    return {
      type: 'not-applicable',
      label: '-',
      colorClass: 'text-gray-400',
    }
  }

  // 구성품 확인
  const items = order.equipmentItems || []
  if (items.length === 0) {
    return {
      type: 'no-items',
      label: '미등록',
      colorClass: 'bg-red-50 text-red-700 border-red-200',
    }
  }

  // 입고 완료 수 (confirmed = 배송확정일 입력됨)
  const confirmedCount = items.filter(item => item.confirmedDeliveryDate).length
  const total = items.length

  if (confirmedCount >= total) {
    return {
      type: 'all-delivered',
      label: '입고완료',
      colorClass: 'bg-green-50 text-green-700 border-green-200',
    }
  }

  return {
    type: 'partial',
    label: `${confirmedCount}/${total} 입고`,
    colorClass: 'bg-orange-50 text-orange-700 border-orange-200',
  }
}

// ──────────────────────────────────────────────────
// 4. 필터링 + 정렬
// ──────────────────────────────────────────────────

/**
 * 설치일정 대상 발주 필터링
 * 정산완료(settled) 건은 제외
 *
 * @param orders - 전체 발주 목록
 * @param status - 필터할 설치일정 상태
 * @returns 필터된 발주 목록
 */
export function filterOrdersByScheduleStatus(
  orders: Order[],
  status: InstallScheduleStatus
): Order[] {
  return orders.filter(order => {
    // 정산완료 건은 설치일정에서 제외 (완료탭에서는 보여줌)
    if (status !== 'completed' && order.status === 'settled') return false

    return computeInstallScheduleStatus(order) === status
  })
}

/**
 * 탭별 정렬 적용
 *
 * - 일정미정: 발주등록일 오름차순 (오래된 것 위)
 * - 설치예정: 설치예정일 오름차순 (가까운 것 위)
 * - 설치완료: 설치완료일 내림차순 (최근 완료 위)
 *
 * @param orders - 정렬할 발주 목록
 * @param status - 현재 탭 상태
 * @returns 정렬된 발주 목록
 */
export function sortOrdersByScheduleTab(
  orders: Order[],
  status: InstallScheduleStatus
): Order[] {
  const sorted = [...orders]

  switch (status) {
    case 'unscheduled':
      // 발주등록일 내림차순 (최신이 위)
      sorted.sort((a, b) => {
        const dateA = a.orderDate || '0000-00-00'
        const dateB = b.orderDate || '0000-00-00'
        return dateB.localeCompare(dateA)
      })
      break

    case 'scheduled':
      // 설치예정일 오름차순 (가까운 것 위)
      sorted.sort((a, b) => {
        const dateA = a.installScheduleDate || '9999-12-31'
        const dateB = b.installScheduleDate || '9999-12-31'
        return dateA.localeCompare(dateB)
      })
      break

    case 'completed':
      // 설치완료일 내림차순 (최근 완료 위)
      sorted.sort((a, b) => {
        const dateA = a.installCompleteDate || '0000-00-00'
        const dateB = b.installCompleteDate || '0000-00-00'
        return dateB.localeCompare(dateA)
      })
      break
  }

  return sorted
}
