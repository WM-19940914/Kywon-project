/**
 * 철거보관 전용 단가표 Sheet (우측 Drawer)
 *
 * 배송관리의 DeliveryPriceTableSheet를 기반으로 철거보관용으로 커스텀.
 * - 철거보관은 실내기/실외기만 해당 (자재박스, 브라켓, 리모컨 제외)
 * - SET 모델 선택 시 → 실내기 + 실외기 2행만 추가
 * - 개별 부품(실내기 또는 실외기 단독)으로도 등록 가능
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

/** 구성품 미리보기 정보 (SET 모델일 때 표시용) */
export interface ComponentInfo {
  type: string   // 실내기 / 실외기
  model: string  // 구성품 모델명
}

/** 장비 행 데이터 (폼 테이블에 추가될 행) */
export interface EquipmentRow {
  category: string        // 품목 (스탠드에어컨/벽걸이에어컨)
  equipmentUnitType?: string // 장비 유형 (indoor/outdoor 등)
  model: string           // 모델명 (구성품 모델명)
  size: string            // 평형
  manufacturer: string    // 제조사 (기본: 삼성)
  manufacturingDate: string // 제조년월
  quantity: number        // 수량
  components?: ComponentInfo[] // SET 모델일 때 구성품 목록 (표시용)
}

interface StoredEquipmentPriceSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 장비 행 추가 콜백 — 1개 이상의 행을 추가 */
  onAddRows: (rows: EquipmentRow[]) => void
}

