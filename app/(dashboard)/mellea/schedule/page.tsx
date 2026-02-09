/**
 * 설치일정 관리 페이지 (재설계)
 *
 * 3개 탭으로 워크플로우를 분리합니다:
 *   [일정미정] → [설치예정] → [설치완료]
 *
 * 주요 기능:
 * - 탭별 필터링 + 정렬
 * - 검색 (현장명, 주소, 문서번호, 작업종류)
 * - 탭별 안내 문구 (S1 ENG 뱃지 포함)
 * - 긴급도별 행 색상 (지연/오늘/내일/장비미도착)
 * - 장비상태 뱃지 (신규설치 건만)
 * - 설치완료 버튼 (AlertDialog 확인)
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
import { CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  filterOrdersByScheduleStatus,
  sortOrdersByScheduleTab,
  computeInstallScheduleStatus,
} from '@/lib/schedule-utils'

export default function SchedulePage() {
  // Supabase에서 데이터 로드
  const [orders, setOrders] = useState<Order[]>([])
  const [, setIsLoading] = useState(true)

  useEffect(() => {
    fetchOrders().then(data => {
      setOrders(data)
      setIsLoading(false)
    })
  }, [])

  // 검색어
  const [searchTerm, setSearchTerm] = useState('')

  // 현재 선택된 탭 (기본: 일정미정)
  const [activeTab, setActiveTab] = useState<InstallScheduleStatus>('unscheduled')

  // 발주서 상세보기 모달
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [orderToView, setOrderToView] = useState<Order | null>(null)

  // 견적서 작성/수정 모달
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false)
  const [orderForQuote, setOrderForQuote] = useState<Order | null>(null)

  /**
   * 설치일정 정보 업데이트 핸들러
   * 설치예정일, 설치완료일, 메모 등을 수정합니다.
   *
   * 설치완료 처리 시 (installCompleteDate 입력됨):
   * - 발주 항목 중 workType='철거보관'이 있으면 → stored_equipment에 자동 등록
   */
  const handleUpdateOrder = async (orderId: string, updates: Partial<Order>) => {
    await updateOrderDB(orderId, updates)

    // 설치완료 처리 시 철거보관 장비 자동 등록
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

  /**
   * 발주 취소 핸들러
   * status를 'cancelled'로 변경하고 취소 사유를 저장합니다.
   */
  const handleCancelOrder = async (orderId: string, reason: string) => {
    const success = await cancelOrderDB(orderId, reason)
    if (success) {
      // 로컬 상태에서 취소 반영 (목록에서 사라짐 — cancelled는 설치관리에 안 보임)
      setOrders(prev => prev.map(order =>
        order.id === orderId
          ? { ...order, status: 'cancelled' as const, cancelReason: reason, cancelledAt: new Date().toISOString() }
          : order
      ))
    }
  }

  /**
   * 견적서 작성/수정 모달 열기
   */
  const handleQuoteCreate = (order: Order) => {
    setOrderForQuote(order)
    setQuoteDialogOpen(true)
  }

  /**
   * 견적서 저장 핸들러
   * DB에 견적서 저장 후 로컬 상태 업데이트
   */
  const handleQuoteSave = async (orderId: string, quote: CustomerQuote) => {
    await saveCustomerQuote(orderId, quote)
    setOrders(prev => prev.map(order =>
      order.id === orderId
        ? { ...order, customerQuote: quote }
        : order
    ))
  }

  /**
   * 탭별 건수 계산
   */
  const tabCounts = useMemo(() => {
    const counts = { unscheduled: 0, scheduled: 0, completed: 0 }
    orders.forEach(order => {
      // 취소 건은 카운트 제외
      if (order.status === 'cancelled') return
      // 정산완료 건은 완료탭에서만 카운트
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

  /**
   * 검색 + 탭 필터 + 정렬 적용
   */
  const filteredOrders = useMemo(() => {
    // 1. 탭 필터
    let result = filterOrdersByScheduleStatus(orders, activeTab)

    // 2. 검색어 필터
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(order =>
        order.businessName.toLowerCase().includes(term) ||
        order.address.toLowerCase().includes(term) ||
        order.documentNumber.toLowerCase().includes(term) ||
        order.items.some(item => item.workType.toLowerCase().includes(term))
      )
    }

    // 3. 탭별 정렬
    return sortOrdersByScheduleTab(result, activeTab)
  }, [orders, activeTab, searchTerm])

  /**
   * 설치완료 탭: 미정산/정산진행중 vs 정산완료 분리
   */
  const completedUnsettled = useMemo(() => {
    if (activeTab !== 'completed') return []
    return filteredOrders.filter(o => (o.s1SettlementStatus || 'unsettled') !== 'settled')
  }, [filteredOrders, activeTab])

  const completedSettled = useMemo(() => {
    if (activeTab !== 'completed') return []
    return filteredOrders.filter(o => (o.s1SettlementStatus || 'unsettled') === 'settled')
  }, [filteredOrders, activeTab])

  // 정산완료 테이블 페이지네이션 (10개씩)
  const SETTLED_PAGE_SIZE = 10
  const [settledPage, setSettledPage] = useState(1)

  // 데이터가 바뀌면 첫 페이지로 리셋
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
        {/* 에스원이엔지 뱃지 (실제 로고 스타일) */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md shadow-sm" style={{ backgroundColor: '#1C1C2E' }}>
          {/* 에스원 로고 마크 */}
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* 베이스 (어두운 파랑) */}
            <path d="M4 10C4 7.8 5.8 6 8 6H24C26.2 6 28 7.8 28 10V22C28 24.2 26.2 26 24 26H8C5.8 26 4 24.2 4 22V10Z" fill="#2563EB" />
            {/* 상단 밝은 부분 */}
            <path d="M4 10C4 7.8 5.8 6 8 6H24C26.2 6 28 7.8 28 10V16L16 16L4 10Z" fill="#60A5FA" />
            {/* S 모양 경로 */}
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

  return (
    <div className="container mx-auto py-8 px-4">
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
          <CalendarCheck className="h-6 w-6" />
          설치일정 관리
        </h1>
        <p className="text-muted-foreground">
          설치팀의 일정을 한눈에 확인하고 관리하세요.
        </p>
      </div>

      {/* 검색 영역 */}
      <div className="mb-4">
        <Input
          placeholder="현장명, 주소, 문서번호, 작업종류로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* 상태 탭 필터 */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap
              ${activeTab === tab.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
          >
            {tab.label}
            <Badge variant="secondary" className="text-xs ml-1 px-1.5 py-0">
              {tab.count}
            </Badge>
          </button>
        ))}

        {/* 결과 건수 */}
        <span className="text-sm text-gray-500 ml-auto">
          {filteredOrders.length}건 표시
          {searchTerm && (
            <span className="text-blue-600 font-medium ml-1">(검색중)</span>
          )}
        </span>
      </div>

      {/* 탭별 안내 문구 */}
      <p className="text-sm text-muted-foreground mb-3">
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
          {/* 미정산 / 정산진행중 테이블 */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Badge variant="secondary" className="bg-gray-100 text-gray-600 text-xs">미정산 · 정산진행중</Badge>
              <span className="text-xs text-gray-400">{completedUnsettled.length}건</span>
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

          {/* 정산완료 테이블 (페이지네이션 적용) */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 text-xs border">정산완료</Badge>
              <span className="text-xs text-gray-400">{completedSettled.length}건</span>
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

            {/* 페이지네이션 컨트롤 */}
            {settledTotalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  disabled={settledPage <= 1}
                  onClick={() => setSettledPage(p => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-600">
                  {settledPage} / {settledTotalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  disabled={settledPage >= settledTotalPages}
                  onClick={() => setSettledPage(p => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 발주 상세 모달 (전체 페이지 공용) */}
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
