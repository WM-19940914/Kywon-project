/**
 * 배송관리 메인 테이블 컴포넌트
 *
 * 메인 테이블 컬럼:
 *   상태 | 매입처 | 발주일 | 배송예정일 | 배송완료일 | 현장명 | 현장위치 | 창고정보
 *
 * 행 클릭(아코디언) → 구성품별 상세 테이블:
 *   상태 | 매입처 | 주문일 | 주문번호 | 배송예정일 | 배송완료일 | 모델명 | 수량 | 창고
 *
 * 주문번호: 구성품별 개별 관리 (같은 현장이라도 구성품마다 다를 수 있음)
 * 모델명: 부품모델명만 표시 (SET모델은 배송관리에서 불필요)
 */

'use client'

import { Fragment, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ChevronDown,
  ChevronRight,
  Edit,
  Package
} from 'lucide-react'
import type { Order } from '@/types/order'
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_COLORS } from '@/types/order'
import {
  computeDeliveryStatus,
  computeDeliveryProgress,
  getAlertType,
  getEffectiveDeliveryDate,
  getWarehouseDetail,
  formatShortDate,
  formatDate,
  computeItemDeliveryStatus,
  parseRegionFromAddress,
  ALERT_STYLES
} from '@/lib/delivery-utils'

interface DeliveryTableProps {
  orders: Order[]
  onEditDelivery?: (order: Order) => void
  onViewDetail?: (order: Order) => void
}

/** 상태별 행 스타일 */
function getRowStyle(order: Order): string {
  const alertType = getAlertType(order)
  const status = computeDeliveryStatus(order)

  if (alertType === 'delayed') return 'border-l-4 border-l-red-500 bg-red-50/50'
  if (alertType === 'today') return 'border-l-4 border-l-orange-400 bg-orange-50/50'
  if (alertType === 'tomorrow') return 'border-l-4 border-l-blue-400 bg-blue-50/30'
  if (status === 'delivered') return 'opacity-60 bg-gray-50'
  return ''
}

