/**
 * 대시보드 페이지 (루트 페이지)
 *
 * 발주 현황을 한눈에 볼 수 있는 요약 페이지입니다.
 * - 환영 메시지 + 날짜
 * - 통계 카드: 전체/대기중/진행중/완료 건수
 * - 최근 발주: 최신 5개 발주 목록
 * - 업체별 현황: 각 업체별 발주 건수
 */

'use client'

import { useState, useEffect } from 'react'
import { fetchOrders } from '@/lib/supabase/dal'
import type { Order } from '@/types/order'
import { Badge } from '@/components/ui/badge'
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/types/order'
import { LayoutDashboard, ClipboardList, Clock, Loader2, CheckCircle2, TrendingUp, ArrowRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    fetchOrders()
      .then(data => {
        setOrders(data)
        setIsLoading(false)
      })
      .catch(err => {
        console.error('데이터 로드 실패:', err)
        setLoadError(err?.message || '데이터를 불러오는데 실패했습니다')
        setIsLoading(false)
      })
  }, [])

  // 통계 계산
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'received').length,
    'in-progress': orders.filter(o => o.status === 'in-progress').length,
    completed: orders.filter(o => o.status === 'completed').length,
  }

  // 최근 발주 5개
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())
    .slice(0, 5)

  // 업체별 통계
  const contractorStats = orders.reduce((acc, order) => {
    acc[order.affiliate] = (acc[order.affiliate] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const contractorStatsArray = Object.entries(contractorStats)
    .sort((a, b) => b[1] - a[1])

  // 오늘 날짜 (한국 시간)
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  })

  // 스켈레톤 로딩
  if (isLoading) {
    return (
      <div className="container mx-auto max-w-[1400px] py-6 px-4 md:px-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-16" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-full" />
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      </div>
    )
  }

  // 에러 표시
  if (loadError) {
    return (
      <div className="container mx-auto max-w-[1400px] py-6 px-4 md:px-6">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="bg-red-50 rounded-2xl p-5 mb-4">
            <Loader2 className="h-8 w-8 text-red-400" />
          </div>
          <p className="text-lg font-medium text-slate-600 mb-1">데이터 로드 실패</p>
          <p className="text-sm text-slate-400 mb-4">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            새로고침
          </button>
        </div>
      </div>
    )
  }

  /** 통계 카드 설정 */
  const statCards = [
    { label: '전체 발주', value: stats.total, icon: ClipboardList, color: 'text-slate-600', iconBg: 'bg-slate-100', accent: 'border-slate-200' },
    { label: '대기중', value: stats.pending, icon: Clock, color: 'text-amber-600', iconBg: 'bg-amber-50', accent: 'border-amber-200' },
    { label: '진행중', value: stats['in-progress'], icon: TrendingUp, color: 'text-blue-600', iconBg: 'bg-blue-50', accent: 'border-blue-200' },
    { label: '완료', value: stats.completed, icon: CheckCircle2, color: 'text-emerald-600', iconBg: 'bg-emerald-50', accent: 'border-emerald-200' },
  ]

  return (
    <div className="container mx-auto max-w-[1400px] py-6 px-4 md:px-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center gap-4 mb-8">
        <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
          <LayoutDashboard className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">대시보드</h1>
          <p className="text-muted-foreground mt-0.5">{today}</p>
        </div>
      </div>

      {/* 통계 카드 4개 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <div key={card.label} className={`bg-white rounded-xl border ${card.accent} shadow-sm p-5 hover:shadow-md transition-shadow`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-500">{card.label}</span>
              <div className={`${card.iconBg} p-2 rounded-lg`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
            <div className={`text-3xl font-bold ${card.color}`}>{card.value}<span className="text-lg font-medium ml-0.5">건</span></div>
          </div>
        ))}
      </div>

      {/* 최근 발주 5건 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold">최근 발주</h2>
          <p className="text-sm text-muted-foreground mt-0.5">최근 등록된 발주 5건</p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="text-xs text-slate-500 font-semibold">문서번호</TableHead>
                <TableHead className="text-xs text-slate-500 font-semibold">주소</TableHead>
                <TableHead className="text-xs text-slate-500 font-semibold">업체</TableHead>
                <TableHead className="text-xs text-slate-500 font-semibold">상태</TableHead>
                <TableHead className="text-xs text-slate-500 font-semibold">등록일</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentOrders.map((order) => (
                <TableRow key={order.id} className="hover:bg-blue-50/40 transition-colors">
                  <TableCell className="font-medium">{order.documentNumber}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                    {order.address}
                  </TableCell>
                  <TableCell>{order.affiliate}</TableCell>
                  <TableCell>
                    <Badge className={ORDER_STATUS_COLORS[order.status]}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {order.orderDate}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 text-center">
          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            전체 발주 보기 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* 업체별 현황 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-bold">업체별 현황</h2>
          <p className="text-sm text-muted-foreground mt-0.5">각 시공업체별 발주 건수</p>
        </div>
        <div className="p-6 space-y-4">
          {contractorStatsArray.map(([contractor, count]) => (
            <div key={contractor} className="flex items-center justify-between">
              <div className="font-medium text-sm">{contractor}</div>
              <div className="flex items-center gap-4 flex-1 ml-8">
                <div className="flex-1 bg-slate-100 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${(count / stats.total) * 100}%` }}
                  />
                </div>
                <div className="text-sm font-semibold w-16 text-right text-slate-600">
                  {count}건
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
