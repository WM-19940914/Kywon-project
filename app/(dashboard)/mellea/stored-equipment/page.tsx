/**
 * 철거보관 장비 관리 페이지 (재설계)
 *
 * 핵심 변경: "장비 단독 등록" → "현장(발주) 기반 아코디언 + 장비 개별 관리"
 *
 * 업무 흐름:
 *   발주서 접수 (workType='철거보관' 포함)
 *     ↓
 *   이 페이지에 해당 현장이 자동 표시
 *     ↓
 *   현장을 펼치면 → 장비를 1대씩 등록 (품목/모델/평형/제조사/제조년월/보관창고)
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
import type { Order, StoredEquipment, StoredEquipmentSite, StoredEquipmentStatus } from '@/types/order'
import type { Warehouse } from '@/types/warehouse'
import { StoredEquipmentSiteList } from '@/components/stored-equipment/stored-equipment-site-list'
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
import { Archive, Plus, Package, AlertTriangle, CheckCircle } from 'lucide-react'
import { useAlert } from '@/components/ui/custom-alert'

/**
 * 현장 그룹핑 함수 (핵심 로직!)
 *
 * 발주 목록 + 장비 목록을 받아서 "현장 기반 그룹"으로 변환합니다.
 *
 * 1. orders 중 workType='철거보관' 포함된 발주만 추출
 * 2. equipment를 orderId별로 Map에 그룹핑
 * 3. 각 발주 → 현장으로 변환, 매칭된 장비 연결
 * 4. orderId=null인 수동 등록 장비 → siteName으로 별도 현장 그룹
 * 5. 장비 0대인 현장도 표시 (아직 등록 안 한 발주)
 */
