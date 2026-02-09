/**
 * 철거보관 장비 등록/수정 다이얼로그
 *
 * - 등록 모드: equipment가 null이면 새로 등록
 * - 수정 모드: equipment가 있으면 기존 데이터로 폼 채움
 * - 발주 선택 (선택사항): 발주 선택하면 계열사/지점명/주소 자동 채움
 *
 * 필수 입력: 현장명, 품목, 보관 창고
 * 선택 입력: 모델명, 평형, 제조사, 제조년월, 주소, 계열사, 철거 사유, 메모
 */

'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { StoredEquipment, Order } from '@/types/order'
import type { Warehouse } from '@/types/warehouse'
import { CATEGORY_OPTIONS, AFFILIATE_OPTIONS, MANUFACTURER_OPTIONS } from '@/types/order'
import { Calendar } from 'lucide-react'

interface StoredEquipmentFormDialogProps {
  /** 수정 대상 (null이면 등록 모드) */
  equipment: StoredEquipment | null
  /** 다이얼로그 열림/닫힘 */
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 저장 콜백 (등록 또는 수정) */
  onSave: (data: Omit<StoredEquipment, 'id' | 'createdAt' | 'updatedAt'>) => void
  /** 창고 목록 (드롭다운용) */
  warehouses: Warehouse[]
  /** 발주 목록 (발주 선택 기능용) */
  orders: Order[]
  /** 전체 장비 목록 (이미 등록된 발주 필터링용) */
  items: StoredEquipment[]
}

