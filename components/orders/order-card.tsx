/**
 * 발주 카드 컴포넌트 (칸반보드용)
 *
 * 디테일 있는 카드 구성:
 * - 좌측 컬러 보더로 상태 구분감
 * - 1행: 계열사 칩 + 발주일 (중요 정보 강조)
 * - 2행: 사업자명 (가장 크게)
 * - 3행: 작업요약
 * - 4행: 주소
 */

'use client'

import { computeKanbanStatus } from '@/lib/order-status-utils'
import type { Order } from '@/types/order'

/** 컴포넌트 Props */
interface OrderCardProps {
  order: Order
  onClick?: (order: Order) => void
}

/** 상태별 좌측 보더 색상 */
const STATUS_BORDER_COLORS: Record<string, string> = {
  'received': 'border-l-amber-400',
  'in-progress': 'border-l-blue-400',
  'completed': 'border-l-emerald-400',
}

/** 작업요약 생성: "신규설치 2대 외 1건" */
function generateWorkSummary(order: Order): string {
  if (order.isPreliminaryQuote) return '사전견적 요청건'
  if (order.items.length === 0) return '요청건'
  const first = order.items[0]
  const text = `${first.workType} ${first.quantity}대`
  return order.items.length === 1 ? text : `${text} 외 ${order.items.length - 1}건`
}

/** 발주 카드 컴포넌트 */
export function OrderCard({ order, onClick }: OrderCardProps) {
  const status = computeKanbanStatus(order)
  const borderColor = STATUS_BORDER_COLORS[status] || 'border-l-gray-300'

  return (
    <div
      className={`bg-white rounded-lg border border-border/50 border-l-[3px] ${borderColor}
                  p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md hover:border-border/80
                  transition-all duration-150 cursor-pointer space-y-1.5`}
      onClick={() => onClick?.(order)}
    >
      {/* 1행: 계열사 칩 + 발주일 + 사전견적 */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
          {order.affiliate}
        </span>
        <span className="text-[11px] text-slate-500 font-medium">
          {order.orderDate?.replace(/-/g, '.') || '-'}
        </span>
        {order.isPreliminaryQuote && (
          <span className="text-[10px] text-orange-600 font-medium bg-orange-50 px-1.5 py-0.5 rounded shrink-0 ml-auto">
            사전견적
          </span>
        )}
      </div>

      {/* 2행: 사업자명 */}
      <h3 className="text-[13px] font-bold text-foreground truncate leading-snug" title={order.businessName}>
        {order.businessName}
      </h3>

      {/* 3행: 작업요약 */}
      <p className="text-xs text-slate-500">
        {generateWorkSummary(order)}
      </p>

      {/* 4행: 주소 */}
      <p className="text-[11px] text-slate-400 truncate" title={order.address}>
        {order.address}
      </p>
    </div>
  )
}
