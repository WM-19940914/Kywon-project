/**
 * 배송관리 전용 단가표 Sheet (우측 Drawer)
 *
 * SET 모델 클릭 → 구성품 전체(실내기, 실외기, 자재박스, 리모컨)를
 * 현재 행부터 한꺼번에 자동 입력.
 * 행이 부족하면 자동으로 추가됨.
 *
 * 사용처: 배송관리 아코디언 내 각 행의 모델명 입력 옆 버튼
 */

'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Search, Zap } from 'lucide-react'
import { priceTable, type PriceTableRow, type ComponentDetail } from '@/lib/price-table'

interface DeliveryPriceTableSheetProps {
  /** Sheet 열림/닫힘 상태 */
  open: boolean
  /** Sheet 열림/닫힘 변경 콜백 */
  onOpenChange: (open: boolean) => void
  /** SET 모델 선택 콜백 — 구성품 전체 배열 + SET 모델명을 반환 */
  onSelectSet: (components: ComponentDetail[], setModel: string) => void
}

/** 카테고리별로 데이터를 그룹핑 */
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

export function DeliveryPriceTableSheet({ open, onOpenChange, onSelectSet }: DeliveryPriceTableSheetProps) {
  const [searchTerm, setSearchTerm] = useState('')

  // 검색 필터링
  const filteredTable = priceTable.filter(row =>
    row.category.includes(searchTerm) ||
    row.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.size.includes(searchTerm) ||
    row.components.some(c => c.model.toLowerCase().includes(searchTerm.toLowerCase()) || c.type.includes(searchTerm))
  )

  // 카테고리별 그룹핑
  const grouped = groupByCategory(filteredTable)

  /** SET 모델 클릭 → 구성품 전체 + SET 모델명 전달 후 Sheet 닫기 */
  const handleSetModelClick = (row: PriceTableRow) => {
    onSelectSet(row.components, row.model)
    onOpenChange(false)
    setSearchTerm('')
  }

  return (
    <Sheet open={open} onOpenChange={(v) => {
      onOpenChange(v)
      if (!v) setSearchTerm('')
    }}>
      <SheetContent className="w-[35vw] min-w-[480px] p-0 overflow-hidden flex flex-col">
        {/* 헤더 영역 */}
        <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-b from-slate-50 to-white">
          <SheetHeader>
            <SheetTitle className="text-xl font-bold text-gray-900">
              구성품 단가표
            </SheetTitle>
            <p className="text-sm text-gray-500 mt-1">
              SET 모델을 클릭하면 구성품이 현재 행부터 자동 입력됩니다
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

              {/* SET 모델 카드 리스트 */}
              <div className="space-y-1.5">
                {group.items.map((row) => (
                  <button
                    key={row.model}
                    type="button"
                    onClick={() => handleSetModelClick(row)}
                    className="w-full text-left group rounded-lg border border-gray-150 bg-white px-4 py-3 hover:border-blue-300 hover:bg-blue-50/60 hover:shadow-sm active:scale-[0.99] transition-all duration-150 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          {/* 평형 뱃지 */}
                          <span className="inline-flex items-center justify-center min-w-[40px] px-2 py-0.5 text-xs font-bold text-gray-700 bg-gray-100 rounded-md group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                            {row.size}
                          </span>
                          {/* SET 모델명 */}
                          <span className="text-sm font-mono font-semibold text-gray-800 group-hover:text-blue-700 truncate">
                            {row.model}
                          </span>
                        </div>
                        {/* 구성품 목록 (타입 + 모델명 위아래) */}
                        <div className="mt-1.5 flex items-start gap-2 ml-0.5">
                          {row.components.map((comp, ci) => (
                            <div key={ci} className="flex flex-col items-start bg-gray-50 px-2 py-1 rounded group-hover:bg-blue-50 transition-colors">
                              <span className="text-[10px] font-medium text-gray-500 group-hover:text-blue-600">[{comp.type}]</span>
                              <span className="text-[11px] font-mono text-gray-600 group-hover:text-blue-700">{comp.model}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* 구성품 수 표시 */}
                      <div className="ml-4 shrink-0">
                        <span className="text-xs text-gray-400 group-hover:text-blue-500">
                          {row.components.length}개 구성품
                        </span>
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
              SET 모델을 클릭하면 실내기·실외기·자재박스(·리모컨)가 현재 행부터 자동 입력됩니다. 행이 부족하면 자동으로 추가됩니다.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
