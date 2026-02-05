/**
 * 설치일정 관리 테이블 컴포넌트
 *
 * 3개 탭 (일정미정/설치예정/설치완료)에 따라
 * 서로 다른 컬럼과 기능을 제공합니다.
 *
 * 주요 기능:
 * - 탭별 다른 컬럼 구성
 * - 긴급도별 행 왼쪽 보더 색상
 * - 장비 상태 뱃지 (신규설치만)
 * - 설치예정일/메모 인라인 편집
 * - 설치완료 버튼 (AlertDialog 확인)
 * - 아코디언: 구성품 배송현황 읽기전용 미리보기
 */

'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  Archive,
  ArrowRightLeft,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  FileText,
  MapPin,
  Package,
  Pencil,
  Plus,
  PlusCircle,
  CircleCheck,
  RotateCcw,
  StickyNote,
  Trash2,
  Undo2,
  XCircle,
} from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { LucideIcon } from 'lucide-react'
import type { Order, InstallScheduleStatus } from '@/types/order'
import {
  sortWorkTypes,
  getWorkTypeBadgeStyle,
  ITEM_DELIVERY_STATUS_LABELS,
  ITEM_DELIVERY_STATUS_COLORS,
} from '@/types/order'
import {
  getScheduleUrgency,
  getEquipmentStatusInfo,
  URGENCY_ROW_STYLES,
} from '@/lib/schedule-utils'
import {
  formatShortDate,
  computeItemDeliveryStatus,
  getWarehouseDetail,
} from '@/lib/delivery-utils'

// ──────────────────────────────────────────────────
// 날짜 입력 컴포넌트 (delivery-table.tsx와 동일 패턴)
// ──────────────────────────────────────────────────

/** 날짜 문자열 자동 정규화 */
function normalizeDate(raw: string): string {
  const s = raw.trim().replace(/[./\s]/g, '-')
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{2}-\d{2}-\d{2}$/.test(s)) return `20${s}`
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 6) {
    return `20${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`
  }
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  }
  return s
}

