/**
 * 과거 정산내역 패널 컴포넌트
 *
 * 칸반보드 오른쪽에 표시되는 과거내역 전체 영역:
 * 1. 월별 필터 (최근 12개월)
 * 2. 검색 기능 (사업자명, 계열사, 주소)
 * 3. 정산완료 카드 리스트 (스크롤 가능)
 */

'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SettledHistoryCard } from './settled-history-card'
import { Badge } from '@/components/ui/badge'
import { Archive } from 'lucide-react'
import type { Order } from '@/types/order'
import { computeKanbanStatus } from '@/lib/order-status-utils'

/**
 * 컴포넌트가 받을 Props
 */
interface SettledHistoryPanelProps {
  orders: Order[]                        // 전체 발주 목록
  onCardClick: (order: Order) => void    // 카드 클릭 핸들러
}

/**
 * 과거 정산내역 패널 컴포넌트
 */
export function SettledHistoryPanel({ orders, onCardClick }: SettledHistoryPanelProps) {
  // 상태 관리 (칸반보드와 독립적!)
  const [selectedYear, setSelectedYear] = useState<string>('all') // 선택된 년도
  const [selectedMonth, setSelectedMonth] = useState<string>('all') // 선택된 월
  const [searchTerm, setSearchTerm] = useState('') // 검색어

  // 년도 목록 생성 (실제 데이터 기준 + 현재 년도)
  const years = useMemo(() => {
    const historyOrders = orders.filter(o => {
      const s = computeKanbanStatus(o)
      return s === 'settled' || s === 'cancelled'
    })
    const yearSet = new Set<number>()

    // 발주일 기준으로 년도 추출
    historyOrders.forEach(order => {
      if (order.orderDate) {
        const year = parseInt(order.orderDate.substring(0, 4))
        yearSet.add(year)
      }
    })

    // 현재 년도도 추가 (미래 발주 대비)
    yearSet.add(new Date().getFullYear())

    // 정렬 (최신순)
    return Array.from(yearSet).sort((a, b) => b - a)
  }, [orders])

  // 월 목록 (1~12)
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))

  /**
   * 정산완료 건만 필터링 + 검색 + 년/월 필터
   */
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const status = computeKanbanStatus(order)
      // 1. 정산완료 또는 취소 건만
      if (status !== 'settled' && status !== 'cancelled') return false

      // 2. 검색어 필터 (사업자명, 계열사, 주소)
      if (searchTerm) {
        const matchesSearch =
          order.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.affiliate.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.address.toLowerCase().includes(searchTerm.toLowerCase())

        if (!matchesSearch) return false
      }

      // 3. 년/월 필터 (발주일 기준)
      if (selectedYear !== 'all' || selectedMonth !== 'all') {
        if (!order.orderDate) return false
        const [year, month] = order.orderDate.split('-')
        if (selectedYear !== 'all' && year !== selectedYear) return false
        if (selectedMonth !== 'all' && month !== selectedMonth) return false
      }

      return true
    })
  }, [orders, searchTerm, selectedYear, selectedMonth])

  return (
    <div className="flex-shrink-0 w-96 bg-muted/50 rounded-xl p-4 border border-border/60">
      {/* 헤더 */}
      <div className="mb-4">
        <h2 className="font-semibold text-base text-muted-foreground tracking-tight flex items-center gap-2">
          <Archive className="h-4 w-4" /> 과거내역 및 발주취소 내역
        </h2>
      </div>

      {/* 년/월 선택 */}
      <div className="flex gap-2 mb-3">
        {/* 년도 */}
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="bg-white text-xs flex-1">
            <SelectValue placeholder="년도" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {years.map((year) => (
              <SelectItem key={year} value={String(year)}>
                {year}년
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 월 */}
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="bg-white text-xs flex-1">
            <SelectValue placeholder="월" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {months.map((month) => (
              <SelectItem key={month} value={month}>
                {parseInt(month)}월
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 검색창 */}
      <div className="mb-4">
        <Input
          placeholder="사업자명, 계열사, 주소 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-white text-xs"
        />
      </div>

      {/* 카드 리스트 (스크롤 가능) */}
      <div className="space-y-2 max-h-[calc(100vh-450px)] overflow-y-auto">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-xs text-gray-500">
              {searchTerm || selectedYear !== 'all' || selectedMonth !== 'all'
                ? '검색 결과가 없습니다'
                : '과거 내역이 없습니다'}
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            computeKanbanStatus(order) === 'cancelled' ? (
              <CancelledHistoryCard
                key={order.id}
                order={order}
                onClick={onCardClick}
              />
            ) : (
              <SettledHistoryCard
                key={order.id}
                order={order}
                onClick={onCardClick}
              />
            )
          ))
        )}
      </div>
    </div>
  )
}

/** 취소 내역 카드 (간단하게) */
function CancelledHistoryCard({ order, onClick }: { order: Order; onClick: (order: Order) => void }) {
  return (
    <div
      className="bg-white rounded-lg border border-brick-100 p-3 cursor-pointer hover:shadow-sm transition-shadow"
      onClick={() => onClick(order)}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="font-medium text-sm text-gray-700 truncate" title={order.businessName}>{order.businessName}</p>
        <Badge className="bg-brick-100 text-brick-700 border-brick-200 text-[10px] border ml-2 shrink-0">
          취소
        </Badge>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span className="truncate" title={order.address}>{order.address}</span>
        <span className="shrink-0 ml-2">발주일: {order.orderDate?.replace(/-/g, '.') || '-'}</span>
      </div>
      {order.cancelReason && (
        <p className="text-xs text-brick-500 mt-1 truncate" title={`사유: ${order.cancelReason}`}>사유: {order.cancelReason}</p>
      )}
      {order.cancelledAt && (
        <p className="text-[10px] text-gray-400 mt-0.5">
          취소날짜: {new Date(order.cancelledAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' })}
        </p>
      )}
    </div>
  )
}
