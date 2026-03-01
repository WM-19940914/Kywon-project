/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 정산관리 탭 (탭 3)
 * - 교원 업무 > 월별 정산 내역 페이지와 100% 완벽하게 동일한 UI/UX 구현
 */

'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { 
  fetchOrders, 
  fetchASRequests, 
  fetchSettlementConfirmation, 
  saveSettlementConfirmation, 
  clearSettlementConfirmation, 
  updateSettlementCategory 
} from '@/lib/supabase/dal'
import type { SettlementConfirmation } from '@/lib/supabase/dal'
import type { Order } from '@/types/order'
import type { ASRequest } from '@/types/as'
import {
  AFFILIATE_OPTIONS,
  SETTLEMENT_CATEGORIES,
  sortWorkTypes,
  getWorkTypeBadgeStyle,
} from '@/types/order'
import type { SettlementCategory } from '@/types/order'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  FileText, ChevronDown, PlusCircle, ArrowRightLeft, Wrench, 
  CircleDollarSign, Archive, Trash2, Package, RotateCcw, 
  Receipt, CheckCircle2, RefreshCw
} from 'lucide-react'
import { ExcelExportButton } from '@/components/ui/excel-export-button'
import { exportSettlementExcel, buildExcelFileName } from '@/lib/excel-export'
import type { SettlementSheetData } from '@/lib/excel-export'
import type { LucideIcon } from 'lucide-react'
import { formatShortDate } from '@/lib/delivery-utils'
import { OrderDetailDialog } from '@/components/orders/order-detail-dialog'
import { QuoteCreateDialog } from '@/components/quotes/quote-create-dialog'
import { SitePhotoViewer } from '@/components/schedule/site-photo-viewer'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

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

/** 발주 1건의 정산 금액 계산 */
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

