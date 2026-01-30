/**
 * 배송 상세 정보 모달 (멜레아 전용)
 *
 * 발주 상세 모달과 달리 배송 정보에만 집중합니다.
 * - 특이사항 섹션 제외
 * - 장비별 상세 배송 정보 (SET모델/실외기/실내기/자재박스/리모컨)
 * - 각 장비마다 개별 배송상태 및 배송일 표시
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
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_COLORS,
  type Order
} from '@/types/order'
import { ClipboardList, Package, Edit } from 'lucide-react'

interface DeliveryDetailDialogProps {
  order: Order | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DeliveryDetailDialog({
  order,
  open,
  onOpenChange
}: DeliveryDetailDialogProps) {
  // order가 없으면 모달 안 보여줌
  if (!order) return null

  // 날짜 포맷팅 (2024-01-15 → 2024.01.15)
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return dateString.replace(/-/g, '.')
  }

  // 장비 목록 (equipmentItems가 있으면 사용, 없으면 빈 배열)
  const equipmentItems = order.equipmentItems || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        {/* 헤더 */}
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle>배송 상세 정보</DialogTitle>
              <Badge className={DELIVERY_STATUS_COLORS[order.deliveryStatus || 'pending']}>
                {DELIVERY_STATUS_LABELS[order.deliveryStatus || 'pending']}
              </Badge>
            </div>
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
            </div>
          </div>

          {/* 발주내역 섹션 */}
          <div>
            <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" /> 발주내역
            </h3>

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
          </div>

          {/* 발주 정보 입력 테이블 */}
          <div>
            <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" /> 발주 정보
            </h3>

            {equipmentItems.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-center">
                <p className="text-sm text-yellow-800 mb-2">
                  아직 발주 정보가 입력되지 않았습니다.
                </p>
                <Button size="sm" className="mt-2">
                  발주 정보 입력
                </Button>
              </div>
            ) : (
              <>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 text-sm font-medium">구성품명</th>
                        <th className="text-left p-3 text-sm font-medium">수량</th>
                        <th className="text-left p-3 text-sm font-medium">발주일</th>
                        <th className="text-left p-3 text-sm font-medium">배송요청일</th>
                        <th className="text-left p-3 text-sm font-medium">배송확정일</th>
                        <th className="text-left p-3 text-sm font-medium">매입단가</th>
                        <th className="text-left p-3 text-sm font-medium">매입금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {equipmentItems.map((item, index) => (
                        <tr key={item.id || index} className="border-t">
                          <td className="p-3 text-sm">{item.componentName}</td>
                          <td className="p-3 text-sm">{item.quantity}</td>
                          <td className="p-3 text-sm">{formatDate(item.orderDate)}</td>
                          <td className="p-3 text-sm">{formatDate(item.requestedDeliveryDate)}</td>
                          <td className="p-3 text-sm">{formatDate(item.confirmedDeliveryDate)}</td>
                          <td className="p-3 text-sm text-right">
                            {item.unitPrice ? `${item.unitPrice.toLocaleString()}원` : '-'}
                          </td>
                          <td className="p-3 text-sm text-right">
                            {item.totalPrice ? `${item.totalPrice.toLocaleString()}원` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 입력/수정 버튼 */}
                <Button className="mt-3" size="sm">
                  <Edit className="h-3 w-3 mr-1" />
                  발주 정보 입력/수정
                </Button>
              </>
            )}
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="flex justify-end pt-6 border-t mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
