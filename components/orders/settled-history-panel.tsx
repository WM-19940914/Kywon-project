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
import type { Order } from '@/types/order'

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
    const settledOrders = orders.filter(o => o.status === 'settled')
    const yearSet = new Set<number>()

    // 정산완료된 발주들의 년도 추출
    settledOrders.forEach(order => {
      if (order.settlementDate) {
        const year = parseInt(order.settlementDate.substring(0, 4))
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
      // 1. 정산완료 상태만
      if (order.status !== 'settled') return false

      // 2. 검색어 필터 (사업자명, 계열사, 주소)
      if (searchTerm) {
        const matchesSearch =
          order.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.affiliate.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.address.toLowerCase().includes(searchTerm.toLowerCase())

        if (!matchesSearch) return false
      }

      // 3. 년/월 필터
      if (order.settlementDate) {
        const [year, month] = order.settlementDate.split('-')

        // 년도 필터
        if (selectedYear !== 'all' && year !== selectedYear) {
          return false
        }

        // 월 필터
        if (selectedMonth !== 'all' && month !== selectedMonth) {
          return false
        }
      }

      return true
    })
  }, [orders, searchTerm, selectedYear, selectedMonth])

  return (
    <div className="flex-shrink-0 w-96 bg-gray-50 rounded-lg p-4 border border-gray-200 font-mono">
      {/* 헤더 */}
      <div className="mb-4">
        <h2 className="font-bold text-base text-gray-600 tracking-tight">
          📋 과거내역
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
                : '정산 완료된 내역이 없습니다'}
            </p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <SettledHistoryCard
              key={order.id}
              order={order}
              onClick={onCardClick}
            />
          ))
        )}
      </div>
    </div>
  )
}
