/**
 * 과거내역 / 취소내역 뷰 컴포넌트
 *
 * - mode='history': 정산완료 건을 월별 그룹으로 표시
 * - mode='cancelled': 취소 건을 월별 그룹으로 표시
 * - 년도 필터 + 검색 + 월별 섹션 헤더 + 반응형 카드 그리드
 */

'use client'

import { useState, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Search, Calendar } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SettledHistoryCard } from './settled-history-card'
import type { Order } from '@/types/order'
import { computeKanbanStatus } from '@/lib/order-status-utils'

/** 컴포넌트 Props */
interface SettledHistoryPanelProps {
  orders: Order[]
  onCardClick: (order: Order) => void
  mode: 'history' | 'cancelled'
}

/** 주문에서 년월 키 추출 (정산월 또는 취소일 기준) */
function getMonthKey(order: Order): string {
  if (order.s1SettlementMonth) return order.s1SettlementMonth
  if (order.cancelledAt) {
    const d = new Date(order.cancelledAt)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  return 'unknown'
}

/** 월 키를 보기 좋은 라벨로 변환: "2026-02" → "2026년 2월" */
function formatMonthLabel(key: string): string {
  if (key === 'unknown') return '날짜 미등록'
  const parts = key.split('-')
  return `${parts[0]}년 ${parseInt(parts[1])}월`
}

/** 취소 내역 카드 */
function CancelledHistoryCard({ order, onClick }: { order: Order; onClick: (order: Order) => void }) {
  return (
    <div
      className="bg-white rounded-lg border border-border/50 border-l-[3px] border-l-red-300
                 p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-border/80
                 transition-all duration-150 cursor-pointer space-y-1.5"
      onClick={() => onClick(order)}
    >
      {/* 계열사 + 발주일 + 취소 뱃지 */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
          {order.affiliate}
        </span>
        <span className="text-[11px] text-slate-500 font-medium">
          {order.orderDate?.replace(/-/g, '.') || '-'}
        </span>
        <span className="text-[10px] text-red-600 font-medium bg-red-50 px-1.5 py-0.5 rounded shrink-0 ml-auto">
          취소
        </span>
      </div>

      {/* 사업자명 */}
      <p className="font-bold text-[13px] text-foreground truncate leading-snug" title={order.businessName}>
        {order.businessName}
      </p>

      {/* 주소 */}
      <p className="text-[11px] text-slate-400 truncate" title={order.address}>
        {order.address}
      </p>

      {/* 취소사유 */}
      {order.cancelReason && (
        <p className="text-xs text-red-400 truncate" title={`사유: ${order.cancelReason}`}>
          사유: {order.cancelReason}
        </p>
      )}

      {/* 취소일 */}
      {order.cancelledAt && (
        <p className="text-[10px] text-slate-400">
          취소일: {new Date(order.cancelledAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' })}
        </p>
      )}
    </div>
  )
}

/** 과거내역 / 취소내역 뷰 */
export function SettledHistoryPanel({ orders, onCardClick, mode }: SettledHistoryPanelProps) {
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // 대상 상태
  const targetStatus = mode === 'history' ? 'settled' : 'cancelled'

  // 년도 목록
  const years = useMemo(() => {
    const historyOrders = orders.filter(o => computeKanbanStatus(o) === targetStatus)
    const yearSet = new Set<number>()

    historyOrders.forEach(order => {
      if (order.s1SettlementMonth) {
        yearSet.add(parseInt(order.s1SettlementMonth.substring(0, 4)))
      } else if (order.cancelledAt) {
        yearSet.add(new Date(order.cancelledAt).getFullYear())
      }
    })

    yearSet.add(new Date().getFullYear())
    return Array.from(yearSet).sort((a, b) => b - a)
  }, [orders, targetStatus])

  /** 필터링 로직 */
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const status = computeKanbanStatus(order)
      if (status !== targetStatus) return false

      // 검색어 필터
      if (searchTerm) {
        const q = searchTerm.toLowerCase()
        const matchesSearch =
          order.businessName.toLowerCase().includes(q) ||
          order.affiliate.toLowerCase().includes(q) ||
          order.address.toLowerCase().includes(q)
        if (!matchesSearch) return false
      }

      // 년도 필터
      if (selectedYear !== 'all') {
        const monthKey = getMonthKey(order)
        if (!monthKey.startsWith(selectedYear)) return false
      }

      return true
    })
  }, [orders, searchTerm, selectedYear, targetStatus])

  /** 월별 그룹화 (최신 월부터 정렬) */
  const monthlyGroups = useMemo(() => {
    const groups: Record<string, Order[]> = {}

    filteredOrders.forEach(order => {
      const key = getMonthKey(order)
      if (!groups[key]) groups[key] = []
      groups[key].push(order)
    })

    // 키를 최신순 정렬
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, items]) => ({
        key,
        label: formatMonthLabel(key),
        orders: items,
      }))
  }, [filteredOrders])

  const emptyMessage = searchTerm || selectedYear !== 'all'
    ? '검색 결과가 없습니다'
    : mode === 'history' ? '과거 내역이 없습니다' : '취소 내역이 없습니다'

  return (
    <div className="space-y-5">
      {/* 필터 바 */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[110px] h-9 text-sm">
            <SelectValue placeholder="년도" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 년도</SelectItem>
            {years.map((year) => (
              <SelectItem key={year} value={String(year)}>{year}년</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="사업자명, 계열사, 주소 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>

        <span className="text-sm text-muted-foreground ml-auto">
          총 {filteredOrders.length}건
        </span>
      </div>

      {/* 월별 그룹 렌더링 */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {monthlyGroups.map(({ key, label, orders: monthOrders }) => (
            <div key={key}>
              {/* 월 섹션 헤더 */}
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-bold text-foreground">{label}</h3>
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {monthOrders.length}건
                </span>
                <div className="flex-1 h-px bg-border/60 ml-2" />
              </div>

              {/* 카드 그리드 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {monthOrders.map((order) => (
                  mode === 'cancelled' ? (
                    <CancelledHistoryCard key={order.id} order={order} onClick={onCardClick} />
                  ) : (
                    <SettledHistoryCard key={order.id} order={order} onClick={onCardClick} />
                  )
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
