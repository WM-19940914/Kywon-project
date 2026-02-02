/**
 * 배송관리 메인 테이블 컴포넌트
 *
 * 메인 테이블 컬럼:
 *   상태 | 매입처 | 발주일 | 구성품 | 현장명 | 발주서 | 현장위치 | 창고정보
 *
 * 행 클릭(아코디언) → 구성품별 인라인 편집 테이블:
 *   상태 | 매입처 | 주문일 | 주문번호 | 배송예정일 | 배송완료일 | 모델명 | 수량 | 창고 | 삭제
 *
 * 아코디언 열면 바로 편집 가능 (기존 데이터 없으면 기본 3행 공란)
 * 행추가 버튼으로 행 추가, 저장 버튼으로 저장
 */

'use client'

import { Fragment, useState, useCallback, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FileText,
  MapPin,
  Package,
  Pencil,
  Phone,
  Plus,
  Search as SearchIcon,
  Trash2,
  User,
  Warehouse as WarehouseIcon
} from 'lucide-react'
import { ClipboardList } from 'lucide-react'
import type { Order, EquipmentItem, DeliveryStatus } from '@/types/order'
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_COLORS, ITEM_DELIVERY_STATUS_LABELS, ITEM_DELIVERY_STATUS_COLORS } from '@/types/order'
import {
  computeDeliveryProgress,
  getAlertType,
  getWarehouseDetail,
  formatShortDate,
  computeItemDeliveryStatus,
  analyzeDeliveryDelay,
  computeOrderedDocStatus,
  ORDERED_DOC_STATUS_STYLES,
  getWarehouseCache,
} from '@/lib/delivery-utils'
import { DeliveryPriceTableSheet } from '@/components/delivery/delivery-price-table-sheet'

/**
 * SET 모델 그룹 컬러바 색상 (6가지 순환)
 * 같은 SET 모델에 속한 구성품 행들의 좌측에 같은 색상의 세로 막대를 표시
 */
const SET_GROUP_COLORS = [
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EC4899', // pink
  '#06B6D4', // cyan
]

/**
 * 편집 중인 구성품 배열에서 연속된 같은 setModel을 가진 행들을 그룹으로 묶어
 * 각 행에 컬러바 색상을 할당하는 함수
 *
 * - setModel이 없는 행 → undefined (컬러바 없음)
 * - 같은 setModel이라도 중간에 끊기면 별도 그룹 (별도 색상)
 */
function computeSetModelGroups(items: EquipmentItem[]): (string | undefined)[] {
  const colors: (string | undefined)[] = new Array(items.length).fill(undefined)
  let colorIdx = 0
  let i = 0

  while (i < items.length) {
    const setModel = items[i].setModel
    // setModel이 없으면 컬러바 없이 넘어감
    if (!setModel) {
      i++
      continue
    }

    // 같은 setModel이 연속된 범위 찾기
    let j = i
    while (j < items.length && items[j].setModel === setModel) {
      j++
    }

    // 연속된 그룹에 같은 색상 할당
    const color = SET_GROUP_COLORS[colorIdx % SET_GROUP_COLORS.length]
    for (let k = i; k < j; k++) {
      colors[k] = color
    }

    colorIdx++
    i = j
  }

  return colors
}

/**
 * 날짜 문자열 자동 정규화
 *
 * 다양한 형식을 YYYY-MM-DD로 변환:
 * - "260130" → "2026-01-30"
 * - "20260130" → "2026-01-30"
 * - "26-01-30" → "2026-01-30"
 * - "2026.01.30" → "2026-01-30"
 * - "2026/01/30" → "2026-01-30"
 * - "2026-01-30" → 그대로
 */
function normalizeDate(raw: string): string {
  const s = raw.trim().replace(/[./\s]/g, '-')

  // 이미 YYYY-MM-DD 형식
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // YY-MM-DD → 20YY-MM-DD
  if (/^\d{2}-\d{2}-\d{2}$/.test(s)) return `20${s}`

  // 숫자만 있는 경우
  const digits = raw.replace(/\D/g, '')

  // 6자리: YYMMDD → 20YY-MM-DD
  if (digits.length === 6) {
    return `20${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`
  }

  // 8자리: YYYYMMDD → YYYY-MM-DD
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  }

  return s
}

/**
 * 날짜 입력 컴포넌트 (텍스트 직접 입력/복붙 + 달력 버튼)
 *
 * - 직접 타이핑 가능 (포커스 빠지면 자동 정규화)
 * - Ctrl+V 붙여넣기 시 즉시 정규화
 * - 달력 아이콘 클릭하면 날짜 선택기 열림
 */
function DateInput({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const dateRef = useRef<HTMLInputElement>(null)

  return (
    <div className="relative flex items-center">
      {/* 텍스트 입력 */}
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          // 포커스 빠지면 자동 정규화
          const v = e.target.value.trim()
          if (v) onChange(normalizeDate(v))
        }}
        onKeyDown={(e) => {
          // Enter 누르면 정규화 후 다음 필드로
          if (e.key === 'Enter') {
            const v = (e.target as HTMLInputElement).value.trim()
            if (v) onChange(normalizeDate(v))
          }
        }}
        onPaste={(e) => {
          e.preventDefault()
          const pasted = e.clipboardData.getData('text').trim()
          onChange(normalizeDate(pasted))
        }}
        placeholder="YYYY-MM-DD"
        className="h-7 text-xs border-gray-200 pr-7"
      />
      {/* 달력 아이콘 버튼 */}
      <button
        type="button"
        className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
        onClick={(e) => {
          e.stopPropagation()
          dateRef.current?.showPicker()
        }}
        tabIndex={-1}
      >
        <CalendarDays className="h-3.5 w-3.5" />
      </button>
      {/* 숨겨진 date input (달력 선택기용) */}
      <input
        ref={dateRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute w-0 h-0 opacity-0 pointer-events-none"
        tabIndex={-1}
      />
    </div>
  )
}

