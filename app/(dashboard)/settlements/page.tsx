/**
 * 교원·멜레아 정산관리 페이지
 *
 * 교원그룹과 멜레아 간 월별 견적 기반 정산을 관리합니다.
 * - 에스원 정산에서 '정산진행중' 이상인 건이 대상
 * - 계열사별(5개) 그룹화하여 표시
 * - 아코디언으로 전체 견적서(장비비+설치비) 상세 확인
 * - 월별 멜레아/교원 검토 상태 뱃지 (통계 카드에 배치)
 * - 회계 전문 스타일 UI/UX
 */

'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { fetchOrders, fetchASRequests, fetchSettlementConfirmation, saveSettlementConfirmation, clearSettlementConfirmation } from '@/lib/supabase/dal'
import type { SettlementConfirmation } from '@/lib/supabase/dal'
import type { Order } from '@/types/order'
import type { ASRequest } from '@/types/as'
import {
  AFFILIATE_OPTIONS,
  sortWorkTypes,
  getWorkTypeBadgeStyle,
} from '@/types/order'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Receipt, ChevronDown, ChevronLeft, ChevronRight as ChevronRightIcon, PlusCircle, ArrowRightLeft, Archive, Trash2, Package, RotateCcw, FileText, CircleDollarSign, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatShortDate } from '@/lib/delivery-utils'
import { OrderDetailDialog } from '@/components/orders/order-detail-dialog'
import { SitePhotoViewer } from '@/components/schedule/site-photo-viewer'

/** 계열사별 색상 (가로 스택 바 + 범례용) */
const AFFILIATE_COLORS: Record<string, string> = {
  '구몬': 'bg-blue-500',
  'Wells 영업': 'bg-emerald-500',
  'Wells 서비스': 'bg-amber-500',
  '교육플랫폼': 'bg-violet-500',
  '기타': 'bg-gray-400',
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

/**
 * itemName에서 품목/모델명 분리
 * - "품목|||모델명" 형태면 구분자로 분리
 * - 구분자 없으면 마지막 단어가 삼성 모델번호(영문+숫자 6자 이상)인지 판별
 */
function splitItemName(itemName: string): { product: string; model: string } {
  if (itemName.includes('|||')) {
    const [product, model] = itemName.split('|||')
    return { product, model }
  }
  // 기존 데이터 호환: 마지막 단어가 모델번호 패턴이면 분리
  const parts = itemName.trim().split(' ')
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]
    // 삼성 모델번호: 영문대문자+숫자 조합, 6자 이상 (예: AR60F13C13WS, AP072BAPPBH2S)
    if (/^[A-Z0-9]{6,}$/.test(last) && /[A-Z]/.test(last) && /[0-9]/.test(last)) {
      return { product: parts.slice(0, -1).join(' '), model: last }
    }
  }
  return { product: itemName, model: '' }
}

/** 발주 1건의 정산 금액 계산 (공통 로직) */
function calcOrderAmounts(order: Order) {
  const quote = order.customerQuote
  const equipItems = quote?.items?.filter(i => i.category === 'equipment') || []
  const installItems = quote?.items?.filter(i => i.category === 'installation') || []
  const notesStr = quote?.notes || ''
  const equipRoundMatch = notesStr.match(/장비비절사:\s*([\d,]+)/)
  const installRoundMatch = notesStr.match(/설치비절사:\s*([\d,]+)/)
  const equipRounding = equipRoundMatch ? parseInt(equipRoundMatch[1].replace(/,/g, '')) : 0
  const installRounding = installRoundMatch ? parseInt(installRoundMatch[1].replace(/,/g, '')) : 0
  const equipSubtotal = equipItems.reduce((s, i) => s + i.totalPrice, 0) - equipRounding
  const installSubtotal = installItems.reduce((s, i) => s + i.totalPrice, 0) - installRounding
  const supplyAmount = equipSubtotal + installSubtotal
  const rawInstallTotal = installItems.reduce((s, i) => s + i.totalPrice, 0)
  const rawProfit = Math.round(rawInstallTotal * 0.03)
  const rawSubtotal = supplyAmount + rawProfit
  const subtotalWithProfit = Math.floor(rawSubtotal / 1000) * 1000
  // 기업이윤에 절사 반영 (공급가액 + 기업이윤 = 총 소계가 정확히 맞도록)
  const adjustedProfit = subtotalWithProfit - supplyAmount
  const vat = Math.round(subtotalWithProfit * 0.1)
  const grandTotal = subtotalWithProfit + vat

  return {
    equipItems, installItems, equipRounding, installRounding,
    equipSubtotal, installSubtotal, supplyAmount,
    rawInstallTotal, rawProfit, adjustedProfit,
    subtotalWithProfit, vat, grandTotal,
  }
}


/**
 * 계열사 그룹 컴포넌트
 * - 계열사명 + 건수 + 합계 헤더
 * - 내부 테이블: 작업종류 | 발주일 | 발주서보기 | 현장명 | 금액
 * - 행 클릭 → 견적서 아코디언
 */
