/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 교원그룹용 단가표 (읽기 전용)
 *
 * 장비 탭: 판매가만 표시 (출하가/DC율/매입가 숨김, 수정/삭제 불가)
 * 설치비 탭: 그대로 표시 (행추가/수정 불가)
 */

'use client'

import { useState, useEffect } from 'react'
import { BookOpen, ChevronDown, ChevronRight, Search, Package, Hammer } from 'lucide-react'
import { ExcelExportButton } from '@/components/ui/excel-export-button'
import { exportToExcel, buildExcelFileName, type ExcelColumn } from '@/lib/excel-export'
import { fetchPriceTable, fetchInstallationPriceItems } from '@/lib/supabase/dal'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

// 가격 포맷팅
function formatPrice(price: number): string {
  return `${price.toLocaleString('ko-KR')}원`
}

export default function KyowonPriceTablePage() {
  // 탭 상태
  const [activeTab, setActiveTab] = useState<'equipment' | 'installation'>('equipment')

  // 장비 단가 데이터
  const [priceTable, setPriceTable] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // 설치비 — 전기공사/기타공사 (DB에서 읽기만)
  const [elecRows, setElecRows] = useState<{ category: string; model: string }[]>([])
  const [etcRows, setEtcRows] = useState<{ category: string; model: string }[]>([])

  // 장비 데이터 로드
  useEffect(() => {
    fetchPriceTable().then(data => {
      const categoryOrder: Record<string, number> = {
        '스탠드형 냉난방': 1,
        '스탠드형 냉난방 삼상': 2,
        '스탠드형 냉난방 단상': 3,
        '스탠드형 냉방전용': 4,
        '벽걸이형 냉난방': 5,
        '벽걸이형 냉방전용': 6,
      }
      const getSizeNum = (size: string) => parseInt(size.replace('평', ''))
      const sorted = [...data].sort((a, b) => {
        const catA = categoryOrder[a.category] || 999
        const catB = categoryOrder[b.category] || 999
        if (catA !== catB) return catA - catB
        return getSizeNum(b.size) - getSizeNum(a.size)
      })
      setPriceTable(sorted)
      setIsLoading(false)
    })
  }, [])

  // 설치비 데이터 로드
  useEffect(() => {
    fetchInstallationPriceItems('electric').then(items => {
      if (items.length > 0) setElecRows(items.map(r => ({ category: r.category, model: r.model })))
    })
    fetchInstallationPriceItems('etc').then(items => {
      if (items.length > 0) setEtcRows(items.map(r => ({ category: r.category, model: r.model })))
    })
  }, [])

  // 구성품 정렬
  const componentOrder: { [key: string]: number } = { '실외기': 1, '실내기': 2, '자재박스': 3, '브라켓': 4, '기타': 5 }
  const sortComponents = (components: any[]) => {
    return [...components].sort((a, b) => (componentOrder[a.type] || 999) - (componentOrder[b.type] || 999))
  }

  // 검색 필터
  const displayedTable = priceTable.filter(row =>
    row.category.includes(searchTerm) ||
    row.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.size.includes(searchTerm)
  )

  // 행 확장/축소
  const toggleRow = (model: string) => {
    const next = new Set(expandedRows)
    if (next.has(model)) next.delete(model)
    else next.add(model)
    setExpandedRows(next)
  }

  /** 장비 단가표 엑셀 다운로드 — 판매가만 (출하가/매입가 제외) */
  const handleEquipmentExcelExport = () => {
    const rows: Record<string, unknown>[] = []
    displayedTable.forEach((set: any) => {
      const sorted = sortComponents(set.components || [])
      sorted.forEach((comp: any, idx: number) => {
        rows.push({
          category: idx === 0 ? `${set.category} ${set.size}` : '',
          setModel: idx === 0 ? set.model : '',
          setPrice: idx === 0 ? set.price : '',
          compType: comp.type,
          compModel: comp.model,
          compQty: comp.quantity,
          compSalePrice: comp.salePrice || 0,
        })
      })
    })
    const columns: ExcelColumn<Record<string, unknown>>[] = [
      { header: '품목', key: 'category', width: 22 },
      { header: 'SET모델명', key: 'setModel', width: 22 },
      { header: '판매가(VAT별도)', key: 'setPrice', width: 16, numberFormat: '#,##0' },
      { header: '구성품', key: 'compType', width: 10 },
      { header: '구성품모델명', key: 'compModel', width: 22 },
      { header: '수량', key: 'compQty', width: 6 },
      { header: '구성품판매가', key: 'compSalePrice', width: 14, numberFormat: '#,##0' },
    ]
    exportToExcel({
      data: rows,
      columns,
      fileName: buildExcelFileName('단가표', '장비단가'),
      sheetName: '장비단가',
    })
  }

  // 로딩 중
  if (isLoading) {
    return (
      <div className="container mx-auto max-w-[1400px] py-6 px-4 md:px-6">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div>
            <Skeleton className="h-7 w-40 mb-1.5" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
          <Skeleton className="h-10 w-full max-w-md rounded-lg" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3 border-b border-slate-100">
              <Skeleton className="h-5 w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-[1400px] py-6 px-4 md:px-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">단가표</h1>
            <p className="text-muted-foreground mt-0.5">
              {activeTab === 'equipment' ? 'SET 모델 및 구성품 판매가를 조회합니다' : '설치 공사 항목별 단가를 조회합니다'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'equipment' && (
            <Badge variant="outline" className="text-sm border-slate-200">
              총 {displayedTable.length}개 제품
            </Badge>
          )}
          {activeTab === 'equipment' && (
            <ExcelExportButton onClick={handleEquipmentExcelExport} disabled={displayedTable.length === 0} />
          )}
        </div>
      </div>

      {/* 탭 전환 */}
      <div className="flex items-center gap-1 mb-5 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('equipment')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'equipment'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Package className="h-4 w-4" />
          장비 단가
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('installation')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'installation'
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Hammer className="h-4 w-4" />
          설치비 단가
        </button>
      </div>

      {/* ══════ 장비 단가 탭 (판매가만) ══════ */}
      {activeTab === 'equipment' && (
      <>
        {/* 검색창 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="품목, 모델명, 평형으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 rounded-lg bg-white border-slate-200"
            />
          </div>
        </div>

        {/* 단가표 테이블 — 판매가만 표시 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold w-12"></th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold">품목</th>
                  <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold">SET 모델명</th>
                  <th className="px-4 py-3 text-right text-xs text-slate-500 font-semibold">판매가 (VAT별도)</th>
                </tr>
              </thead>
              <tbody>
                {displayedTable.map((row) => {
                  const isExpanded = expandedRows.has(row.model)
                  return (
                    <>
                      {/* SET 모델 행 */}
                      <tr
                        key={row.model}
                        className="border-b border-slate-200 hover:bg-blue-50/40 transition-colors cursor-pointer"
                        onClick={() => toggleRow(row.model)}
                      >
                        <td className="px-4 py-3">
                          {isExpanded
                            ? <ChevronDown className="h-4 w-4 text-slate-500" />
                            : <ChevronRight className="h-4 w-4 text-slate-500" />
                          }
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-900">{row.category} {row.size}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm text-gray-800">{row.model}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold text-blue-600">{formatPrice(row.price)}</span>
                        </td>
                      </tr>

                      {/* 구성품 상세 (확장 시) — 판매가만 */}
                      {isExpanded && (() => {
                        const sortedComponents = sortComponents(row.components)
                        return (
                          <tr key={`${row.model}-details`} className="bg-slate-50/60">
                            <td colSpan={4} className="px-4 py-4">
                              <div className="ml-8">
                                <div className="text-xs font-semibold text-slate-500 mb-3">구성품 상세</div>
                                <table className="w-full border border-slate-200 rounded-lg overflow-hidden bg-white">
                                  <thead className="bg-slate-50/80 border-b border-slate-200">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs text-slate-500 font-semibold">구성품</th>
                                      <th className="px-4 py-2 text-left text-xs text-slate-500 font-semibold">모델명</th>
                                      <th className="px-4 py-2 text-center text-xs text-slate-500 font-semibold">수량</th>
                                      <th className="px-4 py-2 text-right text-xs text-slate-500 font-semibold">판매가 (VAT별도)</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sortedComponents.map((comp: any, idx: number) => (
                                      <tr key={idx} className="border-b border-slate-100 last:border-b-0 hover:bg-blue-50/40 transition-colors">
                                        <td className="px-4 py-2 text-sm text-gray-700">{comp.type}</td>
                                        <td className="px-4 py-2 text-sm font-mono text-gray-800">{comp.model}</td>
                                        <td className="px-4 py-2 text-sm text-center text-gray-700">{comp.quantity}개</td>
                                        <td className="px-4 py-2 text-sm text-right font-semibold text-blue-600">
                                          {comp.salePrice.toLocaleString()}원
                                        </td>
                                      </tr>
                                    ))}
                                    {/* 합계 */}
                                    <tr className="bg-blue-50 border-t-2 border-blue-200">
                                      <td colSpan={3} className="px-4 py-2 text-sm font-semibold text-gray-800">합계</td>
                                      <td className="px-4 py-2 text-sm text-right font-bold text-blue-600">
                                        {row.components.reduce((sum: number, c: any) => sum + c.salePrice, 0).toLocaleString()}원
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

        {/* 안내 */}
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 mt-6">
          <p className="text-sm text-blue-800 leading-relaxed">
            <strong>사용 방법</strong><br />
            SET 모델 행을 클릭하면 구성품별 판매가를 확인할 수 있습니다.
            표시되는 판매가는 모두 VAT 별도 금액이며, 구성품 판매가 합계 = SET 판매가 입니다.
          </p>
        </div>
      </>
      )}

      {/* ══════ 설치비 단가 탭 (읽기 전용) ══════ */}
      {activeTab === 'installation' && (
        <div className="flex gap-6 items-start">
          {/* ── 좌측: 단가계약 설치비 ── */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-[13px] font-bold text-slate-700">단가계약 항목</span>
              <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">고정 단가</span>
            </div>
            <div className="max-w-[400px] space-y-5">

              {/* 신규 설치비 */}
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200/80 flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-blue-500" />
                  <h3 className="text-[13px] font-bold text-slate-800">신규 설치비</h3>
                </div>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '130px' }}>품목</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '130px' }}>모델명</th>
                      <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '120px' }}>단가 (VAT별도)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { category: '신규 설치비_스탠드형', model: '58평형 이상', price: '360,000' },
                      { category: '신규 설치비_스탠드형', model: '30평형 이상', price: '280,000' },
                      { category: '신규 설치비_스탠드형', model: '23평형', price: '150,000' },
                      { category: '신규 설치비_스탠드형', model: '23평형 미만', price: '130,000' },
                      { category: '신규 설치비_벽걸이형', model: '13평형', price: '60,000' },
                      { category: '신규 설치비_벽걸이형', model: '9평형', price: '60,000' },
                      { category: '신규 설치비_벽걸이형', model: '7평형', price: '60,000' },
                      { category: '신규 설치비_벽걸이형', model: '6평형', price: '60,000' },
                    ].map((row, i) => (
                      <tr key={`ns-${i}`} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-5 py-2 font-semibold text-slate-700 border-r border-slate-100">{row.category}</td>
                        <td className="px-4 py-2 text-slate-600">{row.model}</td>
                        <td className="px-5 py-2 text-right font-semibold text-slate-800 tabular-nums">{row.price}원</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 이전 설치비 */}
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200/80 flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-violet-500" />
                  <h3 className="text-[13px] font-bold text-slate-800">이전 설치비</h3>
                </div>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '130px' }}>품목</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '130px' }}>모델명</th>
                      <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '120px' }}>단가 (VAT별도)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { category: '이전 설치비_스탠드형', model: '58평형 이상', price: '360,000' },
                      { category: '이전 설치비_스탠드형', model: '30평형 이상', price: '300,000' },
                      { category: '이전 설치비_스탠드형', model: '23평형', price: '150,000' },
                      { category: '이전 설치비_스탠드형', model: '23평형 미만', price: '130,000' },
                      { category: '이전 설치비_벽걸이형', model: '13평형', price: '60,000' },
                      { category: '이전 설치비_벽걸이형', model: '9평형', price: '60,000' },
                      { category: '이전 설치비_벽걸이형', model: '7평형', price: '60,000' },
                      { category: '이전 설치비_벽걸이형', model: '6평형', price: '60,000' },
                    ].map((row, i) => (
                      <tr key={`os-${i}`} className="hover:bg-violet-50/30 transition-colors">
                        <td className="px-5 py-2 font-semibold text-slate-700 border-r border-slate-100">{row.category}</td>
                        <td className="px-4 py-2 text-slate-600">{row.model}</td>
                        <td className="px-5 py-2 text-right font-semibold text-slate-800 tabular-nums">{row.price}원</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 추가 설치비 */}
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200/80 flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-emerald-500" />
                  <h3 className="text-[13px] font-bold text-slate-800">추가 설치비</h3>
                </div>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '130px' }}>품목</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '130px' }}>모델명</th>
                      <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '120px' }}>단가 (VAT별도)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { category: '냉매관 설치', model: '냉매관 Φ22.09mm', price: '17,000' },
                      { category: '냉매관 설치', model: '냉매관 Φ19.05mm', price: '14,000' },
                      { category: '냉매관 설치', model: '냉매관 Φ15.88mm_K', price: '13,000' },
                      { category: '냉매관 설치', model: '냉매관 Φ12.70mm', price: '9,000' },
                      { category: '냉매관 설치', model: '냉매관 Φ09.52mm', price: '7,900' },
                      { category: '냉매관 설치', model: '냉매관 Φ06.35mm', price: '2,500' },
                      { category: '실내전원통신', model: '-', price: '7,500' },
                      { category: '배수펌프', model: '10m', price: '100,000' },
                      { category: '실외기거치대', model: '앵글', price: '100,000' },
                      { category: '실외기거치대', model: '일자받침대', price: '28,000' },
                    ].map((row, i) => (
                      <tr key={`ex-${i}`} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="px-5 py-2 font-semibold text-slate-700 border-r border-slate-100">{row.category}</td>
                        <td className={`px-4 py-2 ${row.model === '-' ? 'text-slate-400' : 'text-slate-600'} ${i < 6 ? 'font-mono text-[11px]' : ''}`}>{row.model}</td>
                        <td className="px-5 py-2 text-right font-semibold text-slate-800 tabular-nums">{row.price}원</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 반납 비용 */}
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200/80 flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-amber-500" />
                  <h3 className="text-[13px] font-bold text-slate-800">반납 비용</h3>
                  <span className="ml-auto text-[10px] text-slate-400 font-medium">신규기기 설치 동반 시 무료</span>
                </div>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '130px' }}>품목</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '130px' }}>모델명</th>
                      <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '120px' }}>단가 (VAT별도)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-5 py-2 font-semibold text-slate-700 border-r border-slate-100">반납 보관비</td>
                      <td className="px-4 py-2 text-slate-400">-</td>
                      <td className="px-5 py-2 text-right font-semibold text-slate-800 tabular-nums">100,000원</td>
                    </tr>
                    <tr className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-5 py-2 font-semibold text-slate-700 border-r border-slate-100">반납 폐기비</td>
                      <td className="px-4 py-2 text-slate-400">-</td>
                      <td className="px-5 py-2 text-right font-semibold text-slate-800 tabular-nums">100,000원</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 안내 */}
              <p className="text-[11px] text-slate-400 leading-relaxed">
                ※ 모든 단가는 VAT 별도 금액입니다. 배관은 m당 단가이며, 현장 조건에 따라 추가비용이 발생할 수 있습니다.
              </p>
            </div>
          </div>

          {/* 구분선 */}
          <div className="w-px self-stretch bg-slate-200 mx-1" />

          {/* ── 우측: 현장별 변동 비용 (읽기 전용) ── */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-[13px] font-bold text-slate-700">현장별 변동 항목</span>
              <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">현장별 상이</span>
            </div>
            <p className="text-[11px] text-amber-600/80 bg-amber-50/50 border border-amber-200/50 rounded-lg px-3 py-2 leading-relaxed">
              아래 항목은 현장 조건에 따라 금액이 달라집니다. 견적서 작성 시 현장 확인 후 별도 산출합니다.
            </p>
            <div className="flex gap-5 items-start">

              {/* 전기공사 (읽기 전용) */}
              <div className="bg-white rounded-xl border border-dashed border-amber-300/80 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-amber-200/50 bg-amber-50/30 flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-sky-500" />
                  <h3 className="text-[13px] font-bold text-slate-800">전기공사</h3>
                </div>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '140px' }}>품목</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '140px' }}>모델명</th>
                      <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '140px' }}>단가 (VAT별도)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {elecRows.map((row, i) => (
                      <tr key={`elec-${i}`} className="hover:bg-sky-50/30 transition-colors">
                        <td className="px-5 py-2 font-semibold text-slate-700 border-r border-slate-100">{row.category}</td>
                        <td className="px-4 py-2 text-slate-600">{row.model}</td>
                        <td className="px-5 py-2 text-right text-slate-300">-</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 기타공사 (읽기 전용) */}
              <div className="bg-white rounded-xl border border-dashed border-amber-300/80 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-amber-200/50 bg-amber-50/30 flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-orange-500" />
                  <h3 className="text-[13px] font-bold text-slate-800">기타공사</h3>
                </div>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-slate-50/80">
                      <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '140px' }}>품목</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '140px' }}>모델명</th>
                      <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '140px' }}>단가 (VAT별도)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {etcRows.map((row, i) => (
                      <tr key={`etc-${i}`} className="hover:bg-orange-50/30 transition-colors">
                        <td className="px-5 py-2 font-semibold text-slate-700 border-r border-slate-100">{row.category}</td>
                        <td className="px-4 py-2 text-slate-600">{row.model}</td>
                        <td className="px-5 py-2 text-right text-slate-300">-</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
