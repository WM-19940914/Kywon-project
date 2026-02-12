/**
 * 삼성매입 탭 (탭 2)
 *
 * 발주별 삼성에서 구매한 구성품 매입 상세를 보여줍니다.
 * - 상단: 월 매입 합계 카드
 * - 발주별 아코디언 테이블: 구성품명/모델명/수량/단가/금액
 * - 발주별 소계
 */

'use client'

import React, { useState, useMemo } from 'react'
import type { Order } from '@/types/order'
import { formatShortDate } from '@/lib/delivery-utils'
import { ShoppingCart, ChevronDown, AlertTriangle } from 'lucide-react'

interface SamsungPurchaseTabProps {
  orders: Order[]
}

export function SamsungPurchaseTab({ orders }: SamsungPurchaseTabProps) {
  // 아코디언 펼침 상태
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpand = (orderId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

  // 장비 데이터가 있는 발주만 필터 + 매입비 0인 발주도 포함 (미입력 표시)
  const ordersWithEquipment = useMemo(() => {
    return orders.filter(order => {
      // equipmentItems가 있거나, 신규설치 작업이 있는 건
      const hasItems = (order.equipmentItems || []).length > 0
      const hasInstallWork = order.items.some(i => i.workType === '신규설치' || i.workType === '이전설치' || i.workType === '재고설치')
      return hasItems || hasInstallWork
    })
  }, [orders])

  // 월 매입 합계
  const monthlyTotal = useMemo(() => {
    return orders.reduce((sum, order) => {
      const items = order.equipmentItems || []
      return sum + items.reduce((s, item) => s + (item.totalPrice || 0), 0)
    }, 0)
  }, [orders])

  // 매입 데이터 미입력 건수
  const missingCount = useMemo(() => {
    return ordersWithEquipment.filter(order => {
      const items = order.equipmentItems || []
      return items.length === 0 || !items.some(item => item.totalPrice != null && item.totalPrice > 0)
    }).length
  }, [ordersWithEquipment])

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="py-16 text-center">
          <ShoppingCart className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 text-lg">이 달의 삼성매입 데이터가 없습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 상단: 월 매입 합계 카드 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-red-50 text-red-600 p-2 rounded-xl">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">이달 삼성매입 합계</p>
              <p className="text-2xl font-black tabular-nums text-slate-900">
                {monthlyTotal.toLocaleString('ko-KR')}
                <span className="text-sm font-bold text-slate-400 ml-1">원</span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">{ordersWithEquipment.length}건</p>
            {missingCount > 0 && (
              <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                <AlertTriangle className="h-3 w-3" />
                {missingCount}건 미입력
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 발주별 아코디언 */}
      <div className="space-y-3">
        {ordersWithEquipment.map(order => {
          const items = order.equipmentItems || []
          const isExpanded = expandedIds.has(order.id)
          const orderTotal = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0)
          const hasData = items.some(item => item.totalPrice != null && item.totalPrice > 0)

          return (
            <div key={order.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* 발주 헤더 (클릭하면 아코디언 토글) */}
              <button
                className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${isExpanded ? 'bg-red-50/50' : 'hover:bg-slate-50'}`}
                onClick={() => toggleExpand(order.id)}
              >
                <div className="flex items-center gap-3">
                  <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                  <div className="text-left">
                    <p className="font-semibold text-sm text-slate-800">{order.businessName}</p>
                    <p className="text-xs text-slate-400">발주 {formatShortDate(order.orderDate)} · {items.length}개 구성품</p>
                  </div>
                </div>
                <div className="text-right">
                  {hasData ? (
                    <p className="text-sm font-bold tabular-nums text-red-600">
                      {orderTotal.toLocaleString('ko-KR')}원
                    </p>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      매입비 미입력
                    </span>
                  )}
                </div>
              </button>

              {/* 아코디언 콘텐츠: 구성품 테이블 */}
              {isExpanded && (
                <div className="border-t border-slate-200">
                  {items.length > 0 ? (
                    <>
                      {/* 데스크톱 테이블 */}
                      <div className="hidden md:block">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200">
                              <th className="text-left p-3 text-xs text-slate-500 font-semibold" style={{ width: '50px' }}>No.</th>
                              <th className="text-left p-3 text-xs text-slate-500 font-semibold">구성품명</th>
                              <th className="text-left p-3 text-xs text-slate-500 font-semibold" style={{ width: '180px' }}>모델명</th>
                              <th className="text-left p-3 text-xs text-slate-500 font-semibold" style={{ width: '120px' }}>주문번호</th>
                              <th className="text-center p-3 text-xs text-slate-500 font-semibold" style={{ width: '60px' }}>수량</th>
                              <th className="text-right p-3 text-xs text-slate-500 font-semibold" style={{ width: '100px' }}>단가</th>
                              <th className="text-right p-3 text-xs text-slate-500 font-semibold" style={{ width: '110px' }}>금액</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item, idx) => (
                              <tr key={item.id || idx} className="border-b border-slate-100 hover:bg-red-50/30 transition-colors">
                                <td className="p-3 text-slate-400 tabular-nums">{idx + 1}</td>
                                <td className="p-3 font-medium text-slate-800">{item.componentName}</td>
                                <td className="p-3 text-slate-500 truncate" title={item.componentModel}>{item.componentModel || '-'}</td>
                                <td className="p-3 text-slate-500 text-xs truncate" title={item.orderNumber}>{item.orderNumber || '-'}</td>
                                <td className="p-3 text-center text-slate-600 tabular-nums">{item.quantity}</td>
                                <td className="p-3 text-right text-slate-600 tabular-nums">
                                  {item.unitPrice != null ? item.unitPrice.toLocaleString('ko-KR') : '-'}
                                </td>
                                <td className="p-3 text-right font-semibold text-slate-800 tabular-nums">
                                  {item.totalPrice != null ? item.totalPrice.toLocaleString('ko-KR') : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-red-50 border-t-2 border-red-200">
                              <td colSpan={6} className="p-3 text-right text-sm font-bold text-red-800">
                                발주 매입 소계
                              </td>
                              <td className="p-3 text-right text-sm font-bold text-red-800 tabular-nums">
                                {orderTotal.toLocaleString('ko-KR')}원
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* 모바일 카드 리스트 */}
                      <div className="md:hidden divide-y divide-slate-100">
                        {items.map((item, idx) => (
                          <div key={item.id || idx} className="px-4 py-3 flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-400 bg-slate-100 rounded w-5 h-5 flex items-center justify-center">{idx + 1}</span>
                                <p className="font-medium text-sm text-slate-800">{item.componentName}</p>
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5 ml-7">{item.componentModel || '-'}</p>
                              <p className="text-xs text-slate-500 mt-0.5 ml-7 tabular-nums">
                                {item.quantity}개 x {item.unitPrice != null ? `${item.unitPrice.toLocaleString('ko-KR')}원` : '-'}
                              </p>
                            </div>
                            <p className="font-semibold text-sm text-slate-800 tabular-nums">
                              {item.totalPrice != null ? `${item.totalPrice.toLocaleString('ko-KR')}` : '-'}
                            </p>
                          </div>
                        ))}
                        {/* 소계 */}
                        <div className="px-4 py-3 bg-red-50 flex items-center justify-between">
                          <span className="text-sm font-bold text-red-800">소계</span>
                          <span className="text-sm font-bold text-red-800 tabular-nums">{orderTotal.toLocaleString('ko-KR')}원</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="px-4 py-8 text-center">
                      <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-300" />
                      <p className="text-sm text-amber-600">구성품 데이터가 없습니다.</p>
                      <p className="text-xs text-slate-400 mt-1">배송관리에서 장비 정보를 입력해주세요.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
