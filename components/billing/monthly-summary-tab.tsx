/**
 * 정산관리 탭 (탭 3)
 *
 * 한 달의 돈 흐름을 4개 카드로 요약합니다.
 * - 매출 합계: 교원→멜레아 (VAT포함)
 * - 매입 합계: 멜레아→삼성 (구성품 매입비)
 * - 설치비 합계: 멜레아→에스원 (설치비)
 * - 순이익: 매출 - 매입 - 설치비
 */

'use client'

import React, { useMemo } from 'react'
import type { Order } from '@/types/order'
import { TrendingUp, TrendingDown, ShoppingCart, Wrench, CircleDollarSign, AlertTriangle, BarChart3 } from 'lucide-react'
import { ExcelExportButton } from '@/components/ui/excel-export-button'
import { exportToExcel, buildExcelFileName } from '@/lib/excel-export'
import type { ExcelColumn } from '@/lib/excel-export'

/** calcBillingAmounts 반환 타입 */
interface BillingAmounts {
  sales: number
  samsungPurchase: number
  hasSamsungData: boolean
  installCost: number
  margin: number
}

interface MonthlySummaryTabProps {
  orders: Order[]
  calcAmounts: (order: Order) => BillingAmounts
  selectedYear: number
  selectedMonth: number
}

