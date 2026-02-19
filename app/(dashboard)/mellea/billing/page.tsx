/**
 * 멜레아 정산 페이지
 *
 * 멜레아 입장에서 한 달의 전체 돈 흐름을 정리합니다.
 * - 탭1: 지출결의서 (발주건별 매출/매입/설치비/마진 상세)
 * - 탭2: 삼성매입 (삼성에서 구매한 구성품 상세)
 * - 탭3: 정산관리 (월별 매출/매입/설치비/순이익 요약 카드)
 *
 * 데이터 기준: 에스원 정산 '진행중' 이상 + 설치완료일/정산월 기준 필터
 */

'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { fetchOrders } from '@/lib/supabase/dal'
import type { Order } from '@/types/order'
import { Skeleton } from '@/components/ui/skeleton'
import { CreditCard, FileText, ShoppingCart, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react'
// CreditCard는 페이지 헤더 아이콘에 사용
import { DetailedExpenseReportTab } from '@/components/billing/detailed-expense-report-tab'
import { SamsungPurchaseTab } from '@/components/billing/samsung-purchase-tab'
import { MonthlySummaryTab } from '@/components/billing/monthly-summary-tab'

/** 탭 정의 */
type BillingTab = 'expense-report' | 'samsung-purchase' | 'monthly-summary'

const TAB_CONFIG: { key: BillingTab; label: string; icon: React.ReactNode }[] = [
  { key: 'expense-report', label: '지출결의서', icon: <FileText className="h-4 w-4" /> },
  { key: 'samsung-purchase', label: '배송 및 매입내역', icon: <ShoppingCart className="h-4 w-4" /> },
  { key: 'monthly-summary', label: '정산관리', icon: <BarChart3 className="h-4 w-4" /> },
]

/**
 * 발주 1건의 멜레아 정산 금액 계산
 *
 * - 매출(sales): 교원이 멜레아에 지불하는 금액 (VAT 포함 최종금액)
 * - 삼성매입비(samsungPurchase): 멜레아가 삼성에 지불하는 구성품 매입비
 * - 에스원설치비(installCost): 멜레아가 에스원에 지불하는 설치비 (견적서 기준)
 * - 마진(margin): 매출 - 삼성매입비 - 에스원설치비
 */
function calcBillingAmounts(order: Order) {
  // ─── 매출 계산 (교원→멜레아, settlements 페이지의 calcOrderAmounts 로직 복사) ───
  const quote = order.customerQuote
  const equipItems = quote?.items?.filter(i => i.category === 'equipment') || []
  const installItems = quote?.items?.filter(i => i.category === 'installation') || []
  const notesStr = quote?.notes || ''
  const equipRoundMatch = notesStr.match(/장비비절사:\s*([\d,]+)/)
  const installRoundMatch = notesStr.match(/설치비절사:\s*([\d,]+)/)
  const equipRounding = equipRoundMatch ? parseInt(equipRoundMatch[1].replace(/,/g, '')) : 0
  const installRounding = installRoundMatch ? parseInt(installRoundMatch[1].replace(/,/g, '')) : 0
  const equipSubtotal = equipItems.reduce((s, i) => s + i.totalPrice, 0) - equipRounding
  const installSubtotal = installItems.reduce((s, i) => s + i.totalPrice, 0) - installRounding
  const supplyAmount = equipSubtotal + installSubtotal
  const rawInstallTotal = installItems.reduce((s, i) => s + i.totalPrice, 0)
  const rawProfit = Math.round(rawInstallTotal * 0.03)
  const rawSubtotal = supplyAmount + rawProfit
  const subtotalWithProfit = Math.floor(rawSubtotal / 1000) * 1000
  const adjustedProfit = subtotalWithProfit - supplyAmount
  const vat = Math.round(subtotalWithProfit * 0.1)
  const grandTotal = subtotalWithProfit + vat

  // ─── 삼성 매입비 (멜레아→삼성: equipmentItems의 totalPrice 합산) ───
  const eqItems = order.equipmentItems || []
  const samsungPurchase = eqItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0)
  const hasSamsungData = eqItems.some(item => item.totalPrice != null && item.totalPrice > 0)

  // ─── 에스원 설치비 (멜레아→에스원: 견적서 설치비 - 설치비절사) ───
  const installCost = installSubtotal

  // ─── 마진 (매출 - 삼성매입 - 에스원설치비) ───
  const margin = grandTotal - samsungPurchase - installCost

  return {
    // 매출 관련
    sales: grandTotal,
    equipSubtotal,
    installSubtotal,
    supplyAmount,
    adjustedProfit,
    subtotalWithProfit,
    vat,
    // 매입/설치비
    samsungPurchase,
    hasSamsungData,
    installCost,
    // 마진
    margin,
    // 절사 정보
    equipRounding,
    installRounding,
  }
}

export default function MelleaBillingPage() {
  // 데이터 로딩
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchOrders().then(data => {
      setOrders(data)
      setIsLoading(false)
    })
  }, [])

  // 현재 탭
  const [activeTab, setActiveTab] = useState<BillingTab>('expense-report')

  // 월 선택기 상태
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)

  /** 월 이동 */
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear(y => y - 1)
      setSelectedMonth(12)
    } else {
      setSelectedMonth(m => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear(y => y + 1)
      setSelectedMonth(1)
    } else {
      setSelectedMonth(m => m + 1)
    }
  }

  /**
   * 정산 대상 필터링
   * - 취소 건 제외
   * - 에스원 정산 '진행중' 이상만 (unsettled 제외)
   * - 선택한 월과 매칭 (정산월 또는 설치완료일 기준)
   */
  const filteredOrders = useMemo(() => {
    const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`

    return orders.filter(order => {
      if (order.status === 'cancelled') return false
      // 에스원 정산 진행중 이상만
      const s1Status = order.s1SettlementStatus || 'unsettled'
      if (s1Status === 'unsettled') return false
      // 월 매칭
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
          <p className="text-muted-foreground mt-0.5">매출 · 삼성매입 · 에스원설치비 · 마진을 한 곳에서 확인합니다.</p>
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

      {/* 탭 (border-b 스타일) */}
      <div className="border-b border-slate-200 mb-6">
        <div className="flex items-center gap-1 -mb-px">
          {TAB_CONFIG.map(tab => {
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                className={active
                  ? "border-b-2 border-carrot-500 text-carrot-600 font-semibold pb-3 px-4 text-sm flex items-center gap-2"
                  : "text-slate-500 hover:text-slate-700 pb-3 px-4 text-sm flex items-center gap-2"
                }
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.icon}
                {tab.label}
                {/* 지출결의서 탭에만 건수 표시 */}
                {tab.key === 'expense-report' && (
                  <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${active ? 'bg-carrot-100 text-carrot-600' : 'bg-slate-100 text-slate-500'}`}>
                    {filteredOrders.length}
                  </span>
                )}
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
          {activeTab === 'expense-report' && (
            <DetailedExpenseReportTab
              orders={filteredOrders}
              calcAmounts={calcBillingAmounts}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
            />
          )}
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
