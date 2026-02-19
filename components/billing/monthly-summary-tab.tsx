/**
 * 정산관리 탭 (탭 3) — 교원·멜레아 정산관리와 동일한 계열사별 아코디언 UI
 *
 * "생성하기" 버튼으로 현재 정산 데이터를 DB에 스냅샷 저장합니다.
 * 저장된 확정본은 교원·멜레아 정산관리 페이지와 동일한 UI로 표시됩니다.
 * (상단 통계 카드 제외)
 */

'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import type { Order } from '@/types/order'
import {
  AFFILIATE_OPTIONS,
  sortWorkTypes,
  getWorkTypeBadgeStyle,
} from '@/types/order'
import { Button } from '@/components/ui/button'
import {
  Receipt, ChevronDown, Plus, Loader2,
  PlusCircle, ArrowRightLeft, Archive, Trash2, Package, RotateCcw,
  Wrench, RefreshCw, CircleDollarSign,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatShortDate } from '@/lib/delivery-utils'
import { SitePhotoViewer } from '@/components/schedule/site-photo-viewer'
import {
  fetchASRequests,
  fetchSettlementReport,
  saveSettlementReport,
} from '@/lib/supabase/dal'
import type {
  SettlementReport,
  SettlementReportItem,
  SettlementReportAsItem,
} from '@/lib/supabase/dal'

/** 견적서 스냅샷 항목 타입 */
interface QuoteSnapshotItem {
  itemName: string
  quantity: number
  unitPrice: number
  totalPrice: number
  description?: string
}

/** 견적서 스냅샷 전체 타입 */
interface QuoteSnapshot {
  equipItems: QuoteSnapshotItem[]
  installItems: QuoteSnapshotItem[]
  equipRounding: number
  installRounding: number
  equipSubtotal: number
  installSubtotal: number
  supplyAmount: number
  adjustedProfit: number
  subtotalWithProfit: number
  vat: number
  grandTotal: number
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

/** itemName에서 품목/모델명 분리 */
function splitItemName(itemName: string): { product: string; model: string } {
  if (itemName.includes('|||')) {
    const [product, model] = itemName.split('|||')
    return { product, model }
  }
  const parts = itemName.trim().split(' ')
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]
    if (/^[A-Z0-9]{6,}$/.test(last) && /[A-Z]/.test(last) && /[0-9]/.test(last)) {
      return { product: parts.slice(0, -1).join(' '), model: last }
    }
  }
  return { product: itemName, model: '' }
}

/** 발주 1건의 정산 금액 계산 (settlements/page.tsx와 동일) */
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

interface MonthlySummaryTabProps {
  orders: Order[]
  selectedYear: number
  selectedMonth: number
}

