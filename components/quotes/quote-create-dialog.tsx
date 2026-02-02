/**
 * 견적서 작성 다이얼로그
 *
 * 장비 5칸 + 설치비 10칸 기본
 * 컬럼: 품목 / 모델명 / 수량 / 단가 / 금액 / 비고
 */

'use client'

import { useState, useEffect } from 'react'
import { Order, CustomerQuote, QuoteItem } from '@/types/order'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus, X } from 'lucide-react'
import { PriceTableSheet } from '@/components/orders/price-table-dialog'
import { priceTable } from '@/lib/price-table'

interface QuoteCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: Order | null
  onSuccess?: () => void
  onSave?: (orderId: string, quote: CustomerQuote) => void  // 견적서 저장 핸들러 추가
}

interface QuoteLineItem {
  id: string
  product: string    // 품목
  model: string      // 모델명
  quantity: number   // 수량
  price: number      // 단가
  amount: number     // 금액
  notes: string      // 비고
}

export function QuoteCreateDialog({
  open,
  onOpenChange,
  order,
  onSave  // 새 prop 받기
}: QuoteCreateDialogProps) {
  const [equipmentItems, setEquipmentItems] = useState<QuoteLineItem[]>([])
  const [installationItems, setInstallationItems] = useState<QuoteLineItem[]>([])
  const [installRounding, setInstallRounding] = useState(0) // 단위절사 (설치비)
  const [corporateProfit, setCorporateProfit] = useState(0) // 기업이윤
  const [profitGuideMessage, setProfitGuideMessage] = useState('') // 기업이윤 자동계산 안내문구
  const [saveSuccess, setSaveSuccess] = useState(false) // 저장 성공 메시지

  const createEmptyItem = (): QuoteLineItem => ({
    id: `${Date.now()}-${Math.random()}`,
    product: '',
    model: '',
    quantity: 0,
    price: 0,
    amount: 0,
    notes: ''
  })

  /**
   * 모달이 열릴 때 데이터 초기화
   * - 저장된 견적서가 있으면 → 기존 데이터 불러오기
   * - 저장된 견적서가 없으면 → 빈 화면
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open && order) {
      // 저장된 견적서가 있으면 불러오기
      if (order.customerQuote) {
        const quote = order.customerQuote

        // QuoteItem → QuoteLineItem 변환 (장비)
        const loadedEquipment: QuoteLineItem[] = quote.items
          .filter(item => item.category === 'equipment')
          .map(item => {
            // "벽걸이형 냉난방 16평 AR-123" → product: "벽걸이형 냉난방 16평", model: "AR-123"
            const parts = item.itemName.split(' ')
            const model = parts[parts.length - 1] // 마지막 부분이 모델명
            const product = parts.slice(0, -1).join(' ') // 나머지가 품목

            return {
              id: `${Date.now()}-${Math.random()}`,
              product: product || item.itemName,  // 분리 실패 시 전체 사용
              model: model || '',
              quantity: item.quantity,
              price: item.unitPrice,
              amount: item.totalPrice,
              notes: item.description || ''
            }
          })

        // QuoteItem → QuoteLineItem 변환 (설치비)
        const loadedInstallation: QuoteLineItem[] = quote.items
          .filter(item => item.category === 'installation')
          .map(item => ({
            id: `${Date.now()}-${Math.random()}`,
            product: item.itemName,
            model: '',
            quantity: item.quantity,
            price: item.unitPrice,
            amount: item.totalPrice,
            notes: item.description || ''
          }))

        // 최소 3개 장비, 6개 설치비 행 유지
        const equipmentWithEmpty = [
          ...loadedEquipment,
          ...Array(Math.max(0, 3 - loadedEquipment.length)).fill(null).map(() => createEmptyItem())
        ]
        const installationWithEmpty = [
          ...loadedInstallation,
          ...Array(Math.max(0, 6 - loadedInstallation.length)).fill(null).map(() => createEmptyItem())
        ]

        setEquipmentItems(equipmentWithEmpty)
        setInstallationItems(installationWithEmpty)

        // notes에서 저장된 값 복원
        if (quote.notes) {
          // 설치비 단위절사 복원
          const installRoundMatch = quote.notes.match(/설치비절사:\s*([\d,]+)/)
          setInstallRounding(installRoundMatch ? parseInt(installRoundMatch[1].replace(/,/g, '')) : 0)
          // 기업이윤 복원
          const profitMatch = quote.notes.match(/기업이윤:\s*([\d,]+)/)
          setCorporateProfit(profitMatch ? parseInt(profitMatch[1].replace(/,/g, '')) : 0)
        } else {
          setInstallRounding(0)
          setCorporateProfit(0)
        }
        setProfitGuideMessage('')
      } else {
        // 저장된 견적서가 없으면 빈 화면 (장비 3개, 설치비 6개)
        setEquipmentItems(Array(3).fill(null).map(() => createEmptyItem()))
        setInstallationItems(Array(6).fill(null).map(() => createEmptyItem()))
        setInstallRounding(0)
        setCorporateProfit(0)
        setProfitGuideMessage('')
      }
    }
  }, [open, order])

  if (!order) return null

  const updateItem = (
    items: QuoteLineItem[],
    setItems: React.Dispatch<React.SetStateAction<QuoteLineItem[]>>,
    index: number,
    field: keyof QuoteLineItem,
    value: string | number
  ) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    if (field === 'quantity' || field === 'price') {
      const qty = field === 'quantity' ? Number(value) : newItems[index].quantity
      const price = field === 'price' ? Number(value) : newItems[index].price
      newItems[index].amount = qty * price
    }
    setItems(newItems)
  }

  const subtotal = (items: QuoteLineItem[]) =>
    items.reduce((sum, item) => sum + item.amount, 0)

  const total = () => subtotal(equipmentItems) + subtotal(installationItems)

  /** 단가표에서 모델 선택 시 장비 행에 자동 입력 */
  const handlePriceTableSelect = (model: string, size: string, category: string) => {
    setEquipmentItems(prev => {
      const newItems = [...prev]
      // 빈 행 찾기 (품목이 비어있는 첫 번째 행)
      const emptyIndex = newItems.findIndex(item => !item.product.trim())

      // 채울 데이터
      const product = `${category} ${size}`  // 예: "벽걸이형 냉난방 16평"
      const row = priceTable.find(r => r.model === model)
      const price = row?.price ?? 0

      if (emptyIndex !== -1) {
        // 빈 행이 있으면 → 첫 번째 빈 행에 채움
        newItems[emptyIndex] = {
          ...newItems[emptyIndex],
          product,
          model,
          quantity: 1,
          price,
          amount: price,
        }
      } else {
        // 빈 행이 없으면 → 새 행 추가
        newItems.push({
          id: `${Date.now()}-${Math.random()}`,
          product,
          model,
          quantity: 1,
          price,
          amount: price,
          notes: ''
        })
      }
      return newItems
    })
  }

  /**
   * 견적서 저장 핸들러
   *
   * 1. 입력된 항목만 필터링 (빈 행 제외)
   * 2. QuoteLineItem → QuoteItem 형식으로 변환
   * 3. 최종 견적 금액 계산 (공급가액 + VAT 10%)
   * 4. CustomerQuote 객체 생성
   * 5. 부모 컴포넌트에 저장 요청
   */
  const handleSave = () => {
    // 1. 입력된 항목만 필터링 (품목이 비어있지 않은 것만)
    const filledEquipment = equipmentItems.filter(i => i.product.trim())
    const filledInstallation = installationItems.filter(i => i.product.trim())

    // 2. QuoteLineItem → QuoteItem 형식으로 변환
    const quoteItems: QuoteItem[] = [
      // 장비 항목 변환 (품목 + 모델명을 합쳐서 항목명으로)
      ...filledEquipment.map(item => ({
        itemName: `${item.product} ${item.model}`.trim(), // "벽걸이형 냉난방 16평 AR-123"
        category: 'equipment' as const,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.amount,
        description: item.notes || undefined  // 비고가 있으면 추가
      })),
      // 설치비 항목 변환 (품목명만 사용)
      ...filledInstallation.map(item => ({
        itemName: item.product,  // "기본설치비", "배관추가" 등
        category: 'installation' as const,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: item.amount,
        description: item.notes || undefined
      }))
    ]

    // 3. 최종 견적 금액 계산
    const supplyAmount = total() - installRounding + corporateProfit  // 공급가액 (설치비절사 + 기업이윤 반영)
    const vatAmount = Math.floor(supplyAmount * 0.1)  // VAT 10%
    const finalAmount = supplyAmount + vatAmount      // 최종 견적 (공급가액 + VAT)

    // 4. CustomerQuote 객체 생성 (notes에 복원용 데이터 포함)
    const noteParts = [`공급가액: ${supplyAmount.toLocaleString()}원`, `VAT: ${vatAmount.toLocaleString()}원`]
    if (installRounding) noteParts.push(`설치비절사: ${installRounding.toLocaleString()}원`)
    if (corporateProfit) noteParts.push(`기업이윤: ${corporateProfit.toLocaleString()}원`)

    const customerQuote: CustomerQuote = {
      items: quoteItems,
      totalAmount: finalAmount,
      issuedDate: new Date().toISOString().split('T')[0],
      notes: noteParts.join(' | ')
    }

    // 5. 부모 컴포넌트에 저장 요청
    if (onSave && order) {
      onSave(order.id, customerQuote)
    }

    // 6. 저장 완료 확인 모달 표시
    setSaveSuccess(true)

    // 💡 견적서 작성 모달은 닫지 않고 계속 열어둠 (계속 수정 가능)
  }

  /** 테이블 행 렌더링 */
  const renderRow = (
    item: QuoteLineItem,
    index: number,
    items: QuoteLineItem[],
    setItems: React.Dispatch<React.SetStateAction<QuoteLineItem[]>>
  ) => (
    <tr key={item.id} className="group border-b border-gray-100 hover:bg-gray-50/50">
      {/* 번호 */}
      <td className="py-1.5 px-2 text-center text-xs text-gray-400 w-8">
        {index + 1}
      </td>
      {/* 품목 */}
      <td className="py-1.5 px-1">
        <input
          className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
          placeholder="품목"
          value={item.product}
          onChange={(e) => updateItem(items, setItems, index, 'product', e.target.value)}
        />
      </td>
      {/* 모델명 */}
      <td className="py-1.5 px-1">
        <input
          className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
          placeholder="모델명"
          value={item.model}
          onChange={(e) => updateItem(items, setItems, index, 'model', e.target.value)}
        />
      </td>
      {/* 수량 */}
      <td className="py-1.5 px-1 w-16">
        <input
          type="number"
          min="0"
          className="w-full px-2 py-1.5 text-sm text-center border border-gray-200 rounded focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
          value={item.quantity || ''}
          onChange={(e) => updateItem(items, setItems, index, 'quantity', e.target.value)}
        />
      </td>
      {/* 단가 (쉼표 포맷팅) */}
      <td className="py-1.5 px-1 w-28">
        <input
          type="text"
          className="w-full px-2 py-1.5 text-sm text-right border border-gray-200 rounded focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
          placeholder="0"
          value={item.price ? item.price.toLocaleString('ko-KR') : ''}
          onChange={(e) => {
            const numericValue = e.target.value.replace(/,/g, '')
            if (!isNaN(Number(numericValue))) {
              updateItem(items, setItems, index, 'price', numericValue)
            }
          }}
        />
      </td>
      {/* 금액 (자동계산, 쉼표 포맷팅) */}
      <td className="py-1.5 px-2 text-right text-sm font-medium w-28">
        {item.amount > 0 ? item.amount.toLocaleString('ko-KR') : '-'}
      </td>
      {/* 비고 */}
      <td className="py-1.5 px-1 w-32">
        <input
          className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
          placeholder="비고"
          value={item.notes}
          onChange={(e) => updateItem(items, setItems, index, 'notes', e.target.value)}
        />
      </td>
      {/* 삭제 */}
      <td className="py-1.5 px-1 w-8">
        <button
          type="button"
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50"
          onClick={() => setItems(items.filter((_, i) => i !== index))}
        >
          <X className="h-3.5 w-3.5 text-red-400" />
        </button>
      </td>
    </tr>
  )

  /** 테이블 컴포넌트 (showPriceTable: 장비 섹션에서만 단가표 버튼 표시, showRounding: 설치비 단위절사) */
  const renderTable = (
    title: string,
    color: string,
    items: QuoteLineItem[],
    setItems: React.Dispatch<React.SetStateAction<QuoteLineItem[]>>,
    showPriceTable = false,
    showRounding = false
  ) => (
    <div>
      {/* 섹션 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-1 h-5 rounded-full ${color}`} />
          <h3 className="font-semibold text-sm">{title}</h3>
          <span className="text-xs text-gray-400">
            ({items.filter(i => i.product.trim()).length}건 입력)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* 장비 섹션에서만 단가표 버튼 표시 */}
          {showPriceTable && (
            <PriceTableSheet onSelect={handlePriceTableSelect} />
          )}
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
            onClick={() => setItems([...items, createEmptyItem()])}
          >
            <Plus className="h-3 w-3" /> 행 추가
          </button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="py-2 px-2 text-xs font-medium text-gray-500 w-8">#</th>
              <th className="py-2 px-2 text-xs font-medium text-gray-500 text-left">품목</th>
              <th className="py-2 px-2 text-xs font-medium text-gray-500 text-left">모델명</th>
              <th className="py-2 px-2 text-xs font-medium text-gray-500 text-center w-16">수량</th>
              <th className="py-2 px-2 text-xs font-medium text-gray-500 text-right w-28">단가</th>
              <th className="py-2 px-2 text-xs font-medium text-gray-500 text-right w-28">금액</th>
              <th className="py-2 px-2 text-xs font-medium text-gray-500 text-left w-32">비고</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => renderRow(item, index, items, setItems))}
          </tbody>
        </table>

        {/* 설치비 단위절사 (설치비 섹션에서만, 소계 위에 표시) */}
        {showRounding && (
          <div className="flex justify-end items-center px-4 py-2 border-t border-orange-100 bg-orange-50/30">
            <span className="text-sm text-gray-600 mr-4">설치비 단위절사</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-600 font-semibold">-</span>
              <input
                type="text"
                className="w-28 px-2 py-1 text-sm text-right border border-orange-200 rounded focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-100 text-red-600 font-semibold"
                placeholder="0"
                value={installRounding ? installRounding.toLocaleString('ko-KR') : ''}
                onChange={(e) => {
                  const numericValue = e.target.value.replace(/,/g, '')
                  if (!isNaN(Number(numericValue))) {
                    setInstallRounding(Number(numericValue))
                  }
                }}
              />
              <span className="text-sm text-gray-400">원</span>
            </div>
          </div>
        )}

        {/* 소계 */}
        <div className={`flex justify-end items-center px-4 py-2.5 border-t-2 ${
          color === 'bg-blue-500' ? 'border-blue-200 bg-blue-50/50' : 'border-orange-200 bg-orange-50/50'
        }`}>
          <div className="flex items-center gap-2 mr-4">
            <span className="text-sm font-medium text-gray-600">소계</span>
            <span className="text-[10px] text-gray-400">(VAT별도)</span>
          </div>
          <span className={`text-base font-bold min-w-[120px] text-right ${
            color === 'bg-blue-500' ? 'text-blue-600' : 'text-orange-600'
          }`}>
            {showRounding
              ? (subtotal(items) - installRounding > 0 ? `${(subtotal(items) - installRounding).toLocaleString('ko-KR')}원` : '-')
              : (subtotal(items) > 0 ? `${subtotal(items).toLocaleString('ko-KR')}원` : '-')
            }
          </span>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        {/* 헤더 - 견적서 타이틀 */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 z-10">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center text-gray-900">
              {order.affiliate} / {order.businessName} 견적서
            </DialogTitle>
          </DialogHeader>

          {/* 발주 정보 그리드 */}
          <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm bg-gray-50 p-4 rounded-lg">
            <div className="flex">
              <span className="font-semibold text-gray-600 w-24">계열사</span>
              <span className="text-gray-900">{order.affiliate}</span>
            </div>
            <div className="flex">
              <span className="font-semibold text-gray-600 w-24">사업자명</span>
              <span className="text-gray-900">{order.businessName}</span>
            </div>
            <div className="flex">
              <span className="font-semibold text-gray-600 w-24">주소</span>
              <span className="text-gray-900">{order.address}</span>
            </div>
            <div className="flex">
              <span className="font-semibold text-gray-600 w-24">발주일</span>
              <span className="text-gray-900">{order.orderDate}</span>
            </div>
            <div className="flex">
              <span className="font-semibold text-gray-600 w-24">문서번호</span>
              <span className="text-gray-900">{order.documentNumber}</span>
            </div>
            {order.contactName && (
              <div className="flex">
                <span className="font-semibold text-gray-600 w-24">담당자</span>
                <span className="text-gray-900">
                  {order.contactName}
                  {order.contactPhone && ` / ${order.contactPhone}`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 본문 */}
        <div className="px-6 py-4 space-y-6">
          {/* 발주 내역 요약 */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">📋 발주 요청 내역</h3>
            <div className="space-y-1">
              {order.items.map((item, index) => (
                <div key={index} className="text-sm text-blue-800">
                  • {item.workType} - {item.category} {item.model && `(${item.model})`} {item.size} × {item.quantity}대
                </div>
              ))}
              {order.notes && (
                <div className="mt-2 pt-2 border-t border-blue-200">
                  <span className="text-xs font-semibold text-blue-700">특이사항:</span>
                  <span className="text-xs text-blue-800 ml-1">{order.notes}</span>
                </div>
              )}
            </div>
          </div>

          {/* 장비 테이블 (단가표 버튼 포함) */}
          {renderTable('장비', 'bg-blue-500', equipmentItems, setEquipmentItems, true)}

          {/* 설치비 테이블 (단위절사 포함) */}
          {renderTable('설치비', 'bg-orange-500', installationItems, setInstallationItems, false, true)}

          {/* 총 견적 금액 */}
          <div className="border-2 border-gray-300 rounded-lg p-4 bg-white">
            <div className="space-y-2">
              {/* 총 합계 */}
              <div className="flex justify-between items-center py-1.5">
                <span className="text-sm text-gray-600">총 합계</span>
                <span className="text-base font-semibold text-gray-900">
                  {(total() - installRounding).toLocaleString('ko-KR')}원
                </span>
              </div>

              {/* 기업이윤 (입력 가능, + 기호 + 자동계산 버튼) */}
              <div className="flex justify-between items-center py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">기업이윤</span>
                  <button
                    type="button"
                    className="text-[10px] px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                    onClick={() => {
                      // 1. 설치비 소계의 3%
                      const installSubtotal = subtotal(installationItems) - installRounding
                      const rawProfit = Math.floor(installSubtotal * 0.03)
                      // 2. 총합계 + 3% 기업이윤 = 공급가액(절사 전)
                      const totalSum = total() - installRounding
                      const rawSupply = totalSum + rawProfit
                      // 3. 공급가액 백원단위 절사 → 차액만큼 기업이윤에서 차감
                      const remainder = rawSupply % 1000
                      const adjustedProfit = rawProfit - remainder
                      setCorporateProfit(adjustedProfit)
                      setProfitGuideMessage(
                        `설치비 소계 ${installSubtotal.toLocaleString('ko-KR')}원의 3% = ${rawProfit.toLocaleString('ko-KR')}원에서, 공급가액 백원단위 절사 (${remainder.toLocaleString('ko-KR')}원)를 위해 ${adjustedProfit.toLocaleString('ko-KR')}원이 적용됩니다.`
                      )
                    }}
                  >
                    자동계산 (3%)
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-blue-600 font-semibold">+</span>
                  <input
                    type="text"
                    className="w-32 px-2 py-1 text-sm text-right border border-gray-200 rounded focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 text-blue-600 font-semibold"
                    placeholder="0"
                    value={corporateProfit ? corporateProfit.toLocaleString('ko-KR') : ''}
                    onChange={(e) => {
                      const numericValue = e.target.value.replace(/,/g, '')
                      if (!isNaN(Number(numericValue))) {
                        setCorporateProfit(Number(numericValue))
                        setProfitGuideMessage('')
                      }
                    }}
                  />
                  <span className="text-sm text-gray-400">원</span>
                </div>
              </div>

              {/* 자동계산 안내 문구 */}
              {profitGuideMessage && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-md">
                  <svg className="h-4 w-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs text-blue-700">{profitGuideMessage}</span>
                  <button
                    type="button"
                    className="ml-auto text-[10px] text-blue-500 hover:text-blue-700"
                    onClick={() => setProfitGuideMessage('')}
                  >
                    닫기
                  </button>
                </div>
              )}

              {/* 공급가액 */}
              <div className="flex justify-between items-center py-1.5 bg-gray-50 -mx-4 px-4">
                <span className="text-sm font-semibold text-gray-700">공급가액</span>
                <span className="text-base font-bold text-gray-900">
                  {(total() - installRounding + corporateProfit).toLocaleString('ko-KR')}원
                </span>
              </div>

              <div className="border-t border-gray-200 my-2"></div>

              {/* VAT(10%) */}
              <div className="flex justify-between items-center py-1.5">
                <span className="text-sm text-gray-600">VAT (10%)</span>
                <span className="text-base font-semibold text-gray-700">
                  {Math.floor((total() - installRounding + corporateProfit) * 0.1).toLocaleString('ko-KR')}원
                </span>
              </div>

              {/* 최종 견적 */}
              <div className="flex justify-between items-center pt-3 mt-2 border-t-2 border-blue-500 bg-blue-50 -mx-4 px-4 py-3 rounded-b-lg">
                <span className="text-base font-bold text-blue-900">최종 견적</span>
                <span className="text-2xl font-bold text-blue-600">
                  {Math.floor((total() - installRounding + corporateProfit) * 1.1).toLocaleString('ko-KR')}원
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-3 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
          >
            저장
          </Button>
        </div>
      </DialogContent>
      </Dialog>

      {/* 저장 완료 확인 모달 */}
      <Dialog open={saveSuccess} onOpenChange={setSaveSuccess}>
        <DialogContent className="max-w-md">
        <div className="flex flex-col items-center gap-4 py-6">
          {/* 체크 아이콘 */}
          <div className="rounded-full bg-green-100 p-4">
            <svg className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          {/* 메시지 */}
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-bold text-gray-900">저장 완료!</h3>
            <p className="text-gray-600">견적서가 성공적으로 저장되었습니다.</p>
          </div>

          {/* 확인 버튼 */}
          <Button
            onClick={() => setSaveSuccess(false)}
            className="w-full mt-2"
            size="lg"
          >
            확인
          </Button>
        </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
