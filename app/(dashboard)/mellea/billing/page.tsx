'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { fetchOrders } from '@/lib/supabase/dal'
import type { Order } from '@/types/order'
import { Skeleton } from '@/components/ui/skeleton'
import { CreditCard, ShoppingCart, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react'
import { SamsungPurchaseTab } from '@/components/billing/samsung-purchase-tab'
import { MonthlySummaryTab } from '@/components/billing/monthly-summary-tab'

type BillingTab = 'samsung-purchase' | 'monthly-summary'

const TAB_CONFIG: { key: BillingTab; label: string; icon: React.ReactNode }[] = [
  { key: 'samsung-purchase', label: '배송 및 매입내역', icon: <ShoppingCart className="h-4 w-4" /> },
  { key: 'monthly-summary', label: '정산관리', icon: <BarChart3 className="h-4 w-4" /> },
]

export default function MelleaBillingPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchOrders().then(data => {
      setOrders(data)
      setIsLoading(false)
    })
  }, [])

  const [activeTab, setActiveTab] = useState<BillingTab>('samsung-purchase')

  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)

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
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-carrot-50 text-carrot-600 p-2.5 rounded-xl">
          <CreditCard className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">멜레아 정산</h1>
          <p className="text-muted-foreground mt-0.5">배송 및 매입내역과 정산관리 데이터를 월별로 확인합니다.</p>
        </div>
      </div>

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
