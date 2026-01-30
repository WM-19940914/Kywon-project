/**
 * 장비 입력 섹션 컴포넌트 (테이블 스타일)
 *
 * 발주 등록/수정 시 장비 구매/배송 정보를 입력하는 섹션입니다.
 * 엑셀 스타일 테이블 형태로 빠른 데이터 입력을 지원합니다.
 *
 * 주요 기능:
 * - 테이블 형태의 인라인 편집
 * - 키보드 네비게이션 (Tab, Shift+Tab, Enter)
 * - 수량 × 단가 = 금액 자동 계산
 * - 마지막 셀에서 Enter 누르면 새 행 추가
 */

'use client'

import { useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, X } from 'lucide-react'
import { COMPONENT_OPTIONS, type EquipmentItem } from '@/types/order'

/**
 * 컴포넌트가 받을 Props
 */
interface EquipmentInputSectionProps {
  equipmentItems: EquipmentItem[]          // 현재 장비 목록
  onChange: (items: EquipmentItem[]) => void  // 변경 이벤트 핸들러
}

/**
 * 장비 입력 섹션 (테이블 스타일)
 */
export function EquipmentInputSection({
  equipmentItems,
  onChange
}: EquipmentInputSectionProps) {

  const firstInputRef = useRef<HTMLInputElement>(null)

  /**
   * 새 장비 항목 추가
   */
  const handleAdd = () => {
    const newItem: EquipmentItem = {
      id: `temp-eq-${Date.now()}`,
      componentName: '실외기',
      orderDate: new Date().toISOString().split('T')[0],
      quantity: 1
    }
    onChange([...equipmentItems, newItem])
  }

  /**
   * 장비 항목 삭제
   */
  const handleRemove = (itemId: string) => {
    onChange(equipmentItems.filter(item => item.id !== itemId))
  }

  /**
   * 장비 항목 필드 변경
   * 수량/단가 변경 시 총액 자동 계산
   */
  const handleChange = (itemId: string, field: keyof EquipmentItem, value: any) => {
    onChange(equipmentItems.map(item => {
      if (item.id !== itemId) return item

      const updated = { ...item, [field]: value }

      // 수량/단가 변경 시 총액 자동 계산
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = field === 'quantity' ? value : updated.quantity
        const price = field === 'unitPrice' ? value : updated.unitPrice
        updated.totalPrice = qty && price ? qty * price : undefined
      }

      return updated
    }))
  }

  /**
   * 키보드 네비게이션 핸들러
   * Enter 키: 마지막 열에서 누르면 새 행 추가
   */
  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    // Enter 키: 마지막 열(금액)에서 누르면 새 행 추가
    if (e.key === 'Enter' && colIndex === 7) {
      e.preventDefault()
      handleAdd()

      // 다음 프레임에 새 행의 첫 번째 Input에 포커스
      setTimeout(() => {
        const nextRow = document.querySelector(`#eq-row-${rowIndex + 1}-col-1`) as HTMLInputElement
        if (nextRow) {
          nextRow.focus()
        }
      }, 50)
    }
  }

  // 컴포넌트 마운트 시 빈 행이 없으면 하나 추가
  useEffect(() => {
    if (equipmentItems.length === 0) {
      handleAdd()
    }
  }, [])

  return (
    <div className="space-y-3">
      {/* 테이블 헤더 (sticky) */}
      <div className="bg-gray-100 border rounded-t-lg sticky top-0 z-10">
        <div className="grid grid-cols-[140px_140px_120px_120px_120px_100px_120px_120px_50px] gap-2 p-2 text-xs font-bold text-gray-700">
          <div>구성품명</div>
          <div>발주일</div>
          <div>배송요청일</div>
          <div>배송확정일</div>
          <div>수량</div>
          <div>매입단가</div>
          <div>매입금액</div>
          <div></div>
        </div>
      </div>

      {/* 테이블 바디 */}
      <div className="border border-t-0 rounded-b-lg max-h-[400px] overflow-y-auto">
        {equipmentItems.map((item, rowIndex) => (
          <div
            key={item.id}
            className="grid grid-cols-[140px_140px_120px_120px_120px_100px_120px_120px_50px] gap-2 p-2 border-b last:border-b-0 hover:bg-gray-50"
          >
            {/* 구성품명 (Select) */}
            <div>
              <Select
                value={item.componentName}
                onValueChange={(value) => handleChange(item.id!, 'componentName', value)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPONENT_OPTIONS.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 발주일 (Date) */}
            <div>
              <Input
                id={`eq-row-${rowIndex}-col-2`}
                type="date"
                value={item.orderDate}
                onChange={(e) => handleChange(item.id!, 'orderDate', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, rowIndex, 2)}
                className="h-8 text-xs"
              />
            </div>

            {/* 배송요청일 (Date) */}
            <div>
              <Input
                id={`eq-row-${rowIndex}-col-3`}
                type="date"
                value={item.requestedDeliveryDate || ''}
                onChange={(e) => handleChange(item.id!, 'requestedDeliveryDate', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, rowIndex, 3)}
                className="h-8 text-xs"
              />
            </div>

            {/* 배송확정일 (Date) */}
            <div>
              <Input
                id={`eq-row-${rowIndex}-col-4`}
                type="date"
                value={item.confirmedDeliveryDate || ''}
                onChange={(e) => handleChange(item.id!, 'confirmedDeliveryDate', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, rowIndex, 4)}
                className="h-8 text-xs"
              />
            </div>

            {/* 수량 (Number) */}
            <div>
              <Input
                id={`eq-row-${rowIndex}-col-5`}
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => handleChange(item.id!, 'quantity', parseInt(e.target.value) || 1)}
                onKeyDown={(e) => handleKeyDown(e, rowIndex, 5)}
                className="h-8 text-xs text-center"
              />
            </div>

            {/* 매입단가 (Number) */}
            <div>
              <Input
                id={`eq-row-${rowIndex}-col-6`}
                type="number"
                min="0"
                value={item.unitPrice || ''}
                onChange={(e) => handleChange(item.id!, 'unitPrice', parseInt(e.target.value) || 0)}
                onKeyDown={(e) => handleKeyDown(e, rowIndex, 6)}
                placeholder="0"
                className="h-8 text-xs text-right"
              />
            </div>

            {/* 매입금액 (자동 계산, 읽기 전용) */}
            <div>
              <Input
                id={`eq-row-${rowIndex}-col-7`}
                value={item.totalPrice ? item.totalPrice.toLocaleString() : '0'}
                readOnly
                tabIndex={0}
                onKeyDown={(e) => handleKeyDown(e, rowIndex, 7)}
                className="h-8 text-xs text-right bg-blue-50 text-blue-700 font-semibold"
              />
            </div>

            {/* 삭제 버튼 */}
            <div className="flex items-center justify-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(item.id!)}
                className="h-6 w-6 p-0 text-red-500 hover:bg-red-50"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* 추가 버튼 */}
      <Button
        type="button"
        variant="outline"
        onClick={handleAdd}
        className="w-full gap-2 border-dashed"
      >
        <Plus className="h-4 w-4" />
        장비 항목 추가
      </Button>
    </div>
  )
}
