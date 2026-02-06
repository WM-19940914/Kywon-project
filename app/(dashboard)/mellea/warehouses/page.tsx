/**
 * 창고 관리 페이지 (리뉴얼)
 *
 * 장비를 보관하는 창고들을 관리하는 페이지입니다.
 * - 중앙에 카카오 지도, 좌우에 창고 카드 배치
 * - 카드에서 인라인 편집 가능
 * - 검색/필터링 기능
 */

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchWarehouses, createWarehouse as createWarehouseDB, updateWarehouse as updateWarehouseDB, deleteWarehouse as deleteWarehouseDB } from '@/lib/supabase/dal'
import type { Warehouse } from '@/types/warehouse'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Warehouse as WarehouseIcon,
  MapPin,
  User,
  Phone,
  Pencil,
  Check,
  X,
  Search,
  Trash2,
  Plus,
} from 'lucide-react'
import { useAlert } from '@/components/ui/custom-alert'
import KakaoMap from '@/components/warehouses/kakao-map'
import { getCoordFromAddress } from '@/lib/kakao-map'

// ─── 다음 우편번호 API ─────────────────────────────────────────

/** 다음 우편번호 API 스크립트 동적 로드 (무료, 키 불필요) */
function loadDaumPostcode(): Promise<void> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).daum?.Postcode) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.onload = () => resolve()
    document.head.appendChild(script)
  })
}

/** 다음 우편번호 팝업 결과 타입 */
interface PostcodeResult {
  address: string
  sido: string
  sigungu: string
}

/** 주소 검색 팝업 열기 */
async function openAddressSearch(
  onComplete: (result: PostcodeResult) => void
) {
  await loadDaumPostcode()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (window as any).daum.Postcode({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    oncomplete: (data: any) => {
      onComplete({
        address: data.roadAddress || data.jibunAddress,
        sido: data.sido,
        sigungu: data.sigungu,
      })
    },
  }).open()
}

/**
 * 소형 창고 카드 컴포넌트 (인라인 편집 포함)
 */
