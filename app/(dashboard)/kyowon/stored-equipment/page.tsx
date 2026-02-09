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
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Archive } from 'lucide-react'
import { CATEGORY_OPTIONS, AFFILIATE_OPTIONS } from '@/types/order'

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
    stored: items.filter(i => i.status === 'stored').length,
    requested: items.filter(i => i.status === 'requested').length,
    released: items.filter(i => i.status === 'released').length,
  }), [items])

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
          철거보관 장비 조회
        </h1>
        <p className="text-muted-foreground">
          현재 보관 중인 장비를 조회합니다. (읽기 전용)
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

      {/* 메인 컨텐츠: 장비 테이블 리스트 (읽기 전용) */}
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