export function StoredEquipmentFormDialog({
  equipment,
  open,
  onOpenChange,
  onSave,
  warehouses,
  orders,
  items,
}: StoredEquipmentFormDialogProps) {
  // 폼 상태
  const [selectedOrderId, setSelectedOrderId] = useState<string>('')
  const [siteName, setSiteName] = useState('')
  const [affiliate, setAffiliate] = useState('')
  const [address, setAddress] = useState('')
  const [category, setCategory] = useState('스탠드에어컨')
  const [model, setModel] = useState('')
  const [size, setSize] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [manufacturer, setManufacturer] = useState('삼성')
  const [manufacturingDate, setManufacturingDate] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [removalDate, setRemovalDate] = useState('')

  // 달력 선택기 ref
  const monthInputRef = useRef<HTMLInputElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)

  // 이미 장비가 등록된 발주 ID 목록
  const registeredOrderIds = useMemo(() => {
    if (equipment) {
      // 수정 모드: 현재 수정 중인 장비의 발주는 제외하지 않음
      return new Set(
        items
          .filter(item => item.orderId && item.id !== equipment.id)
          .map(item => item.orderId!)
      )
    } else {
      // 등록 모드: 모든 등록된 발주 ID
      return new Set(
        items
          .filter(item => item.orderId)
          .map(item => item.orderId!)
      )
    }
  }, [items, equipment])

  // 철거보관 작업이 포함된 발주 목록 (아직 장비가 등록되지 않은 발주만)
  const removalOrders = useMemo(() => {
    return (orders || []).filter(order =>
      order.status !== 'cancelled' &&
      order.items.some(item => item.workType === '철거보관') &&
      !registeredOrderIds.has(order.id) // 아직 장비가 등록되지 않은 발주만
    )
  }, [orders, registeredOrderIds])


  // 수정 모드로 폼 초기화
  useEffect(() => {
    if (equipment) {
      // 수정 모드: 기존 데이터로 채우기
      setSelectedOrderId(equipment.orderId || '')
      setSiteName(equipment.siteName || '')
      setAffiliate(equipment.affiliate || '')
      setAddress(equipment.address || '')
      setCategory(equipment.category || '스탠드에어컨')
      setModel(equipment.model || '')
      setSize(equipment.size || '')
      setQuantity(equipment.quantity || 1)
      setManufacturer(equipment.manufacturer || '삼성')
      setManufacturingDate(equipment.manufacturingDate || '')
      setWarehouseId(equipment.warehouseId || '')
      setRemovalDate(equipment.removalDate || '')
    } else {
      // 등록 모드: 전체 초기화
      setSelectedOrderId('')
      setSiteName('')
      setAffiliate('')
      setAddress('')
      setCategory('스탠드에어컨')
      setModel('')
      setSize('')
      setQuantity(1)
      setManufacturer('삼성')
      setManufacturingDate('')
      setWarehouseId('')
      setRemovalDate('')
    }
  }, [equipment, open])

  /** 발주 선택 시 현장 정보 자동 채움 */
  const handleOrderSelect = (orderId: string) => {
    // "none"은 선택 안 함을 의미
    const actualOrderId = orderId === 'none' ? '' : orderId
    setSelectedOrderId(actualOrderId)

    if (actualOrderId) {
      const order = (orders || []).find(o => o.id === actualOrderId)
      if (order) {
        setSiteName(order.businessName || '')
        setAffiliate(order.affiliate || '')
        setAddress(order.address || '')
      }
    } else {
      setSiteName('')
      setAffiliate('')
      setAddress('')
    }
  }

  /** 저장 처리 */
  const handleSave = () => {
    if (!siteName.trim() || !category || !warehouseId) return

    onSave({
      orderId: selectedOrderId || undefined,
      siteName: siteName.trim(),
      affiliate: affiliate || undefined,
      address: address || undefined,
      category,
      model: model || undefined,
      size: size || undefined,
      quantity,
      manufacturer: manufacturer || undefined,
      manufacturingDate: manufacturingDate || undefined,
      warehouseId,
      removalDate: removalDate || undefined,
      status: equipment?.status || 'stored',
      releaseType: equipment?.releaseType,
      releaseDate: equipment?.releaseDate,
      releaseDestination: equipment?.releaseDestination,
      releaseNotes: equipment?.releaseNotes,
    })
    onOpenChange(false)
  }

  // 필수 입력 확인
  const isValid = siteName.trim() && category && warehouseId

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {equipment ? '장비 정보 수정' : '철거보관 장비 등록'}
          </DialogTitle>
          {!equipment && (
            <p className="text-sm text-gray-500 mt-1">
              철거보관 장비의 정보를 입력하세요. 발주서가 있다면 빠르게 선택할 수 있습니다.
            </p>
          )}
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* ═══ 빠른 입력: 최근 철거보관 발주 조회 ═══ */}
          {!equipment && removalOrders.length > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <div className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">
                  💡
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-blue-900 mb-1">
                    빠른 입력: 최근 철거보관 발주 조회
                  </h3>
                  <p className="text-xs text-blue-700 mb-3">
                    발주를 선택하면 현장 정보(계열사/지점명/주소)가 자동으로 채워집니다.
                  </p>
                  <Select value={selectedOrderId || 'none'} onValueChange={handleOrderSelect}>
                    <SelectTrigger className="bg-white border-blue-300">
                      <SelectValue placeholder="발주 선택 (또는 아래에서 직접 입력)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">선택 안 함 → 직접 입력</SelectItem>
                      {removalOrders.map((order) => (
                        <SelectItem key={order.id} value={order.id}>
                          📋 {order.businessName} · {order.affiliate || '계열사 미입력'} · {order.orderDate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* ═══ 섹션 1: 현장 정보 ═══ */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b">
              <div className="bg-gray-800 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">
                1
              </div>
              <h3 className="text-sm font-bold text-gray-800">현장 정보</h3>
            </div>

            {/* 계열사 + 지점명 */}
            <div>
              <Label className="text-sm font-semibold text-gray-700">
                계열사 + 지점명 <span className="text-red-500">*</span>
              </Label>
              <Input
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="예: Wells 영업 - 화곡지국"
                className="mt-1.5"
              />
            </div>

            {/* 계열사 */}
            <div>
              <Label className="text-sm font-semibold text-gray-700">계열사</Label>
              <Select value={affiliate} onValueChange={setAffiliate}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="계열사 선택" />
                </SelectTrigger>
                <SelectContent>
                  {AFFILIATE_OPTIONS.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 현장 주소 */}
            <div>
              <Label className="text-sm font-semibold text-gray-700">현장 주소</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="현장 주소 입력"
                className="mt-1.5"
              />
            </div>
          </div>

          {/* ═══ 섹션 2: 장비 정보 ═══ */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b">
              <div className="bg-gray-800 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">
                2
              </div>
              <h3 className="text-sm font-bold text-gray-800">장비 정보</h3>
            </div>

            {/* 품목 + 수량 */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-sm font-semibold text-gray-700">
                  품목 <span className="text-red-500">*</span>
                </Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-semibold text-gray-700">수량</Label>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="mt-1.5"
                  placeholder="대"
                />
              </div>
            </div>

            {/* 모델명 + 평형 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-semibold text-gray-700">모델명</Label>
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="예: AR-Q18P2PBXA"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-sm font-semibold text-gray-700">평형</Label>
                <Input
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  placeholder="예: 18평"
                  className="mt-1.5"
                />
              </div>
            </div>

            {/* 제조사 + 제조년월 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-semibold text-gray-700">제조사</Label>
                <Select value={manufacturer} onValueChange={setManufacturer}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MANUFACTURER_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-semibold text-gray-700">제조년월</Label>
                <div className="flex gap-2 mt-1.5 relative">
                  <Input
                    type="text"
                    value={manufacturingDate}
                    onChange={(e) => setManufacturingDate(e.target.value)}
                    placeholder="2024-01"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => monthInputRef.current?.showPicker()}
                  >
                    <Calendar className="h-4 w-4" />
                  </Button>
                  <input
                    ref={monthInputRef}
                    type="month"
                    value={manufacturingDate}
                    onChange={(e) => setManufacturingDate(e.target.value)}
                    className="absolute right-0 top-0 w-10 h-10 opacity-0 pointer-events-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ═══ 섹션 3: 보관 정보 ═══ */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b">
              <div className="bg-gray-800 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">
                3
              </div>
              <h3 className="text-sm font-bold text-gray-800">보관 정보</h3>
            </div>

            {/* 보관 창고 + 철거일 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-semibold text-gray-700">
                  보관 창고 <span className="text-red-500">*</span>
                </Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="창고 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map(wh => (
                      <SelectItem key={wh.id} value={wh.id}>
                        📦 {wh.name} {wh.managerName ? `(${wh.managerName})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-semibold text-gray-700">철거일</Label>
                <div className="flex gap-2 mt-1.5 relative">
                  <Input
                    type="text"
                    value={removalDate}
                    onChange={(e) => setRemovalDate(e.target.value)}
                    placeholder="2024-01-15"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => dateInputRef.current?.showPicker()}
                  >
                    <Calendar className="h-4 w-4" />
                  </Button>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={removalDate}
                    onChange={(e) => setRemovalDate(e.target.value)}
                    className="absolute right-0 top-0 w-10 h-10 opacity-0 pointer-events-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            취소
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isValid}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            {equipment ? '✓ 수정 완료' : '✓ 등록 완료'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
