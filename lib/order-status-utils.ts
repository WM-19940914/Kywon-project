/**
 * 칸반보드 자동 상태 분류 유틸리티
 *
 * 발주의 배송/설치/정산 데이터를 기반으로
 * 칸반보드 컬럼(접수중/진행중/완료/과거내역)을 자동 계산합니다.
 * 수동으로 status를 변경할 필요 없이, 다른 페이지의 데이터가 바뀌면 자동 반영!
 */

import type { Order, OrderStatus } from '@/types/order'

/**
 * 발주 데이터를 기반으로 칸반보드 상태를 자동 계산
 *
 * @param order - 발주 정보
 * @returns OrderStatus - 계산된 칸반 상태
 *
 * 분류 기준:
 * | 칸반 컬럼              | 조건                                                    |
 * |-----------------------|--------------------------------------------------------|
 * | 과거내역 (settled)     | 에스원 정산완료 (s1SettlementStatus === 'settled')        |
 * | 완료 (completed)      | 설치완료 + 정산 미완료                                    |
 * | 진행중 (in-progress)  | 배송 진행중 OR 설치예정일 있고 설치완료일 없음               |
 * | 접수중 (received)     | 위 조건 모두 해당 없음 (기본값)                            |
 */
export function computeKanbanStatus(order: Order): OrderStatus {
  // 0. 발주취소 → 취소 컬럼
  if (order.status === 'cancelled') {
    return 'cancelled'
  }

  // 1. 정산완료 → 과거내역
  if (order.s1SettlementStatus === 'settled') {
    return 'settled'
  }

  // 2. 설치완료 + 정산 미완료 → 완료 (금월 정산대기중)
  if (order.installCompleteDate) {
    return 'completed'
  }

  // 3. 배송 진행중 OR 설치예정일 있음 → 진행중
  if (
    order.deliveryStatus === 'ordered' ||
    order.installScheduleDate
  ) {
    return 'in-progress'
  }

  // 4. 나머지 → 접수중
  return 'received'
}
