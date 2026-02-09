/**
 * 철거보관 장비 관리 페이지 (테이블 리스트 방식)
 *
 * 핵심 개선: 아코디언 현장 그룹 → 장비 전체 테이블 리스트
 *
 * 업무 흐름:
 *   철거보관 작업 발생
 *     ↓
 *   장비를 개별 등록 (품목/모델/평형/제조사/제조년월/보관창고)
 *     ↓
 *   창고/계열사/품목 필터로 빠르게 조회
 *     ↓
 *   보관중인 장비 → 출고 처리 (재설치/반납)
 *
 * 탭: 보관중 / 출고완료
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
import { Badge } from '@/components/ui/badge'
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
import { Archive, Plus, AlertCircle, FileText } from 'lucide-react'
import { useAlert } from '@/components/ui/custom-alert'
import { CATEGORY_OPTIONS, AFFILIATE_OPTIONS } from '@/types/order'

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

  // ─── 다이얼로그 상태 ───
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<StoredEquipment | null>(null)
  const [releaseOpen, setReleaseOpen] = useState(false)
  const [releaseTarget, setReleaseTarget] = useState<StoredEquipment | null>(null)

  // ─── 탭별 건수 ───
  const tabCounts = useMemo(() => ({
    stored: items.filter(i => i.status === 'stored').length,
    requested: items.filter(i => i.status === 'requested').length,
    released: items.filter(i => i.status === 'released').length,
  }), [items])

  // ─── 미등록 철거보관 발주 목록 ───
  const removalOrders = useMemo(() => {
    // 이미 장비가 등록된 발주 ID 목록
    const registeredOrderIds = new Set(
      items.filter(item => item.orderId).map(item => item.orderId!)
    )

    // 철거보관 작업이 포함되고 아직 장비가 등록되지 않은 발주만
    return (orders || []).filter(order =>
      order.status !== 'cancelled' &&
      order.items.some(item => item.workType === '철거보관') &&
      !registeredOrderIds.has(order.id)
    )
  }, [orders, items])

  // ─── 장비 리스트 필터링 ───
  const filteredItems = useMemo(() => {
    let result = items.filter(i => i.status === activeTab)

    // 창고 필터
    if (warehouseFilter !== 'all') {
      result = result.filter(i => i.warehouseId === warehouseFilter)
    }

    // 계열사 필터
    if (affiliateFilter !== 'all') {
      result = result.filter(i => i.affiliate === affiliateFilter)
    }

    // 품목 필터
    if (categoryFilter !== 'all') {
      result = result.filter(i => i.category === categoryFilter)
    }

    // 검색어 필터
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

  // 로딩 중
  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center py-12 text-gray-400">
          <Archive className="h-12 w-12 mx-auto mb-3 opacity-50 animate-pulse" />
          <p>데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  // 탭 정의
  const tabs: { label: string; value: StoredEquipmentStatus; count: number }[] = [
    { label: '보관중', value: 'stored', count: tabCounts.stored },
    { label: '요청중', value: 'requested', count: tabCounts.requested },
    { label: '출고완료', value: 'released', count: tabCounts.released },
  ]

  return (
    <div className="container mx-auto py-8 px-4">
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
          <Archive className="h-6 w-6" />
          철거보관 장비 관리
        </h1>
        <p className="text-muted-foreground">
          철거보관 장비 전체를 한눈에 조회하고 관리합니다. 필터로 빠르게 찾으세요.
        </p>
      </div>

      {/* 필터 영역 */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-3 mb-4">
        <Input
          placeholder="현장명, 품목, 모델명, 주소로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="w-[140px]">
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
          <SelectTrigger className="w-[140px]">
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
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="품목" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 품목</SelectItem>
            {CATEGORY_OPTIONS.map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 미등록 철거보관 발주 목록 */}
        {removalOrders.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 border-orange-300 bg-orange-50 text-orange-800 hover:bg-orange-100">
                <AlertCircle className="h-4 w-4" />
                미등록 발주 {removalOrders.length}건
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm mb-3">철거보관 발주 (미등록)</h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {removalOrders.map((order) => (
                    <button
                      key={order.id}
                      onClick={() => handleOpenForm()}
                      className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {order.businessName}
                          </p>
                          <p className="text-xs text-gray-500">
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

        <Button onClick={handleOpenForm} className="gap-1.5 ml-auto">
          <Plus className="h-4 w-4" />
          장비 등록
        </Button>
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap
              ${activeTab === tab.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
          >
            {tab.label}
            <Badge variant="secondary" className="text-xs ml-1 px-1.5 py-0">
              {tab.count}
            </Badge>
          </button>
        ))}
        <span className="text-sm text-gray-500 ml-auto">
          {filteredItems.length}대
          {searchTerm && <span className="text-blue-600 font-medium ml-1">(검색중)</span>}
        </span>
      </div>

      {/* 메인 컨텐츠: 장비 테이블 리스트 */}
      <StoredEquipmentTable
        items={filteredItems}
        activeTab={activeTab}
        warehouses={warehouses}
        orders={orders}
        onEdit={handleEdit}
        onRelease={handleReleaseClick}
        onDelete={handleDelete}
        onRevertRelease={handleRevertRelease}
      />

      {/* 등록/수정 다이얼로그 */}
      <StoredEquipmentFormDialog
        equipment={editTarget}
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditTarget(null)
        }}
        onSave={editTarget ? handleUpdate : handleCreate}
        warehouses={warehouses}
        orders={orders}
        items={items}
      />

      {/* 출고 다이얼로그 */}
      <ReleaseDialog
        equipment={releaseTarget}
        open={releaseOpen}
        onOpenChange={(open) => {
          setReleaseOpen(open)
          if (!open) setReleaseTarget(null)
        }}
        onRelease={handleRelease}
        defaultDestination={(() => {
          // 요청중 장비 → 연결된 발주의 주소를 출고목적지 기본값으로
          if (!releaseTarget || releaseTarget.status !== 'requested') return undefined
          const linkedOrder = orders.find(o =>
            o.items.some(item => item.workType === '재고설치' && item.storedEquipmentId === releaseTarget.id)
          )
          if (!linkedOrder) return undefined
          return `${linkedOrder.businessName} (${linkedOrder.address})`
        })()}
      />
    </div>
  )
}