/** 상태 뱃지 (준비중 / 배송중+게이지 / 배송완료) */
function StatusBadge({ order }: { order: Order }) {
  const status = computeDeliveryStatus(order)
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

export function DeliveryTable({ orders, onEditDelivery, onViewDetail }: DeliveryTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleRow = (orderId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

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
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '75px' }}>매입처</th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '78px' }}>발주일</th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '90px' }}>배송예정일</th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '90px' }}>배송완료일</th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap">현장명</th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '100px' }}>현장위치</th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '120px' }}>창고정보</th>
            </tr>
          </thead>
          <tbody>
            {sortedOrders.map((order) => {
              const isExpanded = expandedRows.has(order.id)
              const equipmentItems = order.equipmentItems || []
              const effectiveDate = getEffectiveDeliveryDate(order)
              const status = computeDeliveryStatus(order)

              return (
                <Fragment key={order.id}>
                  <tr
                    className={`cursor-pointer hover:bg-gray-100/50 transition-colors ${getRowStyle(order)}`}
                    onClick={() => toggleRow(order.id)}
                  >
                    <td className="p-3 text-center">
                      {isExpanded
                        ? <ChevronDown className="h-4 w-4 text-gray-500 inline-block" />
                        : <ChevronRight className="h-4 w-4 text-gray-500 inline-block" />
                      }
                    </td>
                    <td className="p-3"><StatusBadge order={order} /></td>
                    {/* 매입처 (기본 삼성전자) */}
                    <td className="p-3">
                      <p className="text-sm text-gray-700">삼성전자</p>
                    </td>
                    <td className="p-3">
                      <p className="text-sm">{formatShortDate(order.orderDate)}</p>
                    </td>
                    <td className="p-3">
                      {effectiveDate
                        ? <p className="text-sm">{formatShortDate(effectiveDate)}</p>
                        : <p className="text-sm text-gray-400">-</p>
                      }
                    </td>
                    <td className="p-3">
                      {status === 'delivered' && order.confirmedDeliveryDate
                        ? <p className="text-sm font-medium text-green-700">{formatShortDate(order.confirmedDeliveryDate)}</p>
                        : <p className="text-sm text-gray-400">-</p>
                      }
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
                    <td className="p-3">
                      {(() => {
                        const whId = order.equipmentItems?.[0]?.warehouseId
                        const detail = getWarehouseDetail(whId)
                        if (!detail) return <p className="text-sm text-gray-400">미지정</p>
                        return (
                          <>
                            <p className="text-sm font-medium truncate">{detail.name}</p>
                            <p className="text-xs text-gray-500 truncate">{detail.managerName}</p>
                          </>
                        )
                      })()}
                    </td>
                  </tr>

                  {/* 아코디언 상세 영역 */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={9} className="p-0">
                        <div className="border-t border-gray-200 bg-gray-50/60 px-6 py-4">
                          {equipmentItems.length > 0 ? (
                            <div className="rounded-lg border border-gray-200 overflow-hidden shadow-sm mb-3">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-gray-100/80 text-xs text-gray-500 tracking-wide">
                                    <th className="text-left px-3 py-2.5 font-medium w-[90px]">상태</th>
                                    <th className="text-left px-3 py-2.5 font-medium w-[100px]">매입처</th>
                                    <th className="text-left px-3 py-2.5 font-medium w-[95px]">주문일</th>
                                    <th className="text-left px-3 py-2.5 font-medium w-[130px]">주문번호</th>
                                    <th className="text-left px-3 py-2.5 font-medium w-[95px]">배송예정</th>
                                    <th className="text-left px-3 py-2.5 font-medium w-[95px]">배송완료</th>
                                    <th className="text-left px-3 py-2.5 font-medium">모델명</th>
                                    <th className="text-left px-3 py-2.5 font-medium w-[55px]">수량</th>
                                    <th className="text-left px-3 py-2.5 font-medium w-[130px]">창고</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                  {equipmentItems.map((item, idx) => {
                                    const itemStatus = computeItemDeliveryStatus(item)
                                    const warehouseDetail = getWarehouseDetail(item.warehouseId)
                                    const supplier = item.supplier || '삼성전자'
                                    return (
                                      <tr key={item.id || idx} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-3 py-2.5">
                                          <Badge className={`${DELIVERY_STATUS_COLORS[itemStatus]} text-[11px]`}>
                                            {DELIVERY_STATUS_LABELS[itemStatus]}
                                          </Badge>
                                        </td>
                                        <td className="px-3 py-2.5">
                                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 bg-gray-100 rounded-full px-1.5 py-0.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                            {supplier}
                                          </span>
                                        </td>
                                        <td className="px-2 py-2 text-xs text-gray-600">
                                          {formatDate(item.orderDate)}
                                        </td>
                                        <td className="px-3 py-2.5">
                                          {item.orderNumber ? (
                                            <code className="text-[11px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                                              {item.orderNumber}
                                            </code>
                                          ) : (
                                            <span className="text-xs text-gray-300">—</span>
                                          )}
                                        </td>
                                        <td className="px-2 py-2 text-xs text-gray-600">
                                          {formatDate(item.requestedDeliveryDate)}
                                        </td>
                                        <td className="px-3 py-2.5">
                                          {itemStatus === 'delivered' && item.confirmedDeliveryDate ? (
                                            <span className="text-xs font-medium text-green-700">
                                              {formatDate(item.confirmedDeliveryDate)}
                                            </span>
                                          ) : (
                                            <span className="text-xs text-gray-300">—</span>
                                          )}
                                        </td>
                                        <td className="px-3 py-2.5">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-400">
                                              {item.componentName}
                                            </span>
                                            {item.componentModel && (
                                              <span className="text-sm font-semibold text-gray-900 font-mono">
                                                {item.componentModel}
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                          <span className="text-sm font-semibold text-gray-700">{item.quantity}</span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                          {warehouseDetail ? (
                                            <div>
                                              <p className="text-xs text-gray-700">{warehouseDetail.name}</p>
                                              <p className="text-[11px] text-gray-400 mt-0.5">{warehouseDetail.managerName}</p>
                                            </div>
                                          ) : (
                                            <span className="text-xs text-gray-300">—</span>
                                          )}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="bg-amber-50/80 border border-amber-200/60 rounded-lg p-4 mb-3 text-center">
                              <p className="text-sm text-amber-700">
                                아직 배송 정보가 입력되지 않았습니다.
                              </p>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="shadow-sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                onEditDelivery?.(order)
                              }}
                            >
                              <Edit className="h-3.5 w-3.5 mr-1" />
                              배송정보 입력/수정
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                onViewDetail?.(order)
                              }}
                            >
                              상세보기
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
          const equipmentItems = order.equipmentItems || []
          const effectiveDate = getEffectiveDeliveryDate(order)
          const status = computeDeliveryStatus(order)

          return (
            <div
              key={order.id}
              className={`border rounded-lg overflow-hidden bg-white ${getRowStyle(order)}`}
            >
              <div
                className="p-4 cursor-pointer"
                onClick={() => toggleRow(order.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge order={order} />
                    <span className="text-xs text-gray-500">삼성전자</span>
                  </div>
                  <span className="text-xs text-gray-500">{formatShortDate(order.orderDate)}</span>
                </div>

                <h3 className="font-semibold text-sm mb-0.5">{order.businessName}</h3>
                <p className="text-xs text-gray-500 mb-2">{order.address}</p>

                <div className="flex items-center gap-4 text-xs text-gray-600 mb-1">
                  <span>배송예정: {effectiveDate ? formatShortDate(effectiveDate) : '-'}</span>
                  <span>
                    배송완료: {status === 'delivered' && order.confirmedDeliveryDate
                      ? formatShortDate(order.confirmedDeliveryDate) : '-'}
                  </span>
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
                      const whId = order.equipmentItems?.[0]?.warehouseId
                      const detail = getWarehouseDetail(whId)
                      return detail ? detail.name : '창고 미지정'
                    })()}
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div className="bg-gray-50 border-t px-4 py-3">
                  {equipmentItems.length > 0 ? (
                    <div className="space-y-2 mb-3">
                      {equipmentItems.map((item, idx) => {
                        const itemStatus = computeItemDeliveryStatus(item)
                        const warehouseDetail = getWarehouseDetail(item.warehouseId)
                        return (
                          <div key={item.id || idx} className="bg-white border rounded-md p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">
                                {item.componentName} {item.quantity}개
                                {item.componentModel && (
                                  <span className="text-xs text-gray-500 font-mono ml-1">
                                    ({item.componentModel})
                                  </span>
                                )}
                              </span>
                              <Badge className={`${DELIVERY_STATUS_COLORS[itemStatus]} text-xs`}>
                                {DELIVERY_STATUS_LABELS[itemStatus]}
                              </Badge>
                            </div>
                            <div className="text-xs text-gray-500 space-y-0.5">
                              <p>매입처: {item.supplier || '삼성전자'}</p>
                              {item.orderNumber && (
                                <p>주문번호: <span className="font-mono text-blue-700">{item.orderNumber}</span></p>
                              )}
                              <p>주문일: {formatDate(item.orderDate)}</p>
                              <p>
                                배송예정: {formatDate(item.requestedDeliveryDate)}
                                {itemStatus === 'delivered' && item.confirmedDeliveryDate && (
                                  <span className="text-green-700 font-medium ml-2">
                                    완료: {formatDate(item.confirmedDeliveryDate)}
                                  </span>
                                )}
                              </p>
                              <p>
                                {warehouseDetail
                                  ? `창고: ${warehouseDetail.name} (${warehouseDetail.managerName})`
                                  : '창고: 미지정'
                                }
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-3 text-center">
                      <p className="text-sm text-yellow-800">
                        아직 배송 정보가 입력되지 않았습니다.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditDelivery?.(order)
                      }}
                    >
                      <Edit className="h-3.5 w-3.5 mr-1" />
                      배송정보 입력
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        onViewDetail?.(order)
                      }}
                    >
                      상세
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
