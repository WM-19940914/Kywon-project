/**
 * 철거보관 장비 등록/수정 다이얼로그
 *
 * - 등록 모드: equipment가 null이면 새로 등록
 * - 수정 모드: equipment가 있으면 기존 데이터로 폼 채움
 * - 발주 기반 등록: contextSite가 있으면 현장 정보 자동 채움
 *   + 해당 발주의 철거보관 OrderItem을 드롭다운으로 제공
 *
 * 필수 입력: 현장명, 품목, 보관 창고
 * 선택 입력: 모델명, 평형, 제조사, 제조년월, 주소, 계열사, 장비 상태, 철거 사유, 메모
 */

'use client'

import { useState, useEffect } from 'react'
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
import type { StoredEquipment, EquipmentCondition, StoredEquipmentSite } from '@/types/order'
import type { Warehouse } from '@/types/warehouse'
import { CATEGORY_OPTIONS, AFFILIATE_OPTIONS, EQUIPMENT_CONDITION_LABELS, MANUFACTURER_OPTIONS } from '@/types/order'

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
  /** 현장 컨텍스트 (발주 기반 등록 시 — 현장 정보 자동 채움) */
  contextSite?: StoredEquipmentSite | null
}

export function StoredEquipmentFormDialog({
  equipment,
  open,
  onOpenChange,
  onSave,
  warehouses,
  contextSite,
}: StoredEquipmentFormDialogProps) {
  // 폼 상태
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
  const [storageStartDate, setStorageStartDate] = useState(new Date().toISOString().split('T')[0])
  const [condition, setCondition] = useState<EquipmentCondition>('good')
  const [removalReason, setRemovalReason] = useState('')
  const [notes, setNotes] = useState('')

  // 발주 기반 등록: 해당 현장의 철거보관 OrderItem 목록
  const removalOrderItems = contextSite?.orderItems?.filter(
    item => item.workType === '철거보관'
  ) || []

  // 수정 모드 또는 컨텍스트 기반으로 폼 초기화
  useEffect(() => {
    if (equipment) {
      // 수정 모드: 기존 데이터로 채우기
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
      setStorageStartDate(equipment.storageStartDate || new Date().toISOString().split('T')[0])
      setCondition(equipment.condition || 'good')
      setRemovalReason(equipment.removalReason || '')
      setNotes(equipment.notes || '')
    } else if (contextSite) {
      // 발주 기반 등록: 현장 정보 자동 채움
      setSiteName(contextSite.siteName || '')
      setAffiliate(contextSite.affiliate || '')
      setAddress(contextSite.address || '')
      setCategory('스탠드에어컨')
      setModel('')
      setSize('')
      setQuantity(1)
      setManufacturer('삼성')
      setManufacturingDate('')
      setWarehouseId('')
      setStorageStartDate(new Date().toISOString().split('T')[0])
      setCondition('good')
      setRemovalReason('')
      setNotes('')
    } else {
      // 수동 등록 모드: 전체 초기화
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
      setStorageStartDate(new Date().toISOString().split('T')[0])
      setCondition('good')
      setRemovalReason('')
      setNotes('')
    }
  }, [equipment, contextSite, open])

  /** 발주 OrderItem 선택 시 품목/모델/평형 자동 채움 */
  const handleOrderItemSelect = (value: string) => {
    if (value === '__none__') return
    const idx = parseInt(value)
    const item = removalOrderItems[idx]
    if (item) {
      setCategory(item.category || '스탠드에어컨')
      setModel(item.model || '')
      setSize(item.size || '')
    }
  }

  /** 저장 처리 */
  const handleSave = () => {
    if (!siteName.trim() || !category || !warehouseId) return

    onSave({
      orderId: equipment?.orderId || contextSite?.orderId || undefined,
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
      storageStartDate,
      condition,
      removalReason: removalReason || undefined,
      notes: notes || undefined,
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {equipment ? '장비 정보 수정' : '철거보관 장비 등록'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 발주 기반: OrderItem 선택 (등록 모드 + 철거보관 항목이 있을 때만) */}
          {!equipment && removalOrderItems.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-blue-700">
                발주서에 철거보관 {removalOrderItems.length}건이 있습니다 — 선택하면 자동 입력됩니다
              </p>
              <Select onValueChange={handleOrderItemSelect}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="발주 내역에서 선택..." />
                </SelectTrigger>
                <SelectContent>
                  {removalOrderItems.map((item, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      {item.category} · {item.model || '모델 미입력'} · {item.size || '-'} ({item.quantity}대)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 현장명 (필수) — 발주 기반이면 읽기전용 */}
          <div>
            <Label className="text-sm font-medium">
              현장명 <span className="text-red-500">*</span>
            </Label>
            <Input
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="예: 구몬 화곡지국"
              className="mt-1"
              readOnly={!!contextSite}
            />
          </div>

          {/* 계열사 */}
          <div>
            <Label className="text-sm font-medium">계열사</Label>
            <Select value={affiliate} onValueChange={setAffiliate}>
              <SelectTrigger className="mt-1">
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
            <Label className="text-sm font-medium">현장 주소</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="현장 주소 입력"
              className="mt-1"
            />
          </div>

          {/* 품목 + 수량 (한 줄) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">
                품목 <span className="text-red-500">*</span>
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1">
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
              <Label className="text-sm font-medium">수량</Label>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="mt-1"
              />
            </div>
          </div>

          {/* 모델명 + 평형 (한 줄) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">모델명</Label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="모델명 입력"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">평형</Label>
              <Input
                value={size}
                onChange={(e) => setSize(e.target.value)}
                placeholder="예: 18평"
                className="mt-1"
              />
            </div>
          </div>

          {/* 제조사 + 제조년월 (한 줄) — 신규 필드 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">제조사</Label>
              <Select value={manufacturer} onValueChange={setManufacturer}>
                <SelectTrigger className="mt-1">
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
              <Label className="text-sm font-medium">제조년월</Label>
              <Input
                type="month"
                value={manufacturingDate}
                onChange={(e) => setManufacturingDate(e.target.value)}
                placeholder="YYYY-MM"
                className="mt-1"
              />
            </div>
          </div>

          {/* 보관 창고 (필수) */}
          <div>
            <Label className="text-sm font-medium">
              보관 창고 <span className="text-red-500">*</span>
            </Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="창고 선택" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map(wh => (
                  <SelectItem key={wh.id} value={wh.id}>
                    {wh.name} {wh.managerName ? `(${wh.managerName})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 보관 시작일 + 장비 상태 (한 줄) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">보관 시작일</Label>
              <Input
                type="date"
                value={storageStartDate}
                onChange={(e) => setStorageStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">장비 상태</Label>
              <Select value={condition} onValueChange={(v) => setCondition(v as EquipmentCondition)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="good">{EQUIPMENT_CONDITION_LABELS['good']}</SelectItem>
                  <SelectItem value="poor">{EQUIPMENT_CONDITION_LABELS['poor']}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 철거 사유 */}
          <div>
            <Label className="text-sm font-medium">철거 사유</Label>
            <Input
              value={removalReason}
              onChange={(e) => setRemovalReason(e.target.value)}
              placeholder="예: 이전설치 예정, 노후 장비 등"
              className="mt-1"
            />
          </div>

          {/* 메모 */}
          <div>
            <Label className="text-sm font-medium">메모</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="추가 메모를 입력하세요"
              className="w-full mt-1 border rounded-md p-2 text-sm min-h-[60px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-300 placeholder:text-gray-300"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={!isValid}>
            {equipment ? '수정' : '등록'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
