/**
 * 발주 상세보기 모달
 *
 * 카드 클릭 시 열리는 모달로, 발주의 모든 정보를 자세히 보여줍니다.
 * 여기서 진행상태도 변경할 수 있어요!
 */

'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  type Order,
  type OrderStatus
} from '@/types/order'

/**
 * 컴포넌트가 받을 Props
 */
interface OrderDetailDialogProps {
  order: Order | null                              // 보여줄 발주 (null이면 모달 안 열림)
  open: boolean                                    // 모달 열림/닫힘 상태
  onOpenChange: (open: boolean) => void           // 모달 닫기 함수
  onStatusChange?: (orderId: string, newStatus: OrderStatus) => void  // 상태 변경 함수
}

/**
 * 상태 전환 규칙 (3단계)
 * 현재 상태 → 다음 가능한 상태
 */
const NEXT_STATUS_MAP: Record<OrderStatus, OrderStatus | null> = {
  'received': 'in-progress',      // 접수중 → 진행중
  'in-progress': 'completed',     // 진행중 → 완료
  'completed': 'settled',         // 완료 → 정산완료
  'settled': null                 // 정산완료 (더 이상 변경 없음)
}

/**
 * 발주 상세보기 모달
 */
export function OrderDetailDialog({
  order,
  open,
  onOpenChange,
  onStatusChange
}: OrderDetailDialogProps) {
  // order가 없으면 모달 안 보여줌
  if (!order) return null

  // 날짜 포맷팅 (2024-01-15 → 2024.01.15)
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return dateString.replace(/-/g, '.')
  }

  // 다음 상태 가져오기
  const nextStatus = NEXT_STATUS_MAP[order.status]

  // 상태 변경 버튼 클릭
  const handleStatusChange = () => {
    if (nextStatus && onStatusChange) {
      onStatusChange(order.id, nextStatus)
      onOpenChange(false)  // 모달 닫기
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        {/* 헤더 */}
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle>발주 상세</DialogTitle>
            <Badge className={ORDER_STATUS_COLORS[order.status]}>
              {ORDER_STATUS_LABELS[order.status]}
            </Badge>
          </div>
          <DialogDescription>
            문서번호: {order.documentNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 기본 정보 섹션 */}
          <div>
            <h3 className="font-semibold text-lg mb-3">📋 기본 정보</h3>
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm text-gray-500">계열사</span>
                <span className="col-span-2 font-medium">{order.affiliate}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm text-gray-500">사업자명</span>
                <span className="col-span-2 font-medium">{order.businessName}</span>
              </div>
              <Separator />
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm text-gray-500">주소</span>
                <span className="col-span-2">{order.address}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm text-gray-500">발주일</span>
                <span className="col-span-2">{formatDate(order.orderDate)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm text-gray-500">주문번호</span>
                <span className="col-span-2 font-mono text-sm">{order.orderNumber}</span>
              </div>
            </div>
          </div>

          {/* 발주내역 섹션 */}
          <div>
            <h3 className="font-semibold text-lg mb-3">📦 발주내역</h3>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="border border-gray-200 rounded-lg p-3 bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* 작업종류 */}
                      <Badge variant="outline" className="font-normal">
                        {item.workType}
                      </Badge>
                      {/* 품목 */}
                      <span className="font-medium">{item.category}</span>
                    </div>
                    {/* 수량 */}
                    <span className="text-lg font-bold text-blue-600">
                      {item.quantity}대
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-gray-600 flex gap-4">
                    <span>모델명: <span className="font-mono">{item.model}</span></span>
                    <span>평형: {item.size}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 특이사항 섹션 */}
          {order.notes && (
            <div>
              <h3 className="font-semibold text-lg mb-3">💬 특이사항</h3>
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <p className="text-sm">{order.notes}</p>
              </div>
            </div>
          )}

          {/* 완료/정산 정보 (있을 경우만) */}
          {(order.completionDate || order.settlementDate) && (
            <div>
              <h3 className="font-semibold text-lg mb-3">📅 완료/정산 정보</h3>
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                {order.completionDate && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm text-gray-500">설치완료일</span>
                    <span className="col-span-2">{formatDate(order.completionDate)}</span>
                  </div>
                )}
                {order.settlementDate && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm text-gray-500">정산처리일</span>
                    <span className="col-span-2">{formatDate(order.settlementDate)}</span>
                  </div>
                )}
                {order.settlementMonth && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm text-gray-500">정산월</span>
                    <span className="col-span-2">{order.settlementMonth}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>

          {/* 다음 단계 버튼 (settled가 아닐 때만) */}
          {nextStatus && (
            <Button onClick={handleStatusChange}>
              {ORDER_STATUS_LABELS[nextStatus]}(으)로 변경
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
