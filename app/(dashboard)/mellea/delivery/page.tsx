/**
 * 배송관리 페이지 (멜레아 전용)
 *
 * 삼성전자에 발주한 장비의 배송 현황을 디테일하게 관리하는 페이지입니다.
 * 각 장비별(SET모델/실외기/실내기/자재박스/리모컨)로 배송상태를 추적합니다.
 *
 * 주요 기능:
 * - 통계 카드 3개 (발주대기/배송중/배송완료 건수)
 * - 검색 (사업자명, 주소)
 * - 상태 필터 (전체/발주대기/배송중/배송완료)
 * - 카드 클릭 → 장비별 상세 배송 정보 모달 (특이사항 제외)
 */

'use client'

import { useState } from 'react'
import { mockOrders } from '@/lib/mock-data'
import {
  type Order,
  type DeliveryStatus
} from '@/types/order'
import { DeliveryCard } from '@/components/delivery/delivery-card'
import { DeliveryDetailDialog } from '@/components/delivery/delivery-detail-dialog'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Truck } from 'lucide-react'

/**
 * 배송 칸반 컬럼 컴포넌트
 * 각 배송 상태별로 하나씩 생성됩니다
 */
interface DeliveryColumnProps {
  title: string                       // 컬럼 제목 (예: "발주대기")
  status: DeliveryStatus              // 배송 상태
  orders: Order[]                     // 이 컬럼에 표시할 발주들
  onCardClick: (order: Order) => void // 카드 클릭 핸들러
}

function DeliveryColumn({ title, status, orders, onCardClick }: DeliveryColumnProps) {
  // 상태별 배경색 + 상단 스트라이프
  const columnStyles: Record<DeliveryStatus, { bg: string; stripe: string }> = {
    'pending': { bg: 'bg-yellow-50/70', stripe: 'border-t-4 border-t-yellow-400' },
    'in-transit': { bg: 'bg-blue-50/70', stripe: 'border-t-4 border-t-blue-400' },
    'delivered': { bg: 'bg-green-50/70', stripe: 'border-t-4 border-t-green-400' }
  }

  const style = columnStyles[status]

  return (
    <div className={`flex-shrink-0 w-80 ${style.bg} ${style.stripe} rounded-xl p-4`}>
      {/* 컬럼 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-base">{title}</h2>
        <Badge variant="outline" className="bg-white">
          {orders.length}건
        </Badge>
      </div>

      {/* 카드 리스트 */}
      <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto">
        {orders.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            배송 건이 없습니다
          </p>
        ) : (
          orders.map((order) => (
            <DeliveryCard
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

export default function DeliveryPage() {
  // 발주 데이터 (나중에 Supabase로 교체)
  const [orders] = useState<Order[]>(mockOrders)

  // 검색어
  const [searchTerm, setSearchTerm] = useState('')

  // 상세보기 모달 상태
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [orderToView, setOrderToView] = useState<Order | null>(null)

  /**
   * 배송 대상 발주만 필터링
   * deliveryStatus가 있는 발주만 표시 (신규설치 품목이 있는 발주)
   */
  const deliveryOrders = orders.filter(order => order.deliveryStatus)

  /**
   * 검색 필터 적용
   */
  const filteredOrders = deliveryOrders.filter(order => {
    // 검색어 필터
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      return (
        order.businessName.toLowerCase().includes(term) ||
        order.address.toLowerCase().includes(term) ||
        order.documentNumber.toLowerCase().includes(term)
      )
    }

    return true
  })

  /**
   * 카드 클릭 → 상세 모달 열기
   */
  const handleCardClick = (order: Order) => {
    setOrderToView(order)
    setDetailDialogOpen(true)
  }


  return (
    <div className="container mx-auto py-8 px-4">
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
          <Truck className="h-6 w-6" />
          배송관리
        </h1>
        <p className="text-muted-foreground">삼성전자 장비 배송 현황을 한눈에 확인하세요</p>
      </div>

      {/* 검색 영역 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Input
              placeholder="사업자명, 주소, 문서번호로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
          <p className="text-sm text-gray-500 mt-3">
            총 {filteredOrders.length}건
            {searchTerm && (
              <span className="text-blue-600 font-medium ml-2">(검색 결과)</span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* 칸반보드 3컬럼 (발주대기/배송진행중/배송완료) */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {/* 발주대기 컬럼 */}
        <DeliveryColumn
          title="발주대기"
          status="pending"
          orders={filteredOrders.filter(o => o.deliveryStatus === 'pending')}
          onCardClick={handleCardClick}
        />

        {/* 배송진행중 컬럼 */}
        <DeliveryColumn
          title="배송진행중"
          status="in-transit"
          orders={filteredOrders.filter(o => o.deliveryStatus === 'in-transit')}
          onCardClick={handleCardClick}
        />

        {/* 배송완료 컬럼 */}
        <DeliveryColumn
          title="배송완료"
          status="delivered"
          orders={filteredOrders.filter(o => o.deliveryStatus === 'delivered')}
          onCardClick={handleCardClick}
        />
      </div>

      {/* 배송 상세 정보 모달 (멜레아 전용) */}
      <DeliveryDetailDialog
        order={orderToView}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  )
}