function AffiliateGroup({
  affiliateName,
  orders,
  expandedIds,
  onToggleExpand,
  onViewOrder,
}: {
  affiliateName: string
  orders: Order[]
  expandedIds: Set<string>
  onToggleExpand: (orderId: string) => void
  onViewOrder: (order: Order) => void
}) {
  const [isOpen, setIsOpen] = useState(orders.length > 0)

  // 계열사 합계 계산
  const totals = orders.reduce((acc, order) => {
    const amounts = calcOrderAmounts(order)
    return {
      subtotal: acc.subtotal + amounts.subtotalWithProfit,
      vat: acc.vat + amounts.vat,
      total: acc.total + amounts.grandTotal,
    }
  }, { subtotal: 0, vat: 0, total: 0 })

  return (
    <Card className={`transition-all ${isOpen && orders.length > 0 ? 'ring-1 ring-blue-200 shadow-md' : ''}`}>
      {/* 계열사 헤더 */}
      <button
        className={`w-full flex items-center justify-between px-6 py-4 rounded-t-xl transition-colors ${
          orders.length > 0
            ? (isOpen ? 'bg-blue-50/60' : 'hover:bg-gray-50')
            : ''
        }`}
        onClick={() => orders.length > 0 && setIsOpen(prev => !prev)}
        disabled={orders.length === 0}
      >
        <div className="flex items-center gap-3">
          <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${
            orders.length === 0 ? 'opacity-30' : (isOpen ? '' : '-rotate-90')
          }`} />
          <h3 className="text-lg font-bold text-gray-800">{affiliateName}</h3>
          <span className="text-sm text-gray-500">({orders.length}건)</span>
        </div>
        {orders.length > 0 && (
          <div className="flex items-center gap-5 text-right">
            <div className="border-l border-gray-200 pl-5">
              <p className="text-[10px] text-gray-400 leading-tight">부가세별도</p>
              <p className="text-sm font-bold tabular-nums text-gray-700">{totals.subtotal.toLocaleString('ko-KR')}</p>
            </div>
            <div className="border-l border-gray-200 pl-5">
              <p className="text-[10px] text-gray-400 leading-tight">부가세</p>
              <p className="text-sm font-bold tabular-nums text-gray-500">{totals.vat.toLocaleString('ko-KR')}</p>
            </div>
            <div className="border-l border-gray-200 pl-5">
              <p className="text-[10px] text-blue-500 leading-tight">부가세포함</p>
              <p className="text-base font-extrabold tabular-nums text-gray-900">{totals.total.toLocaleString('ko-KR')}</p>
            </div>
          </div>
        )}
      </button>

      {/* 0건일 때 빈 상태 */}
      {orders.length === 0 && (
        <CardContent className="py-3 text-sm text-gray-400">
          정산 대상이 없습니다.
        </CardContent>
      )}

      {/* 펼침: 테이블 */}
      {isOpen && orders.length > 0 && (
        <CardContent className="pt-0 pb-4 px-4">
          {/* 데스크톱 테이블 */}
          <div className="hidden md:block border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-800 bg-gray-50">
                  <th className="text-left p-3 text-xs font-bold uppercase tracking-wider text-gray-600" style={{ width: '110px' }}>작업종류</th>
                  <th className="text-left p-3 text-xs font-bold uppercase tracking-wider text-gray-600" style={{ width: '85px' }}>발주일</th>
                  <th className="text-left p-3 text-xs font-bold uppercase tracking-wider text-gray-600" style={{ width: '85px' }}>설치완료일</th>
                  <th className="text-center p-3 text-xs font-bold uppercase tracking-wider text-gray-600" style={{ width: '70px' }}>발주서</th>
                  <th className="text-center p-3 text-xs font-bold uppercase tracking-wider text-gray-600" style={{ width: '90px' }}>계열사</th>
                  <th className="text-center p-3 text-xs font-bold uppercase tracking-wider text-gray-600">사업자명</th>
                  <th className="text-center p-3 text-xs font-bold uppercase tracking-wider text-gray-600" style={{ width: '80px' }}>현장사진</th>
                  <th className="text-right p-3 text-xs font-bold uppercase tracking-wider text-gray-600" style={{ width: '120px' }}>부가세별도</th>
                  <th className="text-right p-3 text-xs font-bold uppercase tracking-wider text-gray-600" style={{ width: '100px' }}>부가세</th>
                  <th className="text-right p-3 text-xs font-bold uppercase tracking-wider text-gray-600" style={{ width: '130px' }}>부가세포함</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, orderIdx) => {
                  const isExpanded = expandedIds.has(order.id)
                  const workTypes = sortWorkTypes(Array.from(new Set(order.items.map(i => i.workType))))
                  const isLast = orderIdx === orders.length - 1
                  const amounts = calcOrderAmounts(order)

                  return (
                    <React.Fragment key={order.id}>
                      {/* 현장 행 */}
                      <tr
                        className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50/40' : ''} ${isLast && !isExpanded ? 'border-b-2 border-b-gray-400' : ''}`}
                        onClick={() => onToggleExpand(order.id)}
                      >
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

                        {/* 발주일 */}
                        <td className="p-3 text-sm tabular-nums">{formatShortDate(order.orderDate)}</td>

                        {/* 설치완료일 */}
                        <td className="p-3 text-sm tabular-nums text-gray-500">
                          {order.installCompleteDate ? formatShortDate(order.installCompleteDate) : '-'}
                        </td>

                        {/* 발주서보기 버튼 */}
                        <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            onClick={() => onViewOrder(order)}
                          >
                            <FileText className="h-3.5 w-3.5 mr-1" />
                            보기
                          </Button>
                        </td>

                        {/* 계열사 */}
                        <td className="p-3 text-center text-xs text-gray-600">{order.affiliate || '-'}</td>

                        {/* 사업자명 + 아코디언 아이콘 */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            <p className="font-semibold text-sm truncate">{order.businessName}</p>
                          </div>
                        </td>

                        {/* 현장사진 */}
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <SitePhotoViewer
                            photos={order.sitePhotos || []}
                            businessName={order.businessName}
                          />
                        </td>

                        {/* 부가세별도 */}
                        <td className="p-3 text-right">
                          <p className="text-sm tabular-nums text-gray-700">
                            {amounts.subtotalWithProfit > 0 ? amounts.subtotalWithProfit.toLocaleString('ko-KR') : '-'}
                          </p>
                        </td>

                        {/* 부가세 */}
                        <td className="p-3 text-right">
                          <p className="text-sm tabular-nums text-gray-500">
                            {amounts.vat > 0 ? amounts.vat.toLocaleString('ko-KR') : '-'}
                          </p>
                        </td>

                        {/* 부가세포함 */}
                        <td className="p-3 text-right">
                          <p className="text-sm font-bold tabular-nums text-gray-900">
                            {amounts.grandTotal > 0 ? `${amounts.grandTotal.toLocaleString('ko-KR')}원` : '-'}
                          </p>
                        </td>
                      </tr>

                      {/* 아코디언: 전체 견적서 (장비비 + 설치비) */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="p-0">
                            <div className="mx-4 my-3">
                              <div className="border-2 border-blue-300 rounded-lg overflow-hidden bg-white shadow-md">
                                {/* 견적서 헤더 — gradient + 현장명 */}
                                <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-700 to-blue-600">
                                  <Receipt className="h-4 w-4 text-white" />
                                  <span className="text-sm font-bold text-white tracking-wide">견적서</span>
                                  <span className="text-xs text-blue-200 ml-2">— {order.businessName}</span>
                                </div>

                                <table className="w-full text-sm">
                                  <colgroup>
                                    <col style={{ width: '36px' }} />
                                    <col style={{ width: '160px' }} />
                                    <col style={{ width: '180px' }} />
                                    <col style={{ width: '50px' }} />
                                    <col style={{ width: '110px' }} />
                                    <col style={{ width: '120px' }} />
                                    <col style={{ width: '140px' }} />
                                  </colgroup>
                                  <thead>
                                    <tr className="border-b-2 border-gray-800 bg-gray-50">
                                      <th className="text-center py-2 px-2 text-xs font-bold uppercase tracking-wider text-gray-600">No.</th>
                                      <th className="text-center py-2 px-2 text-xs font-bold uppercase tracking-wider text-gray-600">품목</th>
                                      <th className="text-center py-2 px-2 text-xs font-bold uppercase tracking-wider text-gray-600">모델명</th>
                                      <th className="text-center py-2 px-2 text-xs font-bold uppercase tracking-wider text-gray-600">수량</th>
                                      <th className="text-right py-2 px-2 text-xs font-bold uppercase tracking-wider text-gray-600">단가</th>
                                      <th className="text-right py-2 px-2 text-xs font-bold uppercase tracking-wider text-gray-600">금액</th>
                                      <th className="text-center py-2 px-2 text-xs font-bold uppercase tracking-wider text-gray-600">비고</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {/* ─── 장비비 섹션 ─── */}
                                    <tr className="bg-gray-100">
                                      <td colSpan={7} className="py-1.5 px-3 text-xs font-bold text-gray-600 tracking-widest uppercase">[ 장비 ]</td>
                                    </tr>
                                    {amounts.equipItems.length > 0 ? amounts.equipItems.map((item, idx) => {
                                      const { product: displayName, model: displayModel } = splitItemName(item.itemName)
                                      return (
                                        <tr key={item.id || `eq-${idx}`} className="border-b border-gray-100 hover:bg-blue-50/30">
                                          <td className="py-2 px-2 text-center text-gray-400 tabular-nums">{idx + 1}</td>
                                          <td className="py-2 px-2 text-center text-gray-800 font-medium truncate">{displayName}</td>
                                          <td className="py-2 px-2 text-center text-gray-500 truncate">{displayModel || '-'}</td>
                                          <td className="py-2 px-2 text-center text-gray-600 tabular-nums">{item.quantity}</td>
                                          <td className="py-2 px-2 text-right text-gray-600 tabular-nums">{item.unitPrice.toLocaleString('ko-KR')}</td>
                                          <td className="py-2 px-2 text-right font-bold text-gray-800 tabular-nums">{item.totalPrice.toLocaleString('ko-KR')}</td>
                                          <td className="py-2 px-2 text-center text-gray-500 truncate">{item.description || ''}</td>
                                        </tr>
                                      )
                                    }) : (
                                      <tr className="border-b border-gray-100">
                                        <td colSpan={7} className="py-3 text-center text-xs text-gray-400">장비 항목 없음</td>
                                      </tr>
                                    )}
                                    {amounts.equipRounding > 0 && (
                                      <tr className="border-t border-dashed border-gray-300">
                                        <td colSpan={5} className="py-1.5 px-2 text-right text-gray-500 text-xs">단위절사</td>
                                        <td className="py-1.5 px-2 text-right text-red-500 font-medium text-xs tabular-nums">-{amounts.equipRounding.toLocaleString('ko-KR')}</td>
                                        <td></td>
                                      </tr>
                                    )}
                                    <tr className="bg-gray-50 border-b-2 border-b-gray-300">
                                      <td colSpan={5} className="py-1.5 px-2 text-right font-bold text-gray-700 text-xs">장비비 소계</td>
                                      <td className="py-1.5 px-2 text-right font-bold text-gray-700 text-xs tabular-nums">{amounts.equipSubtotal.toLocaleString('ko-KR')}</td>
                                      <td></td>
                                    </tr>

                                    {/* ─── 설치비 섹션 ─── */}
                                    <tr className="bg-gray-100">
                                      <td colSpan={7} className="py-1.5 px-3 text-xs font-bold text-gray-600 tracking-widest uppercase">[ 설치비 ]</td>
                                    </tr>
                                    {amounts.installItems.length > 0 ? amounts.installItems.map((item, idx) => {
                                      const { product: displayName, model: displayModel } = splitItemName(item.itemName)
                                      return (
                                        <tr key={item.id || `in-${idx}`} className="border-b border-gray-100 hover:bg-blue-50/30">
                                          <td className="py-2 px-2 text-center text-gray-400 tabular-nums">{idx + 1}</td>
                                          <td className="py-2 px-2 text-center text-gray-800 font-medium truncate">{displayName}</td>
                                          <td className="py-2 px-2 text-center text-gray-500 truncate">{displayModel || '-'}</td>
                                          <td className="py-2 px-2 text-center text-gray-600 tabular-nums">{item.quantity}</td>
                                          <td className="py-2 px-2 text-right text-gray-600 tabular-nums">{item.unitPrice.toLocaleString('ko-KR')}</td>
                                          <td className="py-2 px-2 text-right font-bold text-gray-800 tabular-nums">{item.totalPrice.toLocaleString('ko-KR')}</td>
                                          <td className="py-2 px-2 text-center text-gray-500 truncate">{item.description || ''}</td>
                                        </tr>
                                      )
                                    }) : (
                                      <tr className="border-b border-gray-100">
                                        <td colSpan={7} className="py-3 text-center text-xs text-gray-400">설치비 항목 없음</td>
                                      </tr>
                                    )}
                                    {amounts.installRounding > 0 && (
                                      <tr className="border-t border-dashed border-gray-300">
                                        <td colSpan={5} className="py-1.5 px-2 text-right text-gray-500 text-xs">단위절사</td>
                                        <td className="py-1.5 px-2 text-right text-red-500 font-medium text-xs tabular-nums">-{amounts.installRounding.toLocaleString('ko-KR')}</td>
                                        <td></td>
                                      </tr>
                                    )}
                                    <tr className="bg-gray-50 border-b-2 border-b-gray-300">
                                      <td colSpan={5} className="py-1.5 px-2 text-right font-bold text-gray-700 text-xs">설치비 소계</td>
                                      <td className="py-1.5 px-2 text-right font-bold text-gray-700 text-xs tabular-nums">{amounts.installSubtotal.toLocaleString('ko-KR')}</td>
                                      <td></td>
                                    </tr>
                                  </tbody>

                                  {/* 합계 영역 — 카드 레이아웃 */}
                                  <tfoot>
                                    <tr>
                                      <td colSpan={7} className="p-3 pt-4">
                                        <div className="flex justify-end">
                                          <div className="w-[300px] rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
                                              <span className="text-xs text-gray-500">공급가액(장비+설치비)</span>
                                              <span className="text-sm font-semibold text-gray-700 tabular-nums">{amounts.supplyAmount.toLocaleString('ko-KR')}</span>
                                            </div>
                                            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
                                              <span className="text-xs text-amber-600">기업이윤(설치비 3%)</span>
                                              <span className="text-sm font-semibold text-amber-700 tabular-nums">+{amounts.adjustedProfit.toLocaleString('ko-KR')}</span>
                                            </div>
                                            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white">
                                              <span className="text-xs font-bold text-gray-600">소계</span>
                                              <span className="text-sm font-bold text-gray-800 tabular-nums">{amounts.subtotalWithProfit.toLocaleString('ko-KR')}</span>
                                            </div>
                                            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-gray-50/50">
                                              <span className="text-xs text-gray-500">VAT(10%)</span>
                                              <span className="text-sm font-semibold text-gray-600 tabular-nums">+{amounts.vat.toLocaleString('ko-KR')}</span>
                                            </div>
                                            <div className="flex items-center justify-between px-4 py-3 bg-blue-600 text-white">
                                              <span className="text-sm font-bold">최종금액</span>
                                              <span className="text-lg font-black tabular-nums">{amounts.grandTotal.toLocaleString('ko-KR')}<span className="text-sm font-medium ml-0.5">원</span></span>
                                            </div>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
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

          {/* 모바일 카드 리스트 */}
          <div className="md:hidden space-y-3">
            {orders.map(order => {
              const isExpanded = expandedIds.has(order.id)
              const workTypes = sortWorkTypes(Array.from(new Set(order.items.map(i => i.workType))))
              const amounts = calcOrderAmounts(order)

              return (
                <Card key={order.id} className={`overflow-hidden ${isExpanded ? 'ring-1 ring-blue-300' : ''}`}>
                  <div
                    className="p-4 space-y-3 cursor-pointer"
                    onClick={() => onToggleExpand(order.id)}
                  >
                    {/* 상단: 작업종류 + 아코디언 아이콘 */}
                    <div className="flex items-center justify-between">
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
                      <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>

                    {/* 현장명 + 주소 */}
                    <div>
                      <h3 className="font-semibold text-sm">{order.businessName}</h3>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{order.address}</p>
                    </div>

                    {/* 발주일 / 설치완료일 + 금액 */}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>발주 {formatShortDate(order.orderDate)} · 완료 {order.installCompleteDate ? formatShortDate(order.installCompleteDate) : '-'}</span>
                      <span className="font-bold text-gray-800 tabular-nums">
                        {amounts.grandTotal > 0 ? `${amounts.grandTotal.toLocaleString('ko-KR')}원` : '-'}
                      </span>
                    </div>

                    {/* 발주서보기 */}
                    <div className="flex justify-end" onClick={e => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-blue-600 hover:text-blue-800"
                        onClick={() => onViewOrder(order)}
                      >
                        <FileText className="h-3.5 w-3.5 mr-1" />
                        발주서 보기
                      </Button>
                    </div>
                  </div>

                  {/* 모바일 아코디언: 견적서 상세 */}
                  {isExpanded && (
                    <div className="mx-3 mb-3 border-2 border-blue-300 rounded-lg overflow-hidden bg-white shadow-md">
                      <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-700 to-blue-600">
                        <Receipt className="h-4 w-4 text-white" />
                        <span className="text-sm font-bold text-white tracking-wide">견적서</span>
                        <span className="text-xs text-blue-200 ml-1 truncate">— {order.businessName}</span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        <div className="px-3 py-1.5 bg-gray-100 text-xs font-bold text-gray-600 tracking-widest uppercase">[ 장비 ]</div>
                        {amounts.equipItems.length > 0 ? amounts.equipItems.map((item, idx) => {
                          const { product: displayName, model: displayModel } = splitItemName(item.itemName)
                          return (
                            <div key={item.id || `eq-${idx}`} className="flex items-center justify-between px-3 py-2.5">
                              <div>
                                <p className="font-medium text-sm text-gray-800">{displayName}</p>
                                {displayModel && <p className="text-[11px] text-gray-400 mt-0.5">{displayModel}</p>}
                                <p className="text-xs text-gray-500 mt-0.5 tabular-nums">{item.quantity}개 x {item.unitPrice.toLocaleString('ko-KR')}원</p>
                              </div>
                              <p className="font-bold text-sm text-gray-800 tabular-nums">{item.totalPrice.toLocaleString('ko-KR')}</p>
                            </div>
                          )
                        }) : (
                          <div className="px-3 py-3 text-center text-xs text-gray-400">장비 항목 없음</div>
                        )}
                        {amounts.equipRounding > 0 && (
                          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-dashed border-gray-300">
                            <span className="text-xs text-gray-500">단위절사</span>
                            <span className="text-sm text-red-500 font-medium tabular-nums">-{amounts.equipRounding.toLocaleString('ko-KR')}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b-2 border-b-gray-300">
                          <span className="text-xs font-bold text-gray-700">장비비 소계</span>
                          <span className="text-sm font-bold text-gray-700 tabular-nums">{amounts.equipSubtotal.toLocaleString('ko-KR')}</span>
                        </div>

                        <div className="px-3 py-1.5 bg-gray-100 text-xs font-bold text-gray-600 tracking-widest uppercase">[ 설치비 ]</div>
                        {amounts.installItems.length > 0 ? amounts.installItems.map((item, idx) => {
                          const { product: displayName, model: displayModel } = splitItemName(item.itemName)
                          return (
                            <div key={item.id || `in-${idx}`} className="flex items-center justify-between px-3 py-2.5">
                              <div>
                                <p className="font-medium text-sm text-gray-800">{displayName}</p>
                                {displayModel && <p className="text-[11px] text-gray-400 mt-0.5">{displayModel}</p>}
                                <p className="text-xs text-gray-500 mt-0.5 tabular-nums">{item.quantity}개 x {item.unitPrice.toLocaleString('ko-KR')}원</p>
                              </div>
                              <p className="font-bold text-sm text-gray-800 tabular-nums">{item.totalPrice.toLocaleString('ko-KR')}</p>
                            </div>
                          )
                        }) : (
                          <div className="px-3 py-3 text-center text-xs text-gray-400">설치비 항목 없음</div>
                        )}
                        {amounts.installRounding > 0 && (
                          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-dashed border-gray-300">
                            <span className="text-xs text-gray-500">단위절사</span>
                            <span className="text-sm text-red-500 font-medium tabular-nums">-{amounts.installRounding.toLocaleString('ko-KR')}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b-2 border-b-gray-300">
                          <span className="text-xs font-bold text-gray-700">설치비 소계</span>
                          <span className="text-sm font-bold text-gray-700 tabular-nums">{amounts.installSubtotal.toLocaleString('ko-KR')}</span>
                        </div>

                        {/* 요약 카드 영역 */}
                        <div className="m-3 rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50/50">
                            <span className="text-[11px] text-gray-500">공급가액(장비+설치비)</span>
                            <span className="text-xs font-semibold text-gray-700 tabular-nums">{amounts.supplyAmount.toLocaleString('ko-KR')}</span>
                          </div>
                          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50/50">
                            <span className="text-[11px] text-amber-600">기업이윤(설치비 3%)</span>
                            <span className="text-xs font-semibold text-amber-700 tabular-nums">+{amounts.adjustedProfit.toLocaleString('ko-KR')}</span>
                          </div>
                          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-white">
                            <span className="text-[11px] font-bold text-gray-600">소계</span>
                            <span className="text-xs font-bold text-gray-800 tabular-nums">{amounts.subtotalWithProfit.toLocaleString('ko-KR')}</span>
                          </div>
                          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50/50">
                            <span className="text-[11px] text-gray-500">VAT(10%)</span>
                            <span className="text-xs font-semibold text-gray-600 tabular-nums">+{amounts.vat.toLocaleString('ko-KR')}</span>
                          </div>
                          <div className="flex items-center justify-between px-3 py-2.5 bg-blue-600 text-white">
                            <span className="text-xs font-bold">최종금액</span>
                            <span className="text-sm font-black tabular-nums">{amounts.grandTotal.toLocaleString('ko-KR')}<span className="text-[11px] font-medium ml-0.5">원</span></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

/**
 * AS 계열사 그룹 컴포넌트
 * - 정산대기 상태의 AS 건을 계열사별로 묶어 표시
 * - 간단한 테이블: 접수일 / 사업자명 / AS사유 / AS비용 / 접수비 / 합계(부가세별도)
 */
function ASAffiliateGroup({
  affiliateName,
  requests,
}: {
  affiliateName: string
  requests: ASRequest[]
}) {
  const [isOpen, setIsOpen] = useState(requests.length > 0)

  /** 계열사 AS 합계 (백원단위 절사 + 부가세 계산) */
  const rawTotal = requests.reduce((sum, r) => sum + (r.totalAmount || 0), 0)
  const truncated = Math.floor(rawTotal / 1000) * 1000
  const truncationAmount = rawTotal - truncated
  const subtotal = truncated
  const vat = Math.floor(subtotal * 0.1)
  const totalWithVat = subtotal + vat

  return (
    <Card className={`transition-all ${isOpen && requests.length > 0 ? 'ring-1 ring-orange-200 shadow-md' : ''}`}>
      {/* AS 계열사 헤더 */}
      <button
        className={`w-full flex items-center justify-between px-6 py-4 rounded-t-xl transition-colors ${
          requests.length > 0
            ? (isOpen ? 'bg-orange-50/60' : 'hover:bg-gray-50')
            : ''
        }`}
        onClick={() => requests.length > 0 && setIsOpen(prev => !prev)}
        disabled={requests.length === 0}
      >
        <div className="flex items-center gap-3">
          <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${
            requests.length === 0 ? 'opacity-30' : (isOpen ? '' : '-rotate-90')
          }`} />
          <Wrench className="h-4 w-4 text-orange-500" />
          <h3 className="text-lg font-bold text-gray-800">{affiliateName} AS</h3>
          <span className="text-sm text-gray-500">({requests.length}건)</span>
        </div>
        {requests.length > 0 && (
          <div className="flex items-center gap-3 text-right">
            <div className="border-l border-gray-200 pl-3">
              <p className="text-[10px] text-gray-400 leading-tight">부가세별도</p>
              <p className="text-sm font-bold tabular-nums text-gray-700">{rawTotal.toLocaleString('ko-KR')}</p>
            </div>
            <div className="border-l border-gray-200 pl-3">
              <p className="text-[10px] text-gray-400 leading-tight">단위절사</p>
              <p className="text-sm font-bold tabular-nums text-red-500">-{truncationAmount.toLocaleString('ko-KR')}</p>
            </div>
            <div className="border-l border-gray-200 pl-3">
              <p className="text-[10px] text-gray-400 leading-tight">소계</p>
              <p className="text-sm font-bold tabular-nums text-gray-700">{subtotal.toLocaleString('ko-KR')}</p>
            </div>
            <div className="border-l border-gray-200 pl-3">
              <p className="text-[10px] text-gray-400 leading-tight">부가세</p>
              <p className="text-sm font-bold tabular-nums text-gray-500">{vat.toLocaleString('ko-KR')}</p>
            </div>
            <div className="border-l border-gray-200 pl-3">
              <p className="text-[10px] text-orange-500 leading-tight">부가세포함</p>
              <p className="text-base font-extrabold tabular-nums text-gray-900">{totalWithVat.toLocaleString('ko-KR')}원</p>
            </div>
          </div>
        )}
      </button>

      {/* 0건일 때 빈 상태 */}
      {requests.length === 0 && (
        <CardContent className="py-3 text-sm text-gray-400">
          AS 정산 대상이 없습니다.
        </CardContent>
      )}

      {/* 펼침: 테이블 */}
      {isOpen && requests.length > 0 && (
        <CardContent className="pt-0 pb-4 px-4">
          {/* 데스크톱 테이블 */}
          <div className="hidden md:block border rounded-lg overflow-x-auto">
            <table className="w-full" style={{ tableLayout: 'fixed', minWidth: '1050px' }}>
              <thead>
                <tr className="border-b-2 border-gray-800 bg-gray-50">
                  <th className="text-left p-2.5 text-xs font-bold uppercase tracking-wider text-gray-600" style={{ width: '90px' }}>접수일</th>
                  <th className="text-left p-2.5 text-xs font-bold uppercase tracking-wider text-gray-600" style={{ width: '120px' }}>사업자명</th>
                  <th className="text-left p-2.5 text-xs font-bold uppercase tracking-wider text-gray-600" style={{ width: '65px' }}>담당자</th>
                  <th className="text-left p-2.5 text-xs font-bold uppercase tracking-wider text-gray-600" style={{ width: '110px' }}>담당자번호</th>
                  <th className="text-left p-2.5 text-xs font-bold uppercase tracking-wider text-gray-600" style={{ width: '80px' }}>모델명</th>
                  <th className="text-left p-2.5 text-xs font-bold uppercase tracking-wider text-gray-600" style={{ width: '140px' }}>AS사유</th>
                  <th className="text-center p-2.5 text-xs font-bold uppercase tracking-wider text-gray-600" style={{ width: '90px' }}>처리일</th>
                  <th className="text-right p-2.5 text-xs font-bold uppercase tracking-wider text-gray-600" style={{ width: '80px' }}>AS비용</th>
                  <th className="text-right p-2.5 text-xs font-bold uppercase tracking-wider text-gray-600" style={{ width: '70px' }}>접수비</th>
                  <th className="text-left p-2.5 text-xs font-bold uppercase tracking-wider text-gray-600" style={{ width: '110px' }}>처리내역</th>
                  <th className="text-right p-2.5 text-xs font-bold uppercase tracking-wider text-gray-600" style={{ width: '110px' }}>합계(부가세별도)</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req, idx) => (
                  <tr
                    key={req.id}
                    className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors ${idx === requests.length - 1 ? 'border-b-2 border-b-gray-400' : ''}`}
                  >
                    <td className="p-2.5 text-xs tabular-nums whitespace-nowrap">{req.receptionDate || '-'}</td>
                    <td className="p-2.5"><p className="text-xs font-semibold truncate">{req.businessName}</p></td>
                    <td className="p-2.5 text-xs text-gray-600 truncate">{req.contactName || '-'}</td>
                    <td className="p-2.5 text-xs text-gray-600 whitespace-nowrap">{req.contactPhone || '-'}</td>
                    <td className="p-2.5 text-xs text-gray-600 truncate">{req.modelName || '-'}</td>
                    <td className="p-2.5"><p className="text-xs text-gray-600 truncate" title={req.asReason || ''}>{req.asReason || '-'}</p></td>
                    <td className="p-2.5 text-center text-xs tabular-nums text-gray-500 whitespace-nowrap">{req.processedDate || '-'}</td>
                    <td className="p-2.5 text-right text-xs tabular-nums text-gray-600 whitespace-nowrap">
                      {req.asCost ? `${req.asCost.toLocaleString('ko-KR')}` : '-'}
                    </td>
                    <td className="p-2.5 text-right text-xs tabular-nums text-gray-600 whitespace-nowrap">
                      {req.receptionFee ? `${req.receptionFee.toLocaleString('ko-KR')}` : '-'}
                    </td>
                    <td className="p-2.5"><p className="text-xs text-gray-500 truncate" title={req.processingDetails || ''}>{req.processingDetails || '-'}</p></td>
                    <td className="p-2.5 text-right text-xs font-bold tabular-nums text-gray-900 whitespace-nowrap">
                      {req.totalAmount ? `${req.totalAmount.toLocaleString('ko-KR')}원` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 리스트 */}
          <div className="md:hidden space-y-3">
            {requests.map(req => (
              <Card key={req.id} className="overflow-hidden">
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm truncate">{req.businessName}</h3>
                    <span className="text-sm font-bold tabular-nums text-gray-800">
                      {req.totalAmount ? `${req.totalAmount.toLocaleString('ko-KR')}원` : '-'}
                    </span>
                  </div>
                  {req.asReason && <p className="text-xs text-gray-500 truncate">AS사유: {req.asReason}</p>}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>접수 {req.receptionDate} · 처리 {req.processedDate || '-'}</span>
                    <span className="text-gray-400">AS비용 {req.asCost?.toLocaleString('ko-KR') || '-'} + 접수비 {req.receptionFee?.toLocaleString('ko-KR') || '-'}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

/**
 * 교원·멜레아 정산관리 메인 페이지
 */
export default function SettlementsPage() {
  // 데이터 로딩
  const [orders, setOrders] = useState<Order[]>([])
  const [asRequests, setAsRequests] = useState<ASRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchOrders(), fetchASRequests()]).then(([orderData, asData]) => {
      setOrders(orderData)
      setAsRequests(asData)
      setIsLoading(false)
    })
  }, [])

  // 월 선택기 상태
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)

  // 아코디언 펼침 상태
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // 발주서 상세 다이얼로그 상태
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // 월별 정산 확인 (Supabase 기반)
  const [confirmation, setConfirmation] = useState<SettlementConfirmation | null>(null)
  const [melleeaInput, setMelleeaInput] = useState('')
  const [melleeaName, setMelleeaName] = useState('')
  const [kyowonInput, setKyowonInput] = useState('')
  const [kyowonName, setKyowonName] = useState('')

  // 월 변경 시 정산 확인 데이터 로드
  useEffect(() => {
    const loadConfirmation = async () => {
      const data = await fetchSettlementConfirmation(selectedYear, selectedMonth)
      setConfirmation(data)
      setMelleeaInput(data?.melleeaAmount != null ? String(data.melleeaAmount) : '')
      setKyowonInput(data?.kyowonAmount != null ? String(data.kyowonAmount) : '')
    }
    loadConfirmation()
  }, [selectedYear, selectedMonth])

  /** 정산 확인금액 저장 */
  const handleConfirmAmount = useCallback(async (side: 'mellea' | 'kyowon') => {
    const rawInput = side === 'mellea' ? melleeaInput : kyowonInput
    const name = side === 'mellea' ? melleeaName : kyowonName
    const amount = parseInt(rawInput.replace(/[^0-9]/g, ''), 10)
    if (isNaN(amount) || amount <= 0 || !name.trim()) return

    const ok = await saveSettlementConfirmation(selectedYear, selectedMonth, side, amount, name.trim())
    if (ok) {
      const data = await fetchSettlementConfirmation(selectedYear, selectedMonth)
      setConfirmation(data)
    }
  }, [melleeaInput, melleeaName, kyowonInput, kyowonName, selectedYear, selectedMonth])

  /** 정산 확인 초기화 */
  const handleClearConfirmation = useCallback(async (side: 'mellea' | 'kyowon') => {
    const ok = await clearSettlementConfirmation(selectedYear, selectedMonth, side)
    if (ok) {
      if (side === 'mellea') { setMelleeaInput(''); setMelleeaName('') }
      else { setKyowonInput(''); setKyowonName('') }
      const data = await fetchSettlementConfirmation(selectedYear, selectedMonth)
      setConfirmation(data)
    }
  }, [selectedYear, selectedMonth])

  /** 아코디언 토글 */
  const handleToggleExpand = useCallback((orderId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }, [])

  /** 발주서 상세 보기 */
  const handleViewOrder = useCallback((order: Order) => {
    setDetailOrder(order)
    setDetailOpen(true)
  }, [])

  /** 월 이동 */
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedYear(y => y - 1)
      setSelectedMonth(12)
    } else {
      setSelectedMonth(m => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedYear(y => y + 1)
      setSelectedMonth(1)
    } else {
      setSelectedMonth(m => m + 1)
    }
  }

  /**
   * 정산 대상 필터링
   */
  const filteredOrders = useMemo(() => {
    const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`

    return orders.filter(order => {
      if (order.status === 'cancelled') return false
      const s1Status = order.s1SettlementStatus || 'unsettled'
      if (s1Status === 'unsettled') return false
      const orderMonth = order.s1SettlementMonth
        || (order.installCompleteDate ? order.installCompleteDate.substring(0, 7) : null)
      return orderMonth === monthKey
    })
  }, [orders, selectedYear, selectedMonth])

  /** 계열사별 그룹화 */
  const affiliateGroups = useMemo(() => {
    const groups: Record<string, Order[]> = {}
    AFFILIATE_OPTIONS.forEach(aff => { groups[aff] = [] })

    filteredOrders.forEach(order => {
      const affiliate = order.affiliate || '기타'
      if (groups[affiliate]) {
        groups[affiliate].push(order)
      } else {
        groups['기타'].push(order)
      }
    })

    return AFFILIATE_OPTIONS.map(aff => ({
      name: aff,
      orders: groups[aff],
    }))
  }, [filteredOrders])

  /** AS 정산 필터링 (선택한 월 + 정산대기 또는 정산완료 상태) */
  const filteredASRequests = useMemo(() => {
    const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
    return asRequests.filter(req => {
      // 정산대기(completed) + 정산완료(settled) 모두 표시
      if (req.status !== 'completed' && req.status !== 'settled') return false
      return req.settlementMonth === monthKey
    })
  }, [asRequests, selectedYear, selectedMonth])

  /** AS 계열사별 그룹화 */
  const asAffiliateGroups = useMemo(() => {
    const groups: Record<string, ASRequest[]> = {}
    AFFILIATE_OPTIONS.forEach(aff => { groups[aff] = [] })

    filteredASRequests.forEach(req => {
      const affiliate = req.affiliate || '기타'
      if (groups[affiliate]) {
        groups[affiliate].push(req)
      } else {
        if (!groups['기타']) groups['기타'] = []
        groups['기타'].push(req)
      }
    })

    return AFFILIATE_OPTIONS.map(aff => ({
      name: aff,
      requests: groups[aff],
    }))
  }, [filteredASRequests])

  /** AS 전체 합계 (계열사별 백원단위 절사 후 합산) */
  const asTotalAmount = useMemo(() => {
    return asAffiliateGroups.reduce((sum, group) => {
      const rawGroupTotal = group.requests.reduce((s, r) => s + (r.totalAmount || 0), 0)
      return sum + Math.floor(rawGroupTotal / 1000) * 1000
    }, 0)
  }, [asAffiliateGroups])

  /** 전체 합계 */
  const totalCount = filteredOrders.length
  const grandTotals = useMemo(() => {
    return filteredOrders.reduce((acc, order) => {
      const amounts = calcOrderAmounts(order)
      return {
        subtotal: acc.subtotal + amounts.subtotalWithProfit,
        vat: acc.vat + amounts.vat,
        total: acc.total + amounts.grandTotal,
      }
    }, { subtotal: 0, vat: 0, total: 0 })
  }, [filteredOrders])

  /** 계열사별 합계 */
  const affiliateTotals = useMemo(() => {
    return affiliateGroups.map(group => {
      const total = group.orders.reduce((sum, order) => sum + calcOrderAmounts(order).grandTotal, 0)
      return {
        name: group.name,
        count: group.orders.length,
        total,
        color: AFFILIATE_COLORS[group.name] || 'bg-gray-400',
      }
    })
  }, [affiliateGroups])

  return (
    <div className="container mx-auto py-8 px-4">
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
          <Receipt className="h-6 w-6 text-primary" /> 교원·멜레아 정산관리
        </h1>
        <p className="text-muted-foreground">교원그룹과 멜레아 간 월별 견적 기반 매출/매입 정산을 관리합니다.</p>
      </div>

      {/* 월 선택기 */}
      <div className="flex justify-center mb-6">
        <div className="bg-white border rounded-xl px-6 py-3 shadow-sm flex items-center gap-4">
          <span className="text-xs text-gray-500 font-medium">정산 기준월</span>
          <button
            className="p-2 rounded-lg border hover:bg-gray-100 transition-colors"
            onClick={handlePrevMonth}
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <h2 className="text-xl font-bold text-gray-900 min-w-[140px] text-center">
            {selectedYear}년 {selectedMonth}월
          </h2>
          <button
            className="p-2 rounded-lg border hover:bg-gray-100 transition-colors"
            onClick={handleNextMonth}
          >
            <ChevronRightIcon className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* 통계 요약 */}
      <Card className="bg-gray-300 border-2 border-gray-400 shadow-md mb-10">
        <CardContent className="py-5">
          {/* ── 설치 정산 ── */}
          <div className="bg-white rounded-lg px-4 py-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <CircleDollarSign className="h-4 w-4 text-blue-500" />
              <p className="text-sm font-bold text-gray-800">설치 정산</p>
              <span className="text-xs text-gray-500">({totalCount}건)</span>
              {grandTotals.total > 0 && (
                <span className="text-sm font-bold tabular-nums text-blue-700 ml-auto">
                  {grandTotals.total.toLocaleString('ko-KR')}원
                  <span className="text-[10px] text-gray-400 font-normal ml-1">VAT포함</span>
                </span>
              )}
            </div>
            {grandTotals.total > 0 && (
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 ml-6">
                {affiliateTotals.map(t => (
                  <div key={t.name} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${t.color} inline-block`} />
                    <span className="text-xs text-gray-600">{t.name}</span>
                    <span className="text-xs tabular-nums font-semibold text-gray-800">
                      {t.count > 0 ? `${t.count}건 / ${t.total.toLocaleString('ko-KR')}원` : '-'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── AS 정산 ── */}
          <div className="bg-white rounded-lg px-4 py-3 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="h-4 w-4 text-orange-500" />
              <p className="text-sm font-bold text-gray-800">AS 정산</p>
              <span className="text-xs text-gray-500">({filteredASRequests.length}건)</span>
              {asTotalAmount > 0 && (
                <span className="text-sm font-bold tabular-nums text-orange-700 ml-auto">
                  {(asTotalAmount + Math.floor(asTotalAmount * 0.1)).toLocaleString('ko-KR')}원
                  <span className="text-[10px] text-gray-400 font-normal ml-1">VAT포함</span>
                </span>
              )}
            </div>
            {filteredASRequests.length > 0 && (
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 ml-6">
                {asAffiliateGroups.map(g => {
                  const gRaw = g.requests.reduce((s, r) => s + (r.totalAmount || 0), 0)
                  const gTruncated = Math.floor(gRaw / 1000) * 1000
                  const gWithVat = gTruncated + Math.floor(gTruncated * 0.1)
                  return (
                    <div key={g.name} className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${AFFILIATE_COLORS[g.name] || 'bg-gray-400'} inline-block`} />
                      <span className="text-xs text-gray-600">{g.name} AS</span>
                      <span className="text-xs tabular-nums font-semibold text-gray-800">
                        {g.requests.length > 0
                          ? `${g.requests.length}건 / ${gWithVat.toLocaleString('ko-KR')}원`
                          : '-'
                        }
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── 최종 정산금액 (설치 + AS 합산 VAT포함) ── */}
          {(() => {
            const asVatTotal = asTotalAmount + Math.floor(asTotalAmount * 0.1)
            const finalTotal = grandTotals.total + asVatTotal
            const finalCount = totalCount + filteredASRequests.length
            return (
              <div className="bg-blue-700 rounded-lg px-5 py-4 text-center">
                <p className="text-xs text-blue-200 font-medium mb-1">
                  총 {finalCount}건 최종 정산금액 (VAT포함)
                </p>
                <p className="text-3xl md:text-4xl font-black tabular-nums text-white">
                  {finalTotal.toLocaleString('ko-KR')}
                  <span className="text-lg font-bold text-blue-200 ml-1">원</span>
                </p>
              </div>
            )
          })()}

          {/* 월별 정산 확인 — 멜레아/교원 각각 확인금액 입력 */}
          <div className="bg-white rounded-lg px-4 py-3 mt-3">
            <p className="text-xs font-bold text-gray-700 mb-3">{selectedYear}년 {selectedMonth}월 정산 확인</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* 멜레아 확인 */}
              <div className={`rounded-lg border-2 p-3 ${confirmation?.melleeaConfirmedAt ? 'border-green-300 bg-green-50/50' : 'border-gray-200 bg-gray-50'}`}>
                <p className="text-xs font-semibold text-gray-600 mb-2">멜레아 확인금액</p>
                {confirmation?.melleeaConfirmedAt ? (
                  <div>
                    <p className="text-lg font-black tabular-nums text-green-700">
                      {(confirmation.melleeaAmount || 0).toLocaleString('ko-KR')}원
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      담당: <span className="font-semibold text-gray-600">{confirmation.melleeaConfirmedBy || '-'}</span>
                      {' · '}
                      {new Date(confirmation.melleeaConfirmedAt).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <button
                      onClick={() => handleClearConfirmation('mellea')}
                      className="text-[10px] text-red-400 hover:text-red-600 mt-1 underline"
                    >
                      초기화
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={melleeaName}
                        onChange={e => setMelleeaName(e.target.value)}
                        placeholder="담당자명"
                        className="w-20 border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                      />
                      <input
                        type="text"
                        value={melleeaInput}
                        onChange={e => setMelleeaInput(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="금액 입력"
                        className="flex-1 border rounded px-2 py-1.5 text-sm tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-green-300"
                      />
                      <span className="text-xs text-gray-500">원</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleConfirmAmount('mellea')}
                      disabled={!melleeaInput || !melleeaName.trim()}
                      className="w-full bg-green-600 hover:bg-green-700 text-white text-xs"
                    >
                      확인
                    </Button>
                  </div>
                )}
              </div>

              {/* 교원 확인 */}
              <div className={`rounded-lg border-2 p-3 ${confirmation?.kyowonConfirmedAt ? 'border-blue-300 bg-blue-50/50' : 'border-gray-200 bg-gray-50'}`}>
                <p className="text-xs font-semibold text-gray-600 mb-2">교원 확인금액</p>
                {confirmation?.kyowonConfirmedAt ? (
                  <div>
                    <p className="text-lg font-black tabular-nums text-blue-700">
                      {(confirmation.kyowonAmount || 0).toLocaleString('ko-KR')}원
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      담당: <span className="font-semibold text-gray-600">{confirmation.kyowonConfirmedBy || '-'}</span>
                      {' · '}
                      {new Date(confirmation.kyowonConfirmedAt).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <button
                      onClick={() => handleClearConfirmation('kyowon')}
                      className="text-[10px] text-red-400 hover:text-red-600 mt-1 underline"
                    >
                      초기화
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={kyowonName}
                        onChange={e => setKyowonName(e.target.value)}
                        placeholder="담당자명"
                        className="w-20 border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                      <input
                        type="text"
                        value={kyowonInput}
                        onChange={e => setKyowonInput(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="금액 입력"
                        className="flex-1 border rounded px-2 py-1.5 text-sm tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                      <span className="text-xs text-gray-500">원</span>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleConfirmAmount('kyowon')}
                      disabled={!kyowonInput || !kyowonName.trim()}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs"
                    >
                      확인
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* 양측 모두 확인 완료 시 일치/불일치 표시 */}
            {confirmation?.melleeaConfirmedAt && confirmation?.kyowonConfirmedAt && (
              <div className={`mt-3 rounded-lg px-3 py-2 text-center text-sm font-bold ${
                confirmation.melleeaAmount === confirmation.kyowonAmount
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {confirmation.melleeaAmount === confirmation.kyowonAmount
                  ? '양측 금액 일치 — 정산 확인 완료'
                  : `차액 ${Math.abs((confirmation.melleeaAmount || 0) - (confirmation.kyowonAmount || 0)).toLocaleString('ko-KR')}원 — 확인 필요`
                }
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 로딩 */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            데이터를 불러오는 중...
          </CardContent>
        </Card>
      ) : (
        /* 계열사별 그룹 */
        <div className="space-y-4">
          {affiliateGroups.map(group => (
            <AffiliateGroup
              key={group.name}
              affiliateName={group.name}
              orders={group.orders}
              expandedIds={expandedIds}
              onToggleExpand={handleToggleExpand}
              onViewOrder={handleViewOrder}
            />
          ))}

          {/* AS 정산 구분선 */}
          <div className="flex items-center gap-3 pt-4 pb-1">
            <Wrench className="h-5 w-5 text-orange-500" />
            <h2 className="text-lg font-bold text-gray-700">AS 정산</h2>
            <div className="flex-1 border-t border-orange-200" />
          </div>

          {/* AS 계열사별 그룹 */}
          {asAffiliateGroups.map(group => (
            <ASAffiliateGroup
              key={`as-${group.name}`}
              affiliateName={group.name}
              requests={group.requests}
            />
          ))}
        </div>
      )}

      {/* 발주서 상세 다이얼로그 */}
      <OrderDetailDialog
        order={detailOrder}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  )
}