/** 구성품 타입 → 품목(category) 변환 */
function componentTypeToCategory(type: string, setCategory: string): string {
  // SET의 카테고리를 기반으로 품목 결정
  if (setCategory.includes('벽걸이')) return '벽걸이에어컨'
  return '스탠드에어컨'
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

export function StoredEquipmentPriceSheet({
  open,
  onOpenChange,
  onAddRows,
}: StoredEquipmentPriceSheetProps) {
  const [searchTerm, setSearchTerm] = useState('')
  // 개별 부품 모드: true이면 구성품 하나씩 선택
  const [partMode, setPartMode] = useState(false)

  // 검색 필터링
  const filteredTable = priceTable.filter(row =>
    row.category.includes(searchTerm) ||
    row.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.size.includes(searchTerm) ||
    row.components.some(c =>
      c.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.type.includes(searchTerm)
    )
  )

  const grouped = groupByCategory(filteredTable)

  /** SET 모델 선택 → 구성품(실내기/실외기)별 개별 행 추가 */
  const handleSetSelect = (row: PriceTableRow) => {
    const category = row.category.includes('벽걸이') ? '벽걸이에어컨' : '스탠드에어컨'

    // 실내기/실외기 각각 개별 행으로 생성
    const equipRows: EquipmentRow[] = row.components
      .filter(c => c.type === '실내기' || c.type === '실외기')
      .map(c => ({
        category,
        equipmentUnitType: c.type === '실내기' ? 'indoor' : 'outdoor',
        model: c.model,       // 구성품 모델명 (실내기/실외기 각각)
        size: row.size,
        manufacturer: '삼성',
        manufacturingDate: '',
        quantity: c.quantity,
      }))

    onAddRows(equipRows)
    onOpenChange(false)
    setSearchTerm('')
  }

  /** 개별 부품 선택 */
  const handlePartSelect = (comp: ComponentDetail, row: PriceTableRow) => {
    const equipRow: EquipmentRow = {
      category: componentTypeToCategory(comp.type, row.category),
      equipmentUnitType: comp.type === '실내기' ? 'indoor' : comp.type === '실외기' ? 'outdoor' : 'etc',
      model: comp.model,
      size: row.size,
      manufacturer: '삼성',
      manufacturingDate: '',
      quantity: comp.quantity,
    }
    onAddRows([equipRow])
    onOpenChange(false)
    setSearchTerm('')
  }

  return (
    <Sheet open={open} onOpenChange={(v) => {
      onOpenChange(v)
      if (!v) {
        setSearchTerm('')
        setPartMode(false)
      }
    }}>
      <SheetContent className="w-[35vw] min-w-[480px] p-0 overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-b from-slate-50 to-white">
          <SheetHeader>
            <SheetTitle className="text-xl font-bold text-gray-900">
              단가표로 장비 등록
            </SheetTitle>
            <p className="text-sm text-gray-500 mt-1">
              {partMode
                ? '개별 부품(실내기 또는 실외기)을 선택하세요'
                : 'SET 모델을 클릭하면 실내기·실외기가 각각 개별 행으로 추가됩니다'}
            </p>
          </SheetHeader>

          {/* 검색 + 모드 토글 */}
          <div className="flex gap-2 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 placeholder:text-gray-400"
                placeholder="품목, 모델명, 평형으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => setPartMode(!partMode)}
              className={`px-3 py-2 text-xs font-medium rounded-lg border whitespace-nowrap transition-colors ${
                partMode
                  ? 'bg-orange-50 border-orange-300 text-orange-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {partMode ? '부품 모드' : 'SET 모드'}
            </button>
          </div>
        </div>

        {/* 리스트 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {grouped.map((group) => (
            <div key={group.category}>
              {/* 카테고리 뱃지 */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                  {group.category}
                </span>
                <span className="text-xs text-gray-400">
                  {group.items.length}개 제품
                </span>
              </div>

              {/* SET 모델 카드 */}
              <div className="space-y-1.5">
                {group.items.map((row) => (
                  <div key={row.model} className="rounded-lg border border-gray-150 bg-white overflow-hidden">
                    {/* SET 모델 버튼 */}
                    <button
                      type="button"
                      onClick={() => !partMode && handleSetSelect(row)}
                      className={`w-full text-left group px-4 py-3 transition-all duration-150 ${
                        partMode
                          ? 'cursor-default'
                          : 'hover:border-blue-300 hover:bg-blue-50/60 hover:shadow-sm active:scale-[0.99] cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center justify-center min-w-[40px] px-2 py-0.5 text-xs font-bold text-gray-700 bg-gray-100 rounded-md group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors">
                              {row.size}
                            </span>
                            <span className="text-sm font-mono font-semibold text-gray-800 group-hover:text-blue-700 truncate">
                              {row.model}
                            </span>
                          </div>
                          {/* 구성품 미리보기 — 실내기/실외기만 */}
                          <div className="mt-1.5 flex items-start gap-2 ml-0.5">
                            {row.components
                              .filter(c => c.type === '실내기' || c.type === '실외기')
                              .map((comp, ci) => (
                                <div
                                  key={ci}
                                  className="flex flex-col items-start bg-gray-50 px-2 py-1 rounded group-hover:bg-blue-50 transition-colors"
                                >
                                  <span className="text-[10px] font-medium text-gray-500 group-hover:text-blue-600">
                                    [{comp.type}]
                                  </span>
                                  <span className="text-[11px] font-mono text-gray-600 group-hover:text-blue-700">
                                    {comp.model}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                        {!partMode && (
                          <div className="ml-4 shrink-0">
                            <span className="text-xs text-gray-400 group-hover:text-blue-500">
                              실내기+실외기
                            </span>
                          </div>
                        )}
                      </div>
                    </button>

                    {/* 부품 모드: 개별 구성품 선택 버튼 */}
                    {partMode && (
                      <div className="border-t border-gray-100 px-4 py-2 flex gap-2 bg-orange-50/30">
                        {row.components
                          .filter(c => c.type === '실내기' || c.type === '실외기')
                          .map((comp, ci) => (
                            <button
                              key={ci}
                              type="button"
                              onClick={() => handlePartSelect(comp, row)}
                              className="flex-1 text-left px-3 py-2 rounded-md border border-orange-200 bg-white hover:bg-orange-50 hover:border-orange-400 transition-colors cursor-pointer"
                            >
                              <div className="text-[10px] font-bold text-orange-600">{comp.type}</div>
                              <div className="text-xs font-mono text-gray-700 mt-0.5">{comp.model}</div>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* 검색 결과 없음 */}
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
              철거보관은 <strong>실내기·실외기</strong>만 등록됩니다. 우측 상단 버튼으로 SET/부품 모드를 전환할 수 있습니다.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
