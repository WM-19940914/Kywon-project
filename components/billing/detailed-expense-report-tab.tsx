/**
 * 지출결의서 탭
 *
 * 매월 말 정산 완료 후 "X월 지출결의서 생성하기" 버튼을 눌러 확정합니다.
 * - 생성 전: 버튼만 표시
 * - 생성 후: DB에 저장된 확정본 표시 (단가표/견적서 변경 영향 없음)
 * - 수정: 매입처, 금액, 장려금 등 편집 → 파생값 자동 계산 → DB 저장
 * - 재작성: 기존 데이터 삭제 후 현재 정산 데이터로 재생성
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import type { Order } from '@/types/order'
import type { ASRequest } from '@/types/as'
import {
  fetchASRequests,
  fetchPriceTable,
  fetchPurchaseReport,
  fetchExpenseReport,
  saveExpenseReport,
  updateExpenseReportWithItems,
} from '@/lib/supabase/dal'
import type { ExpenseReport, ExpenseReportItem } from '@/lib/supabase/dal'
import { FileText, Download, Plus, RefreshCw, CheckCircle2, Loader2, Pencil, Save, X, GripVertical, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportToExcel, buildExcelFileName } from '@/lib/excel-export'
import type { ExcelColumn } from '@/lib/excel-export'
import { toast } from 'sonner' // ✅ 예쁜 알림창 라이브러리 추가

interface DetailedExpenseReportTabProps {
  orders: Order[]
  calcAmounts: (order: Order) => {
    sales: number
    equipSubtotal: number
    installSubtotal: number
    subtotalWithProfit: number
    adjustedProfit: number
    samsungPurchase: number
    installCost: number
    margin: number
    hasSamsungData: boolean
  }
  selectedYear: number
  selectedMonth: number
}

/** 편집 가능 필드를 변경했을 때 파생값을 자동 재계산 */
function recalcDerived(item: ExpenseReportItem): ExpenseReportItem {
  const q = item.quantity || 1
  // DC율로 매입단가 재계산 (반출가 × (1 - DC율))
  const purchaseUnitPrice = item.listPrice > 0 && item.discountRate > 0
    ? Math.round(item.listPrice * (1 - item.discountRate))
    : item.purchaseUnitPrice
  const purchaseTotal = purchaseUnitPrice * q
  const salesTotal = item.salesUnitPrice * q
  const mgRate = salesTotal > 0 ? 1 - (purchaseUnitPrice / item.salesUnitPrice) : 0
  const frontUnit = item.salesUnitPrice - purchaseUnitPrice
  const frontTotal = frontUnit * q
  // 장려금 금액 = 매입금액 × 등급Reb% (아이템에 저장된 비율 사용)
  const gradeRebRate = item.incentiveGradeRebRate || 0
  const incentiveGrade = Math.round(purchaseTotal * gradeRebRate)
  const totalMargin = frontTotal + incentiveGrade + item.incentiveItemReb

  return {
    ...item,
    purchaseUnitPrice,
    purchaseTotalPrice: purchaseTotal,
    salesTotalPrice: salesTotal,
    mgRate,
    frontMarginUnit: frontUnit,
    frontMarginTotal: frontTotal,
    incentiveGradeReb: incentiveGrade,
    totalMargin,
  }
}

/** 합계 계산 */
function calcTotals(items: ExpenseReportItem[]) {
  return items.reduce(
    (acc, row) => ({
      totalPurchase: acc.totalPurchase + row.purchaseTotalPrice,
      totalSales: acc.totalSales + row.salesTotalPrice,
      totalFrontMargin: acc.totalFrontMargin + row.frontMarginTotal,
      totalIncentive: acc.totalIncentive + row.incentiveGradeReb,
      totalMargin: acc.totalMargin + row.totalMargin,
    }),
    { totalPurchase: 0, totalSales: 0, totalFrontMargin: 0, totalIncentive: 0, totalMargin: 0 }
  )
}

/**
 * 배송/매입내역과 지출결의서를 연결할 때 사용하는 기본 DC율
 *
 * 왜 필요한가:
 * - 매입내역에서 반출가(listPrice) 컬럼이 비어 있는 과거 데이터도 있을 수 있어,
 *   "매입단가를 반출가로 역산"할 때 공통 기준이 필요합니다.
 *
 * 수정 영향:
 * - 값을 바꾸면 "매입내역 값으로 지출결의서를 보정"할 때의 역산 기준이 달라집니다.
 * - 현재 업무 기준(45%)을 유지하기 위해 상수로 고정합니다.
 */
const DEFAULT_PURCHASE_DISCOUNT_RATE = 0.45

/** 매입내역 항목의 DC율을 안전하게 가져옵니다. */
function getSafePurchaseDiscountRate(discountRate?: number): number {
  // 0%는 유효한 업무 입력값이므로 허용합니다.
  // (기존에는 0을 미입력으로 오해해서 45%로 되돌아가는 문제가 있었습니다.)
  if (typeof discountRate === 'number' && Number.isFinite(discountRate) && discountRate >= 0 && discountRate < 1) {
    return discountRate
  }
  return DEFAULT_PURCHASE_DISCOUNT_RATE
}

/**
 * 매입내역 항목의 반출가를 안전하게 계산합니다.
 * 1) 저장된 반출가가 있으면 우선 사용
 * 2) 없으면 매입단가 / (1 - DC율) 역산
 */
function getSafePurchaseListPrice(item: { listPrice?: number; unitPrice: number; discountRate?: number }): number {
  if (typeof item.listPrice === 'number' && item.listPrice > 0) {
    return item.listPrice
  }
  const discountRate = getSafePurchaseDiscountRate(item.discountRate)
  if (!item.unitPrice || discountRate >= 1) return 0
  return Math.round(item.unitPrice / (1 - discountRate))
}

/**
 * 문자열 비교용 정규화
 * - 공백/대소문자 차이 때문에 "같은 구성품명인데 매칭 실패"가 나는 것을 줄이기 위해 사용합니다.
 * - 지출결의서 제안가 매핑의 안정성을 높이는 보조 함수입니다.
 */
function normalizeTextKey(value?: string): string {
  return (value || '').replace(/\s+/g, '').toLowerCase()
}

/**
 * 발주(Order)의 "현장 실질 장비 제안가 합계"를 계산합니다.
 *
 * 왜 이 값이 필요한가:
 * - 가격표 기반 제안가는 표준가라서, 월별 현장 협의가가 반영되지 않을 수 있습니다.
 * - 지출결의서는 월 정산 문서이므로, 실제 계약/견적에서 확정된 장비 제안가를 우선 반영하는 것이 실무에 맞습니다.
 *
 * 계산 기준:
 * - 소비자 견적(customerQuote) 항목 중 장비(equipment) 항목 totalPrice 합계
 * - 값이 없으면 0 반환(= 기존 가격표 로직 유지)
 *
 * 수정 시 영향:
 * - 이 함수의 기준을 바꾸면 "현장 실가격 우선 반영" 범위가 달라집니다.
 * - 현재는 장비 항목만 반영하며, 설치비 항목은 기존 계산 로직을 그대로 사용합니다.
 */
function getOrderEquipmentQuoteTotal(order: Order): number {
  const quoteItems = order.customerQuote?.items || []
  const equipmentItems = quoteItems.filter(item => item.category === 'equipment')
  const total = equipmentItems.reduce((sum, item) => sum + (Number(item.totalPrice) || 0), 0)
  return total > 0 ? total : 0
}

