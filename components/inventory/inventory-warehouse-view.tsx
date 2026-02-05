/**
 * 창고 재고 현황 컴포넌트
 *
 * "파주창고에 지금 뭐가 있어?" 를 한눈에 답할 수 있는 화면
 * - 상단: 창고 드롭다운 (담당자명 함께 표시) + 통계 카드
 * - 필터: 유휴재고 / 입고내역 / 설치완료
 * - 유휴재고 테이블: 취소사유, 원래 현장, 모델명, 창고, 사용내역 한눈에 표시
 * - 정렬: 입고일 최신순
 */

'use client'

import React, { useMemo, useState } from 'react'
import type { Order, WarehouseStockStatus, InventoryEvent } from '@/types/order'
import { WAREHOUSE_STOCK_STATUS_LABELS, WAREHOUSE_STOCK_STATUS_COLORS } from '@/types/order'
import type { Warehouse } from '@/types/warehouse'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Package, CheckCircle2, Box, ChevronDown, Ban, ArrowRight } from 'lucide-react'
import { formatShortDate } from '@/lib/delivery-utils'

/** 창고 재고 아이템 (테이블 한 행) */
interface WarehouseStockItem {
  orderId: string              // 발주 ID
  equipmentItemId?: string     // 구성품 ID
  businessName: string         // 현장명 (원래 현장)
  address: string              // 주소
  componentName: string        // 구성품명
  componentModel?: string      // 구성품 모델명
  quantity: number             // 수량
  warehouseId?: string         // 창고 ID
  confirmedDeliveryDate?: string // 입고일
  installCompleteDate?: string // 설치완료일
  stockStatus: WarehouseStockStatus // 재고 상태 (파생)
  // 유휴재고 전용 필드
  cancelReason?: string              // 취소 사유
  cancelledAt?: string               // 취소일
  idleEventStatus?: 'active' | 'resolved'  // 유휴재고 이벤트 상태
  usedByBusinessName?: string        // 사용된 현장명 (resolved 시)
  usedByOrderId?: string             // 사용된 발주 ID
  resolvedDate?: string              // 사용완료 처리일
}

/** Props */
interface InventoryWarehouseViewProps {
  orders: Order[]
  warehouses: Warehouse[]
  events: InventoryEvent[]
}

/**
 * 창고 표시명 생성 (담당자명 포함)
 * 예: "파주창고 (손지훈)"
 */
function formatWarehouseLabel(wh: Warehouse): string {
  if (wh.managerName) return `${wh.name} (${wh.managerName})`
  return wh.name
}

/**
 * 취소 사유에서 "발주취소 — " 접두사를 제거
 * "발주취소 — 단순변심" → "단순변심"
 */
function cleanCancelReason(notes?: string): string {
  if (!notes) return '-'
  return notes.replace(/^발주취소\s*—\s*/, '').trim() || '-'
}

