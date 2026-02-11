/**
 * 설치일정 관리 페이지
 *
 * 3개 탭으로 워크플로우를 분리합니다:
 *   [일정미정] → [설치예정] → [설치완료]
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { fetchOrders, updateOrder as updateOrderDB, saveCustomerQuote, cancelOrder as cancelOrderDB, createStoredEquipmentFromOrder } from '@/lib/supabase/dal'
import type { Order, InstallScheduleStatus, CustomerQuote } from '@/types/order'
import { ScheduleTable } from '@/components/schedule/schedule-table'
import { OrderDetailDialog } from '@/components/orders/order-detail-dialog'
import { QuoteCreateDialog } from '@/components/quotes/quote-create-dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CalendarCheck, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  filterOrdersByScheduleStatus,
  sortOrdersByScheduleTab,
  computeInstallScheduleStatus,
} from '@/lib/schedule-utils'

export default function SchedulePage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchOrders().then(data => {
      setOrders(data)
      setIsLoading(false)
    })
  }, [])

  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<InstallScheduleStatus>('unscheduled')
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [orderToView, setOrderToView] = useState<Order | null>(null)
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false)
  const [orderForQuote, setOrderForQuote] = useState<Order | null>(null)

  /** 설치일정 업데이트 + 철거보관 자동 등록 */
  const handleUpdateOrder = async (orderId: string, updates: Partial<Order>) => {
    await updateOrderDB(orderId, updates)
    if (updates.installCompleteDate) {
      const order = orders.find(o => o.id === orderId)
      if (order) {
        const hasRemoval = order.items.some(item => item.workType === '철거보관')
        if (hasRemoval) {
          const updatedOrder = { ...order, ...updates }
          await createStoredEquipmentFromOrder(updatedOrder)
        }
      }
    }
    setOrders(prev => prev.map(order => {
      if (order.id !== orderId) return order
      return { ...order, ...updates }
    }))
  }

  /** 발주 취소 */
  const handleCancelOrder = async (orderId: string, reason: string) => {
    const success = await cancelOrderDB(orderId, reason)
    if (success) {
      setOrders(prev => prev.map(order =>
        order.id === orderId
          ? { ...order, status: 'cancelled' as const, cancelReason: reason, cancelledAt: new Date().toISOString() }
          : order
      ))
    }
  }

  const handleQuoteCreate = (order: Order) => {
    setOrderForQuote(order)
    setQuoteDialogOpen(true)
  }

  const handleQuoteSave = async (orderId: string, quote: CustomerQuote) => {
    await saveCustomerQuote(orderId, quote)
    setOrders(prev => prev.map(order =>
      order.id === orderId ? { ...order, customerQuote: quote } : order
    ))
  }

  /** 탭별 건수 */
  const tabCounts = useMemo(() => {
    const counts = { unscheduled: 0, scheduled: 0, completed: 0 }
    orders.forEach(order => {
      if (order.status === 'cancelled') return
      if (order.status === 'settled') {
        const status = computeInstallScheduleStatus(order)
        if (status === 'completed') counts.completed++
        return
      }
      const status = computeInstallScheduleStatus(order)
      counts[status]++
    })
    return counts
  }, [orders])

  /** 필터 + 정렬 */
  const filteredOrders = useMemo(() => {
    let result = filterOrdersByScheduleStatus(orders, activeTab)
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(order =>
        order.businessName.toLowerCase().includes(term) ||
        order.address.toLowerCase().includes(term) ||
        order.documentNumber.toLowerCase().includes(term) ||
        order.items.some(item => item.workType.toLowerCase().includes(term))
      )
    }
    return sortOrdersByScheduleTab(result, activeTab)
  }, [orders, activeTab, searchTerm])

  /** 설치완료 탭 분리 */
  const completedUnsettled = useMemo(() => {
    if (activeTab !== 'completed') return []
    return filteredOrders.filter(o => (o.s1SettlementStatus || 'unsettled') !== 'settled')
  }, [filteredOrders, activeTab])

  const completedSettled = useMemo(() => {
    if (activeTab !== 'completed') return []
    return filteredOrders.filter(o => (o.s1SettlementStatus || 'unsettled') === 'settled')
  }, [filteredOrders, activeTab])

  const SETTLED_PAGE_SIZE = 10
  const [settledPage, setSettledPage] = useState(1)
  useEffect(() => { setSettledPage(1) }, [completedSettled.length, searchTerm])

  const settledTotalPages = Math.max(1, Math.ceil(completedSettled.length / SETTLED_PAGE_SIZE))
  const settledPagedOrders = useMemo(() => {
    const start = (settledPage - 1) * SETTLED_PAGE_SIZE
    return completedSettled.slice(start, start + SETTLED_PAGE_SIZE)
  }, [completedSettled, settledPage])

  /** 탭 정의 */
  const tabs: { label: string; value: InstallScheduleStatus; count: number }[] = [
    { label: '일정미정', value: 'unscheduled', count: tabCounts.unscheduled },
    { label: '설치예정', value: 'scheduled', count: tabCounts.scheduled },
    { label: '설치완료', value: 'completed', count: tabCounts.completed },
  ]

  /** 탭별 안내 문구 */
  const tabDescriptions: Record<InstallScheduleStatus, React.ReactNode> = {
    unscheduled: (
      <span className="inline-flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md shadow-sm" style={{ backgroundColor: '#1C1C2E' }}>
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 10C4 7.8 5.8 6 8 6H24C26.2 6 28 7.8 28 10V22C28 24.2 26.2 26 24 26H8C5.8 26 4 24.2 4 22V10Z" fill="#2563EB" />
            <path d="M4 10C4 7.8 5.8 6 8 6H24C26.2 6 28 7.8 28 10V16L16 16L4 10Z" fill="#60A5FA" />
            <path d="M20 10H13C11.3 10 10 11.3 10 13V13C10 14.7 11.3 16 13 16H19C20.7 16 22 17.3 22 19V19C22 20.7 20.7 22 19 22H12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
          <span className="font-bold text-white text-xs tracking-wide">에스원이엔지 (주)</span>
        </span>
        <span className="text-muted-foreground">
          설치예정일이 아직 정해지지 않은 현장입니다. 배송현황을 확인하고 설치일정을 잡아주세요.
        </span>
      </span>
    ),
    scheduled: '설치일정이 확정된 현장입니다. 현장 상황을 확인하고 설치를 진행하세요.',
    completed: '설치가 완료된 현장입니다.',
  }

  // 스켈레톤 로딩
  if (isLoading) {
    return (
      <div className="container mx-auto max-w-[1400px] py-6 px-4 md:px-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <Skeleton className="h-10 w-full max-w-md" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <Skeleton className="h-8 w-full" />
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-[1400px] py-6 px-4 md:px-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
          <CalendarCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">설치일정 관리</h1>
          <p className="text-muted-foreground mt-0.5">설치팀의 일정을 한눈에 확인하고 관리하세요</p>
        </div>
      </div>

      {/* 검색 영역 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="현장명, 주소, 문서번호, 작업종류로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-lg bg-white border-slate-200"
          />
        </div>
      </div>

      {/* 상태 탭 (border-b 스타일) */}
      <div className="border-b border-slate-200 mb-4">
        <div className="flex items-center gap-1 -mb-px">
          {tabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`pb-3 px-4 text-sm font-medium transition-colors whitespace-nowrap
                ${activeTab === tab.value
                  ? 'border-b-2 border-blue-500 text-blue-600 font-semibold'
                  : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              {tab.label}
              <span className={`ml-1.5 px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.value
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
          <span className="text-sm text-slate-500 ml-auto pb-3">
            {filteredOrders.length}건 표시
            {searchTerm && <span className="text-blue-600 font-medium ml-1">(검색중)</span>}
          </span>
        </div>
      </div>

      {/* 탭별 안내 문구 */}
      <p className="text-sm text-muted-foreground mb-4">
        {tabDescriptions[activeTab]}
      </p>

      {/* 설치일정 테이블 */}
      {activeTab !== 'completed' ? (
        <ScheduleTable
          orders={filteredOrders}
          activeTab={activeTab}
          onUpdateOrder={handleUpdateOrder}
          onViewDetail={(order) => {
            setOrderToView(order)
            setDetailDialogOpen(true)
          }}
          onQuoteInput={handleQuoteCreate}
          onCancelOrder={handleCancelOrder}
        />
      ) : (
        <div className="space-y-8">
          {/* 미정산 / 정산진행중 */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-xs">미정산 / 정산진행중</Badge>
              <span className="text-xs text-slate-400">{completedUnsettled.length}건</span>
            </h3>
            <ScheduleTable
              orders={completedUnsettled}
              activeTab={activeTab}
              onUpdateOrder={handleUpdateOrder}
              onViewDetail={(order) => {
                setOrderToView(order)
                setDetailDialogOpen(true)
              }}
              onQuoteInput={handleQuoteCreate}
            />
          </div>

          {/* 정산완료 (페이지네이션) */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs border">정산완료</Badge>
              <span className="text-xs text-slate-400">{completedSettled.length}건</span>
            </h3>
            <ScheduleTable
              orders={settledPagedOrders}
              activeTab={activeTab}
              onUpdateOrder={handleUpdateOrder}
              onViewDetail={(order) => {
                setOrderToView(order)
                setDetailDialogOpen(true)
              }}
              onQuoteInput={handleQuoteCreate}
            />
            {settledTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button variant="outline" size="sm" className="h-8 px-2 rounded-lg" disabled={settledPage <= 1} onClick={() => setSettledPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-slate-600">{settledPage} / {settledTotalPages}</span>
                <Button variant="outline" size="sm" className="h-8 px-2 rounded-lg" disabled={settledPage >= settledTotalPages} onClick={() => setSettledPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 발주 상세 모달 */}
      <OrderDetailDialog
        order={orderToView}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />

      {/* 견적서 작성/수정 모달 */}
      <QuoteCreateDialog
        order={orderForQuote}
        open={quoteDialogOpen}
        onOpenChange={setQuoteDialogOpen}
        onSave={handleQuoteSave}
      />
    </div>
  )
}
