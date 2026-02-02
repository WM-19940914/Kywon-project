/**
 * 원가 입력 모달 컴포넌트
 *
 * 이건 "관리자용" 원가 정보를 입력하는 화면이에요!
 * 장비 매입 정보와 설치비 실제 비용을 입력하고,
 * 소비자 견적서(customerQuote)와 비교하여 마진률을 계산합니다.
 *
 * - 장비 섹션: 멜레아(회사)에서 입력 (매입단가, 매입처)
 * - 설치비 섹션: 설치팀에서 입력 (실제 설치비)
 * - 마진 분석: 판매가 vs 원가 비교
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
import { Package, Wrench, TrendingUp, AlertTriangle } from 'lucide-react'
import { EquipmentInputSection } from '@/components/orders/equipment-input-section'
import { InstallationCostSection } from '@/components/orders/installation-cost-section'
import { PriceTableSheet } from '@/components/orders/price-table-dialog'
import type { Order, EquipmentItem, InstallationCostItem } from '@/types/order'
import { useAlert } from '@/components/ui/custom-alert'
import type { ComponentDetail } from '@/lib/price-table'

/**
 * 컴포넌트가 받을 Props
 */
interface CostInputDialogProps {
  order: Order | null                          // 원가를 입력할 발주 정보
  open: boolean                                // 모달 열림/닫힘 상태
  onOpenChange: (open: boolean) => void       // 모달 닫기 함수
  onSave?: (orderId: string, equipmentItems: EquipmentItem[], installationCost: { items: InstallationCostItem[], totalAmount: number }) => void  // 저장 함수
}

/**
 * 원가 입력 모달
 */
export function CostInputDialog({
  order,
  open,
  onOpenChange,
  onSave
}: CostInputDialogProps) {

  const { showAlert } = useAlert()

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
   * 마진 분석 계산하기
   * 소비자 견적서(customerQuote)가 있으면 마진률 계산
   */
  const calculateMarginAnalysis = () => {
    // 소비자 견적서가 없으면 계산 불가
    if (!order.customerQuote) {
      return null
    }

    // 판매가 (소비자 견적서 총액)
    const salesPrice = order.customerQuote.totalAmount

    // 원가 계산
    const equipmentCost = equipmentItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0)
    const installationCostTotal = installationItems.reduce((sum, item) => sum + (item.totalPrice || 0), 0)
    const totalCost = equipmentCost + installationCostTotal

    // 이익금
    const profit = salesPrice - totalCost

    // 마진률 (%) = (이익금 / 판매가) × 100
    const marginRate = salesPrice > 0 ? (profit / salesPrice) * 100 : 0

    return {
      salesPrice,
      totalCost,
      profit,
      marginRate,
      equipmentCost,
      installationCostTotal
    }
  }

  const marginAnalysis = calculateMarginAnalysis()

  /**
   * 마진률에 따른 색상 결정
   * 20% 이상: 초록색 (좋음)
   * 10~20%: 노란색 (보통)
   * 10% 미만: 빨간색 (주의)
   */
  const getMarginColor = (marginRate: number) => {
    if (marginRate >= 20) return 'text-green-600'
    if (marginRate >= 10) return 'text-yellow-600'
    return 'text-red-600'
  }

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

      showAlert(`${category} ${size} 모델의 구성품 ${components.length}개가 자동으로 입력되었습니다.\n주문번호를 입력해주세요.`, 'success')
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

    showAlert('원가 정보가 저장되었습니다!', 'success')
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
          <DialogTitle className="text-xl">원가 입력</DialogTitle>
          <DialogDescription>
            문서번호: {order.documentNumber} | 주소: {order.address}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8 py-4">
          {/* 마진 분석 카드 (견적서가 있을 때만 표시) */}
          {marginAnalysis && (
            <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-lg">수익성 분석</h3>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">판매가 (견적서):</span>
                  <p className="font-semibold text-lg">
                    {marginAnalysis.salesPrice.toLocaleString('ko-KR')} 원
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">총 원가:</span>
                  <p className="font-semibold text-lg">
                    {marginAnalysis.totalCost.toLocaleString('ko-KR')} 원
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">예상 이익:</span>
                  <p className={`font-semibold text-lg ${marginAnalysis.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {marginAnalysis.profit.toLocaleString('ko-KR')} 원
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">마진율:</span>
                  <p className={`font-bold text-2xl ${getMarginColor(marginAnalysis.marginRate)}`}>
                    {marginAnalysis.marginRate.toFixed(1)} %
                  </p>
                </div>
              </div>

              {/* 마진률 경고 */}
              {marginAnalysis.marginRate < 10 && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-semibold">마진율이 낮습니다!</p>
                    <p>수익성을 재검토해주세요. (권장: 10% 이상)</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 견적서 미작성 안내 */}
          {!order.customerQuote && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-semibold">소비자 견적서가 아직 작성되지 않았습니다</p>
                  <p>견적서를 먼저 작성하면 마진률을 자동으로 계산해드립니다.</p>
                </div>
              </div>
            </div>
          )}

          {/* 장비 입력 섹션 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Package className="h-5 w-5 text-gray-700" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">장비 원가</h3>
                  <p className="text-sm text-gray-600">멜레아(회사) 담당자가 입력합니다 (매입단가)</p>
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
                <h3 className="font-bold text-lg">설치비 원가</h3>
                <p className="text-sm text-gray-600">설치팀 담당자가 입력합니다 (실제 설치비)</p>
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