export function MonthlySummaryTab({ 
  orders: parentOrders, 
  selectedYear, 
  selectedMonth 
}: MonthlySummaryTabProps) {
  const [orders, setOrders] = useState<Order[]>(parentOrders)
  const [asRequests, setAsRequests] = useState<ASRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [affiliateFilter, setAffiliateFilter] = useState<'all' | string>('all')
  const [detailOrder, setDetailOrder] = useState<Order | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false)
  const [orderForQuote, setOrderForQuote] = useState<Order | null>(null)
  const [confirmation, setConfirmation] = useState<SettlementConfirmation | null>(null)
  const [melleeaInput, setMelleeaInput] = useState('')
  const [melleeaName, setMelleeaName] = useState('')
  const [kyowonInput, setKyowonInput] = useState('')
  const [kyowonName, setKyowonName] = useState('')
  const [toggleConfirmOpen, setToggleConfirmOpen] = useState(false)
  const [pendingToggle, setPendingToggle] = useState<{ orderId: string; newCategory: SettlementCategory; businessName: string } | null>(null)

  // 데이터 로드
  useEffect(() => {
    setIsLoading(true)
    Promise.all([fetchOrders(), fetchASRequests()]).then(([orderData, asData]) => {
      setOrders(orderData)
      setAsRequests(asData)
      setIsLoading(false)
    })
  }, [selectedYear, selectedMonth])

  // 정산 확인 데이터 로드
  useEffect(() => {
    fetchSettlementConfirmation(selectedYear, selectedMonth).then(data => {
      setConfirmation(data)
      setMelleeaInput(data?.melleeaAmount != null ? String(data.melleeaAmount) : '')
      setKyowonInput(data?.kyowonAmount != null ? String(data.kyowonAmount) : '')
    })
  }, [selectedYear, selectedMonth])

  const handleConfirmAmount = useCallback(async (side: 'mellea' | 'kyowon') => {
    const rawInput = side === 'mellea' ? melleeaInput : kyowonInput
    const name = side === 'mellea' ? melleeaName : kyowonName
    const amount = parseInt(rawInput.replace(/[^0-9]/g, ''), 10)
    if (isNaN(amount) || amount <= 0 || !name.trim()) return
    const ok = await saveSettlementConfirmation(selectedYear, selectedMonth, side, amount, name.trim())
    if (ok) { const data = await fetchSettlementConfirmation(selectedYear, selectedMonth); setConfirmation(data) }
  }, [melleeaInput, melleeaName, kyowonInput, kyowonName, selectedYear, selectedMonth])

  const handleClearConfirmation = useCallback(async (side: 'mellea' | 'kyowon') => {
    const ok = await clearSettlementConfirmation(selectedYear, selectedMonth, side)
    if (ok) { if (side === 'mellea') { setMelleeaInput(''); setMelleeaName('') } else { setKyowonInput(''); setKyowonName('') }; const data = await fetchSettlementConfirmation(selectedYear, selectedMonth); setConfirmation(data) }
  }, [selectedYear, selectedMonth])

  const handleViewOrder = useCallback((order: Order) => {
    setDetailOrder(order)
    setDetailOpen(true)
  }, [])

  const handleQuoteView = useCallback((order: Order) => {
    setOrderForQuote(order)
    setQuoteDialogOpen(true)
  }, [])

  const filteredOrders = useMemo(() => {
    const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
    return orders.filter(order => {
      if (order.status === 'cancelled') return false
      const s1Status = order.s1SettlementStatus || 'unsettled'
      if (s1Status === 'unsettled') return false
      const orderMonth = order.s1SettlementMonth || (order.installCompleteDate ? order.installCompleteDate.substring(0, 7) : null)
      return orderMonth === monthKey
    })
  }, [orders, selectedYear, selectedMonth])

  const getSettlementCategory = useCallback((order: Order): SettlementCategory => {
    if (order.settlementCategory) return order.settlementCategory
    return order.items.some(i => i.workType === '신규설치') ? '신규설치' : '이전설치'
  }, [])

  const affiliateGroups = useMemo(() => {
    const groups: Record<string, Order[]> = {}
    AFFILIATE_OPTIONS.forEach(aff => { SETTLEMENT_CATEGORIES.forEach(cat => { groups[`${aff}_${cat}`] = [] }) })
    filteredOrders.forEach(order => { const affiliate = order.affiliate || '기타'; const category = getSettlementCategory(order); const key = `${affiliate}_${category}`; if (groups[key]) groups[key].push(order); else groups[`기타_${category}`].push(order) })
    const result: { name: string; category: SettlementCategory; orders: Order[] }[] = []
    AFFILIATE_OPTIONS.forEach(aff => { SETTLEMENT_CATEGORIES.forEach(cat => { result.push({ name: aff, category: cat, orders: groups[`${aff}_${cat}`] }) }) })
    return result
  }, [filteredOrders, getSettlementCategory])

  const displayedGroups = useMemo(() => {
    if (affiliateFilter === 'all') return affiliateGroups
    if (affiliateFilter.endsWith('_AS')) return []
    return affiliateGroups.filter(g => `${g.name}_${g.category}` === affiliateFilter)
  }, [affiliateGroups, affiliateFilter])

  const handleToggleCategory = useCallback(async (orderId: string, newCategory: SettlementCategory) => {
    const order = orders.find(o => o.id === orderId)
    setPendingToggle({ orderId, newCategory, businessName: order?.businessName || '알 수 없는 현장' })
    setToggleConfirmOpen(true)
  }, [orders])

  const confirmToggleCategory = async () => {
    if (!pendingToggle) return
    const ok = await updateSettlementCategory(pendingToggle.orderId, pendingToggle.newCategory)
    if (ok) { 
      setOrders(prev => prev.map(o => o.id === pendingToggle.orderId ? { ...o, settlementCategory: pendingToggle.newCategory } : o))
      setToggleConfirmOpen(false) 
    }
  }

  const filteredASRequests = useMemo(() => {
    const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
    return asRequests.filter(req => (req.status === 'completed' || req.status === 'settled') && req.settlementMonth === monthKey)
  }, [asRequests, selectedYear, selectedMonth])

  const asAffiliateGroups = useMemo(() => {
    const groups: Record<string, ASRequest[]> = {}
    AFFILIATE_OPTIONS.forEach(aff => { groups[aff] = [] })
    filteredASRequests.forEach(req => { const affiliate = req.affiliate || '기타'; if (groups[affiliate]) groups[affiliate].push(req); else { if (!groups['기타']) groups['기타'] = []; groups['기타'].push(req) } })
    return AFFILIATE_OPTIONS.map(aff => ({ name: aff, requests: groups[aff] }))
  }, [filteredASRequests])

  const displayedASGroups = useMemo(() => {
    if (affiliateFilter === 'all') return asAffiliateGroups
    if (affiliateFilter.endsWith('_AS')) { const selectedAffiliate = affiliateFilter.replace('_AS', ''); return asAffiliateGroups.filter(g => g.name === selectedAffiliate) }
    return []
  }, [asAffiliateGroups, affiliateFilter])

  const handleExcelExport = useCallback(() => {
    const affiliateData: Record<string, SettlementSheetData[]> = {}
    AFFILIATE_OPTIONS.forEach(name => { SETTLEMENT_CATEGORIES.forEach(cat => { affiliateData[`${name}_${cat}`] = [] }) })
    filteredOrders.forEach(order => {
      const affiliate = order.affiliate || '기타'; const category = getSettlementCategory(order); const key = `${affiliate}_${category}`
      const amounts = calcOrderAmounts(order); const workTypes = sortWorkTypes(Array.from(new Set(order.items.map(i => i.workType)))).join(', ')
      const quoteItems = (order.customerQuote?.items || []).map(item => { const { product, model } = splitItemName(item.itemName); return { category: item.category === 'equipment' ? '장비비' : '설치비', productName: product, modelName: model, quantity: item.quantity, unitPrice: item.unitPrice, totalPrice: item.totalPrice } })
      if (!affiliateData[key]) affiliateData[key] = []
      affiliateData[key].push({ businessName: order.businessName, workTypes, orderDate: order.orderDate || '', installCompleteDate: order.installCompleteDate || '', subtotalWithProfit: amounts.subtotalWithProfit, vat: amounts.vat, grandTotal: amounts.grandTotal, equipRounding: amounts.equipRounding, installRounding: amounts.installRounding, supplyAmount: amounts.supplyAmount, adjustedProfit: amounts.adjustedProfit, quoteItems })
    })
    const asAffiliateData: Record<string, Record<string, unknown>[]> = {}
    AFFILIATE_OPTIONS.forEach(name => { asAffiliateData[name] = [] })
    filteredASRequests.forEach(req => {
      const affiliate = req.affiliate || '기타'
      if (!asAffiliateData[affiliate]) asAffiliateData[affiliate] = []
      asAffiliateData[affiliate].push({ affiliate, receptionDate: req.receptionDate || '', businessName: req.businessName || '', contactName: req.contactName || '', contactPhone: req.contactPhone || '', modelName: req.modelName || '', asReason: req.asReason || '', processedDate: req.processedDate || '', processingDetails: req.processingDetails || '', asCost: req.asCost || 0, receptionFee: req.receptionFee || 0, totalAmount: (Number(req.asCost) || 0) + (Number(req.receptionFee) || 0) })
    })
    const summaryData = AFFILIATE_OPTIONS.map(name => {
      const newOrders = affiliateData[`${name}_신규설치`] || []; const moveOrders = affiliateData[`${name}_이전설치`] || []; const installOrders = [...newOrders, ...moveOrders]; const installTotal = installOrders.reduce((s, o) => s + o.grandTotal, 0)
      const asReqs = asAffiliateData[name] || []; const asRaw = asReqs.reduce((s, r) => s + ((r.totalAmount as number) || 0), 0); const asTruncated = Math.floor(asRaw / 1000) * 1000; const asWithVat = asTruncated + Math.floor(asTruncated * 0.1)
      return { name, installCount: installOrders.length, installTotal, asCount: asReqs.length, asTotal: asWithVat }
    })
    const monthLabel = `${selectedYear}년${selectedMonth}월`
    exportSettlementExcel({ affiliateData, asAffiliateData, asColumns: [{ header: '계열사', key: 'affiliate', width: 14 }, { header: '접수일', key: 'receptionDate', width: 12 }, { header: '사업자명', key: 'businessName', width: 20 }, { header: '모델명', key: 'modelName', width: 14 }, { header: 'AS사유', key: 'asReason', width: 20 }, { header: '처리일', key: 'processedDate', width: 12 }, { header: 'AS비용', key: 'asCost', width: 12, numberFormat: '#,##0' }, { header: '접수비', key: 'receptionFee', width: 12, numberFormat: '#,##0' }, { header: '합계', key: 'totalAmount', width: 12, numberFormat: '#,##0' }], summary: summaryData, fileName: buildExcelFileName('정산관리', monthLabel), monthLabel })
  }, [filteredOrders, filteredASRequests, selectedYear, selectedMonth, getSettlementCategory])

  const businessBreakdown = useMemo(() => {
    const map: Record<string, number> = {}
    filteredOrders.forEach(o => { const aff = o.affiliate || '기타'; const cat = getSettlementCategory(o); const bName = o.businessName || '알 수 없음'; const key = `${aff} ${cat} - ${bName}`; if (!map[key]) map[key] = 0; map[key] += calcOrderAmounts(o).grandTotal })
    filteredASRequests.forEach(req => { const aff = req.affiliate || '기타'; const bName = req.businessName || '알 수 없음'; const key = `${aff} AS - ${bName}`; const asRaw = (Number(req.asCost) || 0) + (Number(req.receptionFee) || 0); const truncate = Math.floor(asRaw / 1000) * 1000; const vat = Math.floor(truncate * 0.1); if (!map[key]) map[key] = 0; map[key] += (truncate + vat) })
    const affiliateOrder = ['구몬', 'Wells 영업', 'Wells 서비스', '교육플랫폼', '기타']
    return Object.entries(map).map(([label, amount]) => ({ label, amount })).sort((a, b) => { const aIsAs = a.label.includes(' AS '); const bIsAs = b.label.includes(' AS '); if (aIsAs !== bIsAs) return aIsAs ? 1 : -1; const aAff = affiliateOrder.find(aff => a.label.startsWith(aff)) || '기타'; const bAff = affiliateOrder.find(aff => b.label.startsWith(aff)) || '기타'; const aIdx = affiliateOrder.indexOf(aAff); const bIdx = affiliateOrder.indexOf(bAff); if (aIdx !== bIdx) return aIdx - bIdx; return a.label.localeCompare(b.label) })
  }, [filteredOrders, filteredASRequests, getSettlementCategory])

  const grandTotals = useMemo(() => filteredOrders.reduce((acc, order) => { const amounts = calcOrderAmounts(order); return { subtotal: acc.subtotal + amounts.subtotalWithProfit, vat: acc.vat + amounts.vat, total: acc.total + amounts.grandTotal } }, { subtotal: 0, vat: 0, total: 0 }), [filteredOrders])
  const asTotalAmountBase = asAffiliateGroups.reduce((sum, group) => { const rawGroupTotal = group.requests.reduce((s, r) => s + (Number(r.asCost) || 0) + (Number(r.receptionFee) || 0), 0); return sum + Math.floor(rawGroupTotal / 1000) * 1000 }, 0)
  const asVatTotal = asTotalAmountBase + Math.floor(asTotalAmountBase * 0.1)
  const finalTotal = grandTotals.total + asVatTotal

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-6 w-24 rounded" />
                <Skeleton className="h-5 w-12 rounded" />
              </div>
              <div className="flex items-center gap-5">
                <Skeleton className="h-10 w-28 rounded" />
                <Skeleton className="h-10 w-24 rounded" />
                <Skeleton className="h-10 w-32 rounded" />
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end mb-3">
        <ExcelExportButton onClick={handleExcelExport} disabled={filteredOrders.length === 0 && filteredASRequests.length === 0} />
      </div>


      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-10 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3">
          <div className="p-6 lg:border-r border-slate-100 bg-slate-50/40 flex flex-col justify-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-teal-50 text-teal-700 text-[11px] font-bold rounded-full mb-4 border border-teal-100 self-start"><span className="w-1.5 h-1.5 rounded-full bg-teal-500" />{selectedYear}년 {selectedMonth}월 종합</div>
            <h3 className="text-xs font-semibold text-slate-500 mb-1">총 정산 대상 <span className="text-[10px] font-normal text-slate-400">(VAT 포함)</span></h3>
            <div className="flex items-baseline gap-1 mb-6"><p className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight tabular-nums">{finalTotal.toLocaleString('ko-KR')}</p><span className="text-lg font-bold text-slate-400">원</span></div>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs border-b border-slate-200/60 pb-2"><div className="flex items-center gap-1.5"><div className="bg-white p-1 rounded border border-slate-100"><CircleDollarSign className="w-3.5 h-3.5 text-teal-500" /></div><span className="font-medium text-slate-700">설치 정산 <span className="text-slate-400 text-[10px] font-normal ml-0.5">({filteredOrders.length}건)</span></span></div><span className="font-bold text-slate-800 tabular-nums">{grandTotals.total.toLocaleString('ko-KR')}원</span></div>
              <div className="flex justify-between items-center text-xs"><div className="flex items-center gap-1.5"><div className="bg-white p-1 rounded border border-slate-100"><Wrench className="w-3.5 h-3.5 text-carrot-500" /></div><span className="font-medium text-slate-700">AS 정산 <span className="text-slate-400 text-[10px] font-normal ml-0.5">({filteredASRequests.length}건)</span></span></div><span className="font-bold text-slate-800 tabular-nums">{asVatTotal.toLocaleString('ko-KR')}원</span></div>
            </div>
          </div>
          <div className="lg:col-span-2 p-6 flex flex-col md:flex-row gap-6 bg-white/50">
            <div className="flex-1 flex flex-col"><h3 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-200 pb-2">사업자별 정산 요약</h3><div className="max-h-[160px] overflow-y-auto pr-2 space-y-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">{businessBreakdown.length > 0 ? businessBreakdown.map((item, idx) => (<div key={idx} className="flex justify-between items-center text-xs"><span className="text-slate-600 font-medium">· {item.label}</span><span className="font-bold tabular-nums text-slate-800">{item.amount.toLocaleString('ko-KR')}원</span></div>)) : <p className="text-xs text-slate-400 py-4 text-center">조회된 정산 데이터가 없습니다.</p>}</div></div>
            <div className="w-full md:w-[280px] bg-slate-50/70 rounded-xl border border-slate-200 p-4 shrink-0 flex flex-col self-start"><div className="flex items-center justify-between mb-3"><h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-slate-400" />정산 상호 확인</h3>{confirmation?.melleeaConfirmedAt && confirmation?.kyowonConfirmedAt && (<span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${confirmation.melleeaAmount === confirmation.kyowonAmount ? 'bg-olive-100 text-olive-700' : 'bg-brick-100 text-brick-700'}`}>{confirmation.melleeaAmount === confirmation.kyowonAmount ? '완료' : '차액 확인'}</span>)}</div><div className="space-y-2">
              <div className={`p-2.5 rounded-lg border text-xs ${confirmation?.melleeaConfirmedAt ? 'bg-olive-50/50 border-olive-200' : 'bg-white border-slate-200'}`}><div className="flex items-center gap-2 mb-2"><span className="font-bold text-slate-700 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">멜레아</span>{confirmation?.melleeaConfirmedAt && <span className="text-[10px] text-slate-400 ml-auto">{confirmation.melleeaConfirmedBy}</span>}</div>{confirmation?.melleeaConfirmedAt ? (<div className="flex justify-between items-center px-0.5"><span className="font-bold text-olive-700 text-sm tracking-tight">{(confirmation.melleeaAmount || 0).toLocaleString('ko-KR')}원</span><button onClick={() => handleClearConfirmation('mellea')} className="text-[10px] text-slate-400 hover:text-brick-500 underline underline-offset-2">수정</button></div>) : (<div className="flex gap-1.5"><input type="text" value={melleeaInput} onChange={e => setMelleeaInput(e.target.value.replace(/[^0-9]/g, ''))} placeholder="금액" className="w-[75px] px-2 py-1 text-xs border border-slate-200 rounded text-right tabular-nums" /><input type="text" value={melleeaName} onChange={e => setMelleeaName(e.target.value)} placeholder="서명" className="flex-1 min-w-0 px-2 py-1 text-xs border border-slate-200 rounded" /><button onClick={() => handleConfirmAmount('mellea')} disabled={!melleeaInput || !melleeaName.trim()} className="px-2 py-1 bg-slate-800 text-white rounded text-[10px] font-bold disabled:opacity-50">확인</button></div>)}</div>
              <div className={`p-2.5 rounded-lg border text-xs ${confirmation?.kyowonConfirmedAt ? 'bg-teal-50/50 border-teal-200' : 'bg-white border-slate-200'}`}><div className="flex items-center gap-2 mb-2"><span className="font-bold text-slate-700 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">교원그룹</span>{confirmation?.kyowonConfirmedAt && <span className="text-[10px] text-slate-400 ml-auto">{confirmation.kyowonConfirmedBy}</span>}</div>{confirmation?.kyowonConfirmedAt ? (<div className="flex justify-between items-center px-0.5"><span className="font-bold text-teal-700 text-sm tracking-tight">{(confirmation.kyowonAmount || 0).toLocaleString('ko-KR')}원</span><button onClick={() => handleClearConfirmation('kyowon')} className="text-[10px] text-slate-400 hover:text-brick-500 underline underline-offset-2">수정</button></div>) : (<div className="flex gap-1.5"><input type="text" value={kyowonInput} onChange={e => setKyowonInput(e.target.value.replace(/[^0-9]/g, ''))} placeholder="금액" className="w-[75px] px-2 py-1 text-xs border border-slate-200 rounded text-right tabular-nums" /><input type="text" value={kyowonName} onChange={e => setKyowonName(e.target.value)} placeholder="서명" className="flex-1 min-w-0 px-2 py-1 text-xs border border-slate-200 rounded" /><button onClick={() => handleConfirmAmount('kyowon')} disabled={!kyowonInput || !kyowonName.trim()} className="px-2 py-1 bg-slate-800 text-white rounded text-[10px] font-bold disabled:opacity-50">확인</button></div>)}</div>
            </div></div>
          </div>
        </div>
      </div>

      <div className="mb-6"><div className="flex flex-wrap items-center gap-2"><button onClick={() => setAffiliateFilter('all')} className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${affiliateFilter === 'all' ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>전체보기<span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[11px] ${affiliateFilter === 'all' ? 'bg-teal-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{filteredOrders.length + filteredASRequests.length}</span></button><div className="hidden sm:block w-px h-8 bg-slate-200" />{AFFILIATE_OPTIONS.map(aff => { const nK = `${aff}_신규설치`; const mK = `${aff}_이전설치`; const aK = `${aff}_AS`; const nC = affiliateGroups.find(g => g.name === aff && g.category === '신규설치')?.orders.length || 0; const mC = affiliateGroups.find(g => g.name === aff && g.category === '이전설치')?.orders.length || 0; const aC = asAffiliateGroups.find(g => g.name === aff)?.requests.length || 0; return (<div key={aff} className="flex items-center gap-1 bg-slate-50 rounded-lg border border-slate-200 px-2 py-1.5"><span className="text-xs font-semibold text-slate-700 mr-1">{aff}</span><button onClick={() => setAffiliateFilter(nK)} disabled={nC === 0} className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${affiliateFilter === nK ? 'bg-teal-600 text-white' : nC > 0 ? 'bg-white border hover:bg-teal-50' : 'bg-slate-100 text-slate-300'}`}>신규 {nC}</button><button onClick={() => setAffiliateFilter(mK)} disabled={mC === 0} className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${affiliateFilter === mK ? 'bg-slate-700 text-white' : mC > 0 ? 'bg-white border hover:bg-slate-100' : 'bg-slate-100 text-slate-300'}`}>이전 {mC}</button><button onClick={() => setAffiliateFilter(aK)} disabled={aC === 0} className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${affiliateFilter === aK ? 'bg-carrot-500 text-white' : aC > 0 ? 'bg-white border hover:bg-carrot-50' : 'bg-slate-100 text-slate-300'}`}>AS {aC}</button></div>) })}</div></div>

      <div className="space-y-4">
        {displayedGroups.map(group => (
          <AffiliateGroup 
            key={`${group.name}_${group.category}`} 
            affiliateName={group.name} 
            categoryLabel={group.category} 
            orders={group.orders} 
            onViewOrder={handleViewOrder} 
            onQuoteView={handleQuoteView} 
            onToggleCategory={handleToggleCategory} 
          />
        ))}
        {(affiliateFilter === 'all' || affiliateFilter.endsWith('_AS')) && displayedASGroups.length > 0 && (<div className="flex items-center gap-3 pt-4 pb-1"><Wrench className="h-5 w-5 text-carrot-500" /><h2 className="text-lg font-bold text-slate-700">AS 정산</h2><div className="flex-1 border-t border-carrot-200" /></div>)}
        {(affiliateFilter === 'all' || affiliateFilter.endsWith('_AS')) && displayedASGroups.map(group => (<ASAffiliateGroup key={`as-${group.name}`} affiliateName={group.name} requests={group.requests} />))}
      </div>

      <OrderDetailDialog order={detailOrder} open={detailOpen} onOpenChange={setDetailOpen} />
      <QuoteCreateDialog order={orderForQuote} open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen} readOnly />
      <AlertDialog open={toggleConfirmOpen} onOpenChange={setToggleConfirmOpen}>
        <AlertDialogContent className="max-w-[400px] border-2 border-teal-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-teal-600" />정산구분 변경
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-3 pb-2">
              <p className="font-semibold text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 mb-3">현장: {pendingToggle?.businessName}</p>
              이 건의 정산구분을 <span className="text-teal-600 font-bold text-base">[{pendingToggle?.newCategory}]</span>(으)로 변경하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmToggleCategory} className="bg-teal-600">변경하기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function AffiliateGroup({ affiliateName, categoryLabel, orders, onViewOrder, onQuoteView, onToggleCategory }: { affiliateName: string; categoryLabel?: SettlementCategory; orders: Order[]; onViewOrder: (order: Order) => void; onQuoteView: (order: Order) => void; onToggleCategory?: (orderId: string, newCategory: SettlementCategory) => void }) {
  const [isOpen, setIsOpen] = useState(orders.length > 0); const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set()); const handleToggleExpand = (id: string) => { setExpandedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next }) }; const totals = orders.reduce((acc, order) => { const amounts = calcOrderAmounts(order); return { subtotal: acc.subtotal + amounts.subtotalWithProfit, vat: acc.vat + amounts.vat, total: acc.total + amounts.grandTotal } }, { subtotal: 0, vat: 0, total: 0 })
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm transition-all ${isOpen && orders.length > 0 ? 'ring-1 ring-teal-200 shadow-md' : ''}`}><button className={`w-full flex items-center justify-between px-6 py-4 rounded-t-xl transition-colors ${orders.length > 0 ? (isOpen ? 'bg-teal-50/60' : 'hover:bg-slate-50') : ''}`} onClick={() => orders.length > 0 && setIsOpen(prev => !prev)} disabled={orders.length === 0}><div className="flex items-center gap-3"><ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${orders.length === 0 ? 'opacity-30' : (isOpen ? '' : '-rotate-90')}`} /><h3 className="text-lg font-bold text-slate-800">{affiliateName}</h3>{categoryLabel && (<span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${categoryLabel === '신규설치' ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{categoryLabel}</span>)}<span className="text-sm text-slate-500">({orders.length}건)</span></div>{orders.length > 0 && (<div className="flex items-center gap-5 text-right"><div className="border-l border-slate-200 pl-5 text-right"><p className="text-[10px] text-slate-400 leading-tight">부가세별도</p><p className="text-sm font-bold tabular-nums text-slate-700">{totals.subtotal.toLocaleString('ko-KR')}</p></div><div className="border-l border-slate-200 pl-5 text-right"><p className="text-[10px] text-slate-400 leading-tight">부가세</p><p className="text-sm font-bold tabular-nums text-slate-500">{totals.vat.toLocaleString('ko-KR')}</p></div><div className="border-l border-slate-200 pl-5 text-right"><p className="text-[10px] text-teal-500 leading-tight">부가세포함</p><p className="text-base font-extrabold tabular-nums text-slate-900">{totals.total.toLocaleString('ko-KR')}</p></div></div>)}</button>{orders.length === 0 && <div className="py-3 px-6 text-sm text-slate-400">정산 대상이 없습니다.</div>}{isOpen && orders.length > 0 && (
      <div className="pt-0 pb-4 px-4"><div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"><table className="w-full text-sm"><thead><tr className="bg-slate-50/80 border-b-2 border-slate-800"><th className="text-left p-3 text-xs text-slate-500 font-semibold uppercase w-28">작업종류</th><th className="text-left p-3 text-xs text-slate-500 font-semibold uppercase w-24">발주일</th><th className="text-left p-3 text-xs text-slate-500 font-semibold uppercase w-24">설치완료일</th><th className="text-center p-3 text-xs text-slate-500 font-semibold uppercase w-20">발주서</th><th className="text-center p-3 text-xs text-slate-500 font-semibold uppercase w-24">계열사</th><th className="text-center p-3 text-xs text-slate-500 font-semibold uppercase">사업자명</th><th className="text-center p-3 text-xs text-slate-500 font-semibold uppercase w-20">견적서</th><th className="text-center p-3 text-xs text-slate-500 font-semibold uppercase w-24">현장사진</th><th className="text-center p-3 text-xs text-slate-500 font-semibold uppercase w-24">정산구분</th><th className="text-right p-3 text-xs text-slate-500 font-semibold uppercase w-32">부가세별도</th><th className="text-right p-3 text-xs text-slate-500 font-semibold uppercase w-28">부가세</th><th className="text-right p-3 text-xs text-slate-500 font-semibold uppercase w-36">부가세포함</th></tr></thead><tbody>{orders.map((order) => { const workTypes = sortWorkTypes(Array.from(new Set(order.items.map(i => i.workType)))); const amounts = calcOrderAmounts(order); return (<React.Fragment key={order.id}><tr className="border-b border-slate-100 hover:bg-teal-50/40 transition-colors cursor-pointer" onClick={() => handleToggleExpand(order.id)}><td className="p-3"><div className="flex flex-wrap gap-1">{workTypes.map(type => (<span key={type} className={`inline-flex items-center gap-1 text-[11px] font-medium border rounded-lg px-1.5 py-0.5 whitespace-nowrap ${getWorkTypeBadgeStyle(type).badge}`}>{WORK_TYPE_ICON_MAP[type] && React.createElement(WORK_TYPE_ICON_MAP[type], { className: `h-3 w-3 ${getWorkTypeBadgeStyle(type).icon}` })}{type}</span>))}</div></td><td className="p-3 text-sm tabular-nums">{formatShortDate(order.orderDate)}</td><td className="p-3 text-sm tabular-nums text-slate-500">{order.installCompleteDate ? formatShortDate(order.installCompleteDate) : '-'}</td><td className="p-3 text-center" onClick={e => e.stopPropagation()}><Button variant="ghost" size="sm" className="h-7 text-teal-600 hover:bg-teal-50" onClick={() => onViewOrder(order)}><FileText className="h-3.5 w-3.5 mr-1" />보기</Button></td><td className="p-3 text-center text-xs text-slate-600">{order.affiliate || '-'}</td><td className="p-3 text-center"><div className="flex items-center justify-center gap-1.5"><ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${expandedIds.has(order.id) ? '' : '-rotate-90'}`} /><p className="font-semibold text-sm truncate">{order.businessName}</p></div></td><td className="p-3 text-center" onClick={e => e.stopPropagation()}>{order.customerQuote?.items?.length ? (<Button variant="ghost" size="sm" className="h-7 text-teal-600 hover:bg-teal-50" onClick={() => onQuoteView(order)}><FileText className="h-3.5 w-3.5 mr-1" />보기</Button>) : '-'}</td><td className="p-3 text-center" onClick={e => e.stopPropagation()}><SitePhotoViewer photos={order.sitePhotos || []} businessName={order.businessName} /></td><td className="p-3 text-center" onClick={e => e.stopPropagation()}>{(() => { const currentCat = order.settlementCategory || (order.items.some(i => i.workType === '신규설치') ? '신규설치' : '이전설치'); const isAuto = !order.settlementCategory; const newCat: SettlementCategory = currentCat === '신규설치' ? '이전설치' : '신규설치'; return (<button onClick={() => onToggleCategory?.(order.id, newCat)} className={`inline-flex items-center gap-1 text-[11px] font-medium border rounded-lg px-1.5 py-0.5 ${isAuto ? 'border-dashed border-slate-300 text-slate-400' : currentCat === '신규설치' ? 'border-teal-300 bg-teal-50 text-teal-700' : 'border-slate-300 bg-slate-50 text-slate-600'}`}><RefreshCw className="h-3 w-3" />{currentCat === '신규설치' ? '신규' : '이전'}</button>) })()}</td><td className="p-3 text-right text-sm tabular-nums">{amounts.subtotalWithProfit.toLocaleString('ko-KR')}</td><td className="p-3 text-right text-sm tabular-nums text-slate-500">{amounts.vat.toLocaleString('ko-KR')}</td><td className="p-3 text-right text-sm font-bold tabular-nums text-slate-900">{amounts.grandTotal.toLocaleString('ko-KR')}원</td></tr>{expandedIds.has(order.id) && (<tr><td colSpan={12} className="p-0 border-none"><QuoteSnapshotDetail snapshot={amounts} businessName={order.businessName} /></td></tr>)}</React.Fragment>) })}</tbody></table></div></div>
    )}</div>
  )
}

