/**
 * 정산 완료 내역 페이지
 *
 * status가 'settled'인 발주만 표시합니다.
 * 월별 필터링, 검색 기능 제공
 */

'use client'

import { useState } from 'react'
import { mockOrders } from '@/lib/mock-data'
import { type Order } from '@/types/order'
import { OrderCard } from '@/components/orders/order-card'
import { OrderDetailDialog } from '@/components/orders/order-detail-dialog'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export default function SettledPage() {
  // 상태 관리
  const [searchTerm, setSearchTerm] = useState('') // 검색어
  const [selectedMonth, setSelectedMonth] = useState('all') // 선택된 월
  const [orders] = useState(mockOrders) // 발주 목록

  // 상세보기 모달 상태
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [orderToView, setOrderToView] = useState<Order | null>(null)

  /**
   * 카드 클릭 핸들러 (상세보기 모달 열기)
   */
  const handleCardClick = (order: Order) => {
    setOrderToView(order)
    setDetailDialogOpen(true)
  }

  /**
   * 정산완료 건만 필터링
   */
  const settledOrders = orders.filter((order) => {
    // settled 상태만
    if (order.status !== 'settled') return false

    // 검색어 필터
    const matchesSearch =
      order.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.documentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.affiliate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.businessName.toLowerCase().includes(searchTerm.toLowerCase())

    if (!matchesSearch) return false

    // 월 필터
    if (selectedMonth !== 'all' && order.settlementMonth !== selectedMonth) {
      return false
    }

    return true
  })

  /**
   * 정산 월 목록 생성 (최근 12개월)
   */
  const getMonthOptions = (): string[] => {
    const months: string[] = []
    const today = new Date()

    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      months.push(monthStr)
    }

    return months
  }

  const monthOptions = getMonthOptions()

  return (
    <div className="container mx-auto py-8 px-4">
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">정산 완료 내역</h1>
        <p className="text-gray-600">정산이 완료된 발주 내역입니다</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* 전체 정산완료 건수 */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-2">
            <CardDescription>전체 정산완료</CardDescription>
            <CardTitle className="text-2xl text-green-600">
              {orders.filter(o => o.status === 'settled').length}건
            </CardTitle>
          </CardHeader>
        </Card>

        {/* 검색 결과 건수 */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>검색 결과</CardDescription>
            <CardTitle className="text-2xl">{settledOrders.length}건</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* 검색 및 필터 영역 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            {/* 월 필터 */}
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="월 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 기간</SelectItem>
                {monthOptions.map(month => (
                  <SelectItem key={month} value={month}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 검색창 */}
            <Input
              placeholder="주소, 문서번호, 계열사, 사업자명으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>

          {/* 검색 결과 개수 */}
          <p className="text-sm text-gray-500 mt-3">
            총 {settledOrders.length}건의 정산완료 내역
          </p>
        </CardContent>
      </Card>

      {/* 정산완료 목록 (그리드) */}
      {settledOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-400">정산 완료된 발주가 없습니다</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {settledOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onClick={handleCardClick}
            />
          ))}
        </div>
      )}

      {/* 상세보기 모달 */}
      <OrderDetailDialog
        order={orderToView}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  )
}
