/**
 * 철거보관 장비 등록/수정 다이얼로그
 *
 * - 등록 모드: equipment가 null이면 새로 등록 (여러 대 동시 등록 가능)
 * - 수정 모드: equipment가 있으면 기존 데이터로 폼 채움 (1대만 수정)
 * - 발주 선택 (선택사항): 발주 선택하면 계열사/사업자명/주소 자동 채움
 * - 단가표로 입력하기: 실내기/실외기만 자동 추가 (자재박스 제외)
 * - 카카오 주소 검색: 다음 우편번호 서비스로 도로명 주소 입력
 *
 * 필수 입력: 사업자명, 장비 1행 이상, 보관 창고
 */

'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { StoredEquipment, Order, EquipmentUnitType } from '@/types/order'
import type { Warehouse } from '@/types/warehouse'
import { CATEGORY_OPTIONS, AFFILIATE_OPTIONS, MANUFACTURER_OPTIONS, SIZE_OPTIONS, EQUIPMENT_UNIT_TYPE_OPTIONS, EQUIPMENT_UNIT_TYPE_LABELS } from '@/types/order'
import { Calendar, Plus, Trash2, BookOpen, Search as SearchIcon } from 'lucide-react'
import { StoredEquipmentPriceSheet, type EquipmentRow, type ComponentInfo } from './stored-equipment-price-sheet'

/** 장비 테이블 행 상태 */
interface EquipmentRowState {
  id: string // 고유 키 (렌더링용)
  category: string
  equipmentUnitType: string // 장비 유형 (SET/실내기/실외기 등)
  model: string
  size: string
  manufacturer: string
  manufacturingDate: string
  quantity: number
  components?: ComponentInfo[] // SET 모델일 때 구성품 정보 (표시용)
}

/** 빈 장비 행 생성 */
function createEmptyRow(): EquipmentRowState {
  return {
    id: crypto.randomUUID(),
    category: '스탠드에어컨',
    equipmentUnitType: '',
    model: '',
    size: '',
    manufacturer: '삼성',
    manufacturingDate: '',
    quantity: 1,
  }
}