export function MonthlySummaryTab({ orders, selectedYear, selectedMonth }: MonthlySummaryTabProps) {
  // DB 저장된 스냅샷
  const [savedReport, setSavedReport] = useState<SettlementReport | null>(null)
  const [isLoadingReport, setIsLoadingReport] = useState(true)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // 월 변경 시 저장된 리포트 로드
  useEffect(() => {
    setIsLoadingReport(true)
    setSavedReport(null)
    fetchSettlementReport(selectedYear, selectedMonth).then(data => {
      setSavedReport(data)
      setIsLoadingReport(false)
    })
  }, [selectedYear, selectedMonth])

  /** 생성 핸들러 — 현재 데이터를 DB에 스냅샷 저장 */
  const handleGenerate = useCallback(async () => {
    setShowConfirm(false)
    setIsGenerating(true)

    try {
      // 1. 설치정산 항목 생성
      const installItems: SettlementReportItem[] = orders.map((order, i) => {
        const amounts = calcOrderAmounts(order)
        const workTypes = sortWorkTypes(Array.from(new Set(order.items.map(i => i.workType)))).join(', ')

        // 견적서 상세를 jsonb 스냅샷으로 저장
        const quoteSnapshot = {
          equipItems: amounts.equipItems.map(item => ({
            itemName: item.itemName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            description: item.description || '',
          })),
          installItems: amounts.installItems.map(item => ({
            itemName: item.itemName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            description: item.description || '',
          })),
          equipRounding: amounts.equipRounding,
          installRounding: amounts.installRounding,
          equipSubtotal: amounts.equipSubtotal,
          installSubtotal: amounts.installSubtotal,
          supplyAmount: amounts.supplyAmount,
          adjustedProfit: amounts.adjustedProfit,
          subtotalWithProfit: amounts.subtotalWithProfit,
          vat: amounts.vat,
          grandTotal: amounts.grandTotal,
        }

        return {
          sortOrder: i,
          orderId: order.id,
          businessName: order.businessName,
          affiliate: order.affiliate || '기타',
          workTypes,
          orderDate: order.orderDate || '',
          installCompleteDate: order.installCompleteDate || '',
          subtotalWithProfit: amounts.subtotalWithProfit,
          vat: amounts.vat,
          grandTotal: amounts.grandTotal,
          quoteSnapshot,
          sitePhotos: order.sitePhotos || [],
        }
      })

      // 2. AS정산 항목 생성
      const asData = await fetchASRequests()
      const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
      const filteredAS = asData.filter(req => {
        if (req.status !== 'completed' && req.status !== 'settled') return false
        return req.settlementMonth === monthKey
      })

      const asItems: SettlementReportAsItem[] = filteredAS.map((req, i) => ({
        sortOrder: i,
        asRequestId: req.id,
        affiliate: req.affiliate || '기타',
        businessName: req.businessName || '',
        contactName: req.contactName || '',
        contactPhone: req.contactPhone || '',
        modelName: req.modelName || '',
        asReason: req.asReason || '',
        receptionDate: req.receptionDate || '',
        processedDate: req.processedDate || '',
        asCost: req.asCost || 0,
        receptionFee: req.receptionFee || 0,
        processingDetails: req.processingDetails || '',
        totalAmount: req.totalAmount || 0,
      }))

      // 3. 합계 계산
      const installTotals = installItems.reduce((acc, item) => ({
        subtotal: acc.subtotal + item.subtotalWithProfit,
        vat: acc.vat + item.vat,
        total: acc.total + item.grandTotal,
      }), { subtotal: 0, vat: 0, total: 0 })

      // AS 합계 (계열사별 천원 단위 절사 후 합산)
      const asGrouped: Record<string, number> = {}
      filteredAS.forEach(req => {
        const aff = req.affiliate || '기타'
        asGrouped[aff] = (asGrouped[aff] || 0) + (req.totalAmount || 0)
      })
      const asTotalAmount = Object.values(asGrouped).reduce((sum, raw) => sum + Math.floor(raw / 1000) * 1000, 0)
      const asVat = Math.floor(asTotalAmount * 0.1)
      const asTotalWithVat = asTotalAmount + asVat

      // 4. DB 저장
      const success = await saveSettlementReport(
        selectedYear, selectedMonth,
        installItems, asItems,
        {
          installCount: installItems.length,
          installSubtotal: installTotals.subtotal,
          installVat: installTotals.vat,
          installTotal: installTotals.total,
          asCount: asItems.length,
          asTotal: asTotalWithVat,
        }
      )

      if (success) {
        const report = await fetchSettlementReport(selectedYear, selectedMonth)
        setSavedReport(report)
      } else {
        alert('정산관리 저장에 실패했습니다.')
      }
    } catch (err) {
      console.error('정산관리 생성 실패:', err)
      alert('정산관리 생성 중 오류가 발생했습니다.')
    } finally {
      setIsGenerating(false)
    }
  }, [orders, selectedYear, selectedMonth])

  // ── 로딩 중 ──
  if (isLoadingReport) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-slate-100 rounded-lg animate-pulse" />
        <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  // ── 생성중 (로딩) ──
  if (isGenerating) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
        <Loader2 className="h-10 w-10 mx-auto mb-4 text-carrot-500 animate-spin" />
        <p className="text-lg font-semibold text-slate-700">
          {selectedYear}년 {selectedMonth}월 정산관리 생성 중...
        </p>
        <p className="text-sm text-slate-500 mt-2">정산 데이터를 분석하고 있습니다.</p>
      </div>
    )
  }

  // ── 확인 다이얼로그 ──
  if (showConfirm) {
    return (
      <div className="flex justify-center py-12">
        <div className="bg-white rounded-xl border-2 border-carrot-300 shadow-lg p-8 text-center max-w-lg">
          <CircleDollarSign className="h-12 w-12 mx-auto mb-4 text-carrot-500" />
          <h3 className="text-lg font-bold text-slate-900 mb-2">
            {selectedYear}년 {selectedMonth}월 정산관리 생성
          </h3>
          <p className="text-sm text-slate-600 mb-6">
            현재 정산 데이터를 기반으로 정산관리를 작성합니다.<br />
            생성 후에는 단가표/견적서 변경에 영향받지 않습니다.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>취소</Button>
            <Button className="bg-carrot-500 hover:bg-carrot-600 text-white" onClick={handleGenerate}>
              생성하기
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── 생성 전 (저장된 데이터 없음) ──
  if (!savedReport) {
    return (
      <div className="py-20 text-center">
        <CircleDollarSign className="h-16 w-16 mx-auto mb-4 text-slate-300" />
        <p className="text-slate-400 text-sm mb-6">아직 이 달의 정산관리가 작성되지 않았습니다.</p>
        <Button
          size="lg"
          className="bg-carrot-500 hover:bg-carrot-600 text-white gap-2 px-8 py-6 text-base"
          onClick={() => setShowConfirm(true)}
        >
          <Plus className="h-5 w-5" />
          {selectedYear}년 {selectedMonth}월 정산관리 생성하기
        </Button>
        <p className="text-xs text-slate-400 mt-4">정산 관리의 데이터를 기반으로 자동 작성됩니다.</p>
      </div>
    )
  }

  // ── 확정본 표시 ──
  return <SettlementReportView report={savedReport} onRegenerate={() => setShowConfirm(true)} />
}

// ════════════════════════════════════════════════════════════
// 확정본 뷰 컴포넌트
// ════════════════════════════════════════════════════════════

function SettlementReportView({ report, onRegenerate }: { report: SettlementReport; onRegenerate: () => void }) {
  // 계열사별 설치정산 그룹화
  const affiliateGroups = useMemo(() => {
    const groups: Record<string, SettlementReportItem[]> = {}
    AFFILIATE_OPTIONS.forEach(aff => { groups[aff] = [] })

    report.items.forEach(item => {
      const aff = item.affiliate || '기타'
      if (groups[aff]) {
        groups[aff].push(item)
      } else {
        groups['기타'].push(item)
      }
    })

    return AFFILIATE_OPTIONS.map(aff => ({
      name: aff,
      items: groups[aff],
    }))
  }, [report.items])

  // 계열사별 AS정산 그룹화
  const asAffiliateGroups = useMemo(() => {
    const groups: Record<string, SettlementReportAsItem[]> = {}
    AFFILIATE_OPTIONS.forEach(aff => { groups[aff] = [] })

    report.asItems.forEach(item => {
      const aff = item.affiliate || '기타'
      if (groups[aff]) {
        groups[aff].push(item)
      } else {
        groups['기타'].push(item)
      }
    })

    return AFFILIATE_OPTIONS.map(aff => ({
      name: aff,
      items: groups[aff],
    }))
  }, [report.asItems])

  const hasASItems = report.asItems.length > 0

  return (
    <div className="space-y-6">
      {/* 상단: 생성일 + 재생성 버튼 */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          생성일: {new Date(report.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-carrot-600 border-carrot-200 hover:bg-carrot-50"
          onClick={onRegenerate}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          재생성
        </Button>
      </div>

      {/* ── 설치정산 섹션 ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-teal-600" />
          <h3 className="text-base font-bold text-slate-800">설치정산</h3>
          <span className="text-sm text-slate-500">({report.installCount}건)</span>
        </div>

        {affiliateGroups.map(group => (
          <InstallAffiliateGroup key={group.name} affiliateName={group.name} items={group.items} />
        ))}
      </div>

      {/* ── AS정산 섹션 ── */}
      {hasASItems && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-carrot-600" />
            <h3 className="text-base font-bold text-slate-800">AS정산</h3>
            <span className="text-sm text-slate-500">({report.asCount}건)</span>
          </div>

          {asAffiliateGroups.map(group => (
            <ASAffiliateGroup key={group.name} affiliateName={group.name} items={group.items} />
          ))}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 설치정산 계열사 그룹 아코디언
// ════════════════════════════════════════════════════════════

function InstallAffiliateGroup({ affiliateName, items }: { affiliateName: string; items: SettlementReportItem[] }) {
  const [isOpen, setIsOpen] = useState(items.length > 0)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const handleToggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 계열사 합계
  const totals = items.reduce((acc, item) => ({
    subtotal: acc.subtotal + item.subtotalWithProfit,
    vat: acc.vat + item.vat,
    total: acc.total + item.grandTotal,
  }), { subtotal: 0, vat: 0, total: 0 })

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm transition-all ${isOpen && items.length > 0 ? 'ring-1 ring-teal-200 shadow-md' : ''}`}>
      {/* 헤더 */}
      <button
        className={`w-full flex items-center justify-between px-6 py-4 rounded-t-xl transition-colors ${
          items.length > 0 ? (isOpen ? 'bg-teal-50/60' : 'hover:bg-slate-50') : ''
        }`}
        onClick={() => items.length > 0 && setIsOpen(prev => !prev)}
        disabled={items.length === 0}
      >
        <div className="flex items-center gap-3">
          <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${items.length === 0 ? 'opacity-30' : (isOpen ? '' : '-rotate-90')}`} />
          <h3 className="text-lg font-bold text-slate-800">{affiliateName}</h3>
          <span className="text-sm text-slate-500">({items.length}건)</span>
        </div>
        {items.length > 0 && (
          <div className="flex items-center gap-5 text-right">
            <div className="border-l border-slate-200 pl-5">
              <p className="text-[10px] text-slate-400 leading-tight">부가세별도</p>
              <p className="text-sm font-bold tabular-nums text-slate-700">{totals.subtotal.toLocaleString('ko-KR')}</p>
            </div>
            <div className="border-l border-slate-200 pl-5">
              <p className="text-[10px] text-slate-400 leading-tight">부가세</p>
              <p className="text-sm font-bold tabular-nums text-slate-500">{totals.vat.toLocaleString('ko-KR')}</p>
            </div>
            <div className="border-l border-slate-200 pl-5">
              <p className="text-[10px] text-teal-500 leading-tight">부가세포함</p>
              <p className="text-base font-extrabold tabular-nums text-slate-900">{totals.total.toLocaleString('ko-KR')}</p>
            </div>
          </div>
        )}
      </button>

      {/* 0건 빈 상태 */}
      {items.length === 0 && (
        <div className="py-3 px-6 text-sm text-slate-400">정산 대상이 없습니다.</div>
      )}

      {/* 펼침: 테이블 */}
      {isOpen && items.length > 0 && (
        <div className="pt-0 pb-4 px-4">
          {/* 데스크톱 테이블 */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b-2 border-slate-800">
                  <th className="text-left p-3 text-xs text-slate-500 font-semibold uppercase tracking-wider" style={{ width: '110px' }}>작업종류</th>
                  <th className="text-left p-3 text-xs text-slate-500 font-semibold uppercase tracking-wider" style={{ width: '85px' }}>발주일</th>
                  <th className="text-left p-3 text-xs text-slate-500 font-semibold uppercase tracking-wider" style={{ width: '85px' }}>설치완료일</th>
                  <th className="text-center p-3 text-xs text-slate-500 font-semibold uppercase tracking-wider" style={{ width: '90px' }}>계열사</th>
                  <th className="text-center p-3 text-xs text-slate-500 font-semibold uppercase tracking-wider">사업자명</th>
                  <th className="text-center p-3 text-xs text-slate-500 font-semibold uppercase tracking-wider" style={{ width: '80px' }}>현장사진</th>
                  <th className="text-right p-3 text-xs text-slate-500 font-semibold uppercase tracking-wider" style={{ width: '120px' }}>부가세별도</th>
                  <th className="text-right p-3 text-xs text-slate-500 font-semibold uppercase tracking-wider" style={{ width: '100px' }}>부가세</th>
                  <th className="text-right p-3 text-xs text-slate-500 font-semibold uppercase tracking-wider" style={{ width: '130px' }}>부가세포함</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const workTypes = item.workTypes ? item.workTypes.split(', ') : []
                  const qs = item.quoteSnapshot || {}
                  const itemId = item.id || item.orderId

                  return (
                    <React.Fragment key={itemId}>
                      <tr
                        className="border-b border-slate-100 hover:bg-teal-50/40 transition-colors cursor-pointer"
                        onClick={() => handleToggleExpand(itemId)}
                      >
                        {/* 작업종류 뱃지 */}
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {workTypes.map(type => {
                              const Icon = WORK_TYPE_ICON_MAP[type]
                              return (
                                <span key={type} className={`inline-flex items-center gap-1 text-[11px] font-medium border rounded-lg px-1.5 py-0.5 whitespace-nowrap ${getWorkTypeBadgeStyle(type).badge}`}>
                                  {Icon && <Icon className={`h-3 w-3 shrink-0 ${getWorkTypeBadgeStyle(type).icon}`} />}
                                  {type}
                                </span>
                              )
                            })}
                          </div>
                        </td>
                        <td className="p-3 text-sm tabular-nums">{formatShortDate(item.orderDate)}</td>
                        <td className="p-3 text-sm tabular-nums text-slate-500">{item.installCompleteDate ? formatShortDate(item.installCompleteDate) : '-'}</td>
                        <td className="p-3 text-center text-xs text-slate-600">{item.affiliate || '-'}</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${expandedIds.has(itemId) ? '' : '-rotate-90'}`} />
                            <p className="font-semibold text-sm truncate">{item.businessName}</p>
                          </div>
                        </td>
                        <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                          <SitePhotoViewer photos={item.sitePhotos || []} businessName={item.businessName} />
                        </td>
                        <td className="p-3 text-right">
                          <p className="text-sm tabular-nums text-slate-700">{item.subtotalWithProfit > 0 ? item.subtotalWithProfit.toLocaleString('ko-KR') : '-'}</p>
                        </td>
                        <td className="p-3 text-right">
                          <p className="text-sm tabular-nums text-slate-500">{item.vat > 0 ? item.vat.toLocaleString('ko-KR') : '-'}</p>
                        </td>
                        <td className="p-3 text-right">
                          <p className="text-sm font-bold tabular-nums text-slate-900">{item.grandTotal > 0 ? `${item.grandTotal.toLocaleString('ko-KR')}원` : '-'}</p>
                        </td>
                      </tr>

                      {/* 견적서 상세 (아코디언) */}
                      {expandedIds.has(itemId) && qs.equipItems && (
                        <tr>
                          <td colSpan={9} className="p-0">
                            <QuoteSnapshotDetail snapshot={qs} businessName={item.businessName} />
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
            {items.map(item => {
              const workTypes = item.workTypes ? item.workTypes.split(', ') : []
              const qs = item.quoteSnapshot || {}
              const itemId = item.id || item.orderId

              return (
                <div key={itemId} className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden cursor-pointer ${expandedIds.has(itemId) ? 'ring-1 ring-teal-300' : ''}`} onClick={() => handleToggleExpand(itemId)}>
                  <div className="p-4 space-y-3">
                    <div className="flex flex-wrap gap-1">
                      {workTypes.map(type => {
                        const Icon = WORK_TYPE_ICON_MAP[type]
                        return (
                          <span key={type} className={`inline-flex items-center gap-1 text-[11px] font-medium border rounded-lg px-1.5 py-0.5 whitespace-nowrap ${getWorkTypeBadgeStyle(type).badge}`}>
                            {Icon && <Icon className={`h-3 w-3 shrink-0 ${getWorkTypeBadgeStyle(type).icon}`} />}
                            {type}
                          </span>
                        )
                      })}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{item.businessName}</h3>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>발주 {formatShortDate(item.orderDate)} · 완료 {item.installCompleteDate ? formatShortDate(item.installCompleteDate) : '-'}</span>
                      <span className="font-bold text-slate-800 tabular-nums">
                        {item.grandTotal > 0 ? `${item.grandTotal.toLocaleString('ko-KR')}원` : '-'}
                      </span>
                    </div>
                  </div>

                  {/* 견적서 상세 모바일 */}
                  {expandedIds.has(itemId) && qs.equipItems && (
                    <QuoteSnapshotDetailMobile snapshot={qs} businessName={item.businessName} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 견적서 스냅샷 상세 (데스크톱)
// ════════════════════════════════════════════════════════════

function QuoteSnapshotDetail({ snapshot, businessName }: { snapshot: QuoteSnapshot; businessName: string }) {
  const equipItems = snapshot.equipItems || []
  const installItems = snapshot.installItems || []

  return (
    <div className="mx-4 my-3">
      <div className="border-2 border-teal-300 rounded-xl overflow-hidden bg-white shadow-md">
        {/* 견적서 헤더 */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-700 to-teal-600">
          <Receipt className="h-4 w-4 text-white" />
          <span className="text-sm font-bold text-white tracking-wide">견적서</span>
          <span className="text-xs text-teal-200 ml-2">— {businessName}</span>
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
            <tr className="border-b-2 border-slate-800 bg-slate-50/80">
              <th className="text-center py-2 px-2 text-xs text-slate-500 font-semibold uppercase tracking-wider">No.</th>
              <th className="text-center py-2 px-2 text-xs text-slate-500 font-semibold uppercase tracking-wider">품목</th>
              <th className="text-center py-2 px-2 text-xs text-slate-500 font-semibold uppercase tracking-wider">모델명</th>
              <th className="text-center py-2 px-2 text-xs text-slate-500 font-semibold uppercase tracking-wider">수량</th>
              <th className="text-right py-2 px-2 text-xs text-slate-500 font-semibold uppercase tracking-wider">단가</th>
              <th className="text-right py-2 px-2 text-xs text-slate-500 font-semibold uppercase tracking-wider">금액</th>
              <th className="text-center py-2 px-2 text-xs text-slate-500 font-semibold uppercase tracking-wider">비고</th>
            </tr>
          </thead>
          <tbody>
            {/* 장비비 섹션 */}
            <tr className="bg-slate-100">
              <td colSpan={7} className="py-1.5 px-3 text-xs font-bold text-slate-600 tracking-widest uppercase">[ 장비 ]</td>
            </tr>
            {equipItems.length > 0 ? equipItems.map((item: QuoteSnapshotItem, idx: number) => {
              const { product, model } = splitItemName(item.itemName)
              return (
                <tr key={`eq-${idx}`} className="border-b border-slate-100 hover:bg-teal-50/40 transition-colors">
                  <td className="py-2 px-2 text-center text-slate-400 tabular-nums">{idx + 1}</td>
                  <td className="py-2 px-2 text-center text-slate-800 font-medium truncate">{product}</td>
                  <td className="py-2 px-2 text-center text-slate-500 truncate">{model || '-'}</td>
                  <td className="py-2 px-2 text-center text-slate-600 tabular-nums">{item.quantity}</td>
                  <td className="py-2 px-2 text-right text-slate-600 tabular-nums">{item.unitPrice?.toLocaleString('ko-KR')}</td>
                  <td className="py-2 px-2 text-right font-bold text-slate-800 tabular-nums">{item.totalPrice?.toLocaleString('ko-KR')}</td>
                  <td className="py-2 px-2 text-center text-slate-500 truncate">{item.description || ''}</td>
                </tr>
              )
            }) : (
              <tr className="border-b border-slate-100"><td colSpan={7} className="py-3 text-center text-xs text-slate-400">장비 항목 없음</td></tr>
            )}
            {snapshot.equipRounding > 0 && (
              <tr className="border-t border-dashed border-slate-300">
                <td colSpan={5} className="py-1.5 px-2 text-right text-slate-500 text-xs">단위절사</td>
                <td className="py-1.5 px-2 text-right text-brick-500 font-medium text-xs tabular-nums">-{snapshot.equipRounding?.toLocaleString('ko-KR')}</td>
                <td></td>
              </tr>
            )}
            <tr className="bg-slate-50 border-b-2 border-b-slate-300">
              <td colSpan={5} className="py-1.5 px-2 text-right font-bold text-slate-700 text-xs">장비비 소계</td>
              <td className="py-1.5 px-2 text-right font-bold text-slate-700 text-xs tabular-nums">{snapshot.equipSubtotal?.toLocaleString('ko-KR')}</td>
              <td></td>
            </tr>

            {/* 설치비 섹션 */}
            <tr className="bg-slate-100">
              <td colSpan={7} className="py-1.5 px-3 text-xs font-bold text-slate-600 tracking-widest uppercase">[ 설치비 ]</td>
            </tr>
            {installItems.length > 0 ? installItems.map((item: QuoteSnapshotItem, idx: number) => {
              const { product, model } = splitItemName(item.itemName)
              return (
                <tr key={`in-${idx}`} className="border-b border-slate-100 hover:bg-teal-50/40 transition-colors">
                  <td className="py-2 px-2 text-center text-slate-400 tabular-nums">{idx + 1}</td>
                  <td className="py-2 px-2 text-center text-slate-800 font-medium truncate">{product}</td>
                  <td className="py-2 px-2 text-center text-slate-500 truncate">{model || '-'}</td>
                  <td className="py-2 px-2 text-center text-slate-600 tabular-nums">{item.quantity}</td>
                  <td className="py-2 px-2 text-right text-slate-600 tabular-nums">{item.unitPrice?.toLocaleString('ko-KR')}</td>
                  <td className="py-2 px-2 text-right font-bold text-slate-800 tabular-nums">{item.totalPrice?.toLocaleString('ko-KR')}</td>
                  <td className="py-2 px-2 text-center text-slate-500 truncate">{item.description || ''}</td>
                </tr>
              )
            }) : (
              <tr className="border-b border-slate-100"><td colSpan={7} className="py-3 text-center text-xs text-slate-400">설치비 항목 없음</td></tr>
            )}
            {snapshot.installRounding > 0 && (
              <tr className="border-t border-dashed border-slate-300">
                <td colSpan={5} className="py-1.5 px-2 text-right text-slate-500 text-xs">단위절사</td>
                <td className="py-1.5 px-2 text-right text-brick-500 font-medium text-xs tabular-nums">-{snapshot.installRounding?.toLocaleString('ko-KR')}</td>
                <td></td>
              </tr>
            )}
            <tr className="bg-slate-50 border-b-2 border-b-slate-300">
              <td colSpan={5} className="py-1.5 px-2 text-right font-bold text-slate-700 text-xs">설치비 소계</td>
              <td className="py-1.5 px-2 text-right font-bold text-slate-700 text-xs tabular-nums">{snapshot.installSubtotal?.toLocaleString('ko-KR')}</td>
              <td></td>
            </tr>
          </tbody>

          {/* 합계 영역 */}
          <tfoot>
            <tr>
              <td colSpan={7} className="p-3 pt-4">
                <div className="flex justify-end">
                  <div className="w-[300px] rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                      <span className="text-xs text-slate-500">공급가액(장비+설치비)</span>
                      <span className="text-sm font-semibold text-slate-700 tabular-nums">{snapshot.supplyAmount?.toLocaleString('ko-KR')}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                      <span className="text-xs text-gold-600">기업이윤(설치비 3%)</span>
                      <span className="text-sm font-semibold text-gold-700 tabular-nums">+{snapshot.adjustedProfit?.toLocaleString('ko-KR')}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white">
                      <span className="text-xs font-bold text-slate-600">소계</span>
                      <span className="text-sm font-bold text-slate-800 tabular-nums">{snapshot.subtotalWithProfit?.toLocaleString('ko-KR')}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50/50">
                      <span className="text-xs text-slate-500">VAT(10%)</span>
                      <span className="text-sm font-semibold text-slate-600 tabular-nums">+{snapshot.vat?.toLocaleString('ko-KR')}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 bg-teal-600 text-white rounded-b-xl">
                      <span className="text-sm font-bold">최종금액</span>
                      <span className="text-lg font-black tabular-nums">{snapshot.grandTotal?.toLocaleString('ko-KR')}<span className="text-sm font-medium ml-0.5">원</span></span>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// 견적서 스냅샷 상세 (모바일)
// ════════════════════════════════════════════════════════════

function QuoteSnapshotDetailMobile({ snapshot, businessName }: { snapshot: QuoteSnapshot; businessName: string }) {
  const equipItems = snapshot.equipItems || []
  const installItems = snapshot.installItems || []

  return (
    <div className="mx-3 mb-3 border-2 border-teal-300 rounded-xl overflow-hidden bg-white shadow-md">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-700 to-teal-600">
        <Receipt className="h-4 w-4 text-white" />
        <span className="text-sm font-bold text-white tracking-wide">견적서</span>
        <span className="text-xs text-teal-200 ml-1 truncate">— {businessName}</span>
      </div>
      <div className="divide-y divide-slate-100">
        <div className="px-3 py-1.5 bg-slate-100 text-xs font-bold text-slate-600 tracking-widest uppercase">[ 장비 ]</div>
        {equipItems.length > 0 ? equipItems.map((item: QuoteSnapshotItem, idx: number) => {
          const { product, model } = splitItemName(item.itemName)
          return (
            <div key={`eq-${idx}`} className="flex items-center justify-between px-3 py-2.5">
              <div>
                <p className="font-medium text-sm text-slate-800">{product}</p>
                {model && <p className="text-[11px] text-slate-400 mt-0.5">{model}</p>}
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">{item.quantity}개 x {item.unitPrice?.toLocaleString('ko-KR')}원</p>
              </div>
              <p className="font-bold text-sm text-slate-800 tabular-nums">{item.totalPrice?.toLocaleString('ko-KR')}</p>
            </div>
          )
        }) : (
          <div className="px-3 py-3 text-center text-xs text-slate-400">장비 항목 없음</div>
        )}
        {snapshot.equipRounding > 0 && (
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-dashed border-slate-300">
            <span className="text-xs text-slate-500">단위절사</span>
            <span className="text-sm text-brick-500 font-medium tabular-nums">-{snapshot.equipRounding?.toLocaleString('ko-KR')}</span>
          </div>
        )}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b-2 border-b-slate-300">
          <span className="text-xs font-bold text-slate-700">장비비 소계</span>
          <span className="text-sm font-bold text-slate-700 tabular-nums">{snapshot.equipSubtotal?.toLocaleString('ko-KR')}</span>
        </div>

        <div className="px-3 py-1.5 bg-slate-100 text-xs font-bold text-slate-600 tracking-widest uppercase">[ 설치비 ]</div>
        {installItems.length > 0 ? installItems.map((item: QuoteSnapshotItem, idx: number) => {
          const { product, model } = splitItemName(item.itemName)
          return (
            <div key={`in-${idx}`} className="flex items-center justify-between px-3 py-2.5">
              <div>
                <p className="font-medium text-sm text-slate-800">{product}</p>
                {model && <p className="text-[11px] text-slate-400 mt-0.5">{model}</p>}
                <p className="text-xs text-slate-500 mt-0.5 tabular-nums">{item.quantity}개 x {item.unitPrice?.toLocaleString('ko-KR')}원</p>
              </div>
              <p className="font-bold text-sm text-slate-800 tabular-nums">{item.totalPrice?.toLocaleString('ko-KR')}</p>
            </div>
          )
        }) : (
          <div className="px-3 py-3 text-center text-xs text-slate-400">설치비 항목 없음</div>
        )}
        {snapshot.installRounding > 0 && (
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-dashed border-slate-300">
            <span className="text-xs text-slate-500">단위절사</span>
            <span className="text-sm text-brick-500 font-medium tabular-nums">-{snapshot.installRounding?.toLocaleString('ko-KR')}</span>
          </div>
        )}
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b-2 border-b-slate-300">
          <span className="text-xs font-bold text-slate-700">설치비 소계</span>
          <span className="text-sm font-bold text-slate-700 tabular-nums">{snapshot.installSubtotal?.toLocaleString('ko-KR')}</span>
        </div>

        {/* 합계 카드 */}
        <div className="m-3 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50/50">
            <span className="text-[11px] text-slate-500">공급가액(장비+설치비)</span>
            <span className="text-xs font-semibold text-slate-700 tabular-nums">{snapshot.supplyAmount?.toLocaleString('ko-KR')}</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50/50">
            <span className="text-[11px] text-gold-600">기업이윤(설치비 3%)</span>
            <span className="text-xs font-semibold text-gold-700 tabular-nums">+{snapshot.adjustedProfit?.toLocaleString('ko-KR')}</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-white">
            <span className="text-[11px] font-bold text-slate-600">소계</span>
            <span className="text-xs font-bold text-slate-800 tabular-nums">{snapshot.subtotalWithProfit?.toLocaleString('ko-KR')}</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50/50">
            <span className="text-[11px] text-slate-500">VAT(10%)</span>
            <span className="text-xs font-semibold text-slate-600 tabular-nums">+{snapshot.vat?.toLocaleString('ko-KR')}</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2.5 bg-teal-600 text-white rounded-b-xl">
            <span className="text-xs font-bold">최종금액</span>
            <span className="text-sm font-black tabular-nums">{snapshot.grandTotal?.toLocaleString('ko-KR')}<span className="text-[11px] font-medium ml-0.5">원</span></span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════
// AS정산 계열사 그룹 아코디언
// ════════════════════════════════════════════════════════════

function ASAffiliateGroup({ affiliateName, items }: { affiliateName: string; items: SettlementReportAsItem[] }) {
  const [isOpen, setIsOpen] = useState(items.length > 0)

  const rawTotal = items.reduce((sum, r) => sum + (r.totalAmount || 0), 0)
  const truncated = Math.floor(rawTotal / 1000) * 1000
  const truncationAmount = rawTotal - truncated
  const subtotal = truncated
  const vat = Math.floor(subtotal * 0.1)
  const totalWithVat = subtotal + vat

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm transition-all ${isOpen && items.length > 0 ? 'ring-1 ring-carrot-200 shadow-md' : ''}`}>
      <button
        className={`w-full flex items-center justify-between px-6 py-4 rounded-t-xl transition-colors ${
          items.length > 0 ? (isOpen ? 'bg-carrot-50/60' : 'hover:bg-slate-50') : ''
        }`}
        onClick={() => items.length > 0 && setIsOpen(prev => !prev)}
        disabled={items.length === 0}
      >
        <div className="flex items-center gap-3">
          <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${items.length === 0 ? 'opacity-30' : (isOpen ? '' : '-rotate-90')}`} />
          <Wrench className="h-4 w-4 text-carrot-500" />
          <h3 className="text-lg font-bold text-slate-800">{affiliateName} AS</h3>
          <span className="text-sm text-slate-500">({items.length}건)</span>
        </div>
        {items.length > 0 && (
          <div className="flex items-center gap-3 text-right">
            <div className="border-l border-slate-200 pl-3">
              <p className="text-[10px] text-slate-400 leading-tight">부가세별도</p>
              <p className="text-sm font-bold tabular-nums text-slate-700">{rawTotal.toLocaleString('ko-KR')}</p>
            </div>
            <div className="border-l border-slate-200 pl-3">
              <p className="text-[10px] text-slate-400 leading-tight">단위절사</p>
              <p className="text-sm font-bold tabular-nums text-brick-500">-{truncationAmount.toLocaleString('ko-KR')}</p>
            </div>
            <div className="border-l border-slate-200 pl-3">
              <p className="text-[10px] text-slate-400 leading-tight">소계</p>
              <p className="text-sm font-bold tabular-nums text-slate-700">{subtotal.toLocaleString('ko-KR')}</p>
            </div>
            <div className="border-l border-slate-200 pl-3">
              <p className="text-[10px] text-slate-400 leading-tight">부가세</p>
              <p className="text-sm font-bold tabular-nums text-slate-500">{vat.toLocaleString('ko-KR')}</p>
            </div>
            <div className="border-l border-slate-200 pl-3">
              <p className="text-[10px] text-carrot-500 leading-tight">부가세포함</p>
              <p className="text-base font-extrabold tabular-nums text-slate-900">{totalWithVat.toLocaleString('ko-KR')}원</p>
            </div>
          </div>
        )}
      </button>

      {items.length === 0 && (
        <div className="py-3 px-6 text-sm text-slate-400">AS 정산 대상이 없습니다.</div>
      )}

      {isOpen && items.length > 0 && (
        <div className="pt-0 pb-4 px-4">
          {/* 데스크톱 테이블 */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
            <table className="w-full" style={{ tableLayout: 'fixed', minWidth: '1050px' }}>
              <thead>
                <tr className="bg-slate-50/80 border-b-2 border-slate-800">
                  <th className="text-left p-2.5 text-xs text-slate-500 font-semibold uppercase tracking-wider" style={{ width: '90px' }}>접수일</th>
                  <th className="text-left p-2.5 text-xs text-slate-500 font-semibold uppercase tracking-wider" style={{ width: '120px' }}>사업자명</th>
                  <th className="text-left p-2.5 text-xs text-slate-500 font-semibold uppercase tracking-wider" style={{ width: '65px' }}>담당자</th>
                  <th className="text-left p-2.5 text-xs text-slate-500 font-semibold uppercase tracking-wider" style={{ width: '110px' }}>담당자번호</th>
                  <th className="text-left p-2.5 text-xs text-slate-500 font-semibold uppercase tracking-wider" style={{ width: '80px' }}>모델명</th>
                  <th className="text-left p-2.5 text-xs text-slate-500 font-semibold uppercase tracking-wider" style={{ width: '140px' }}>AS사유</th>
                  <th className="text-center p-2.5 text-xs text-slate-500 font-semibold uppercase tracking-wider" style={{ width: '90px' }}>처리일</th>
                  <th className="text-right p-2.5 text-xs text-slate-500 font-semibold uppercase tracking-wider" style={{ width: '80px' }}>AS비용</th>
                  <th className="text-right p-2.5 text-xs text-slate-500 font-semibold uppercase tracking-wider" style={{ width: '70px' }}>접수비</th>
                  <th className="text-left p-2.5 text-xs text-slate-500 font-semibold uppercase tracking-wider" style={{ width: '110px' }}>처리내역</th>
                  <th className="text-right p-2.5 text-xs text-slate-500 font-semibold uppercase tracking-wider" style={{ width: '110px' }}>합계(부가세별도)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((req, idx) => (
                  <tr
                    key={req.id || idx}
                    className={`border-b border-slate-100 hover:bg-teal-50/40 transition-colors ${idx === items.length - 1 ? 'border-b-2 border-b-slate-400' : ''}`}
                  >
                    <td className="p-2.5 text-xs tabular-nums whitespace-nowrap">{req.receptionDate || '-'}</td>
                    <td className="p-2.5"><p className="text-xs font-semibold truncate">{req.businessName}</p></td>
                    <td className="p-2.5 text-xs text-slate-600 truncate">{req.contactName || '-'}</td>
                    <td className="p-2.5 text-xs text-slate-600 whitespace-nowrap">{req.contactPhone || '-'}</td>
                    <td className="p-2.5 text-xs text-slate-600 truncate">{req.modelName || '-'}</td>
                    <td className="p-2.5"><p className="text-xs text-slate-600 truncate" title={req.asReason || ''}>{req.asReason || '-'}</p></td>
                    <td className="p-2.5 text-center text-xs tabular-nums text-slate-500 whitespace-nowrap">{req.processedDate || '-'}</td>
                    <td className="p-2.5 text-right text-xs tabular-nums text-slate-600 whitespace-nowrap">{req.asCost ? req.asCost.toLocaleString('ko-KR') : '-'}</td>
                    <td className="p-2.5 text-right text-xs tabular-nums text-slate-600 whitespace-nowrap">{req.receptionFee ? req.receptionFee.toLocaleString('ko-KR') : '-'}</td>
                    <td className="p-2.5"><p className="text-xs text-slate-500 truncate" title={req.processingDetails || ''}>{req.processingDetails || '-'}</p></td>
                    <td className="p-2.5 text-right text-xs font-bold tabular-nums text-slate-900 whitespace-nowrap">{req.totalAmount ? `${req.totalAmount.toLocaleString('ko-KR')}원` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 */}
          <div className="md:hidden space-y-3">
            {items.map((req, idx) => (
              <div key={req.id || idx} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm truncate">{req.businessName}</h3>
                    <span className="text-sm font-bold tabular-nums text-slate-800">{req.totalAmount ? `${req.totalAmount.toLocaleString('ko-KR')}원` : '-'}</span>
                  </div>
                  {req.asReason && <p className="text-xs text-slate-500 truncate">AS사유: {req.asReason}</p>}
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>접수 {req.receptionDate} · 처리 {req.processedDate || '-'}</span>
                    <span className="text-slate-400">AS비용 {req.asCost?.toLocaleString('ko-KR') || '-'} + 접수비 {req.receptionFee?.toLocaleString('ko-KR') || '-'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
