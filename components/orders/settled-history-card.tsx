/**
 * 정산완료 과거내역 카드 컴포넌트
 *
 * 좌측 emerald 보더 + 계열사/발주일 강조:
 * 1. 계열사 칩 + 발주일
 * 2. 사업자명 (bold)
 * 3. 작업요약 (예: "신규설치 2대 외 1건")
 * 4. 정산 완료 표시
 */

'use client'

import type { Order } from '@/types/order'

/** 컴포넌트 Props */
interface SettledHistoryCardProps {
  order: Order
  onClick?: (order: Order) => void
}

/** 발주내역 요약 생성: "신규설치 2대 외 1건" */
function generateOrderSummary(order: Order): string {
  if (order.items.length === 0) return '작업내역 없음'
  const firstItem = order.items[0]
  const firstItemText = `${firstItem.workType} ${firstItem.quantity}대`
  if (order.items.length === 1) return firstItemText
  return `${firstItemText} 외 ${order.items.length - 1}건`
}

/** 정산완료 과거내역 카드 */
export function SettledHistoryCard({ order, onClick }: SettledHistoryCardProps) {
  return (
    <div
      className="bg-white rounded-lg border border-border/50 border-l-[3px] border-l-emerald-300
                 p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-border/80
                 transition-all duration-150 cursor-pointer space-y-1.5"
      onClick={() => onClick?.(order)}
    >
      {/* 계열사 칩 + 발주일 */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
          {order.affiliate}
        </span>
        <span className="text-[11px] text-slate-500 font-medium">
          {order.orderDate?.replace(/-/g, '.') || '-'}
        </span>
        <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded shrink-0 ml-auto">
          정산완료
        </span>
      </div>

      {/* 사업자명 */}
      <h4 className="font-bold text-[13px] text-foreground truncate leading-snug" title={order.businessName}>
        {order.businessName}
      </h4>

      {/* 작업요약 */}
      <p className="text-xs text-slate-500">
        {generateOrderSummary(order)}
      </p>

      {/* 주소 */}
      <p className="text-[11px] text-slate-400 truncate" title={order.address}>
        {order.address}
      </p>
    </div>
  )
}
