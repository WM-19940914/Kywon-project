/**
 * 견적 입력 모달 컴포넌트
 *
 * 등록된 발주 건에 대해 장비와 설치비 견적을 입력하는 모달입니다.
 * - 장비 섹션: 멜레아(회사)에서 입력
 * - 설치비 섹션: 설치팀에서 입력
 */

'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Package, Wrench } from 'lucide-react'
import { EquipmentInputSection } from '@/components/orders/equipment-input-section'
import { InstallationCostSection } from '@/components/orders/installation-cost-section'
import { PriceTableSheet } from '@/components/orders/price-table-dialog'
import type { Order, EquipmentItem, InstallationCostItem } from '@/types/order'
import type { ComponentDetail } from '@/lib/price-table'

/**
 * 컴포넌트가 받을 Props
 */
interface QuoteInputDialogProps {
  order: Order | null                          // 견적을 입력할 발주 정보
  open: boolean                                // 모달 열림/닫힘 상태
  onOpenChange: (open: boolean) => void       // 모달 닫기 함수
  onSave?: (orderId: string, equipmentItems: EquipmentItem[], installationCost: { items: InstallationCostItem[], totalAmount: number }) => void  // 저장 함수
}

/**
 * 견적 입력 모달
 */
export function QuoteInputDialog({
  order,
  open,
  onOpenChange,
  onSave
}: QuoteInputDialogProps) {

  // 장비 항목 상태
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>(
    order?.equipmentItems || []
  )

  // 설치비 항목 상태
  const [installationItems, setInstallationItems] = useState<InstallationCostItem[]>(
    order?.installationCost?.items || []
  )

  // order가 없으면 모달 안 보여줌
  if (!order) return null

  /**
   * 단가표에서 모델 선택 시 구성품 자동 입력
   */
  const handleModelSelect = (model: string, size: string, category: string, components?: ComponentDetail[]) => {
    // 구성품이 있으면 자동 입력
    if (components && components.length > 0) {
      const autoEquipment: EquipmentItem[] = components.map(comp => ({
        id: `temp-eq-${Date.now()}-${Math.random()}`,
        componentName: comp.type,           // 실내기, 실외기 등
        orderNumber: '',                     // 사용자가 입력
        orderDate: new Date().toISOString().split('T')[0],
        quantity: comp.quantity,
        unitPrice: Math.round(comp.unitPrice * 0.55),  // 매입가 = 출하가 × 0.55
        totalPrice: Math.round(comp.unitPrice * 0.55 * comp.quantity)
      }))

      setEquipmentItems(autoEquipment)

      alert(`${category} ${size} 모델의 구성품 ${components.length}개가 자동으로 입력되었습니다.\n주문번호를 입력해주세요.`)
    }
  }

  /**
   * 저장 핸들러
   */
  const handleSave = () => {
    if (!onSave) return

    // 설치비 총액 계산
    const totalAmount = installationItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0)

    onSave(order.id, equipmentItems, {
      items: installationItems,
      totalAmount
    })

    alert('견적이 저장되었습니다!')
    onOpenChange(false)
  }

  /**
   * 모달이 열릴 때마다 order 데이터로 초기화
   */
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && order) {
      setEquipmentItems(order.equipmentItems || [])
      setInstallationItems(order.installationCost?.items || [])
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">견적 입력</DialogTitle>
          <DialogDescription>
            문서번호: {order.documentNumber} | 주소: {order.address}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8 py-4">
          {/* 장비 입력 섹션 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Package className="h-5 w-5 text-gray-700" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">장비 입력</h3>
                  <p className="text-sm text-gray-600">멜레아(회사) 담당자가 입력합니다</p>
                </div>
              </div>

              {/* 단가표로 입력하기 버튼 */}
              <PriceTableSheet onSelect={handleModelSelect} />
            </div>

            <EquipmentInputSection
              equipmentItems={equipmentItems}
              onChange={setEquipmentItems}
            />
          </div>

          <Separator className="my-6" />

          {/* 설치비 입력 섹션 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Wrench className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <h3 className="font-bold text-lg">설치비 입력</h3>
                <p className="text-sm text-gray-600">설치팀 담당자가 입력합니다</p>
              </div>
            </div>

            <InstallationCostSection
              items={installationItems}
              onChange={setInstallationItems}
            />
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
