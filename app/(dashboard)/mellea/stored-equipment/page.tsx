/**
 * 철거보관 장비 관리 페이지
 *
 * 탭: 보관중 / 출고완료
 * 필터: 검색 + 창고 + 계열사 + 품목
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  fetchOrders,
  fetchStoredEquipment,
  createStoredEquipment,
  updateStoredEquipment,
  deleteStoredEquipment,
  releaseStoredEquipment,
  revertStoredEquipmentRelease,
  fetchWarehouses,
} from '@/lib/supabase/dal'
import type { Order, StoredEquipment, StoredEquipmentStatus } from '@/types/order'
import type { Warehouse } from '@/types/warehouse'
import { StoredEquipmentTable } from '@/components/stored-equipment/stored-equipment-table'
import { StoredEquipmentFormDialog } from '@/components/stored-equipment/stored-equipment-form-dialog'
import { ReleaseDialog } from '@/components/stored-equipment/release-dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Archive, Plus, AlertCircle, FileText, Search } from 'lucide-react'
import { useAlert } from '@/components/ui/custom-alert'
import { CATEGORY_OPTIONS, AFFILIATE_OPTIONS } from '@/types/order'
import { ExcelExportButton } from '@/components/ui/excel-export-button'
import { exportToExcel, buildExcelFileName, type ExcelColumn } from '@/lib/excel-export'

export default function StoredEquipmentPage() {
  const { showAlert } = useAlert()

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

  // ─── 출고완료 페이지네이션 ───
  const ITEMS_PER_PAGE = 10
  const [currentPage, setCurrentPage] = useState(1)

  // ─── 다이얼로그 상태 ───
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<StoredEquipment | null>(null)
  const [releaseOpen, setReleaseOpen] = useState(false)
  const [releaseTarget, setReleaseTarget] = useState<StoredEquipment | null>(null)

  // ─── 탭별 건수 ───
  const tabCounts = useMemo(() => ({
    stored: items.filter(i => i.status === 'stored' || (i.status as string) === 'requested').length,
    released: items.filter(i => i.status === 'released').length,
  }), [items])

  // ─── 미등록 철거보관 발주 목록 ───
  const removalOrders = useMemo(() => {
    const registeredOrderIds = new Set(
      items.filter(item => item.orderId).map(item => item.orderId!)
    )
    return (orders || []).filter(order =>
      order.status !== 'cancelled' &&
      order.items.some(item => item.workType === '철거보관') &&
      !registeredOrderIds.has(order.id)
    )
  }, [orders, items])

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
    // 제조년월 기준 내림차순 정렬 (최신 제품이 위로, 없으면 맨 아래)
    result.sort((a, b) => {
      const dateA = a.manufacturingDate || ''
      const dateB = b.manufacturingDate || ''
      if (!dateA && !dateB) return 0
      if (!dateA) return 1
      if (!dateB) return -1
      return dateB.localeCompare(dateA)
    })
    return result
  }, [items, activeTab, warehouseFilter, affiliateFilter, categoryFilter, searchTerm])

  // ─── 출고완료 페이지네이션 계산 ───
  const totalPages = activeTab === 'released' ? Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE)) : 1
  const displayItems = activeTab === 'released'
    ? filteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
    : filteredItems

  // 필터 변경 시 페이지 리셋
  useEffect(() => { setCurrentPage(1) }, [warehouseFilter, affiliateFilter, categoryFilter, searchTerm])

  // ─── 핸들러 ───

  /** 장비 등록 */
  const handleCreate = async (data: Omit<StoredEquipment, 'id' | 'createdAt' | 'updatedAt'>) => {
    const result = await createStoredEquipment(data)
    if (result) {
      setItems(prev => [result, ...prev])
      showAlert('장비가 등록되었습니다!', 'success')
    } else {
      showAlert('장비 등록에 실패했습니다.', 'error')
    }
  }

  /** 장비 수정 */
  const handleUpdate = async (data: Omit<StoredEquipment, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!editTarget) return
    const result = await updateStoredEquipment(editTarget.id, data)
    if (result) {
      setItems(prev => prev.map(i => i.id === editTarget.id ? result : i))
      showAlert('장비 정보가 수정되었습니다!', 'success')
    } else {
      showAlert('수정에 실패했습니다.', 'error')
    }
    setEditTarget(null)
  }

  /** 장비 삭제 */
  const handleDelete = async (id: string) => {
    const success = await deleteStoredEquipment(id)
    if (success) {
      setItems(prev => prev.filter(i => i.id !== id))
      showAlert('장비가 삭제되었습니다.', 'success')
    } else {
      showAlert('삭제에 실패했습니다.', 'error')
    }
  }

  /** 출고 처리 */
  const handleRelease = async (id: string, info: {
    releaseType: string
    releaseDate: string
    releaseDestination?: string
    releaseAddress?: string
    releaseNotes?: string
  }) => {
    const success = await releaseStoredEquipment(id, info)
    if (success) {
      setItems(prev => prev.map(i => {
        if (i.id !== id) return i
        return {
          ...i,
          status: 'released' as const,
          releaseType: info.releaseType as StoredEquipment['releaseType'],
          releaseDate: info.releaseDate,
          releaseDestination: info.releaseDestination,
          releaseAddress: info.releaseAddress,
          releaseNotes: info.releaseNotes,
        }
      }))
      showAlert('출고 처리되었습니다!', 'success')
    } else {
      showAlert('출고 처리에 실패했습니다.', 'error')
    }
  }

  /** 출고 되돌리기 */
  const handleRevertRelease = async (id: string) => {
    const success = await revertStoredEquipmentRelease(id)
    if (success) {
      setItems(prev => prev.map(i => {
        if (i.id !== id) return i
        return {
          ...i,
          status: 'stored' as const,
          releaseType: undefined,
          releaseDate: undefined,
          releaseDestination: undefined,
          releaseNotes: undefined,
        }
      }))
      showAlert('보관중으로 되돌렸습니다!', 'success')
    } else {
      showAlert('되돌리기에 실패했습니다.', 'error')
    }
  }

  /** 수정 다이얼로그 열기 */
  const handleEdit = (item: StoredEquipment) => {
    setEditTarget(item)
    setFormOpen(true)
  }

  /** 출고 다이얼로그 열기 */
  const handleReleaseClick = (item: StoredEquipment) => {
    setReleaseTarget(item)
    setReleaseOpen(true)
  }

  /** 장비 등록 다이얼로그 열기 */
  const handleOpenForm = () => {
    setEditTarget(null)
    setFormOpen(true)
  }

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
      fileName: buildExcelFileName('철거보관장비', tabLabel),
      sheetName: tabLabel,
    })
  }

  // ─── 로딩 ───
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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
            <Archive className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">철거보관 장비 관리</h1>
            <p className="text-muted-foreground mt-0.5">철거보관 장비를 조회하고 관리합니다</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 미등록 발주 알림 */}
          {removalOrders.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100">
                  <AlertCircle className="h-3.5 w-3.5" />
                  미등록 {removalOrders.length}건
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">철거보관 발주 (미등록)</h4>
                  <p className="text-xs text-slate-500 mb-3">클릭하면 장비 등록 폼이 열립니다</p>
                  <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                    {removalOrders.map((order) => (
                      <button
                        key={order.id}
                        onClick={() => handleOpenForm()}
                        className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all"
                      >
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {order.businessName}
                            </p>
                            <p className="text-xs text-slate-500">
                              {order.affiliate || '계열사 미입력'} · {order.orderDate}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
          <ExcelExportButton onClick={handleExcelExport} disabled={filteredItems.length === 0} />
          <Button onClick={handleOpenForm} className="gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" />
            장비 등록
          </Button>
        </div>
      </div>

      {/* 탭 (border-b 스타일) */}
      <div className="border-b border-slate-200 mb-4">
        <div className="flex items-center gap-1 -mb-px">
          {tabs.map(tab => (
            <button
              key={tab.value}
              onClick={() => { setActiveTab(tab.value); setCurrentPage(1) }}
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

      {/* ═══ 테이블 ═══ */}
      <StoredEquipmentTable
        items={displayItems}
        activeTab={activeTab}
        warehouses={warehouses}
        orders={orders}
        onEdit={handleEdit}
        onRelease={handleReleaseClick}
        onDelete={handleDelete}
        onRevertRelease={handleRevertRelease}
      />

      {/* ═══ 출고완료 페이지네이션 ═══ */}
      {activeTab === 'released' && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-4">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            이전
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-8 h-8 text-xs font-medium rounded-md ${
                currentPage === page
                  ? 'bg-blue-600 text-white'
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {page}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            다음
          </button>
          <span className="text-[11px] text-slate-400 ml-2">
            총 {filteredItems.length}건
          </span>
        </div>
      )}

      {/* ═══ 등록/수정 다이얼로그 ═══ */}
      <StoredEquipmentFormDialog
        equipment={editTarget}
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditTarget(null)
        }}
        onSave={editTarget ? handleUpdate : handleCreate}
        onCreate={handleCreate}
        warehouses={warehouses}
        orders={orders}
        items={items}
      />

      {/* ═══ 출고 다이얼로그 ═══ */}
      <ReleaseDialog
        equipment={releaseTarget}
        open={releaseOpen}
        onOpenChange={(open) => {
          setReleaseOpen(open)
          if (!open) setReleaseTarget(null)
        }}
        onRelease={handleRelease}
        defaultDestination={(() => {
          if (!releaseTarget) return undefined
          const linkedOrder = orders.find(o =>
            o.items.some(item => item.workType === '재고설치' && item.storedEquipmentId === releaseTarget.id)
          )
          if (!linkedOrder) return undefined
          return `${linkedOrder.businessName} (${linkedOrder.address})`
        })()}
        orders={orders}
      />
    </div>
  )
}
