/**
 * 철거보관 장비 테이블 컴포넌트
 *
 * 데스크톱: 같은 현장 장비를 rowSpan으로 그룹핑 (실내기+실외기 한눈에)
 * 모바일: 현장별 카드 (구성품 리스트)
 *
 * 보관중 탭: 수정/출고/삭제 액션
 * 출고완료 탭: 출고 정보 + 되돌리기
 */

'use client'

import { useState, useMemo, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  ArrowDown,
  ArrowUp,
  Edit2,
  FileText,
  LogOut,
  MapPin,
  MoreVertical,
  Package,
  Trash2,
  Undo2,
  Warehouse as WarehouseIcon,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { StoredEquipment, StoredEquipmentStatus, ReleaseType, Order } from '@/types/order'
import {
  RELEASE_TYPE_LABELS,
  RELEASE_TYPE_COLORS,
  EQUIPMENT_UNIT_TYPE_LABELS,
  EQUIPMENT_UNIT_TYPE_COLORS,
} from '@/types/order'
import type { Warehouse } from '@/types/warehouse'
import { OrderDetailDialog } from '@/components/orders/order-detail-dialog'
import { useAlert } from '@/components/ui/custom-alert'

/** 날짜를 짧게 표시 */
function formatDate(date?: string): string {
  if (!date) return '-'
  const parts = date.split('-')
  if (parts.length !== 3) return date
  return `${parts[0]}.${parts[1]}.${parts[2]}`
}

// ─── 정렬 타입 ───

/** 정렬 기준 */
type SortField = 'removalDate' | 'manufacturingDate' | 'releaseDate'
/** 정렬 방향: asc = 오래된순(↑), desc = 최신순(↓) */
type SortDir = 'asc' | 'desc'

// ─── 현장별 그룹핑 유틸 ───

interface SiteGroup {
  key: string
  items: StoredEquipment[]
}

/** 같은 현장+창고 장비를 그룹으로 묶기 + 정렬 기준 적용 */
function groupBySite(items: StoredEquipment[], sortField: SortField, sortDir: SortDir): SiteGroup[] {
  const typeOrder: Record<string, number> = { indoor: 0, outdoor: 1, set: 2, etc: 3 }

  // 1단계: 그룹핑
  const groupMap = new Map<string, StoredEquipment[]>()
  for (const item of items) {
    const key = `${item.siteName}__${item.warehouseId || ''}`
    const arr = groupMap.get(key) || []
    arr.push(item)
    groupMap.set(key, arr)
  }

  // 2단계: 그룹 내부는 실내기→실외기 순서
  const groups: SiteGroup[] = []
  for (const [key, groupItems] of Array.from(groupMap)) {
    groupItems.sort((a, b) =>
      (typeOrder[a.equipmentUnitType || ''] ?? 9) - (typeOrder[b.equipmentUnitType || ''] ?? 9)
    )
    groups.push({ key, items: groupItems })
  }

  // 3단계: 선택된 기준으로 그룹 간 정렬 (빈 값은 항상 맨 뒤)
  groups.sort((a, b) => {
    const valA = a.items[0]?.[sortField] || ''
    const valB = b.items[0]?.[sortField] || ''
    if (!valA && !valB) return 0
    if (!valA) return 1
    if (!valB) return -1
    const cmp = valA.localeCompare(valB)
    return sortDir === 'asc' ? cmp : -cmp
  })

  return groups
}

interface StoredEquipmentTableProps {
  items: StoredEquipment[]
  activeTab: StoredEquipmentStatus
  warehouses: Warehouse[]
  orders: Order[]
  onEdit: (item: StoredEquipment) => void
  onRelease: (item: StoredEquipment) => void
  onDelete: (id: string) => void
  onRevertRelease: (id: string) => void
  readOnly?: boolean
}

export function StoredEquipmentTable({
  items,
  activeTab,
  warehouses,
  orders,
  onEdit,
  onRelease,
  onDelete,
  onRevertRelease,
  readOnly = false,
}: StoredEquipmentTableProps) {
  const { showAlert } = useAlert()

  /** 정렬 상태: 보관중은 철거일 최신순, 출고완료는 출고일 최신순 */
  const [sortField, setSortField] = useState<SortField>(activeTab === 'released' ? 'releaseDate' : 'removalDate')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // 탭 전환 시 정렬 기준 자동 변경
  useEffect(() => {
    if (activeTab === 'released') {
      setSortField('releaseDate')
      setSortDir('desc')
    } else {
      setSortField('removalDate')
      setSortDir('desc')
    }
  }, [activeTab])

  /** 헤더 클릭 시 정렬 전환 */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // 같은 컬럼 다시 클릭 → 방향 토글
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      // 다른 컬럼 클릭 → 해당 컬럼의 기본 방향
      setSortField(field)
      setSortDir(field === 'removalDate' ? 'desc' : 'asc')
    }
  }

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; siteName: string } | null>(null)
  const [revertTarget, setRevertTarget] = useState<{ id: string; siteName: string } | null>(null)

  /** 삭제 확인 → onDelete 호출 후 다이얼로그 닫기 */
  const handleConfirmDelete = () => {
    if (!deleteTarget) return
    const targetId = deleteTarget.id
    setDeleteTarget(null)
    onDelete(targetId)
  }

  /** 되돌리기 확인 → onRevertRelease 호출 후 다이얼로그 닫기 */
  const handleConfirmRevert = () => {
    if (!revertTarget) return
    const targetId = revertTarget.id
    setRevertTarget(null)
    onRevertRelease(targetId)
  }
  const [orderDetailOpen, setOrderDetailOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  /** 창고 정보 */
  const getWarehouse = (warehouseId?: string): Warehouse | null => {
    if (!warehouseId) return null
    return warehouses.find(w => w.id === warehouseId) || null
  }

  /** 발주 정보 */
  const getOrder = (orderId?: string): Order | null => {
    if (!orderId) return null
    return orders.find(o => o.id === orderId) || null
  }

  /** 발주서 보기 */
  const handleViewOrder = (orderId?: string) => {
    if (!orderId) {
      showAlert('수동 등록된 장비로 연결된 발주서가 없습니다.', 'info')
      return
    }
    const order = getOrder(orderId)
    if (!order) {
      showAlert('발주서를 찾을 수 없습니다.', 'error')
      return
    }
    setSelectedOrder(order)
    setOrderDetailOpen(true)
  }

  // ─── 현장별 그룹핑 ───
  const groups = useMemo(() => groupBySite(items, sortField, sortDir), [items, sortField, sortDir])

  // ─── 빈 목록 ───
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        {activeTab === 'stored' ? (
          <>
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Package className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-base font-medium text-slate-500">보관중인 장비가 없습니다</p>
            <p className="text-sm text-slate-400 mt-1">장비를 등록하면 여기에 표시됩니다</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl bg-olive-50 flex items-center justify-center mb-4">
              <LogOut className="h-8 w-8 text-olive-300" />
            </div>
            <p className="text-base font-medium text-slate-500">출고 완료된 장비가 없습니다</p>
            <p className="text-sm text-slate-400 mt-1">보관중인 장비를 출고하면 여기에 표시됩니다</p>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      {/* ═══ 정렬 컨트롤 바 — 탭별로 다른 정렬 옵션 ═══ */}
      <div className="flex items-center gap-2 mb-2.5 px-0.5">
        <span className="text-[11px] text-slate-400 font-medium">정렬 기준</span>
        {activeTab === 'released' ? (
          /* 출고완료 탭: 출고일 정렬만 */
          <button
            type="button"
            onClick={() => handleSort('releaseDate')}
            className="inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-all bg-olive-50 border-olive-300 text-olive-600 shadow-sm shadow-olive-100"
          >
            출고일
            {sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
            <span className="text-[10px] font-normal opacity-70">{sortDir === 'desc' ? '최신순' : '오래된순'}</span>
          </button>
        ) : (
          /* 보관중 탭: 철거일 / 제조년월 정렬 */
          <>
            <button
              type="button"
              onClick={() => handleSort('removalDate')}
              className={`inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                sortField === 'removalDate'
                  ? 'bg-brick-50 border-brick-300 text-brick-600 shadow-sm shadow-brick-100'
                  : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'
              }`}
            >
              철거일
              {sortField === 'removalDate' && (
                <>
                  {sortDir === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
                  <span className="text-[10px] font-normal opacity-70">{sortDir === 'desc' ? '최신순' : '오래된순'}</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => handleSort('manufacturingDate')}
              className={`inline-flex items-center gap-1 text-[12px] font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                sortField === 'manufacturingDate'
                  ? 'bg-teal-50 border-teal-300 text-teal-600 shadow-sm shadow-teal-100'
                  : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'
              }`}
            >
              제조년월
              {sortField === 'manufacturingDate' && (
                <>
                  {sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
                  <span className="text-[10px] font-normal opacity-70">{sortDir === 'asc' ? '오래된순' : '최신순'}</span>
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* ═══ 데스크톱 테이블 (md 이상) — 현장별 rowSpan 그룹핑 ═══ */}
      <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden shadow-sm overflow-x-auto">
        <table className="w-full" style={{ minWidth: activeTab === 'released' ? '800px' : '850px' }}>
          <thead>
            {activeTab === 'released' ? (
              /* ── 출고완료 탭 헤더: 설치현장 → 출고일 → 출고유형 → 철거장소 → ... ── */
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-2 py-2 font-semibold text-[11px] text-slate-500 tracking-wider whitespace-nowrap" style={{ width: '160px' }}>설치 현장</th>
                <th className="text-center px-2 py-2 font-semibold text-[11px] text-slate-500 tracking-wider whitespace-nowrap" style={{ width: '82px' }}>출고일</th>
                <th className="text-center px-2 py-2 font-semibold text-[11px] text-slate-500 tracking-wider whitespace-nowrap" style={{ width: '64px' }}>출고유형</th>
                <th className="text-left px-2 py-2 font-semibold text-[11px] text-slate-500 tracking-wider whitespace-nowrap" style={{ width: '120px' }}>철거된 장소</th>
                <th className="text-center px-2 py-2 font-semibold text-[11px] text-slate-500 tracking-wider whitespace-nowrap" style={{ width: '54px' }}>유형</th>
                <th className="text-center px-2 py-2 font-semibold text-[11px] text-slate-500 tracking-wider whitespace-nowrap" style={{ width: '140px' }}>모델명</th>
                <th className="text-center px-2 py-2 font-semibold text-[11px] text-slate-500 tracking-wider whitespace-nowrap" style={{ width: '48px' }}>평형</th>
                <th className="text-center px-2 py-2 font-semibold text-[11px] text-slate-500 tracking-wider whitespace-nowrap" style={{ width: '38px' }}>수량</th>
                {!readOnly && (
                  <th className="text-center px-1 py-2 font-semibold text-[11px] text-slate-500 tracking-wider whitespace-nowrap" style={{ width: '76px' }}></th>
                )}
              </tr>
            ) : (
              /* ── 보관중 탭 헤더 ── */
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-2 py-2 font-semibold text-[11px] text-slate-500 tracking-wider whitespace-nowrap" style={{ width: '130px' }}>철거된 장소</th>
                <th
                  className="text-center px-2 py-2 font-semibold text-[11px] tracking-wider whitespace-nowrap cursor-pointer select-none group/th"
                  style={{ width: '78px' }}
                  onClick={() => handleSort('removalDate')}
                >
                  <span className={`inline-flex items-center gap-0.5 transition-colors ${sortField === 'removalDate' ? 'text-brick-600' : 'text-slate-500 group-hover/th:text-slate-700'}`}>
                    철거일
                    {sortField === 'removalDate' ? (
                      sortDir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowDown className="h-3 w-3 opacity-0 group-hover/th:opacity-40 transition-opacity" />
                    )}
                  </span>
                </th>
                <th
                  className="text-center px-2 py-2 font-semibold text-[11px] tracking-wider whitespace-nowrap cursor-pointer select-none group/th2"
                  style={{ width: '74px' }}
                  onClick={() => handleSort('manufacturingDate')}
                >
                  <span className={`inline-flex items-center gap-0.5 transition-colors ${sortField === 'manufacturingDate' ? 'text-teal-600' : 'text-slate-500 group-hover/th2:text-slate-700'}`}>
                    제조년월
                    {sortField === 'manufacturingDate' ? (
                      sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                    ) : (
                      <ArrowUp className="h-3 w-3 opacity-0 group-hover/th2:opacity-40 transition-opacity" />
                    )}
                  </span>
                </th>
                <th className="text-center px-2 py-2 font-semibold text-[11px] text-slate-500 tracking-wider whitespace-nowrap" style={{ width: '54px' }}>유형</th>
                <th className="text-center px-2 py-2 font-semibold text-[11px] text-slate-500 tracking-wider whitespace-nowrap" style={{ width: '150px' }}>모델명</th>
                <th className="text-center px-2 py-2 font-semibold text-[11px] text-slate-500 tracking-wider whitespace-nowrap" style={{ width: '48px' }}>평형</th>
                <th className="text-center px-2 py-2 font-semibold text-[11px] text-slate-500 tracking-wider whitespace-nowrap" style={{ width: '38px' }}>수량</th>
                <th className="text-center px-2 py-2 font-semibold text-[11px] text-slate-500 tracking-wider whitespace-nowrap" style={{ width: '120px' }}>설치예정</th>
                <th className="text-center px-2 py-2 font-semibold text-[11px] text-slate-500 tracking-wider whitespace-nowrap" style={{ width: '50px' }}>제조사</th>
                <th className="text-center px-2 py-2 font-semibold text-[11px] text-slate-500 tracking-wider whitespace-nowrap" style={{ width: '48px' }}>발주서</th>
                <th className="text-left px-2 py-2 font-semibold text-[11px] text-slate-500 tracking-wider whitespace-nowrap" style={{ width: '140px' }}>보관 창고</th>
                {!readOnly && (
                  <th className="text-center px-1 py-2 font-semibold text-[11px] text-slate-500 tracking-wider" style={{ width: '32px' }}></th>
                )}
              </tr>
            )}
          </thead>
          <tbody>
            {groups.map((group, gIdx) =>
              group.items.map((item, iIdx) => {
                const isFirst = iIdx === 0
                const groupSize = group.items.length
                const isGrouped = groupSize > 1
                const bgColor = gIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors hover:bg-teal-50/30 ${bgColor} ${
                      isFirst && gIdx > 0 ? 'border-t-[2px] border-t-slate-200' : isFirst ? '' : 'border-t border-t-slate-100/50'
                    }`}
                  >
                    {activeTab === 'released' ? (
                      /* ═══ 출고완료 탭: 설치현장 → 출고일 → 출고유형 → 철거장소 → ... ═══ */
                      <>
                        {/* ── 설치 현장 + 주소 [MERGED] ── */}
                        {isFirst && (
                          <td
                            rowSpan={groupSize}
                            className={`px-2 py-1.5 align-top ${bgColor}`}
                            style={{ borderLeft: '3px solid #22c55e' }}
                          >
                            {(() => {
                              let relSiteName = item.releaseDestination || ''
                              let relAddress = item.releaseAddress || ''
                              if (!relAddress && relSiteName.includes(' (') && relSiteName.endsWith(')')) {
                                const splitIdx = relSiteName.indexOf(' (')
                                relAddress = relSiteName.slice(splitIdx + 2, -1)
                                relSiteName = relSiteName.slice(0, splitIdx)
                              }
                              return (
                                <>
                                  <p className="text-xs font-bold text-slate-800 truncate" title={relSiteName}>{relSiteName || '-'}</p>
                                  {relAddress && (
                                    <p className="text-[10px] text-slate-400 truncate mt-0.5" title={relAddress}>{relAddress}</p>
                                  )}
                                </>
                              )
                            })()}
                          </td>
                        )}

                        {/* ── 출고일 [MERGED] ── */}
                        {isFirst && (
                          <td rowSpan={groupSize} className={`px-1.5 py-1.5 text-center align-top ${bgColor}`}>
                            <span className="text-[11px] text-slate-700 font-bold tabular-nums">{formatDate(item.releaseDate)}</span>
                          </td>
                        )}

                        {/* ── 출고유형 [MERGED] ── */}
                        {isFirst && (
                          <td rowSpan={groupSize} className={`px-1.5 py-1.5 text-center align-top ${bgColor}`}>
                            {item.releaseType ? (
                              <Badge className={`${RELEASE_TYPE_COLORS[item.releaseType as ReleaseType]} text-[10px] font-medium`}>
                                {RELEASE_TYPE_LABELS[item.releaseType as ReleaseType]}
                              </Badge>
                            ) : '-'}
                          </td>
                        )}

                        {/* ── 철거된 장소 [MERGED] ── */}
                        {isFirst && (
                          <td rowSpan={groupSize} className={`px-2 py-1.5 align-top ${bgColor}`}>
                            {item.affiliate && (
                              <p className="text-[10px] text-slate-400 font-medium leading-tight">{item.affiliate}</p>
                            )}
                            <p className="text-xs font-medium text-slate-600 truncate" title={item.siteName}>{item.siteName}</p>
                          </td>
                        )}

                        {/* ── 유형 [INDIVIDUAL] ── */}
                        <td className="px-1 py-1.5 text-center">
                          {item.equipmentUnitType ? (
                            <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border leading-tight ${EQUIPMENT_UNIT_TYPE_COLORS[item.equipmentUnitType]}`}>
                              {EQUIPMENT_UNIT_TYPE_LABELS[item.equipmentUnitType]}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-300">-</span>
                          )}
                        </td>

                        {/* ── 모델명 + 제조년월 [INDIVIDUAL] ── */}
                        <td className="px-2 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <p className="text-xs text-slate-800 font-semibold font-mono truncate" title={item.model || '-'}>{item.model || '-'}</p>
                            {item.manufacturingDate && (
                              <span className="text-[10px] font-bold text-teal-600 tabular-nums shrink-0">
                                {item.manufacturingDate.replace('-', '.')}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400">{item.category}</p>
                        </td>

                        {/* ── 평형 [MERGED] ── */}
                        {isFirst && (
                          <td rowSpan={groupSize} className={`px-1 py-1.5 text-center align-top ${bgColor}`}>
                            {item.size ? (
                              <span className="text-[11px] font-bold text-teal-700">{item.size}</span>
                            ) : (
                              <span className="text-[10px] text-slate-300">-</span>
                            )}
                          </td>
                        )}

                        {/* ── 수량 [INDIVIDUAL] ── */}
                        <td className="px-1 py-1.5 text-center">
                          <span className="text-xs font-semibold text-slate-700 tabular-nums">{item.quantity}대</span>
                        </td>

                        {/* ── 되돌리기 버튼 [MERGED] — 드롭다운 대신 직접 노출 ── */}
                        {!readOnly && isFirst && (
                          <td rowSpan={groupSize} className={`px-1 py-1.5 text-center align-top ${bgColor}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[11px] text-gold-600 hover:text-gold-700 hover:bg-gold-50 gap-1 px-2"
                              onClick={() => setRevertTarget({ id: item.id, siteName: item.siteName })}
                            >
                              <Undo2 className="h-3 w-3" />
                              보관중
                            </Button>
                          </td>
                        )}
                      </>
                    ) : (
                      /* ═══ 보관중 탭: 기존 열 순서 유지 ═══ */
                      <>
                        {/* ── 철거된 장소 [MERGED] ── */}
                        {isFirst && (
                          <td
                            rowSpan={groupSize}
                            className={`px-2 py-1.5 align-top ${bgColor}`}
                            style={isGrouped ? { borderLeft: '3px solid #3b82f6' } : undefined}
                          >
                            {item.affiliate && (
                              <p className="text-[10px] text-slate-400 font-medium leading-tight">{item.affiliate}</p>
                            )}
                            <p className="text-xs font-semibold text-slate-800 truncate" title={item.siteName}>{item.siteName}</p>
                            {isGrouped && (
                              <p className="text-[9px] text-teal-500/60 mt-0.5">{groupSize}대 구성</p>
                            )}
                          </td>
                        )}

                        {/* ── 철거일 [MERGED] ── */}
                        {isFirst && (
                          <td rowSpan={groupSize} className={`px-1.5 py-1.5 text-center align-top ${bgColor}`}>
                            <span className="text-[11px] text-brick-600 font-bold tabular-nums">
                              {item.removalDate ? formatDate(item.removalDate) : '-'}
                            </span>
                          </td>
                        )}

                        {/* ── 제조년월 [INDIVIDUAL] ── */}
                        <td className="px-1.5 py-1.5 text-center">
                          <span className="text-[11px] font-bold text-teal-700 tabular-nums">
                            {item.manufacturingDate ? item.manufacturingDate.replace('-', '.') : '-'}
                          </span>
                        </td>

                        {/* ── 유형 [INDIVIDUAL] ── */}
                        <td className="px-1 py-1.5 text-center">
                          {item.equipmentUnitType ? (
                            <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border leading-tight ${EQUIPMENT_UNIT_TYPE_COLORS[item.equipmentUnitType]}`}>
                              {EQUIPMENT_UNIT_TYPE_LABELS[item.equipmentUnitType]}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-300">-</span>
                          )}
                        </td>

                        {/* ── 모델명 [INDIVIDUAL] ── */}
                        <td className="px-2 py-1.5 text-center">
                          <p className="text-xs text-slate-800 font-semibold font-mono truncate" title={item.model || '-'}>{item.model || '-'}</p>
                          <p className="text-[10px] text-slate-400">{item.category}</p>
                        </td>

                        {/* ── 평형 [MERGED] ── */}
                        {isFirst && (
                          <td rowSpan={groupSize} className={`px-1 py-1.5 text-center align-top ${bgColor}`}>
                            {item.size ? (
                              <span className="text-[11px] font-bold text-teal-700">{item.size}</span>
                            ) : (
                              <span className="text-[10px] text-slate-300">-</span>
                            )}
                          </td>
                        )}

                        {/* ── 수량 [INDIVIDUAL] ── */}
                        <td className="px-1 py-1.5 text-center">
                          <span className="text-xs font-semibold text-slate-700 tabular-nums">{item.quantity}대</span>
                        </td>

                        {/* ── 설치예정 [INDIVIDUAL] ── */}
                        <td className="px-1.5 py-1.5">
                          {(() => {
                            const matchedOrder = orders.find(o =>
                              o.items?.some(oi => oi.storedEquipmentId === item.id)
                            )
                            if (!matchedOrder) return <span className="text-[10px] text-slate-300">-</span>
                            return (
                              <div className="space-y-0.5">
                                <p className="text-[11px] font-semibold text-olive-700 leading-tight truncate">
                                  {matchedOrder.businessName}
                                </p>
                                <p className="text-[10px] text-slate-400 leading-tight">
                                  {matchedOrder.affiliate}
                                </p>
                              </div>
                            )
                          })()}
                        </td>

                        {/* ── 제조사 [INDIVIDUAL] ── */}
                        <td className="px-1.5 py-1.5 text-center">
                          <span className="text-[11px] text-slate-600">{item.manufacturer || '-'}</span>
                        </td>

                        {/* ── 발주서 [MERGED] ── */}
                        {isFirst && (
                          <td rowSpan={groupSize} className={`px-1 py-1.5 text-center align-top ${bgColor}`}>
                            {(() => {
                              const order = getOrder(item.orderId)
                              if (order) {
                                return (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-1.5 text-[11px] gap-0.5 text-teal-600 hover:text-teal-800 hover:bg-teal-50"
                                    onClick={() => handleViewOrder(item.orderId)}
                                  >
                                    <FileText className="h-2.5 w-2.5" />
                                    보기
                                  </Button>
                                )
                              }
                              return <span className="text-[10px] text-slate-300">수동</span>
                            })()}
                          </td>
                        )}

                        {/* ── 보관 창고 [MERGED] ── */}
                        {isFirst && (
                          <td rowSpan={groupSize} className={`px-2 py-1.5 align-top ${bgColor}`}>
                            {(() => {
                              const warehouse = getWarehouse(item.warehouseId)
                              if (warehouse) {
                                return (
                                  <div>
                                    <div className="flex items-center gap-1">
                                      <WarehouseIcon className="h-3 w-3 text-slate-400" />
                                      <span className="text-xs font-medium text-slate-700">{warehouse.name}</span>
                                    </div>
                                    {warehouse.address && (
                                      <p className="text-[9px] text-slate-400 ml-4 leading-tight truncate" title={warehouse.address}>{warehouse.address}</p>
                                    )}
                                  </div>
                                )
                              }
                              return <span className="text-[11px] text-slate-300">-</span>
                            })()}
                          </td>
                        )}

                        {/* ── 액션 [INDIVIDUAL] ── */}
                        {!readOnly && (
                          <td className="px-1 py-1.5 text-center">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600">
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-32">
                                <DropdownMenuItem onClick={() => onEdit(item)} className="text-xs gap-2">
                                  <Edit2 className="h-3 w-3" /> 수정
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onRelease(item)} className="text-xs gap-2 text-teal-600">
                                  <LogOut className="h-3 w-3" /> 출고
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setDeleteTarget({ id: item.id, siteName: item.siteName })}
                                  className="text-xs gap-2 text-brick-600 focus:text-brick-600"
                                >
                                  <Trash2 className="h-3 w-3" /> 삭제
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ═══ 모바일 카드 (md 미만) — 현장별 그룹 카드 ═══ */}
      <div className="md:hidden space-y-3">
        {groups.map((group) => {
          const first = group.items[0]
          const warehouse = getWarehouse(first.warehouseId)
          const order = getOrder(first.orderId)
          const totalQty = group.items.reduce((sum, i) => sum + i.quantity, 0)

          return (
            <div key={group.key} className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
              {/* 상단: 현장명 + 총수량 */}
              <div className="px-4 pt-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {first.affiliate && (
                      <p className="text-[11px] text-slate-400 font-medium">{first.affiliate}</p>
                    )}
                    <p className="text-base font-bold text-slate-900 truncate">{first.siteName}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {first.size && (
                      <Badge variant="outline" className="text-xs font-bold text-teal-700 border-teal-200 bg-teal-50/50">
                        {first.size}
                      </Badge>
                    )}
                    <span className="text-sm font-bold text-slate-700 tabular-nums bg-slate-100 px-2 py-0.5 rounded">{totalQty}대</span>
                  </div>
                </div>
              </div>

              {/* 구성품 리스트 */}
              <div className="px-4 pb-3 space-y-1.5">
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100"
                  >
                    {/* 유형 뱃지 */}
                    {item.equipmentUnitType ? (
                      <Badge variant="outline" className={`text-[10px] font-bold shrink-0 ${EQUIPMENT_UNIT_TYPE_COLORS[item.equipmentUnitType]}`}>
                        {EQUIPMENT_UNIT_TYPE_LABELS[item.equipmentUnitType]}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-slate-400 shrink-0">-</Badge>
                    )}
                    {/* 모델명 */}
                    <p className="text-xs font-semibold font-mono text-slate-700 truncate flex-1">{item.model || '-'}</p>
                    {/* 수량 */}
                    <span className="text-[11px] text-slate-500 tabular-nums shrink-0">{item.quantity}대</span>
                    {/* 개별 액션 */}
                    {!readOnly && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-6 w-6 p-0 text-slate-300 hover:text-slate-600 shrink-0">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                          {activeTab === 'stored' ? (
                            <>
                              <DropdownMenuItem onClick={() => onEdit(item)} className="text-xs gap-2">
                                <Edit2 className="h-3 w-3" /> 수정
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onRelease(item)} className="text-xs gap-2 text-teal-600">
                                <LogOut className="h-3 w-3" /> 출고
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget({ id: item.id, siteName: item.siteName })}
                                className="text-xs gap-2 text-brick-600 focus:text-brick-600"
                              >
                                <Trash2 className="h-3 w-3" /> 삭제
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => setRevertTarget({ id: item.id, siteName: item.siteName })}
                              className="text-xs gap-2 text-gold-600"
                            >
                              <Undo2 className="h-3 w-3" /> 되돌리기
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                ))}
              </div>

              {/* 날짜 정보 */}
              <div className="px-4 pb-3 flex items-center gap-4">
                <div className="text-xs">
                  <span className="text-slate-400">철거일</span>
                  <span className="ml-1.5 font-bold text-brick-600 tabular-nums">{first.removalDate ? formatDate(first.removalDate) : '-'}</span>
                </div>
                <div className="text-xs">
                  <span className="text-slate-400">제조</span>
                  <span className="ml-1.5 font-bold text-teal-700 tabular-nums">{first.manufacturingDate ? first.manufacturingDate.replace('-', '.') : '-'}</span>
                </div>
              </div>

              {/* 설치예정 (재고설치에 연결된 발주가 있으면 표시) */}
              {(() => {
                const matchedOrder = orders.find(o =>
                  o.items?.some(oi => group.items.some(gi => oi.storedEquipmentId === gi.id))
                )
                if (!matchedOrder) return null
                return (
                  <div className="mx-4 mb-3 bg-olive-50 border border-olive-200 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-olive-500 font-medium">설치예정</p>
                    <p className="text-xs font-bold text-olive-800">{matchedOrder.affiliate} · {matchedOrder.businessName}</p>
                  </div>
                )
              })()}

              {/* 출고 정보 (출고완료 탭) */}
              {activeTab === 'released' && first.releaseType && (
                <div className="mx-4 mb-3 bg-olive-50 border border-olive-100 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge className={`${RELEASE_TYPE_COLORS[first.releaseType as ReleaseType]} text-xs font-medium`}>
                      {RELEASE_TYPE_LABELS[first.releaseType as ReleaseType]}
                    </Badge>
                    <span className="text-xs text-slate-500 tabular-nums">{formatDate(first.releaseDate)}</span>
                  </div>
                  {first.releaseDestination && (
                    <div className="flex items-start gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-olive-500 mt-0.5 shrink-0" />
                      <p className="text-sm font-medium text-slate-800">{first.releaseDestination}</p>
                    </div>
                  )}
                </div>
              )}

              {/* 보관 창고 (보관중 탭만) */}
              {activeTab === 'stored' && (
                <div className="mx-4 mb-3 bg-slate-50 border border-slate-100 rounded-lg p-3">
                  {warehouse ? (
                    <div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <WarehouseIcon className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-medium text-slate-700">{warehouse.name}</span>
                      </div>
                      {warehouse.address && (
                        <p className="text-xs text-slate-400 ml-5 mt-0.5">{warehouse.address}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-slate-300">창고 미지정</span>
                  )}
                </div>
              )}

              {/* 하단: 발주서 */}
              <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center">
                {order ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2.5 text-xs gap-1.5 text-teal-600 hover:text-teal-800 hover:bg-teal-50"
                    onClick={() => handleViewOrder(first.orderId)}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    발주서 보기
                  </Button>
                ) : (
                  <span className="text-xs text-slate-300 px-1">수동등록</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ═══ 삭제 확인 다이얼로그 ═══ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>장비 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.siteName}&rdquo; 장비를 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-brick-600 hover:bg-brick-700 text-white"
              onClick={handleConfirmDelete}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ 되돌리기 확인 다이얼로그 ═══ */}
      <AlertDialog open={!!revertTarget} onOpenChange={(open) => { if (!open) setRevertTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>출고 되돌리기</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{revertTarget?.siteName}&rdquo; 장비를 다시 &ldquo;보관중&rdquo;으로 되돌리시겠습니까? 출고 정보가 초기화됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-gold-600 hover:bg-gold-700 text-white"
              onClick={handleConfirmRevert}
            >
              되돌리기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ 발주 상세 다이얼로그 ═══ */}
      {selectedOrder && (
        <OrderDetailDialog
          order={selectedOrder}
          open={orderDetailOpen}
          onOpenChange={setOrderDetailOpen}
        />
      )}
    </>
  )
}
