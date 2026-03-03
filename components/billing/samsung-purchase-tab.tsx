/**
 * 배송 및 매입내역 탭 (탭 2)
 *
 * 지출결의서와 동일한 패턴:
 * - 생성 전: "X월 매입내역 생성하기" 버튼
 * - 생성: 정산 데이터 + 단가표 매칭 → DB 스냅샷 저장
 * - 생성 후: 확정본 아코디언 표시 + 수정/재작성 버튼
 * - 수정: 매입처, 매입가(단가), 수량 편집 → 매입가(금액) 자동 계산 → DB 저장
 */

'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import type { Order } from '@/types/order'
import { ITEM_DELIVERY_STATUS_LABELS, ITEM_DELIVERY_STATUS_COLORS } from '@/types/order'
import { computeItemDeliveryStatus, formatShortDate, getWarehouseDetail, setWarehouseCache } from '@/lib/delivery-utils'
import {
  fetchWarehouses,
  fetchPriceTable,
  fetchPurchaseReport,
  savePurchaseReport,
  updatePurchaseReportWithItems,
} from '@/lib/supabase/dal'
import type { PurchaseReport, PurchaseReportItem } from '@/lib/supabase/dal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ShoppingCart, ChevronDown, ChevronRight, MapPin, CalendarDays,
  Plus, RefreshCw, CheckCircle2, Loader2, Pencil, Save, X, Download,
} from 'lucide-react'
import { buildExcelFileName, exportDeliveryPurchaseExcel } from '@/lib/excel-export'

// ─── SET 모델 그룹 컬러바 ───
const SET_GROUP_COLORS = [
  '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#06B6D4',
]

/**
 * 배송/매입내역 화면에서 사용하는 기본 DC율
 *
 * 왜 필요한가:
 * - 요청사항대로 "반출가 × DC율 = 매입가(단가)"를 화면/엑셀에서 동일하게 보여주기 위해
 *   기준 DC율이 필요합니다.
 *
 * 수정 영향:
 * - 값을 바꾸면 화면 표시와 엑셀의 계산 기준이 함께 바뀝니다.
 * - 기존 DB 저장 구조(unitPrice, totalPrice)는 그대로 유지됩니다.
 */
const DEFAULT_DISCOUNT_RATE = 0.45

/**
 * 행 데이터의 DC율을 안전하게 결정
 * - 저장된 값이 있으면 그 값을 사용
 * - 없으면 기본값(45%) 사용
 */
function getDiscountRate(item: PurchaseReportItem): number {
  // DC율은 "미입력(undefined)"과 "실제 0%"를 구분해야 합니다.
  // - 미입력: 기존 업무 기본값(45%) 사용
  // - 0% 입력: 사용자가 직접 넣은 값이므로 그대로 유지
  if (typeof item.discountRate === 'number' && Number.isFinite(item.discountRate) && item.discountRate >= 0 && item.discountRate < 1) {
    return item.discountRate
  }
  return DEFAULT_DISCOUNT_RATE
}

/**
 * 숫자 입력 문자열을 실제 숫자로 안전 변환
 * - 콤마(,)나 퍼센트(%)가 포함되어도 입력 가능한 형태로 정리
 * - 빈 문자열은 0으로 처리해서 "입력칸 비우기"를 허용
 */
function parseNumericInput(value: string): number {
  const normalized = value.replace(/,/g, '').replace(/%/g, '').trim()
  if (!normalized) return 0
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * 숫자 입력칸 표시용 포맷
 * - 0 또는 미입력은 빈 문자열로 보여서 "기본 0 때문에 입력 불편"을 줄입니다.
 * - 1,000 단위 콤마를 보여서 금액 가독성을 높입니다.
 */
function formatNumericInput(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return ''
  return Math.round(value).toLocaleString('ko-KR')
}

/**
 * DC율 입력칸 표시용 포맷(퍼센트 숫자만 표시)
 * - 내부 저장은 0~1 비율, 화면 표시만 0~100 퍼센트로 변환합니다.
 */
function formatPercentInput(rate?: number): string {
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0) return ''
  return Number((rate * 100).toFixed(2)).toString()
}

