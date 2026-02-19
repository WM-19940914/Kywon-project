/**
 * 정산완료 과거내역 카드 컴포넌트
 *
 * 기존 OrderCard보다 작고 간단하게!
 * 과거 정산내역을 컴팩트하게 보여줘요:
 * 1. 계열사 (작게)
 * 2. 사업자명 (강조)
 * 3. 정산일 (초록색)
 * 4. 발주요약 (예: "신규설치 2대 외 1건")
 */

'use client'

import { Card, CardContent } from '@/components/ui/card'
import type { Order } from '@/types/order'

/**
 * 컴포넌트가 받을 Props
 */
interface SettledHistoryCardProps {
  order: Order                           // 발주 정보
  onClick?: (order: Order) => void       // 카드 클릭 시 (상세보기 모달 열기)
}

/**
 * 발주내역 요약 자동 생성
 * 예: "신규설치 2대 외 1건" (요청건 제외!)
 */
function generateOrderSummary(order: Order): string {
  if (order.items.length === 0) return '작업내역 없음'

  const firstItem = order.items[0]
  const firstItemText = `${firstItem.workType} ${firstItem.quantity}대`

  if (order.items.length === 1) {
    // 항목이 1개만 있으면: "신규설치 2대"
    return firstItemText
  } else {
    // 여러 항목이 있으면: "신규설치 2대 외 1건"
    return `${firstItemText} 외 ${order.items.length - 1}건`
  }
}

/**
 * 정산완료 과거내역 카드 컴포넌트
 */
export function SettledHistoryCard({ order, onClick }: SettledHistoryCardProps) {
  // 날짜 포맷팅 (2024-01-25 → 24년 1월, 파싱 실패 시 원본 반환)
  const formatDate = (dateString: string) => {
    const parts = dateString.split('-')
    const year = parts[0]
    const month = parts[1] ? parseInt(parts[1]) : NaN
    if (!year || year.length < 2 || isNaN(month)) return dateString
    return `${year.slice(2)}년 ${month}월`
  }

  return (
    <Card
      className="hover:shadow-md hover:border-border transition-all duration-200 cursor-pointer border-border/60"
      onClick={() => onClick?.(order)}
    >
      <CardContent className="p-3 space-y-1">
        {/* 계열사 + 발주일 */}
        <div className="flex items-center justify-between text-xs text-gray-500 tracking-tight">
          <span>{order.affiliate}</span>
          <span>발주일: {order.orderDate?.replace(/-/g, '.') || '-'}</span>
        </div>

        {/* 사업자명 (강조) - 1줄로 자르고 ... 표시 */}
        <h4 className="font-semibold text-xs text-gray-900 truncate tracking-tight" title={order.businessName}>
          {order.businessName}
        </h4>

        {/* 정산월 (회색 톤다운) */}
        <p className="text-xs text-gray-600">
          {order.s1SettlementMonth
            ? `${formatDate(order.s1SettlementMonth)} 정산완료`
            : '정산월 미등록'}
        </p>

        {/* 발주요약 */}
        <p className="text-xs text-gray-500">
          {generateOrderSummary(order)}
        </p>
      </CardContent>
    </Card>
  )
}
