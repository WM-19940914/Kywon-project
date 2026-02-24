/**
 * 에스원 정산관리 페이지
 *
 * 멜레아와 에스원(설치팀) 간 월별 설치비 정산을 관리합니다.
 * - 매달 20~29일경 설치 완료건에 대해 일괄 정산
 * - 3단계: 미정산 → 정산 진행중 → 정산 완료
 * - 애매한 건은 미정산에 남겨두고 나머지만 일괄 처리 가능
 */

'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { fetchOrders, updateOrder, updateS1SettlementStatus, batchUpdateS1SettlementStatus } from '@/lib/supabase/dal'
import type { Order, S1SettlementStatus } from '@/types/order'
import {
  S1_SETTLEMENT_STATUS_LABELS,
  S1_SETTLEMENT_STATUS_COLORS,
  sortWorkTypes,
  getWorkTypeBadgeStyle,
} from '@/types/order'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Receipt, ArrowRight, Undo2, CheckCircle2, Clock, CircleDot, ChevronDown, ChevronLeft, ChevronRight as ChevronRightIcon, Pencil, StickyNote, PlusCircle, ArrowRightLeft, Archive, Trash2, Package, RotateCcw } from 'lucide-react'
import { ExcelExportButton } from '@/components/ui/excel-export-button'
import { exportToExcel, buildExcelFileName, type ExcelColumn } from '@/lib/excel-export'
import type { LucideIcon } from 'lucide-react'
import { useAlert } from '@/components/ui/custom-alert'
import { formatShortDate } from '@/lib/delivery-utils'
import { QuoteCreateDialog } from '@/components/quotes/quote-create-dialog'
import type { CustomerQuote } from '@/types/order'
import { saveCustomerQuote } from '@/lib/supabase/dal'

/** 'YYYY-MM' 형식 문자열을 'YYYY년 M월'로 변환 (파싱 실패 시 원본 반환) */
function formatYearMonth(ym: string): string {
  const parts = ym.split('-')
  const year = parts[0]
  const month = parts[1] ? parseInt(parts[1]) : NaN
  if (!year || isNaN(month)) return ym
  return `${year}년 ${month}월`
}

/** 작업종류 아이콘 매핑 */
const WORK_TYPE_ICON_MAP: Record<string, LucideIcon> = {
  '신규설치': PlusCircle,
  '이전설치': ArrowRightLeft,
  '철거보관': Archive,
  '철거폐기': Trash2,
  '재고설치': Package,
  '반납폐기': RotateCcw,
}

/** 탭 정의 */
type S1Tab = 'unsettled' | 'in-progress' | 'settled'

const TAB_CONFIG: { key: S1Tab; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'unsettled', label: '설치비 미정산', icon: <CircleDot className="h-4 w-4" />, color: 'text-gray-700' },
  { key: 'in-progress', label: '설치비 정산진행중', icon: <Clock className="h-4 w-4" />, color: 'text-carrot-600' },
  { key: 'settled', label: '설치비 정산완료', icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-olive-600' },
]

/** 탭 안내 문구 */
const TAB_DESCRIPTIONS: Record<S1Tab, string> = {
  'unsettled': '설치예정 및 설치완료된 현장 중 미정산 건이 표시됩니다. 일정미정 건은 제외됩니다.',
  'in-progress': '현재 정산 작업이 진행중인 건입니다. 확인이 끝나면 정산 완료 처리하세요.',
  'settled': '정산이 완료된 건입니다.',
}

/** 정산완료 월별 그룹 페이지 사이즈 */
const SETTLED_PAGE_SIZE = 10

/**
 * 정산완료 월별 그룹 컴포넌트
 *
 * - 최신 1개월만 기본 펼침, 나머지 접힘
 * - 펼친 상태에서 10개씩 페이지네이션
 * - 접힌 상태에서는 헤더(월/건수/합계)만 표시
 */