export function DetailedExpenseReportTab({
  orders,
  calcAmounts,
  selectedYear,
  selectedMonth
}: DetailedExpenseReportTabProps) {
  // ─── 상태 ───
  const [savedReport, setSavedReport] = useState<ExpenseReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showRewriteConfirm, setShowRewriteConfirm] = useState(false)

  // 수정 모드
  const [isEditing, setIsEditing] = useState(false)
  const [editItems, setEditItems] = useState<ExpenseReportItem[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // 드래그 앤 드롭 상태
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)

  // ─── 월 변경 시 저장된 지출결의서 조회 ───
  useEffect(() => {
    setIsLoading(true)
    setSavedReport(null)
    setIsEditing(false)
    fetchExpenseReport(selectedYear, selectedMonth).then(report => {
      setSavedReport(report)
      setIsLoading(false)
    })
  }, [selectedYear, selectedMonth])

  /**
   * 정산 데이터로 지출결의서 행을 계산하는 함수
   */
  const generateRows = useCallback(async (): Promise<ExpenseReportItem[]> => {
    const rows: ExpenseReportItem[] = []
    const [asData, ptData, purchaseReport] = await Promise.all([
      fetchASRequests(),
      fetchPriceTable(selectedYear),
      fetchPurchaseReport(selectedYear, selectedMonth),
    ])

    const setModelInfoMap: Record<string, { listPrice: number; price: number; componentCount: number; componentSaleTotal: number }> = {}
    // 구성품 모델코드(예: AP072BNPPBH1) -> 제안단가 매핑
    // 이유: setModel이 비어 있거나 가격표 SET 매칭이 실패해도 제안가를 살릴 수 있어야 하기 때문입니다.
    const componentSalePriceMap: Record<string, number> = {}
    // setModel + 구성품명(예: 실외기) -> 제안단가 매핑
    // 이유: 모델코드가 없는 과거 데이터에서도 구성품명을 기준으로 최대한 제안가를 찾기 위해 사용합니다.
    const setComponentSalePriceMap: Record<string, number> = {}
    ptData.forEach(row => {
      const componentSaleTotal = row.components.reduce((sum, comp) => {
        const salePrice = Number(comp.salePrice) || 0
        const quantity = Number(comp.quantity) || 1
        return sum + (salePrice * quantity)
      }, 0)

      setModelInfoMap[row.model] = {
        listPrice: row.listPrice,
        price: row.price,
        componentCount: row.components.length || 1,
        componentSaleTotal,
      }

      row.components.forEach(comp => {
        if (comp.model && comp.salePrice > 0) {
          componentSalePriceMap[comp.model] = comp.salePrice
        }
        if (row.model && comp.type && comp.salePrice > 0) {
          const setComponentKey = `${row.model}__${normalizeTextKey(comp.type)}`
          setComponentSalePriceMap[setComponentKey] = comp.salePrice
        }
      })
    })

    /*
      [배송/매입내역 ↔ 지출결의서 연결]
      같은 월의 배송/매입내역(확정본)이 존재하면,
      그 안에 저장된 수량/매입단가(및 반출가 표시용 값)를 지출결의서 생성에 우선 반영합니다.

      왜 필요한가:
      - 사용자가 배송/매입내역 탭에서 금액을 조정했는데,
        지출결의서 생성 시 다시 단가표 기본값으로 돌아가면 업무 흐름이 끊기기 때문입니다.

      주의:
      - 배송/매입내역이 없는 월은 기존 로직(단가표/발주 원본) 그대로 동작합니다.
      - 이미 확정 저장된 지출결의서는 자동 변경되지 않고, "재작성" 시 반영됩니다.
    */
    const purchaseItems = purchaseReport?.items || []

    const getOrderSetKey = (orderId: string, setModel: string) => `${orderId}__${setModel || '_manual'}`

    const purchaseItemsByOrder: Record<string, typeof purchaseItems> = {}
    const purchaseItemsByOrderSet: Record<string, typeof purchaseItems> = {}

    purchaseItems.forEach(item => {
      if (!purchaseItemsByOrder[item.orderId]) purchaseItemsByOrder[item.orderId] = []
      purchaseItemsByOrder[item.orderId].push(item)

      const setKey = getOrderSetKey(item.orderId, item.setModel || '')
      if (!purchaseItemsByOrderSet[setKey]) purchaseItemsByOrderSet[setKey] = []
      purchaseItemsByOrderSet[setKey].push(item)
    })

    /** 지출결의서 계열사 정렬 순서: 구몬 → Wells 영업 → Wells 서비스 → 교육플랫폼 → 기타 → AS */
    const AFFILIATE_SORT_ORDER: Record<string, number> = {
      '구몬': 0, 'Wells 영업': 1, 'Wells 서비스': 2, '교육플랫폼': 3, '기타': 4,
    }

    // 계열사 순서대로 발주 정렬
    const sortedOrders = [...orders].sort((a, b) => {
      const aOrder = AFFILIATE_SORT_ORDER[a.affiliate || '기타'] ?? 4
      const bOrder = AFFILIATE_SORT_ORDER[b.affiliate || '기타'] ?? 4
      return aOrder - bOrder
    })

    let sortOrder = 0

    sortedOrders.forEach(order => {
      const amounts = calcAmounts(order)
      const equipmentItems = order.equipmentItems || []
      const workTypes = Array.from(new Set(order.items.map(i => i.workType))).join(', ')
      // 이 발주의 "현장 실질 장비 제안가 합계" (없으면 0)
      const orderEquipmentQuoteTotal = getOrderEquipmentQuoteTotal(order)
      // 이 발주에서 생성된 "장비 행"의 인덱스를 모아둡니다.
      // 이유: 장비 행 생성이 끝난 뒤, 현장 실가격 비율로 일괄 보정하기 위함입니다.
      const equipmentRowIndexes: number[] = []
      // set 매칭 실패로 생성된 장비 행 인덱스
      // 이유:
      // - 사용자가 요청한 대로 "set 매칭 실패 행"은 정산관리 장비금액 기준으로 제안가를 맞추기 위해
      //   별도 집계가 필요합니다.
      const nonSetMatchedEquipmentRowIndexes: number[] = []
      // 보정 전 기준 제안가 합계(가격표/모델매칭 기준)
      let equipmentBaseSalesTotal = 0

      // 같은 발주의 배송/매입내역 항목 목록(매칭용)
      const orderPurchaseItems = purchaseItemsByOrder[order.id] || []
      // set 단위 집계에 사용한 항목을 표시해, 아래 개별 매칭에서 중복 사용하지 않도록 관리
      const usedPurchaseSortOrders = new Set<number>()

      if (equipmentItems.length > 0) {
        const setGroups: Record<string, typeof equipmentItems> = {}
        equipmentItems.forEach(item => {
          const key = item.setModel || '_manual'
          if (!setGroups[key]) setGroups[key] = []
          setGroups[key].push(item)
        })

        const setGroupKeys = Object.keys(setGroups).filter(k => k !== '_manual')
        const totalSetGroupCount = setGroupKeys.length

        Object.entries(setGroups).forEach(([setModel, items]) => {
          const ptInfo = setModelInfoMap[setModel]

          if (ptInfo && ptInfo.listPrice > 0) {
            let setQuantity: number
            if (totalSetGroupCount <= 1) {
              const orderItemQty = order.items
                .filter(i => i.workType === '신규설치')
                .reduce((sum, i) => sum + (i.quantity || 1), 0)
              setQuantity = orderItemQty > 0
                ? orderItemQty
                : Math.round(items.length / ptInfo.componentCount) || 1
            } else {
              setQuantity = Math.round(items.length / ptInfo.componentCount) || 1
            }

            /*
              가격표에 있는 모델이라도, 같은 월의 배송/매입내역 확정본이 있으면
              해당 값을 우선 반영합니다.
              (없으면 기존처럼 단가표 기본값 사용)
            */
            const orderSetKey = getOrderSetKey(order.id, setModel)
            const setPurchaseItems = purchaseItemsByOrderSet[orderSetKey] || []

            // 이 set의 매입내역 항목은 이후 개별 매칭에서 다시 쓰지 않도록 선사용 처리
            setPurchaseItems.forEach(pi => {
              if (typeof pi.sortOrder === 'number') usedPurchaseSortOrders.add(pi.sortOrder)
            })

            // set 수량도 매입내역 기준으로 보정 (수정된 수량 반영 목적)
            if (setPurchaseItems.length > 0 && ptInfo.componentCount > 0) {
              const totalComponentQty = setPurchaseItems.reduce((sum, pi) => sum + (pi.quantity || 0), 0)
              const inferredSetQty = Math.round(totalComponentQty / ptInfo.componentCount)
              if (inferredSetQty > 0) setQuantity = inferredSetQty
            }

            // 기본값(단가표 기준)
            let listPrice = ptInfo.listPrice
            let discountRate = 0.45
            let purchaseUnitPrice = Math.round(listPrice * (1 - discountRate))
            let purchaseTotalPrice = purchaseUnitPrice * setQuantity

            // 보정값(매입내역 기준)
            if (setPurchaseItems.length > 0 && setQuantity > 0) {
              const purchaseTotalFromReport = setPurchaseItems.reduce((sum, pi) => sum + ((pi.unitPrice || 0) * (pi.quantity || 0)), 0)
              const listTotalFromReport = setPurchaseItems.reduce((sum, pi) => sum + (getSafePurchaseListPrice(pi) * (pi.quantity || 0)), 0)

              if (purchaseTotalFromReport > 0) {
                purchaseUnitPrice = Math.round(purchaseTotalFromReport / setQuantity)
                purchaseTotalPrice = purchaseTotalFromReport
              }

              if (listTotalFromReport > 0) {
                listPrice = Math.round(listTotalFromReport / setQuantity)
              }

              if (listPrice > 0 && purchaseUnitPrice > 0) {
                const computedDiscountRate = 1 - (purchaseUnitPrice / listPrice)
                if (computedDiscountRate > 0 && computedDiscountRate < 1) {
                  discountRate = Number(computedDiscountRate.toFixed(4))
                }
              }
            }

            // 제안가(판매단가)는 기본적으로 SET 판매가를 쓰되,
            // 가격표에 SET 판매가가 비어 있는 경우 구성품 제안가 합계로 보정합니다.
            const salesUnitPrice = ptInfo.price > 0 ? ptInfo.price : ptInfo.componentSaleTotal
            const salesTotalPrice = salesUnitPrice * setQuantity
            const mgRate = salesUnitPrice > 0 ? 1 - (purchaseUnitPrice / salesUnitPrice) : 0
            const frontMarginUnit = salesUnitPrice - purchaseUnitPrice
            const frontMarginTotal = frontMarginUnit * setQuantity
            const incentiveGradeReb = Math.round(purchaseTotalPrice * 0.06)
            const totalMargin = frontMarginTotal + incentiveGradeReb

            rows.push({
              sortOrder: sortOrder++,
              businessName: order.businessName, affiliate: order.affiliate,
              supplier: '삼성전자', itemType: '신규설치 장비', specification: setModel,
              quantity: setQuantity, listPrice, discountRate, optionItem: '',
              purchaseUnitPrice, purchaseTotalPrice, mgRate,
              salesUnitPrice, salesTotalPrice,
              frontMarginUnit, frontMarginTotal,
              incentiveGradeRebRate: 0.06, incentiveGradeReb, incentiveItemReb: 0, totalMargin,
              sourceType: 'order', orderDate: order.orderDate,
            })
            // 장비 행 보정 대상 수집
            equipmentRowIndexes.push(rows.length - 1)
            equipmentBaseSalesTotal += salesTotalPrice
          } else {
            items.forEach(eqItem => {
              /*
                [규격(specification) 생성 우선순위 - 매우 중요]
                1) componentModel: 실제 구성품 모델명 (예: AP072BNPPBH1)
                2) setModel: 세트 모델명 (예: AP072BAPPBH2S)
                3) componentName: 실내기/실외기 같은 구성품 이름

                왜 이렇게 바꾸는가?
                - 가격표에 없는 모델은 기존 로직에서 componentName을 먼저 사용해서
                  지출결의서 규격 칸에 "실내기/실외기"가 들어갔습니다.
                - 정산 문서의 규격은 장비 "모델명" 식별이 핵심이라서,
                  모델명(componentModel 또는 setModel)을 최우선으로 사용해야
                  사후 검증/대사(비교 확인) 시 혼동이 줄어듭니다.

                수정 시 영향:
                - 가격표 미등록 모델의 신규 생성 행부터 규격 값이 모델명 기준으로 저장됩니다.
                - 이미 저장된 과거 지출결의서 데이터는 자동으로 바뀌지 않으므로,
                  과거 달도 변경하려면 해당 월 지출결의서를 "재작성"해야 반영됩니다.
              */
              const specificationValue =
                eqItem.componentModel || eqItem.setModel || eqItem.componentName || ''

              /*
                가격표 미등록 모델은 개별 구성품 행으로 생성됩니다.
                이때도 배송/매입내역 확정본이 있으면 매입단가/수량/반출가를 우선 사용해서
                "매입내역에서 조정한 값"이 지출결의서에 이어지도록 맞춥니다.
              */
              const matchedPurchaseIndex = orderPurchaseItems.findIndex(pi => {
                // 이미 set 집계에서 사용한 항목은 제외
                if (typeof pi.sortOrder === 'number' && usedPurchaseSortOrders.has(pi.sortOrder)) return false

                // 1순위: 구성품 모델명이 동일
                if (eqItem.componentModel && pi.componentModel) {
                  return eqItem.componentModel === pi.componentModel
                }
                // 2순위: setModel + 구성품명 조합 일치
                if (eqItem.setModel && pi.setModel && eqItem.componentName && pi.componentName) {
                  return eqItem.setModel === pi.setModel && eqItem.componentName === pi.componentName
                }
                // 3순위: 구성품명 일치(모델 없는 구데이터 대응)
                if (eqItem.componentName && pi.componentName) {
                  return eqItem.componentName === pi.componentName
                }
                return false
              })

              const matchedPurchaseItem = matchedPurchaseIndex >= 0
                ? orderPurchaseItems[matchedPurchaseIndex]
                : null

              if (matchedPurchaseItem && typeof matchedPurchaseItem.sortOrder === 'number') {
                usedPurchaseSortOrders.add(matchedPurchaseItem.sortOrder)
              }

              const quantity = matchedPurchaseItem?.quantity || eqItem.quantity || 1
              const purchaseUnitPrice = matchedPurchaseItem?.unitPrice || eqItem.unitPrice || 0
              const purchaseTotalPrice = purchaseUnitPrice * quantity
              const listPrice = matchedPurchaseItem ? getSafePurchaseListPrice(matchedPurchaseItem) : 0
              const discountRate = matchedPurchaseItem
                ? getSafePurchaseDiscountRate(matchedPurchaseItem.discountRate)
                : 0
              // 제안가 매핑 우선순위
              // 1) 구성품 모델코드 기준 매칭
              // 2) setModel + 구성품명 기준 매칭(모델코드가 없는 데이터 대응)
              // 3) 없으면 0(수동 수정 가능)
              const salesModelKey = eqItem.componentModel || matchedPurchaseItem?.componentModel || ''
              const salesByModel = salesModelKey ? (componentSalePriceMap[salesModelKey] || 0) : 0
              const salesSetComponentKey = `${eqItem.setModel || ''}__${normalizeTextKey(eqItem.componentName)}`
              const salesBySetComponent = (eqItem.setModel && eqItem.componentName)
                ? (setComponentSalePriceMap[salesSetComponentKey] || 0)
                : 0
              const salesUnitPrice = salesByModel > 0 ? salesByModel : salesBySetComponent
              const salesTotalPrice = salesUnitPrice * quantity
              const mgRate = salesUnitPrice > 0 ? 1 - (purchaseUnitPrice / salesUnitPrice) : 0
              // 제안가를 끝까지 못 찾은 항목은(= salesUnitPrice 0)
              // 기존 동작과 동일하게 마진 계산을 0으로 유지합니다.
              // 이유: "제안가 미매칭"만으로 전체 마진 합계가 음수로 틀어지는 것을 막기 위함입니다.
              const frontMarginUnit = salesUnitPrice > 0 ? (salesUnitPrice - purchaseUnitPrice) : 0
              const frontMarginTotal = salesUnitPrice > 0 ? (frontMarginUnit * quantity) : 0
              const totalMargin = frontMarginTotal

              rows.push({
                sortOrder: sortOrder++,
                businessName: order.businessName, affiliate: order.affiliate,
                supplier: '삼성전자', itemType: '신규설치 장비',
                specification: specificationValue,
                quantity, listPrice, discountRate, optionItem: '',
                purchaseUnitPrice, purchaseTotalPrice,
                mgRate, salesUnitPrice, salesTotalPrice,
                frontMarginUnit, frontMarginTotal,
                incentiveGradeRebRate: 0.06, incentiveGradeReb: 0, incentiveItemReb: 0, totalMargin,
                sourceType: 'order', orderDate: order.orderDate,
              })
              // 장비 행 보정 대상 수집
              equipmentRowIndexes.push(rows.length - 1)
              nonSetMatchedEquipmentRowIndexes.push(rows.length - 1)
              equipmentBaseSalesTotal += salesTotalPrice
            })
          }
        })
      }

      /*
        [현장 실질 제안가 우선 반영]
        - 소비자 견적의 장비 합계가 있는 경우,
          방금 만든 장비 행들의 제안가를 "비율 보정"해서 월별 현장 가격을 반영합니다.

        보정 방식:
        - 보정계수 = 현장장비합계 / (가격표·모델매칭 기반 장비합계)
        - 각 장비행 제안단가 = 기존 제안단가 × 보정계수 (반올림)
        - 파생값(제안금액, MG율, 마진, 인센티브)은 recalcDerived로 일괄 재계산

        왜 이렇게 하는가:
        - 개별 모델명을 소비자견적 항목과 1:1로 완벽 매칭하기 어려운 데이터가 있어,
          총액 기준 비율 보정이 가장 안정적으로 "현장 실가격"을 반영할 수 있습니다.
      */
      if (orderEquipmentQuoteTotal > 0 && equipmentBaseSalesTotal > 0 && equipmentRowIndexes.length > 0) {
        const scale = orderEquipmentQuoteTotal / equipmentBaseSalesTotal
        equipmentRowIndexes.forEach(rowIdx => {
          const current = rows[rowIdx]
          const scaledSalesUnitPrice = Math.max(0, Math.round((current.salesUnitPrice || 0) * scale))
          const scaledRow = {
            ...current,
            salesUnitPrice: scaledSalesUnitPrice,
          }
          rows[rowIdx] = recalcDerived(scaledRow)
        })
      }

      /*
        [요청사항 반영 - set 매칭 실패 행 제안가]
        set 매칭이 안 된 장비 행은 "정산관리 장비금액(equipSubtotal)"을 기준으로 제안가를 맞춥니다.

        적용 규칙:
        - 대상: nonSetMatchedEquipmentRowIndexes에 담긴 행만
        - 합계 기준: amounts.equipSubtotal
        - 배분 기준:
          1) 매입금액 비율(가능하면)
          2) 매입금액이 전부 0이면 수량 비율
        - 배분 후 각 행은 recalcDerived로 파생값(MG율/마진 등) 재계산
      */
      if (nonSetMatchedEquipmentRowIndexes.length > 0) {
        // 1순위: 정산관리 장비금액(equipSubtotal)
        // 2순위: 현장 소비자견적 장비합계(orderEquipmentQuoteTotal)
        // 3순위: set 미매칭 행 매입금액 합계
        // 4순위: 기존 가격표/매칭 기준 합계
        // 왜 이렇게 하냐면:
        // - 사용자가 원하는 기준은 equipSubtotal이지만,
        // - 데이터 누락으로 0이 들어오는 월도 있어서 그때 공란이 되지 않도록
        //   안전한 대체 기준을 순서대로 둡니다.
        const nonSetPurchaseTotal = nonSetMatchedEquipmentRowIndexes.reduce((sum, rowIdx) => {
          return sum + (Number(rows[rowIdx]?.purchaseTotalPrice) || 0)
        }, 0)
        const targetTotal =
          (amounts.equipSubtotal > 0 ? amounts.equipSubtotal : 0) ||
          (orderEquipmentQuoteTotal > 0 ? orderEquipmentQuoteTotal : 0) ||
          (nonSetPurchaseTotal > 0 ? nonSetPurchaseTotal : 0) ||
          (equipmentBaseSalesTotal > 0 ? equipmentBaseSalesTotal : 0)

        const weightedRows = nonSetMatchedEquipmentRowIndexes.map((rowIdx) => {
          const row = rows[rowIdx]
          const purchaseTotal = Number(row.purchaseTotalPrice) || 0
          const quantity = Number(row.quantity) || 1
          return {
            rowIdx,
            // 매입금액이 있으면 그 값을 우선 가중치로 사용
            // 없으면 수량을 가중치로 사용
            weight: purchaseTotal > 0 ? purchaseTotal : quantity,
            quantity,
          }
        })

        const weightSum = weightedRows.reduce((sum, r) => sum + r.weight, 0)
        if (targetTotal > 0 && weightSum > 0) {
          weightedRows.forEach((r, index) => {
            const isLast = index === weightedRows.length - 1
            const prevAllocated = weightedRows
              .slice(0, index)
              .reduce((sum, p) => sum + (rows[p.rowIdx].salesTotalPrice || 0), 0)

            // 마지막 행은 잔액으로 맞춰서 합계 오차를 줄입니다.
            const desiredSalesTotal = isLast
              ? Math.max(0, targetTotal - prevAllocated)
              : Math.max(0, Math.round(targetTotal * (r.weight / weightSum)))

            const desiredSalesUnit = Math.max(0, Math.round(desiredSalesTotal / r.quantity))
            const nextRow = {
              ...rows[r.rowIdx],
              salesUnitPrice: desiredSalesUnit,
            }
            rows[r.rowIdx] = recalcDerived(nextRow)
          })
        }
      }

      if (amounts.installCost > 0) {
        const purchaseTotalPrice = amounts.installCost
        const salesTotalPrice = amounts.subtotalWithProfit - amounts.equipSubtotal
        const frontMarginTotal = salesTotalPrice - purchaseTotalPrice
        const mgRate = salesTotalPrice > 0 ? 1 - (purchaseTotalPrice / salesTotalPrice) : 0

        rows.push({
          sortOrder: sortOrder++,
          businessName: order.businessName, affiliate: order.affiliate,
          supplier: '에스원이엔지', itemType: '설치비',
          specification: workTypes || '신규설치 외', quantity: 1,
          listPrice: purchaseTotalPrice, discountRate: 0, optionItem: '',
          purchaseUnitPrice: purchaseTotalPrice, purchaseTotalPrice,
          mgRate, salesUnitPrice: salesTotalPrice, salesTotalPrice,
          frontMarginUnit: frontMarginTotal, frontMarginTotal,
          incentiveGradeRebRate: 0, incentiveGradeReb: 0, incentiveItemReb: 0, totalMargin: frontMarginTotal,
          sourceType: 'order', orderDate: order.orderDate,
        })
      }
    })

    const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
    // 정산대기(completed) + 정산완료(settled) 모두 포함
    const filteredAS = asData.filter(
      (as: ASRequest) => (as.status === 'completed' || as.status === 'settled') && as.settlementMonth === monthKey
    )
    const asGrouped: Record<string, { asCost: number; totalAmount: number; count: number }> = {}
    filteredAS.forEach((as: ASRequest) => {
      const key = as.affiliate || '기타'
      if (!asGrouped[key]) asGrouped[key] = { asCost: 0, totalAmount: 0, count: 0 }
      asGrouped[key].asCost += as.asCost || 0
      asGrouped[key].totalAmount += as.totalAmount || 0
      asGrouped[key].count += 1
    })

    // AS도 계열사 순서대로 정렬
    const asEntries = Object.entries(asGrouped).sort(([a], [b]) => {
      const aOrder = AFFILIATE_SORT_ORDER[a] ?? 4
      const bOrder = AFFILIATE_SORT_ORDER[b] ?? 4
      return aOrder - bOrder
    })
    asEntries.forEach(([affiliate, data]) => {
      if (data.count === 0) return
      const purchaseTotalPrice = data.asCost
      const salesTotalPrice = Math.floor(data.totalAmount / 1000) * 1000
      const frontMarginTotal = salesTotalPrice - purchaseTotalPrice
      const mgRate = salesTotalPrice > 0 ? 1 - (purchaseTotalPrice / salesTotalPrice) : 0

      rows.push({
        sortOrder: sortOrder++,
        businessName: `${affiliate} A/S`, affiliate,
        supplier: '멜레아', itemType: 'AS비용', specification: 'AS비용', quantity: 1,
        listPrice: purchaseTotalPrice, discountRate: 0, optionItem: '',
        purchaseUnitPrice: purchaseTotalPrice, purchaseTotalPrice,
        mgRate, salesUnitPrice: salesTotalPrice, salesTotalPrice,
        frontMarginUnit: frontMarginTotal, frontMarginTotal,
        incentiveGradeRebRate: 0, incentiveGradeReb: 0, incentiveItemReb: 0, totalMargin: frontMarginTotal,
        sourceType: 'as',
      })
    })

    return rows
  }, [orders, calcAmounts, selectedYear, selectedMonth])

  /** 지출결의서 생성 */
  const handleGenerate = async () => {
    setShowConfirm(false)
    setShowRewriteConfirm(false)
    setIsGenerating(true)
    try {
      const rows = await generateRows()
      const totals = calcTotals(rows)
      const success = await saveExpenseReport(selectedYear, selectedMonth, rows, totals)
      if (success) {
        const report = await fetchExpenseReport(selectedYear, selectedMonth)
        setSavedReport(report)
        toast.success(`${selectedMonth}월 지출결의서가 생성되었습니다.`)
      } else {
        toast.error('지출결의서 저장에 실패했습니다.')
      }
    } catch (err) {
      console.error('지출결의서 생성 실패:', err)
      toast.error('지출결의서 생성 중 오류가 발생했습니다.')
    } finally {
      setIsGenerating(false)
    }
  }

  /** 수정 모드 진입 */
  const handleStartEdit = () => {
    if (!savedReport) return
    setEditItems(savedReport.items.map(item => ({ ...item })))
    setIsEditing(true)
    toast.info('엑셀 편집 모드가 활성화되었습니다.')
  }

  /** 수정 취소 */
  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditItems([])
    toast.message('편집이 취소되었습니다.')
  }

  /** 편집 필드 변경 → 파생값 자동 재계산 */
  const handleFieldChange = (index: number, field: string, value: string | number) => {
    setEditItems(prev => {
      const next = [...prev]
      const item = { ...next[index], [field]: value }
      next[index] = recalcDerived(item)
      return next
    })
  }

  /** 새로운 행 추가 (엑셀처럼 한 줄 추가) */
  const handleAddRow = () => {
    const newRow: ExpenseReportItem = {
      sortOrder: editItems.length,
      businessName: '',
      affiliate: '기타',
      supplier: '삼성전자',
      itemType: '신규설치 장비',
      specification: '',
      quantity: 1,
      listPrice: 0,
      discountRate: 0,
      optionItem: '',
      purchaseUnitPrice: 0,
      purchaseTotalPrice: 0,
      mgRate: 0,
      salesUnitPrice: 0,
      salesTotalPrice: 0,
      frontMarginUnit: 0,
      frontMarginTotal: 0,
      incentiveGradeRebRate: 0,
      incentiveGradeReb: 0,
      incentiveItemReb: 0,
      totalMargin: 0,
      sourceType: 'manual',
    }
    setEditItems([...editItems, newRow])
    toast.success('새로운 행이 추가되었습니다.', { icon: <Plus className="h-4 w-4" /> })
  }

  /** 특정 행 삭제 */
  const handleDeleteRow = (index: number) => {
    // 삭제 전 데이터를 보관하여 '되돌리기' 기능을 제공합니다.
    const originalItems = [...editItems]
    
    setEditItems(prev => prev.filter((_, i) => i !== index))
    
    toast('행을 삭제했습니다.', {
      action: {
        label: '되돌리기',
        onClick: () => setEditItems(originalItems)
      },
      icon: <Trash2 className="h-4 w-4 text-red-500" />
    })
  }

  /** 행 이동 (드래그 앤 드롭 - 실시간 위치 변경 방식) */
  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault() // 드롭 가능하게 함
  }

  // 마우스가 다른 행 위로 진입했을 때 실시간으로 순서를 바꿈
  const handleDragEnter = (targetIdx: number) => {
    if (draggedIdx === null || draggedIdx === targetIdx) return

    setEditItems(prev => {
      const next = [...prev]
      const [draggedItem] = next.splice(draggedIdx, 1)
      next.splice(targetIdx, 0, draggedItem)
      return next
    })
    
    // 현재 드래그 중인 인덱스를 타겟 인덱스로 업데이트하여 실시간 추적
    setDraggedIdx(targetIdx)
  }

  const handleDragEnd = () => {
    setDraggedIdx(null)
  }

  /** 수정 저장 */
  const handleSaveEdit = async () => {
    if (!savedReport) return
    setIsSaving(true)
    try {
      const totals = calcTotals(editItems)
      // 마감 상태 기능이 삭제되었으므로 항상 false 또는 기존 값을 무시하고 저장
      const success = await updateExpenseReportWithItems(savedReport.id, editItems, totals, false)
      if (success) {
        const report = await fetchExpenseReport(selectedYear, selectedMonth)
        setSavedReport(report)
        setIsEditing(false)
        setEditItems([])
        toast.success('변경사항이 성공적으로 저장되었습니다.')
      } else {
        toast.error('저장에 실패했습니다.')
      }
    } catch (err) {
      console.error('수정 저장 실패:', err)
      toast.error('저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  /** 엑셀 다운로드 — 지출결의서 전체 항목 */
  const handleExportExcel = () => {
    const columns: ExcelColumn<ExpenseReportItem>[] = [
      { header: '사업자명', getValue: r => r.businessName, width: 18 },
      { header: '계열사', getValue: r => r.affiliate || '', width: 12 },
      { header: '매입처', getValue: r => r.supplier, width: 12 },
      { header: '품목', getValue: r => r.itemType, width: 12 },
      { header: '규격', getValue: r => r.specification, width: 18 },
      { header: '수량', getValue: r => r.quantity, width: 6 },
      { header: '반출가', getValue: r => r.listPrice, width: 12, numberFormat: '#,##0' },
      { header: 'DC율', getValue: r => r.discountRate > 0 ? Math.round(r.discountRate * 100) : 0, width: 7 },
      { header: '매입단가', getValue: r => r.purchaseUnitPrice, width: 12, numberFormat: '#,##0' },
      { header: '매입금액', getValue: r => r.purchaseTotalPrice, width: 12, numberFormat: '#,##0' },
      { header: 'MG율', getValue: r => parseFloat((r.mgRate * 100).toFixed(2)), width: 8 },
      { header: '제안단가', getValue: r => r.salesUnitPrice, width: 12, numberFormat: '#,##0' },
      { header: '제안금액', getValue: r => r.salesTotalPrice, width: 12, numberFormat: '#,##0' },
      { header: '프론트이윤', getValue: r => r.frontMarginTotal, width: 12, numberFormat: '#,##0' },
      { header: '장려금', getValue: r => r.incentiveGradeReb, width: 10, numberFormat: '#,##0' },
      { header: '전체이윤', getValue: r => r.totalMargin, width: 12, numberFormat: '#,##0' },
    ]
    const monthLabel = `${selectedYear}년${selectedMonth}월`
    exportToExcel({
      data: displayItems,
      columns,
      fileName: buildExcelFileName('멜레아정산_지출결의서', monthLabel),
      sheetName: '지출결의서',
    })
  }

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
          {selectedYear}년 {selectedMonth}월 지출결의서 생성 중...
        </p>
        <p className="text-sm text-slate-500 mt-2">정산 데이터를 분석하고 있습니다.</p>
      </div>
    )
  }

  if (showConfirm) {
    return (
      <div className="bg-white rounded-xl border-2 border-carrot-300 shadow-lg p-8 text-center max-w-lg mx-auto">
        <FileText className="h-12 w-12 mx-auto mb-4 text-carrot-500" />
        <h3 className="text-lg font-bold text-slate-900 mb-2">
          {selectedYear}년 {selectedMonth}월 지출결의서 생성
        </h3>
        <p className="text-sm text-slate-600 mb-6">
          현재 정산 데이터를 기반으로 지출결의서를 작성합니다.<br />
          생성 후에는 단가표/견적서 변경에 영향받지 않습니다.
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
          {selectedYear}년 {selectedMonth}월 지출결의서 재작성
        </h3>
        <p className="text-sm text-slate-600 mb-2">기존 지출결의서를 삭제하고 현재 정산 데이터로 다시 작성합니다.</p>
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
          <FileText className="h-16 w-16 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-400 text-sm mb-6">아직 이 달의 지출결의서가 작성되지 않았습니다.</p>
          <Button
            size="lg"
            className="bg-carrot-500 hover:bg-carrot-600 text-white gap-2 px-8 py-6 text-base"
            onClick={() => setShowConfirm(true)}
          >
            <Plus className="h-5 w-5" />
            {selectedYear}년 {selectedMonth}월 지출결의서 생성하기
          </Button>
          <p className="text-xs text-slate-400 mt-4">정산 관리의 데이터를 기반으로 자동 작성됩니다.</p>
        </div>
      </div>
    )
  }

  // ─── 확정본 표시 ───
  const displayItems = isEditing ? editItems : savedReport.items

  const totals = isEditing ? calcTotals(editItems) : {
    totalPurchase: savedReport.totalPurchase,
    totalSales: savedReport.totalSales,
    totalFrontMargin: savedReport.totalFrontMargin,
    totalIncentive: savedReport.totalIncentive,
    totalMargin: savedReport.totalMargin,
  }
  const avgMgRate = totals.totalPurchase > 0 ? totals.totalFrontMargin / totals.totalPurchase : 0

  /** 숫자 입력 셀 (수정모드) */
  const numInput = (idx: number, field: string, val: number, w = '70px') => (
    <input
      type="number"
      className="w-full bg-yellow-50 border border-yellow-300 rounded px-1 py-0.5 text-[10px] text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-yellow-400"
      style={{ maxWidth: w }}
      value={val}
      onChange={e => handleFieldChange(idx, field, Number(e.target.value) || 0)}
    />
  )

  /** 텍스트 입력 셀 (수정모드) */
  const textInput = (idx: number, field: string, val: string, align: 'left' | 'center' = 'left') => (
    <input
      type="text"
      className={`w-full bg-yellow-50 border border-yellow-300 rounded px-1 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-yellow-400 ${align === 'center' ? 'text-center' : 'text-left'}`}
      value={val || ''}
      onChange={e => handleFieldChange(idx, field, e.target.value)}
    />
  )

  return (
    <div className="space-y-4">
      {/* 상단 액션 바 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          {isEditing ? (
            <div className="flex items-center gap-1.5 text-yellow-700 bg-yellow-50 px-3 py-1.5 rounded-lg border border-yellow-300">
              <Pencil className="h-4 w-4" />
              <span className="text-xs font-semibold">수정 중 (엑셀 편집 모드)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-olive-600 bg-olive-50 px-3 py-1.5 rounded-lg border border-olive-200">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-semibold">확정됨</span>
            </div>
          )}
          <p className="text-sm text-slate-500">
            {displayItems.length}개 항목 · {new Date(savedReport.createdAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 작성
          </p>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button size="sm" variant="outline" className="gap-1.5 bg-white text-blue-600 border-blue-200 hover:bg-blue-50" onClick={handleAddRow}>
                <Plus className="h-3.5 w-3.5" />행 추가
              </Button>
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
              {/* 
                지출결의서 탭은 "지출결의서 확정/수정/다운로드"에 집중된 화면이라서
                사용자 요청에 따라 "배송/매입 내역" 엑셀 버튼은 여기서 노출하지 않습니다.
                이 버튼을 다시 추가하면 내부정산 화면에서 기능 목적이 섞여 사용자가 혼란을 느낄 수 있으므로,
                관련 내역 엑셀은 배송/매입 전용 화면에서만 제공하는 정책을 유지합니다.
              */}
              <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1.5">
                <Download className="h-3.5 w-3.5" />지출결의서
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 데스크톱 테이블 (마감 상태여도 편집 기능 모두 유지) */}
      <div className="hidden lg:block bg-white rounded-xl border-2 border-slate-300 shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: '1900px' }}>
            <thead>
              {/* 1행 헤더 */}
              <tr className="bg-slate-100">
                {isEditing && <th className="border border-slate-300 px-1 py-2 text-[10px] font-bold text-slate-700 text-center" style={{ width: '40px' }}>이동</th>}
                {isEditing && <th className="border border-slate-300 px-1 py-2 text-[10px] font-bold text-slate-700 text-center" style={{ width: '40px' }}>삭제</th>}
                <th className="border border-slate-300 px-2 py-2 text-[10px] font-bold text-slate-700 text-left" style={{ width: '130px' }}>사업자명</th>
                <th className="border border-slate-300 px-2 py-2 text-[10px] font-bold text-slate-700 text-center" style={{ width: '85px' }}>계열사</th>
                <th className="border border-slate-300 px-2 py-2 text-[10px] font-bold text-slate-700 text-center" style={{ width: '85px' }}>매입처</th>
                <th className="border border-slate-300 px-2 py-2 text-[10px] font-bold text-slate-700 text-center" style={{ width: '85px' }}>품목</th>
                <th className="border border-slate-300 px-2 py-2 text-[10px] font-bold text-slate-700 text-left" style={{ width: '130px' }}>규격</th>
                <th className="border border-slate-300 px-1 py-2 text-[10px] font-bold text-slate-700 text-center" style={{ width: '40px' }}>수량</th>
                <th className="border border-slate-300 px-2 py-2 text-[10px] font-bold text-slate-700 text-right" style={{ width: '85px' }}>반출가</th>
                <th className="border border-slate-300 px-1 py-2 text-[10px] font-bold text-slate-700 text-center" style={{ width: '45px' }}>DC율</th>
                <th className="border border-slate-300 px-1 py-2 text-[10px] font-bold text-slate-700 text-center" style={{ width: '35px' }}>옵션</th>
                <th colSpan={2} className="border border-slate-300 px-2 py-2 text-[10px] font-bold text-slate-700 text-center bg-slate-50">매입가</th>
                <th className="border border-slate-300 px-1 py-2 text-[10px] font-bold text-slate-700 text-center" style={{ width: '55px' }}>MG율</th>
                <th colSpan={2} className="border border-slate-300 px-2 py-2 text-[10px] font-bold text-slate-700 text-center bg-teal-50">제안가</th>
                <th colSpan={2} className="border border-slate-300 px-2 py-2 text-[10px] font-bold text-slate-700 text-center bg-teal-50">프론트 이윤</th>
                <th colSpan={3} className="border border-slate-300 px-2 py-2 text-[10px] font-bold text-slate-700 text-center bg-brick-50">장려금 이윤</th>
                <th className="border border-slate-300 px-2 py-2 text-[10px] font-bold text-slate-700 text-center bg-brick-100" style={{ width: '90px' }}>전체 이윤</th>
              </tr>
              {/* 2행 서브헤더 */}
              <tr className="bg-slate-50">
                {isEditing && <th className="border border-slate-300"></th>}
                {isEditing && <th className="border border-slate-300"></th>}
                <th colSpan={9} className="border border-slate-300"></th>
                <th className="border border-slate-300 px-1 py-1 text-[9px] text-slate-500" style={{ width: '80px' }}>단가</th>
                <th className="border border-slate-300 px-1 py-1 text-[9px] text-slate-500" style={{ width: '90px' }}>금액</th>
                <th className="border border-slate-300"></th>
                <th className="border border-slate-300 px-1 py-1 text-[9px] text-slate-500" style={{ width: '80px' }}>단가</th>
                <th className="border border-slate-300 px-1 py-1 text-[9px] text-slate-500" style={{ width: '90px' }}>금액</th>
                <th className="border border-slate-300 px-1 py-1 text-[9px] text-slate-500" style={{ width: '80px' }}>단가</th>
                <th className="border border-slate-300 px-1 py-1 text-[9px] text-slate-500" style={{ width: '90px' }}>금액</th>
                <th className="border border-slate-300 px-1 py-1 text-[9px] text-brick-500" style={{ width: '50px' }}>등급Reb</th>
                <th className="border border-slate-300 px-1 py-1 text-[9px] text-brick-500" style={{ width: '45px' }}>품목Reb</th>
                <th className="border border-slate-300 px-1 py-1 text-[9px] text-brick-500" style={{ width: '85px' }}>금액</th>
                <th className="border border-slate-300"></th>
              </tr>
            </thead>

            <tbody>
              {displayItems.map((row, idx) => (
                <tr 
                  key={row.id || idx} 
                  className={`transition-all duration-200 ${
                    isEditing ? 'bg-yellow-50/10' : 'hover:bg-teal-50/30'
                  } ${
                    draggedIdx === idx 
                      ? 'bg-blue-50/80 border-2 border-blue-400 shadow-xl opacity-60 scale-[0.99] z-50' 
                      : ''
                  }`}
                  onDragOver={isEditing ? handleDragOver : undefined}
                  onDragEnter={isEditing ? () => handleDragEnter(idx) : undefined}
                  onDragEnd={isEditing ? handleDragEnd : undefined}
                >
                  {/* 드래그 핸들 (수정 모드에서만 표시) */}
                  {isEditing && (
                    <td 
                      className="border border-slate-200 px-1 py-1 text-center cursor-grab active:cursor-grabbing hover:bg-blue-100/50 group"
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                    >
                      <div className="flex justify-center text-slate-400 group-hover:text-blue-500 transition-colors">
                        <GripVertical className="h-4 w-4" />
                      </div>
                    </td>
                  )}
                  {/* 삭제 버튼 (수정 모드에서만 표시) */}
                  {isEditing && (
                    <td className="border border-slate-200 px-1 py-1 text-center">
                      <button 
                        onClick={() => handleDeleteRow(idx)}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="행 삭제"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                  {/* 사업자명 */}
                  <td className="border border-slate-200 px-2 py-1.5 text-[10px]">
                    {isEditing ? (
                      textInput(idx, 'businessName', row.businessName)
                    ) : (
                      <div className="font-semibold truncate">{row.businessName}</div>
                    )}
                  </td>
                  {/* 계열사 */}
                  <td className="border border-slate-200 px-1 py-1 text-[10px] text-center">
                    {isEditing ? (
                      <select
                        className="w-full bg-yellow-50 border border-yellow-300 rounded px-1 py-0.5 text-[9px] focus:outline-none focus:ring-1 focus:ring-yellow-400"
                        value={row.affiliate}
                        onChange={e => handleFieldChange(idx, 'affiliate', e.target.value)}
                      >
                        {['구몬', 'Wells 영업', 'Wells 서비스', '교육플랫폼', '기타'].map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-500">{row.affiliate}</span>
                    )}
                  </td>
                  {/* 매입처 */}
                  <td className="border border-slate-200 px-1 py-1 text-[10px] text-center">
                    {isEditing ? (
                      textInput(idx, 'supplier', row.supplier, 'center')
                    ) : (
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                        row.supplier === '삼성전자' ? 'bg-teal-100 text-teal-700'
                        : row.supplier === '에스원이엔지' ? 'bg-teal-100 text-teal-700'
                        : 'bg-carrot-100 text-carrot-700'
                      }`}>{row.supplier}</span>
                    )}
                  </td>
                  {/* 품목 */}
                  <td className="border border-slate-200 px-1 py-1 text-[10px] text-center">
                    {isEditing ? (
                      textInput(idx, 'itemType', row.itemType, 'center')
                    ) : (
                      row.itemType
                    )}
                  </td>
                  {/* 규격 */}
                  <td className="border border-slate-200 px-2 py-1.5 text-[10px] truncate">
                    {isEditing ? (
                      textInput(idx, 'specification', row.specification)
                    ) : (
                      row.specification
                    )}
                  </td>
                  {/* 수량 */}
                  <td className="border border-slate-200 px-1 py-1 text-[10px] text-center tabular-nums">
                    {isEditing
                      ? <input type="number" className="w-full max-w-[35px] bg-yellow-50 border border-yellow-300 rounded px-1 py-0.5 text-[10px] text-center focus:outline-none" value={row.quantity} onChange={e => handleFieldChange(idx, 'quantity', Number(e.target.value) || 1)} />
                      : row.quantity}
                  </td>
                  {/* 반출가 */}
                  <td className="border border-slate-200 px-2 py-1 text-[10px] text-right tabular-nums">
                    {isEditing
                      ? numInput(idx, 'listPrice', row.listPrice, '80px')
                      : row.listPrice > 0 ? row.listPrice.toLocaleString('ko-KR') : ''}
                  </td>
                  {/* DC율 */}
                  <td className="border border-slate-200 px-1 py-1 text-[10px] text-center tabular-nums">
                    {isEditing ? (
                      <input
                        type="number"
                        className="w-full max-w-[40px] bg-yellow-50 border border-yellow-300 rounded px-1 py-0.5 text-[10px] text-center focus:outline-none focus:ring-1 focus:ring-yellow-400"
                        value={Math.round((row.discountRate || 0) * 100)}
                        onChange={e => handleFieldChange(idx, 'discountRate', (Number(e.target.value) || 0) / 100)}
                      />
                    ) : (
                      row.discountRate > 0 ? `${(row.discountRate * 100).toFixed(0)}%` : row.supplier === '삼성전자' ? '0%' : ''
                    )}
                  </td>
                  {/* 옵션 */}
                  <td className="border border-slate-200 px-1 py-1 text-[10px] text-center text-slate-400">
                    {isEditing ? textInput(idx, 'optionItem', row.optionItem || '', 'center') : (row.optionItem || '')}
                  </td>
                  {/* 매입 단가 */}
                  <td className="border border-slate-200 px-2 py-1 text-[10px] text-right tabular-nums text-slate-600">
                    {isEditing
                      ? numInput(idx, 'purchaseUnitPrice', row.purchaseUnitPrice, '75px')
                      : row.purchaseUnitPrice > 0 ? row.purchaseUnitPrice.toLocaleString('ko-KR') : ''}
                  </td>
                  {/* 매입 금액 */}
                  <td className="border border-slate-200 px-2 py-1.5 text-[10px] text-right tabular-nums font-semibold">
                    {row.purchaseTotalPrice.toLocaleString('ko-KR')}
                  </td>
                  {/* MG율 */}
                  <td className="border border-slate-200 px-1 py-1.5 text-[10px] text-center tabular-nums text-slate-500">
                    {(row.mgRate * 100).toFixed(2)}%
                  </td>
                  {/* 제안 단가 */}
                  <td className="border border-slate-200 px-2 py-1 text-[10px] text-right tabular-nums text-slate-600">
                    {isEditing
                      ? numInput(idx, 'salesUnitPrice', row.salesUnitPrice, '75px')
                      : row.salesUnitPrice > 0 ? row.salesUnitPrice.toLocaleString('ko-KR') : ''}
                  </td>
                  {/* 제안 금액 */}
                  <td className="border border-slate-200 px-2 py-1.5 text-[10px] text-right tabular-nums text-slate-900 font-semibold">
                    {row.salesTotalPrice.toLocaleString('ko-KR')}
                  </td>
                  {/* 프론트 단가 */}
                  <td className="border border-slate-200 px-2 py-1.5 text-[10px] text-right tabular-nums text-teal-600">
                    {row.frontMarginUnit !== 0 ? row.frontMarginUnit.toLocaleString('ko-KR') : ''}
                  </td>
                  {/* 프론트 금액 */}
                  <td className="border border-slate-200 px-2 py-1.5 text-[10px] text-right tabular-nums text-teal-700 font-semibold">
                    {row.frontMarginTotal.toLocaleString('ko-KR')}
                  </td>
                  {/* 장려금 등급Reb (비율) */}
                  <td className="border border-slate-200 px-1 py-1 text-[10px] text-center tabular-nums text-brick-500">
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.1"
                        className="w-full max-w-[42px] bg-yellow-50 border border-yellow-300 rounded px-1 py-0.5 text-[10px] text-center focus:outline-none focus:ring-1 focus:ring-yellow-400"
                        value={parseFloat(((row.incentiveGradeRebRate || 0) * 100).toFixed(1))}
                        onChange={e => handleFieldChange(idx, 'incentiveGradeRebRate', (Number(e.target.value) || 0) / 100)}
                      />
                    ) : (
                      `${((row.incentiveGradeRebRate || 0) * 100).toFixed(1)}%`
                    )}
                  </td>
                  {/* 장려금 품목Reb */}
                  <td className="border border-slate-200 px-1 py-1 text-[10px] text-center tabular-nums text-brick-400">
                    {isEditing ? (
                      <input
                        type="number"
                        className="w-full max-w-[60px] bg-yellow-50 border border-yellow-300 rounded px-1 py-0.5 text-[10px] text-right focus:outline-none focus:ring-1 focus:ring-yellow-400"
                        value={row.incentiveItemReb || 0}
                        onChange={e => handleFieldChange(idx, 'incentiveItemReb', Number(e.target.value) || 0)}
                      />
                    ) : (
                      row.incentiveItemReb > 0 ? row.incentiveItemReb.toLocaleString('ko-KR') : '0'
                    )}
                  </td>
                  {/* 장려금 금액 */}
                  <td className="border border-slate-200 px-2 py-1.5 text-[10px] text-right tabular-nums text-brick-600 font-semibold">
                    {row.incentiveGradeReb > 0 ? row.incentiveGradeReb.toLocaleString('ko-KR') : '0'}
                  </td>
                  {/* 전체 이윤 */}
                  <td className="border border-slate-200 px-2 py-1.5 text-[10px] text-right tabular-nums text-brick-700 font-bold">
                    {row.totalMargin.toLocaleString('ko-KR')}
                  </td>
                </tr>
              ))}

              {/* 수정 모드일 때 테이블 내부에 행 추가 버튼 한 번 더 배치 */}
              {isEditing && (
                <tr className="bg-blue-50/30">
                  <td colSpan={22} className="border border-slate-200 p-2 text-center">
                    <button 
                      onClick={handleAddRow}
                      className="inline-flex items-center gap-2 text-sm text-blue-600 font-semibold hover:text-blue-800 transition-colors"
                    >
                      <Plus className="h-4 w-4" />여기에 새로운 행 추가 (엑셀 줄 추가)
                    </button>
                  </td>
                </tr>
              )}
            </tbody>

            <tfoot>
              {/* 합계 행 */}
              <tr className="bg-slate-700 text-white">
                {isEditing && <td className="border border-slate-600"></td>}
                {isEditing && <td className="border border-slate-600"></td>}
                <td colSpan={9} className="border border-slate-600 px-3 py-2 text-xs font-bold">합계</td>
                <td colSpan={2} className="border border-slate-600 px-2 py-2 text-xs text-right tabular-nums font-bold">
                  {totals.totalPurchase.toLocaleString('ko-KR')}
                </td>
                <td className="border border-slate-600 px-1 py-2 text-xs text-center tabular-nums font-bold">
                  {(avgMgRate * 100).toFixed(2)}%
                </td>
                <td colSpan={2} className="border border-slate-600 px-2 py-2 text-xs text-right tabular-nums font-bold">
                  {totals.totalSales.toLocaleString('ko-KR')}
                </td>
                <td colSpan={2} className="border border-slate-600 px-2 py-2 text-xs text-right tabular-nums font-bold">
                  {totals.totalFrontMargin.toLocaleString('ko-KR')}
                </td>
                <td colSpan={3} className="border border-slate-600 px-2 py-2 text-xs text-right tabular-nums font-bold text-carrot-300">
                  {totals.totalIncentive.toLocaleString('ko-KR')}
                </td>
                <td className="border border-slate-600 px-2 py-2 text-xs text-right tabular-nums font-bold text-olive-300">
                  {totals.totalMargin.toLocaleString('ko-KR')}
                </td>
              </tr>
              {/* VAT 포함 — 제안가 합계 아래에 표시 */}
              <tr className="bg-slate-50">
                {isEditing && <td className="border border-slate-300"></td>}
                {isEditing && <td className="border border-slate-300"></td>}
                <td colSpan={12} className="border border-slate-300 px-3 py-2 text-[11px] font-semibold text-right text-slate-500">
                  부가세 포함 (VAT+)
                </td>
                <td colSpan={2} className="border border-slate-300 px-2 py-2 text-sm text-right tabular-nums font-bold text-teal-700">
                  {Math.round(totals.totalSales * 1.1).toLocaleString('ko-KR')}
                </td>
                <td colSpan={6} className="border border-slate-300"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 모바일 안내 */}
      <div className="lg:hidden bg-carrot-50 border border-carrot-200 rounded-xl p-6 text-center">
        <p className="text-carrot-700 font-semibold mb-2">PC 화면에서 확인하세요</p>
        <p className="text-sm text-carrot-600">지출결의서는 컬럼이 많아 PC 화면에서 확인하는 것을 권장합니다.</p>
      </div>
    </div>
  )
}
