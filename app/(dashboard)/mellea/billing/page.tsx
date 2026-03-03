/**
 * 멜레아 정산 페이지
 *
 * 이 페이지의 역할:
 * - 멜레아 정산 업무 화면에서 월 단위 데이터를 확인하는 메인 진입점입니다.
 * - 현재는 사용자 요청으로 "지출결의서 탭"을 제거한 상태이며,
 *   "배송 및 매입내역", "정산관리" 2개 탭만 제공합니다.
 *
 * 왜 이렇게 구성했는지:
 * - 지출결의서는 자동 생성보다 수동 작성/검토 방식이 더 적합하다는 운영 결정이 있었기 때문입니다.
 * - 따라서 이 화면에서는 지출결의서 기능 진입 자체를 막아 혼선이 없도록 합니다.
 */

'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { fetchOrders } from '@/lib/supabase/dal'
import type { Order } from '@/types/order'
import { Skeleton } from '@/components/ui/skeleton'
import { CreditCard, ShoppingCart, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react'
import { SamsungPurchaseTab } from '@/components/billing/samsung-purchase-tab'
import { MonthlySummaryTab } from '@/components/billing/monthly-summary-tab'

/**
 * 페이지에서 허용하는 탭 타입
 * - 지출결의서는 제거했기 때문에 타입에서도 제외합니다.
 * - 타입에서 막아두면 실수로 탭 분기 코드를 다시 넣을 때 컴파일 단계에서 감지할 수 있습니다.
 */
type BillingTab = 'samsung-purchase' | 'monthly-summary'

/**
 * 상단 탭 설정
 * - key: 탭 상태값
 * - label: 버튼 텍스트
 * - icon: 표시 아이콘
 */
const TAB_CONFIG: { key: BillingTab; label: string; icon: React.ReactNode }[] = [
  { key: 'samsung-purchase', label: '배송 및 매입내역', icon: <ShoppingCart className="h-4 w-4" /> },
  { key: 'monthly-summary', label: '정산관리', icon: <BarChart3 className="h-4 w-4" /> },
]

export default function MelleaBillingPage() {
  // 페이지 데이터 로딩 상태
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchOrders().then(data => {
      setOrders(data)
      setIsLoading(false)
    })
  }, [])

  // 기본 진입 탭: 배송/매입내역
  const [activeTab, setActiveTab] = useState<BillingTab>('samsung-purchase')

  // 월 선택 상태 (현재 월 기준)
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)

  /**
   * 이전 달 이동
   * - 1월이면 전년도 12월로 이동합니다.
   */
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear(y => y - 1)
      setSelectedMonth(12)
    } else {
      setSelectedMonth(m => m - 1)
    }
  }

  /**
   * 다음 달 이동
   * - 12월이면 다음년도 1월로 이동합니다.
   */
  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear(y => y + 1)
      setSelectedMonth(1)
    } else {
      setSelectedMonth(m => m + 1)
    }
  }

  /**
   * 선택 월 기준 정산 대상 발주 필터
   *
   * 필터 조건:
   * 1) 취소 건 제외
   * 2) S1 정산상태가 unsettled(미정산)인 건 제외
   * 3) 선택한 년/월과 정산 월이 일치하는 건만 포함
   *
   * 날짜 기준 우선순위:
   * - order.s1SettlementMonth가 있으면 그 값을 우선 사용
   * - 없으면 installCompleteDate(설치완료일)의 YYYY-MM을 사용
   */
  const filteredOrders = useMemo(() => {
    const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`

    return orders.filter(order => {
      if (order.status === 'cancelled') return false

      const s1Status = order.s1SettlementStatus || 'unsettled'
      if (s1Status === 'unsettled') return false

      const orderMonth = order.s1SettlementMonth
        || (order.installCompleteDate ? order.installCompleteDate.substring(0, 7) : null)

      return orderMonth === monthKey
    })
  }, [orders, selectedYear, selectedMonth])

  return (
    <div className="container mx-auto max-w-[1400px] py-6 px-4 md:px-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-carrot-50 text-carrot-600 p-2.5 rounded-xl">
          <CreditCard className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">멜레아 정산</h1>
          <p className="text-muted-foreground mt-0.5">배송 및 매입내역과 정산관리 데이터를 월별로 확인합니다.</p>
        </div>
      </div>

      {/* 월 선택기 */}
      <div className="flex justify-center mb-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-3 flex items-center gap-4">
          <span className="text-xs text-slate-500 font-medium">정산 기준월</span>
          <button
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
            onClick={handlePrevMonth}
          >
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>
          <h2 className="text-xl font-bold text-slate-900 min-w-[140px] text-center">
            {selectedYear}년 {selectedMonth}월
          </h2>
          <button
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
            onClick={handleNextMonth}
          >
            <ChevronRight className="h-5 w-5 text-slate-600" />
          </button>
        </div>
      </div>

      {/* 탭 */}
      <div className="border-b border-slate-200 mb-6">
        <div className="flex items-center gap-1 -mb-px">
          {TAB_CONFIG.map(tab => {
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                className={active
                  ? 'border-b-2 border-carrot-500 text-carrot-600 font-semibold pb-3 px-4 text-sm flex items-center gap-2'
                  : 'text-slate-500 hover:text-slate-700 pb-3 px-4 text-sm flex items-center gap-2'
                }
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.icon}
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 로딩 스켈레톤 */}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <Skeleton className="h-4 w-20 mb-3" />
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-4 p-4 border-b border-slate-100">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32 flex-1" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 탭 콘텐츠 */}
      {!isLoading && (
        <>
          {activeTab === 'samsung-purchase' && (
            <SamsungPurchaseTab orders={filteredOrders} selectedYear={selectedYear} selectedMonth={selectedMonth} />
          )}
          {activeTab === 'monthly-summary' && (
            <MonthlySummaryTab orders={filteredOrders} selectedYear={selectedYear} selectedMonth={selectedMonth} />
          )}
        </>
      )}
    </div>
  )
}