function SettledMonthGroup({
  monthKey,
  monthOrders,
  defaultOpen,
  selectedIds,
  setSelectedIds,
  expandedIds,
  onToggleExpand,
  onSaveSettlementMonth,
}: {
  monthKey: string
  monthOrders: Order[]
  defaultOpen: boolean
  selectedIds: Set<string>
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>
  expandedIds: Set<string>
  onToggleExpand: (orderId: string) => void
  onSaveSettlementMonth: (orderId: string, newMonth: string) => void
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [page, setPage] = useState(1)

  // 월 라벨 (예: "2026년 2월")
  const monthLabel = monthKey !== '미지정'
    ? formatYearMonth(monthKey)
    : '미지정'

  // 해당 월 설치비 합계
  const monthTotal = monthOrders.reduce((total, order) => {
    const items = order.customerQuote?.items?.filter(i => i.category === 'installation') || []
    const notesStr = order.customerQuote?.notes || ''
    const roundMatch = notesStr.match(/설치비절사:\s*([\d,]+)/)
    const rounding = roundMatch ? parseInt(roundMatch[1].replace(/,/g, '')) : 0
    return total + items.reduce((sum, i) => sum + i.totalPrice, 0) - rounding
  }, 0)

  // 페이지네이션 계산
  const totalPages = Math.max(1, Math.ceil(monthOrders.length / SETTLED_PAGE_SIZE))
  const pagedOrders = monthOrders.slice((page - 1) * SETTLED_PAGE_SIZE, page * SETTLED_PAGE_SIZE)

  return (
    <div>
      {/* 월별 헤더 (클릭하면 접기/펼치기) */}
      <button
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${
          isOpen ? 'bg-olive-50 border border-olive-200' : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
        }`}
        onClick={() => setIsOpen(prev => !prev)}
      >
        <div className="flex items-center gap-2">
          <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
          <h3 className="text-base font-bold text-slate-800">{monthLabel} 정산</h3>
          <span className="text-sm text-slate-500">({monthOrders.length}건)</span>
        </div>
        <span className="text-base font-extrabold text-slate-900">
          {monthTotal.toLocaleString('ko-KR')} 원
        </span>
      </button>

      {/* 펼침 시: 테이블 + 페이지네이션 */}
      {isOpen && (
        <div className="mt-2">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="p-3 text-center" style={{ width: '45px' }}>
                    <Checkbox
                      checked={pagedOrders.every(o => selectedIds.has(o.id))}
                      onCheckedChange={() => {
                        const allSelected = pagedOrders.every(o => selectedIds.has(o.id))
                        setSelectedIds(prev => {
                          const next = new Set(prev)
                          pagedOrders.forEach(o => {
                            if (allSelected) next.delete(o.id)
                            else next.add(o.id)
                          })
                          return next
                        })
                      }}
                    />
                  </th>
                  <th className="text-left p-3 text-xs text-slate-500 font-semibold" style={{ width: '110px' }}>작업종류</th>
                  <th className="text-left p-3 text-xs text-slate-500 font-semibold" style={{ width: '95px' }}>설치완료일</th>
                  <th className="text-center p-3 text-xs text-slate-500 font-semibold">현장명</th>
                  <th className="text-center p-3 text-xs text-slate-500 font-semibold" style={{ width: '200px' }}>주소</th>
                  <th className="text-center p-3 text-xs text-slate-500 font-semibold" style={{ width: '130px' }}>설치비 소계</th>
                  <th className="text-center p-3 text-xs text-slate-500 font-semibold" style={{ width: '110px' }}>정산</th>
                  <th className="text-center p-3 text-xs text-slate-500 font-semibold" style={{ width: '90px' }}>정산월</th>
                </tr>
              </thead>
              <tbody>
                {pagedOrders.map(order => {
                  const quote = order.customerQuote
                  const workTypes = sortWorkTypes(Array.from(new Set(order.items.map(i => i.workType))))
                  const installItems = quote?.items?.filter(i => i.category === 'installation') || []
                  const isExpanded = expandedIds.has(order.id)

                  return (
                    <React.Fragment key={order.id}>
                      <tr
                        className={`border-b border-slate-100 hover:bg-teal-50/40 transition-colors cursor-pointer ${isExpanded ? 'bg-olive-50/40' : ''}`}
                        onClick={() => onToggleExpand(order.id)}
                      >
                        <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(order.id)}
                            onCheckedChange={() => {
                              setSelectedIds(prev => {
                                const next = new Set(prev)
                                if (next.has(order.id)) next.delete(order.id)
                                else next.add(order.id)
                                return next
                              })
                            }}
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {workTypes.map(type => {
                              const Icon = WORK_TYPE_ICON_MAP[type]
                              return (
                                <span key={type} className={`inline-flex items-center gap-1 text-[11px] font-medium border rounded-md px-1.5 py-0.5 whitespace-nowrap ${getWorkTypeBadgeStyle(type).badge}`}>
                                  {Icon && <Icon className={`h-3 w-3 shrink-0 ${getWorkTypeBadgeStyle(type).icon}`} />}
                                  {type}
                                </span>
                              )
                            })}
                          </div>
                        </td>
                        <td className="p-3 text-sm">{formatShortDate(order.installCompleteDate)}</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            <p className="font-semibold text-sm truncate" title={order.businessName}>{order.businessName}</p>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <p className="text-xs text-slate-600 truncate" title={order.address}>{order.address}</p>
                        </td>
                        <td className="p-3 text-center">
                          <p className="text-sm font-semibold">
                            {(() => {
                              const items = quote?.items?.filter(i => i.category === 'installation') || []
                              const notesStr = quote?.notes || ''
                              const roundMatch = notesStr.match(/설치비절사:\s*([\d,]+)/)
                              const rounding = roundMatch ? parseInt(roundMatch[1].replace(/,/g, '')) : 0
                              const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0) - rounding
                              return subtotal > 0 ? `${subtotal.toLocaleString('ko-KR')}원` : <span className="text-slate-400">-</span>
                            })()}
                          </p>
                        </td>
                        <td className="p-3 text-center">
                          <Badge className={`${S1_SETTLEMENT_STATUS_COLORS['settled']} text-[10px] border`}>
                            {S1_SETTLEMENT_STATUS_LABELS['settled']}
                          </Badge>
                        </td>
                        <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                          <EditableMonthCell
                            currentMonth={order.s1SettlementMonth}
                            textColorClass="text-olive-700"
                            pencilColorClass="text-olive-400"
                            hoverBgClass="hover:bg-olive-50"
                            onSave={(newMonth) => onSaveSettlementMonth(order.id, newMonth)}
                          />
                        </td>
                      </tr>

                      {/* 아코디언: 설치비 견적서 */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="p-0">
                            <div className="mx-4 my-3">
                              <div className="border border-olive-200 rounded-xl overflow-hidden bg-white shadow-sm" style={{ width: '870px' }}>
                                <div className="flex items-center gap-2 px-3 py-2 bg-olive-600">
                                  <Receipt className="h-3.5 w-3.5 text-white" />
                                  <span className="text-xs font-bold text-white tracking-wide">설치비 견적서</span>
                                </div>
                                {(() => {
                                  const notesStr = quote?.notes || ''
                                  const roundMatch = notesStr.match(/설치비절사:\s*([\d,]+)/)
                                  const installRounding = roundMatch ? parseInt(roundMatch[1].replace(/,/g, '')) : 0
                                  const rawSubtotal = installItems.reduce((sum, i) => sum + i.totalPrice, 0)
                                  const finalSubtotal = rawSubtotal - installRounding

                                  return installItems.length > 0 ? (
                                    <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                                      <colgroup>
                                        <col style={{ width: '36px' }} />
                                        <col style={{ width: '140px' }} />
                                        <col style={{ width: '160px' }} />
                                        <col style={{ width: '50px' }} />
                                        <col style={{ width: '100px' }} />
                                        <col style={{ width: '100px' }} />
                                        <col style={{ width: '140px' }} />
                                      </colgroup>
                                      <thead>
                                        <tr className="bg-olive-50 border-b border-olive-200 text-olive-900">
                                          <th className="text-center py-2 px-2 font-semibold">No.</th>
                                          <th className="text-center py-2 px-2 font-semibold">품목</th>
                                          <th className="text-center py-2 px-2 font-semibold">규격</th>
                                          <th className="text-center py-2 px-2 font-semibold">수량</th>
                                          <th className="text-right py-2 px-2 font-semibold">단가</th>
                                          <th className="text-right py-2 px-2 font-semibold">금액</th>
                                          <th className="text-center py-2 px-2 font-semibold">비고</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {installItems.map((item, idx) => {
                                          const hasModel = item.itemName.includes('|||')
                                          const displayName = hasModel ? item.itemName.split('|||')[0] : item.itemName
                                          const displayModel = hasModel ? item.itemName.split('|||')[1] : '-'
                                          return (
                                            <tr key={item.id || idx} className="border-b border-slate-100 hover:bg-olive-50/30">
                                              <td className="py-2 px-2 text-center text-slate-400">{idx + 1}</td>
                                              <td className="py-2 px-2 text-center text-slate-800 font-medium truncate" title={displayName}>{displayName}</td>
                                              <td className="py-2 px-2 text-center text-slate-500 truncate" title={displayModel}>{displayModel}</td>
                                              <td className="py-2 px-2 text-center text-slate-600">{item.quantity}</td>
                                              <td className="py-2 px-2 text-right text-slate-600">{item.unitPrice.toLocaleString('ko-KR')}</td>
                                              <td className="py-2 px-2 text-right font-semibold text-slate-800">{item.totalPrice.toLocaleString('ko-KR')}</td>
                                              <td className="py-2 px-2 text-center text-slate-500 truncate" title={item.description || ''}>{item.description || ''}</td>
                                            </tr>
                                          )
                                        })}
                                      </tbody>
                                      <tfoot>
                                        {installRounding > 0 && (
                                          <tr className="border-t border-slate-200">
                                            <td colSpan={5} className="py-1.5 px-1.5 text-right text-slate-500">단위절사</td>
                                            <td className="py-1.5 px-1.5 text-right text-brick-500 font-medium">-{installRounding.toLocaleString('ko-KR')}</td>
                                            <td></td>
                                          </tr>
                                        )}
                                        <tr className="bg-olive-50 border-t border-olive-200">
                                          <td colSpan={5} className="py-2 px-1.5 text-right font-bold text-olive-800">설치비 소계</td>
                                          <td className="py-2 px-1.5 text-right font-bold text-olive-800">{finalSubtotal.toLocaleString('ko-KR')}</td>
                                          <td></td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  ) : (
                                    <div className="px-3 py-5 text-center">
                                      <p className="text-xs text-slate-400">견적서에 설치비 항목이 없습니다.</p>
                                    </div>
                                  )
                                })()}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 (10개 초과 시) */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 rounded-lg"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-slate-600">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 rounded-lg"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * 정산월 수정 가능한 셀 컴포넌트 (포탈 기반)
 * - 클릭하면 버튼 아래에 년/월 선택 드롭다운이 포탈로 렌더링
 * - overflow-hidden 컨테이너에서도 잘림 없이 표시
 */
function EditableMonthCell({
  currentMonth,
  fallbackLabel,
  textColorClass,
  pencilColorClass,
  hoverBgClass,
  onSave,
}: {
  currentMonth?: string
  fallbackLabel?: string
  textColorClass: string
  pencilColorClass: string
  hoverBgClass: string
  onSave: (newMonth: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const now = new Date()
  const parts = (currentMonth || '').split('-')
  const [year, setYear] = useState(parseInt(parts[0]) || now.getFullYear())
  const [month, setMonth] = useState(parseInt(parts[1]) || now.getMonth() + 1)

  // 열 때 현재 값으로 초기화 + 위치 계산
  const handleOpen = () => {
    const p = (currentMonth || '').split('-')
    setYear(parseInt(p[0]) || now.getFullYear())
    setMonth(parseInt(p[1]) || now.getMonth() + 1)
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left + rect.width / 2 })
    }
    setEditing(true)
  }

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!editing) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setEditing(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [editing])

  const displayLabel = currentMonth ? formatYearMonth(currentMonth) : (fallbackLabel || '-')

  return (
    <>
      <button
        ref={buttonRef}
        className={`inline-flex items-center gap-1 text-xs font-medium ${textColorClass} ${hoverBgClass} rounded px-1.5 py-0.5 transition-colors`}
        onClick={(e) => { e.stopPropagation(); handleOpen() }}
      >
        {displayLabel}
        <Pencil className={`h-2.5 w-2.5 ${pencilColorClass}`} />
      </button>
      {editing && createPortal(
        <div
          ref={dropdownRef}
          className="bg-white border border-slate-200 rounded-lg shadow-lg p-2 flex items-center gap-1.5 whitespace-nowrap"
          style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-50%)', zIndex: 9999 }}
          onClick={e => e.stopPropagation()}
        >
          <select
            className="text-xs border border-slate-300 rounded px-1 py-0.5 bg-white focus:outline-none"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <select
            className="text-xs border border-slate-300 rounded px-1 py-0.5 bg-white focus:outline-none"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>
          <button
            className="text-[10px] bg-carrot-500 text-white rounded-md px-2 py-0.5 hover:bg-carrot-600 font-medium"
            onClick={() => { onSave(`${year}-${String(month).padStart(2, '0')}`); setEditing(false) }}
          >
            확인
          </button>
          <button
            className="text-[10px] text-slate-400 hover:text-slate-600 px-1"
            onClick={() => setEditing(false)}
          >
            ✕
          </button>
        </div>,
        document.body
      )}
    </>
  )
}

/** 스켈레톤 로딩 UI */
function SettlementSkeleton() {
  return (
    <div className="space-y-6">
      {/* 통계 카드 스켈레톤 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <Skeleton className="h-4 w-20 mb-3" />
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      {/* 테이블 스켈레톤 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50/80 p-3">
          <Skeleton className="h-4 w-full" />
        </div>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-4 p-4 border-b border-slate-100">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-14" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function S1SettlementPage() {
  const { showAlert, showConfirm } = useAlert()

  // 데이터 로딩
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchOrders().then(data => {
      setOrders(data)
      setIsLoading(false)
    })
  }, [])

  // 현재 탭
  const [activeTab, setActiveTab] = useState<S1Tab>('unsettled')

  // 아코디언 펼침 상태 (어떤 현장이 펼쳐져 있는지)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // 견적서 수정 다이얼로그 상태
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false)
  const [orderForQuote, setOrderForQuote] = useState<Order | null>(null)

  // 메모는 order.installMemo 필드로 DB 연동 (로컬 상태 불필요)

  // 정산 월 (기본값: 현재 년월, 수동 변경 가능)
  const now = new Date()
  const [settlementYear, setSettlementYear] = useState(now.getFullYear())
  const [settlementMonth, setSettlementMonth] = useState(now.getMonth() + 1)
  const [isEditingMonth, setIsEditingMonth] = useState(false)

  // 비동기 액션 중복 실행 방지
  const [actionLoading, setActionLoading] = useState(false)

  // 체크박스 선택 상태
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())


  // 탭 변경 시 선택 초기화
  useEffect(() => {
    setSelectedIds(new Set())
  }, [activeTab])

  /**
   * 정산 대상 필터링 (설치예정 + 설치완료 건)
   * 일정미정(installScheduleDate 없음)은 아직 정산 대상이 아니므로 제외
   */
  const settlementTargetOrders = useMemo(() => {
    return orders.filter(order => order.status !== 'cancelled' && !!order.installScheduleDate)
  }, [orders])

  /** 일정미정 건수 (설치예정일이 없는 발주, 취소 건 제외) */
  const unscheduledCount = useMemo(() => {
    return orders.filter(order => order.status !== 'cancelled' && !order.installScheduleDate).length
  }, [orders])

  /** 탭별 필터링된 발주 목록 */
  const filteredOrders = useMemo(() => {
    return settlementTargetOrders.filter(order => {
      const status = order.s1SettlementStatus || 'unsettled'
      return status === activeTab
    })
  }, [settlementTargetOrders, activeTab])

  /** 정산 완료 탭: 월별 그룹핑 (예: { "2026-02": [order1, order2], "2026-01": [order3] }) */
  const settledByMonth = useMemo(() => {
    const settled = settlementTargetOrders.filter(o => (o.s1SettlementStatus || 'unsettled') === 'settled')
    const grouped: Record<string, Order[]> = {}
    settled.forEach(order => {
      const month = order.s1SettlementMonth || '미지정'
      if (!grouped[month]) grouped[month] = []
      grouped[month].push(order)
    })
    // 최신 월이 위로 오도록 정렬
    const sorted = Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]))
    return sorted
  }, [settlementTargetOrders])

  /** 탭별 건수 */
  const tabCounts = useMemo(() => {
    const counts: Record<S1Tab, number> = { 'unsettled': 0, 'in-progress': 0, 'settled': 0 }
    settlementTargetOrders.forEach(order => {
      const status = (order.s1SettlementStatus || 'unsettled') as S1Tab
      counts[status] = (counts[status] || 0) + 1
    })
    return counts
  }, [settlementTargetOrders])

  /** 아코디언 토글 (현장 클릭 시 설치비 상세 펼침/접기) */
  const handleToggleExpand = (orderId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }

  /** 견적서 수정하기 버튼 클릭 */
  const handleOpenQuote = (order: Order) => {
    setOrderForQuote(order)
    setQuoteDialogOpen(true)
  }

  /** 견적서 저장 후 로컬 상태 반영 */
  const handleQuoteSave = async (orderId: string, quote: CustomerQuote) => {
    await saveCustomerQuote(orderId, quote)
    setOrders(prev => prev.map(order =>
      order.id === orderId ? { ...order, customerQuote: quote } : order
    ))
  }

  /** 메모 변경 (order.installMemo로 DB 저장) */
  const handleMemoChange = async (orderId: string, text: string) => {
    // 로컬 상태 즉시 반영
    setOrders(prev => prev.map(order =>
      order.id === orderId ? { ...order, installMemo: text } : order
    ))
    // DB 저장
    await updateOrder(orderId, { installMemo: text })
  }

  /** 전체 선택/해제 */
  const handleSelectAll = () => {
    if (selectedIds.size === filteredOrders.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredOrders.map(o => o.id)))
    }
  }

  /** 개별 선택 토글 */
  const handleSelectToggle = (orderId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }

  /**
   * 일괄 상태 변경 (선택된 건들)
   * @param targetStatus - 변경할 상태
   */
  const handleBatchStatusChange = async (targetStatus: S1SettlementStatus) => {
    if (actionLoading) return
    const ids = Array.from(selectedIds)
    if (ids.length === 0) {
      showAlert('선택된 항목이 없습니다.', 'warning')
      return
    }

    const statusLabel = S1_SETTLEMENT_STATUS_LABELS[targetStatus]

    /** 정산 완료는 월별 마감 행위이므로 더 신중한 확인 메시지 */
    let confirmMessage: string
    if (targetStatus === 'settled') {
      // 선택된 현장들의 설치비 합계 계산
      const selectedTotal = orders
        .filter(o => ids.includes(o.id))
        .reduce((total, order) => {
          const items = order.customerQuote?.items?.filter(i => i.category === 'installation') || []
          const notesStr = order.customerQuote?.notes || ''
          const roundMatch = notesStr.match(/설치비절사:\s*([\d,]+)/)
          const rounding = roundMatch ? parseInt(roundMatch[1].replace(/,/g, '')) : 0
          return total + items.reduce((sum, i) => sum + i.totalPrice, 0) - rounding
        }, 0)
      confirmMessage = `⚠️ ${settlementYear}년 ${settlementMonth}월 정산 마감\n\n• 정산 현장: ${ids.length}건\n• ${settlementMonth}월 정산 합계: ${selectedTotal.toLocaleString('ko-KR')}원\n\n정산 완료 후에도 되돌릴 수 있지만, 월별 마감 기록으로 남습니다.\n\n정말 정산 완료 처리하시겠습니까?`
    } else {
      confirmMessage = `선택한 ${ids.length}건을 "${statusLabel}" 상태로 변경하시겠습니까?`
    }

    const confirmed = await showConfirm(confirmMessage)
    if (!confirmed) return

    setActionLoading(true)
    try {
      // DB 업데이트 (정산완료 시 화면에서 선택한 정산월 전달)
      const settMonth = `${settlementYear}-${String(settlementMonth).padStart(2, '0')}`
      const success = await batchUpdateS1SettlementStatus(ids, targetStatus, (targetStatus === 'settled' || targetStatus === 'in-progress') ? settMonth : undefined)
      if (success) {
        // UI 반영 (위에서 계산한 settMonth 사용)
        setOrders(prev => prev.map(order => {
          if (ids.includes(order.id)) {
            return {
              ...order,
              s1SettlementStatus: targetStatus,
              s1SettlementMonth: (targetStatus === 'settled' || targetStatus === 'in-progress') ? settMonth : order.s1SettlementMonth,
            }
          }
          return order
        }))
        setSelectedIds(new Set())
        showAlert(`${ids.length}건이 "${statusLabel}" 상태로 변경되었습니다.`, 'success')
      } else {
        showAlert('상태 변경에 실패했습니다.', 'error')
      }
    } finally {
      setActionLoading(false)
    }
  }

  /**
   * 개별 미정산으로 제외 (미정산으로)
   */
  const handleRevertToUnsettled = async (orderId: string, businessName: string) => {
    if (actionLoading) return
    const confirmed = await showConfirm(
      `"${businessName}" 건을 이번 달 정산에서 제외하고 미정산 목록으로 보내시겠습니까?`
    )
    if (!confirmed) return

    setActionLoading(true)
    try {
      const success = await updateS1SettlementStatus(orderId, 'unsettled')
      if (success) {
        setOrders(prev => prev.map(order => {
          if (order.id === orderId) {
            return { ...order, s1SettlementStatus: 'unsettled' as const, s1SettlementMonth: undefined }
          }
          return order
        }))
        showAlert('미정산 목록으로 제외되었습니다.', 'success')
      }
    } finally {
      setActionLoading(false)
    }
  }

  /** 정산월 개별 수정 저장 */
  const handleSaveSettlementMonth = async (orderId: string, newMonth: string) => {
    await updateOrder(orderId, { s1SettlementMonth: newMonth })
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, s1SettlementMonth: newMonth } : o
    ))
    showAlert('정산월이 변경되었습니다.', 'success')
  }

  /** 설치비 소계 계산 헬퍼 */
  const calcInstallSubtotal = (order: Order): number => {
    const items = order.customerQuote?.items?.filter(i => i.category === 'installation') || []
    const notesStr = order.customerQuote?.notes || ''
    const roundMatch = notesStr.match(/설치비절사:\s*([\d,]+)/)
    const rounding = roundMatch ? parseInt(roundMatch[1].replace(/,/g, '')) : 0
    return items.reduce((sum, i) => sum + i.totalPrice, 0) - rounding
  }

  /** 엑셀 다운로드 */
  const handleExcelExport = () => {
    const tabLabel = TAB_CONFIG.find(t => t.key === activeTab)?.label || activeTab
    // 정산완료 탭은 모든 월별 그룹 합침
    const dataToExport = activeTab === 'settled'
      ? settledByMonth.flatMap(([, orders]) => orders)
      : filteredOrders
    const columns: ExcelColumn<Order>[] = [
      { header: '문서번호', key: 'documentNumber', width: 16 },
      { header: '계열사', key: 'affiliate', width: 14 },
      { header: '사업자명', key: 'businessName', width: 20 },
      { header: '주소', key: 'address', width: 30 },
      { header: '작업종류', getValue: (o) => o.items.map(i => i.workType).join(', '), width: 18 },
      { header: '설치완료일', key: 'installCompleteDate', width: 12 },
      { header: '설치비소계', getValue: (o) => calcInstallSubtotal(o) || null, width: 14, numberFormat: '#,##0' },
      { header: '정산상태', getValue: (o) => S1_SETTLEMENT_STATUS_LABELS[o.s1SettlementStatus || 'unsettled'], width: 12 },
      { header: '정산월', key: 's1SettlementMonth', width: 10 },
    ]
    exportToExcel({
      data: dataToExport,
      columns,
      fileName: buildExcelFileName('에스원정산', tabLabel),
      sheetName: tabLabel,
    })
  }

  return (
    <div className="container mx-auto max-w-[1400px] py-6 px-4 md:px-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-teal-50 text-teal-600 p-2.5 rounded-xl">
          <Receipt className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">에스원 정산관리</h1>
          <p className="text-muted-foreground mt-0.5">멜레아와 에스원(설치팀) 간 월별 설치비 정산을 관리합니다.</p>
        </div>
        <ExcelExportButton onClick={handleExcelExport} disabled={filteredOrders.length === 0 && activeTab !== 'settled'} />
      </div>

      {/* 탭 (border-b 스타일) */}
      <div className="border-b border-slate-200 mb-4">
        <div className="flex items-center gap-1 -mb-px">
          {TAB_CONFIG.map(tab => {
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                className={active
                  ? "border-b-2 border-teal-500 text-teal-600 font-semibold pb-3 px-4 text-sm flex items-center gap-2"
                  : "text-slate-500 hover:text-slate-700 pb-3 px-4 text-sm flex items-center gap-2"
                }
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.icon}
                {tab.label}
                <span className={`ml-1.5 px-2 py-0.5 rounded-full text-xs ${active ? 'bg-teal-100 text-teal-600' : 'bg-slate-100 text-slate-500'}`}>
                  {tabCounts[tab.key]}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 탭 안내 문구 */}
      {activeTab === 'in-progress' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6 space-y-1.5">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            {/* 정산 월 뱃지 (클릭하면 수정 모드) */}
            {isEditingMonth ? (
              <span className="inline-flex items-center gap-1.5 bg-carrot-100 border border-carrot-300 rounded-lg px-2 py-1">
                <Clock className="h-3.5 w-3.5 text-carrot-600" />
                <select
                  className="bg-transparent text-carrot-800 font-bold text-sm focus:outline-none cursor-pointer"
                  value={settlementYear}
                  onChange={(e) => setSettlementYear(Number(e.target.value))}
                >
                  {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                    <option key={y} value={y}>{y}년</option>
                  ))}
                </select>
                <select
                  className="bg-transparent text-carrot-800 font-bold text-sm focus:outline-none cursor-pointer"
                  value={settlementMonth}
                  onChange={(e) => setSettlementMonth(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{m}월</option>
                  ))}
                </select>
                <span className="text-carrot-800 font-bold text-sm">정산</span>
                <button
                  className="ml-1 text-[10px] bg-carrot-500 text-white rounded-lg px-1.5 py-0.5 hover:bg-carrot-600"
                  onClick={() => setIsEditingMonth(false)}
                >
                  확인
                </button>
              </span>
            ) : (
              <button
                className="inline-flex items-center gap-1.5 bg-carrot-100 border border-carrot-300 text-carrot-800 font-bold px-3 py-1 rounded-lg hover:bg-carrot-200 transition-colors"
                onClick={() => setIsEditingMonth(true)}
                title="클릭하여 정산 월 변경"
              >
                <Clock className="h-3.5 w-3.5" />
                {settlementYear}년 {settlementMonth}월 정산
                <Pencil className="h-3 w-3 ml-1 text-carrot-500" />
              </button>
            )}
            <ArrowRight className="h-4 w-4 text-carrot-400" />
            <span className="text-slate-600">이번달 정산 예정중인 현장입니다.</span>
          </div>
          <p className="text-xs text-slate-400 ml-1">멜레아에서 정산이 완료되면 정산 완료 페이지로 처리하세요. (정산 월은 현재 날짜 기준 자동 반영, 클릭하여 변경 가능)</p>
        </div>
      ) : (
        <div className="mb-4">
          <p className="text-sm text-slate-500 mb-2">{TAB_DESCRIPTIONS[activeTab]}</p>
          {/* 미정산 탭: 일정미정 제외 건수 + 재촉 안내 */}
          {activeTab === 'unsettled' && unscheduledCount > 0 && (
            <div className="bg-white rounded-xl border border-gold-200 shadow-sm p-4">
              <p className="text-sm text-gold-700">
                설치일정이 잡히지 않은 <span className="font-bold">{unscheduledCount}건</span>이 제외되었습니다.
              </p>
              <p className="text-xs text-gold-600 mt-0.5">
                설치일정을 확정해주세요.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 액션 버튼 (미정산/진행중 탭에서만) */}
      {activeTab === 'unsettled' && (
        <div className="flex items-center gap-3 mb-4">
          <Button
            onClick={() => handleBatchStatusChange('in-progress')}
            disabled={selectedIds.size === 0 || actionLoading}
            className="bg-carrot-600 hover:bg-carrot-700 rounded-lg"
          >
            <ArrowRight className="h-4 w-4 mr-1" />
            정산 진행중으로 이동 ({selectedIds.size}건)
          </Button>
        </div>
      )}
      {activeTab === 'in-progress' && (
        <div className="flex items-center gap-3 mb-4">
          <Button
            onClick={() => handleBatchStatusChange('settled')}
            disabled={selectedIds.size === 0 || actionLoading}
            className="bg-olive-600 hover:bg-olive-700 rounded-lg"
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            정산 완료 처리 ({selectedIds.size}건)
          </Button>
        </div>
      )}
      {activeTab === 'settled' && (
        <div className="flex items-center gap-3 mb-4">
          <Button
            onClick={() => handleBatchStatusChange('in-progress')}
            disabled={selectedIds.size === 0 || actionLoading}
            variant="outline"
            className="rounded-lg"
          >
            <Undo2 className="h-4 w-4 mr-1" />
            정산 진행중으로 되돌리기 ({selectedIds.size}건)
          </Button>
        </div>
      )}

      {/* 로딩 상태: 스켈레톤 UI */}
      {isLoading && <SettlementSkeleton />}

      {/* ============================================ */}
      {/* 정산 완료 탭: 월별 그룹 UI (접기/펼치기 + 페이지네이션) */}
      {/* ============================================ */}
      {activeTab === 'settled' && !isLoading && (
        settledByMonth.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="py-16 text-center">
              <Receipt className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="text-slate-500 text-lg">정산 완료 건이 없습니다.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {settledByMonth.map(([monthKey, monthOrders], groupIdx) => (
              <SettledMonthGroup
                key={monthKey}
                monthKey={monthKey}
                monthOrders={monthOrders}
                defaultOpen={groupIdx === 0}
                selectedIds={selectedIds}
                setSelectedIds={setSelectedIds}
                expandedIds={expandedIds}
                onToggleExpand={handleToggleExpand}
                onSaveSettlementMonth={handleSaveSettlementMonth}
              />
            ))}
          </div>
        )
      )}

      {/* ============================================ */}
      {/* 미정산 / 금월 정산 진행중 탭: 기존 테이블 */}
      {/* ============================================ */}
      {activeTab !== 'settled' && !isLoading && (filteredOrders.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="py-16 text-center">
            <Receipt className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500 text-lg">{S1_SETTLEMENT_STATUS_LABELS[activeTab]} 건이 없습니다.</p>
          </div>
        </div>
      ) : (
        <>
          {/* 결과 건수 */}
          <p className="text-sm text-slate-500 mb-3">총 {filteredOrders.length}건</p>

          {/* 데스크톱 테이블 */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full" style={{ tableLayout: 'fixed' }}>
              <thead className="bg-slate-50/80">
                <tr>
                  {/* 체크박스 */}
                  {true && (
                    <th className="p-3 text-center" style={{ width: '40px' }}>
                      <Checkbox
                        checked={selectedIds.size === filteredOrders.length && filteredOrders.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                  )}
                  <th className="text-left p-3 text-xs text-slate-500 font-semibold" style={{ width: '100px' }}>작업종류</th>
                  <th className="text-left p-3 text-xs text-slate-500 font-semibold whitespace-nowrap" style={{ width: '72px' }}>설치상태</th>
                  <th className="text-left p-3 text-xs text-slate-500 font-semibold" style={{ width: '88px' }}>설치완료일</th>
                  <th className="text-center p-3 text-xs text-slate-500 font-semibold" style={{ width: '200px' }}>현장명</th>
                  <th className="text-center p-3 text-xs text-slate-500 font-semibold" style={{ width: '240px' }}>주소</th>
                  <th className="text-center p-3 text-xs text-slate-500 font-semibold" style={{ width: '105px' }}>설치비 소계</th>
                  <th className="text-center p-3 text-xs text-slate-500 font-semibold whitespace-nowrap" style={{ width: '78px' }}>정산</th>
                  {/* 진행중 탭: 정산월 */}
                  {activeTab === 'in-progress' && (
                    <th className="text-center p-3 text-xs text-slate-500 font-semibold whitespace-nowrap" style={{ width: '100px' }}>정산월</th>
                  )}
                  {/* 진행중 탭: 미정산으로 제외 버튼 */}
                  {activeTab === 'in-progress' && (
                    <th className="text-center p-3 text-xs text-slate-500 font-semibold" style={{ width: '125px' }}></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(order => {
                  const s1Status = order.s1SettlementStatus || 'unsettled'
                  const quote = order.customerQuote
                  const installItems = quote?.items?.filter(i => i.category === 'installation') || []
                  const isExpanded = expandedIds.has(order.id)
                  const workTypes = sortWorkTypes(Array.from(new Set(order.items.map(i => i.workType))))

                  {/* 테이블 컬럼 수 (아코디언 colspan용) */}
                  const colCount = 1 + 7 + (activeTab === 'in-progress' ? 2 : 0)

                  return (
                    <React.Fragment key={order.id}>
                      {/* 현장 행 (클릭하면 아코디언 열림) */}
                      <tr
                        className={`border-b border-slate-100 hover:bg-teal-50/40 transition-colors cursor-pointer ${isExpanded ? 'bg-slate-50/60' : ''}`}
                        onClick={() => handleToggleExpand(order.id)}
                      >
                        {/* 체크박스 */}
                        {true && (
                          <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(order.id)}
                              onCheckedChange={() => handleSelectToggle(order.id)}
                            />
                          </td>
                        )}

                        {/* 작업종류 뱃지 */}
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {workTypes.map(type => {
                              const Icon = WORK_TYPE_ICON_MAP[type]
                              return (
                                <span key={type} className={`inline-flex items-center gap-1 text-[11px] font-medium border rounded-md px-1.5 py-0.5 whitespace-nowrap ${getWorkTypeBadgeStyle(type).badge}`}>
                                  {Icon && <Icon className={`h-3 w-3 shrink-0 ${getWorkTypeBadgeStyle(type).icon}`} />}
                                  {type}
                                </span>
                              )
                            })}
                          </div>
                        </td>

                        {/* 설치상태 (도트 + 텍스트) */}
                        <td className="p-3 whitespace-nowrap">
                          {order.installCompleteDate ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-olive-700">
                              <span className="h-2 w-2 shrink-0 rounded-full bg-olive-500" />
                              설치완료
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700">
                              <span className="h-2 w-2 shrink-0 rounded-full bg-teal-500" />
                              설치예정
                            </span>
                          )}
                        </td>

                        {/* 설치완료일 */}
                        <td className="p-3">
                          <p className="text-sm">{formatShortDate(order.installCompleteDate)}</p>
                        </td>

                        {/* 현장명 + 펼침 아이콘 */}
                        <td className="p-3 text-center overflow-hidden">
                          <div className="flex items-center justify-center gap-1.5 min-w-0">
                            <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            <p className="font-semibold text-sm truncate" title={order.businessName}>{order.businessName}</p>
                          </div>
                        </td>

                        {/* 주소 */}
                        <td className="p-3 text-center overflow-hidden">
                          <p className="text-xs text-slate-600 truncate" title={order.address}>{order.address}</p>
                        </td>

                        {/* 설치비 소계 */}
                        <td className="p-3 text-center">
                          <p className="text-sm font-semibold">
                            {(() => {
                              const items = quote?.items?.filter(i => i.category === 'installation') || []
                              const notesStr = quote?.notes || ''
                              const roundMatch = notesStr.match(/설치비절사:\s*([\d,]+)/)
                              const rounding = roundMatch ? parseInt(roundMatch[1].replace(/,/g, '')) : 0
                              const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0) - rounding
                              return subtotal > 0
                                ? `${subtotal.toLocaleString('ko-KR')}원`
                                : <span className="text-slate-400">-</span>
                            })()}
                          </p>
                        </td>

                        {/* 정산 상태 뱃지 */}
                        <td className="p-3 text-center">
                          <Badge className={`${S1_SETTLEMENT_STATUS_COLORS[s1Status]} text-[10px] border`}>
                            {S1_SETTLEMENT_STATUS_LABELS[s1Status]}
                          </Badge>
                        </td>

                        {/* 진행중 탭: 정산월 (클릭하여 수정 가능) */}
                        {activeTab === 'in-progress' && (
                          <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                            <EditableMonthCell
                              currentMonth={order.s1SettlementMonth}
                              fallbackLabel={`${settlementYear}년 ${settlementMonth}월`}
                              textColorClass="text-carrot-700"
                              pencilColorClass="text-carrot-400"
                              hoverBgClass="hover:bg-carrot-50"
                              onSave={(newMonth) => handleSaveSettlementMonth(order.id, newMonth)}
                            />
                          </td>
                        )}

                        {/* 진행중 탭: 미정산으로 제외 버튼 */}
                        {activeTab === 'in-progress' && (
                          <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] text-slate-500 hover:text-slate-700 rounded-lg px-2"
                              onClick={() => handleRevertToUnsettled(order.id, order.businessName)}
                            >
                              <Undo2 className="h-3 w-3 mr-1" />
                              미정산으로 제외
                            </Button>
                          </td>
                        )}
                      </tr>

                      {/* 아코디언: 설치비 견적서(좌) + 메모(우) */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={colCount} className="p-0">
                            <div className="mx-4 my-3 flex gap-3">
                              {/* ===== 좌측: 설치비 견적서 ===== */}
                              <div className="flex-shrink-0 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm" style={{ width: '870px' }}>
                                {/* 견적서 헤더 + 수정 버튼 */}
                                <div className="flex items-center justify-between px-3 py-2 bg-slate-700">
                                  <div className="flex items-center gap-2">
                                    <Receipt className="h-3.5 w-3.5 text-white" />
                                    <span className="text-xs font-bold text-white tracking-wide">설치비 견적서</span>
                                  </div>
                                  <button
                                    className="flex items-center gap-1 text-[10px] font-medium text-white/90 hover:text-white bg-white/20 hover:bg-white/30 rounded-lg px-2 py-1 transition-colors"
                                    onClick={(e) => { e.stopPropagation(); handleOpenQuote(order) }}
                                  >
                                    <Pencil className="h-3 w-3" />
                                    견적서 수정
                                  </button>
                                </div>
                                {(() => {
                                  const notesStr = quote?.notes || ''
                                  const roundMatch = notesStr.match(/설치비절사:\s*([\d,]+)/)
                                  const installRounding = roundMatch ? parseInt(roundMatch[1].replace(/,/g, '')) : 0
                                  const rawSubtotal = installItems.reduce((sum, i) => sum + i.totalPrice, 0)
                                  const finalSubtotal = rawSubtotal - installRounding

                                  return installItems.length > 0 ? (
                                  <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                                    <colgroup>
                                      <col style={{ width: '36px' }} />
                                      <col style={{ width: '140px' }} />
                                      <col style={{ width: '160px' }} />
                                      <col style={{ width: '50px' }} />
                                      <col style={{ width: '100px' }} />
                                      <col style={{ width: '100px' }} />
                                      <col style={{ width: '140px' }} />
                                    </colgroup>
                                    <thead>
                                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                                        <th className="text-center py-2 px-2 font-semibold">No.</th>
                                        <th className="text-center py-2 px-2 font-semibold">품목</th>
                                        <th className="text-center py-2 px-2 font-semibold">규격</th>
                                        <th className="text-center py-2 px-2 font-semibold">수량</th>
                                        <th className="text-right py-2 px-2 font-semibold">단가</th>
                                        <th className="text-right py-2 px-2 font-semibold">금액</th>
                                        <th className="text-center py-2 px-2 font-semibold">비고</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {installItems.map((item, idx) => {
                                        const hasModel = item.itemName.includes('|||')
                                        const displayName = hasModel ? item.itemName.split('|||')[0] : item.itemName
                                        const displayModel = hasModel ? item.itemName.split('|||')[1] : '-'
                                        return (
                                        <tr key={item.id || idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                                          <td className="py-2 px-2 text-center text-slate-400">{idx + 1}</td>
                                          <td className="py-2 px-2 text-center text-slate-800 font-medium truncate" title={displayName}>{displayName}</td>
                                          <td className="py-2 px-2 text-center text-slate-500 truncate" title={displayModel}>{displayModel}</td>
                                          <td className="py-2 px-2 text-center text-slate-600">{item.quantity}</td>
                                          <td className="py-2 px-2 text-right text-slate-600">{item.unitPrice.toLocaleString('ko-KR')}</td>
                                          <td className="py-2 px-2 text-right font-semibold text-slate-800">{item.totalPrice.toLocaleString('ko-KR')}</td>
                                          <td className="py-2 px-2 text-center text-slate-500 truncate" title={item.description || ''}>{item.description || ''}</td>
                                        </tr>
                                        )
                                      })}
                                    </tbody>
                                    <tfoot>
                                      {installRounding > 0 && (
                                        <tr className="border-t border-slate-200">
                                          <td colSpan={5} className="py-1.5 px-1.5 text-right text-slate-500">단위절사</td>
                                          <td className="py-1.5 px-1.5 text-right text-brick-500 font-medium">-{installRounding.toLocaleString('ko-KR')}</td>
                                          <td></td>
                                        </tr>
                                      )}
                                      <tr className="bg-slate-50 border-t border-slate-200">
                                        <td colSpan={5} className="py-2 px-1.5 text-right font-bold text-slate-800">설치비 소계</td>
                                        <td className="py-2 px-1.5 text-right font-bold text-slate-800">
                                          {finalSubtotal.toLocaleString('ko-KR')}
                                        </td>
                                        <td></td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                ) : (
                                  <div className="px-3 py-5 text-center">
                                    <p className="text-xs text-slate-400">견적서에 설치비 항목이 없습니다.</p>
                                  </div>
                                )
                                })()}
                              </div>

                              {/* ===== 우측: 메모 영역 ===== */}
                              <div className="flex-1 min-w-[200px] border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col">
                                <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 border-b border-slate-200">
                                  <StickyNote className="h-3.5 w-3.5 text-slate-500" />
                                  <span className="text-xs font-bold text-slate-700 tracking-wide">메모</span>
                                </div>
                                <textarea
                                  className="flex-1 w-full p-3 text-sm text-slate-700 resize-none focus:outline-none placeholder:text-slate-300 bg-slate-50/30"
                                  placeholder="설치 팀장이 누구인지 등 기억해야 할 메모를 자유롭게 적어주세요"
                                  value={order.installMemo || ''}
                                  onChange={(e) => {
                                    // 로컬 상태만 즉시 반영 (타이핑 중)
                                    setOrders(prev => prev.map(o =>
                                      o.id === order.id ? { ...o, installMemo: e.target.value } : o
                                    ))
                                  }}
                                  onBlur={(e) => {
                                    // blur 시 DB 저장
                                    handleMemoChange(order.id, e.target.value)
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  rows={6}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* 금월 정산 진행중 탭: 정산 합계 */}
          {activeTab === 'in-progress' && filteredOrders.length > 0 && (
            <div className="hidden md:flex items-center justify-end gap-2 mt-4 px-1">
              <span className="text-base font-bold text-slate-600">정산 합계:</span>
              <span className="text-xl font-extrabold text-slate-900">
                {filteredOrders.reduce((total, order) => {
                  const items = order.customerQuote?.items?.filter(i => i.category === 'installation') || []
                  const notesStr = order.customerQuote?.notes || ''
                  const roundMatch = notesStr.match(/설치비절사:\s*([\d,]+)/)
                  const rounding = roundMatch ? parseInt(roundMatch[1].replace(/,/g, '')) : 0
                  return total + items.reduce((sum, i) => sum + i.totalPrice, 0) - rounding
                }, 0).toLocaleString('ko-KR')} 원
              </span>
            </div>
          )}

          {/* 모바일 카드 리스트 */}
          <div className="md:hidden space-y-3">
            {filteredOrders.map(order => {
              const s1Status = order.s1SettlementStatus || 'unsettled'
              const workTypes = sortWorkTypes(Array.from(new Set(order.items.map(i => i.workType))))
              const installItems = order.customerQuote?.items?.filter(i => i.category === 'installation') || []
              const isExpanded = expandedIds.has(order.id)

              return (
                <div key={order.id} className={`bg-white rounded-xl border overflow-hidden shadow-sm ${isExpanded ? 'border-slate-300' : 'border-slate-200'}`}>
                  {/* 카드 본문 (클릭하면 아코디언 토글) */}
                  <div
                    className="p-4 space-y-3 cursor-pointer"
                    onClick={() => handleToggleExpand(order.id)}
                  >
                    {/* 상단: 체크 + 작업종류 + 정산 뱃지 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {true && (
                          <div onClick={e => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(order.id)}
                              onCheckedChange={() => handleSelectToggle(order.id)}
                            />
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {workTypes.map(type => {
                            const Icon = WORK_TYPE_ICON_MAP[type]
                            return (
                              <span key={type} className={`inline-flex items-center gap-1 text-[11px] font-medium border rounded-md px-1.5 py-0.5 whitespace-nowrap ${getWorkTypeBadgeStyle(type).badge}`}>
                                {Icon && <Icon className={`h-3 w-3 shrink-0 ${getWorkTypeBadgeStyle(type).icon}`} />}
                                {type}
                              </span>
                            )
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${S1_SETTLEMENT_STATUS_COLORS[s1Status]} text-[10px] border`}>
                          {S1_SETTLEMENT_STATUS_LABELS[s1Status]}
                        </Badge>
                        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>

                    {/* 현장명 + 주소 */}
                    <div>
                      <h3 className="font-semibold text-sm">{order.businessName}</h3>
                      <p className="text-xs text-slate-500 mt-0.5 truncate" title={order.address}>{order.address}</p>
                    </div>

                    {/* 설치상태 + 날짜 + 설치비 */}
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        {order.installCompleteDate ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-olive-700">
                            <span className="h-2 w-2 shrink-0 rounded-full bg-olive-500" />
                            설치완료
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-teal-700">
                            <span className="h-2 w-2 shrink-0 rounded-full bg-teal-500" />
                            설치예정
                          </span>
                        )}
                        {order.installCompleteDate && <span>{formatShortDate(order.installCompleteDate)}</span>}
                      </div>
                      <span className="font-medium text-slate-700">
                        {order.installationCost?.totalAmount
                          ? `${order.installationCost.totalAmount.toLocaleString('ko-KR')}원`
                          : '-'
                        }
                      </span>
                    </div>

                    {/* 진행중 탭: 미정산으로 제외 */}
                    {activeTab === 'in-progress' && (
                      <div className="flex justify-end" onClick={e => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-slate-500 rounded-lg"
                          onClick={() => handleRevertToUnsettled(order.id, order.businessName)}
                        >
                          <Undo2 className="h-3 w-3 mr-1" />
                          미정산으로 제외
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* 아코디언: 설치비 상세 */}
                  {isExpanded && (
                    <div className="mx-3 mb-3 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                      {/* 견적서 헤더 */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-700">
                        <Receipt className="h-3.5 w-3.5 text-white" />
                        <span className="text-xs font-bold text-white tracking-wide">설치비 견적서</span>
                      </div>
                      {(() => {
                        const notesStr = order.customerQuote?.notes || ''
                        const roundMatch = notesStr.match(/설치비절사:\s*([\d,]+)/)
                        const installRounding = roundMatch ? parseInt(roundMatch[1].replace(/,/g, '')) : 0
                        const rawSubtotal = installItems.reduce((sum, i) => sum + i.totalPrice, 0)
                        const finalSubtotal = rawSubtotal - installRounding

                        return installItems.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                          {installItems.map((item, idx) => {
                            const hasModel = item.itemName.includes('|||')
                            const displayName = hasModel ? item.itemName.split('|||')[0] : item.itemName
                            const displayModel = hasModel ? item.itemName.split('|||')[1] : ''
                            return (
                            <div key={item.id || idx} className="flex items-center justify-between px-3 py-2.5">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-slate-400 bg-slate-100 rounded w-5 h-5 flex items-center justify-center">{idx + 1}</span>
                                  <p className="font-medium text-sm text-slate-800">{displayName}</p>
                                  {displayModel && <span className="text-xs text-slate-400">({displayModel})</span>}
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5 ml-7">{item.quantity}개 x {item.unitPrice.toLocaleString('ko-KR')}원</p>
                              </div>
                              <p className="font-semibold text-sm text-slate-800">{item.totalPrice.toLocaleString('ko-KR')}</p>
                            </div>
                            )
                          })}
                          {/* 단위절사 (값이 있을 때만) */}
                          {installRounding > 0 && (
                            <div className="flex items-center justify-between px-3 py-2 bg-slate-50">
                              <span className="text-xs text-slate-500">단위절사</span>
                              <span className="text-sm text-brick-500 font-medium">-{installRounding.toLocaleString('ko-KR')}</span>
                            </div>
                          )}
                          {/* 소계 */}
                          <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50">
                            <span className="text-sm font-bold text-slate-800">설치비 소계</span>
                            <span className="text-sm font-bold text-slate-800">{finalSubtotal.toLocaleString('ko-KR')}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="px-3 py-6 text-center">
                          <p className="text-xs text-slate-400">견적서에 설치비 항목이 없습니다.</p>
                        </div>
                      )
                      })()}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      ))}
      {/* 견적서 수정 다이얼로그 */}
      <QuoteCreateDialog
        order={orderForQuote}
        open={quoteDialogOpen}
        onOpenChange={setQuoteDialogOpen}
        onSave={handleQuoteSave}
      />
    </div>
  )
}