function QuoteSnapshotDetail({ snapshot, businessName }: { snapshot: any; businessName: string }) {
  const eqs = snapshot.equipItems || []; const ins = snapshot.installItems || []
  return (<div className="mx-4 my-3"><div className="border-2 border-teal-300 rounded-xl overflow-hidden bg-white shadow-md"><div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-700 to-teal-600"><Receipt className="h-4 w-4 text-white" /><span className="text-sm font-bold text-white tracking-wide">견적서</span><span className="text-xs text-teal-200 ml-2">— {businessName}</span></div><table className="w-full text-sm"><thead><tr className="border-b-2 border-slate-800 bg-slate-50/80 text-xs text-slate-500 font-semibold uppercase"><th className="py-2 px-2 text-center w-10">No.</th><th className="py-2 px-2 text-center">품목 / 모델명</th><th className="py-2 px-2 text-center w-16">수량</th><th className="py-2 px-2 text-right w-28">단가</th><th className="py-2 px-2 text-right w-32">금액</th></tr></thead><tbody><tr className="bg-slate-100"><td colSpan={5} className="py-1.5 px-3 text-xs font-bold text-slate-600 uppercase tracking-widest">[ 장비 ]</td></tr>{eqs.length > 0 ? eqs.map((i: any, idx: number) => { const { product, model } = splitItemName(i.itemName); return (<tr key={idx} className="border-b border-slate-100 hover:bg-teal-50/40"><td className="py-2 px-2 text-center text-slate-400">{idx + 1}</td><td className="py-2 px-2 text-center text-slate-800 font-medium">{product} {model && <span className="text-slate-400 ml-1">({model})</span>}</td><td className="py-2 px-2 text-center">{i.quantity}</td><td className="py-2 px-2 text-right tabular-nums">{i.unitPrice.toLocaleString()}</td><td className="py-2 px-2 text-right font-bold text-slate-800 tabular-nums">{i.totalPrice.toLocaleString()}</td></tr>) }) : <tr><td colSpan={5} className="py-3 text-center text-xs text-slate-400">장비 항목 없음</td></tr>}{snapshot.equipRounding > 0 && <tr className="border-t border-dashed"><td colSpan={4} className="py-1.5 px-2 text-right text-slate-500 text-xs">단위절사</td><td className="py-1.5 px-2 text-right text-brick-500 font-medium text-xs">-{snapshot.equipRounding.toLocaleString()}</td></tr>}<tr className="bg-slate-50 font-bold text-xs"><td colSpan={4} className="py-1.5 px-2 text-right text-slate-700">장비비 소계</td><td className="py-1.5 px-2 text-right text-slate-700">{snapshot.equipSubtotal.toLocaleString()}</td></tr><tr className="bg-slate-100"><td colSpan={5} className="py-1.5 px-3 text-xs font-bold text-slate-600 uppercase tracking-widest">[ 설치비 ]</td></tr>{ins.length > 0 ? ins.map((i: any, idx: number) => { const { product, model } = splitItemName(i.itemName); return (<tr key={idx} className="border-b border-slate-100 hover:bg-teal-50/40"><td className="py-2 px-2 text-center text-slate-400">{idx + 1}</td><td className="py-2 px-2 text-center text-slate-800 font-medium">{product} {model && <span className="text-slate-400 ml-1">({model})</span>}</td><td className="py-2 px-2 text-center">{i.quantity}</td><td className="py-2 px-2 text-right tabular-nums">{i.unitPrice.toLocaleString()}</td><td className="py-2 px-2 text-right font-bold text-slate-800 tabular-nums">{i.totalPrice.toLocaleString()}</td></tr>) }) : <tr><td colSpan={5} className="py-3 text-center text-xs text-slate-400">설치비 항목 없음</td></tr>}{snapshot.installRounding > 0 && <tr className="border-t border-dashed"><td colSpan={4} className="py-1.5 px-2 text-right text-slate-500 text-xs">단위절사</td><td className="py-1.5 px-2 text-right text-brick-500 font-medium text-xs">-{snapshot.installRounding.toLocaleString()}</td></tr>}<tr className="bg-slate-50 font-bold text-xs border-b-2 border-slate-300"><td colSpan={4} className="py-1.5 px-2 text-right text-slate-700">설치비 소계</td><td className="py-1.5 px-2 text-right text-slate-700">{snapshot.installSubtotal.toLocaleString()}</td></tr></tbody><tfoot><tr><td colSpan={5} className="p-3 pt-4 flex justify-end"><div className="w-[300px] rounded-xl border border-slate-200 overflow-hidden shadow-sm"><div className="flex justify-between px-4 py-2 bg-slate-50/50 text-xs"><span>공급가액</span><span>{snapshot.supplyAmount.toLocaleString()}</span></div><div className="flex justify-between px-4 py-2 bg-slate-50/50 text-xs text-gold-600 font-semibold"><span>기업이윤 (3%)</span><span>+{snapshot.adjustedProfit.toLocaleString()}</span></div><div className="flex justify-between px-4 py-2 bg-white text-xs font-bold border-y border-slate-100"><span>소계 (VAT별도)</span><span>{snapshot.subtotalWithProfit.toLocaleString()}</span></div><div className="flex justify-between px-4 py-2 bg-slate-50/50 text-xs text-slate-500"><span>부가세 (10%)</span><span>+{snapshot.vat.toLocaleString()}</span></div><div className="flex justify-between px-4 py-3 bg-teal-600 text-white font-black text-sm"><span>최종금액</span><span>{snapshot.grandTotal.toLocaleString()}원</span></div></div></td></tr></tfoot></table></div></div>)
}

function ASAffiliateGroup({ affiliateName, requests }: { affiliateName: string; requests: ASRequest[] }) {
  const [isOpen, setIsOpen] = useState(requests.length > 0); const rawTotal = requests.reduce((sum, r) => sum + (Number(r.asCost) || 0) + (Number(r.receptionFee) || 0), 0); const truncated = Math.floor(rawTotal / 1000) * 1000; const vat = Math.floor(truncated * 0.1); const totalWithVat = truncated + vat
  return (<div className={`bg-white rounded-xl border border-slate-200 shadow-sm transition-all ${isOpen && requests.length > 0 ? 'ring-1 ring-carrot-200 shadow-md' : ''}`}><button className={`w-full flex items-center justify-between px-6 py-4 rounded-t-xl transition-colors ${requests.length > 0 ? (isOpen ? 'bg-carrot-50/60' : 'hover:bg-slate-50') : ''}`} onClick={() => requests.length > 0 && setIsOpen(prev => !prev)} disabled={requests.length === 0}><div className="flex items-center gap-3"><ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${requests.length === 0 ? 'opacity-30' : (isOpen ? '' : '-rotate-90')}`} /><Wrench className="h-4 w-4 text-carrot-500" /><h3 className="text-lg font-bold text-slate-800">{affiliateName} AS</h3><span className="text-sm text-slate-500">({requests.length}건)</span></div>{requests.length > 0 && (<div className="flex items-center gap-5 text-right"><div className="border-l border-slate-200 pl-5 text-right"><p className="text-[10px] text-slate-400 leading-tight">소계</p><p className="text-sm font-bold tabular-nums text-slate-700">{truncated.toLocaleString()}</p></div><div className="border-l border-slate-200 pl-5 text-right"><p className="text-[10px] text-slate-400 leading-tight">부가세</p><p className="text-sm font-bold tabular-nums text-slate-500">{vat.toLocaleString()}</p></div><div className="border-l border-slate-200 pl-5 text-right"><p className="text-[10px] text-carrot-500 leading-tight">부가세포함</p><p className="text-base font-extrabold tabular-nums text-slate-900">{totalWithVat.toLocaleString()}원</p></div></div>)}</button>{requests.length === 0 && <div className="py-3 px-6 text-sm text-slate-400">AS 정산 대상이 없습니다.</div>}{isOpen && requests.length > 0 && (<div className="pt-0 pb-4 px-4"><div className="hidden md:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto"><table className="w-full text-xs" style={{ minWidth: '1000px' }}><thead><tr className="bg-slate-50/80 border-b-2 border-slate-800"><th className="text-left p-3 text-slate-500 font-semibold uppercase">계열사</th><th className="text-left p-3 text-slate-500 font-semibold uppercase">접수일</th><th className="text-left p-3 text-slate-500 font-semibold uppercase">사업자명</th><th className="text-left p-3 text-slate-500 font-semibold uppercase">성명</th><th className="text-left p-3 text-slate-500 font-semibold uppercase">연락처</th><th className="text-left p-3 text-slate-500 font-semibold uppercase">모델명</th><th className="text-left p-3 text-slate-500 font-semibold uppercase">AS사유</th><th className="text-left p-3 text-slate-500 font-semibold uppercase">처리일</th><th className="text-left p-3 text-slate-500 font-semibold uppercase">조치내역</th><th className="text-right p-3 text-slate-500 font-semibold uppercase">AS비용</th><th className="text-right p-3 text-slate-500 font-semibold uppercase">접수비</th><th className="text-right p-3 text-slate-500 font-semibold uppercase">합계</th></tr></thead><tbody>{requests.map((req) => (<tr key={req.id} className="border-b border-slate-100 hover:bg-carrot-50/30 transition-colors"><td className="p-3 text-slate-600">{req.affiliate || '-'}</td><td className="p-3 tabular-nums">{req.receptionDate ? formatShortDate(req.receptionDate) : '-'}</td><td className="p-3 font-semibold text-slate-800">{req.businessName}</td><td className="p-3 text-slate-600">{req.contactName || '-'}</td><td className="p-3 text-slate-500 tabular-nums">{req.contactPhone || '-'}</td><td className="p-3 text-slate-600">{req.modelName || '-'}</td><td className="p-3 text-slate-600 max-w-[150px] truncate" title={req.asReason}>{req.asReason || '-'}</td><td className="p-3 tabular-nums">{req.processedDate ? formatShortDate(req.processedDate) : '-'}</td><td className="p-3 text-slate-600 max-w-[150px] truncate" title={req.processingDetails}>{req.processingDetails || '-'}</td><td className="p-3 text-right tabular-nums text-slate-600">{(req.asCost || 0).toLocaleString()}</td><td className="p-3 text-right tabular-nums text-slate-600">{(req.receptionFee || 0).toLocaleString()}</td><td className="p-3 text-right font-bold text-slate-900 tabular-nums">{((req.asCost || 0) + (req.receptionFee || 0)).toLocaleString()}원</td></tr>))}</tbody></table></div></div>)}</div>)
}