export function InventoryWarehouseView({
  orders,
  warehouses,
  events,
}: InventoryWarehouseViewProps) {
  // 선택된 창고 (빈 문자열 = 전체)
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('')
  // 상태 필터 (기본값: 유휴재고)
  const [statusFilter, setStatusFilter] = useState<WarehouseStockStatus | null>('idle')

  /**
   * 유휴재고 이벤트 맵 (equipment_item_id → event)
   * active + resolved 모두 수집 (유휴재고 탭에서 사용내역까지 보여주기 위해)
   */
  const idleEventMap = useMemo(() => {
    const map: Record<string, InventoryEvent> = {}
    events
      .filter(e => e.eventType === 'cancelled')
      .forEach(e => {
        if (e.equipmentItemId) map[e.equipmentItemId] = e
        if (e.sourceOrderId) map[`order:${e.sourceOrderId}`] = e
      })
    return map
  }, [events])

  /** 발주 ID → Order 빠른 조회용 맵 */
  const orderMap = useMemo(() => {
    const map: Record<string, Order> = {}
    orders.forEach(o => { map[o.id] = o })
    return map
  }, [orders])

  /**
   * 모든 발주에서 "입고 확정된 구성품"을 추출하여 재고 아이템 목록 생성
   */
  const stockItems = useMemo(() => {
    const items: WarehouseStockItem[] = []

    orders.forEach(order => {
      if (!order.equipmentItems || order.equipmentItems.length === 0) return

      // 입고 확정된 구성품만 필터
      const confirmedItems = order.equipmentItems.filter(eq => eq.confirmedDeliveryDate)
      if (confirmedItems.length === 0) return

      confirmedItems.forEach(eq => {
        // 유휴재고 여부 확인
        const cancelEvent = (eq.id && idleEventMap[eq.id]) || idleEventMap[`order:${order.id}`]

        // 상태 계산
        let stockStatus: WarehouseStockStatus
        if (cancelEvent) {
          stockStatus = 'idle'
        } else if (order.installCompleteDate) {
          stockStatus = 'install_done'
        } else {
          stockStatus = 'in_stock'
        }

        // 사용된 현장명 조회 (resolved 이벤트에 targetOrderId가 있을 때)
        let usedByBusinessName: string | undefined
        let usedByOrderId: string | undefined
        if (cancelEvent?.status === 'resolved' && cancelEvent.targetOrderId) {
          const targetOrder = orderMap[cancelEvent.targetOrderId]
          usedByBusinessName = targetOrder?.businessName
          usedByOrderId = cancelEvent.targetOrderId
        }

        items.push({
          orderId: order.id,
          equipmentItemId: eq.id,
          businessName: order.businessName,
          address: order.address,
          componentName: eq.componentName,
          componentModel: eq.componentModel,
          quantity: eq.quantity,
          warehouseId: eq.warehouseId,
          confirmedDeliveryDate: eq.confirmedDeliveryDate,
          installCompleteDate: order.installCompleteDate,
          stockStatus,
          // 유휴재고 전용
          cancelReason: cancelEvent?.notes,
          cancelledAt: cancelEvent?.eventDate,
          idleEventStatus: cancelEvent?.status as 'active' | 'resolved' | undefined,
          usedByBusinessName,
          usedByOrderId,
          resolvedDate: cancelEvent?.resolvedDate,
        })
      })
    })

    // 정렬: 유휴재고는 active 먼저 → resolved 나중, 그 안에서 입고일 최신순
    items.sort((a, b) => {
      // 유휴재고끼리는 active가 먼저
      if (a.stockStatus === 'idle' && b.stockStatus === 'idle') {
        if (a.idleEventStatus !== b.idleEventStatus) {
          return a.idleEventStatus === 'active' ? -1 : 1
        }
      }
      // 나머지는 입고일 최신순
      const dateA = a.confirmedDeliveryDate || ''
      const dateB = b.confirmedDeliveryDate || ''
      return dateB.localeCompare(dateA)
    })

    return items
  }, [orders, idleEventMap, orderMap])

  /** 창고별 필터링 */
  const warehouseFiltered = useMemo(() => {
    if (!selectedWarehouseId) return stockItems
    return stockItems.filter(item => item.warehouseId === selectedWarehouseId)
  }, [stockItems, selectedWarehouseId])

  /** 상태 필터링 */
  const filteredItems = useMemo(() => {
    if (!statusFilter) return warehouseFiltered
    return warehouseFiltered.filter(item => item.stockStatus === statusFilter)
  }, [warehouseFiltered, statusFilter])

  /** 통계 카드 데이터 (유휴재고는 active만 카운트) */
  const stats = useMemo(() => {
    const s = { in_stock: 0, idle: 0, install_done: 0 }
    warehouseFiltered.forEach(item => {
      if (item.stockStatus === 'idle' && item.idleEventStatus === 'active') {
        s.idle++
      } else if (item.stockStatus === 'idle' && item.idleEventStatus === 'resolved') {
        // resolved는 카운트에 포함하지 않음 (사용완료)
      } else {
        s[item.stockStatus]++
      }
    })
    return s
  }, [warehouseFiltered])

  /** 창고 표시명 찾기 (담당자 포함) */
  const getWarehouseLabel = (warehouseId?: string) => {
    if (!warehouseId) return '미지정'
    const wh = warehouses.find(w => w.id === warehouseId)
    return wh ? formatWarehouseLabel(wh) : '알 수 없음'
  }

  /** 드롭다운에 사용할 창고별 재고 건수 */
  const warehouseCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    stockItems.forEach(item => {
      const wid = item.warehouseId || 'unknown'
      map[wid] = (map[wid] || 0) + 1
    })
    return map
  }, [stockItems])

  return (
    <div className="space-y-4">
      {/* 상단: 창고 선택 드롭다운 + 통계 카드 */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* 창고 선택 드롭다운 */}
        <div className="sm:w-[320px]">
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">창고 선택</label>
          <div className="relative">
            <select
              className="w-full h-11 rounded-lg border border-gray-200 bg-white pl-3 pr-10 text-sm font-medium appearance-none focus:outline-none focus:ring-2 focus:ring-gray-300 cursor-pointer"
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
            >
              <option value="">전체 창고 ({stockItems.length}건)</option>
              {warehouses.map(wh => (
                <option key={wh.id} value={wh.id}>
                  {formatWarehouseLabel(wh)} — {warehouseCountMap[wh.id] || 0}건
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* 통계 카드 (유휴재고 → 입고내역 → 설치완료 순서) */}
        <div className="flex-1 grid grid-cols-3 gap-3">
          <Card className={`border-red-200 cursor-pointer transition-colors ${
            statusFilter === 'idle' ? 'bg-red-100 ring-2 ring-red-300' : 'bg-red-50/30 hover:bg-red-50'
          }`} onClick={() => setStatusFilter(statusFilter === 'idle' ? null : 'idle')}>
            <CardContent className="p-3 flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center">
                <Ban className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-red-600">유휴재고</p>
                <p className="text-xl font-bold text-red-700">{stats.idle}</p>
              </div>
            </CardContent>
          </Card>
          <Card className={`border-green-200 cursor-pointer transition-colors ${
            statusFilter === 'in_stock' ? 'bg-green-100 ring-2 ring-green-300' : 'bg-green-50/50 hover:bg-green-50'
          }`} onClick={() => setStatusFilter(statusFilter === 'in_stock' ? null : 'in_stock')}>
            <CardContent className="p-3 flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-green-100 flex items-center justify-center">
                <Package className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-green-700">입고내역</p>
                <p className="text-xl font-bold text-green-800">{stats.in_stock}</p>
              </div>
            </CardContent>
          </Card>
          <Card className={`border-gray-200 cursor-pointer transition-colors ${
            statusFilter === 'install_done' ? 'bg-gray-200 ring-2 ring-gray-400' : 'bg-gray-50/50 hover:bg-gray-100'
          }`} onClick={() => setStatusFilter(statusFilter === 'install_done' ? null : 'install_done')}>
            <CardContent className="p-3 flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-gray-100 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <p className="text-xs text-gray-600">설치완료</p>
                <p className="text-xl font-bold text-gray-700">{stats.install_done}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 현재 필터 안내 */}
      {(selectedWarehouseId || statusFilter) && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>필터:</span>
          {selectedWarehouseId && (
            <Badge variant="outline" className="font-medium">
              {getWarehouseLabel(selectedWarehouseId)}
            </Badge>
          )}
          {statusFilter && (
            <Badge className={`${WAREHOUSE_STOCK_STATUS_COLORS[statusFilter]} text-xs border`}>
              {WAREHOUSE_STOCK_STATUS_LABELS[statusFilter]}
            </Badge>
          )}
          <button
            className="text-xs text-gray-400 hover:text-gray-600 underline ml-1"
            onClick={() => { setSelectedWarehouseId(''); setStatusFilter(null) }}
          >
            초기화
          </button>
        </div>
      )}

      {/* ===== 유휴재고 전용 테이블 (statusFilter === 'idle') ===== */}
      {statusFilter === 'idle' && (
        <>
          {/* 데스크톱 */}
          <div className="hidden md:block border rounded-lg overflow-hidden">
            {filteredItems.length === 0 ? (
              <div className="py-16 text-center">
                <Box className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">유휴재고가 없습니다.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/80">
                  <tr>
                    <th className="text-center p-3 text-sm font-medium" style={{ width: '120px' }}>상태</th>
                    <th className="text-left p-3 text-sm font-medium" style={{ width: '100px' }}>입고일</th>
                    <th className="text-left p-3 text-sm font-medium" style={{ width: '150px' }}>창고</th>
                    <th className="text-left p-3 text-sm font-medium">원래 현장</th>
                    <th className="text-left p-3 text-sm font-medium">구성품 (모델명)</th>
                    <th className="text-center p-3 text-sm font-medium" style={{ width: '50px' }}>수량</th>
                    <th className="text-left p-3 text-sm font-medium" style={{ width: '160px' }}>취소 사유</th>
                    <th className="text-left p-3 text-sm font-medium" style={{ width: '160px' }}>사용 내역</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, idx) => {
                    const isResolved = item.idleEventStatus === 'resolved'
                    return (
                      <tr
                        key={`${item.orderId}-${idx}`}
                        className={`border-b border-gray-100 transition-colors ${
                          isResolved
                            ? 'bg-gray-50/50 text-gray-400'
                            : 'bg-red-50/30 hover:bg-red-50/50'
                        }`}
                      >
                        {/* 상태 뱃지 */}
                        <td className="p-3 text-center">
                          {isResolved ? (
                            <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px] border">
                              사용완료
                            </Badge>
                          ) : (
                            <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] border">
                              유휴재고
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-sm">{formatShortDate(item.confirmedDeliveryDate)}</td>
                        <td className="p-3 text-sm">
                          <span className="font-medium">{getWarehouseLabel(item.warehouseId)}</span>
                        </td>
                        <td className="p-3">
                          <p className={`font-semibold text-sm truncate ${isResolved ? 'text-gray-400' : ''}`}>
                            {item.businessName}
                          </p>
                        </td>
                        <td className="p-3">
                          <p className="text-sm">{item.componentName}</p>
                          {item.componentModel && (
                            <p className="text-xs text-gray-400 font-mono">{item.componentModel}</p>
                          )}
                        </td>
                        <td className="p-3 text-center text-sm">{item.quantity}</td>
                        {/* 취소 사유 */}
                        <td className="p-3">
                          <p className="text-xs text-gray-500 truncate">
                            {cleanCancelReason(item.cancelReason)}
                          </p>
                          {item.cancelledAt && (
                            <p className="text-[10px] text-gray-400">{formatShortDate(item.cancelledAt)}</p>
                          )}
                        </td>
                        {/* 사용 내역 */}
                        <td className="p-3">
                          {isResolved && item.usedByBusinessName ? (
                            <div className="flex items-center gap-1 text-xs">
                              <ArrowRight className="h-3 w-3 text-green-500 shrink-0" />
                              <span className="text-green-700 font-medium truncate">
                                {item.usedByBusinessName}
                              </span>
                            </div>
                          ) : isResolved ? (
                            <span className="text-xs text-gray-400">처리완료</span>
                          ) : (
                            <span className="text-xs text-red-400">대기중</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* 모바일 */}
          <div className="md:hidden space-y-3">
            {filteredItems.length === 0 ? (
              <div className="py-16 text-center">
                <Box className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">유휴재고가 없습니다.</p>
              </div>
            ) : (
              filteredItems.map((item, idx) => {
                const isResolved = item.idleEventStatus === 'resolved'
                return (
                  <div
                    key={`${item.orderId}-${idx}`}
                    className={`border rounded-lg p-4 space-y-2 ${
                      isResolved
                        ? 'bg-gray-50 border-gray-200'
                        : 'bg-red-50/30 border-red-200'
                    }`}
                  >
                    {/* 상단: 상태 + 입고일 */}
                    <div className="flex items-center justify-between">
                      {isResolved ? (
                        <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px] border">
                          사용완료
                        </Badge>
                      ) : (
                        <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] border">
                          유휴재고
                        </Badge>
                      )}
                      <span className="text-xs text-gray-500">{formatShortDate(item.confirmedDeliveryDate)}</span>
                    </div>
                    {/* 원래 현장 */}
                    <div>
                      <p className="text-[10px] text-gray-400">원래 현장</p>
                      <h3 className={`font-semibold text-sm ${isResolved ? 'text-gray-400' : ''}`}>
                        {item.businessName}
                      </h3>
                    </div>
                    {/* 구성품 + 창고 */}
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="text-gray-800">{item.componentName}</p>
                        {item.componentModel && <p className="text-xs text-gray-400 font-mono">{item.componentModel}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">{getWarehouseLabel(item.warehouseId)}</p>
                        <p className="text-xs text-gray-400">x{item.quantity}</p>
                      </div>
                    </div>
                    {/* 취소 사유 */}
                    <div className="pt-1 border-t border-gray-200/50">
                      <p className="text-[10px] text-gray-400">취소 사유</p>
                      <p className="text-xs text-gray-600">{cleanCancelReason(item.cancelReason)}</p>
                    </div>
                    {/* 사용 내역 */}
                    {isResolved && item.usedByBusinessName && (
                      <div className="flex items-center gap-1 text-xs bg-green-50 rounded px-2 py-1.5">
                        <ArrowRight className="h-3 w-3 text-green-500 shrink-0" />
                        <span className="text-green-700 font-medium">{item.usedByBusinessName}</span>
                        <span className="text-green-500 text-[10px] ml-auto">{formatShortDate(item.resolvedDate)}</span>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

      {/* ===== 입고내역 / 설치완료 기존 테이블 (유휴재고가 아닐 때) ===== */}
      {statusFilter !== 'idle' && (
        <>
          {/* 데스크톱 */}
          <div className="hidden md:block border rounded-lg overflow-hidden">
            {filteredItems.length === 0 ? (
              <div className="py-16 text-center">
                <Box className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">입고된 장비가 없습니다.</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted/80">
                  <tr>
                    <th className="text-left p-3 text-sm font-medium" style={{ width: '100px' }}>입고일</th>
                    <th className="text-left p-3 text-sm font-medium" style={{ width: '160px' }}>창고 (담당자)</th>
                    <th className="text-left p-3 text-sm font-medium">현장명</th>
                    <th className="text-left p-3 text-sm font-medium">구성품 (모델명)</th>
                    <th className="text-center p-3 text-sm font-medium" style={{ width: '60px' }}>수량</th>
                    <th className="text-center p-3 text-sm font-medium" style={{ width: '130px' }}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, idx) => (
                    <tr
                      key={`${item.orderId}-${idx}`}
                      className="border-b border-gray-100 hover:bg-gray-50/50"
                    >
                      <td className="p-3 text-sm">{formatShortDate(item.confirmedDeliveryDate)}</td>
                      <td className="p-3 text-sm">
                        <span className="font-medium">{getWarehouseLabel(item.warehouseId)}</span>
                      </td>
                      <td className="p-3">
                        <p className="font-semibold text-sm truncate">{item.businessName}</p>
                        <p className="text-xs text-gray-500 truncate">{item.address}</p>
                      </td>
                      <td className="p-3">
                        <p className="text-sm">{item.componentName}</p>
                        {item.componentModel && (
                          <p className="text-xs text-gray-400">{item.componentModel}</p>
                        )}
                      </td>
                      <td className="p-3 text-center text-sm">{item.quantity}</td>
                      <td className="p-3 text-center">
                        <Badge className={`${WAREHOUSE_STOCK_STATUS_COLORS[item.stockStatus]} text-[10px] border`}>
                          {WAREHOUSE_STOCK_STATUS_LABELS[item.stockStatus]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* 모바일 */}
          <div className="md:hidden space-y-3">
            {filteredItems.length === 0 ? (
              <div className="py-16 text-center">
                <Box className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">입고된 장비가 없습니다.</p>
              </div>
            ) : (
              filteredItems.map((item, idx) => (
                <div
                  key={`${item.orderId}-${idx}`}
                  className="border rounded-lg p-4 bg-white space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <Badge className={`${WAREHOUSE_STOCK_STATUS_COLORS[item.stockStatus]} text-[10px] border`}>
                      {WAREHOUSE_STOCK_STATUS_LABELS[item.stockStatus]}
                    </Badge>
                    <span className="text-xs text-gray-500">{formatShortDate(item.confirmedDeliveryDate)}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{item.businessName}</h3>
                    <p className="text-xs text-gray-500 truncate">{item.address}</p>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-gray-800">{item.componentName}</p>
                      {item.componentModel && <p className="text-xs text-gray-400">{item.componentModel}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{getWarehouseLabel(item.warehouseId)}</p>
                      <p className="text-xs text-gray-400">수량: {item.quantity}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