/**
 * 창고 선택 팝업 컴포넌트
 *
 * 창고 카드 리스트를 보여주고 검색/선택할 수 있는 Dialog.
 * 카드에 창고명/주소/팀장명/연락처 전부 표시.
 */
function WarehousePickerDialog({
  open,
  onOpenChange,
  onSelect,
  currentId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (warehouseId: string) => void
  currentId?: string
}) {
  const [search, setSearch] = useState('')
  /** 인도처 추가 폼 열림/닫힘 */
  const [showAddForm, setShowAddForm] = useState(false)
  /** 새 인도처 입력 데이터 */
  const [newWarehouse, setNewWarehouse] = useState({ name: '', address: '', managerName: '', managerPhone: '' })

  const warehouseList = getWarehouseCache()
  const filtered = warehouseList.filter(wh => {
    if (!search) return true
    const term = search.toLowerCase()
    return (
      wh.name.toLowerCase().includes(term) ||
      wh.address.toLowerCase().includes(term) ||
      (wh.managerName || '').toLowerCase().includes(term)
    )
  })

  /** 새 인도처 저장 (DB + 캐시에 추가) */
  const handleAddWarehouse = async () => {
    if (!newWarehouse.name.trim() || !newWarehouse.address.trim()) return
    const newId = `wh-${Date.now()}`
    const whData = {
      id: newId,
      name: newWarehouse.name.trim(),
      address: newWarehouse.address.trim(),
      managerName: newWarehouse.managerName.trim() || undefined,
      managerPhone: newWarehouse.managerPhone.trim() || undefined,
    }
    // 캐시에 추가 (UI 즉시 반영)
    getWarehouseCache().push(whData)
    // DB에도 저장 (비동기)
    const { createWarehouse } = await import('@/lib/supabase/dal')
    createWarehouse(whData)
    // 추가 후 바로 선택
    onSelect(newId)
    onOpenChange(false)
    // 폼 초기화
    setNewWarehouse({ name: '', address: '', managerName: '', managerPhone: '' })
    setShowAddForm(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setShowAddForm(false) }}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base">
              <WarehouseIcon className="h-4 w-4" />
              창고 선택
            </DialogTitle>
            <Button
              size="sm"
              variant={showAddForm ? 'secondary' : 'outline'}
              className="text-xs h-7"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              인도처 추가
            </Button>
          </div>
        </DialogHeader>

        {/* 인도처 추가 폼 */}
        {showAddForm && (
          <div className="border border-blue-200 bg-blue-50/50 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-blue-700">새 인도처 정보 입력</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-gray-500">창고명 *</label>
                <Input
                  value={newWarehouse.name}
                  onChange={(e) => setNewWarehouse(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="예: 부산창고"
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500">담당자명</label>
                <Input
                  value={newWarehouse.managerName}
                  onChange={(e) => setNewWarehouse(prev => ({ ...prev, managerName: e.target.value }))}
                  placeholder="예: 홍길동"
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500">주소 *</label>
                <Input
                  value={newWarehouse.address}
                  onChange={(e) => setNewWarehouse(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="예: 부산시 해운대구..."
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-500">연락처</label>
                <Input
                  value={newWarehouse.managerPhone}
                  onChange={(e) => setNewWarehouse(prev => ({ ...prev, managerPhone: e.target.value }))}
                  placeholder="예: 010-1234-5678"
                  className="h-7 text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-1.5 pt-1">
              <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setShowAddForm(false)}>
                취소
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7"
                disabled={!newWarehouse.name.trim() || !newWarehouse.address.trim()}
                onClick={handleAddWarehouse}
              >
                저장 후 선택
              </Button>
            </div>
          </div>
        )}

        {/* 검색 */}
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="창고명, 주소, 팀장 이름으로 검색..."
            className="pl-8 h-8 text-sm"
          />
        </div>
        {/* 창고 카드 리스트 */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filtered.map(wh => (
            <button
              key={wh.id}
              type="button"
              className={`w-full text-left border rounded-lg p-3 transition-all hover:border-blue-400 hover:bg-blue-50/50 ${
                currentId === wh.id ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200'
              }`}
              onClick={() => {
                onSelect(wh.id)
                onOpenChange(false)
              }}
            >
              <p className="font-semibold text-sm">{wh.name}_{wh.managerName}</p>
              <div className="flex items-start gap-1 mt-1">
                <MapPin className="h-3 w-3 text-gray-400 mt-0.5 shrink-0" />
                <p className="text-xs text-gray-500">{wh.address}</p>
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="flex items-center gap-1 text-xs text-gray-600">
                  <User className="h-3 w-3 text-gray-400" />
                  {wh.managerName || '-'}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-600">
                  <Phone className="h-3 w-3 text-gray-400" />
                  {wh.managerPhone || '-'}
                </span>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-6">검색 결과가 없습니다</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * 창고명 셀 컴포넌트 (이름만 표시, 클릭하면 팝업 열기)
 */
function WarehouseNameCell({
  warehouseId,
  onPickerOpen,
}: {
  warehouseId?: string
  onPickerOpen: () => void
}) {
  const detail = warehouseId ? getWarehouseDetail(warehouseId) : null

  return detail ? (
    <button
      type="button"
      className="w-full text-left group flex items-center gap-1"
      onClick={(e) => { e.stopPropagation(); onPickerOpen() }}
    >
      <span className="text-xs font-semibold text-gray-800 truncate">
        {detail.name}_{detail.managerName}
      </span>
      <Pencil className="h-3 w-3 text-gray-300 group-hover:text-blue-500 shrink-0" />
    </button>
  ) : (
    <button
      type="button"
      className="w-full h-7 border border-dashed border-gray-300 rounded text-xs text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
      onClick={(e) => { e.stopPropagation(); onPickerOpen() }}
    >
      창고 선택
    </button>
  )
}

interface DeliveryTableProps {
  orders: Order[]
  onEditDelivery?: (order: Order) => void
  onViewDetail?: (order: Order) => void
  /** 배송상태 수동 전환 콜백 */
  onChangeStatus?: (orderId: string, newStatus: DeliveryStatus) => void
  /** 인라인 편집 저장 콜백 */
  onSaveItems?: (orderId: string, items: EquipmentItem[]) => void
  /** 정산완료 처리 콜백 */
  onSettle?: (orderId: string) => void
}

/** 상태별 행 스타일 */
function getRowStyle(order: Order): string {
  const alertType = getAlertType(order)

  if (alertType === 'delayed') return 'border-l-4 border-l-red-500 bg-red-50/50'
  if (alertType === 'today') return 'border-l-4 border-l-orange-400 bg-orange-50/50'
  if (alertType === 'tomorrow') return 'border-l-4 border-l-blue-400 bg-blue-50/30'
  return ''
}

/**
 * 상태 뱃지 (발주대기 / 진행중 / 완료)
 * @param order - 발주 정보
 * @param editingItems - 아코디언에서 편집 중인 구성품 (있으면 이걸로 판정)
 */
function StatusBadge({ order, editingItems }: { order: Order; editingItems?: EquipmentItem[] }) {
  const status = order.deliveryStatus || 'pending'

  // 발주완료 탭: 진행중/완료 자동 판정
  if (status === 'ordered') {
    // 편집 중인 데이터가 있으면 그걸 기준으로, 없으면 원본 데이터
    const items = editingItems || order.equipmentItems || []
    const docStatus = computeOrderedDocStatus(items)
    const style = ORDERED_DOC_STATUS_STYLES[docStatus]
    return (
      <Badge className={`${style.bgColor} ${style.color} border ${style.borderColor} text-xs`}>
        {style.label}
      </Badge>
    )
  }

  // 발주대기 탭: 기존대로 "발주대기" 표시
  return (
    <Badge className={`${DELIVERY_STATUS_COLORS[status]} text-xs`}>
      {DELIVERY_STATUS_LABELS[status]}
    </Badge>
  )
}

/**
 * 발주완료 탭 진행률 요약 컴포넌트
 * 구성품 입고 현황을 "n/전체 입고" 형태로 표시
 */
/**
 * 발주완료 탭 진행률 요약 컴포넌트
 *
 * - 구성품 없음: '-'
 * - 전체 배송확정: 초록 체크 + "전체확정"
 * - 진행중: 프로그레스 바 + "n/전체 확정"
 */
function DeliveryProgressSummary({ order }: { order: Order }) {
  const progress = computeDeliveryProgress(order)

  // 구성품 없으면 미표시
  if (progress.total === 0) {
    return <span className="text-xs text-gray-400">-</span>
  }

  // 전체 배송확정: 초록 체크 아이콘
  if (progress.confirmed === progress.total) {
    return (
      <div className="flex items-center gap-1.5">
        <svg className="h-3.5 w-3.5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
        </svg>
        <span className="text-xs font-medium text-green-700">전체확정</span>
      </div>
    )
  }

  // 진행 중: 프로그레스 바
  const percent = Math.round((progress.confirmed / progress.total) * 100)
  return (
    <div className="flex flex-col gap-1 min-w-[60px]">
      <span className="text-[11px] font-semibold text-blue-700">
        {progress.confirmed}/{progress.total} 확정
      </span>
      <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

/**
 * 구성품 목록에서 가장 많이 설정된 창고ID를 반환
 * 동률일 경우 먼저 나온 것 우선
 */
function getMostFrequentWarehouse(items?: EquipmentItem[]): string | undefined {
  if (!items || items.length === 0) return undefined
  const counts: Record<string, number> = {}
  let maxId: string | undefined
  let maxCount = 0
  for (const item of items) {
    if (!item.warehouseId) continue
    counts[item.warehouseId] = (counts[item.warehouseId] || 0) + 1
    if (counts[item.warehouseId] > maxCount) {
      maxCount = counts[item.warehouseId]
      maxId = item.warehouseId
    }
  }
  return maxId
}

/**
 * 배송현황 요약 텍스트 생성
 *
 * 구성품의 배송요청일 vs 배송예정일을 비교하여 지연 현황을 요약합니다.
 * - 구성품 없음: "-"
 * - 전부 날짜 미입력: "미입력"
 * - 일부 미입력, 나머지 정상: "미입력 N건"
 * - 전체 정상: "전체 정상"
 * - 지연 있음: "N건 지연 +X일"
 */
/**
 * 배송현황 요약 컴포넌트 (발주대기 탭용)
 *
 * - 구성품 없음: '-'
 * - 지연: 깜빡이는 빨간 점 + "N건 지연"
 * - 전부 미입력: 회색 점 + "미입력"
 * - 일부 미입력: 회색 점 + "미입력 N건"
 * - 전체 정상: 초록 체크 + "전체 정상"
 */
function DeliverySummaryDisplay({ equipmentItems }: { equipmentItems?: EquipmentItem[] }) {
  const analysis = analyzeDeliveryDelay(equipmentItems)

  // 구성품 없음
  if (analysis.total === 0) {
    return <span className="text-xs text-gray-400">-</span>
  }

  // 지연 있음: 깜빡이는 빨간 점
  if (analysis.delayed > 0) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        <span className="text-xs font-medium text-red-600">{analysis.delayed}건 지연 +{analysis.maxDelayDays}일</span>
      </div>
    )
  }

  // 전부 날짜 미입력
  if (analysis.noDate === analysis.total) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="inline-flex rounded-full h-2 w-2 bg-gray-300" />
        <span className="text-xs text-gray-400">미입력</span>
      </div>
    )
  }

  // 일부 미입력
  if (analysis.noDate > 0) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="inline-flex rounded-full h-2 w-2 bg-gray-300" />
        <span className="text-xs text-gray-400">미입력 {analysis.noDate}건</span>
      </div>
    )
  }

  // 전체 정상: 초록 체크
  return (
    <div className="flex items-center gap-1.5">
      <svg className="h-3.5 w-3.5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
      </svg>
      <span className="text-xs font-medium text-green-700">전체 정상</span>
    </div>
  )
}

/**
 * 빈 구성품 행 1개 생성
 */
function createEmptyItem(): EquipmentItem {
  return {
    id: `eq-new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    componentName: '',
    orderDate: '',
    quantity: 0,
    supplier: '삼성전자',
  }
}

/**
 * 기본 4행 빈 배열 생성
 */
function createDefaultRows(): EquipmentItem[] {
  return [createEmptyItem(), createEmptyItem(), createEmptyItem()]
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function DeliveryTable({ orders, onEditDelivery, onViewDetail, onChangeStatus, onSaveItems, onSettle }: DeliveryTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  /** 주문별 편집 중인 구성품 데이터 (orderId → EquipmentItem[]) */
  const [editingItems, setEditingItems] = useState<Record<string, EquipmentItem[]>>({})

  /** 창고 선택 팝업 (테이블에서 1개만 공유) */
  const [pickerOpen, setPickerOpen] = useState(false)
  /** pickerTarget.context: 'bulk' = 전체 적용(기본), 'individual' = 해당 행만 변경 */
  const [pickerTarget, setPickerTarget] = useState<{ orderId: string; itemIdx: number; context: 'bulk' | 'individual' } | null>(null)

  /** 발주완료 확인 다이얼로그 대상 (orderId + 현장명) */
  const [confirmTarget, setConfirmTarget] = useState<{ orderId: string; businessName: string } | null>(null)

  /** 정산완료 확인 다이얼로그 대상 (orderId + 현장명) */
  const [settleTarget, setSettleTarget] = useState<{ orderId: string; businessName: string } | null>(null)

  /** 단가표 Sheet 열림/닫힘 상태 */
  const [priceSheetOpen, setPriceSheetOpen] = useState(false)
  /** 단가표에서 선택한 구성품을 채울 대상 행 (orderId + itemIdx) */
  const [priceSheetTarget, setPriceSheetTarget] = useState<{ orderId: string; itemIdx: number } | null>(null)

  /**
   * 아코디언 토글 시 편집 데이터 초기화
   * - 기존 데이터가 있으면 복사해서 편집 상태로
   * - 없으면 기본 3행 공란으로
   */
  const toggleRow = useCallback((orderId: string, order: Order) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
        // 편집 데이터 초기화 (이미 있으면 유지)
        setEditingItems(prevItems => {
          if (prevItems[orderId]) return prevItems
          const existing = order.equipmentItems || []
          return {
            ...prevItems,
            [orderId]: existing.length > 0
              ? existing.map(item => ({ ...item }))
              : createDefaultRows()
          }
        })
      }
      return next
    })
  }, [])

  /** 구성품 필드 업데이트 + 자동 저장 */
  const handleItemChange = useCallback((orderId: string, index: number, field: keyof EquipmentItem, value: string | number) => {
    setEditingItems(prev => {
      const updated = (prev[orderId] || []).map((item, i) => {
        if (i !== index) return item
        return { ...item, [field]: value }
      })
      // 자동 저장: 구성품명이 있는 행만 필터링해서 부모에 전달
      if (onSaveItems) {
        const validItems = updated.filter(item => (item.componentName && item.componentName.trim() !== '') || (item.componentModel && item.componentModel.trim() !== ''))
        const withStatus = validItems.map(item => ({
          ...item,
          deliveryStatus: computeItemDeliveryStatus(item)
        }))
        onSaveItems(orderId, withStatus)
      }
      return { ...prev, [orderId]: updated }
    })
  }, [onSaveItems])

  /** 행 추가 (count: 추가할 행 수, 기본 1행) */
  const handleAddRow = useCallback((orderId: string, count: number = 1) => {
    setEditingItems(prev => ({
      ...prev,
      [orderId]: [...(prev[orderId] || []), ...Array.from({ length: count }, () => createEmptyItem())]
    }))
  }, [])

  /** 행 삭제 + 자동 저장 */
  const handleRemoveRow = useCallback((orderId: string, index: number) => {
    setEditingItems(prev => {
      const updated = (prev[orderId] || []).filter((_, i) => i !== index)
      // 자동 저장
      if (onSaveItems) {
        const validItems = updated.filter(item => (item.componentName && item.componentName.trim() !== '') || (item.componentModel && item.componentModel.trim() !== ''))
        const withStatus = validItems.map(item => ({
          ...item,
          deliveryStatus: computeItemDeliveryStatus(item)
        }))
        onSaveItems(orderId, withStatus)
      }
      return { ...prev, [orderId]: updated }
    })
  }, [onSaveItems])

  /**
   * 단가표에서 SET 모델 선택 시 구성품 전체를 현재 행부터 자동 입력
   *
   * - 누른 행(itemIdx)부터 구성품 순서대로 채움
   * - 행이 부족하면 자동으로 빈 행 추가
   */
  const handlePriceTableSelectSet = useCallback((components: import('@/lib/price-table').ComponentDetail[], setModel?: string) => {
    if (!priceSheetTarget) return
    const { orderId, itemIdx } = priceSheetTarget
    setEditingItems(prev => {
      const items = [...(prev[orderId] || [])]

      // 행이 부족하면 자동 추가
      const needed = itemIdx + components.length
      while (items.length < needed) {
        items.push(createEmptyItem())
      }

      // 구성품을 현재 행부터 순서대로 채움 (setModel, componentModel, componentName 모두 저장)
      for (let i = 0; i < components.length; i++) {
        const comp = components[i]
        items[itemIdx + i] = {
          ...items[itemIdx + i],
          componentName: comp.type,
          componentModel: comp.model,
          quantity: comp.quantity,
          supplier: '삼성전자',
          setModel: setModel || undefined,
        }
      }

      // 자동 저장
      if (onSaveItems) {
        const validItems = items.filter(item => (item.componentName && item.componentName.trim() !== '') || (item.componentModel && item.componentModel.trim() !== ''))
        const withStatus = validItems.map(item => ({
          ...item,
          deliveryStatus: computeItemDeliveryStatus(item)
        }))
        onSaveItems(orderId, withStatus)
      }
      return { ...prev, [orderId]: items }
    })
    setPriceSheetTarget(null)
  }, [priceSheetTarget, onSaveItems])

  // 교원 발주등록일 기준 오름차순 정렬 (오래된 발주가 맨 위)
  const sortedOrders = [...orders].sort((a, b) => {
    const dateA = a.orderDate || '9999-12-31'
    const dateB = b.orderDate || '9999-12-31'
    return dateA.localeCompare(dateB)
  })

  if (sortedOrders.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-lg font-medium">표시할 배송 건이 없습니다</p>
      </div>
    )
  }

  return (
    <>
      {/* 데스크톱 테이블 (md 이상) */}
      <div className="hidden md:block border rounded-lg overflow-hidden">
        <table className="w-full table-fixed">
          <thead className="bg-muted/80">
            <tr>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '40px' }}></th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '90px' }}>문서 상태</th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '90px' }}>교원 발주등록일</th>
              <th className="text-center p-3 text-sm font-medium whitespace-nowrap" style={{ width: '70px' }}>교원 발주서</th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '120px' }}>배송현황</th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '130px' }}>현장명</th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '180px' }}>현장주소</th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '130px' }}>창고정보</th>
              <th className="text-center p-3 text-sm font-medium whitespace-nowrap" style={{ width: '100px' }}></th>
            </tr>
          </thead>
          <tbody>
            {sortedOrders.map((order) => {
              const isExpanded = expandedRows.has(order.id)
              // equipmentItems는 아코디언 상세에서 editingItems로 관리
              const status = order.deliveryStatus || 'pending'

              return (
                <Fragment key={order.id}>
                  <tr
                    className={`cursor-pointer hover:bg-gray-100/50 transition-colors ${getRowStyle(order)}`}
                    onClick={() => toggleRow(order.id, order)}
                  >
                    <td className="p-3 text-center">
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4 text-gray-500 inline-block" />
                        : <ChevronRight className="h-4 w-4 text-gray-500 inline-block" />
                      }
                    </td>
                    {/* 상태 뱃지 (단일 표시) — 편집 중인 구성품 반영 */}
                    <td className="p-3">
                      <StatusBadge order={order} editingItems={editingItems[order.id]} />
                    </td>
                    <td className="p-3">
                      <p className="text-sm">{formatShortDate(order.orderDate)}</p>
                    </td>
                    {/* 교원 발주서 보기 버튼 */}
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                      {onViewDetail && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1 px-2"
                          onClick={() => onViewDetail(order)}
                        >
                          <FileText className="h-3 w-3" />
                          보기
                        </Button>
                      )}
                    </td>
                    {/* 배송현황 요약: 발주완료 탭은 입고 진행률, 발주대기 탭은 기존 요약 */}
                    <td className="p-3">
                      {status === 'ordered' ? (
                        <DeliveryProgressSummary order={order} />
                      ) : (
                        <DeliverySummaryDisplay equipmentItems={order.equipmentItems} />
                      )}
                    </td>
                    <td className="p-3">
                      <p className="font-semibold text-sm truncate">{order.businessName}</p>
                    </td>
                    <td className="p-3">
                      <p className="text-xs text-gray-600 truncate">{order.address}</p>
                    </td>
                    {/* 창고정보: 구성품 중 가장 많이 설정된 창고 표시 */}
                    <td className="p-3">
                      {(() => {
                        const whId = getMostFrequentWarehouse(order.equipmentItems)
                        const detail = getWarehouseDetail(whId)
                        if (!detail) return <p className="text-sm text-gray-400">미지정</p>
                        return (
                          <p className="text-sm font-medium truncate">{detail.name}_{detail.managerName}</p>
                        )
                      })()}
                    </td>
                    {/* 상태 전환 버튼: 발주대기→발주완료 / 발주완료→정산완료 */}
                    <td className="p-3 text-center">
                      {status === 'pending' && onChangeStatus && (
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 h-7"
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirmTarget({ orderId: order.id, businessName: order.businessName })
                          }}
                        >
                          발주완료
                        </Button>
                      )}
                      {status === 'ordered' && onSettle && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 h-7"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSettleTarget({ orderId: order.id, businessName: order.businessName })
                          }}
                        >
                          정산완료
                        </Button>
                      )}
                    </td>
                  </tr>

                  {/* 아코디언 상세 영역 — 인라인 편집 테이블 */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={9} className="p-0">
                        <div className="border-t border-gray-200 bg-gray-50/60 px-4 py-4">
                          <div className="rounded-lg border border-gray-200 overflow-x-auto shadow-sm mb-3">
                            <table className="text-sm" style={{ minWidth: '1720px' }}>
                              <thead>
                                <tr className="bg-gray-100/80 text-xs text-gray-500 tracking-wide">
                                  <th className="text-center px-2 py-2.5 font-medium w-[32px]"></th>
                                  <th className="text-left px-2 py-2.5 font-medium w-[82px]">배송 상태</th>
                                  <th className="text-left px-2 py-2.5 font-medium w-[96px]">매입처</th>
                                  <th className="text-left px-2 py-2.5 font-medium w-[120px]">현장명</th>
                                  <th className="text-left px-2 py-2.5 font-medium w-[162px]">주문일</th>
                                  <th className="text-left px-2 py-2.5 font-medium w-[132px]">주문번호</th>
                                  <th className="text-left px-2 py-2.5 font-medium w-[162px]">배송요청일</th>
                                  <th className="text-left px-2 py-2.5 font-medium w-[162px]">배송예정일</th>
                                  <th className="text-left px-2 py-2.5 font-medium w-[162px]">배송확정일</th>
                                  <th className="text-left px-2 py-2.5 font-medium w-[202px]">모델명</th>
                                  <th className="text-left px-2 py-2.5 font-medium w-[80px]">구성품</th>
                                  <th className="text-center px-2 py-2.5 font-medium w-[45px]">수량</th>
                                  <th className="text-left px-2 py-2.5 font-medium w-[161px]">창고명</th>
                                  <th className="text-left px-2 py-2.5 font-medium w-[220px]">창고주소</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-100">
                                {(() => {
                                  const items = editingItems[order.id] || []
                                  const groupColors = computeSetModelGroups(items)
                                  return items.map((item, idx) => {
                                  const barColor = groupColors[idx]
                                  return (
                                    <tr
                                      key={item.id || idx}
                                      className="hover:bg-gray-50/30 transition-colors"
                                    >
                                      {/* 좌측 삭제 버튼 */}
                                      <td className="px-1 py-1.5 text-center">
                                        <button
                                          className="text-gray-300 hover:text-red-500 transition-colors p-0.5"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleRemoveRow(order.id, idx)
                                          }}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </td>
                                      {/* 상태 (구성품별 배송상태: 공란/주문완료/배송예정/배송확정) */}
                                      <td className="px-2 py-1.5">
                                        {(() => {
                                          const itemStatus = computeItemDeliveryStatus(item)
                                          if (itemStatus === 'none') {
                                            return <span className="text-xs text-gray-300">—</span>
                                          }
                                          return (
                                            <Badge className={`${ITEM_DELIVERY_STATUS_COLORS[itemStatus]} text-[10px]`}>
                                              {ITEM_DELIVERY_STATUS_LABELS[itemStatus]}
                                            </Badge>
                                          )
                                        })()}
                                      </td>
                                      {/* 매입처 (직접 입력) */}
                                      <td className="px-1 py-1.5">
                                        <Input
                                          value={item.supplier || ''}
                                          onChange={(e) => handleItemChange(order.id, idx, 'supplier', e.target.value)}
                                          placeholder="삼성전자"
                                          className="h-7 text-xs border-gray-200"
                                        />
                                      </td>
                                      {/* 현장명 */}
                                      <td className="px-1 py-1.5">
                                        <p className="text-xs text-gray-700 truncate">{order.businessName}</p>
                                      </td>
                                      {/* 주문일 */}
                                      <td className="px-1 py-1.5">
                                        <DateInput
                                          value={item.orderDate || ''}
                                          onChange={(val) => handleItemChange(order.id, idx, 'orderDate', val)}
                                        />
                                      </td>
                                      {/* 주문번호 */}
                                      <td className="px-1 py-1.5">
                                        <Input
                                          value={item.orderNumber || ''}
                                          onChange={(e) => handleItemChange(order.id, idx, 'orderNumber', e.target.value)}
                                          placeholder="주문번호"
                                          className="h-7 text-xs font-mono border-gray-200"
                                        />
                                      </td>
                                      {/* 배송요청일 (내가 삼성에 요청한 날짜) */}
                                      <td className="px-1 py-1.5">
                                        <DateInput
                                          value={item.requestedDeliveryDate || ''}
                                          onChange={(val) => handleItemChange(order.id, idx, 'requestedDeliveryDate', val)}
                                        />
                                      </td>
                                      {/* 배송예정일 (삼성에서 알려준 실제 예정일) */}
                                      <td className="px-1 py-1.5">
                                        <DateInput
                                          value={item.scheduledDeliveryDate || ''}
                                          onChange={(val) => handleItemChange(order.id, idx, 'scheduledDeliveryDate', val)}
                                        />
                                      </td>
                                      {/* 배송확정일 (실제 입고된 날짜) */}
                                      <td className="px-1 py-1.5">
                                        <DateInput
                                          value={item.confirmedDeliveryDate || ''}
                                          onChange={(val) => handleItemChange(order.id, idx, 'confirmedDeliveryDate', val)}
                                        />
                                      </td>
                                      {/* 모델명 (직접 입력 + 단가표 버튼) — SET 그룹 컬러바 표시 */}
                                      <td
                                        className="px-1 py-1.5"
                                        style={barColor ? { borderLeft: `4px solid ${barColor}` } : undefined}
                                      >
                                        <div className="flex items-center gap-1">
                                          <Input
                                            value={item.componentModel || ''}
                                            onChange={(e) => handleItemChange(order.id, idx, 'componentModel', e.target.value)}
                                            placeholder="모델명"
                                            className="h-7 text-xs border-gray-200 flex-1"
                                          />
                                          <button
                                            type="button"
                                            title="단가표에서 선택"
                                            className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setPriceSheetTarget({ orderId: order.id, itemIdx: idx })
                                              setPriceSheetOpen(true)
                                            }}
                                          >
                                            <ClipboardList className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                      {/* 구성품 (단가표에서 자동 입력, 직접 수정도 가능) */}
                                      <td className="px-1 py-1.5">
                                        <Input
                                          value={item.componentName || ''}
                                          onChange={(e) => handleItemChange(order.id, idx, 'componentName', e.target.value)}
                                          placeholder="실외기"
                                          className="h-7 border-gray-200"
                                          style={{ fontSize: '12px' }}
                                        />
                                      </td>
                                      {/* 수량 (텍스트 입력, Ctrl+C/V 가능) */}
                                      <td className="px-1 py-1.5">
                                        <Input
                                          type="text"
                                          inputMode="numeric"
                                          value={item.quantity > 0 ? item.quantity : ''}
                                          onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '')
                                            handleItemChange(order.id, idx, 'quantity', val ? parseInt(val) : 0)
                                          }}
                                          onPaste={(e) => {
                                            e.preventDefault()
                                            const pasted = e.clipboardData.getData('text').replace(/\D/g, '')
                                            handleItemChange(order.id, idx, 'quantity', pasted ? parseInt(pasted) : 0)
                                          }}
                                          placeholder=""
                                          className="h-7 text-xs text-center border-gray-200"
                                        />
                                      </td>
                                      {/* 창고명 (팝업으로 한번에 선택, 3컬럼 분리 표시) */}
                                      <td className="px-1 py-1.5">
                                        <WarehouseNameCell
                                          warehouseId={item.warehouseId}
                                          onPickerOpen={() => {
                                            // 이미 창고가 설정된 행 → 개별 수정, 미설정 → 전체 적용
                                            setPickerTarget({ orderId: order.id, itemIdx: idx, context: item.warehouseId ? 'individual' : 'bulk' })
                                            setPickerOpen(true)
                                          }}
                                        />
                                      </td>
                                      {/* 창고주소 */}
                                      <td className="px-1 py-1.5">
                                        {(() => {
                                          const d = item.warehouseId ? getWarehouseDetail(item.warehouseId) : null
                                          return d ? (
                                            <p className="text-[11px] text-gray-500 truncate">{d.address}</p>
                                          ) : <span className="text-xs text-gray-300">—</span>
                                        })()}
                                      </td>
                                    </tr>
                                  )
                                })
                                })()}
                              </tbody>
                            </table>
                          </div>

                          {/* 행추가 버튼 그룹 */}
                          <div className="flex gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleAddRow(order.id)
                              }}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              행추가
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleAddRow(order.id, 3)
                              }}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              3행 추가[스탠드]
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleAddRow(order.id, 4)
                              }}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" />
                              4행 추가[벽걸이]
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 모바일 스택형 리스트 (md 미만) */}
      <div className="md:hidden space-y-3">
        {sortedOrders.map((order) => {
          const isExpanded = expandedRows.has(order.id)
          const status = order.deliveryStatus || 'pending'

          return (
            <div
              key={order.id}
              className={`border rounded-lg overflow-hidden bg-white ${getRowStyle(order)}`}
            >
              <div
                className="p-4 cursor-pointer"
                onClick={() => toggleRow(order.id, order)}
              >
                <div className="flex items-center justify-between mb-2">
                  <StatusBadge order={order} editingItems={editingItems[order.id]} />
                  <span className="text-xs text-gray-500">{formatShortDate(order.orderDate)}</span>
                </div>

                <h3 className="font-semibold text-sm mb-0.5">{order.businessName}</h3>
                <p className="text-xs text-gray-500 mb-2">{order.address}</p>

                <div className="flex items-center gap-4 text-xs mb-1">
                  {status === 'ordered' ? (
                    <DeliveryProgressSummary order={order} />
                  ) : (
                    <DeliverySummaryDisplay equipmentItems={order.equipmentItems} />
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>
                    {(() => {
                      const whId = getMostFrequentWarehouse(order.equipmentItems)
                      const detail = getWarehouseDetail(whId)
                      return detail ? `${detail.name}_${detail.managerName}` : '창고 미지정'
                    })()}
                  </span>
                </div>

                {/* 발주서 보기 + 발주완료 버튼 (모바일) */}
                <div className="flex items-center justify-between mt-2">
                  {onViewDetail && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 px-2"
                      onClick={(e) => {
                        e.stopPropagation()
                        onViewDetail(order)
                      }}
                    >
                      <FileText className="h-3 w-3" />
                      보기
                    </Button>
                  )}
                  {status === 'pending' && onChangeStatus && (
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 h-7"
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmTarget({ orderId: order.id, businessName: order.businessName })
                      }}
                    >
                      발주완료
                    </Button>
                  )}
                  {status === 'ordered' && onSettle && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 h-7"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSettleTarget({ orderId: order.id, businessName: order.businessName })
                      }}
                    >
                      정산완료
                    </Button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="bg-gray-50 border-t px-4 py-3">
                  {/* 모바일 인라인 편집 카드 */}
                  <div className="space-y-2 mb-3">
                    {(() => {
                      const mobileItems = editingItems[order.id] || []
                      const mobileGroupColors = computeSetModelGroups(mobileItems)
                      return mobileItems.map((item, idx) => {
                      const mobileBarColor = mobileGroupColors[idx]
                      return (
                        <div
                          key={item.id || idx}
                          className="bg-white border rounded-md p-3 space-y-2"
                          style={mobileBarColor ? { borderLeft: `4px solid ${mobileBarColor}` } : undefined}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-400">#{idx + 1}</span>
                              {(() => {
                                const itemStatus = computeItemDeliveryStatus(item)
                                if (itemStatus === 'none') {
                                  return <span className="text-[10px] text-gray-300">—</span>
                                }
                                return (
                                  <Badge className={`${ITEM_DELIVERY_STATUS_COLORS[itemStatus]} text-[10px]`}>
                                    {ITEM_DELIVERY_STATUS_LABELS[itemStatus]}
                                  </Badge>
                                )
                              })()}
                            </div>
                            <button
                              className="text-gray-300 hover:text-red-500 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRemoveRow(order.id, idx)
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-gray-400">모델명</label>
                              <div className="flex items-center gap-1">
                                <Input value={item.componentModel || ''} onChange={(e) => handleItemChange(order.id, idx, 'componentModel', e.target.value)} placeholder="모델명" className="h-7 text-xs flex-1" />
                                <button
                                  type="button"
                                  title="단가표에서 선택"
                                  className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setPriceSheetTarget({ orderId: order.id, itemIdx: idx })
                                    setPriceSheetOpen(true)
                                  }}
                                >
                                  <ClipboardList className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400">구성품</label>
                              <Input value={item.componentName || ''} onChange={(e) => handleItemChange(order.id, idx, 'componentName', e.target.value)} placeholder="실외기" className="h-7 text-xs" />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400">수량</label>
                              <Input type="text" inputMode="numeric" value={item.quantity > 0 ? item.quantity : ''} onChange={(e) => { const val = e.target.value.replace(/\D/g, ''); handleItemChange(order.id, idx, 'quantity', val ? parseInt(val) : 0) }} className="h-7 text-xs" />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400">매입처</label>
                              <Input value={item.supplier || ''} onChange={(e) => handleItemChange(order.id, idx, 'supplier', e.target.value)} placeholder="삼성전자" className="h-7 text-xs" />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400">주문번호</label>
                              <Input value={item.orderNumber || ''} onChange={(e) => handleItemChange(order.id, idx, 'orderNumber', e.target.value)} placeholder="주문번호" className="h-7 text-xs font-mono" />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400">배송요청일</label>
                              <DateInput value={item.requestedDeliveryDate || ''} onChange={(val) => handleItemChange(order.id, idx, 'requestedDeliveryDate', val)} />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400">배송예정일</label>
                              <DateInput value={item.scheduledDeliveryDate || ''} onChange={(val) => handleItemChange(order.id, idx, 'scheduledDeliveryDate', val)} />
                            </div>
                            <div>
                              <label className="text-[10px] text-gray-400">배송확정일</label>
                              <DateInput value={item.confirmedDeliveryDate || ''} onChange={(val) => handleItemChange(order.id, idx, 'confirmedDeliveryDate', val)} />
                            </div>
                            <div className="col-span-2">
                              <label className="text-[10px] text-gray-400">창고</label>
                              <WarehouseNameCell
                                warehouseId={item.warehouseId}
                                onPickerOpen={() => {
                                  setPickerTarget({ orderId: order.id, itemIdx: idx, context: item.warehouseId ? 'individual' : 'bulk' })
                                  setPickerOpen(true)
                                }}
                              />
                              {(() => {
                                const d = item.warehouseId ? getWarehouseDetail(item.warehouseId) : null
                                return d ? (
                                  <div className="mt-1 text-[11px] text-gray-500 space-y-0.5">
                                    <p>{d.address}</p>
                                    <p>{d.managerPhone}</p>
                                  </div>
                                ) : null
                              })()}
                            </div>
                          </div>
                        </div>
                      )
                    })
                    })()}
                  </div>

                  {/* 행추가 버튼 그룹 */}
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddRow(order.id)
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      행추가
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddRow(order.id, 3)
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      3행 추가[스탠드]
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddRow(order.id, 4)
                      }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      4행 추가[벽걸이]
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 단가표 Sheet (테이블 전체에서 1개만 공유) */}
      <DeliveryPriceTableSheet
        open={priceSheetOpen}
        onOpenChange={setPriceSheetOpen}
        onSelectSet={handlePriceTableSelectSet}
      />

      {/* 창고 선택 팝업 (테이블 전체에서 1개만 공유) */}
      <WarehousePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        currentId={
          pickerTarget
            ? (editingItems[pickerTarget.orderId]?.[pickerTarget.itemIdx]?.warehouseId)
            : undefined
        }
        onSelect={(warehouseId) => {
          if (pickerTarget) {
            if (pickerTarget.context === 'individual') {
              // 개별 수정: 해당 행만 변경
              handleItemChange(pickerTarget.orderId, pickerTarget.itemIdx, 'warehouseId', warehouseId)
            } else {
              // 전체 적용(기본): 해당 order의 모든 구성품 행에 일괄 적용
              setEditingItems(prev => {
                const updated = (prev[pickerTarget.orderId] || []).map(item => ({
                  ...item,
                  warehouseId,
                }))
                // 자동 저장
                if (onSaveItems) {
                  const validItems = updated.filter(item => (item.componentName && item.componentName.trim() !== '') || (item.componentModel && item.componentModel.trim() !== ''))
                  const withStatus = validItems.map(item => ({
                    ...item,
                    deliveryStatus: computeItemDeliveryStatus(item)
                  }))
                  onSaveItems(pickerTarget.orderId, withStatus)
                }
                return { ...prev, [pickerTarget.orderId]: updated }
              })
            }
          }
          setPickerTarget(null)
        }}
      />

      {/* 발주완료 확인 다이얼로그 */}
      <AlertDialog open={!!confirmTarget} onOpenChange={(open) => { if (!open) setConfirmTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>발주완료로 변경</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{confirmTarget?.businessName}&rdquo;을(를) 발주완료로 변경하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                if (confirmTarget && onChangeStatus) {
                  onChangeStatus(confirmTarget.orderId, 'ordered')
                }
                setConfirmTarget(null)
              }}
            >
              변경
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 정산완료 확인 다이얼로그 */}
      <AlertDialog open={!!settleTarget} onOpenChange={(open) => { if (!open) setSettleTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>정산완료 처리</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{settleTarget?.businessName}&rdquo;을(를) 정산완료로 처리하시겠습니까?
              정산완료된 건은 배송관리 목록에서 사라집니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                if (settleTarget && onSettle) {
                  onSettle(settleTarget.orderId)
                }
                setSettleTarget(null)
              }}
            >
              정산완료
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
