/**
 * 견적 항목 입력 테이블 컴포넌트
 *
 * 이건 마치 "엑셀 표"처럼 생긴 입력 폼이에요!
 * 소비자에게 보여줄 견적서의 항목들을 입력합니다.
 *
 * 예:
 * 항목명           | 수량 | 단가      | 금액
 * 벽걸이형 16평 1대  | 1   | 1,200,000 | 1,200,000
 * 기본설치비        | 1   |   150,000 |   150,000
 */

'use client'

import { QuoteItem } from '@/types/order'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Plus } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface QuoteItemInputProps {
  items: QuoteItem[]                    // 현재 입력된 항목들
  onItemsChange: (items: QuoteItem[]) => void  // 항목이 변경될 때 호출
}

export function QuoteItemInput({ items, onItemsChange }: QuoteItemInputProps) {

  /**
   * 새로운 빈 항목 추가하기
   * (마치 엑셀에서 새 줄 추가하는 것처럼!)
   */
  const addItem = () => {
    const newItem: QuoteItem = {
      itemName: '',
      category: 'equipment',  // 기본값: 장비
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
    }
    onItemsChange([...items, newItem])
  }

  /**
   * 항목 삭제하기
   * @param index - 삭제할 항목의 위치 (0부터 시작)
   */
  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index)
    onItemsChange(newItems)
  }

  /**
   * 항목 정보 변경하기
   * @param index - 변경할 항목의 위치
   * @param field - 변경할 필드명 (itemName, quantity 등)
   * @param value - 새로운 값
   */
  const updateItem = (index: number, field: keyof QuoteItem, value: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }

    // 수량이나 단가가 변경되면 금액 자동 계산!
    if (field === 'quantity' || field === 'unitPrice') {
      const quantity = field === 'quantity' ? Number(value) : newItems[index].quantity
      const unitPrice = field === 'unitPrice' ? Number(value) : newItems[index].unitPrice
      newItems[index].totalPrice = quantity * unitPrice
    }

    onItemsChange(newItems)
  }

  return (
    <div className="space-y-4">
      {/* 테이블 헤더 */}
      <div className="grid grid-cols-12 gap-2 font-semibold text-sm text-muted-foreground">
        <div className="col-span-1">구분</div>
        <div className="col-span-4">항목명</div>
        <div className="col-span-2">수량</div>
        <div className="col-span-2">단가</div>
        <div className="col-span-2">금액</div>
        <div className="col-span-1"></div>
      </div>

      {/* 항목들 (입력 줄들) */}
      {items.map((item, index) => (
        <div key={index} className="grid grid-cols-12 gap-2 items-start">
          {/* 구분 (장비/설치비) */}
          <div className="col-span-1">
            <Select
              value={item.category}
              onValueChange={(value) => updateItem(index, 'category', value)}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equipment">장비</SelectItem>
                <SelectItem value="installation">설치</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 항목명 */}
          <div className="col-span-4">
            <Input
              placeholder="예: 벽걸이형 16평 1대"
              value={item.itemName}
              onChange={(e) => updateItem(index, 'itemName', e.target.value)}
              className="h-9"
            />
          </div>

          {/* 수량 */}
          <div className="col-span-2">
            <Input
              type="number"
              min="1"
              value={item.quantity}
              onChange={(e) => updateItem(index, 'quantity', e.target.value)}
              className="h-9"
            />
          </div>

          {/* 단가 (판매가!) */}
          <div className="col-span-2">
            <Input
              type="number"
              min="0"
              placeholder="0"
              value={item.unitPrice || ''}
              onChange={(e) => updateItem(index, 'unitPrice', e.target.value)}
              className="h-9"
            />
          </div>

          {/* 금액 (자동 계산) */}
          <div className="col-span-2">
            <Input
              value={item.totalPrice.toLocaleString('ko-KR')}
              disabled
              className="h-9 bg-muted"
            />
          </div>

          {/* 삭제 버튼 */}
          <div className="col-span-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeItem(index)}
              className="h-9 w-9"
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
      ))}

      {/* 항목 추가 버튼 */}
      <Button
        type="button"
        variant="outline"
        onClick={addItem}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        항목 추가
      </Button>

      {/* 총 금액 표시 */}
      {items.length > 0 && (
        <div className="pt-4 border-t">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">총 견적 금액</span>
            <span className="text-2xl font-bold text-blue-600">
              {items.reduce((sum, item) => sum + item.totalPrice, 0).toLocaleString('ko-KR')} 원
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
