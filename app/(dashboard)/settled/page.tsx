/**
 * 정산 완료 내역 페이지
 *
 * status가 'settled'인 발주만 표시합니다.
 * 월별 필터링, 검색 기능 제공
 */

'use client'

import { useState, useEffect } from 'react'
import { fetchOrders } from '@/lib/supabase/dal'
import { type Order } from '@/types/order'
import { OrderCard } from '@/components/orders/order-card'
import { OrderDetailDialog } from '@/components/orders/order-detail-dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CheckCircle2, Search, FileCheck } from 'lucide-react'

export default function SettledPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('all')
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchOrders().then(data => {
      setOrders(data)
      setIsLoading(false)
    })
  }, [])

  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [orderToView, setOrderToView] = useState<Order | null>(null)

  const handleCardClick = (order: Order) => {
    setOrderToView(order)
    setDetailDialogOpen(true)
  }

  /** 정산완료 건만 필터링 */
  const settledOrders = orders.filter((order) => {
    if (order.status !== 'settled') return false
    const matchesSearch =
      order.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.documentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.affiliate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.businessName.toLowerCase().includes(searchTerm.toLowerCase())
    if (!matchesSearch) return false
    if (selectedMonth !== 'all' && order.settlementMonth !== selectedMonth) return false
    return true
  })

  /** 월 목록 (최근 12개월) */
  const getMonthOptions = (): string[] => {
    const months: string[] = []
    const today = new Date()
    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1)
      months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
    }
    return months
  }
  const monthOptions = getMonthOptions()

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-[1400px] py-6 px-4 md:px-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
          <FileCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">정산 완료 내역</h1>
          <p className="text-muted-foreground mt-0.5">정산이 완료된 발주 내역입니다</p>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-emerald-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-xs text-slate-500">전체 정산완료</span>
          </div>
          <p className="text-2xl font-bold text-emerald-700">
            {orders.filter(o => o.status === 'settled').length}<span className="text-sm font-medium ml-0.5">건</span>
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <Search className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-500">검색 결과</span>
          </div>
          <p className="text-2xl font-bold text-slate-700">
            {settledOrders.length}<span className="text-sm font-medium ml-0.5">건</span>
          </p>
        </div>
      </div>

      {/* 검색 및 필터 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
        <div className="flex gap-4 flex-wrap">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48 rounded-lg">
              <SelectValue placeholder="월 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 기간</SelectItem>
              {monthOptions.map(month => (
                <SelectItem key={month} value={month}>{month}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="주소, 문서번호, 계열사, 사업자명으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-lg bg-white border-slate-200"
            />
          </div>
        </div>
        <p className="text-sm text-slate-500 mt-3">
          총 {settledOrders.length}건의 정산완료 내역
        </p>
      </div>

      {/* 정산완료 목록 */}
      {settledOrders.length === 0 ? (
        <EmptyState
          icon={FileCheck}
          title="정산 완료된 발주가 없습니다"
          description="검색 조건을 변경해 보세요"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {settledOrders.map((order) => (
            <OrderCard key={order.id} order={order} onClick={handleCardClick} />
          ))}
        </div>
      )}

      <OrderDetailDialog
        order={orderToView}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  )
}
