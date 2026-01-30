/**
 * 설치비 입력 섹션 컴포넌트 (테이블 스타일)
 *
 * 설치팀이 현장별 설치비용을 입력하는 섹션입니다.
 * 엑셀 스타일 테이블 형태로 빠른 데이터 입력을 지원합니다.
 *
 * 주요 기능:
 * - 테이블 형태의 인라인 편집
 * - 키보드 네비게이션 (Tab, Shift+Tab, Enter)
 * - 수량 × 단가 = 금액 자동 계산
 * - 총 설치비 합계 하단 표시
 * - 마지막 셀에서 Enter 누르면 새 행 추가
 */

'use client'

import { useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, X } from 'lucide-react'
import { INSTALLATION_ITEM_OPTIONS, type InstallationCostItem } from '@/types/order'

/**
 * 컴포넌트가 받을 Props
 */
interface InstallationCostSectionProps {
  items: InstallationCostItem[]                 // 현재 설치비 항목 목록
  onChange: (items: InstallationCostItem[]) => void  // 변경 이벤트 핸들러
}

/**
 * 설치비 입력 섹션 (테이블 스타일)
 */
export function InstallationCostSection({
  items,
  onChange
}: InstallationCostSectionProps) {

  /**
   * 새 설치비 항목 추가
   */
  const handleAdd = () => {
    const newItem: InstallationCostItem = {
      id: `temp-inst-${Date.now()}`,
      itemName: '기본설치비',
      unitPrice: 0,
      quantity: 1
    }
    onChange([...items, newItem])
  }

  /**
   * 설치비 항목 삭제
   */
  const handleRemove = (itemId: string) => {
    onChange(items.filter(item => item.id !== itemId))
  }

  /**
   * 설치비 항목 필드 변경
   * 수량/단가 변경 시 총액 자동 계산
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChange = (itemId: string, field: keyof InstallationCostItem, value: any) => {
    onChange(items.map(item => {
      if (item.id !== itemId) return item

      const updated = { ...item, [field]: value }

      // 수량/단가 변경 시 총액 자동 계산
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = field === 'quantity' ? value : updated.quantity
        const price = field === 'unitPrice' ? value : updated.unitPrice
        updated.totalPrice = qty && price ? qty * price : 0
      }

      return updated
    }))
  }

  /**
   * 키보드 네비게이션 핸들러
   * Enter 키: 마지막 열에서 누르면 새 행 추가
   */
  const handleKeyDown = (e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    // Enter 키: 마지막 열(비고)에서 누르면 새 행 추가
    if (e.key === 'Enter' && colIndex === 4) {
      e.preventDefault()
      handleAdd()

      // 다음 프레임에 새 행의 수량 Input에 포커스
      setTimeout(() => {
        const nextRow = document.querySelector(`#inst-row-${rowIndex + 1}-col-1`) as HTMLInputElement
        if (nextRow) {
          nextRow.focus()
        }
      }, 50)
    }
  }

  // 전체 설치비 합계 계산
  const totalAmount = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0)

  // 컴포넌트 마운트 시 빈 행이 없으면 하나 추가
  useEffect(() => {
    if (items.length === 0) {
      handleAdd()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-3">
      {/* 테이블 헤더 (sticky) */}
      <div className="bg-blue-100 border rounded-t-lg sticky top-0 z-10">
        <div className="grid grid-cols-[200px_100px_120px_120px_1fr_50px] gap-2 p-2 text-xs font-bold text-gray-700">
          <div>항목명</div>
          <div>수량</div>
          <div>단가</div>
          <div>금액</div>
          <div>비고</div>
          <div></div>
        </div>
      </div>

      {/* 테이블 바디 */}
      <div className="border border-t-0 rounded-b-lg max-h-[400px] overflow-y-auto">
        {items.map((item, rowIndex) => (
          <div
            key={item.id}
            className="grid grid-cols-[200px_100px_120px_120px_1fr_50px] gap-2 p-2 border-b last:border-b-0 hover:bg-blue-50/30"
          >
            {/* 항목명 (Select) */}
            <div>
              <Select
                value={item.itemName}
                onValueChange={(value) => handleChange(item.id!, 'itemName', value)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INSTALLATION_ITEM_OPTIONS.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 수량 (Number) */}
            <div>
              <Input
                id={`inst-row-${rowIndex}-col-1`}
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => handleChange(item.id!, 'quantity', parseInt(e.target.value) || 1)}
                onKeyDown={(e) => handleKeyDown(e, rowIndex, 1)}
                className="h-8 text-xs text-center"
              />
            </div>

            {/* 단가 (Number) */}
            <div>
              <Input
                id={`inst-row-${rowIndex}-col-2`}
                type="number"
                min="0"
                value={item.unitPrice}
                onChange={(e) => handleChange(item.id!, 'unitPrice', parseInt(e.target.value) || 0)}
                onKeyDown={(e) => handleKeyDown(e, rowIndex, 2)}
                placeholder="0"
                className="h-8 text-xs text-right"
              />
            </div>

            {/* 금액 (자동 계산, 읽기 전용) */}
            <div>
              <Input
                id={`inst-row-${rowIndex}-col-3`}
                value={item.totalPrice ? item.totalPrice.toLocaleString() : '0'}
                readOnly
                tabIndex={0}
                onKeyDown={(e) => handleKeyDown(e, rowIndex, 3)}
                className="h-8 text-xs text-right bg-blue-50 text-blue-700 font-semibold"
              />
            </div>

            {/* 비고 (짧은 Input) */}
            <div>
              <Input
                id={`inst-row-${rowIndex}-col-4`}
                value={item.notes || ''}
                onChange={(e) => handleChange(item.id!, 'notes', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, rowIndex, 4)}
                placeholder="추가 설명 (선택)"
                className="h-8 text-xs"
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
        설치비 항목 추가
      </Button>

      {/* 합계 표시 */}
      {items.length > 0 && (
        <div className="bg-blue-100 border-2 border-blue-300 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="font-bold text-lg">총 설치비</span>
            <span className="font-bold text-2xl text-blue-600">
              {totalAmount.toLocaleString()} 원
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