/**
 * 행 데이터의 반출가를 안전하게 계산
 * - 저장된 반출가가 있으면 우선 사용
 * - 없으면 현재 매입가(단가)와 DC율을 역산해서 보여줌
 *
 * 주의:
 * - 이 함수는 "표시 목적"입니다.
 * - DB에는 반출가 컬럼이 필수가 아니므로, 화면/엑셀에서 일관된 계산 근거를 보여주기 위해 씁니다.
 */
function getListPrice(item: PurchaseReportItem): number {
  if (typeof item.listPrice === 'number' && item.listPrice > 0) {
    return item.listPrice
  }
  const discountRate = getDiscountRate(item)
  if (!item.unitPrice || discountRate >= 1) return 0
  return Math.round(item.unitPrice / (1 - discountRate))
}

/**
 * 행 데이터의 매입가(단가)를 안전하게 계산
 * - 저장된 단가가 있으면 우선 사용
 * - 단가가 비어 있으면 반출가 × (1-DC율)로 계산
 */
function getPurchaseUnitPrice(item: PurchaseReportItem): number {
  if (item.unitPrice && item.unitPrice > 0) return item.unitPrice
  const listPrice = getListPrice(item)
  const discountRate = getDiscountRate(item)
  return listPrice > 0 ? Math.round(listPrice * (1 - discountRate)) : 0
}

/**
 * 행 데이터의 매입가(금액)를 안전하게 계산
 * - 저장값(totalPrice)이 있으면 그대로 사용
 * - 없으면 매입가(단가) × 수량으로 계산
 */
function getPurchaseTotalPrice(item: PurchaseReportItem): number {
  if (item.totalPrice && item.totalPrice > 0) return item.totalPrice
  return getPurchaseUnitPrice(item) * (item.quantity || 0)
}

/** 연속된 같은 setModel을 가진 행들을 그룹으로 묶어 색상 할당 */
function computeSetModelGroups(items: PurchaseReportItem[]): (string | undefined)[] {
  const colors: (string | undefined)[] = new Array(items.length).fill(undefined)
  let colorIdx = 0
  let i = 0
  while (i < items.length) {
    const setModel = items[i].setModel
    if (!setModel) { i++; continue }
    let j = i
    while (j < items.length && items[j].setModel === setModel) j++
    const color = SET_GROUP_COLORS[colorIdx % SET_GROUP_COLORS.length]
    for (let k = i; k < j; k++) colors[k] = color
    colorIdx++
    i = j
  }
  return colors
}

interface SamsungPurchaseTabProps {
  orders: Order[]
  selectedYear: number
  selectedMonth: number
}

