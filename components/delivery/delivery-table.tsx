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
import type { Order, EquipmentItem, DeliveryStatus } from '@/types/order'
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_COLORS } from '@/types/order'
import {
  computeDeliveryProgress,
  getAlertType,
  getEffectiveDeliveryDate,
  getWarehouseDetail,
  formatShortDate,
  computeItemDeliveryStatus,
  parseRegionFromAddress,
  analyzeDeliveryDelay,
  ALERT_STYLES
} from '@/lib/delivery-utils'
import { mockWarehouses } from '@/lib/warehouse-data'

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

  const filtered = mockWarehouses.filter(wh => {
    if (!search) return true
    const term = search.toLowerCase()
    return (
      wh.name.toLowerCase().includes(term) ||
      wh.address.toLowerCase().includes(term) ||
      (wh.managerName || '').toLowerCase().includes(term)
    )
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <WarehouseIcon className="h-4 w-4" />
            창고 선택
          </DialogTitle>
        </DialogHeader>
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
}

/** 상태별 행 스타일 */
function getRowStyle(order: Order): string {
  const alertType = getAlertType(order)
  const status = order.deliveryStatus

  if (alertType === 'delayed') return 'border-l-4 border-l-red-500 bg-red-50/50'
  if (alertType === 'today') return 'border-l-4 border-l-orange-400 bg-orange-50/50'
  if (alertType === 'tomorrow') return 'border-l-4 border-l-blue-400 bg-blue-50/30'
  if (status === 'delivered') return 'opacity-60 bg-gray-50'
  return ''
}

/** 상태 뱃지 (준비중 / 배송중+게이지 / 배송완료) */
function StatusBadge({ order }: { order: Order }) {
  const status = order.deliveryStatus || 'pending'
  const alertType = getAlertType(order)
  const progress = computeDeliveryProgress(order)

  if (alertType !== 'none' && alertType !== 'this-week') {
    const style = ALERT_STYLES[alertType]
    return (
      <Badge className={`${style.bgColor} ${style.color} border ${style.borderColor} text-xs`}>
        {style.label}
      </Badge>
    )
  }

  if (status === 'in-transit' && progress.total > 0) {
    const percent = Math.round((progress.delivered / progress.total) * 100)
    return (
      <div className="flex flex-col gap-1">
        <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-xs">
          배송중 {progress.delivered}/{progress.total}
        </Badge>
        <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <Badge className={`${DELIVERY_STATUS_COLORS[status]} text-xs`}>
      {DELIVERY_STATUS_LABELS[status]}
    </Badge>
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
function renderDeliverySummary(equipmentItems?: EquipmentItem[]): { text: string; className: string } {
  const analysis = analyzeDeliveryDelay(equipmentItems)

  // 구성품 없음
  if (analysis.total === 0) {
    return { text: '-', className: 'text-gray-400' }
  }

  // 지연 있음 (최우선)
  if (analysis.delayed > 0) {
    return {
      text: `${analysis.delayed}건 지연 +${analysis.maxDelayDays}일`,
      className: 'text-red-600 font-medium'
    }
  }

  // 전부 날짜 미입력
  if (analysis.noDate === analysis.total) {
    return { text: '미입력', className: 'text-gray-400' }
  }

  // 일부 미입력, 나머지 정상
  if (analysis.noDate > 0) {
    return { text: `미입력 ${analysis.noDate}건`, className: 'text-gray-400' }
  }

  // 전체 정상
  return { text: '전체 정상', className: 'text-green-600' }
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
  return [createEmptyItem(), createEmptyItem(), createEmptyItem(), createEmptyItem()]
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function DeliveryTable({ orders, onEditDelivery, onViewDetail, onChangeStatus, onSaveItems }: DeliveryTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  /** 주문별 편집 중인 구성품 데이터 (orderId → EquipmentItem[]) */
  const [editingItems, setEditingItems] = useState<Record<string, EquipmentItem[]>>({})

  /** 창고 선택 팝업 (테이블에서 1개만 공유) */
  const [pickerOpen, setPickerOpen] = useState(false)
  /** pickerTarget.context: 'bulk' = 전체 적용(기본), 'individual' = 해당 행만 변경 */
  const [pickerTarget, setPickerTarget] = useState<{ orderId: string; itemIdx: number; context: 'bulk' | 'individual' } | null>(null)

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
        const validItems = updated.filter(item => item.componentName && item.componentName.trim() !== '')
        const withStatus = validItems.map(item => ({
          ...item,
          deliveryStatus: computeItemDeliveryStatus(item)
        }))
        onSaveItems(orderId, withStatus)
      }
      return { ...prev, [orderId]: updated }
    })
  }, [onSaveItems])

  /** 행 추가 */
  const handleAddRow = useCallback((orderId: string) => {
    setEditingItems(prev => ({
      ...prev,
      [orderId]: [...(prev[orderId] || []), createEmptyItem()]
    }))
  }, [])

  /** 행 삭제 + 자동 저장 */
  const handleRemoveRow = useCallback((orderId: string, index: number) => {
    setEditingItems(prev => {
      const updated = (prev[orderId] || []).filter((_, i) => i !== index)
      // 자동 저장
      if (onSaveItems) {
        const validItems = updated.filter(item => item.componentName && item.componentName.trim() !== '')
        const withStatus = validItems.map(item => ({
          ...item,
          deliveryStatus: computeItemDeliveryStatus(item)
        }))
        onSaveItems(orderId, withStatus)
      }
      return { ...prev, [orderId]: updated }
    })
  }, [onSaveItems])

  const sortedOrders = [...orders].sort((a, b) => {
    const dateA = getEffectiveDeliveryDate(a) || '9999-12-31'
    const dateB = getEffectiveDeliveryDate(b) || '9999-12-31'
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
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '100px' }}>상태</th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '90px' }}>교원 발주등록일</th>
              <th className="text-center p-3 text-sm font-medium whitespace-nowrap" style={{ width: '70px' }}>교원 발주서</th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '120px' }}>배송현황</th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '160px' }}>현장명</th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '100px' }}>현장위치</th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '150px' }}>창고정보</th>
            </tr>
          </thead>
          <tbody>
            {sortedOrders.map((order) => {
              const isExpanded = expandedRows.has(order.id)
              // equipmentItems는 아코디언 상세에서 editingItems로 관리
              const status = order.deliveryStatus || 'pending'

              // 다음 단계 상태 매핑
              const nextStatusMap: Partial<Record<DeliveryStatus, { label: string; next: DeliveryStatus }>> = {
                'pending': { label: '배송중으로 변경', next: 'in-transit' },
                'in-transit': { label: '입고완료로 변경', next: 'delivered' },
              }
              const nextInfo = nextStatusMap[status]

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
                    {/* 상태 뱃지 + 다음 단계 버튼 */}
                    <td className="p-3">
                      <div className="flex flex-col gap-1">
                        <StatusBadge order={order} />
                        {nextInfo && onChangeStatus && (
                          <button
                            className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap text-left"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm(`"${order.businessName}" 배송상태를 ${nextInfo.label.replace('으로 변경', '')}(으)로 변경하시겠습니까?`)) {
                                onChangeStatus(order.id, nextInfo.next)
                              }
                            }}
                          >
                            → {nextInfo.label}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <p className="text-sm">{formatShortDate(order.orderDate)}</p>
                    </td>
                    {/* 교원 발주서 보기 버튼 */}
                    <td className="p-3 text-center">
                      {onViewDetail && (
                        <button
                          className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                          title="교원 발주서 보기"
                          onClick={(e) => {
                            e.stopPropagation()
                            onViewDetail(order)
                          }}
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                    {/* 배송현황 요약 */}
                    <td className="p-3">
                      {(() => {
                        const summary = renderDeliverySummary(order.equipmentItems)
                        return <p className={`text-sm ${summary.className}`}>{summary.text}</p>
                      })()}
                    </td>
                    <td className="p-3">
                      <p className="font-semibold text-sm truncate">{order.businessName}</p>
                      <p className="text-xs text-gray-500 truncate">{order.address}</p>
                    </td>
                    <td className="p-3">
                      {(() => {
                        const { region, city } = parseRegionFromAddress(order.address)
                        return (
                          <>
                            <p className="text-xs font-medium text-gray-700">{region}</p>
                            <p className="text-xs text-gray-500">{city}</p>
                          </>
                        )
                      })()}
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
                  </tr>

                  {/* 아코디언 상세 영역 — 인라인 편집 테이블 */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} className="p-0">
                        <div className="border-t border-gray-200 bg-gray-50/60 px-4 py-4">
                          <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm mb-3">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-gray-100/80 text-xs text-gray-500 tracking-wide">
                                  <th className="text-left px-2 py-2.5 font-medium w-[82px]">상태</th>
                                  <th className="text-left px-2 py-2.5 font-medium w-[96px]">매입처</th>
                                  <th className="text-left px-2 py-2.5 font-medium w-[120px]">현장명</th>
                                  <th className="text-left px-2 py-2.5 font-medium w-[162px]">주문일</th>
                                  <th className="text-left px-2 py-2.5 font-medium w-[132px]">주문번호</th>
                                  <th className="text-left px-2 py-2.5 font-medium w-[162px]">배송요청일</th>
                                  <th className="text-left px-2 py-2.5 font-medium w-[162px]">배송예정일</th>
                                  <th className="text-left px-2 py-2.5 font-medium w-[168px]">모델명</th>
                                  <th className="text-center px-2 py-2.5 font-medium w-[45px]">수량</th>
                                  <th className="text-left px-2 py-2.5 font-medium w-[161px]">창고명</th>
                                  <th className="text-left px-2 py-2.5 font-medium">창고주소</th>
                                  <th className="text-center px-2 py-2.5 font-medium w-[32px]"></th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-100">
                                {(editingItems[order.id] || []).map((item, idx) => {
                                  // 상태: 주문번호 있으면 배송중, 없으면 공란
                                  const hasOrderNumber = !!(item.orderNumber && item.orderNumber.trim())
                                  return (
                                    <tr key={item.id || idx} className="hover:bg-gray-50/30 transition-colors">
                                      {/* 상태 (주문번호 입력 시 배송중, 아니면 공란) */}
                                      <td className="px-2 py-1.5">
                                        {hasOrderNumber ? (
                                          <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                                            배송중
                                          </Badge>
                                        ) : (
                                          <span className="text-xs text-gray-300">—</span>
                                        )}
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
                                      {/* 모델명 (직접 입력) */}
                                      <td className="px-1 py-1.5">
                                        <Input
                                          value={item.componentName || ''}
                                          onChange={(e) => handleItemChange(order.id, idx, 'componentName', e.target.value)}
                                          placeholder="모델명"
                                          className="h-7 text-xs border-gray-200"
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
                                      {/* 삭제 */}
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
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* 행추가 버튼 */}
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

          // 다음 단계 상태 매핑 (모바일)
          const nextStatusMapMobile: Partial<Record<DeliveryStatus, { label: string; next: DeliveryStatus }>> = {
            'pending': { label: '배송중으로 변경', next: 'in-transit' },
            'in-transit': { label: '입고완료로 변경', next: 'delivered' },
          }
          const nextInfoMobile = nextStatusMapMobile[status]

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
                  <div className="flex items-center gap-2">
                    <StatusBadge order={order} />
                    {nextInfoMobile && onChangeStatus && (
                      <button
                        className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`"${order.businessName}" 배송상태를 ${nextInfoMobile.label.replace('으로 변경', '')}(으)로 변경하시겠습니까?`)) {
                            onChangeStatus(order.id, nextInfoMobile.next)
                          }
                        }}
                      >
                        → {nextInfoMobile.label}
                      </button>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">{formatShortDate(order.orderDate)}</span>
                </div>

                <h3 className="font-semibold text-sm mb-0.5">{order.businessName}</h3>
                <p className="text-xs text-gray-500 mb-2">{order.address}</p>

                <div className="flex items-center gap-4 text-xs mb-1">
                  {(() => {
                    const summary = renderDeliverySummary(order.equipmentItems)
                    return <span className={summary.className}>배송: {summary.text}</span>
                  })()}
                </div>

                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span className="font-medium">
                    {(() => {
                      const { region, city } = parseRegionFromAddress(order.address)
                      return `${region} ${city}`
                    })()}
                  </span>
                  <span>
                    {(() => {
                      const whId = getMostFrequentWarehouse(order.equipmentItems)
                      const detail = getWarehouseDetail(whId)
                      return detail ? `${detail.name}_${detail.managerName}` : '창고 미지정'
                    })()}
                  </span>
                </div>

                {/* 발주서 보기 버튼 (모바일) */}
                {onViewDetail && (
                  <button
                    className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                    onClick={(e) => {
                      e.stopPropagation()
                      onViewDetail(order)
                    }}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    교원 발주서 보기
                  </button>
                )}
              </div>

              {isExpanded && (
                <div className="bg-gray-50 border-t px-4 py-3">
                  {/* 모바일 인라인 편집 카드 */}
                  <div className="space-y-2 mb-3">
                    {(editingItems[order.id] || []).map((item, idx) => {
                      const hasOrderNumber = !!(item.orderNumber && item.orderNumber.trim())
                      return (
                        <div key={item.id || idx} className="bg-white border rounded-md p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-400">#{idx + 1}</span>
                              {hasOrderNumber ? (
                                <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">배송중</Badge>
                              ) : (
                                <span className="text-[10px] text-gray-300">—</span>
                              )}
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
                              <Input value={item.componentName || ''} onChange={(e) => handleItemChange(order.id, idx, 'componentName', e.target.value)} placeholder="모델명" className="h-7 text-xs" />
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
                    })}
                  </div>

                  {/* 행추가 버튼 */}
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
                </div>
              )}
            </div>
          )
        })}
      </div>

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
                  const validItems = updated.filter(item => item.componentName && item.componentName.trim() !== '')
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
    </>
  )
}
