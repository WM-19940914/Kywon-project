/**
 * 배송 카드 컴포넌트
 *
 * 배송관리 페이지에서 사용하는 카드예요.
 * 기존 OrderCard와 비슷하지만 배송 정보에 초점을 맞추었습니다.
 * - 사업자명 (크게)
 * - 배송상태 배지
 * - 주소, 배송요청일/확정일
 * - 품목 요약
 */

'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Calendar, Package, CalendarCheck } from 'lucide-react'
import type { Order } from '@/types/order'
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_COLORS } from '@/types/order'

interface DeliveryCardProps {
  order: Order                           // 발주 정보
  onClick?: (order: Order) => void       // 카드 클릭 시 (상세보기 모달 열기)
}

/**
 * 신규설치 품목 요약 텍스트 생성
 * 예: "시스템에어컨 2대, 천장형에어컨 3대"
 */
function getInstallSummary(order: Order): string {
  const installItems = order.items.filter(i => i.workType === '신규설치')
  if (installItems.length === 0) return '신규설치 없음'

  return installItems
    .map(i => `${i.category} ${i.quantity}대`)
    .join(', ')
}

/**
 * 주소 짧게 자르기
 */
function shortenAddress(address: string, maxLength: number = 30): string {
  if (address.length <= maxLength) return address
  return address.substring(0, maxLength) + '...'
}

export function DeliveryCard({ order, onClick }: DeliveryCardProps) {
  // 날짜 포맷팅 (2024-01-15 → 2024.01.15)
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return dateString.replace(/-/g, '.')
  }

  const deliveryStatus = order.deliveryStatus || 'pending'

  return (
    <Card
      className="hover:shadow-lg hover:border-blue-300 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
      onClick={() => onClick?.(order)}
    >
      <CardContent className="p-4 space-y-2">
        {/* 계열사 + 배송상태 배지 */}
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            {order.affiliate}
          </p>
          <Badge className={DELIVERY_STATUS_COLORS[deliveryStatus]}>
            {DELIVERY_STATUS_LABELS[deliveryStatus]}
          </Badge>
        </div>

        {/* 사업자명 (가장 크게!) */}
        <h3 className="text-lg font-bold text-foreground leading-tight line-clamp-2">
          {order.businessName}
        </h3>

        {/* 품목 요약 */}
        <p className="text-sm font-medium text-primary flex items-center gap-1">
          <Package className="h-3.5 w-3.5 flex-shrink-0" />
          {getInstallSummary(order)}
        </p>

        {/* 주소 */}
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          {shortenAddress(order.address, 35)}
        </p>

        {/* 배송요청일 */}
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Calendar className="h-3 w-3 flex-shrink-0" />
          배송요청: {formatDate(order.requestedDeliveryDate)}
        </p>

        {/* 배송확정일 (있을 때만) */}
        {order.confirmedDeliveryDate && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CalendarCheck className="h-3 w-3 flex-shrink-0" />
            배송확정: {formatDate(order.confirmedDeliveryDate)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
