/**
 * 대시보드 페이지 (루트 페이지)
 *
 * 발주 현황을 한눈에 볼 수 있는 요약 페이지입니다.
 * - 통계 카드: 전체/대기중/진행중/완료 건수
 * - 최근 발주: 최신 5개 발주 목록
 * - 업체별 현황: 각 업체별 발주 건수
 */

'use client'

import { useState, useEffect } from 'react'
import { fetchOrders } from '@/lib/supabase/dal'
import type { Order } from '@/types/order'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/types/order'
import { ClipboardList, Clock, Loader2, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  // Supabase에서 발주 데이터 가져오기
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

  // ===========================================
  // 1. 통계 계산
  // ===========================================
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'received').length,
    'in-progress': orders.filter(o => o.status === 'in-progress').length,
    completed: orders.filter(o => o.status === 'completed').length,
  }

  // ===========================================
  // 2. 최근 발주 5개 (날짜순 정렬)
  // ===========================================
  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())
    .slice(0, 5)

  // ===========================================
  // 3. 업체별 통계
  // ===========================================
  const contractorStats = orders.reduce((acc, order) => {
    acc[order.affiliate] = (acc[order.affiliate] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // 업체별 통계를 배열로 바꿔서 건수 많은 순으로 정렬
  const contractorStatsArray = Object.entries(contractorStats)
    .sort((a, b) => b[1] - a[1])  // 건수 많은 순

  // 로딩 중이면 로딩 표시
  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
        <p className="text-muted-foreground">데이터를 불러오는 중...</p>
      </div>
    )
  }

  // 에러가 있으면 에러 표시
  if (loadError) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <p className="text-red-500 mb-2">데이터 로드 실패</p>
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          새로고침
        </button>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* ================================ */}
      {/* 페이지 제목 */}
      {/* ================================ */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">대시보드</h1>
        <p className="text-muted-foreground">발주 현황을 한눈에 확인하세요</p>
      </div>

      {/* ================================ */}
      {/* 통계 카드 4개 (전체/대기/진행/완료) */}
      {/* ================================ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {/* 전체 발주 */}
        <Card className="border-t-4 border-t-slate-400">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">전체 발주</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}건</div>
          </CardContent>
        </Card>

        {/* 대기중 */}
        <Card className="border-t-4 border-t-amber-400">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">대기중</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{stats.pending}건</div>
          </CardContent>
        </Card>

        {/* 진행중 */}
        <Card className="border-t-4 border-t-blue-400">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">진행중</CardTitle>
            <Loader2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats['in-progress']}건</div>
          </CardContent>
        </Card>

        {/* 완료 */}
        <Card className="border-t-4 border-t-emerald-400">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">완료</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{stats.completed}건</div>
          </CardContent>
        </Card>
      </div>

      {/* ================================ */}
      {/* 최근 발주 5건 */}
      {/* ================================ */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>최근 발주</CardTitle>
          <CardDescription>최근 등록된 발주 5건</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-medium text-muted-foreground">문서번호</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-medium text-muted-foreground">주소</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-medium text-muted-foreground">업체</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-medium text-muted-foreground">상태</th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider font-medium text-muted-foreground">등록일</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="py-3 px-4 font-medium">{order.documentNumber}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {/* 주소가 너무 길면 50자까지만 표시 */}
                      {order.address.length > 50
                        ? order.address.substring(0, 50) + '...'
                        : order.address}
                    </td>
                    <td className="py-3 px-4">{order.affiliate}</td>
                    <td className="py-3 px-4">
                      {/* 상태 배지 (색상 자동 적용) */}
                      <Badge className={ORDER_STATUS_COLORS[order.status]}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {/* 날짜만 표시 (시간은 생략) */}
                      {order.orderDate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* "전체 보기" 버튼 */}
          <div className="mt-4 text-center">
            <Link
              href="/orders"
              className="text-primary hover:text-primary/80 font-medium transition-colors"
            >
              전체 발주 보기 →
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* ================================ */}
      {/* 업체별 현황 */}
      {/* ================================ */}
      <Card>
        <CardHeader>
          <CardTitle>업체별 현황</CardTitle>
          <CardDescription>각 시공업체별 발주 건수</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {contractorStatsArray.map(([contractor, count]) => (
              <div key={contractor} className="flex items-center justify-between">
                {/* 업체 이름 */}
                <div className="font-medium">{contractor}</div>

                {/* 진행률 바 */}
                <div className="flex items-center gap-4 flex-1 ml-8">
                  <div className="flex-1 bg-muted rounded-full h-1.5">
                    {/* 전체 대비 비율만큼 파란색으로 채워요 */}
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all"
                      style={{ width: `${(count / stats.total) * 100}%` }}
                    />
                  </div>

                  {/* 건수 표시 */}
                  <div className="text-sm font-medium w-16 text-right">
                    {count}건
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