function WarehouseCard({
  warehouse,
  isSelected,
  onUpdate,
  onDelete,
  onSelect,
  cardRef,
}: {
  warehouse: Warehouse
  isSelected: boolean
  onUpdate: (updated: Warehouse) => void
  onDelete: (id: string) => void
  onSelect: (id: string) => void
  cardRef?: (el: HTMLDivElement | null) => void
}) {
  const { showConfirm } = useAlert()
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    name: warehouse.name,
    address: warehouse.address,
    addressDetail: warehouse.addressDetail || '',
    managerName: warehouse.managerName || '',
    managerPhone: warehouse.managerPhone || '',
    latitude: warehouse.latitude,
    longitude: warehouse.longitude,
  })

  const handleEdit = () => {
    setEditData({
      name: warehouse.name,
      address: warehouse.address,
      addressDetail: warehouse.addressDetail || '',
      managerName: warehouse.managerName || '',
      managerPhone: warehouse.managerPhone || '',
      latitude: warehouse.latitude,
      longitude: warehouse.longitude,
    })
    setIsEditing(true)
  }

  // 다음 주소 검색 팝업 호출 → 카카오 Geocoder로 정확한 좌표 변환
  const handleSearchAddress = () => {
    openAddressSearch((result) => {
      // 주소를 먼저 반영하고, 좌표는 비동기로 가져옴
      setEditData((prev) => ({ ...prev, address: result.address }))
      getCoordFromAddress(result.address).then((coord) => {
        setEditData((prev) => ({
          ...prev,
          latitude: coord.lat,
          longitude: coord.lng,
        }))
      })
    })
  }

  const handleSave = () => {
    onUpdate({
      ...warehouse,
      name: editData.name,
      address: editData.address,
      addressDetail: editData.addressDetail,
      managerName: editData.managerName,
      managerPhone: editData.managerPhone,
      latitude: editData.latitude,
      longitude: editData.longitude,
    })
    setIsEditing(false)
  }

  return (
    <div
      ref={cardRef}
      onClick={() => !isEditing && onSelect(warehouse.id)}
      className={`rounded-lg border bg-card p-3 transition-all duration-200 cursor-pointer ${
        isSelected
          ? 'ring-2 ring-blue-500 shadow-md bg-blue-50/30'
          : 'hover:shadow-sm hover:border-gray-300'
      }`}
    >
      {isEditing ? (
        /* 편집 모드 */
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          <Input
            value={editData.name}
            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
            className="h-7 text-sm" placeholder="창고명"
          />
          <div
            onClick={handleSearchAddress}
            className="flex items-center gap-1.5 h-7 px-2 rounded-md border text-sm cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
          >
            <Search className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className={editData.address ? 'text-foreground truncate' : 'text-muted-foreground truncate'}>
              {editData.address || '주소 검색...'}
            </span>
          </div>
          <Input
            value={editData.addressDetail}
            onChange={(e) => setEditData({ ...editData, addressDetail: e.target.value })}
            className="h-7 text-sm" placeholder="상세주소 (동/호수 등)"
          />
          <div className="grid grid-cols-2 gap-1.5">
            <Input
              value={editData.managerName}
              onChange={(e) => setEditData({ ...editData, managerName: e.target.value })}
              className="h-7 text-sm" placeholder="담당자"
            />
            <Input
              value={editData.managerPhone}
              onChange={(e) => setEditData({ ...editData, managerPhone: e.target.value })}
              className="h-7 text-sm" placeholder="연락처"
            />
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" onClick={handleSave} className="flex-1 h-7 text-xs">
              <Check className="h-3 w-3 mr-1" />저장
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} className="flex-1 h-7 text-xs">
              <X className="h-3 w-3 mr-1" />취소
            </Button>
          </div>
        </div>
      ) : (
        /* 보기 모드 */
        <>
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-sm font-semibold text-foreground truncate">
              {warehouse.name}_{warehouse.managerName}
            </h3>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Button
                size="sm" variant="ghost"
                onClick={(e) => { e.stopPropagation(); handleEdit() }}
                className="h-6 w-6 p-0 text-gray-400 hover:text-blue-600"
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                size="sm" variant="ghost"
                onClick={async (e) => {
                  e.stopPropagation()
                  const confirmed = await showConfirm(`"${warehouse.name}_${warehouse.managerName}" 창고를 삭제하시겠습니까?`)
                  if (confirmed) {
                    onDelete(warehouse.id)
                  }
                }}
                className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-1.5 mb-1.5">
            <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground" />
            <span className="text-xs text-gray-600 leading-tight line-clamp-2">
              {warehouse.address}{warehouse.addressDetail ? `, ${warehouse.addressDetail}` : ''}
            </span>
          </div>

          {warehouse.managerName && (
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {warehouse.managerName}
              </span>
              {warehouse.managerPhone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-2.5 w-2.5" />
                  {warehouse.managerPhone}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/**
 * 창고 추가 카드 컴포넌트
 * 클릭하면 입력 폼이 열려 새 창고를 추가할 수 있습니다.
 */
function AddWarehouseCard({ onAdd }: { onAdd: (wh: Warehouse) => void }) {
  const [isAdding, setIsAdding] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    addressDetail: '',
    managerName: '',
    managerPhone: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  })

  // 다음 주소 검색 팝업 호출 → 카카오 Geocoder로 정확한 좌표 변환
  const handleSearchAddress = () => {
    openAddressSearch((result) => {
      // 주소를 먼저 반영하고, 좌표는 비동기로 가져옴
      setFormData((prev) => ({ ...prev, address: result.address }))
      getCoordFromAddress(result.address).then((coord) => {
        setFormData((prev) => ({
          ...prev,
          latitude: coord.lat,
          longitude: coord.lng,
        }))
      })
    })
  }

  const handleAdd = () => {
    if (!formData.name.trim() || !formData.address.trim()) return
    onAdd({
      id: String(Date.now()),
      name: formData.name,
      address: formData.address,
      addressDetail: formData.addressDetail,
      managerName: formData.managerName,
      managerPhone: formData.managerPhone,
      latitude: formData.latitude,
      longitude: formData.longitude,
    })
    setFormData({ name: '', address: '', addressDetail: '', managerName: '', managerPhone: '', latitude: undefined, longitude: undefined })
    setIsAdding(false)
  }

  if (!isAdding) {
    return (
      <button
        onClick={() => setIsAdding(true)}
        className="w-full rounded-lg border-2 border-dashed border-gray-300 p-3 flex items-center justify-center gap-2 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/30 transition-colors"
      >
        <Plus className="h-4 w-4" />
        창고 추가
      </button>
    )
  }

  return (
    <div className="rounded-lg border-2 border-blue-400 bg-blue-50/20 p-3">
      <div className="space-y-2">
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="h-7 text-sm" placeholder="창고명 *"
          autoFocus
        />
        <div
          onClick={handleSearchAddress}
          className="flex items-center gap-1.5 h-7 px-2 rounded-md border text-sm cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
        >
          <Search className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <span className={formData.address ? 'text-foreground truncate' : 'text-muted-foreground truncate'}>
            {formData.address || '주소 검색 *'}
          </span>
        </div>
        <Input
          value={formData.addressDetail}
          onChange={(e) => setFormData({ ...formData, addressDetail: e.target.value })}
          className="h-7 text-sm" placeholder="상세주소 (동/호수 등)"
        />
        <div className="grid grid-cols-2 gap-1.5">
          <Input
            value={formData.managerName}
            onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
            className="h-7 text-sm" placeholder="담당자"
          />
          <Input
            value={formData.managerPhone}
            onChange={(e) => setFormData({ ...formData, managerPhone: e.target.value })}
            className="h-7 text-sm" placeholder="연락처"
          />
        </div>
        <div className="flex gap-1.5">
          <Button
            size="sm" onClick={handleAdd}
            disabled={!formData.name.trim() || !formData.address.trim()}
            className="flex-1 h-7 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />추가
          </Button>
          <Button size="sm" variant="outline" onClick={() => setIsAdding(false)} className="flex-1 h-7 text-xs">
            <X className="h-3 w-3 mr-1" />취소
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const cardElements = useRef<Record<string, HTMLDivElement | null>>({})

  // Supabase에서 창고 데이터 가져오기
  useEffect(() => {
    fetchWarehouses().then(data => {
      setWarehouses(data)
      setIsLoading(false)
    })
  }, [])

  // 검색 필터
  const filteredWarehouses = warehouses.filter(
    (wh) =>
      wh.name.includes(searchTerm) ||
      wh.address.includes(searchTerm) ||
      (wh.managerName || '').includes(searchTerm)
  )

  // 좌우 분할: 왼쪽/오른쪽 카드 배열
  const mid = Math.ceil(filteredWarehouses.length / 2)
  const leftCards = filteredWarehouses.slice(0, mid)
  const rightCards = filteredWarehouses.slice(mid)

  // 마커/카드 클릭 시 선택 + 스크롤
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id)
    const el = cardElements.current[id]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [])

  // 창고 정보 업데이트 (DB 연동)
  const handleUpdate = useCallback(async (updated: Warehouse) => {
    await updateWarehouseDB(updated.id, updated)
    setWarehouses((prev) =>
      prev.map((w) => (w.id === updated.id ? updated : w))
    )
  }, [])

  // 창고 삭제 (DB 연동)
  const handleDelete = useCallback(async (id: string) => {
    await deleteWarehouseDB(id)
    setWarehouses((prev) => prev.filter((w) => w.id !== id))
    if (selectedId === id) setSelectedId(null)
  }, [selectedId])

  // 창고 추가 (DB 연동)
  const handleAdd = useCallback(async (wh: Warehouse) => {
    const created = await createWarehouseDB(wh)
    if (created) {
      setWarehouses((prev) => [...prev, created])
    }
  }, [])

  return (
    <div className="container mx-auto py-6 px-4">
      {/* 헤더 + 검색 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <WarehouseIcon className="h-6 w-6" />
              창고 관리
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filteredWarehouses.length}개 창고
            </p>
          </div>
        </div>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="창고명, 주소, 담당자명으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-9"
          />
        </div>
      </div>

      {/* 메인 3컬럼 레이아웃: 카드 | 지도 | 카드 */}
      <div className="hidden lg:grid lg:grid-cols-[1fr_2fr_1fr] gap-4 items-start">
        {/* 왼쪽 카드 */}
        <div className="space-y-3">
          {leftCards.map((wh) => (
            <WarehouseCard
              key={wh.id}
              warehouse={wh}
              isSelected={selectedId === wh.id}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onSelect={handleSelect}
              cardRef={(el) => { cardElements.current[wh.id] = el }}
            />
          ))}
          <AddWarehouseCard onAdd={handleAdd} />
        </div>

        {/* 중앙 카카오 지도 */}
        <div className="sticky top-4">
          <Card className="overflow-hidden">
            <CardContent className="p-2">
              <KakaoMap
                warehouses={filteredWarehouses}
                selectedId={selectedId}
                onMarkerClick={handleSelect}
              />
            </CardContent>
          </Card>
        </div>

        {/* 오른쪽 카드 */}
        <div className="space-y-3">
          {rightCards.map((wh) => (
            <WarehouseCard
              key={wh.id}
              warehouse={wh}
              isSelected={selectedId === wh.id}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onSelect={handleSelect}
              cardRef={(el) => { cardElements.current[wh.id] = el }}
            />
          ))}
          <AddWarehouseCard onAdd={handleAdd} />
        </div>
      </div>

      {/* 모바일/태블릿: 지도 위 + 카드 그리드 아래 */}
      <div className="lg:hidden">
        <Card className="mb-6 overflow-hidden">
          <CardContent className="p-2">
            <KakaoMap
              warehouses={filteredWarehouses}
              selectedId={selectedId}
              onMarkerClick={handleSelect}
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredWarehouses.map((wh) => (
            <WarehouseCard
              key={wh.id}
              warehouse={wh}
              isSelected={selectedId === wh.id}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onSelect={handleSelect}
              cardRef={(el) => { cardElements.current[wh.id] = el }}
            />
          ))}
          <AddWarehouseCard onAdd={handleAdd} />
        </div>
      </div>
    </div>
  )
}
