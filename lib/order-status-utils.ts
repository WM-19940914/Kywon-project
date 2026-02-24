/**
 * 칸반보드 자동 상태 분류 유틸리티
 *
 * 설치일정 관리 페이지의 상태를 기준으로
 * 칸반보드 컬럼(접수중/진행중/완료/과거내역)을 자동 계산합니다.
 */

import type { Order, OrderStatus } from '@/types/order'

/**
 * 발주 데이터를 기반으로 칸반보드 상태를 자동 계산
 *
 * @param order - 발주 정보
 * @returns OrderStatus - 계산된 칸반 상태
 *
 * 분류 기준 (설치일정 관리 기준):
 * | 칸반 컬럼              | 조건                                              |
 * |-----------------------|-------------------------------------------------|
 * | 과거내역 (settled)     | 에스원 정산완료                                     |
 * | 완료 (completed)      | 설치완료일 있음 (정산 미완료)                         |
 * | 진행중 (in-progress)  | 설치예정일 있음 (설치완료일 없음)                      |
 * | 접수중 (received)     | 일정미정 (설치예정일 없음)                            |
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

  // 2. 설치완료일 있음 → 완료 (금월 정산대기중)
  if (order.installCompleteDate) {
    return 'completed'
  }

  // 3. 설치예정일 있음 → 진행중 (설치예정)
  if (order.installScheduleDate) {
    return 'in-progress'
  }

  // 4. 일정미정 → 접수중
  return 'received'
}
