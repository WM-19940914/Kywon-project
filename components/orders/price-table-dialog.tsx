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
import { ClipboardList, Search, ArrowRight, Zap } from 'lucide-react'
import { priceTable, formatPrice, type PriceTableRow, type ComponentDetail } from '@/lib/price-table'

interface PriceTableSheetProps {
  onSelect: (model: string, size: string, category: string, components?: ComponentDetail[]) => void
}

/** 카테고리별로 데이터를 그룹핑하는 함수 */
function groupByCategory(rows: PriceTableRow[]) {
  const groups: { category: string; items: PriceTableRow[] }[] = []
  for (const row of rows) {
    const existing = groups.find(g => g.category === row.category)
    if (existing) {
      existing.items.push(row)
    } else {
      groups.push({ category: row.category, items: [row] })
    }
  }
  return groups
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

  // 카테고리별 그룹핑
  const grouped = groupByCategory(filteredTable)

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

      <SheetContent className="w-[35vw] min-w-[550px] p-0 overflow-hidden flex flex-col">
        {/* 헤더 영역 */}
        <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-b from-slate-50 to-white">
          <SheetHeader>
            <SheetTitle className="text-xl font-bold text-gray-900">
              2026년 연간 단가표
            </SheetTitle>
            <p className="text-sm text-gray-500 mt-1">
              원하는 제품을 클릭하면 견적서에 자동 입력됩니다
            </p>
          </SheetHeader>

          {/* 검색창 */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 placeholder:text-gray-400"
              placeholder="품목, 모델명, 평형으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* 테이블 영역 (스크롤) */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {grouped.map((group) => (
            <div key={group.category}>
              {/* 카테고리 헤더 */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                  {group.category}
                </span>
                <span className="text-xs text-gray-400">
                  {group.items.length}개 제품
                </span>
              </div>

              {/* 제품 카드 리스트 */}
              <div className="space-y-1.5">
                {group.items.map((row, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleRowClick(row)}
                    className="w-full text-left group rounded-lg border border-gray-150 bg-white px-4 py-3 hover:border-blue-300 hover:bg-blue-50/60 hover:shadow-sm active:scale-[0.99] transition-all duration-150 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      {/* 왼쪽: 모델 정보 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          {/* 평형 뱃지 */}
                          <span className="inline-flex items-center justify-center min-w-[40px] px-2 py-0.5 text-xs font-bold text-gray-700 bg-gray-100 rounded-md group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                            {row.size}
                          </span>
                          {/* 모델명 - 크고 눈에 띄게 */}
                          <span className="text-lg font-mono font-semibold text-gray-800 group-hover:text-blue-700 truncate">
                            {row.model}
                          </span>
                        </div>
                        {/* 구성품 표시 */}
                        <div className="mt-1.5 flex items-center gap-1.5 ml-0.5">
                          {row.components.map((comp, ci) => (
                            <span key={ci} className="text-[11px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                              {comp.type}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* 오른쪽: 가격 + 화살표 */}
                      <div className="flex items-center gap-3 ml-4 shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-semibold text-gray-700 group-hover:text-blue-600 transition-colors">
                            {formatPrice(row.price)}
                          </div>
                          <div className="text-[10px] text-gray-400">VAT 별도</div>
                        </div>
                        {/* 클릭 유도 화살표 (hover 시 나타남) */}
                        <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <ArrowRight className="h-3.5 w-3.5 text-white" />
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* 검색 결과 없을 때 */}
          {grouped.length === 0 && (
            <div className="text-center py-12">
              <Search className="h-8 w-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">검색 결과가 없습니다</p>
              <p className="text-xs text-gray-300 mt-1">다른 키워드로 검색해 보세요</p>
            </div>
          )}
        </div>

        {/* 하단 안내 */}
        <div className="border-t bg-slate-50 px-6 py-3">
          <div className="flex items-start gap-2">
            <Zap className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-gray-500 leading-relaxed">
              제품을 클릭하면 품목·모델명·단가가 자동 입력됩니다.
              단가는 참고용이며, 실제 견적은 현장 확인 후 결정됩니다.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
