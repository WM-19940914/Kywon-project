/**
 * 설치일정 관리 페이지
 *
 * 모든 작업종류(신규설치/이전설치/철거보관/철거폐기)의
 * 설치일정을 한눈에 확인하고 관리하는 전용 페이지입니다.
 *
 * 주요 기능:
 * - 설치예정일/완료일 인라인 편집
 * - 작업종류별 뱃지 색상 구분
 * - 신규설치 발주건의 배송상태 함께 확인
 * - 메모 인라인 편집
 */

'use client'

import { useState } from 'react'
import { mockOrders } from '@/lib/mock-data'
import type { Order } from '@/types/order'
import { ScheduleTable } from '@/components/delivery/schedule-table'
import { CalendarCheck } from 'lucide-react'

export default function SchedulePage() {
  // 발주 데이터 (나중에 Supabase로 교체)
  const [orders, setOrders] = useState<Order[]>(mockOrders)

  /**
   * 설치일정 정보 업데이트 핸들러
   * 설치예정일, 설치완료일, 메모 등을 수정합니다.
   */
  const handleUpdateOrder = (orderId: string, updates: Partial<Order>) => {
    setOrders(prev => prev.map(order => {
      if (order.id !== orderId) return order
      return { ...order, ...updates }
    }))
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
          <CalendarCheck className="h-6 w-6" />
          설치일정 관리
        </h1>
        <p className="text-muted-foreground">
          모든 작업종류의 발주건 설치일정을 한눈에 확인하고 관리하세요.
          신규설치 발주건은 배송상태도 함께 확인할 수 있습니다.
        </p>
      </div>

      {/* 설치일정 테이블 */}
      <ScheduleTable
        orders={orders}
        onUpdateOrder={handleUpdateOrder}
      />
    </div>
  )
}
