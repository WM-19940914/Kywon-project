/**
 * 단가표 Sheet (우측 Drawer)
 *
 * 각 작업 항목에서 "단가표로 입력하기" 버튼을 눌렀을 때
 * 우측에서 슬라이드로 나타나는 단가표입니다.
 * 행을 클릭하면 해당 모델명/평형이 자동으로 입력됩니다.
 */

'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ClipboardList, Lightbulb } from 'lucide-react'
import { priceTable, formatPrice, type PriceTableRow, type ComponentDetail } from '@/lib/price-table'

interface PriceTableSheetProps {
  onSelect: (model: string, size: string, category: string, components?: ComponentDetail[]) => void
}

export function PriceTableSheet({ onSelect }: PriceTableSheetProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  // 검색 필터링
  const filteredTable = priceTable.filter(row =>
    row.category.includes(searchTerm) ||
    row.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.size.includes(searchTerm)
  )

  // 행 클릭 핸들러
  const handleRowClick = (row: PriceTableRow) => {
    onSelect(row.model, row.size, row.category, row.components)
    setIsOpen(false)
    setSearchTerm('')
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ClipboardList className="h-4 w-4" />
          단가표로 입력하기
        </Button>
      </SheetTrigger>

      <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>2026년 연간 단가표</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* 검색창 */}
          <Input
            placeholder="품목, 모델명, 평형으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {/* 단가표 테이블 */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">품목</th>
                  <th className="px-3 py-2 text-left font-medium">모델명</th>
                  <th className="px-3 py-2 text-center font-medium">평형</th>
                  <th className="px-3 py-2 text-right font-medium">단가</th>
                </tr>
              </thead>
              <tbody>
                {filteredTable.map((row, index) => (
                  <tr
                    key={index}
                    onClick={() => handleRowClick(row)}
                    className="border-t hover:bg-blue-50 cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-3 font-medium">{row.category}</td>
                    <td className="px-3 py-3 font-mono text-xs">{row.model}</td>
                    <td className="px-3 py-3 text-center">{row.size}</td>
                    <td className="px-3 py-3 text-right font-semibold">
                      {formatPrice(row.price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 안내문구 */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-xs text-blue-800 leading-relaxed">
              <strong className="flex items-center gap-1"><Lightbulb className="h-3 w-3" /> 사용 방법</strong>
              <br />
              • 원하는 항목을 클릭하면 자동으로 입력됩니다
              <br />
              • 단가는 참고용이며, 실제 견적은 현장 확인 후 결정됩니다
              <br />
              • 모델명이나 평형을 모를 경우 직접 &quot;미확인&quot;으로 입력하세요
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
