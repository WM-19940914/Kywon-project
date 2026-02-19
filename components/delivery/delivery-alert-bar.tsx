/**
 * 배송 알림 바 컴포넌트
 *
 * 테이블 상단에 가로 한 줄로 배송 긴급 알림을 표시합니다.
 * - 배송지연 (빨강): 배송예정일이 지났는데 입고 안 됨
 * - 오늘입고 (주황): 오늘 입고 예정
 * - 내일입고 (파랑): 내일 입고 예정
 *
 * 클릭 시 해당 상태로 테이블 필터링
 * 알림이 하나도 없으면 숨김 처리
 */

'use client'

import { AlertCircle, Clock, CalendarClock } from 'lucide-react'
import type { Order } from '@/types/order'
import { getAlertType, type AlertType } from '@/lib/delivery-utils'

interface DeliveryAlertBarProps {
  orders: Order[]                              // 전체 배송 대상 발주 목록
  onAlertClick?: (alertType: AlertType) => void // 알림 클릭 시 필터 적용
  activeAlert?: AlertType | null               // 현재 활성화된 알림 필터
}

export function DeliveryAlertBar({ orders, onAlertClick, activeAlert }: DeliveryAlertBarProps) {
  // 각 알림 유형별 건수 계산
  const alertCounts = orders.reduce((acc, order) => {
    const alertType = getAlertType(order)
    if (alertType !== 'none') {
      acc[alertType] = (acc[alertType] || 0) + 1
    }
    return acc
  }, {} as Record<AlertType, number>)

  const delayedCount = alertCounts['delayed'] || 0
  const todayCount = alertCounts['today'] || 0
  const tomorrowCount = alertCounts['tomorrow'] || 0

  // 알림이 하나도 없으면 표시하지 않음
  if (delayedCount === 0 && todayCount === 0 && tomorrowCount === 0) {
    return null
  }

  /**
   * 알림 아이템 클릭 핸들러
   * 이미 선택된 알림을 다시 클릭하면 필터 해제
   */
  const handleClick = (type: AlertType) => {
    if (activeAlert === type) {
      onAlertClick?.(null as unknown as AlertType)
    } else {
      onAlertClick?.(type)
    }
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-white border rounded-lg mb-4">
      {/* 배송지연 알림 */}
      {delayedCount > 0 && (
        <button
          onClick={() => handleClick('delayed')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all
            ${activeAlert === 'delayed'
              ? 'bg-brick-100 text-brick-800 ring-2 ring-brick-300'
              : 'bg-brick-50 text-brick-700 hover:bg-brick-100'
            }`}
        >
          <AlertCircle className="h-4 w-4" />
          배송지연 {delayedCount}건
        </button>
      )}

      {/* 오늘 입고 알림 */}
      {todayCount > 0 && (
        <button
          onClick={() => handleClick('today')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all
            ${activeAlert === 'today'
              ? 'bg-carrot-100 text-carrot-800 ring-2 ring-carrot-300'
              : 'bg-carrot-50 text-carrot-700 hover:bg-carrot-100'
            }`}
        >
          <Clock className="h-4 w-4" />
          오늘입고 {todayCount}건
        </button>
      )}

      {/* 내일 입고 알림 */}
      {tomorrowCount > 0 && (
        <button
          onClick={() => handleClick('tomorrow')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all
            ${activeAlert === 'tomorrow'
              ? 'bg-teal-100 text-teal-800 ring-2 ring-teal-300'
              : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
            }`}
        >
          <CalendarClock className="h-4 w-4" />
          내일입고 {tomorrowCount}건
        </button>
      )}

      {/* 활성 필터 해제 버튼 */}
      {activeAlert && (
        <button
          onClick={() => onAlertClick?.(null as unknown as AlertType)}
          className="ml-auto text-xs text-gray-500 hover:text-gray-700 underline"
        >
          필터 해제
        </button>
      )}
    </div>
  )
}
