/**
 * 견적서 작성 다이얼로그
 *
 * 장비 5칸 + 설치비 10칸 기본
 * 컬럼: 품목 / 모델명 / 수량 / 단가 / 금액 / 비고
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { Order, CustomerQuote, QuoteItem } from '@/types/order'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Check, FileDown, Loader2, Plus, X } from 'lucide-react'
import { PriceTableSheet } from '@/components/orders/price-table-dialog'
import { InstallPriceSheet } from '@/components/quotes/install-price-sheet'
import { priceTable } from '@/lib/price-table'
import { generatePdfFromElement } from '@/lib/pdf/quote-pdf'

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
  unit: string       // 단위 (대, m, 식, EA 등)
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [corporateProfit, setCorporateProfit] = useState(0) // 기업이윤 (추후 재구축 예정)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [profitGuideMessage, setProfitGuideMessage] = useState('') // 기업이윤 자동계산 안내문구
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle') // 자동 저장 상태
  const [pdfLoading, setPdfLoading] = useState(false) // PDF 생성 로딩 상태
  const [printMode, setPrintMode] = useState(false) // PDF 캡처용 출력 모드
  const contentRef = useRef<HTMLDivElement>(null) // PDF 캡처 대상 영역
  const isInitialLoad = useRef(true) // 초기 로드 시 자동 저장 방지

  const createEmptyItem = (): QuoteLineItem => ({
    id: `${Date.now()}-${Math.random()}`,
    product: '',
    model: '',
    quantity: 0,
    unit: '',
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
            // "품목|||모델명" 구분자로 분리 (기존 공백 방식 데이터도 호환)
            const hasDelimiter = item.itemName.includes('|||')
            let product = hasDelimiter ? item.itemName.split('|||')[0] : item.itemName
            let model = hasDelimiter ? item.itemName.split('|||')[1] : ''
            // 기존 데이터 호환: 구분자 없으면 마지막 단어가 모델번호 패턴인지 확인
            if (!hasDelimiter) {
              const parts = item.itemName.trim().split(' ')
              if (parts.length >= 2) {
                const last = parts[parts.length - 1]
                if (/^[A-Z0-9]{6,}$/.test(last) && /[A-Z]/.test(last) && /[0-9]/.test(last)) {
                  product = parts.slice(0, -1).join(' ')
                  model = last
                }
              }
            }

            return {
              id: `${Date.now()}-${Math.random()}`,
              product,
              model,
              quantity: item.quantity,
              unit: item.unit || '',
              price: item.unitPrice,
              amount: item.totalPrice,
              notes: item.description || ''
            }
          })

        // QuoteItem → QuoteLineItem 변환 (설치비)
        // "품목|||모델명" 형태로 저장되어 있으면 분리
        const loadedInstallation: QuoteLineItem[] = quote.items
          .filter(item => item.category === 'installation')
          .map(item => {
            const hasModel = item.itemName.includes('|||')
            const product = hasModel ? item.itemName.split('|||')[0] : item.itemName
            const model = hasModel ? item.itemName.split('|||')[1] : ''
            return {
              id: `${Date.now()}-${Math.random()}`,
              product,
              model,
              quantity: item.quantity,
              unit: item.unit || '',
              price: item.unitPrice,
              amount: item.totalPrice,
              notes: item.description || ''
            }
          })

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
      // 초기 로드 완료 → 잠시 후 자동 저장 활성화 (state 세팅 완료 대기)
      setTimeout(() => { isInitialLoad.current = false }, 500)
    } else {
      // 모달 닫히면 초기 로드 플래그 리셋
      isInitialLoad.current = true
      setAutoSaveStatus('idle')
    }
  }, [open, order])

  /**
   * 데이터 변경 시 1초 debounce 자동 저장
   * 초기 로드(useEffect에서 데이터 세팅) 시에는 저장하지 않음
   */
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // 초기 로드 중이면 무시
    if (isInitialLoad.current) return
    // 모달이 닫혀있으면 무시
    if (!open || !order) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      handleSave()
    }, 1000)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentItems, installationItems, installRounding])

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
          unit: '대',
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
          unit: '대',
          price,
          amount: price,
          notes: ''
        })
      }
      return newItems
    })
  }

  /** 설치비 단가표에서 항목 선택 시 설치비 행에 자동 입력 */
  const handleInstallPriceSelect = (item: { product: string; model: string; price: number; unit: string }) => {
    setInstallationItems(prev => {
      const newItems = [...prev]
      // 빈 행 찾기
      const emptyIndex = newItems.findIndex(i => !i.product.trim())

      const rowData = {
        product: item.product,
        model: item.model === '-' ? '' : item.model,
        quantity: 1,
        unit: item.unit,
        price: item.price,
        amount: item.price,
        notes: '',
      }

      if (emptyIndex !== -1) {
        newItems[emptyIndex] = { ...newItems[emptyIndex], ...rowData }
      } else {
        newItems.push({ id: `${Date.now()}-${Math.random()}`, ...rowData })
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
      // 장비 항목 변환 (품목 + 모델명을 |||로 구분하여 저장)
      ...filledEquipment.map(item => ({
        itemName: item.model ? `${item.product}|||${item.model}` : item.product,
        category: 'equipment' as const,
        quantity: item.quantity,
        unit: item.unit || undefined,
        unitPrice: item.price,
        totalPrice: item.amount,
        description: item.notes || undefined  // 비고가 있으면 추가
      })),
      // 설치비 항목 변환 (품목 + 모델명을 |||로 구분하여 저장)
      ...filledInstallation.map(item => ({
        itemName: item.model ? `${item.product}|||${item.model}` : item.product,
        category: 'installation' as const,
        quantity: item.quantity,
        unit: item.unit || undefined,
        unitPrice: item.price,
        totalPrice: item.amount,
        description: item.notes || undefined
      }))
    ]

    // 3. 최종 견적 금액 계산
    const supplyAmount = total() - installRounding  // 공급가액 (설치비절사 반영)
    const vatAmount = Math.floor(supplyAmount * 0.1)  // VAT 10%
    const finalAmount = supplyAmount + vatAmount      // 최종 견적 (공급가액 + VAT)

    // 4. CustomerQuote 객체 생성 (notes에 복원용 데이터 포함)
    const noteParts = [`공급가액: ${supplyAmount.toLocaleString()}원`, `VAT: ${vatAmount.toLocaleString()}원`]
    if (installRounding) noteParts.push(`설치비절사: ${installRounding.toLocaleString()}원`)
    // 기업이윤 기능 임시 비활성화

    const customerQuote: CustomerQuote = {
      items: quoteItems,
      totalAmount: finalAmount,
      issuedDate: new Date().toISOString().split('T')[0],
      notes: noteParts.join(' | ')
    }

    // 5. 부모 컴포넌트에 저장 요청
    if (onSave && order) {
      setAutoSaveStatus('saving')
      onSave(order.id, customerQuote)
      // 저장 완료 표시 (잠시 후 사라짐)
      setTimeout(() => setAutoSaveStatus('saved'), 300)
      setTimeout(() => setAutoSaveStatus('idle'), 2500)
    }
  }

  /**
   * 엑셀 붙여넣기 처리
   *
   * 엑셀에서 여러 셀을 복사하면 클립보드에 이렇게 저장됨:
   *   "벽걸이 설치\t\t1\t50000\n배관 연장\t\t2\t30000"
   *   → \t = 탭(셀 구분), \n = 줄바꿈(행 구분)
   *
   * 이걸 파싱해서 각 행에 자동으로 나눠서 넣어줌
   */
  const handlePaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    index: number,
    fieldIndex: number, // 0=품목, 1=모델명, 2=수량, 3=단위, 4=단가, 5=비고
    items: QuoteLineItem[],
    setItems: React.Dispatch<React.SetStateAction<QuoteLineItem[]>>
  ) => {
    const pasteText = e.clipboardData.getData('text')

    // 줄바꿈(\n) 또는 탭(\t)이 있으면 → 엑셀에서 복사한 것
    const rows = pasteText.split(/\r?\n/).filter(row => row.trim())
    const hasTab = pasteText.includes('\t')
    if (rows.length <= 1 && !hasTab) return // 단순 텍스트면 기본 붙여넣기 동작 사용

    // 여러 줄이면 기본 동작 막고 직접 처리
    e.preventDefault()

    const fieldMap: (keyof QuoteLineItem)[] = ['product', 'model', 'quantity', 'unit', 'price', 'notes']
    const newItems = [...items]

    rows.forEach((row, rowOffset) => {
      const cells = row.split('\t') // 탭으로 셀 구분
      const targetIndex = index + rowOffset

      // 행이 부족하면 빈 행 추가
      while (newItems.length <= targetIndex) {
        newItems.push(createEmptyItem())
      }

      // 현재 필드 위치부터 셀 데이터를 순서대로 채움
      cells.forEach((cellValue, cellOffset) => {
        const targetField = fieldIndex + cellOffset
        if (targetField >= fieldMap.length) return // 필드 범위 초과 시 무시

        const field = fieldMap[targetField]
        const trimmed = cellValue.trim()

        if (field === 'quantity') {
          const num = parseInt(trimmed.replace(/,/g, '')) || 0
          newItems[targetIndex] = { ...newItems[targetIndex], quantity: num }
        } else if (field === 'price') {
          const num = parseInt(trimmed.replace(/,/g, '')) || 0
          newItems[targetIndex] = { ...newItems[targetIndex], price: num }
        } else if (field === 'unit') {
          newItems[targetIndex] = { ...newItems[targetIndex], unit: trimmed }
        } else {
          newItems[targetIndex] = { ...newItems[targetIndex], [field]: trimmed }
        }
      })

      // 수량 × 단가 = 금액 자동 계산
      newItems[targetIndex].amount = newItems[targetIndex].quantity * newItems[targetIndex].price
    })

    setItems(newItems)
  }

  /** 테이블 행 렌더링 (printMode: input → span 변환) */
  const renderRow = (
    item: QuoteLineItem,
    index: number,
    items: QuoteLineItem[],
    setItems: React.Dispatch<React.SetStateAction<QuoteLineItem[]>>
  ) => (
    <tr key={item.id} className={`group border-b border-gray-100 hover:bg-gray-50/50 ${!item.product.trim() ? 'print-empty-row' : ''}`}>
      {/* 번호 */}
      <td className="py-1.5 px-2 text-center text-xs text-gray-400 w-8">
        {index + 1}
      </td>
      {/* 품목 */}
      <td className="py-1.5 px-1">
        {printMode ? (
          <span className="block px-2 py-1.5 text-sm">{item.product}</span>
        ) : (
          <input
            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100"
            placeholder="품목"
            value={item.product}
            onChange={(e) => updateItem(items, setItems, index, 'product', e.target.value)}
            onPaste={(e) => handlePaste(e, index, 0, items, setItems)}
          />
        )}
      </td>
      {/* 모델명 */}
      <td className="py-1.5 px-1">
        {printMode ? (
          <span className="block px-2 py-1.5 text-sm">{item.model}</span>
        ) : (
          <input
            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100"
            placeholder="모델명"
            value={item.model}
            onChange={(e) => updateItem(items, setItems, index, 'model', e.target.value)}
            onPaste={(e) => handlePaste(e, index, 1, items, setItems)}
          />
        )}
      </td>
      {/* 수량 */}
      <td className="py-1.5 px-1 w-16">
        {printMode ? (
          <span className="block px-2 py-1.5 text-sm text-center">{item.quantity || ''}</span>
        ) : (
          <input
            type="number"
            min="0"
            className="w-full px-2 py-1.5 text-sm text-center border border-gray-200 rounded focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100"
            value={item.quantity || ''}
            onChange={(e) => updateItem(items, setItems, index, 'quantity', e.target.value)}
            onPaste={(e) => handlePaste(e, index, 2, items, setItems)}
          />
        )}
      </td>
      {/* 단위 */}
      <td className="py-1.5 px-1 w-14">
        {printMode ? (
          <span className="block px-1.5 py-1.5 text-sm text-center">{item.unit}</span>
        ) : (
          <input
            className="w-full px-1.5 py-1.5 text-sm text-center border border-gray-200 rounded focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100"
            placeholder="단위"
            value={item.unit}
            onChange={(e) => updateItem(items, setItems, index, 'unit', e.target.value)}
            onPaste={(e) => handlePaste(e, index, 3, items, setItems)}
          />
        )}
      </td>
      {/* 단가 (쉼표 포맷팅) */}
      <td className="py-1.5 px-1 w-28">
        {printMode ? (
          <span className="block px-2 py-1.5 text-sm text-right">{item.price ? item.price.toLocaleString('ko-KR') : ''}</span>
        ) : (
          <input
            type="text"
            className="w-full px-2 py-1.5 text-sm text-right border border-gray-200 rounded focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100"
            placeholder="0"
            value={item.price ? item.price.toLocaleString('ko-KR') : ''}
            onChange={(e) => {
              const numericValue = e.target.value.replace(/,/g, '')
              if (!isNaN(Number(numericValue))) {
                updateItem(items, setItems, index, 'price', numericValue)
              }
            }}
            onPaste={(e) => handlePaste(e, index, 4, items, setItems)}
          />
        )}
      </td>
      {/* 금액 (자동계산, 쉼표 포맷팅) */}
      <td className="py-1.5 px-2 text-right text-sm font-medium w-28">
        {item.amount > 0 ? item.amount.toLocaleString('ko-KR') : '-'}
      </td>
      {/* 비고 */}
      <td className="py-1.5 px-1 w-32">
        {printMode ? (
          <span className="block px-2 py-1.5 text-xs">{item.notes}</span>
        ) : (
          <input
            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-100"
            placeholder="비고"
            value={item.notes}
            onChange={(e) => updateItem(items, setItems, index, 'notes', e.target.value)}
            onPaste={(e) => handlePaste(e, index, 5, items, setItems)}
          />
        )}
      </td>
      {/* 삭제 (PDF 출력 시 숨김) */}
      <td className="py-1.5 px-1 w-8 print-hide">
        <button
          type="button"
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-brick-50"
          onClick={() => setItems(items.filter((_, i) => i !== index))}
        >
          <X className="h-3.5 w-3.5 text-brick-400" />
        </button>
      </td>
    </tr>
  )

  /** 테이블 컴포넌트 (showPriceTable: 장비 단가표, showInstallPriceTable: 설치비 단가표, showRounding: 단위절사) */
  const renderTable = (
    title: string,
    color: string,
    items: QuoteLineItem[],
    setItems: React.Dispatch<React.SetStateAction<QuoteLineItem[]>>,
    showPriceTable = false,
    showRounding = false,
    showInstallPriceTable = false
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
        <div className="flex items-center gap-2 print-hide">
          {/* 장비 섹션: 장비 단가표 */}
          {showPriceTable && (
            <PriceTableSheet onSelect={handlePriceTableSelect} />
          )}
          {/* 설치비 섹션: 설치비 단가표 */}
          {showInstallPriceTable && (
            <InstallPriceSheet onSelect={handleInstallPriceSelect} />
          )}
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-teal-500 hover:text-teal-700 px-2 py-1 rounded hover:bg-teal-50 transition-colors"
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
              <th className="py-2 px-2 text-xs font-medium text-gray-500 text-center w-14">단위</th>
              <th className="py-2 px-2 text-xs font-medium text-gray-500 text-right w-28">단가</th>
              <th className="py-2 px-2 text-xs font-medium text-gray-500 text-right w-28">금액</th>
              <th className="py-2 px-2 text-xs font-medium text-gray-500 text-left w-32">비고</th>
              <th className="w-8 print-hide"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => renderRow(item, index, items, setItems))}
          </tbody>
        </table>

        {/* 설치비 단위절사 (설치비 섹션에서만, 소계 위에 표시) */}
        {showRounding && (
          <div className="flex justify-end items-center px-4 py-2 border-t border-carrot-100 bg-carrot-50/30">
            <span className="text-sm text-gray-600 mr-4">설치비 단위절사</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-brick-600 font-semibold">-</span>
              {printMode ? (
                <span className="text-sm text-right text-brick-600 font-semibold">{installRounding ? installRounding.toLocaleString('ko-KR') : '0'}</span>
              ) : (
                <input
                  type="text"
                  className="w-28 px-2 py-1 text-sm text-right border border-carrot-200 rounded focus:outline-none focus:border-carrot-400 focus:ring-1 focus:ring-carrot-100 text-brick-600 font-semibold"
                  placeholder="0"
                  value={installRounding ? installRounding.toLocaleString('ko-KR') : ''}
                  onChange={(e) => {
                    const numericValue = e.target.value.replace(/,/g, '')
                    if (!isNaN(Number(numericValue))) {
                      setInstallRounding(Number(numericValue))
                    }
                  }}
                />
              )}
              <span className="text-sm text-gray-400">원</span>
            </div>
          </div>
        )}

        {/* 소계 */}
        <div className={`flex justify-end items-center px-4 py-2.5 border-t-2 ${
          color === 'bg-teal-500' ? 'border-teal-200 bg-teal-50/50' : 'border-carrot-200 bg-carrot-50/50'
        }`}>
          <div className="flex items-center gap-2 mr-4">
            <span className="text-sm font-medium text-gray-600">소계</span>
            <span className="text-[10px] text-gray-400">(VAT별도)</span>
          </div>
          <span className={`text-base font-bold min-w-[120px] text-right ${
            color === 'bg-teal-500' ? 'text-teal-600' : 'text-carrot-600'
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
      <DialogContent
        className={`max-w-4xl p-0 ${printMode ? 'overflow-visible !max-h-none' : 'max-h-[90vh] overflow-y-auto'}`}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* PDF 생성 중 로딩 오버레이 */}
        {pdfLoading && (
          <div className="absolute inset-0 bg-white/80 z-50 flex items-center justify-center rounded-lg">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-brick-500" />
              <p className="mt-2 text-sm text-gray-600">PDF 생성 중...</p>
            </div>
          </div>
        )}

        {/* PDF 캡처 영역 (헤더 + 본문) */}
        <div ref={contentRef} className={printMode ? 'quote-print-mode' : ''}>

        {/* 헤더 - 견적서 타이틀 */}
        <div className={`${printMode ? '' : 'sticky top-0 z-10'} bg-white border-b px-6 py-4`}>
          {/* 우측 상단 X 닫기 버튼 (PDF 출력 시 숨김) */}
          <button
            type="button"
            className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 transition-opacity print-hide"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
          {/* MeLEA 브랜드 로고 (좌측 상단) */}
          <div className="mb-2">
            <div className="inline-flex flex-col">
              <span className="font-black text-2xl" style={{ lineHeight: 1, letterSpacing: '-0.5px', color: '#D48A18' }}>
                MeLEA
              </span>
              <span className="block h-[2px] rounded-full mt-0.5" style={{ background: 'linear-gradient(to right, #D48A18, #E9A733, transparent)' }} />
            </div>
          </div>
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
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-teal-900 mb-2">📋 발주 요청 내역</h3>
            <div className="space-y-1">
              {order.items.map((item, index) => (
                <div key={index} className="text-sm text-teal-800">
                  • {item.workType} - {item.category} {item.model && `(${item.model})`} {item.size} × {item.quantity}대
                </div>
              ))}
              {order.notes && (
                <div className="mt-2 pt-2 border-t border-teal-200">
                  <span className="text-xs font-semibold text-teal-700">특이사항:</span>
                  <span className="text-xs text-teal-800 ml-1">{order.notes}</span>
                </div>
              )}
            </div>
          </div>

          {/* 장비 테이블 (단가표 버튼 포함) */}
          {renderTable('장비', 'bg-teal-500', equipmentItems, setEquipmentItems, true)}

          {/* 설치비 테이블 (단위절사 + 설치비 단가표 포함) */}
          {renderTable('설치비', 'bg-carrot-500', installationItems, setInstallationItems, false, true, true)}

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

              {/* 공급가액 */}
              <div className="flex justify-between items-center py-1.5 bg-gray-50 -mx-4 px-4">
                <span className="text-sm font-semibold text-gray-700">공급가액</span>
                <span className="text-base font-bold text-gray-900">
                  {(total() - installRounding).toLocaleString('ko-KR')}원
                </span>
              </div>

              <div className="border-t border-gray-200 my-2"></div>

              {/* VAT(10%) */}
              <div className="flex justify-between items-center py-1.5">
                <span className="text-sm text-gray-600">VAT (10%)</span>
                <span className="text-base font-semibold text-gray-700">
                  {Math.floor((total() - installRounding) * 0.1).toLocaleString('ko-KR')}원
                </span>
              </div>

              {/* 최종 견적 */}
              <div className="flex justify-between items-center pt-3 mt-2 border-t-2 border-teal-500 bg-teal-50 -mx-4 px-4 py-3 rounded-b-lg">
                <span className="text-base font-bold text-teal-900">최종 견적</span>
                <span className="text-2xl font-bold text-teal-600">
                  {Math.floor((total() - installRounding) * 1.1).toLocaleString('ko-KR')}원
                </span>
              </div>
            </div>
          </div>
        </div>

        </div>{/* contentRef 닫기 */}

        {/* 하단 버튼 (PDF 캡처 영역 밖) */}
        {!printMode && (
        <div className="sticky bottom-0 bg-white border-t px-6 py-3 flex justify-between items-center">
          {/* 자동 저장 상태 표시 */}
          <div className="text-xs text-gray-400">
            {autoSaveStatus === 'saving' && (
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-carrot-400 animate-pulse" />
                저장 중...
              </span>
            )}
            {autoSaveStatus === 'saved' && (
              <span className="inline-flex items-center gap-1 text-olive-600">
                <Check className="h-3 w-3" />
                자동 저장됨
              </span>
            )}
            {autoSaveStatus === 'idle' && (
              <span>입력 시 자동 저장</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* PDF 다운로드 버튼 — 견적 항목이 있을 때만 활성화 */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-brick-300 text-brick-600 hover:bg-brick-50 hover:text-brick-700"
              disabled={pdfLoading || !order.customerQuote?.items?.length}
              onClick={async () => {
                if (!order || !contentRef.current) return
                setPdfLoading(true)
                try {
                  // 1. 출력 모드 전환 (빈 행 숨기기, 버튼 숨기기, input 테두리 제거)
                  setPrintMode(true)
                  await new Promise(r => setTimeout(r, 150)) // 렌더링 대기

                  // 2. DOM 캡처 → PDF 생성
                  const fileName = `견적서_${order.businessName}_${order.documentNumber || ''}.pdf`
                  await generatePdfFromElement(contentRef.current, fileName)
                } catch (err) {
                  console.error('PDF 생성 실패:', err)
                  alert('PDF 생성에 실패했습니다.')
                } finally {
                  // 3. 편집 모드 복원
                  setPrintMode(false)
                  setPdfLoading(false)
                }
              }}
            >
              {pdfLoading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-1" />
              )}
              {pdfLoading ? 'PDF 생성 중...' : 'PDF 다운로드'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              닫기
            </Button>
          </div>
        </div>
        )}
      </DialogContent>
      </Dialog>

    </>
  )
}