export function SamsungPurchaseTab({ orders, selectedYear, selectedMonth }: SamsungPurchaseTabProps) {
  // ─── 상태 ───
  const [savedReport, setSavedReport] = useState<PurchaseReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showRewriteConfirm, setShowRewriteConfirm] = useState(false)

  // 수정 모드
  const [isEditing, setIsEditing] = useState(false)
  const [editItems, setEditItems] = useState<PurchaseReportItem[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // 아코디언 펼침 상태
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // ─── 월 변경 시 저장된 매입내역 조회 ───
  useEffect(() => {
    setIsLoading(true)
    setSavedReport(null)
    setIsEditing(false)
    fetchPurchaseReport(selectedYear, selectedMonth).then(report => {
      setSavedReport(report)
      setIsLoading(false)
    })
  }, [selectedYear, selectedMonth])

  const toggleExpand = (orderId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

  /**
   * 정산 데이터로 매입내역 행을 생성하는 함수
   */
  const generateRows = useCallback(async (): Promise<PurchaseReportItem[]> => {
    const rows: PurchaseReportItem[] = []

    const [warehouses, ptData] = await Promise.all([
      fetchWarehouses(),
      fetchPriceTable(selectedYear),
    ])
    setWarehouseCache(warehouses)

    const componentPriceMap: Record<string, number> = {}
    ptData.forEach(row => {
      row.components.forEach(comp => {
        if (comp.model && comp.unitPrice > 0) {
          componentPriceMap[comp.model] = comp.unitPrice
        }
      })
    })

    const filteredOrders = orders.filter(order => {
      const hasNewInstall = order.items.some(i =>
        i.workType === '신규설치' || i.workType === '이전설치' || i.workType === '재고설치'
      )
      return hasNewInstall && (order.equipmentItems || []).length > 0
    })

    let sortOrder = 0

    filteredOrders.forEach(order => {
      const items = order.equipmentItems || []
      items.forEach(item => {
        const qty = item.quantity || 1
        const discountRate = DEFAULT_DISCOUNT_RATE

        // 반출가 우선순위:
        // 1) 단가표의 구성품 출하가
        // 2) 기존 입력된 매입가를 DC율로 역산한 값(보정값)
        const mappedListPrice = item.componentModel ? componentPriceMap[item.componentModel] : 0
        const listPrice = mappedListPrice > 0
          ? mappedListPrice
          : (item.unitPrice && item.unitPrice > 0
            ? Math.round(item.unitPrice / (1 - discountRate))
            : 0)

        // 매입가(단가) 우선순위:
        // 1) 기존 입력값(unitPrice)
        // 2) 반출가 × (1-DC율) 자동계산
        let unitPrice = 0
        if (item.unitPrice && item.unitPrice > 0) {
          unitPrice = item.unitPrice
        } else if (listPrice > 0) {
          unitPrice = Math.round(listPrice * (1 - discountRate))
        }
        const totalPrice = unitPrice * qty
        const deliveryStatus = computeItemDeliveryStatus(item)
        const whDetail = getWarehouseDetail(item.warehouseId)

        rows.push({
          sortOrder: sortOrder++,
          orderId: order.id,
          businessName: order.businessName,
          affiliate: order.affiliate || '',
          siteAddress: order.address || '',
          orderDateDisplay: order.orderDate || '',
          deliveryStatus,
          supplier: item.supplier || '삼성전자',
          orderNumber: item.orderNumber || '',
          itemOrderDate: item.orderDate || '',
          scheduledDeliveryDate: item.scheduledDeliveryDate || '',
          confirmedDeliveryDate: item.confirmedDeliveryDate || '',
          componentModel: item.componentModel || '',
          componentName: item.componentName || '',
          setModel: item.setModel || '',
          listPrice,
          discountRate,
          quantity: qty,
          unitPrice,
          totalPrice,
          warehouseName: whDetail ? `${whDetail.name}_${whDetail.managerName}` : '',
          warehouseAddress: whDetail?.address || '',
        })
      })
    })

    return rows
  }, [orders, selectedYear])

  /** 매입내역 생성 */
  const handleGenerate = async () => {
    setShowConfirm(false)
    setShowRewriteConfirm(false)
    setIsGenerating(true)
    try {
      const rows = await generateRows()
      const orderIds = new Set(rows.map(r => r.orderId))
      const totals = {
        totalPurchase: rows.reduce((sum, r) => sum + r.totalPrice, 0),
        orderCount: orderIds.size,
        itemCount: rows.length,
      }
      const success = await savePurchaseReport(selectedYear, selectedMonth, rows, totals)
      if (success) {
        const report = await fetchPurchaseReport(selectedYear, selectedMonth)
        setSavedReport(report)
      } else {
        alert('매입내역 저장에 실패했습니다.')
      }
    } catch (err) {
      console.error('매입내역 생성 실패:', err)
      alert('매입내역 생성 중 오류가 발생했습니다.')
    } finally {
      setIsGenerating(false)
    }
  }

  /** 수정 모드 진입 */
  const handleStartEdit = () => {
    if (!savedReport) return
    setEditItems(savedReport.items.map(item => ({ ...item })))
    setIsEditing(true)
  }

  /** 수정 취소 */
  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditItems([])
  }

  /**
   * 편집 필드 변경 → 매입금액 자동 재계산
   *
   * 반출가(listPrice) 수정 규칙:
   * - 반출가를 수정하면 "반출가 × (1-DC율)"로 매입가(단가)를 즉시 재계산합니다.
   * - 이렇게 계산된 매입가(단가)가 저장되기 때문에,
   *   반출가 DB 컬럼이 없는 환경에서도 동일한 결과를 재현할 수 있습니다.
   */
  const handleFieldChange = (index: number, field: string, value: string | number) => {
    setEditItems(prev => {
      const next = [...prev]
      const item = { ...next[index], [field]: value }

      // 반출가를 수정한 경우: DC율 기준으로 단가를 다시 계산해 저장
      if (field === 'listPrice') {
        const discountRate = getDiscountRate(item)
        const listPrice = typeof value === 'number' ? value : Number(value) || 0
        item.listPrice = listPrice
        item.unitPrice = listPrice > 0 ? Math.round(listPrice * (1 - discountRate)) : 0
      }

      // DC율 수정도 허용한 경우를 대비해 단가를 즉시 재계산하도록 유지
      if (field === 'discountRate') {
        // DC율 입력값은 0%~99% 범위로 고정해서 오입력(100% 이상)으로
        // 단가가 0/음수가 되는 문제를 예방합니다.
        const rawDiscountRate = typeof value === 'number' ? value : Number(value)
        const discountRate = Number.isFinite(rawDiscountRate)
          ? Math.min(Math.max(rawDiscountRate, 0), 0.99)
          : 0
        item.discountRate = discountRate
        const listPrice = getListPrice(item)
        item.unitPrice = listPrice > 0 ? Math.round(listPrice * (1 - discountRate)) : item.unitPrice
      }

      item.totalPrice = item.unitPrice * item.quantity
      next[index] = item
      return next
    })
  }

  /** 수정 저장 */
  const handleSaveEdit = async () => {
    if (!savedReport) return
    setIsSaving(true)
    try {
      const orderIds = new Set(editItems.map(r => r.orderId))
      const totals = {
        totalPurchase: editItems.reduce((sum, r) => sum + r.totalPrice, 0),
        orderCount: orderIds.size,
        itemCount: editItems.length,
      }
      const success = await updatePurchaseReportWithItems(savedReport.id, editItems, totals)
      if (success) {
        const report = await fetchPurchaseReport(selectedYear, selectedMonth)
        setSavedReport(report)
        setIsEditing(false)
        setEditItems([])
      } else {
        alert('저장에 실패했습니다.')
      }
    } catch (err) {
      console.error('수정 저장 실패:', err)
      alert('저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  // ─── 표시 데이터 ───
  const displayItems = useMemo(
    () => isEditing ? editItems : (savedReport?.items || []),
    [isEditing, editItems, savedReport?.items]
  )

  /** 엑셀 다운로드 — 매입내역 전체 (요청하신 13개 컬럼 및 병합 양식 적용) */
  const handleExportExcel = () => {
    const monthLabel = `${selectedYear}년 ${selectedMonth}월`
    exportDeliveryPurchaseExcel({
      items: displayItems,
      fileName: buildExcelFileName('멜레아정산_배송매입내역', monthLabel),
      monthLabel
    })
  }

  // orderId로 그룹핑 (아코디언용)
  const orderGroups = useMemo(() => {
    const groups: { orderId: string; businessName: string; address: string; orderDate: string; items: PurchaseReportItem[] }[] = []
    const map = new Map<string, PurchaseReportItem[]>()

    displayItems.forEach(item => {
      if (!map.has(item.orderId)) map.set(item.orderId, [])
      map.get(item.orderId)!.push(item)
    })

    map.forEach((items, orderId) => {
      groups.push({
        orderId,
        businessName: items[0].businessName,
        address: items[0].siteAddress,
        orderDate: items[0].orderDateDisplay,
        items,
      })
    })

    return groups
  }, [displayItems])

  const totalPurchase = useMemo(
    () => displayItems.reduce((sum, r) => sum + getPurchaseTotalPrice(r), 0),
    [displayItems]
  )

  // ─── 로딩/생성 중/다이얼로그 ───
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
        <Loader2 className="h-6 w-6 mx-auto mb-2 text-slate-400 animate-spin" />
        <p className="text-slate-500">확인 중...</p>
      </div>
    )
  }

  if (isGenerating) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
        <Loader2 className="h-10 w-10 mx-auto mb-4 text-carrot-500 animate-spin" />
        <p className="text-lg font-semibold text-slate-700">
          {selectedYear}년 {selectedMonth}월 매입내역 생성 중...
        </p>
        <p className="text-sm text-slate-500 mt-2">배송 데이터와 단가표를 매칭하고 있습니다.</p>
      </div>
    )
  }

  if (showConfirm) {
    return (
      <div className="bg-white rounded-xl border-2 border-carrot-300 shadow-lg p-8 text-center max-w-lg mx-auto">
        <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-carrot-500" />
        <h3 className="text-lg font-bold text-slate-900 mb-2">
          {selectedYear}년 {selectedMonth}월 매입내역 생성
        </h3>
        <p className="text-sm text-slate-600 mb-6">
          현재 배송 데이터와 단가표를 기반으로 매입내역을 작성합니다.<br />
          생성 후에는 단가표/배송 변경에 영향받지 않습니다.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => setShowConfirm(false)}>취소</Button>
          <Button className="bg-carrot-500 hover:bg-carrot-600 text-white" onClick={handleGenerate}>생성하기</Button>
        </div>
      </div>
    )
  }

  if (showRewriteConfirm) {
    return (
      <div className="bg-white rounded-xl border-2 border-brick-300 shadow-lg p-8 text-center max-w-lg mx-auto">
        <RefreshCw className="h-12 w-12 mx-auto mb-4 text-brick-500" />
        <h3 className="text-lg font-bold text-slate-900 mb-2">
          {selectedYear}년 {selectedMonth}월 매입내역 재작성
        </h3>
        <p className="text-sm text-slate-600 mb-2">기존 매입내역을 삭제하고 현재 데이터로 다시 작성합니다.</p>
        <p className="text-sm text-brick-600 font-semibold mb-6">기존 확정본은 복구할 수 없습니다.</p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => setShowRewriteConfirm(false)}>취소</Button>
          <Button className="bg-brick-500 hover:bg-brick-600 text-white" onClick={handleGenerate}>재작성하기</Button>
        </div>
      </div>
    )
  }

  // ─── 생성 버튼 ───
  if (!savedReport) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="py-20 text-center">
          <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-400 text-sm mb-6">아직 이 달의 매입내역이 작성되지 않았습니다.</p>
          <Button
            size="lg"
            className="bg-carrot-500 hover:bg-carrot-600 text-white gap-2 px-8 py-6 text-base"
            onClick={() => setShowConfirm(true)}
          >
            <Plus className="h-5 w-5" />
            {selectedYear}년 {selectedMonth}월 매입내역 생성하기
          </Button>
          <p className="text-xs text-slate-400 mt-4">배송 데이터 + 단가표(DC 45%)를 기반으로 자동 작성됩니다.</p>
        </div>
      </div>
    )
  }

  // ─── 확정본 표시 ───
  return (
    <div className="space-y-4">
      {/* 상단 액션 바 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          {isEditing ? (
            <div className="flex items-center gap-1.5 text-yellow-700 bg-yellow-50 px-3 py-1.5 rounded-lg border border-yellow-300">
              <Pencil className="h-4 w-4" />
              <span className="text-xs font-semibold">수정 중</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-olive-600 bg-olive-50 px-3 py-1.5 rounded-lg border border-olive-200">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-semibold">확정됨</span>
            </div>
          )}
          <p className="text-sm text-slate-500">
            {savedReport.orderCount}건 · {savedReport.itemCount}개 구성품 · 매입합계 {totalPurchase.toLocaleString('ko-KR')}원
            <span className="mx-1.5 text-slate-300">|</span>
            {new Date(savedReport.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 작성
          </p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={handleCancelEdit} className="gap-1.5">
                <X className="h-3.5 w-3.5" />취소
              </Button>
              <Button size="sm" className="gap-1.5 bg-olive-500 hover:bg-olive-600 text-white" onClick={handleSaveEdit} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                저장
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={handleStartEdit} className="gap-1.5 text-yellow-700 border-yellow-300 hover:bg-yellow-50">
                <Pencil className="h-3.5 w-3.5" />수정
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowRewriteConfirm(true)} className="gap-1.5 text-slate-600">
                <RefreshCw className="h-3.5 w-3.5" />재작성
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1.5">
                <Download className="h-3.5 w-3.5" />엑셀
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 발주별 아코디언 리스트 */}
      <div className="space-y-2">
        {orderGroups.map(group => {
          const isExpanded = expandedIds.has(group.orderId)
          const groupColors = computeSetModelGroups(group.items)
          const orderTotal = group.items.reduce((sum, item) => sum + getPurchaseTotalPrice(item), 0)

          return (
            <div key={group.orderId} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* 발주 헤더 */}
              <button
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50/60'}`}
                onClick={() => toggleExpand(group.orderId)}
              >
                {isExpanded
                  ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                }
                <Badge className="bg-olive-50 text-olive-700 border-olive-200 text-[10px] shrink-0">배송완료</Badge>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-800 truncate">{group.businessName}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate max-w-[280px]">{group.address}</span>
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0">
                      <CalendarDays className="h-3 w-3" />
                      {formatShortDate(group.orderDate)}
                    </span>
                    <span className="text-[11px] text-slate-400 shrink-0">구성품 {group.items.length}개</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold tabular-nums text-teal-700">
                    {orderTotal.toLocaleString('ko-KR')}
                    <span className="text-slate-400 font-medium ml-0.5">원</span>
                  </p>
                </div>
              </button>

              {/* 아코디언: 구성품 상세 테이블 */}
              {isExpanded && (
                <div className="border-t border-slate-200 bg-slate-50/50">
                  <div className="hidden md:block overflow-x-auto px-3 py-3">
                    <table className="w-full text-sm border-collapse" style={{ minWidth: '1750px' }}>
                      <thead>
                        <tr className="bg-slate-100/80 text-[11px] text-slate-500 tracking-wide">
                          <th className="text-center px-2 py-2 font-medium" style={{ width: '36px' }}>No.</th>
                          <th className="text-left px-2 py-2 font-medium" style={{ width: '75px' }}>배송상태</th>
                          <th className="text-left px-2 py-2 font-medium" style={{ width: '75px' }}>매입처</th>
                          <th className="text-left px-2 py-2 font-medium" style={{ width: '100px' }}>주문번호</th>
                          <th className="text-left px-2 py-2 font-medium" style={{ width: '85px' }}>주문일</th>
                          <th className="text-left px-2 py-2 font-medium" style={{ width: '85px' }}>배송예정일</th>
                          <th className="text-left px-2 py-2 font-medium" style={{ width: '85px' }}>배송확정일</th>
                          <th className="text-left px-2 py-2 font-medium" style={{ width: '160px' }}>모델명</th>
                          <th className="text-right px-2 py-2 font-medium bg-slate-50" style={{ width: '95px' }}>반출가</th>
                          <th className="text-center px-2 py-2 font-medium bg-slate-50" style={{ width: '65px' }}>DC율</th>
                          <th className="text-right px-2 py-2 font-medium bg-teal-50/50" style={{ width: '95px' }}>매입가(단가)</th>
                          <th className="text-center px-2 py-2 font-medium" style={{ width: '40px' }}>수량</th>
                          <th className="text-right px-2 py-2 font-medium bg-teal-50/50" style={{ width: '105px' }}>매입가(금액)</th>
                          <th className="text-left px-2 py-2 font-medium" style={{ width: '65px' }}>구성품</th>
                          <th className="text-left px-2 py-2 font-medium" style={{ width: '120px' }}>창고명</th>
                          <th className="text-left px-2 py-2 font-medium" style={{ width: '180px' }}>창고주소</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-100">
                        {group.items.map((item, idx) => {
                          const barColor = groupColors[idx]
                          const editIndex = isEditing ? editItems.findIndex(e => e.sortOrder === item.sortOrder) : -1
                          const displayDiscountRate = getDiscountRate(item)
                          const displayListPrice = getListPrice(item)
                          const displayUnitPrice = getPurchaseUnitPrice(item)
                          const displayTotalPrice = getPurchaseTotalPrice(item)

                          return (
                            <tr key={item.id || idx} className={`transition-colors ${isEditing ? 'bg-yellow-50/20' : 'hover:bg-teal-50/20'}`}>
                              <td className="px-2 py-2 text-center text-slate-400 tabular-nums text-xs">{idx + 1}</td>
                              <td className="px-2 py-2">
                                <Badge className={`${ITEM_DELIVERY_STATUS_COLORS[item.deliveryStatus as keyof typeof ITEM_DELIVERY_STATUS_COLORS] || 'bg-slate-100 text-slate-500'} text-[10px]`}>
                                  {ITEM_DELIVERY_STATUS_LABELS[item.deliveryStatus as keyof typeof ITEM_DELIVERY_STATUS_LABELS] || item.deliveryStatus}
                                </Badge>
                              </td>
                              <td className="px-2 py-2">
                                {isEditing && editIndex >= 0 ? (
                                  <input
                                    type="text"
                                    className="w-full bg-yellow-50 border border-yellow-300 rounded px-1 py-0.5 text-[9px] text-center focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                    value={editItems[editIndex].supplier}
                                    onChange={e => handleFieldChange(editIndex, 'supplier', e.target.value)}
                                  />
                                ) : (
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    item.supplier === '삼성전자' ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-600'
                                  }`}>{item.supplier}</span>
                                )}
                              </td>
                              <td className="px-2 py-2 text-xs text-slate-600 font-mono truncate">{item.orderNumber || '-'}</td>
                              <td className="px-2 py-2 text-xs text-slate-600">{item.itemOrderDate || '-'}</td>
                              <td className="px-2 py-2 text-xs text-slate-600">{item.scheduledDeliveryDate || '-'}</td>
                              <td className="px-2 py-2 text-xs text-slate-600">{item.confirmedDeliveryDate || '-'}</td>
                              <td className="px-2 py-2 text-xs text-slate-800 truncate" style={barColor ? { borderLeft: `4px solid ${barColor}`, paddingLeft: '8px' } : undefined}>
                                {item.componentModel || '-'}
                              </td>
                              <td className="px-2 py-2 text-right text-xs tabular-nums text-slate-700">
                                {isEditing && editIndex >= 0 ? (
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    className="w-full max-w-[90px] bg-yellow-50 border border-yellow-300 rounded px-1 py-0.5 text-[10px] text-right focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                    value={formatNumericInput(editItems[editIndex].listPrice ?? getListPrice(editItems[editIndex]))}
                                    onChange={e => handleFieldChange(editIndex, 'listPrice', parseNumericInput(e.target.value))}
                                  />
                                ) : (
                                  displayListPrice > 0 ? displayListPrice.toLocaleString('ko-KR') : '-'
                                )}
                              </td>
                              <td className="px-2 py-2 text-center text-xs tabular-nums text-slate-600">
                                {isEditing && editIndex >= 0 ? (
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    className="w-full max-w-[56px] bg-yellow-50 border border-yellow-300 rounded px-1 py-0.5 text-[10px] text-center focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                    value={formatPercentInput(editItems[editIndex].discountRate ?? getDiscountRate(editItems[editIndex]))}
                                    onChange={e => handleFieldChange(
                                      editIndex,
                                      'discountRate',
                                      Math.min(Math.max(parseNumericInput(e.target.value) / 100, 0), 0.99)
                                    )}
                                  />
                                ) : (
                                  `${(displayDiscountRate * 100).toFixed(0)}%`
                                )}
                              </td>
                              <td className="px-2 py-2 text-right text-xs tabular-nums text-teal-600">
                                {isEditing && editIndex >= 0 ? (
                                  <input
                                    type="number"
                                    className="w-full max-w-[80px] bg-yellow-50 border border-yellow-300 rounded px-1 py-0.5 text-[10px] text-right focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                    value={editItems[editIndex].unitPrice}
                                    onChange={e => handleFieldChange(editIndex, 'unitPrice', Number(e.target.value) || 0)}
                                  />
                                ) : displayUnitPrice.toLocaleString('ko-KR')}
                              </td>
                              <td className="px-2 py-2 text-center text-xs text-slate-700 tabular-nums">
                                {isEditing && editIndex >= 0 ? (
                                  <input
                                    type="number"
                                    className="w-full max-w-[35px] bg-yellow-50 border border-yellow-300 rounded px-1 py-0.5 text-[10px] text-center focus:outline-none focus:ring-1 focus:ring-yellow-400"
                                    value={editItems[editIndex].quantity}
                                    onChange={e => handleFieldChange(editIndex, 'quantity', Number(e.target.value) || 1)}
                                  />
                                ) : item.quantity}
                              </td>
                              <td className="px-2 py-2 text-right text-xs tabular-nums text-teal-700 font-semibold">
                                {displayTotalPrice.toLocaleString('ko-KR')}
                              </td>
                              <td className="px-2 py-2 text-xs text-slate-600">{item.componentName || '-'}</td>
                              <td className="px-2 py-2 text-xs text-slate-700 truncate">{item.warehouseName || '미지정'}</td>
                              <td className="px-2 py-2 text-[11px] text-slate-500 truncate">{item.warehouseAddress || '-'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-teal-50 border-t-2 border-teal-200">
                          <td colSpan={12} className="px-3 py-2 text-right text-xs font-bold text-teal-800">매입 소계</td>
                          <td className="px-3 py-2 text-right text-xs font-bold text-teal-800 tabular-nums">{orderTotal.toLocaleString('ko-KR')}원</td>
                          <td colSpan={3}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
