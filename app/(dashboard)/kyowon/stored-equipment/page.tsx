/**
 * 철거보관 장비 조회 페이지 (교원그룹용 읽기 전용)
 *
 * 교원 담당자가 어떤 장비를 보관하고 있는지 조회만 가능
 * - 장비 등록/수정/삭제 불가
 * - 출고 처리 불가
 * - 필터/검색만 가능
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  fetchOrders,
  fetchStoredEquipment,
  fetchWarehouses,
} from '@/lib/supabase/dal'
import type { Order, StoredEquipment, StoredEquipmentStatus } from '@/types/order'
import type { Warehouse } from '@/types/warehouse'
import { StoredEquipmentTable } from '@/components/stored-equipment/stored-equipment-table'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Archive, Search } from 'lucide-react'
import { CATEGORY_OPTIONS, AFFILIATE_OPTIONS } from '@/types/order'
import { ExcelExportButton } from '@/components/ui/excel-export-button'
import { exportToExcel, buildExcelFileName, type ExcelColumn } from '@/lib/excel-export'

export default function KyowonStoredEquipmentPage() {
  // ─── 데이터 로드 ───
  const [orders, setOrders] = useState<Order[]>([])
  const [items, setItems] = useState<StoredEquipment[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchOrders(), fetchStoredEquipment(), fetchWarehouses()]).then(
      ([ordersData, itemsData, warehousesData]) => {
        setOrders(ordersData)
        setItems(itemsData)
        setWarehouses(warehousesData)
        setIsLoading(false)
      }
    )
  }, [])

  // ─── 필터 상태 ───
  const [activeTab, setActiveTab] = useState<StoredEquipmentStatus>('stored')
  const [searchTerm, setSearchTerm] = useState('')
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all')
  const [affiliateFilter, setAffiliateFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  // ─── 탭별 건수 ───
  const tabCounts = useMemo(() => ({
    stored: items.filter(i => i.status === 'stored' || (i.status as string) === 'requested').length,
    released: items.filter(i => i.status === 'released').length,
  }), [items])

  // ─── 장비 리스트 필터링 ───
  const filteredItems = useMemo(() => {
    let result = activeTab === 'stored'
      ? items.filter(i => i.status === 'stored' || (i.status as string) === 'requested')
      : items.filter(i => i.status === activeTab)

    if (warehouseFilter !== 'all') {
      result = result.filter(i => i.warehouseId === warehouseFilter)
    }
    if (affiliateFilter !== 'all') {
      result = result.filter(i => i.affiliate === affiliateFilter)
    }
    if (categoryFilter !== 'all') {
      result = result.filter(i => i.category === categoryFilter)
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(i =>
        i.category.toLowerCase().includes(term) ||
        (i.model || '').toLowerCase().includes(term) ||
        i.siteName.toLowerCase().includes(term) ||
        (i.affiliate || '').toLowerCase().includes(term) ||
        (i.address || '').toLowerCase().includes(term) ||
        (i.manufacturer || '').toLowerCase().includes(term) ||
        (i.notes || '').toLowerCase().includes(term)
      )
    }
    return result
  }, [items, activeTab, warehouseFilter, affiliateFilter, categoryFilter, searchTerm])

  /** 엑셀 다운로드 */
  const handleExcelExport = () => {
    const tabLabel = activeTab === 'stored' ? '보관중' : '출고완료'
    const warehouseNameMap = Object.fromEntries(warehouses.map(w => [w.id, w.name]))
    const baseColumns: ExcelColumn<StoredEquipment>[] = [
      { header: '현장명', key: 'siteName', width: 18 },
      { header: '계열사', key: 'affiliate', width: 14 },
      { header: '품목', key: 'category', width: 14 },
      { header: '모델명', key: 'model', width: 22 },
      { header: '평형', key: 'size', width: 8 },
      { header: '수량', key: 'quantity', width: 6, numberFormat: '#,##0' },
      { header: '제조사', key: 'manufacturer', width: 10 },
      { header: '제조년월', key: 'manufacturingDate', width: 10 },
      { header: '창고', getValue: (i) => warehouseNameMap[i.warehouseId || ''] || '', width: 12 },
      { header: '보관시작일', key: 'storageStartDate', width: 12 },
      { header: '메모', key: 'notes', width: 20 },
    ]
    const releaseColumns: ExcelColumn<StoredEquipment>[] = [
      { header: '출고일', key: 'releaseDate', width: 12 },
      { header: '출고유형', getValue: (i) => i.releaseType === 'reinstall' ? '재설치' : i.releaseType === 'dispose' ? '폐기' : '', width: 10 },
      { header: '출고목적지', key: 'releaseDestination', width: 20 },
    ]
    const columns = activeTab === 'released' ? [...baseColumns, ...releaseColumns] : baseColumns
    exportToExcel({
      data: filteredItems,
      columns,
      fileName: buildExcelFileName('철거보관장비조회', tabLabel),
      sheetName: tabLabel,
    })
  }

  // 로딩 중
  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 animate-pulse">
            <Archive className="h-7 w-7 text-slate-300" />
          </div>
          <p className="text-sm text-slate-400">데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  // 탭 정의
  const tabs: { label: string; value: StoredEquipmentStatus; count: number }[] = [
    { label: '보관중', value: 'stored', count: tabCounts.stored },
    { label: '출고완료', value: 'released', count: tabCounts.released },
  ]

  return (
    <div className="container mx-auto max-w-[1400px] py-6 px-4 md:px-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
          <Archive className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">철거보관 장비 조회</h1>
          <p className="text-muted-foreground mt-0.5">현재 보관 중인 장비를 조회합니다 (읽기 전용)</p>
        </div>
        <ExcelExportButton onClick={handleExcelExport} disabled={filteredItems.length === 0} />
      </div>

      {/* 탭 (border-b 스타일) */}
      <div className="border-b border-slate-200 mb-4">
        <div className="flex items-center gap-1 -mb-px">
          {tabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`pb-3 px-4 text-sm font-medium transition-colors whitespace-nowrap
                ${activeTab === tab.value
                  ? 'border-b-2 border-blue-500 text-blue-600 font-semibold'
                  : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              {tab.label}
              <span className={`ml-1.5 px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.value
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
          <span className="text-sm text-slate-500 ml-auto pb-3 tabular-nums">
            {filteredItems.length}대
            {searchTerm && <span className="text-blue-600 font-medium ml-1.5">(검색결과)</span>}
          </span>
        </div>
      </div>

      {/* ═══ 필터 ═══ */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-2.5 mb-5">
        <div className="relative flex-1 max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="현장명, 품목, 모델명, 주소로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
            <SelectTrigger className="w-[130px] text-sm">
              <SelectValue placeholder="창고" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 창고</SelectItem>
              {warehouses.map(wh => (
                <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={affiliateFilter} onValueChange={setAffiliateFilter}>
            <SelectTrigger className="w-[130px] text-sm">
              <SelectValue placeholder="계열사" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 계열사</SelectItem>
              {AFFILIATE_OPTIONS.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[130px] text-sm">
              <SelectValue placeholder="품목" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 품목</SelectItem>
              {CATEGORY_OPTIONS.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ═══ 테이블 (읽기 전용) ═══ */}
      <StoredEquipmentTable
        items={filteredItems}
        activeTab={activeTab}
        warehouses={warehouses}
        orders={orders}
        onEdit={() => {}}
        onRelease={() => {}}
        onDelete={() => {}}
        onRevertRelease={() => {}}
        readOnly={true}
      />
    </div>
  )
}
