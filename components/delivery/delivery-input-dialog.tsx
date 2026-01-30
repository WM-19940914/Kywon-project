/**
 * 배송정보 입력 모달 컴포넌트
 *
 * 배송관리 테이블에서 [배송정보 입력/수정] 버튼 클릭 시 표시됩니다.
 * - 삼성 주문번호 입력
 * - 구성품별 배송요청일, 배송확정일, 배송창고 입력
 * - 매입단가도 여기서 입력 가능 (원가 입력 모달과 양쪽에서 입력 가능)
 * - 저장 시 자동 상태 계산 적용
 */

'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Truck, Plus, Trash2 } from 'lucide-react'
import type { Order, EquipmentItem, DeliveryStatus } from '@/types/order'
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_COLORS, COMPONENT_OPTIONS } from '@/types/order'
import { mockWarehouses } from '@/lib/warehouse-data'
import { computeItemDeliveryStatus } from '@/lib/delivery-utils'

interface DeliveryInputDialogProps {
  order: Order | null                          // 배송정보를 입력할 발주 정보
  open: boolean                                // 모달 열림/닫힘
  onOpenChange: (open: boolean) => void        // 모달 상태 변경
  onSave?: (orderId: string, data: {
    samsungOrderNumber: string
    equipmentItems: EquipmentItem[]
  }) => void                                   // 저장 콜백
}

export function DeliveryInputDialog({
  order,
  open,
  onOpenChange,
  onSave
}: DeliveryInputDialogProps) {
  // 삼성 주문번호
  const [samsungOrderNumber, setSamsungOrderNumber] = useState('')

  // 구성품 항목들
  const [items, setItems] = useState<EquipmentItem[]>([])

  /**
   * 모달이 열릴 때 기존 데이터로 초기화
   */
  useEffect(() => {
    if (open && order) {
      setSamsungOrderNumber(order.samsungOrderNumber || '')
      setItems(order.equipmentItems?.map(item => ({ ...item })) || [])
    }
  }, [open, order])

  if (!order) return null

  /**
   * 구성품 추가
   */
  const handleAddItem = () => {
    const newItem: EquipmentItem = {
      id: `eq-new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      componentName: '실외기',
      orderDate: new Date().toISOString().split('T')[0],
      quantity: 1,
    }
    setItems(prev => [...prev, newItem])
  }

  /**
   * 구성품 삭제
   */
  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  /**
   * 구성품 필드 업데이트
   */
  const handleItemChange = (index: number, field: keyof EquipmentItem, value: string | number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item

      const updated = { ...item, [field]: value }

      // 수량 또는 단가 변경 시 총액 자동 계산
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = field === 'quantity' ? Number(value) : (item.quantity || 0)
        const price = field === 'unitPrice' ? Number(value) : (item.unitPrice || 0)
        updated.totalPrice = qty * price
      }

      return updated
    }))
  }

  /**
   * 저장 핸들러
   */
  const handleSave = () => {
    if (!onSave || !order) return

    // 각 구성품의 배송상태 자동 계산
    const updatedItems = items.map(item => ({
      ...item,
      deliveryStatus: computeItemDeliveryStatus(item) as DeliveryStatus
    }))

    onSave(order.id, {
      samsungOrderNumber,
      equipmentItems: updatedItems
    })

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            <DialogTitle className="text-xl">배송정보 입력</DialogTitle>
          </div>
          <DialogDescription>
            {order.businessName} | {order.address}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 삼성 주문번호 입력 */}
          <div className="space-y-2">
            <label htmlFor="samsung-order-number" className="text-sm font-semibold">
              삼성 주문번호
            </label>
            <Input
              id="samsung-order-number"
              placeholder="예: SO-2026-001"
              value={samsungOrderNumber}
              onChange={(e) => setSamsungOrderNumber(e.target.value)}
              className="max-w-xs font-mono"
            />
          </div>

          {/* 구성품별 배송 정보 테이블 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-base">구성품별 배송 정보</h3>
              <Button size="sm" variant="outline" onClick={handleAddItem}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                구성품 추가
              </Button>
            </div>

            {items.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                <p className="text-sm text-yellow-800 mb-3">
                  아직 구성품이 없습니다. 구성품을 추가해주세요.
                </p>
                <Button size="sm" onClick={handleAddItem}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  구성품 추가
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => {
                  const itemStatus = computeItemDeliveryStatus(item)
                  return (
                    <div key={item.id || index} className="border rounded-lg p-4 bg-white">
                      {/* 상단: 구성품명 + 상태 + 삭제 */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">#{index + 1}</span>
                          <Badge className={`${DELIVERY_STATUS_COLORS[itemStatus]} text-xs`}>
                            {DELIVERY_STATUS_LABELS[itemStatus]}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                          onClick={() => handleRemoveItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* 입력 필드 그리드 */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {/* 구성품명 */}
                        <div className="space-y-1">
                          <label className="text-xs text-gray-500">구성품명</label>
                          <Select
                            value={item.componentName}
                            onValueChange={(val) => handleItemChange(index, 'componentName', val)}
                          >
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {COMPONENT_OPTIONS.map(opt => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* 수량 */}
                        <div className="space-y-1">
                          <label className="text-xs text-gray-500">수량</label>
                          <Input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                            className="h-9 text-sm"
                          />
                        </div>

                        {/* 배송요청일 */}
                        <div className="space-y-1">
                          <label className="text-xs text-gray-500">배송요청일</label>
                          <Input
                            type="date"
                            value={item.requestedDeliveryDate || ''}
                            onChange={(e) => handleItemChange(index, 'requestedDeliveryDate', e.target.value)}
                            className="h-9 text-sm"
                          />
                        </div>

                        {/* 배송확정일 */}
                        <div className="space-y-1">
                          <label className="text-xs text-gray-500">배송확정일</label>
                          <Input
                            type="date"
                            value={item.confirmedDeliveryDate || ''}
                            onChange={(e) => handleItemChange(index, 'confirmedDeliveryDate', e.target.value)}
                            className="h-9 text-sm"
                          />
                        </div>

                        {/* 배송 창고 */}
                        <div className="space-y-1">
                          <label className="text-xs text-gray-500">배송 창고</label>
                          <Select
                            value={item.warehouseId || ''}
                            onValueChange={(val) => handleItemChange(index, 'warehouseId', val)}
                          >
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="선택" />
                            </SelectTrigger>
                            <SelectContent>
                              {mockWarehouses.map(wh => (
                                <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* 매입단가 */}
                        <div className="space-y-1">
                          <label className="text-xs text-gray-500">매입단가</label>
                          <Input
                            type="number"
                            min={0}
                            value={item.unitPrice || ''}
                            onChange={(e) => handleItemChange(index, 'unitPrice', parseInt(e.target.value) || 0)}
                            placeholder="0"
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>

                      {/* 매입금액 (자동 계산) */}
                      {item.unitPrice && item.unitPrice > 0 && (
                        <div className="mt-2 text-right text-xs text-gray-500">
                          매입금액: <span className="font-semibold text-gray-800">
                            {((item.quantity || 0) * (item.unitPrice || 0)).toLocaleString('ko-KR')}원
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex justify-between gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSave}>
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
