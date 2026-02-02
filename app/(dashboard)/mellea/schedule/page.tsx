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
import { fetchOrders, updateOrder as updateOrderDB } from '@/lib/supabase/dal'
import type { Order, InstallScheduleStatus } from '@/types/order'
import { ScheduleTable } from '@/components/schedule/schedule-table'
import { OrderDetailDialog } from '@/components/orders/order-detail-dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { CalendarCheck } from 'lucide-react'
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

  /**
   * 설치일정 정보 업데이트 핸들러
   * 설치예정일, 설치완료일, 메모 등을 수정합니다.
   */
  const handleUpdateOrder = async (orderId: string, updates: Partial<Order>) => {
    await updateOrderDB(orderId, updates)
    setOrders(prev => prev.map(order => {
      if (order.id !== orderId) return order
      return { ...order, ...updates }
    }))
  }

  /**
   * 탭별 건수 계산
   */
  const tabCounts = useMemo(() => {
    const counts = { unscheduled: 0, scheduled: 0, completed: 0 }
    orders.forEach(order => {
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
      <ScheduleTable
        orders={filteredOrders}
        activeTab={activeTab}
        onUpdateOrder={handleUpdateOrder}
        onViewDetail={(order) => {
          setOrderToView(order)
          setDetailDialogOpen(true)
        }}
      />

      {/* 발주 상세 모달 (전체 페이지 공용) */}
      <OrderDetailDialog
        order={orderToView}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  )
}
