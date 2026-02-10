/**
 * 발주 카드 컴포넌트 (칸반보드용)
 *
 * 가장 중요한 정보만 보여줘요:
 * 1. 사업자명 (가장 크게!)
 * 2. 문서명 (작업 내용 요약)
 * 3. 주소, 발주일
 */

'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, PlusCircle, ArrowRightLeft, Archive, Trash2, Package, RotateCcw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Order } from '@/types/order'
import { WORK_TYPE_ORDER, getWorkTypeBadgeStyle } from '@/types/order'

/**
 * 컴포넌트가 받을 Props
 */
interface OrderCardProps {
  order: Order                           // 발주 정보
  onClick?: (order: Order) => void       // 카드 클릭 시 (상세보기 모달 열기)
}

/** 작업종류 아이콘 매핑 */
const WORK_TYPE_ICON_MAP: Record<string, LucideIcon> = {
  '신규설치': PlusCircle,
  '이전설치': ArrowRightLeft,
  '철거보관': Archive,
  '철거폐기': Trash2,
  '재고설치': Package,
  '반납폐기': RotateCcw,
}

/**
 * 주소 짧게 자르기
 * 예: "서울시 강남구 테헤란로 123, 101동 1001호" → "서울시 강남구 테헤란로..."
 */
function shortenAddress(address: string, maxLength: number = 30): string {
  if (address.length <= maxLength) return address
  return address.substring(0, maxLength) + '...'
}

/**
 * 발주 카드 컴포넌트
 */
export function OrderCard({ order, onClick }: OrderCardProps) {
  // 날짜 포맷팅 (2024-01-15 → 2024.01.15)
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-'
    return dateString.replace(/-/g, '.')
  }

  return (
    <Card
      className="hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-pointer"
      onClick={() => onClick?.(order)}
    >
      <CardContent className="px-3 py-2.5 space-y-1">
        {/* 상단: 계열사 + 발주일 + 사전견적 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="uppercase tracking-wider font-medium">{order.affiliate}</span>
            <span>발주일: {formatDate(order.orderDate)}</span>
          </div>
          {order.isPreliminaryQuote && (
            <Badge className="bg-red-50 text-red-600 border-red-200 font-semibold text-[9px] px-1 py-0 leading-tight">
              사전견적
            </Badge>
          )}
        </div>

        {/* 사업자명 — 1줄만 */}
        <h3 className="text-sm font-bold text-foreground leading-snug truncate" title={order.businessName}>
          {order.businessName}
        </h3>

        {/* 작업종류 뱃지 */}
        <div className="flex flex-wrap items-center gap-1">
          {order.isPreliminaryQuote ? (
            <span className="text-xs font-medium text-primary">사전견적 요청건</span>
          ) : order.items.length === 0 ? (
            <span className="text-xs font-medium text-primary">요청건</span>
          ) : (
            [...order.items].sort((a, b) => {
              const ai = WORK_TYPE_ORDER.indexOf(a.workType)
              const bi = WORK_TYPE_ORDER.indexOf(b.workType)
              return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
            }).map((item, idx) => {
              const Icon = WORK_TYPE_ICON_MAP[item.workType]
              const style = getWorkTypeBadgeStyle(item.workType)
              return (
                <span
                  key={idx}
                  className={`inline-flex items-center gap-0.5 text-[10px] font-medium border rounded px-1 py-px whitespace-nowrap ${style.badge}`}
                >
                  {Icon && <Icon className={`h-2.5 w-2.5 shrink-0 ${style.icon}`} />}
                  {item.workType} {item.quantity}대
                </span>
              )
            })
          )}
        </div>

        {/* 주소 (1줄) */}
        <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate" title={order.address}>
          <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
          {shortenAddress(order.address, 30)}
        </p>
      </CardContent>
    </Card>
  )
}