function buildSiteGroups(
  orders: Order[],
  equipment: StoredEquipment[],
  activeTab: StoredEquipmentStatus
): StoredEquipmentSite[] {
  // 탭에 맞는 장비만 필터
  const filteredEquip = equipment.filter(eq => eq.status === activeTab)

  // 1. 철거보관 작업이 포함된 발주 추출
  const removalOrders = orders.filter(order =>
    order.status !== 'cancelled' &&
    order.items.some(item => item.workType === '철거보관')
  )

  // 2. 장비를 orderId별로 Map에 그룹핑
  const equipByOrderId = new Map<string, StoredEquipment[]>()
  const manualEquip: StoredEquipment[] = [] // orderId가 없는 수동 등록 장비

  for (const eq of filteredEquip) {
    if (eq.orderId) {
      const list = equipByOrderId.get(eq.orderId) || []
      list.push(eq)
      equipByOrderId.set(eq.orderId, list)
    } else {
      manualEquip.push(eq)
    }
  }

  // 3. 각 발주 → 현장으로 변환
  const sites: StoredEquipmentSite[] = removalOrders.map(order => ({
    orderId: order.id,
    siteName: order.businessName,
    affiliate: order.affiliate,
    address: order.address,
    orderDate: order.orderDate,
    orderItems: order.items,
    equipment: equipByOrderId.get(order.id) || [],
  }))

  // 4. 수동 등록 장비를 siteName으로 그룹핑
  const manualSiteMap = new Map<string, StoredEquipment[]>()
  for (const eq of manualEquip) {
    const key = eq.siteName
    const list = manualSiteMap.get(key) || []
    list.push(eq)
    manualSiteMap.set(key, list)
  }

  Array.from(manualSiteMap.entries()).forEach(([name, eqs]) => {
    sites.push({
      orderId: null,
      siteName: name,
      affiliate: eqs[0]?.affiliate,
      address: eqs[0]?.address,
      equipment: eqs,
    })
  })

  // 보관중 탭: 장비 0대인 발주도 표시 (아직 등록 안 한 현장)
  // 출고완료 탭: 장비가 있는 현장만 표시
  if (activeTab === 'released') {
    return sites.filter(s => s.equipment.length > 0)
  }

  return sites
}

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

  // ─── 다이얼로그 상태 ───
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<StoredEquipment | null>(null)
  const [contextSite, setContextSite] = useState<StoredEquipmentSite | null>(null)
  const [releaseOpen, setReleaseOpen] = useState(false)
  const [releaseTarget, setReleaseTarget] = useState<StoredEquipment | null>(null)

  // ─── 통계 계산 ───
  const stats = useMemo(() => {
    const stored = items.filter(i => i.status === 'stored')
    return {
      storedCount: stored.reduce((sum, i) => sum + i.quantity, 0),
      goodCount: stored.filter(i => i.condition === 'good').reduce((sum, i) => sum + i.quantity, 0),
      poorCount: stored.filter(i => i.condition === 'poor').reduce((sum, i) => sum + i.quantity, 0),
      releasedCount: items.filter(i => i.status === 'released').reduce((sum, i) => sum + i.quantity, 0),
    }
  }, [items])

  // ─── 탭별 건수 ───
  const tabCounts = useMemo(() => ({
    stored: items.filter(i => i.status === 'stored').length,
    released: items.filter(i => i.status === 'released').length,
  }), [items])

  // ─── 현장 그룹 생성 ───
  const siteGroups = useMemo(() => {
    let sites = buildSiteGroups(orders, items, activeTab)

    // 창고 필터 적용
    if (warehouseFilter !== 'all') {
      sites = sites.map(site => ({
        ...site,
        equipment: site.equipment.filter(eq => eq.warehouseId === warehouseFilter),
      })).filter(site => site.equipment.length > 0 || (activeTab === 'stored' && site.orderId))
    }

    // 검색어 필터 적용
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      sites = sites.filter(site => {
        // 현장 정보에서 검색
        const siteMatch =
          site.siteName.toLowerCase().includes(term) ||
          (site.affiliate || '').toLowerCase().includes(term) ||
          (site.address || '').toLowerCase().includes(term)

        // 장비 정보에서 검색
        const equipMatch = site.equipment.some(eq =>
          eq.category.toLowerCase().includes(term) ||
          (eq.model || '').toLowerCase().includes(term) ||
          (eq.manufacturer || '').toLowerCase().includes(term) ||
          (eq.notes || '').toLowerCase().includes(term)
        )

        return siteMatch || equipMatch
      })
    }

    return sites
  }, [orders, items, activeTab, warehouseFilter, searchTerm])

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
    setContextSite(null)
    setFormOpen(true)
  }

  /** 출고 다이얼로그 열기 */
  const handleReleaseClick = (item: StoredEquipment) => {
    setReleaseTarget(item)
    setReleaseOpen(true)
  }

  /** 현장에서 장비 추가 */
  const handleAddEquipment = (site: StoredEquipmentSite) => {
    setEditTarget(null)
    setContextSite(site)
    setFormOpen(true)
  }

  /** 수동 등록 (발주 없는 장비) */
  const handleManualCreate = () => {
    setEditTarget(null)
    setContextSite(null)
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
          철거보관 발주가 접수되면 현장이 자동으로 표시됩니다. 현장을 펼쳐서 장비를 개별 등록하세요.
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-blue-700">
            <Package className="h-4 w-4" />
            <span className="text-xs font-medium">보관중</span>
          </div>
          <p className="text-2xl font-bold text-blue-800 mt-1">{stats.storedCount}대</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="h-4 w-4" />
            <span className="text-xs font-medium">양호</span>
          </div>
          <p className="text-2xl font-bold text-green-800 mt-1">{stats.goodCount}대</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-medium">불량</span>
          </div>
          <p className="text-2xl font-bold text-red-800 mt-1">{stats.poorCount}대</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-gray-600">
            <Archive className="h-4 w-4" />
            <span className="text-xs font-medium">출고완료</span>
          </div>
          <p className="text-2xl font-bold text-gray-700 mt-1">{stats.releasedCount}대</p>
        </div>
      </div>

      {/* 검색 + 창고필터 + 수동등록 버튼 */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-3 mb-4">
        <Input
          placeholder="현장명, 품목, 모델명, 주소로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="창고 필터" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 창고</SelectItem>
            {warehouses.map(wh => (
              <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleManualCreate} variant="outline" className="gap-1.5 ml-auto">
          <Plus className="h-4 w-4" />
          수동 등록
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
          {siteGroups.length}개 현장
          {searchTerm && <span className="text-blue-600 font-medium ml-1">(검색중)</span>}
        </span>
      </div>

      {/* 메인 컨텐츠: 현장 아코디언 리스트 */}
      <StoredEquipmentSiteList
        sites={siteGroups}
        activeTab={activeTab}
        warehouses={warehouses}
        onAddEquipment={handleAddEquipment}
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
          if (!open) {
            setEditTarget(null)
            setContextSite(null)
          }
        }}
        onSave={editTarget ? handleUpdate : handleCreate}
        warehouses={warehouses}
        contextSite={contextSite}
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
      />
    </div>
  )
}