export function MonthlySummaryTab({ orders, calcAmounts, selectedYear, selectedMonth }: MonthlySummaryTabProps) {
  // 전체 합계 계산
  const totals = useMemo(() => {
    const result = orders.reduce(
      (acc, order) => {
        const amounts = calcAmounts(order)
        return {
          sales: acc.sales + amounts.sales,
          samsungPurchase: acc.samsungPurchase + amounts.samsungPurchase,
          installCost: acc.installCost + amounts.installCost,
          margin: acc.margin + amounts.margin,
          missingPurchaseCount: acc.missingPurchaseCount + (amounts.hasSamsungData ? 0 : 1),
        }
      },
      { sales: 0, samsungPurchase: 0, installCost: 0, margin: 0, missingPurchaseCount: 0 }
    )
    // 마진율: 매출 대비 마진 비율
    const marginRate = result.sales > 0 ? (result.margin / result.sales) * 100 : 0
    return { ...result, marginRate }
  }, [orders, calcAmounts])

  /** 엑셀 다운로드 — 정산요약 */
  const handleExcelExport = () => {
    // 발주건별 상세 요약을 엑셀로 추출
    interface SummaryRow { businessName: string; sales: number; samsungPurchase: number; installCost: number; margin: number }
    const columns: ExcelColumn<SummaryRow>[] = [
      { header: '사업자명', key: 'businessName', width: 20 },
      { header: '매출(VAT포함)', key: 'sales', width: 14, numberFormat: '#,##0' },
      { header: '삼성매입비', key: 'samsungPurchase', width: 14, numberFormat: '#,##0' },
      { header: '에스원설치비', key: 'installCost', width: 14, numberFormat: '#,##0' },
      { header: '순이익', key: 'margin', width: 14, numberFormat: '#,##0' },
    ]
    const data: SummaryRow[] = orders.map(order => {
      const amounts = calcAmounts(order)
      return {
        businessName: order.businessName,
        sales: amounts.sales,
        samsungPurchase: amounts.samsungPurchase,
        installCost: amounts.installCost,
        margin: amounts.margin,
      }
    })
    const monthLabel = `${selectedYear}년${selectedMonth}월`
    exportToExcel({
      data,
      columns,
      fileName: buildExcelFileName('멜레아정산_정산관리', monthLabel),
      sheetName: '정산관리',
    })
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="py-16 text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 text-lg">이 달의 정산 대상이 없습니다.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 엑셀 다운로드 */}
      <div className="flex justify-end">
        <ExcelExportButton onClick={handleExcelExport} disabled={orders.length === 0} />
      </div>

      {/* 4개 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 매출 합계 */}
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
              <TrendingUp className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold text-slate-700">매출 합계</p>
          </div>
          <p className="text-2xl font-black tabular-nums text-blue-700">
            {totals.sales.toLocaleString('ko-KR')}
            <span className="text-sm font-bold text-blue-400 ml-1">원</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">교원→멜레아 (VAT포함) · {orders.length}건</p>
        </div>

        {/* 매입 합계 */}
        <div className="bg-white rounded-xl border border-red-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-red-50 text-red-600 p-2 rounded-lg">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold text-slate-700">매입 합계</p>
          </div>
          <p className="text-2xl font-black tabular-nums text-red-600">
            {totals.samsungPurchase.toLocaleString('ko-KR')}
            <span className="text-sm font-bold text-red-400 ml-1">원</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">
            멜레아→삼성
            {totals.missingPurchaseCount > 0 && (
              <span className="text-amber-600 ml-2 inline-flex items-center gap-0.5">
                <AlertTriangle className="h-3 w-3" />
                {totals.missingPurchaseCount}건 미입력
              </span>
            )}
          </p>
        </div>

        {/* 설치비 합계 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-slate-100 text-slate-600 p-2 rounded-lg">
              <Wrench className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold text-slate-700">설치비 합계</p>
          </div>
          <p className="text-2xl font-black tabular-nums text-slate-700">
            {totals.installCost.toLocaleString('ko-KR')}
            <span className="text-sm font-bold text-slate-400 ml-1">원</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">멜레아→에스원</p>
        </div>

        {/* 순이익 */}
        <div className={`rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow ${
          totals.margin >= 0
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`p-2 rounded-lg ${totals.margin >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
              {totals.margin >= 0 ? <CircleDollarSign className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            </div>
            <p className="text-sm font-bold text-slate-700">순이익</p>
          </div>
          <p className={`text-2xl font-black tabular-nums ${totals.margin >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
            {totals.margin.toLocaleString('ko-KR')}
            <span className={`text-sm font-bold ml-1 ${totals.margin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>원</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">
            마진율 {totals.marginRate.toFixed(1)}%
            {totals.missingPurchaseCount > 0 && (
              <span className="text-amber-600 ml-2 inline-flex items-center gap-0.5">
                <AlertTriangle className="h-3 w-3" />
                삼성매입 미입력 포함
              </span>
            )}
          </p>
        </div>
      </div>

      {/* 돈 흐름 시각화 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-bold text-slate-700 mb-4">돈 흐름 요약</h3>

        {/* 바 차트 (비율 시각화) */}
        <div className="space-y-4">
          {/* 매출 바 (기준: 100%) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">매출 (수입)</span>
              <span className="text-xs font-bold text-blue-700 tabular-nums">{totals.sales.toLocaleString('ko-KR')}원</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-5">
              <div className="bg-blue-500 h-5 rounded-full" style={{ width: '100%' }} />
            </div>
          </div>

          {/* 매입 바 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">삼성매입 (지출)</span>
              <span className="text-xs font-bold text-red-600 tabular-nums">{totals.samsungPurchase.toLocaleString('ko-KR')}원</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-5">
              <div
                className="bg-red-400 h-5 rounded-full"
                style={{ width: `${totals.sales > 0 ? Math.min((totals.samsungPurchase / totals.sales) * 100, 100) : 0}%` }}
              />
            </div>
          </div>

          {/* 설치비 바 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">에스원설치비 (지출)</span>
              <span className="text-xs font-bold text-slate-600 tabular-nums">{totals.installCost.toLocaleString('ko-KR')}원</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-5">
              <div
                className="bg-slate-400 h-5 rounded-full"
                style={{ width: `${totals.sales > 0 ? Math.min((totals.installCost / totals.sales) * 100, 100) : 0}%` }}
              />
            </div>
          </div>

          {/* 순이익 바 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500">순이익</span>
              <span className={`text-xs font-bold tabular-nums ${totals.margin >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {totals.margin.toLocaleString('ko-KR')}원 ({totals.marginRate.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-5">
              <div
                className={`h-5 rounded-full ${totals.margin >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                style={{ width: `${totals.sales > 0 ? Math.min(Math.abs(totals.margin) / totals.sales * 100, 100) : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* 계산식 */}
        <div className="mt-6 bg-slate-50 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-2">계산식</p>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-bold text-blue-700 tabular-nums">{totals.sales.toLocaleString('ko-KR')}</span>
            <span className="text-slate-400">−</span>
            <span className="font-bold text-red-600 tabular-nums">{totals.samsungPurchase.toLocaleString('ko-KR')}</span>
            <span className="text-slate-400">−</span>
            <span className="font-bold text-slate-600 tabular-nums">{totals.installCost.toLocaleString('ko-KR')}</span>
            <span className="text-slate-400">=</span>
            <span className={`font-black tabular-nums ${totals.margin >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {totals.margin.toLocaleString('ko-KR')}원
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            매출(교원→멜레아) − 삼성매입(멜레아→삼성) − 에스원설치비(멜레아→에스원) = 순이익
          </p>
        </div>
      </div>

      {/* 경고: 삼성매입 미입력 */}
      {totals.missingPurchaseCount > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 shadow-sm p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">삼성매입비 미입력 {totals.missingPurchaseCount}건</p>
            <p className="text-xs text-amber-600 mt-1">
              배송관리에서 구성품 단가를 입력하지 않은 건이 있습니다.
              매입비가 0으로 계산되어 순이익이 실제보다 높게 표시됩니다.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
