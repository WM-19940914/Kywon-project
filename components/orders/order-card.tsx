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
import { MapPin, Calendar, User } from 'lucide-react'
import type { Order } from '@/types/order'

/**
 * 컴포넌트가 받을 Props
 */
interface OrderCardProps {
  order: Order                           // 발주 정보
  onClick?: (order: Order) => void       // 카드 클릭 시 (상세보기 모달 열기)
}

/**
 * 작업종류별 뱃지 색상 매핑
 * 신규설치가 가장 눈에 띄게, 나머지도 구분 가능하도록
 */
const WORK_TYPE_STYLES: Record<string, string> = {
  '신규설치': 'bg-blue-100 text-blue-800 border-blue-300',
  '이전설치': 'bg-purple-100 text-purple-800 border-purple-300',
  '철거보관': 'bg-orange-100 text-orange-800 border-orange-300',
  '철거폐기': 'bg-red-100 text-red-700 border-red-300',
}
const DEFAULT_WORK_TYPE_STYLE = 'bg-gray-100 text-gray-700 border-gray-300'

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
      className="hover:shadow-lg hover:border-blue-300 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
      onClick={() => onClick?.(order)}
    >
      <CardContent className="p-4 space-y-2">
        {/* 계열사 + 사전견적 Badge */}
        <div className="flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
            {order.affiliate}
          </p>
          {order.isPreliminaryQuote && (
            <Badge className="bg-red-50 text-red-600 border-red-200 font-semibold text-[10px] px-1.5 py-0">
              사전견적건
            </Badge>
          )}
        </div>

        {/* 사업자명 (가장 크게 강조!) - 최대 2줄까지만 표시 */}
        <h3 className="text-lg font-bold text-foreground leading-tight line-clamp-2">
          {order.businessName}
        </h3>

        {/* 작업종류 뱃지 (신규설치/이전설치/철거보관 등 강조 표시) */}
        <div className="flex flex-wrap items-center gap-1.5">
          {order.isPreliminaryQuote ? (
            <span className="text-sm font-medium text-primary">사전견적 요청건</span>
          ) : order.items.length === 0 ? (
            <span className="text-sm font-medium text-primary">요청건</span>
          ) : (
            order.items.map((item, idx) => (
              <Badge
                key={idx}
                className={`${WORK_TYPE_STYLES[item.workType] || DEFAULT_WORK_TYPE_STYLE} text-xs font-bold border px-2 py-0.5`}
              >
                {item.workType} {item.quantity}대
              </Badge>
            ))
          )}
        </div>

        {/* 주소 */}
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          {shortenAddress(order.address, 35)}
        </p>

        {/* 발주일 */}
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Calendar className="h-3 w-3 flex-shrink-0" />
          {formatDate(order.orderDate)}
        </p>

        {/* 담당자 정보 */}
        {order.contactName && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <User className="h-3 w-3 flex-shrink-0" />
            {order.contactName}
            {order.contactPhone && ` · ${order.contactPhone}`}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