/** 날짜 입력 컴포넌트 (텍스트 직접 입력 + 달력 버튼) */
function DateInput({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const dateRef = useRef<HTMLInputElement>(null)
  const [localValue, setLocalValue] = useState(value)

  // 부모 value가 바뀌면 동기화 (다이얼로그 확인 후 등)
  useEffect(() => { setLocalValue(value) }, [value])

  // blur/Enter 시 부모에 전달
  const commitValue = (v: string) => {
    const trimmed = v.trim()
    if (!trimmed) {
      // 빈 값이면 날짜 삭제
      setLocalValue('')
      onChange('')
      return
    }
    const normalized = normalizeDate(trimmed)
    setLocalValue(normalized)
    onChange(normalized)
  }

  return (
    <div className="relative flex items-center max-w-[120px]">
      <Input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={(e) => commitValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commitValue((e.target as HTMLInputElement).value)
          }
        }}
        onPaste={(e) => {
          e.preventDefault()
          const pasted = e.clipboardData.getData('text').trim()
          const normalized = normalizeDate(pasted)
          setLocalValue(normalized)
          onChange(normalized)
        }}
        placeholder="YYYY-MM-DD"
        className="h-5 !text-[10px] border-gray-200 pr-7 placeholder:!text-[9px]"
      />
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

// ──────────────────────────────────────────────────
// 장비 상태 뱃지 컴포넌트
// ──────────────────────────────────────────────────

/**
 * 장비 상태 표시 (작업종류 뱃지와 다른 UI)
 *
 * - 미등록: 빨간 점 + 텍스트
 * - n/전체 입고: 프로그레스 바 + 텍스트
 * - 입고완료: 초록 체크 + 텍스트
 * - 해당없음: '-'
 */
function EquipmentStatusBadge({ order }: { order: Order }) {
  const info = getEquipmentStatusInfo(order)

  // 신규설치 아님
  if (info.type === 'not-applicable') {
    return <span className="text-xs text-gray-400">-</span>
  }

  // 미등록: 빨간 점 + 텍스트
  if (info.type === 'no-items') {
    return (
      <div className="flex items-center gap-1.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        <span className="text-xs font-medium text-red-600">미등록</span>
      </div>
    )
  }

  // 입고완료: 초록 체크
  if (info.type === 'all-delivered') {
    return (
      <div className="flex items-center gap-1.5">
        <svg className="h-3.5 w-3.5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
        </svg>
        <span className="text-xs font-medium text-green-700">입고완료</span>
      </div>
    )
  }

  // 일부 입고: 프로그레스 바
  const items = order.equipmentItems || []
  const confirmed = items.filter(item => item.confirmedDeliveryDate).length
  const total = items.length
  const percent = total > 0 ? Math.round((confirmed / total) * 100) : 0

  return (
    <div className="flex flex-col gap-1 min-w-[60px]">
      <span className="text-[11px] font-semibold text-orange-700">
        {confirmed}/{total} 입고
      </span>
      <div className="w-full h-1.5 bg-orange-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-orange-500 rounded-full transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────
// 작업종류 뱃지 컴포넌트
// ──────────────────────────────────────────────────

/** 작업종류 아이콘 매핑 (lucide-react 컴포넌트) */
const WORK_TYPE_ICON_MAP: Record<string, LucideIcon> = {
  '신규설치': PlusCircle,
  '이전설치': ArrowRightLeft,
  '철거보관': Archive,
  '철거폐기': Trash2,
  '재고설치': Package,
  '반납폐기': RotateCcw,
}

/** 발주건의 작업종류 목록을 아이콘 + 텍스트로 표시 */
function WorkTypeBadges({ order }: { order: Order }) {
  // 중복 제거 + 정해진 순서대로 정렬
  const types = sortWorkTypes(Array.from(new Set(order.items.map(item => item.workType))))

  return (
    <div className="flex flex-wrap gap-1">
      {types.map(type => {
        const Icon = WORK_TYPE_ICON_MAP[type]
        const style = getWorkTypeBadgeStyle(type)
        return (
          <span
            key={type}
            className={`inline-flex items-center gap-1 text-[11px] font-medium border rounded-md px-1.5 py-0.5 whitespace-nowrap ${style.badge}`}
          >
            {Icon && <Icon className={`h-3 w-3 shrink-0 ${style.icon}`} />}
            {type}
          </span>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────────
// 구성품 아코디언 (읽기전용 간략 보기)
// ──────────────────────────────────────────────────

/**
 * 구성품 배송현황 읽기전용 테이블
 *
 * 배송관리 아코디언의 간략 버전:
 * - 매입처/주문일/주문번호 제외
 * - 수정 불가 (읽기전용)
 * - 표시 컬럼: 배송상태 | 모델명 | 구성품 | 수량 | 배송예정일 | 배송확정일 | 창고
 */
function EquipmentAccordion({ order }: { order: Order }) {
  const items = order.equipmentItems || []

  // 구성품 없으면 안내 메시지
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 py-4 px-3 text-gray-400">
        <Package className="h-4 w-4" />
        <span className="text-sm">등록된 구성품이 없습니다</span>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 overflow-x-auto shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-100/80 text-xs text-gray-500 tracking-wide">
            <th className="text-left px-3 py-2 font-medium" style={{ width: '80px' }}>배송상태</th>
            <th className="text-left px-3 py-2 font-medium" style={{ width: '180px' }}>모델명</th>
            <th className="text-left px-3 py-2 font-medium" style={{ width: '80px' }}>구성품</th>
            <th className="text-center px-3 py-2 font-medium" style={{ width: '50px' }}>수량</th>
            <th className="text-left px-3 py-2 font-medium" style={{ width: '90px' }}>배송예정일</th>
            <th className="text-left px-3 py-2 font-medium" style={{ width: '90px' }}>배송확정일</th>
            <th className="text-left px-3 py-2 font-medium" style={{ width: '130px' }}>창고</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {items.map((item, idx) => {
            const itemStatus = computeItemDeliveryStatus(item)
            const whDetail = getWarehouseDetail(item.warehouseId)

            return (
              <tr key={item.id || idx} className="hover:bg-gray-50/30">
                {/* 배송상태 뱃지 */}
                <td className="px-3 py-2">
                  {itemStatus === 'none' ? (
                    <span className="text-xs text-gray-300">—</span>
                  ) : (
                    <Badge className={`${ITEM_DELIVERY_STATUS_COLORS[itemStatus]} text-[10px]`}>
                      {ITEM_DELIVERY_STATUS_LABELS[itemStatus]}
                    </Badge>
                  )}
                </td>
                {/* 모델명 */}
                <td className="px-3 py-2">
                  <p className="text-xs text-gray-700 truncate">{item.componentModel || '-'}</p>
                </td>
                {/* 구성품 */}
                <td className="px-3 py-2">
                  <p className="text-xs text-gray-600">{item.componentName || '-'}</p>
                </td>
                {/* 수량 */}
                <td className="px-3 py-2 text-center">
                  <p className="text-xs text-gray-700">{item.quantity || '-'}</p>
                </td>
                {/* 배송예정일 */}
                <td className="px-3 py-2">
                  <p className="text-xs text-gray-500">{formatShortDate(item.scheduledDeliveryDate)}</p>
                </td>
                {/* 배송확정일 */}
                <td className="px-3 py-2">
                  <p className="text-xs text-gray-500">{formatShortDate(item.confirmedDeliveryDate)}</p>
                </td>
                {/* 창고 */}
                <td className="px-3 py-2">
                  <p className="text-xs text-gray-600 truncate">
                    {whDetail ? `${whDetail.name}${whDetail.managerName ? ` · ${whDetail.managerName}` : ''}` : '-'}
                  </p>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * 모바일용 구성품 카드 리스트 (읽기전용)
 */
function EquipmentAccordionMobile({ order }: { order: Order }) {
  const items = order.equipmentItems || []

  if (items.length === 0) {
    return (
      <div className="flex items-center gap-2 py-3 text-gray-400">
        <Package className="h-4 w-4" />
        <span className="text-xs">등록된 구성품이 없습니다</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item, idx) => {
        const itemStatus = computeItemDeliveryStatus(item)
        const whDetail = getWarehouseDetail(item.warehouseId)

        return (
          <div key={item.id || idx} className="bg-white border rounded-md p-2.5 space-y-1.5">
            {/* 상단: 번호 + 배송상태 */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-gray-400">#{idx + 1}</span>
              {itemStatus === 'none' ? (
                <span className="text-[10px] text-gray-300">—</span>
              ) : (
                <Badge className={`${ITEM_DELIVERY_STATUS_COLORS[itemStatus]} text-[10px]`}>
                  {ITEM_DELIVERY_STATUS_LABELS[itemStatus]}
                </Badge>
              )}
            </div>
            {/* 모델명 + 구성품 */}
            <div className="grid grid-cols-2 gap-x-3 text-xs">
              <div>
                <span className="text-[10px] text-gray-400">모델명</span>
                <p className="text-gray-700 truncate">{item.componentModel || '-'}</p>
              </div>
              <div>
                <span className="text-[10px] text-gray-400">구성품</span>
                <p className="text-gray-600">{item.componentName || '-'}</p>
              </div>
            </div>
            {/* 수량 + 날짜 + 창고 */}
            <div className="grid grid-cols-4 gap-x-2 text-xs">
              <div>
                <span className="text-[10px] text-gray-400">수량</span>
                <p className="text-gray-700">{item.quantity || '-'}</p>
              </div>
              <div>
                <span className="text-[10px] text-gray-400">배송예정</span>
                <p className="text-gray-500">{formatShortDate(item.scheduledDeliveryDate)}</p>
              </div>
              <div>
                <span className="text-[10px] text-gray-400">배송확정</span>
                <p className="text-gray-500">{formatShortDate(item.confirmedDeliveryDate)}</p>
              </div>
              <div>
                <span className="text-[10px] text-gray-400">창고</span>
                <p className="text-gray-600 truncate">{whDetail ? `${whDetail.name}${whDetail.managerName ? ` · ${whDetail.managerName}` : ''}` : '-'}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ──────────────────────────────────────────────────
// 테이블 컬럼 개수 계산 (아코디언 colSpan에 사용)
// ──────────────────────────────────────────────────

/** 탭별 데스크톱 테이블 컬럼 수 계산 */
function getColumnCount(activeTab: InstallScheduleStatus): number {
  // 공통: 화살표(1) + 작업종류(1) + 현장명(1) + 발주서(1) + 현장주소(1) + 장비 상태(1) + 메모(1) + 견적서(1) + 설치(1) + 정산(1) + 버튼(1) = 11
  let count = 11

  if (activeTab === 'unscheduled') {
    // + 발주등록일(1) + 설치요청일(1) + 설치예정일편집(1) = 3
    count += 3
  } else if (activeTab === 'scheduled') {
    // + 설치예정일(1) + 담당자(1) + 일정변경(1) = 3
    count += 3
  } else {
    // completed: + 설치예정일(1) + 설치완료일(1) = 2
    count += 2
  }

  return count
}

/**
 * 메모 Popover 버튼 컴포넌트
 *
 * StickyNote 아이콘 클릭 시 Popover로 메모 입력/수정 가능.
 * 메모 있으면 아이콘이 노란색 + 우상단 파란 dot 표시.
 */
function MemoPopover({
  value,
  onChange,
}: {
  value: string
  onChange: (val: string) => void
}) {
  const [localValue, setLocalValue] = useState(value)

  // 부모 value 동기화
  useEffect(() => { setLocalValue(value) }, [value])

  const hasMemo = !!value.trim()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative p-1 rounded hover:bg-gray-100 transition-colors"
          onClick={(e) => e.stopPropagation()}
          title={hasMemo ? '메모 보기/수정' : '메모 추가'}
        >
          <StickyNote className={`h-4 w-4 ${hasMemo ? 'text-amber-500' : 'text-gray-300'}`} />
          {hasMemo && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-blue-500" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-3"
        side="bottom"
        align="center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-600">메모</p>
          <textarea
            className="w-full border border-gray-200 rounded-md p-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-300 placeholder:text-gray-300"
            placeholder="설치 팀장이 누구인지 등 기억해야 할 메모를 자유롭게 적어주세요"
            rows={4}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={() => {
              if (localValue !== value) onChange(localValue)
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * 견적서 상태 표시 컴포넌트 — 미니 pill 뱃지 2개
 *
 * 장비(멜레아 담당)와 설치비(설치팀 담당)를 각각 pill 뱃지로 표시.
 * 완료: 초록 뱃지 + 체크, 미작성: 회색 반투명 뱃지
 * 클릭 시 견적서 모달 열기
 */
function QuoteStatusCell({ order, onQuoteInput }: { order: Order; onQuoteInput?: (order: Order) => void }) {
  const quote = order.customerQuote

  const hasEquipment = (quote?.items?.filter(i => i.category === 'equipment') || []).length > 0
  const hasInstallation = (quote?.items?.filter(i => i.category === 'installation') || []).length > 0
  const hasAny = hasEquipment || hasInstallation

  return (
    <button
      className={`inline-flex flex-col items-center justify-center rounded-md px-1.5 py-1 transition-colors border ${
        hasAny
          ? 'bg-blue-50 border-blue-200 hover:bg-blue-100'
          : 'bg-gray-50 border-dashed border-gray-300 hover:bg-gray-100'
      }`}
      onClick={(e) => {
        e.stopPropagation()
        onQuoteInput?.(order)
      }}
      title="클릭하여 견적서 작성/수정"
    >
      {hasAny ? (
        <>
          {/* 작성된 견적서가 있을 때: 세로 2줄 pill */}
          <div className="flex items-center gap-1">
            <Pencil className="h-2.5 w-2.5 text-blue-500" />
            <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium px-1 py-0 rounded-full border ${
              hasEquipment ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'
            }`}>
              {hasEquipment && <CircleCheck className="h-2 w-2" />}
              장비
            </span>
          </div>
          <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium px-1 py-0 rounded-full border ${
            hasInstallation ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'
          }`}>
            {hasInstallation && <CircleCheck className="h-2 w-2" />}
            설치비
          </span>
        </>
      ) : (
        <>
          {/* 견적서 미작성: +견적서 / 작성 세로 2줄 */}
          <span className="text-[10px] text-gray-400 leading-tight">+견적서</span>
          <span className="text-[10px] text-gray-400 leading-tight">작성</span>
        </>
      )}
    </button>
  )
}

// ──────────────────────────────────────────────────
// 메인 테이블 컴포넌트
// ──────────────────────────────────────────────────

interface ScheduleTableProps {
  /** 필터+정렬된 발주 데이터 */
  orders: Order[]
  /** 현재 선택된 탭 */
  activeTab: InstallScheduleStatus
  /** 발주 정보 업데이트 콜백 */
  onUpdateOrder: (orderId: string, updates: Partial<Order>) => void
  /** 발주서 상세보기 콜백 */
  onViewDetail?: (order: Order) => void
  /** 견적서 작성/수정 콜백 */
  onQuoteInput?: (order: Order) => void
  /** 발주 취소 콜백 (사유와 함께) */
  onCancelOrder?: (orderId: string, reason: string) => void
}

export function ScheduleTable({ orders, activeTab, onUpdateOrder, onViewDetail, onQuoteInput, onCancelOrder }: ScheduleTableProps) {
  // 아코디언 열림/닫힘 상태
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // 설치완료 확인 다이얼로그 대상
  const [completeTarget, setCompleteTarget] = useState<{ orderId: string; businessName: string } | null>(null)
  // 설치완료일 입력값 (다이얼로그 내에서 수동 입력)
  const [completeDate, setCompleteDate] = useState('')

  // 설치예정일 확인 다이얼로그 (일정미정 탭에서 날짜 입력 시)
  const [scheduleTarget, setScheduleTarget] = useState<{ orderId: string; businessName: string; date: string } | null>(null)

  // 발주 취소 다이얼로그
  const [cancelTarget, setCancelTarget] = useState<{ orderId: string; businessName: string } | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  /** 아코디언 토글 */
  const toggleRow = (orderId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }

  /** 신규설치 포함 여부 (아코디언 표시 조건) */
  const hasEquipment = (order: Order): boolean => {
    return order.items.some(item => item.workType === '신규설치')
  }

  /** 인라인 편집 핸들러 */
  const handleFieldChange = (orderId: string, field: keyof Order, value: string) => {
    onUpdateOrder(orderId, { [field]: value })
  }

  /**
   * 설치예정일 입력 핸들러
   * - 유효한 날짜(YYYY-MM-DD)면 바로 저장 (탭 이동은 버튼으로)
   */
  const handleScheduleDateChange = (order: Order, val: string) => {
    // 빈 값이면 날짜 삭제
    if (val === '') {
      handleFieldChange(order.id, 'installScheduleDate', '')
      return
    }
    const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(val)
    if (isValidDate) {
      handleFieldChange(order.id, 'installScheduleDate', val)
    }
  }

  /**
   * "설치예정 →" 버튼 클릭 핸들러
   * 설치예정일이 있어야 이동 가능, 확인 다이얼로그 띄움
   */
  const handleMoveToScheduled = (order: Order) => {
    if (!order.installScheduleDate) {
      alert('설치예정일을 먼저 입력해주세요')
      return
    }
    setScheduleTarget({ orderId: order.id, businessName: order.businessName, date: order.installScheduleDate })
  }

  /** 설치완료 처리 (수동 입력된 날짜 사용) */
  const handleComplete = (orderId: string, date: string) => {
    onUpdateOrder(orderId, { installCompleteDate: date })
  }

  // 설치완료 → 되돌리기 확인 다이얼로그 상태
  const [revertTarget, setRevertTarget] = useState<{
    orderId: string
    businessName: string
    /** 되돌릴 탭: 'unscheduled' 또는 'scheduled' */
    destination: 'unscheduled' | 'scheduled'
  } | null>(null)

  /** 설치완료 → 일정미정/설치예정으로 되돌리기 */
  const handleRevert = () => {
    if (!revertTarget) return
    if (revertTarget.destination === 'unscheduled') {
      // 일정미정: 설치완료일 제거 + 설치예정일 제거 + status를 received로
      onUpdateOrder(revertTarget.orderId, {
        installCompleteDate: '',
        installScheduleDate: '',
        status: 'received',
      })
    } else {
      // 설치예정: 설치완료일만 제거 (예정일/status 유지)
      onUpdateOrder(revertTarget.orderId, {
        installCompleteDate: '',
      })
    }
    setRevertTarget(null)
  }

  // 빈 목록
  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <CalendarCheck className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-lg font-medium">표시할 설치일정이 없습니다</p>
      </div>
    )
  }

  // 컬럼 수 (아코디언 colSpan용)
  const colCount = getColumnCount(activeTab)

  return (
    <>
      {/* ─── 데스크톱 테이블 (md 이상) ─── */}
      <div className="hidden md:block border rounded-lg overflow-x-auto">
        <table className="min-w-[1450px] w-full" style={{ tableLayout: 'fixed' }}>
          <thead className="bg-muted/80">
            <tr>
              {/* 아코디언 화살표 컬럼 */}
              <th className="text-center p-3 text-sm font-medium whitespace-nowrap" style={{ width: '40px' }}></th>

              {/* 탭별 컬럼 헤더 */}
              <th className="text-center p-3 text-sm font-medium whitespace-nowrap" style={{ width: '110px' }}>작업종류</th>

              {/* 일정미정 탭: 발주등록일 */}
              {activeTab === 'unscheduled' && (
                <th className="text-center p-3 text-sm font-medium whitespace-nowrap" style={{ width: '80px' }}>발주등록일</th>
              )}

              {/* 설치예정/설치완료 탭: 설치예정일 */}
              {(activeTab === 'scheduled' || activeTab === 'completed') && (
                <th className="text-center p-3 text-sm font-medium whitespace-nowrap" style={{ width: '120px' }}>설치예정일</th>
              )}

              {/* 설치완료 탭: 설치완료일 */}
              {activeTab === 'completed' && (
                <th className="text-center p-3 text-sm font-medium whitespace-nowrap" style={{ width: '120px' }}>설치완료일</th>
              )}

              <th className="text-center p-3 text-sm font-medium whitespace-nowrap" style={{ width: '180px' }}>현장명</th>
              <th className="text-center p-3 text-sm font-medium whitespace-nowrap" style={{ width: '80px' }}>교원 발주서</th>
              <th className="text-center p-3 text-sm font-medium whitespace-nowrap" style={{ width: '180px' }}>현장주소</th>

              {/* 일정미정 탭: 설치요청일 */}
              {activeTab === 'unscheduled' && (
                <th className="text-center p-3 text-sm font-medium whitespace-nowrap" style={{ width: '95px' }}>설치요청일</th>
              )}

              {/* 설치예정 탭: 담당자 */}
              {activeTab === 'scheduled' && (
                <th className="text-center p-3 text-sm font-medium whitespace-nowrap" style={{ width: '120px' }}>담당자</th>
              )}

              {/* 일정미정/설치예정 탭: 설치예정일(편집) */}
              {(activeTab === 'unscheduled' || activeTab === 'scheduled') && (
                <th className="text-center p-3 text-sm font-medium whitespace-nowrap" style={{ width: '120px' }}>
                  {activeTab === 'unscheduled' ? '설치예정일' : '일정변경'}
                </th>
              )}

              {/* 메모 (모든 탭 공통) */}
              <th className="text-center p-3 text-sm font-medium whitespace-nowrap" style={{ width: '50px' }}>메모</th>

              {/* 견적서 상태 (모든 탭 공통) */}
              <th className="text-center p-3 text-sm font-medium whitespace-nowrap" style={{ width: '80px' }}>견적서</th>

              {/* 장비 상태 */}
              <th className="text-center p-3 text-sm font-medium whitespace-nowrap" style={{ width: '90px' }}>장비 상태</th>

              {/* 설치 상태 */}
              <th className="text-center p-3 text-sm font-medium whitespace-nowrap" style={{ width: '80px' }}>설치 상태</th>

              {/* 에스원 정산 상태 */}
              <th className="text-center p-3 text-sm font-medium whitespace-nowrap" style={{ width: '80px' }}>정산 상태</th>

              {/* 일정미정 탭: 설치예정 이동 버튼 / 설치예정 탭: 설치완료 버튼 / 설치완료 탭: 되돌리기 버튼 */}
              <th className="text-center p-3 text-sm font-medium whitespace-nowrap" style={{ width: activeTab === 'completed' ? '140px' : '80px' }}></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const urgency = getScheduleUrgency(order)
              const rowStyle = URGENCY_ROW_STYLES[urgency]
              const isExpanded = expandedRows.has(order.id)
              const canExpand = hasEquipment(order)

              return (
                <Fragment key={order.id}>
                  <tr
                    className={`transition-colors border-b border-gray-100 ${rowStyle} ${canExpand ? 'cursor-pointer hover:bg-gray-50/50' : ''}`}
                    onClick={() => canExpand && toggleRow(order.id)}
                  >
                    {/* 아코디언 화살표 */}
                    <td className="p-3 text-center">
                      {canExpand ? (
                        isExpanded
                          ? <ChevronDown className="h-4 w-4 text-gray-500 inline-block" />
                          : <ChevronRight className="h-4 w-4 text-gray-500 inline-block" />
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>

                    {/* 작업종류 뱃지 */}
                    <td className="p-3">
                      <WorkTypeBadges order={order} />
                    </td>

                    {/* 일정미정: 발주등록일 */}
                    {activeTab === 'unscheduled' && (
                      <td className="p-3">
                        <p className="text-[11px] text-gray-600">{formatShortDate(order.orderDate)}</p>
                      </td>
                    )}

                    {/* 설치예정/완료: 설치예정일 (읽기전용) */}
                    {(activeTab === 'scheduled' || activeTab === 'completed') && (
                      <td className="p-3">
                        <p className="text-xs font-medium">{formatShortDate(order.installScheduleDate)}</p>
                      </td>
                    )}

                    {/* 설치완료: 설치완료일 */}
                    {activeTab === 'completed' && (
                      <td className="p-3">
                        <p className="text-xs">{formatShortDate(order.installCompleteDate)}</p>
                      </td>
                    )}

                    {/* 현장명 + 사전견적 뱃지 */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-xs truncate">{order.businessName}</p>
                        {order.isPreliminaryQuote && (
                          <Badge className="bg-red-50 text-red-600 border-red-200 text-[9px] px-1 py-0 leading-tight shrink-0">
                            사전견적
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* 발주서 보기 버튼 */}
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

                    {/* 현장주소 */}
                    <td className="p-3">
                      <p className="text-[10px] text-gray-500 truncate">{order.address}</p>
                    </td>

                    {/* 일정미정: 설치요청일 */}
                    {activeTab === 'unscheduled' && (
                      <td className="p-3">
                        <p className="text-[11px] text-gray-500">{formatShortDate(order.requestedInstallDate)}</p>
                      </td>
                    )}

                    {/* 설치예정: 담당자 (이름 + 연락처 2줄) */}
                    {activeTab === 'scheduled' && (
                      <td className="p-3">
                        <p className="text-xs font-medium text-gray-700 whitespace-nowrap">{order.contactName || '-'}</p>
                        {order.contactPhone && (
                          <p className="text-[10px] text-gray-400 whitespace-nowrap">{order.contactPhone}</p>
                        )}
                      </td>
                    )}

                    {/* 일정미정/설치예정: 설치예정일(편집) */}
                    {(activeTab === 'unscheduled' || activeTab === 'scheduled') && (
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <DateInput
                          value={order.installScheduleDate || ''}
                          onChange={(val) => handleScheduleDateChange(order, val)}
                        />
                      </td>
                    )}

                    {/* 메모 (모든 탭 공통) */}
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <MemoPopover
                        value={order.installMemo || ''}
                        onChange={(val) => handleFieldChange(order.id, 'installMemo', val)}
                      />
                    </td>

                    {/* 견적서 상태 (모든 탭 공통) */}
                    <td className="p-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <QuoteStatusCell order={order} onQuoteInput={onQuoteInput} />
                    </td>

                    {/* 장비 상태 뱃지 */}
                    <td className="p-3">
                      <EquipmentStatusBadge order={order} />
                    </td>

                    {/* 설치 상태 (3단계: 컬러 도트 + 텍스트) */}
                    <td className="p-3 whitespace-nowrap">
                      {(() => {
                        if (order.installCompleteDate) {
                          return (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700">
                              <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
                              설치완료
                            </span>
                          )
                        }
                        if (order.status === 'in-progress' && order.installScheduleDate) {
                          return (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700">
                              <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                              설치예정
                            </span>
                          )
                        }
                        return (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
                            <span className="h-2 w-2 shrink-0 rounded-full border border-gray-400 bg-white" />
                            일정미정
                          </span>
                        )
                      })()}
                    </td>

                    {/* 정산 상태 (아이콘 + 텍스트) */}
                    <td className="p-3 whitespace-nowrap">
                      {(() => {
                        const status = order.s1SettlementStatus || 'unsettled'
                        if (status === 'settled') {
                          return (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                              <CircleCheck className="h-3.5 w-3.5 shrink-0" />
                              정산완료
                            </span>
                          )
                        }
                        if (status === 'in-progress') {
                          return (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600">
                              <Clock className="h-3.5 w-3.5 shrink-0" />
                              진행중
                            </span>
                          )
                        }
                        return (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400">
                            <Circle className="h-3.5 w-3.5 shrink-0" />
                            미정산
                          </span>
                        )
                      })()}
                    </td>

                    {/* 일정미정: 설치예정 이동 버튼 + 취소 X */}
                    {activeTab === 'unscheduled' && (
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] px-2 h-6"
                            onClick={() => handleMoveToScheduled(order)}
                          >
                            설치예정 →
                          </Button>
                          {onCancelOrder && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => { setCancelReason(''); setCancelTarget({ orderId: order.id, businessName: order.businessName }) }}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}

                    {/* 설치예정: 설치완료 버튼 + 취소 X */}
                    {activeTab === 'scheduled' && (
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white text-[11px] px-2 h-6"
                            onClick={() => { setCompleteDate(''); setCompleteTarget({ orderId: order.id, businessName: order.businessName }) }}
                          >
                            설치완료
                          </Button>
                          {onCancelOrder && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => { setCancelReason(''); setCancelTarget({ orderId: order.id, businessName: order.businessName }) }}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}

                    {/* 설치완료: 되돌리기 버튼 (일정미정 / 설치예정) */}
                    {activeTab === 'completed' && (
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[11px] px-1.5 h-6 text-gray-600 hover:text-orange-700 hover:border-orange-300 hover:bg-orange-50"
                          onClick={() => setRevertTarget({ orderId: order.id, businessName: order.businessName, destination: 'unscheduled' })}
                        >
                          <Undo2 className="h-2.5 w-2.5 mr-0.5" />
                          일정미정
                        </Button>
                      </td>
                    )}
                  </tr>

                  {/* ─── 아코디언 상세: 구성품 배송현황 (읽기전용) ─── */}
                  {isExpanded && canExpand && (
                    <tr>
                      <td colSpan={colCount} className="p-0">
                        <div className="border-t border-gray-200 bg-gray-50/60 px-4 py-3">
                          <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5">
                            <Package className="h-3.5 w-3.5" />
                            구성품 배송현황
                          </p>
                          <EquipmentAccordion order={order} />
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

      {/* ─── 모바일 카드 리스트 (md 미만) ─── */}
      <div className="md:hidden space-y-3">
        {orders.map((order) => {
          const urgency = getScheduleUrgency(order)
          const rowStyle = URGENCY_ROW_STYLES[urgency]
          const isExpanded = expandedRows.has(order.id)
          const canExpand = hasEquipment(order)

          return (
            <div
              key={order.id}
              className={`border rounded-lg bg-white overflow-hidden ${rowStyle}`}
            >
              {/* 카드 상단 (클릭하면 아코디언 토글) */}
              <div
                className={`p-4 space-y-3 ${canExpand ? 'cursor-pointer' : ''}`}
                onClick={() => canExpand && toggleRow(order.id)}
              >
                {/* 상단: 작업종류 + 장비 상태 + 화살표 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {canExpand && (
                      isExpanded
                        ? <ChevronDown className="h-4 w-4 text-gray-400" />
                        : <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                    <WorkTypeBadges order={order} />
                  </div>
                  <EquipmentStatusBadge order={order} />
                </div>

                {/* 현장 정보 + 발주서 보기 */}
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold text-sm flex-1">
                      {order.businessName}
                      {order.isPreliminaryQuote && (
                        <Badge className="bg-red-50 text-red-600 border-red-200 text-[9px] px-1 py-0 leading-tight ml-1.5 align-middle">
                          사전견적
                        </Badge>
                      )}
                    </h3>
                    {onViewDetail && (
                      <button
                        className="shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                        onClick={(e) => {
                          e.stopPropagation()
                          onViewDetail(order)
                        }}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        발주서
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3" />
                    {order.address}
                  </p>
                </div>

                {/* 날짜 정보 */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  {activeTab === 'unscheduled' && (
                    <>
                      <span>발주: {formatShortDate(order.orderDate)}</span>
                      {order.requestedInstallDate && (
                        <span>요청: {formatShortDate(order.requestedInstallDate)}</span>
                      )}
                    </>
                  )}
                  {activeTab === 'scheduled' && (
                    <>
                      <span>예정: {formatShortDate(order.installScheduleDate)}</span>
                      {order.contactName && <span>담당: {order.contactName}</span>}
                    </>
                  )}
                  {activeTab === 'completed' && (
                    <>
                      <span>예정: {formatShortDate(order.installScheduleDate)}</span>
                      <span>완료: {formatShortDate(order.installCompleteDate)}</span>
                    </>
                  )}
                </div>

                {/* 편집 영역 (일정미정/설치예정) */}
                {(activeTab === 'unscheduled' || activeTab === 'scheduled') && (
                  <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <label className="text-[10px] text-gray-400">설치예정일</label>
                      <DateInput
                        value={order.installScheduleDate || ''}
                        onChange={(val) => handleScheduleDateChange(order, val)}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-gray-400">견적서</label>
                        <QuoteStatusCell order={order} onQuoteInput={onQuoteInput} />
                      </div>
                      <MemoPopover
                        value={order.installMemo || ''}
                        onChange={(val) => handleFieldChange(order.id, 'installMemo', val)}
                      />
                    </div>
                  </div>
                )}

                {/* 설치 상태 + 정산 상태 (모든 탭 공통, 도트/아이콘 스타일) */}
                <div className="flex items-center gap-3">
                  {(() => {
                    if (order.installCompleteDate) {
                      return (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700">
                          <span className="h-2 w-2 rounded-full bg-green-500" />
                          설치완료
                        </span>
                      )
                    }
                    if (order.status === 'in-progress' && order.installScheduleDate) {
                      return (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700">
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                          설치예정
                        </span>
                      )
                    }
                    return (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
                        <span className="h-2 w-2 rounded-full bg-gray-400" />
                        일정미정
                      </span>
                    )
                  })()}
                  {(() => {
                    const status = order.s1SettlementStatus || 'unsettled'
                    if (status === 'settled') {
                      return (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                          <CircleCheck className="h-3.5 w-3.5" />
                          정산완료
                        </span>
                      )
                    }
                    if (status === 'in-progress') {
                      return (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600">
                          <Clock className="h-3.5 w-3.5" />
                          진행중
                        </span>
                      )
                    }
                    return (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400">
                        <Circle className="h-3.5 w-3.5" />
                        미정산
                      </span>
                    )
                  })()}
                </div>

                {/* 설치완료 탭: 견적서 + 메모 */}
                {activeTab === 'completed' && (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <QuoteStatusCell order={order} onQuoteInput={onQuoteInput} />
                    <MemoPopover
                      value={order.installMemo || ''}
                      onChange={(val) => handleFieldChange(order.id, 'installMemo', val)}
                    />
                  </div>
                )}

                {/* 일정미정 탭: 취소 버튼 */}
                {activeTab === 'unscheduled' && onCancelOrder && (
                  <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[11px] px-2 h-6 text-gray-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => { setCancelReason(''); setCancelTarget({ orderId: order.id, businessName: order.businessName }) }}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      발주취소
                    </Button>
                  </div>
                )}

                {/* 설치완료 버튼 + 취소 (설치예정 탭) */}
                {activeTab === 'scheduled' && (
                  <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white text-[11px] px-2 h-6"
                      onClick={() => { setCompleteDate(''); setCompleteTarget({ orderId: order.id, businessName: order.businessName }) }}
                    >
                      설치완료
                    </Button>
                    {onCancelOrder && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => { setCancelReason(''); setCancelTarget({ orderId: order.id, businessName: order.businessName }) }}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}

                {/* 되돌리기 버튼 (설치완료 탭) */}
                {activeTab === 'completed' && (
                  <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[11px] px-1.5 h-6 text-gray-600 hover:text-orange-700 hover:border-orange-300 hover:bg-orange-50"
                      onClick={() => setRevertTarget({ orderId: order.id, businessName: order.businessName, destination: 'unscheduled' })}
                    >
                      <Undo2 className="h-2.5 w-2.5 mr-0.5" />
                      일정미정
                    </Button>
                  </div>
                )}
              </div>

              {/* 모바일 아코디언 상세 */}
              {isExpanded && canExpand && (
                <div className="border-t bg-gray-50 px-4 py-3">
                  <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" />
                    구성품 배송현황
                  </p>
                  <EquipmentAccordionMobile order={order} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ─── 설치예정일 확인 다이얼로그 (일정미정 → 설치예정 이동) ─── */}
      <AlertDialog open={!!scheduleTarget} onOpenChange={(open) => { if (!open) setScheduleTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>설치예정일 등록</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  &ldquo;{scheduleTarget?.businessName}&rdquo; 현장의 설치예정일을
                  <span className="font-semibold text-blue-600 mx-1">
                    {scheduleTarget?.date.replace(/-/g, '.')}
                  </span>
                  (으)로 등록하시겠습니까?
                </p>
                <p className="text-xs text-gray-500">
                  확인하면 설치예정 탭으로 이동합니다.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => {
                if (scheduleTarget) {
                  // 설치예정일 저장 + status를 in-progress로 변경 → 설치예정 탭으로 이동
                  onUpdateOrder(scheduleTarget.orderId, {
                    installScheduleDate: scheduleTarget.date,
                    status: 'in-progress'
                  })
                }
                setScheduleTarget(null)
              }}
            >
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── 설치완료 → 되돌리기 확인 다이얼로그 ─── */}
      <AlertDialog open={!!revertTarget} onOpenChange={(open) => { if (!open) setRevertTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>설치완료 되돌리기</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  &ldquo;{revertTarget?.businessName}&rdquo; 현장을
                  <span className={`font-semibold mx-1 ${revertTarget?.destination === 'unscheduled' ? 'text-orange-600' : 'text-blue-600'}`}>
                    {revertTarget?.destination === 'unscheduled' ? '일정미정' : '설치예정'}
                  </span>
                  탭으로 되돌리시겠습니까?
                </p>
                <p className="text-xs text-gray-500">
                  {revertTarget?.destination === 'unscheduled'
                    ? '설치완료일과 설치예정일이 모두 초기화됩니다.'
                    : '설치완료일이 초기화되고 설치예정 탭으로 이동합니다.'}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className={revertTarget?.destination === 'unscheduled'
                ? 'bg-orange-600 hover:bg-orange-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'}
              onClick={handleRevert}
            >
              되돌리기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── 설치완료 확인 다이얼로그 ─── */}
      <AlertDialog open={!!completeTarget} onOpenChange={(open) => { if (!open) setCompleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>설치완료 처리</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>&ldquo;{completeTarget?.businessName}&rdquo; 현장의 설치완료일을 입력해주세요.</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">설치완료일</label>
                  <Input
                    type="text"
                    value={completeDate}
                    onChange={(e) => setCompleteDate(e.target.value)}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v) setCompleteDate(normalizeDate(v))
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const v = (e.target as HTMLInputElement).value.trim()
                        if (v) setCompleteDate(normalizeDate(v))
                      }
                    }}
                    placeholder="yyyy-mm-dd"
                    className="max-w-[200px]"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={!completeDate}
              onClick={() => {
                if (completeTarget && completeDate) {
                  handleComplete(completeTarget.orderId, completeDate)
                }
                setCompleteTarget(null)
                setCompleteDate('')
              }}
            >
              설치완료
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── 발주 취소 확인 다이얼로그 ─── */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>발주 취소</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  &ldquo;{cancelTarget?.businessName}&rdquo; 발주를 취소하시겠습니까?
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">취소 사유</label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="취소 사유를 입력해주세요"
                    className="w-full border rounded-md p-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-red-300 focus:border-red-400"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  취소된 발주는 발주관리 페이지에서 확인할 수 있습니다.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>돌아가기</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!cancelReason.trim()}
              onClick={() => {
                if (cancelTarget && cancelReason.trim() && onCancelOrder) {
                  onCancelOrder(cancelTarget.orderId, cancelReason.trim())
                }
                setCancelTarget(null)
                setCancelReason('')
              }}
            >
              발주 취소
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
