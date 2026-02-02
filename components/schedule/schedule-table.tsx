/**
 * 설치일정 관리 테이블 컴포넌트
 *
 * 3개 탭 (일정미정/설치예정/설치완료)에 따라
 * 서로 다른 컬럼과 기능을 제공합니다.
 *
 * 주요 기능:
 * - 탭별 다른 컬럼 구성
 * - 긴급도별 행 왼쪽 보더 색상
 * - 장비상태 뱃지 (신규설치만)
 * - 설치예정일/메모 인라인 편집
 * - 설치완료 버튼 (AlertDialog 확인)
 * - 아코디언: 구성품 배송현황 읽기전용 미리보기
 */

'use client'

import { Fragment, useRef, useState } from 'react'
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
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FileText,
  MapPin,
  Package,
  CircleCheck,
} from 'lucide-react'
import type { Order, InstallScheduleStatus } from '@/types/order'
import {
  WORK_TYPE_COLORS,
  ITEM_DELIVERY_STATUS_LABELS,
  ITEM_DELIVERY_STATUS_COLORS,
  S1_SETTLEMENT_STATUS_LABELS,
  S1_SETTLEMENT_STATUS_COLORS,
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

  return (
    <div className="relative flex items-center">
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          const v = e.target.value.trim()
          if (v) onChange(normalizeDate(v))
        }}
        onKeyDown={(e) => {
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
// 장비상태 뱃지 컴포넌트
// ──────────────────────────────────────────────────

/**
 * 장비상태 표시 (작업종류 뱃지와 다른 UI)
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

/** 발주건의 작업종류 목록을 뱃지로 표시 */
function WorkTypeBadges({ order }: { order: Order }) {
  // 중복 제거
  const types = Array.from(new Set(order.items.map(item => item.workType)))

  return (
    <div className="flex flex-wrap gap-1">
      {types.map(type => (
        <Badge
          key={type}
          className={`${WORK_TYPE_COLORS[type] || 'bg-gray-100 text-gray-700'} text-xs border`}
        >
          {type}
        </Badge>
      ))}
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
                    {whDetail ? `${whDetail.name}` : '-'}
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
                <p className="text-gray-600 truncate">{whDetail ? whDetail.name : '-'}</p>
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
  // 공통: 화살표(1) + 작업종류(1) + 현장명(1) + 발주서(1) + 현장주소(1) + 장비상태(1) + 견적서(1) = 7
  let count = 7

  if (activeTab === 'unscheduled') {
    // + 발주등록일(1) + 설치요청일(1) + 설치예정일편집(1) = 3
    count += 3
  } else if (activeTab === 'scheduled') {
    // + 설치예정일(1) + 담당자(1) + 일정변경(1) + 버튼(1) = 4
    count += 4
  } else {
    // completed: + 설치예정일(1) + 설치완료일(1) + 정산(1) = 3
    count += 3
  }

  return count
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

  return (
    <button
      className="inline-flex items-center gap-1 rounded-md p-1 -m-1 hover:bg-gray-100 transition-colors"
      onClick={(e) => {
        e.stopPropagation()
        onQuoteInput?.(order)
      }}
    >
      {/* 장비 뱃지 */}
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
        hasEquipment
          ? 'bg-green-50 text-green-700 border-green-200'
          : 'bg-gray-50 text-gray-400 border-gray-200'
      }`}>
        {hasEquipment && <CircleCheck className="h-2.5 w-2.5" />}
        장비
      </span>
      {/* 설치비 뱃지 */}
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
        hasInstallation
          ? 'bg-green-50 text-green-700 border-green-200'
          : 'bg-gray-50 text-gray-400 border-gray-200'
      }`}>
        {hasInstallation && <CircleCheck className="h-2.5 w-2.5" />}
        설치비
      </span>
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
}

export function ScheduleTable({ orders, activeTab, onUpdateOrder, onViewDetail, onQuoteInput }: ScheduleTableProps) {
  // 아코디언 열림/닫힘 상태
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // 설치완료 확인 다이얼로그 대상
  const [completeTarget, setCompleteTarget] = useState<{ orderId: string; businessName: string } | null>(null)
  // 설치완료일 입력값 (다이얼로그 내에서 수동 입력)
  const [completeDate, setCompleteDate] = useState('')

  // 설치예정일 확인 다이얼로그 (일정미정 탭에서 날짜 입력 시)
  const [scheduleTarget, setScheduleTarget] = useState<{ orderId: string; businessName: string; date: string } | null>(null)

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
   * - 일정미정 탭: 확인 다이얼로그를 띄움 (실수 방지)
   * - 설치예정 탭: 바로 저장 (이미 예정 상태이므로)
   */
  const handleScheduleDateChange = (order: Order, val: string) => {
    if (activeTab === 'unscheduled' && val) {
      // 일정미정 → 확인 다이얼로그
      setScheduleTarget({ orderId: order.id, businessName: order.businessName, date: val })
    } else {
      // 설치예정 탭에서는 바로 저장
      handleFieldChange(order.id, 'installScheduleDate', val)
    }
  }

  /** 설치완료 처리 (수동 입력된 날짜 사용) */
  const handleComplete = (orderId: string, date: string) => {
    onUpdateOrder(orderId, { installCompleteDate: date })
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
      <div className="hidden md:block border rounded-lg overflow-hidden">
        <table className="w-full table-fixed">
          <thead className="bg-muted/80">
            <tr>
              {/* 아코디언 화살표 컬럼 */}
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '40px' }}></th>

              {/* 탭별 컬럼 헤더 */}
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '110px' }}>작업종류</th>

              {/* 일정미정 탭: 발주등록일 */}
              {activeTab === 'unscheduled' && (
                <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '95px' }}>발주등록일</th>
              )}

              {/* 설치예정/설치완료 탭: 설치예정일 */}
              {(activeTab === 'scheduled' || activeTab === 'completed') && (
                <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '95px' }}>설치예정일</th>
              )}

              {/* 설치완료 탭: 설치완료일 */}
              {activeTab === 'completed' && (
                <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '95px' }}>설치완료일</th>
              )}

              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '220px' }}>현장명</th>
              <th className="text-center p-3 text-sm font-medium whitespace-nowrap" style={{ width: '80px' }}>교원 발주서</th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '200px' }}>현장주소</th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '90px' }}>장비상태</th>

              {/* 일정미정 탭: 설치요청일 */}
              {activeTab === 'unscheduled' && (
                <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '95px' }}>설치요청일</th>
              )}

              {/* 설치예정 탭: 담당자 */}
              {activeTab === 'scheduled' && (
                <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '160px' }}>담당자</th>
              )}

              {/* 일정미정/설치예정 탭: 설치예정일(편집) */}
              {(activeTab === 'unscheduled' || activeTab === 'scheduled') && (
                <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '155px' }}>
                  {activeTab === 'unscheduled' ? '설치예정일' : '일정변경'}
                </th>
              )}

              {/* 견적서 상태 (모든 탭 공통) */}
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '130px' }}>견적서</th>

              {/* 설치완료 탭: 에스원 정산 상태 */}
              {activeTab === 'completed' && (
                <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '80px' }}>정산</th>
              )}

              {/* 설치예정 탭: 설치완료 버튼 */}
              {activeTab === 'scheduled' && (
                <th className="text-center p-3 text-sm font-medium whitespace-nowrap" style={{ width: '90px' }}></th>
              )}
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
                        <p className="text-sm">{formatShortDate(order.orderDate)}</p>
                      </td>
                    )}

                    {/* 설치예정/완료: 설치예정일 (읽기전용) */}
                    {(activeTab === 'scheduled' || activeTab === 'completed') && (
                      <td className="p-3">
                        <p className="text-sm font-medium">{formatShortDate(order.installScheduleDate)}</p>
                      </td>
                    )}

                    {/* 설치완료: 설치완료일 */}
                    {activeTab === 'completed' && (
                      <td className="p-3">
                        <p className="text-sm">{formatShortDate(order.installCompleteDate)}</p>
                      </td>
                    )}

                    {/* 현장명 */}
                    <td className="p-3">
                      <p className="font-semibold text-sm truncate">{order.businessName}</p>
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
                      <p className="text-xs text-gray-600 truncate">{order.address}</p>
                    </td>

                    {/* 장비상태 뱃지 */}
                    <td className="p-3">
                      <EquipmentStatusBadge order={order} />
                    </td>

                    {/* 일정미정: 설치요청일 */}
                    {activeTab === 'unscheduled' && (
                      <td className="p-3">
                        <p className="text-sm text-gray-500">{formatShortDate(order.requestedInstallDate)}</p>
                      </td>
                    )}

                    {/* 설치예정: 담당자 + 연락처 */}
                    {activeTab === 'scheduled' && (
                      <td className="p-3">
                        <p className="text-sm text-gray-700">{order.contactName || '-'}
                          {order.contactPhone && (
                            <span className="text-xs text-gray-400 ml-1.5">{order.contactPhone}</span>
                          )}
                        </p>
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

                    {/* 견적서 상태 (모든 탭 공통) */}
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <QuoteStatusCell order={order} onQuoteInput={onQuoteInput} />
                    </td>

                    {/* 설치완료 탭: 에스원 정산 상태 뱃지 */}
                    {activeTab === 'completed' && (
                      <td className="p-3">
                        {(() => {
                          const status = order.s1SettlementStatus || 'unsettled'
                          return (
                            <Badge className={`${S1_SETTLEMENT_STATUS_COLORS[status]} text-[10px] border`}>
                              {S1_SETTLEMENT_STATUS_LABELS[status]}
                            </Badge>
                          )
                        })()}
                      </td>
                    )}

                    {/* 설치예정: 설치완료 버튼 */}
                    {activeTab === 'scheduled' && (
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 h-7"
                          onClick={() => { setCompleteDate(new Date().toISOString().split('T')[0]); setCompleteTarget({ orderId: order.id, businessName: order.businessName }) }}
                        >
                          설치완료
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
                {/* 상단: 작업종류 + 장비상태 + 화살표 */}
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
                    <h3 className="font-semibold text-sm flex-1">{order.businessName}</h3>
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
                    <div>
                      <label className="text-[10px] text-gray-400">견적서</label>
                      <QuoteStatusCell order={order} onQuoteInput={onQuoteInput} />
                    </div>
                  </div>
                )}

                {/* 설치완료 탭: 견적서 + 정산 상태 */}
                {activeTab === 'completed' && (
                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <QuoteStatusCell order={order} onQuoteInput={onQuoteInput} />
                    {(() => {
                      const status = order.s1SettlementStatus || 'unsettled'
                      return (
                        <Badge className={`${S1_SETTLEMENT_STATUS_COLORS[status]} text-[10px] border`}>
                          {S1_SETTLEMENT_STATUS_LABELS[status]}
                        </Badge>
                      )
                    })()}
                  </div>
                )}

                {/* 설치완료 버튼 (설치예정 탭) */}
                {activeTab === 'scheduled' && (
                  <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 h-7"
                      onClick={() => { setCompleteDate(new Date().toISOString().split('T')[0]); setCompleteTarget({ orderId: order.id, businessName: order.businessName }) }}
                    >
                      설치완료
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
                  handleFieldChange(scheduleTarget.orderId, 'installScheduleDate', scheduleTarget.date)
                }
                setScheduleTarget(null)
              }}
            >
              확인
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
                    type="date"
                    value={completeDate}
                    onChange={(e) => setCompleteDate(e.target.value)}
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
    </>
  )
}
