/**
 * 연간 단가표 페이지
 *
 * 교원그룹 단가표를 조회하는 페이지입니다.
 * SET 모델을 클릭하면 구성품(실내기, 실외기, 자재박스 등) 상세 정보를 확장해서 보여줍니다.
 */

'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, FileText } from 'lucide-react'
import { priceTable, formatPrice } from '@/lib/price-table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

export default function PriceTablePage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // 구성품 순서 정의 (실외기 → 실내기 → 자재박스 → 브라켓/리모컨)
  const componentOrder: { [key: string]: number } = {
    '실외기': 1,
    '실내기': 2,
    '자재박스': 3,
    '브라켓': 4,
    '기타': 5
  }

  // 구성품 정렬 함수
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortComponents = (components: any[]) => {
    return [...components].sort((a, b) => {
      const orderA = componentOrder[a.type] || 999
      const orderB = componentOrder[b.type] || 999
      return orderA - orderB
    })
  }

  // 구성품은 이미 엑셀에서 판매가(salePrice)를 가져왔으므로 계산 불필요

  // 6평형 냉방전용 제외
  const filteredPriceTable = priceTable.filter(row =>
    row.model !== 'AR06D1150HZS'
  )

  // 검색 필터링
  const displayedTable = filteredPriceTable.filter(row =>
    row.category.includes(searchTerm) ||
    row.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.size.includes(searchTerm)
  )

  // 행 확장/축소 토글
  const toggleRow = (model: string) => {
    const newExpandedRows = new Set(expandedRows)
    if (expandedRows.has(model)) {
      newExpandedRows.delete(model)
    } else {
      newExpandedRows.add(model)
    }
    setExpandedRows(newExpandedRows)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-xl">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">연간 단가표</h1>
            <p className="text-sm text-gray-600">2026년 기준 교원그룹 단가표</p>
          </div>
        </div>

        <Badge variant="outline" className="text-sm">
          총 {displayedTable.length}개 제품
        </Badge>
      </div>

      {/* 검색창 */}
      <div className="bg-white rounded-xl border p-4">
        <Input
          placeholder="품목, 모델명, 평형으로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* 단가표 테이블 */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* 테이블 헤더 */}
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-12"></th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">품목</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">SET 모델명</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">판매가 (VAT별도)</th>
              </tr>
            </thead>

            {/* 테이블 바디 */}
            <tbody>
              {displayedTable.map((row) => {
                const isExpanded = expandedRows.has(row.model)

                return (
                  <>
                    {/* SET 모델 행 */}
                    <tr
                      key={row.model}
                      onClick={() => toggleRow(row.model)}
                      className="border-b hover:bg-blue-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-600" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-600" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">
                          {row.category} {row.size}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-gray-800">{row.model}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-blue-600">
                          {formatPrice(row.price)}
                        </span>
                      </td>
                    </tr>

                    {/* 구성품 상세 정보 (확장 시 표시) */}
                    {isExpanded && (() => {
                      const sortedComponents = sortComponents(row.components)

                      return (
                        <tr key={`${row.model}-details`} className="bg-gray-50">
                          <td colSpan={4} className="px-4 py-4">
                            <div className="ml-8">
                              <div className="text-xs font-semibold text-gray-600 mb-3">
                                📦 구성품 상세
                              </div>

                              {/* 구성품 테이블 */}
                              <table className="w-full border rounded-lg overflow-hidden bg-white">
                                <thead className="bg-gray-100 border-b">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">구성품</th>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">모델명</th>
                                    <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700">수량</th>
                                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700">판매가 (VAT별도)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sortedComponents.map((comp, idx) => (
                                    <tr key={idx} className="border-b last:border-b-0">
                                      <td className="px-4 py-2 text-sm text-gray-700">{comp.type}</td>
                                      <td className="px-4 py-2 text-sm font-mono text-gray-800">{comp.model}</td>
                                      <td className="px-4 py-2 text-sm text-center text-gray-700">{comp.quantity}개</td>
                                      <td className="px-4 py-2 text-sm text-right font-semibold text-blue-600">
                                        {comp.salePrice.toLocaleString()}원
                                      </td>
                                    </tr>
                                  ))}
                                  {/* 합계 행 */}
                                  <tr className="bg-blue-50 border-t-2 border-blue-200">
                                    <td colSpan={3} className="px-4 py-2 text-sm font-semibold text-gray-800">
                                      구성품 판매가 합계
                                    </td>
                                    <td className="px-4 py-2 text-sm text-right font-bold text-blue-600">
                                      {row.components
                                        .reduce((sum, comp) => sum + comp.salePrice, 0)
                                        .toLocaleString()}원
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )
                    })()}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 안내 문구 */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
        <p className="text-sm text-blue-800 leading-relaxed">
          <strong>💡 사용 방법</strong>
          <br />
          • SET 모델 행을 클릭하면 구성품별 판매가를 확인할 수 있습니다
          <br />
          • 구성품 표시 순서: 실외기 → 실내기 → 자재박스 → 리모컨
          <br />
          • 스탠드형: 실외기/실내기/자재박스로 구성 (3개)
          <br />
          • 벽걸이형: 실외기/실내기/자재박스/리모컨으로 구성 (4개)
          <br />
          • 표시되는 판매가는 모두 VAT 별도 금액입니다
          <br />
          • 구성품 판매가 합계 = SET 판매가
        </p>
      </div>
    </div>
  )
}
