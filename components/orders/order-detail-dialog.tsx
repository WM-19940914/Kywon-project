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
  DialogTitle
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
import { ClipboardList, Package, MessageSquare, CalendarDays, AlertTriangle, Edit, Trash2, FileText } from 'lucide-react'

/**
 * 컴포넌트가 받을 Props
 */
interface OrderDetailDialogProps {
  order: Order | null                              // 보여줄 발주 (null이면 모달 안 열림)
  open: boolean                                    // 모달 열림/닫힘 상태
  onOpenChange: (open: boolean) => void           // 모달 닫기 함수
  onStatusChange?: (orderId: string, newStatus: OrderStatus) => void  // 상태 변경 함수
  onDelete?: (orderId: string) => void            // 삭제 함수
  onEdit?: (order: Order) => void                 // 수정 함수
  onQuoteInput?: (order: Order) => void           // 견적 입력 함수
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
  onStatusChange,
  onDelete,
  onEdit,
  onQuoteInput
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

  // 삭제 확인 및 실행
  const handleDelete = () => {
    if (!onDelete) return

    const confirmed = window.confirm(
      `"${order.documentNumber}" 발주를 정말 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`
    )

    if (confirmed) {
      onDelete(order.id)
      onOpenChange(false)
    }
  }

  // 수정 버튼 클릭
  const handleEdit = () => {
    if (!onEdit) return
    onEdit(order)
    onOpenChange(false)  // 상세 모달 닫기
  }

  // 견적 입력 버튼 클릭
  const handleQuoteInput = () => {
    if (!onQuoteInput) return
    onQuoteInput(order)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        {/* 헤더 */}
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle>발주 상세</DialogTitle>
              <Badge className={ORDER_STATUS_COLORS[order.status]}>
                {ORDER_STATUS_LABELS[order.status]}
              </Badge>
              {order.isPreliminaryQuote && (
                <Badge className="bg-red-50 text-red-600 border-red-200">
                  사전견적건
                </Badge>
              )}
            </div>
            {/* 우측 상단: 견적서 버튼 (X버튼과 살짝 간격) */}
            {onQuoteInput && (
              <Button
                variant="default"
                onClick={handleQuoteInput}
                className="gap-1 bg-green-600 hover:bg-green-700 mr-2"
                size="sm"
              >
                <FileText className="h-4 w-4" />
                {order.customerQuote ? '견적서 보기' : '견적 입력'}
              </Button>
            )}
          </div>
          <DialogDescription>
            문서번호: {order.documentNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 기본 정보 섹션 */}
          <div>
            <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" /> 기본 정보
            </h3>
            <div className="bg-muted/50 p-4 rounded-xl space-y-2">
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
                <span className="col-span-2 font-mono text-sm">{order.samsungOrderNumber || '-'}</span>
              </div>
            </div>
          </div>

          {/* 발주내역 섹션 */}
          <div>
            <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" /> 발주내역
            </h3>

            {order.isPreliminaryQuote ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-yellow-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  사전견적 요청건 (현장 확인 후 장비 선택 예정)
                </p>
                <p className="text-xs text-gray-600 mt-2">
                  설치기사님 현장 방문 후 적합한 장비를 선택하여 견적을 받는 발주입니다.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="border border-gray-200 rounded-lg p-3 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* 작업종류 - 신규설치는 파란색으로 강조! */}
                        <Badge
                          variant="outline"
                          className={`font-normal ${
                            item.workType === '신규설치'
                              ? 'bg-blue-100 text-blue-700 border-blue-300 font-semibold'
                              : ''
                          }`}
                        >
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
            )}
          </div>

          {/* 특이사항 섹션 */}
          {order.notes && (
            <div>
              <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" /> 특이사항
              </h3>
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <p className="text-sm">{order.notes}</p>
              </div>
            </div>
          )}

          {/* 완료/정산 정보 (있을 경우만) */}
          {(order.completionDate || order.settlementDate) && (
            <div>
              <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" /> 완료/정산 정보
              </h3>
              <div className="bg-muted/50 p-4 rounded-xl space-y-2">
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
        <div className="flex justify-between items-center pt-6 border-t mt-6">
          {/* 왼쪽: 삭제 + 수정 */}
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="gap-1"
            >
              <Trash2 className="h-4 w-4" />
              삭제
            </Button>
            <Button variant="secondary" onClick={handleEdit} className="gap-1">
              <Edit className="h-4 w-4" />
              수정
            </Button>
          </div>

          {/* 오른쪽: 닫기 + 상태변경 */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              닫기
            </Button>
            {nextStatus && (
              <Button onClick={handleStatusChange}>
                {ORDER_STATUS_LABELS[nextStatus]}(으)로 변경
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
