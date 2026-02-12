/**
 * 지출결의서 탭 (탭 1)
 *
 * 발주건별 매출/매입/설치비/마진을 한 줄씩 보여주는 상세 목록입니다.
 * - 매출: 교원이 멜레아에 지불하는 금액 (VAT 포함)
 * - 삼성매입비: 멜레아가 삼성에 지불하는 구성품 매입비
 * - 에스원설치비: 멜레아가 에스원에 지불하는 설치비
 * - 마진: 매출 - 삼성매입비 - 에스원설치비
 */

'use client'

import React from 'react'
import type { Order } from '@/types/order'
import { sortWorkTypes, getWorkTypeBadgeStyle } from '@/types/order'
import { formatShortDate } from '@/lib/delivery-utils'
import { FileText, PlusCircle, ArrowRightLeft, Archive, Trash2, Package, RotateCcw, AlertTriangle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** 작업종류 아이콘 매핑 */
const WORK_TYPE_ICON_MAP: Record<string, LucideIcon> = {
  '신규설치': PlusCircle,
  '이전설치': ArrowRightLeft,
  '철거보관': Archive,
  '철거폐기': Trash2,
  '재고설치': Package,
  '반납폐기': RotateCcw,
}

/** calcBillingAmounts 반환 타입 */
interface BillingAmounts {
  sales: number
  samsungPurchase: number
  hasSamsungData: boolean
  installCost: number
  margin: number
}

interface ExpenseReportTabProps {
  orders: Order[]
  calcAmounts: (order: Order) => BillingAmounts
}

export function ExpenseReportTab({ orders, calcAmounts }: ExpenseReportTabProps) {
  // 전체 합계 계산
  const totals = orders.reduce(
    (acc, order) => {
      const amounts = calcAmounts(order)
      return {
        sales: acc.sales + amounts.sales,
        samsungPurchase: acc.samsungPurchase + amounts.samsungPurchase,
        installCost: acc.installCost + amounts.installCost,
        margin: acc.margin + amounts.margin,
      }
    },
    { sales: 0, samsungPurchase: 0, installCost: 0, margin: 0 }
  )

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="py-16 text-center">
          <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 text-lg">이 달의 정산 대상이 없습니다.</p>
          <p className="text-sm text-slate-400 mt-1">에스원 정산에서 &apos;진행중&apos; 이상인 건이 표시됩니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* 결과 건수 */}
      <p className="text-sm text-slate-500 mb-3">총 {orders.length}건</p>

      {/* 데스크톱 테이블 */}
      <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full" style={{ minWidth: '900px' }}>
          <thead>
            <tr className="bg-slate-50/80 border-b-2 border-slate-800">
              <th className="text-left p-3 text-xs text-slate-500 font-semibold" style={{ width: '85px' }}>발주일</th>
              <th className="text-left p-3 text-xs text-slate-500 font-semibold">현장명</th>
              <th className="text-left p-3 text-xs text-slate-500 font-semibold" style={{ width: '110px' }}>작업종류</th>
              <th className="text-right p-3 text-xs text-slate-500 font-semibold" style={{ width: '130px' }}>매출(VAT포함)</th>
              <th className="text-right p-3 text-xs text-slate-500 font-semibold" style={{ width: '120px' }}>삼성매입비</th>
              <th className="text-right p-3 text-xs text-slate-500 font-semibold" style={{ width: '120px' }}>에스원설치비</th>
              <th className="text-right p-3 text-xs text-slate-500 font-semibold" style={{ width: '120px' }}>마진</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => {
              const amounts = calcAmounts(order)
              const workTypes = sortWorkTypes(Array.from(new Set(order.items.map(i => i.workType))))
              // 삼성매입비 미입력 경고: 매출이 있는데 삼성매입비가 0이면 마진 왜곡 가능
              const showWarning = amounts.sales > 0 && !amounts.hasSamsungData

              return (
                <tr key={order.id} className="border-b border-slate-100 hover:bg-blue-50/40 transition-colors">
                  {/* 발주일 */}
                  <td className="p-3 text-sm tabular-nums">{formatShortDate(order.orderDate)}</td>

                  {/* 현장명 */}
                  <td className="p-3">
                    <p className="font-semibold text-sm truncate" title={order.businessName}>{order.businessName}</p>
                    <p className="text-xs text-slate-400 truncate" title={order.address}>{order.address}</p>
                  </td>

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

                  {/* 매출 */}
                  <td className="p-3 text-right">
                    <p className="text-sm font-semibold tabular-nums text-blue-700">
                      {amounts.sales > 0 ? amounts.sales.toLocaleString('ko-KR') : '-'}
                    </p>
                  </td>

                  {/* 삼성매입비 */}
                  <td className="p-3 text-right">
                    {amounts.hasSamsungData ? (
                      <p className="text-sm tabular-nums text-red-600">
                        {amounts.samsungPurchase.toLocaleString('ko-KR')}
                      </p>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                        <AlertTriangle className="h-3 w-3" />
                        미입력
                      </span>
                    )}
                  </td>

                  {/* 에스원설치비 */}
                  <td className="p-3 text-right">
                    <p className="text-sm tabular-nums text-slate-600">
                      {amounts.installCost > 0 ? amounts.installCost.toLocaleString('ko-KR') : '-'}
                    </p>
                  </td>

                  {/* 마진 */}
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {showWarning && (
                        <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" title="삼성매입비 미입력 — 마진이 실제보다 높게 표시됩니다" />
                      )}
                      <p className={`text-sm font-bold tabular-nums ${amounts.margin >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {amounts.margin.toLocaleString('ko-KR')}
                      </p>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>

          {/* 합계 행 */}
          <tfoot>
            <tr className="bg-slate-100 border-t-2 border-slate-800">
              <td colSpan={3} className="p-3 text-sm font-bold text-slate-800">
                합계 ({orders.length}건)
              </td>
              <td className="p-3 text-right">
                <p className="text-sm font-bold tabular-nums text-blue-700">{totals.sales.toLocaleString('ko-KR')}</p>
              </td>
              <td className="p-3 text-right">
                <p className="text-sm font-bold tabular-nums text-red-600">{totals.samsungPurchase.toLocaleString('ko-KR')}</p>
              </td>
              <td className="p-3 text-right">
                <p className="text-sm font-bold tabular-nums text-slate-600">{totals.installCost.toLocaleString('ko-KR')}</p>
              </td>
              <td className="p-3 text-right">
                <p className={`text-sm font-bold tabular-nums ${totals.margin >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {totals.margin.toLocaleString('ko-KR')}
                </p>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 모바일 카드 리스트 */}
      <div className="md:hidden space-y-3">
        {orders.map(order => {
          const amounts = calcAmounts(order)
          const workTypes = sortWorkTypes(Array.from(new Set(order.items.map(i => i.workType))))
          const showWarning = amounts.sales > 0 && !amounts.hasSamsungData

          return (
            <div key={order.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 space-y-3">
                {/* 상단: 작업종류 뱃지 */}
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

                {/* 현장명 + 발주일 */}
                <div>
                  <h3 className="font-semibold text-sm">{order.businessName}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">발주 {formatShortDate(order.orderDate)}</p>
                </div>

                {/* 금액 2x2 그리드 */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-blue-50 rounded-lg px-3 py-2">
                    <p className="text-blue-500">매출</p>
                    <p className="font-bold text-blue-700 tabular-nums">{amounts.sales > 0 ? `${amounts.sales.toLocaleString('ko-KR')}원` : '-'}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg px-3 py-2">
                    <p className="text-red-400">삼성매입</p>
                    {amounts.hasSamsungData ? (
                      <p className="font-bold text-red-600 tabular-nums">{amounts.samsungPurchase.toLocaleString('ko-KR')}원</p>
                    ) : (
                      <p className="text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />미입력
                      </p>
                    )}
                  </div>
                  <div className="bg-slate-50 rounded-lg px-3 py-2">
                    <p className="text-slate-400">에스원설치비</p>
                    <p className="font-bold text-slate-600 tabular-nums">{amounts.installCost > 0 ? `${amounts.installCost.toLocaleString('ko-KR')}원` : '-'}</p>
                  </div>
                  <div className={`rounded-lg px-3 py-2 ${amounts.margin >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                    <p className={amounts.margin >= 0 ? 'text-emerald-500' : 'text-red-400'}>마진</p>
                    <div className="flex items-center gap-1">
                      {showWarning && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                      <p className={`font-bold tabular-nums ${amounts.margin >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {amounts.margin.toLocaleString('ko-KR')}원
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {/* 모바일 합계 카드 */}
        <div className="bg-slate-800 rounded-xl p-4 text-white">
          <p className="text-xs text-slate-300 mb-2">합계 ({orders.length}건)</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-blue-300 text-xs">매출</p>
              <p className="font-bold tabular-nums">{totals.sales.toLocaleString('ko-KR')}</p>
            </div>
            <div>
              <p className="text-red-300 text-xs">삼성매입</p>
              <p className="font-bold tabular-nums">{totals.samsungPurchase.toLocaleString('ko-KR')}</p>
            </div>
            <div>
              <p className="text-slate-300 text-xs">에스원설치비</p>
              <p className="font-bold tabular-nums">{totals.installCost.toLocaleString('ko-KR')}</p>
            </div>
            <div>
              <p className="text-emerald-300 text-xs">마진</p>
              <p className={`font-bold tabular-nums ${totals.margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {totals.margin.toLocaleString('ko-KR')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