interface StoredEquipmentFormDialogProps {
  /** 수정 대상 (null이면 등록 모드) */
  equipment: StoredEquipment | null
  /** 다이얼로그 열림/닫힘 */
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 저장 콜백 (등록 또는 수정) */
  onSave: (data: Omit<StoredEquipment, 'id' | 'createdAt' | 'updatedAt'>) => void
  /** 신규 등록 콜백 (수정 모드에서 행 추가분 저장용) */
  onCreate?: (data: Omit<StoredEquipment, 'id' | 'createdAt' | 'updatedAt'>) => void
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
  onCreate,
  warehouses,
  orders,
  items,
}: StoredEquipmentFormDialogProps) {
  // ─── 현장정보 상태 ───
  const [selectedOrderId, setSelectedOrderId] = useState<string>('')
  const [affiliate, setAffiliate] = useState('')
  const [siteName, setSiteName] = useState('')
  const [address, setAddress] = useState('')

  // ─── 장비정보 상태 (테이블 행 배열) ───
  const [equipmentRows, setEquipmentRows] = useState<EquipmentRowState[]>([createEmptyRow()])

  // ─── 보관정보 상태 ───
  const [warehouseId, setWarehouseId] = useState('')
  const [removalDate, setRemovalDate] = useState('')

  // ─── 메모 상태 ───
  const [notes, setNotes] = useState('')

  // ─── 단가표 Sheet 상태 ───
  const [priceSheetOpen, setPriceSheetOpen] = useState(false)

  // 달력 ref
  const dateInputRef = useRef<HTMLInputElement>(null)

  // 이미 장비가 등록된 발주 ID 목록
  const registeredOrderIds = useMemo(() => {
    if (equipment) {
      return new Set(
        items
          .filter(item => item.orderId && item.id !== equipment.id)
          .map(item => item.orderId!)
      )
    } else {
      return new Set(
        items
          .filter(item => item.orderId)
          .map(item => item.orderId!)
      )
    }
  }, [items, equipment])

  // 철거보관 작업이 포함된 발주 목록
  const removalOrders = useMemo(() => {
    return (orders || []).filter(order =>
      order.status !== 'cancelled' &&
      order.items.some(item => item.workType === '철거보관') &&
      !registeredOrderIds.has(order.id)
    )
  }, [orders, registeredOrderIds])

  // ─── 다음 우편번호 서비스 스크립트 로드 ───
  useEffect(() => {
    if (!open) return
    // 이미 로드되었으면 스킵
    if (document.querySelector('script[src*="postcode.v2.js"]')) return

    const script = document.createElement('script')
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.async = true
    document.body.appendChild(script)

    return () => {
      // 다이얼로그 닫힐 때 스크립트 제거하지 않음 (재사용 가능)
    }
  }, [open])

  // ─── 폼 초기화 ───
  useEffect(() => {
    if (equipment) {
      // 수정 모드: 기존 데이터로 채움
      setSelectedOrderId(equipment.orderId || '')
      setAffiliate(equipment.affiliate || '')
      setSiteName(equipment.siteName || '')
      setAddress(equipment.address || '')
      setEquipmentRows([{
        id: crypto.randomUUID(),
        category: equipment.category || '스탠드에어컨',
        equipmentUnitType: equipment.equipmentUnitType || '',
        model: equipment.model || '',
        size: equipment.size || '',
        manufacturer: equipment.manufacturer || '삼성',
        manufacturingDate: equipment.manufacturingDate || '',
        quantity: equipment.quantity || 1,
      }])
      setWarehouseId(equipment.warehouseId || '')
      setRemovalDate(equipment.removalDate || '')
      setNotes(equipment.notes || '')
    } else {
      // 등록 모드: 전체 초기화
      setSelectedOrderId('')
      setAffiliate('')
      setSiteName('')
      setAddress('')
      setEquipmentRows([createEmptyRow()])
      setWarehouseId('')
      setRemovalDate('')
      setNotes('')
    }
  }, [equipment, open])

  /** 발주 선택 시 현장 정보 자동 채움 */
  const handleOrderSelect = (orderId: string) => {
    const actualOrderId = orderId === 'none' ? '' : orderId
    setSelectedOrderId(actualOrderId)

    if (actualOrderId) {
      const order = (orders || []).find(o => o.id === actualOrderId)
      if (order) {
        setAffiliate(order.affiliate || '')
        setSiteName(order.businessName || '')
        setAddress(order.address || '')
      }
    } else {
      setAffiliate('')
      setSiteName('')
      setAddress('')
    }
  }

  /** 카카오(다음) 주소 검색 팝업 */
  const handleSearchAddress = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(window as any).daum) {
      alert('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new (window as any).daum.Postcode({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      oncomplete: function(data: any) {
        const roadAddr = data.roadAddress || data.jibunAddress
        setAddress(roadAddr)
      }
    }).open()
  }, [])

  /** 장비 행 업데이트 */
  const updateRow = (rowId: string, field: keyof EquipmentRowState, value: string | number) => {
    setEquipmentRows(prev => prev.map(row =>
      row.id === rowId ? { ...row, [field]: value } : row
    ))
  }

  /** 수동 행 추가 */
  const addEmptyRow = () => {
    setEquipmentRows(prev => [...prev, createEmptyRow()])
  }

  /** 행 삭제 (최소 1행 유지) */
  const removeRow = (rowId: string) => {
    setEquipmentRows(prev => {
      if (prev.length <= 1) return prev
      return prev.filter(row => row.id !== rowId)
    })
  }

  /** 단가표에서 장비 추가 */
  const handlePriceSheetAddRows = (rows: EquipmentRow[]) => {
    const newRows: EquipmentRowState[] = rows.map(r => ({
      id: crypto.randomUUID(),
      category: r.category,
      equipmentUnitType: r.equipmentUnitType || '',
      model: r.model,
      size: r.size,
      manufacturer: r.manufacturer,
      manufacturingDate: r.manufacturingDate,
      quantity: r.quantity,
      components: r.components,
    }))

    setEquipmentRows(prev => {
      // 첫 번째 행이 비어있으면 교체, 아니면 뒤에 추가
      const firstRow = prev[0]
      const isFirstRowEmpty = !firstRow.model && !firstRow.size && firstRow.quantity === 1
      if (prev.length === 1 && isFirstRowEmpty) {
        return newRows
      }
      return [...prev, ...newRows]
    })
  }

  /** 저장 처리 — 수정 모드: 첫 행은 수정, 추가 행은 새로 등록 */
  const handleSave = () => {
    // 유효한 장비 행만 필터 (품목이 있는 행)
    const validRows = equipmentRows.filter(row => row.category)
    if (!siteName.trim() || validRows.length === 0 || !warehouseId) return

    // 공통 데이터 (현장정보 + 보관정보)
    const commonData = {
      orderId: selectedOrderId || undefined,
      siteName: siteName.trim(),
      affiliate: affiliate || undefined,
      address: address || undefined,
      warehouseId,
      removalDate: removalDate || undefined,
      notes: notes || undefined,
      status: equipment?.status || 'stored' as const,
      releaseType: equipment?.releaseType,
      releaseDate: equipment?.releaseDate,
      releaseDestination: equipment?.releaseDestination,
      releaseAddress: equipment?.releaseAddress,
      releaseNotes: equipment?.releaseNotes,
    }

    validRows.forEach((row, idx) => {
      const rowData = {
        ...commonData,
        category: row.category,
        equipmentUnitType: (row.equipmentUnitType || undefined) as EquipmentUnitType | undefined,
        model: row.model || undefined,
        size: row.size || undefined,
        quantity: row.quantity,
        manufacturer: row.manufacturer || undefined,
        manufacturingDate: row.manufacturingDate || undefined,
      }

      if (idx === 0) {
        // 첫 번째 행 → 기존 장비 수정 (또는 신규 등록)
        onSave(rowData)
      } else if (onCreate) {
        // 추가 행 → 무조건 새로 등록
        onCreate(rowData)
      } else {
        // onCreate가 없으면 onSave로 대체 (등록 모드)
        onSave(rowData)
      }
    })
    onOpenChange(false)
  }

  // 유효성 검사: 사업자명 + 장비 1행 이상(품목 있는) + 창고
  const validRowCount = equipmentRows.filter(row => row.category).length
  const isValid = siteName.trim() && validRowCount > 0 && warehouseId

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
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
            <div className="bg-gradient-to-r from-teal-50 to-teal-50 border-2 border-teal-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <div className="bg-teal-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mt-0.5">
                  !
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-teal-900 mb-1">
                    빠른 입력: 최근 철거보관 발주 조회
                  </h3>
                  <p className="text-xs text-teal-700 mb-3">
                    발주를 선택하면 현장 정보(계열사/사업자명/주소)가 자동으로 채워집니다.
                  </p>
                  <Select value={selectedOrderId || 'none'} onValueChange={handleOrderSelect}>
                    <SelectTrigger className="bg-white border-teal-300">
                      <SelectValue placeholder="발주 선택 (또는 아래에서 직접 입력)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">선택 안 함 → 직접 입력</SelectItem>
                      {removalOrders.map((order) => (
                        <SelectItem key={order.id} value={order.id}>
                          {order.businessName} · {order.affiliate || '계열사 미입력'} · {order.orderDate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* ═══ 섹션 1: 현장정보(철거한곳) ═══ */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b">
              <div className="bg-gray-800 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">
                1
              </div>
              <h3 className="text-sm font-bold text-gray-800">현장정보(철거한곳)</h3>
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

            {/* 사업자명 */}
            <div>
              <Label className="text-sm font-semibold text-gray-700">
                사업자명 <span className="text-brick-500">*</span>
              </Label>
              <Input
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="예: Wells 영업 - 화곡지국"
                className="mt-1.5"
              />
            </div>

            {/* 현장주소 + 주소검색 버튼 */}
            <div>
              <Label className="text-sm font-semibold text-gray-700">현장주소</Label>
              <div className="flex gap-2 mt-1.5">
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="주소검색 버튼을 클릭하세요"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSearchAddress}
                  className="shrink-0 gap-1.5"
                >
                  <SearchIcon className="h-4 w-4" />
                  주소검색
                </Button>
              </div>
            </div>
          </div>

          {/* ═══ 섹션 2: 장비 정보 (테이블) ═══ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-2 border-b">
              <div className="flex items-center gap-2">
                <div className="bg-gray-800 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">
                  2
                </div>
                <h3 className="text-sm font-bold text-gray-800">장비 정보</h3>
                {equipmentRows.length > 1 && (
                  <span className="text-xs text-gray-400">{equipmentRows.length}대</span>
                )}
                <span className="text-xs font-bold text-brick-500 ml-2">! 꼭 실내기·실외기 분리해서 적어주세요</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPriceSheetOpen(true)}
                className="gap-1.5 text-teal-600 border-teal-200 hover:bg-teal-50"
              >
                <BookOpen className="h-3.5 w-3.5" />
                단가표로 입력하기
              </Button>
            </div>

            {/* 장비 테이블 */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 text-xs">
                    <th className="px-2 py-2 text-left font-semibold w-[110px]">품목</th>
                    <th className="px-2 py-2 text-left font-semibold w-[70px]">유형</th>
                    <th className="px-2 py-2 text-left font-semibold">모델명</th>
                    <th className="px-2 py-2 text-left font-semibold w-[60px]">평형</th>
                    <th className="px-2 py-2 text-left font-semibold w-[75px]">제조사</th>
                    <th className="px-2 py-2 text-left font-semibold w-[90px]">제조년월</th>
                    <th className="px-2 py-2 text-center font-semibold w-[50px]">수량</th>
                    <th className="px-1 py-2 text-center font-semibold w-[36px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {equipmentRows.map((row) => (
                    <EquipmentTableRow
                      key={row.id}
                      row={row}
                      onUpdate={updateRow}
                      onRemove={removeRow}
                      canRemove={equipmentRows.length > 1}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* 행 추가 버튼 */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addEmptyRow}
              className="w-full text-gray-500 hover:text-gray-700 gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              행 추가
            </Button>
          </div>

          {/* ═══ 섹션 3: 보관 정보 ═══ */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b">
              <div className="bg-gray-800 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">
                3
              </div>
              <h3 className="text-sm font-bold text-gray-800">보관 정보</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-semibold text-gray-700">
                  보관 창고 <span className="text-brick-500">*</span>
                </Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="창고 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map(wh => (
                      <SelectItem key={wh.id} value={wh.id}>
                        {wh.name} — {wh.address}{wh.managerName ? ` (${wh.managerName})` : ''}
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

          {/* ═══ 섹션 4: 메모 ═══ */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b">
              <div className="bg-gray-800 text-white rounded w-6 h-6 flex items-center justify-center text-xs font-bold">
                4
              </div>
              <h3 className="text-sm font-bold text-gray-800">메모</h3>
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="철거 사유, 장비 상태 등 참고할 내용을 입력하세요"
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            취소
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isValid}
            className="flex-1 bg-teal-600 hover:bg-teal-700"
          >
            {equipment
              ? '수정 완료'
              : `등록 완료 (${validRowCount}대)`
            }
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* 단가표 Sheet */}
      <StoredEquipmentPriceSheet
        open={priceSheetOpen}
        onOpenChange={setPriceSheetOpen}
        onAddRows={handlePriceSheetAddRows}
      />
    </Dialog>
  )
}

// ─── 장비 테이블 행 컴포넌트 ───

interface EquipmentTableRowProps {
  row: EquipmentRowState
  onUpdate: (rowId: string, field: keyof EquipmentRowState, value: string | number) => void
  onRemove: (rowId: string) => void
  canRemove: boolean
}

/** 장비 테이블 한 행 — 인라인 편집 */
function EquipmentTableRow({ row, onUpdate, onRemove, canRemove }: EquipmentTableRowProps) {
  const monthRef = useRef<HTMLInputElement>(null)

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50/50">
      {/* 품목 */}
      <td className="px-1 py-1.5">
        <select
          value={row.category}
          onChange={(e) => onUpdate(row.id, 'category', e.target.value)}
          className="w-full text-xs border border-gray-200 rounded px-1.5 py-1.5 bg-white focus:outline-none focus:border-teal-400"
        >
          {CATEGORY_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </td>

      {/* 유형 (SET/실내기/실외기 등) */}
      <td className="px-1 py-1.5">
        <select
          value={row.equipmentUnitType}
          onChange={(e) => onUpdate(row.id, 'equipmentUnitType', e.target.value)}
          className="w-full text-xs border border-gray-200 rounded px-1 py-1.5 bg-white focus:outline-none focus:border-teal-400"
        >
          <option value="">선택</option>
          {EQUIPMENT_UNIT_TYPE_OPTIONS.map(opt => (
            <option key={opt} value={opt}>
              {EQUIPMENT_UNIT_TYPE_LABELS[opt]}{opt === 'set' ? ' (자재x)' : ''}
            </option>
          ))}
        </select>
      </td>

      {/* 모델명 + 구성품 정보 */}
      <td className="px-1 py-1.5">
        <input
          value={row.model}
          onChange={(e) => onUpdate(row.id, 'model', e.target.value)}
          placeholder="모델명"
          className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-teal-400 font-mono"
        />
        {/* SET 모델일 때 구성품 표시 */}
        {row.components && row.components.length > 0 && (
          <div className="flex gap-1.5 mt-1 ml-0.5">
            {row.components.map((comp, i) => (
              <span key={i} className="text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
                <span className="font-semibold text-teal-600">{comp.type}</span> {comp.model}
              </span>
            ))}
          </div>
        )}
      </td>

      {/* 평형 (드롭다운) */}
      <td className="px-1 py-1.5">
        <select
          value={row.size}
          onChange={(e) => onUpdate(row.id, 'size', e.target.value)}
          className="w-full text-xs border border-gray-200 rounded px-1 py-1.5 bg-white focus:outline-none focus:border-teal-400"
        >
          <option value="">선택</option>
          {SIZE_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </td>

      {/* 제조사 */}
      <td className="px-1 py-1.5">
        <select
          value={row.manufacturer}
          onChange={(e) => onUpdate(row.id, 'manufacturer', e.target.value)}
          className="w-full text-xs border border-gray-200 rounded px-1 py-1.5 bg-white focus:outline-none focus:border-teal-400"
        >
          {MANUFACTURER_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </td>

      {/* 제조년월 */}
      <td className="px-1 py-1.5">
        <div className="flex items-center gap-0.5 relative">
          <input
            value={row.manufacturingDate}
            onChange={(e) => onUpdate(row.id, 'manufacturingDate', e.target.value)}
            placeholder="2024-01"
            className="w-full text-xs border border-gray-200 rounded px-1.5 py-1.5 bg-white focus:outline-none focus:border-teal-400"
          />
          <button
            type="button"
            onClick={() => monthRef.current?.showPicker()}
            className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <Calendar className="h-3 w-3" />
          </button>
          <input
            ref={monthRef}
            type="month"
            value={row.manufacturingDate}
            onChange={(e) => onUpdate(row.id, 'manufacturingDate', e.target.value)}
            className="absolute right-0 top-0 w-6 h-6 opacity-0 pointer-events-none"
          />
        </div>
      </td>

      {/* 수량 */}
      <td className="px-1 py-1.5">
        <input
          type="number"
          min={1}
          value={row.quantity}
          onChange={(e) => onUpdate(row.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
          className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-teal-400 text-center"
        />
      </td>

      {/* 삭제 */}
      <td className="px-1 py-1.5 text-center">
        <button
          type="button"
          onClick={() => onRemove(row.id)}
          disabled={!canRemove}
          className="text-gray-300 hover:text-brick-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  )
}
