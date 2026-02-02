/**
 * 월별 정산 페이지
 *
 * 이 페이지는 매달 완료된 발주들을 모아서 정산하는 페이지입니다.
 * - 월 선택기 (YYYY-MM)
 * - 해당 월 통계 (발주 건수, 금액 합계, 차액)
 * - 정산 대기 목록
 * - 정산 완료 목록
 * - 일괄 정산 처리 버튼
 *
 * 비유: 마치 "월급날 월세 정산하듯이", 한 달 단위로 돈 계산하는 페이지!
 */

'use client'

import { useState, useEffect } from 'react'
import { fetchOrders, updateOrderStatus } from '@/lib/supabase/dal'
import { type Order } from '@/types/order'
import { OrderCard } from '@/components/orders/order-card'
import { OrderDetailDialog } from '@/components/orders/order-detail-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CreditCard, Download, CircleDot, Coins, TrendingUp } from 'lucide-react'

export default function SettlementsPage() {
  // Supabase에서 데이터 로드
  const [orders, setOrders] = useState<Order[]>([])
  const [, setIsLoading] = useState(true)

  useEffect(() => {
    fetchOrders().then(data => {
      setOrders(data)
      setIsLoading(false)
    })
  }, [])

  // 상세보기 모달 상태
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [orderToView, setOrderToView] = useState<Order | null>(null)

  // 현재 월 (YYYY-MM 형식)
  const currentMonth = new Date().toISOString().substring(0, 7) // 예: "2024-01"
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)

  /**
   * 카드 클릭 핸들러 (상세보기 모달 열기)
   */
  const handleCardClick = (order: Order) => {
    setOrderToView(order)
    setDetailDialogOpen(true)
  }

  /**
   * 해당 월에 완료된 발주들 필터링 (정산 대기 중)
   * - status가 'completed' (완료 = 정산 대기 중)
   * - settlementMonth가 선택한 월과 같음
   */
  const monthlyOrders = orders.filter(
    order =>
      order.status === 'completed' &&
      order.settlementMonth === selectedMonth
  )

  /**
   * 참고용: 정산완료 건 (status === 'settled')
   * (통계 목적으로만 사용, 목록에는 안 보임)
   */
  const settledOrders = orders.filter(
    order =>
      order.status === 'settled' &&
      order.settlementMonth === selectedMonth
  )

  /**
   * 통계 계산
   */
  const stats = {
    // 정산 대기 건수 (completed)
    pendingCount: monthlyOrders.length,

    // 정산 완료 건수 (settled)
    completedCount: settledOrders.length,

    // 전체 건수
    get totalCount() {
      return this.pendingCount + this.completedCount
    },

    // 견적 금액 합계 (기존 - 하위 호환)
    totalQuote: monthlyOrders.reduce((sum, o) => sum + (o.quoteAmount || 0), 0),

    // 실제 공사비 합계 (기존 - 하위 호환)
    totalActual: monthlyOrders.reduce((sum, o) => sum + (o.actualCost || 0), 0),

    // 차액 (실제 - 견적) - 기존
    get difference() {
      return this.totalActual - this.totalQuote
    },

    // ✨ 새로운 마진 분석 통계
    // 총 판매가 (소비자 견적서 총액)
    totalSalesPrice: monthlyOrders.reduce((sum, o) => sum + (o.customerQuote?.totalAmount || 0), 0),

    // 총 원가 (장비 원가 + 설치비 원가)
    totalCost: monthlyOrders.reduce((sum, o) => {
      const equipmentCost = (o.equipmentItems || []).reduce((s, item) => s + (item.totalPrice || 0), 0)
      const installationCost = o.installationCost?.totalAmount || 0
      return sum + equipmentCost + installationCost
    }, 0),

    // 총 이익금 (판매가 - 원가)
    get totalProfit() {
      return this.totalSalesPrice - this.totalCost
    },

    // 평균 마진율 (%)
    get averageMargin() {
      return this.totalSalesPrice > 0 ? (this.totalProfit / this.totalSalesPrice) * 100 : 0
    },

    // 견적서 작성된 건수
    quoteCreatedCount: monthlyOrders.filter(o => o.customerQuote).length,

    // 원가 입력된 건수
    costInputCount: monthlyOrders.filter(o => o.equipmentItems && o.equipmentItems.length > 0).length,
  }

  /**
   * 일괄 정산 처리
   * 모든 정산 대기 발주를 "settled"로 변경
   */
  const handleBulkSettle = async () => {
    if (monthlyOrders.length === 0) {
      alert('정산할 발주가 없습니다.')
      return
    }

    const confirmed = confirm(
      `${selectedMonth}월의 정산 대기 발주 ${monthlyOrders.length}건을 일괄 정산 처리하시겠습니까?\n\n` +
      `총 금액: ${stats.totalActual.toLocaleString('ko-KR')}원`
    )

    if (!confirmed) return

    // 정산 대기 발주들의 ID 목록
    const pendingIds = monthlyOrders.map(o => o.id)

    // DB에 일괄 정산 처리
    const results = await Promise.all(
      pendingIds.map(id => updateOrderStatus(id, 'settled'))
    )

    // 성공한 건만 UI에 반영
    const successIds = pendingIds.filter((_, i) => results[i])
    setOrders(orders.map(order => {
      if (successIds.includes(order.id)) {
        return {
          ...order,
          status: 'settled' as const,
          settlementDate: new Date().toISOString().split('T')[0]
        }
      }
      return order
    }))

    alert(`${successIds.length}건이 정산 완료되었습니다!`)
  }

  /**
   * 월 선택 옵션 생성 (최근 6개월)
   * 예: 2024-01, 2023-12, 2023-11, ...
   */
  const getMonthOptions = () => {
    const options = []
    const today = new Date()

    for (let i = 0; i < 6; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const month = date.toISOString().substring(0, 7)
      const label = `${date.getFullYear()}년 ${date.getMonth() + 1}월`
      options.push({ value: month, label })
    }

    return options
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* 페이지 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" /> 정산 관리
        </h1>
        <p className="text-muted-foreground">월별 발주 정산을 관리합니다.</p>
      </div>

      {/* 월 선택기 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>정산 월 선택</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getMonthOptions().map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* 📊 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* 완료 건수 */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>이번 달 완료 건수</CardDescription>
            <CardTitle className="text-2xl">{stats.totalCount}건</CardTitle>
          </CardHeader>
        </Card>

        {/* 미정산 건수 */}
        <Card className={stats.pendingCount > 0 ? 'border-orange-200 bg-orange-50' : ''}>
          <CardHeader className="pb-2">
            <CardDescription className="font-medium">미정산 건수</CardDescription>
            <CardTitle className="text-2xl text-orange-600">
              {stats.pendingCount}건
            </CardTitle>
          </CardHeader>
        </Card>

        {/* 정산완료 건수 */}
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>정산 완료 건수</CardDescription>
            <CardTitle className="text-2xl text-green-600">
              {stats.completedCount}건
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* 💰 금액 통계 카드 (기존 - 하위 호환용) */}
      {(stats.totalQuote > 0 || stats.totalActual > 0) && (
        <Card className="mb-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader>
            <CardTitle className="text-xl flex items-center gap-2">
              <Coins className="h-5 w-5" /> 기존 방식 금액 (참고용)
            </CardTitle>
            <CardDescription className="text-xs">
              구 시스템 호환용 - quoteAmount, actualCost 필드
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* 견적 합계 */}
            <div className="flex justify-between items-center">
              <span className="text-gray-700">견적 합계</span>
              <span className="text-2xl font-bold text-blue-600">
                {stats.totalQuote.toLocaleString('ko-KR')}원
              </span>
            </div>

            {/* 실제 합계 */}
            <div className="flex justify-between items-center">
              <span className="text-gray-700">실제 합계</span>
              <span className="text-2xl font-bold text-blue-700">
                {stats.totalActual.toLocaleString('ko-KR')}원
              </span>
            </div>

            {/* 차액 */}
            {stats.difference !== 0 && (
              <div className={`flex justify-between items-center pt-3 border-t ${
                stats.difference > 0
                  ? 'border-red-200'
                  : 'border-green-200'
              }`}>
                <span className="text-gray-700 font-medium">차액</span>
                <span className={`text-xl font-bold ${
                  stats.difference > 0
                    ? 'text-red-600'
                    : 'text-green-600'
                }`}>
                  {stats.difference > 0 ? '+' : ''}
                  {stats.difference.toLocaleString('ko-KR')}원
                  <span className="text-sm ml-2">
                    {stats.difference > 0 ? '(초과)' : '(절감)'}
                  </span>
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ✨ 새로운 수익성 분석 카드 */}
      <Card className="mb-6 bg-gradient-to-br from-green-50 via-cyan-50 to-blue-50 border-green-200">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" /> 수익성 분석
          </CardTitle>
          <CardDescription>
            견적서 작성: {stats.quoteCreatedCount}건 | 원가 입력: {stats.costInputCount}건
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 판매가 */}
          <div className="flex justify-between items-center">
            <span className="text-gray-700 font-medium">총 판매가 (견적서)</span>
            <span className="text-2xl font-bold text-blue-600">
              {stats.totalSalesPrice.toLocaleString('ko-KR')}원
            </span>
          </div>

          {/* 원가 */}
          <div className="flex justify-between items-center">
            <span className="text-gray-700 font-medium">총 원가 (장비+설치)</span>
            <span className="text-2xl font-bold text-orange-600">
              {stats.totalCost.toLocaleString('ko-KR')}원
            </span>
          </div>

          {/* 구분선 */}
          <div className="border-t-2 border-gray-300"></div>

          {/* 이익금 */}
          <div className="flex justify-between items-center">
            <span className="text-gray-700 font-bold text-lg">총 이익금</span>
            <span className={`text-3xl font-bold ${
              stats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {stats.totalProfit >= 0 ? '+' : ''}
              {stats.totalProfit.toLocaleString('ko-KR')}원
            </span>
          </div>

          {/* 마진율 */}
          <div className="flex justify-between items-center p-4 bg-white rounded-lg border-2 border-green-200">
            <span className="text-gray-700 font-bold text-lg">평균 마진율</span>
            <div className="text-right">
              <div className={`text-4xl font-bold ${
                stats.averageMargin >= 20 ? 'text-green-600' :
                stats.averageMargin >= 10 ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {stats.averageMargin.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {stats.averageMargin >= 20 ? '✅ 우수' :
                 stats.averageMargin >= 10 ? '⚠️ 보통' :
                 '❌ 주의'}
              </div>
            </div>
          </div>

          {/* 안내 메시지 */}
          {stats.quoteCreatedCount === 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              💡 견적서를 작성하면 수익성 분석이 가능합니다.
            </div>
          )}
          {stats.quoteCreatedCount > 0 && stats.costInputCount === 0 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              💡 원가를 입력하면 정확한 마진율을 계산할 수 있습니다.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 액션 버튼 영역 */}
      <div className="flex gap-4 mb-6">
        <Button
          onClick={handleBulkSettle}
          disabled={stats.pendingCount === 0}
          size="lg"
          className="flex-1 bg-orange-600 hover:bg-orange-700"
        >
          <CreditCard className="h-4 w-4" /> 일괄 정산 처리 ({stats.pendingCount}건)
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={() => alert('엑셀 다운로드 기능은 Phase 2에서 구현 예정입니다!')}
        >
          <Download className="h-4 w-4" /> 엑셀 다운로드
        </Button>
      </div>

      {/* 발주 목록이 없을 때 */}
      {monthlyOrders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-gray-500 text-lg">
              {selectedMonth}에 정산 대기 중인 발주가 없습니다.
            </p>
            <p className="text-gray-400 text-sm mt-2">
              다른 월을 선택하거나 발주를 완료 처리하세요.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ━━━ 정산 대기 목록 ━━━ */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xl font-bold text-orange-600 flex items-center gap-2">
                <CircleDot className="h-5 w-5" /> 정산 대기 ({monthlyOrders.length}건)
              </h2>
              <div className="flex-1 border-t border-orange-200" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {monthlyOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onClick={handleCardClick}
                />
              ))}
            </div>
          </div>
        </>
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
