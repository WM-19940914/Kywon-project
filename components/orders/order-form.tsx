/**
 * 발주 등록 폼 컴포넌트 (스텝별 진행)
 *
 * 에어컨 초보자도 쉽게 사용할 수 있도록 4단계로 나눔:
 * Step 1: 계열사 선택
 * Step 2: 발주내역 (작업종류, 품목, 수량)
 * Step 3: 주소 + 사업자명 (작업종류에 따라 다르게)
 * Step 4: 검토 및 제출
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, X, ChevronLeft, ChevronRight, MapPin } from 'lucide-react'
import {
  AFFILIATE_OPTIONS,
  CATEGORY_OPTIONS,
  WORK_TYPE_OPTIONS,
  type OrderItem
} from '@/types/order'
import { PriceTableSheet } from '@/components/orders/price-table-dialog'
import { SIZE_OPTIONS } from '@/lib/price-table'

/**
 * 폼 데이터 타입 정의
 */
export interface OrderFormData {
  documentNumber: string
  address: string
  orderDate: string
  orderNumber: string
  affiliate: string
  businessName: string
  contactName: string           // 담당자 성함
  contactPhone: string          // 담당자 연락처
  buildingManagerPhone?: string // 건물관리인 연락처 (선택)
  requestedInstallDate?: string // 설치요청일
  items: OrderItem[]
  notes?: string                // 설치기사님 전달사항
}

/**
 * 컴포넌트가 받을 Props
 */
interface OrderFormProps {
  onSubmit: (data: OrderFormData) => void
  onCancel: () => void
  initialData?: Partial<OrderFormData>
  submitLabel?: string
  isSubmitting?: boolean
}

/**
 * 계열사별 문서번호 코드
 */
const AFFILIATE_CODES: Record<string, string> = {
  '구몬': 'KUMON',
  'Wells 영업': 'WELLSSALES',
  'Wells 서비스': 'WELLSSERVICE',
  '교육플랫폼': 'EDU',
  '기타': 'ETC'
}

/**
 * 빈 OrderItem 생성
 */
function createEmptyItem(): OrderItem {
  return {
    id: `temp-${Date.now()}`,
    workType: '신규설치',
    category: '시스템에어컨',
    model: '',
    size: '',
    quantity: 1
  }
}

/**
 * 문서번호 자동 생성
 * 형식: KUMON-20260129-01
 */
function generateDocumentNumber(affiliate: string): string {
  const code = AFFILIATE_CODES[affiliate] || 'ETC'
  const today = new Date()
  const dateStr = today.toISOString().split('T')[0].replace(/-/g, '') // 20260129

  // 일련번호는 임시로 01 (실제로는 DB에서 조회해야 함)
  const serial = '01'

  return `${code}-${dateStr}-${serial}`
}

/**
 * 다음 우편번호 서비스 타입 선언
 */
declare global {
  interface Window {
    daum: any
  }
}

/**
 * 전화번호 자동 포맷팅 (010-1234-5678)
 */
function formatPhoneNumber(value: string): string {
  // 숫자만 추출
  const numbers = value.replace(/[^\d]/g, '')

  // 길이에 따라 포맷팅
  if (numbers.length <= 3) {
    return numbers
  } else if (numbers.length <= 7) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3)}`
  } else if (numbers.length <= 11) {
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`
  }

  // 11자 초과는 자르기
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`
}

export function OrderForm({
  onSubmit,
  onCancel,
  initialData,
  submitLabel = '등록',
  isSubmitting = false
}: OrderFormProps) {
  // 스텝 관리 (1~4)
  const [currentStep, setCurrentStep] = useState(1)

  // 폼 데이터 상태
  const [affiliate, setAffiliate] = useState(initialData?.affiliate || '')
  const [items, setItems] = useState<OrderItem[]>(initialData?.items || [createEmptyItem()])
  const [baseAddress, setBaseAddress] = useState('') // 기본 작업 장소 (Step 2)
  const [baseDetailAddress, setBaseDetailAddress] = useState('') // 기본 상세주소
  const [relocationAddress, setRelocationAddress] = useState('') // 이전 목적지 (Step 3, 조건부)
  const [relocationDetailAddress, setRelocationDetailAddress] = useState('') // 이전 목적지 상세주소
  const [businessName, setBusinessName] = useState(initialData?.businessName || '')
  const [contactName, setContactName] = useState('') // 담당자 성함
  const [contactPhone, setContactPhone] = useState('') // 담당자 연락처
  const [buildingManagerPhone, setBuildingManagerPhone] = useState('') // 건물관리인 연락처 (선택)
  const [documentNumber, setDocumentNumber] = useState('') // 문서번호 (자동 생성, 수정 가능)
  const [requestedInstallDate, setRequestedInstallDate] = useState('') // 설치요청일
  const [notes, setNotes] = useState(initialData?.notes || '') // 설치기사님 전달사항

  /**
   * 다음 우편번호 서비스 스크립트 로드
   */
  useEffect(() => {
    const script = document.createElement('script')
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.async = true
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [])

  /**
   * 주소 검색 팝업 열기
   */
  const handleSearchAddress = (type: 'base' | 'relocation') => {
    if (!window.daum) {
      alert('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }

    new window.daum.Postcode({
      oncomplete: function(data: any) {
        // 도로명 주소 또는 지번 주소
        const fullAddress = data.roadAddress || data.jibunAddress

        if (type === 'base') {
          setBaseAddress(fullAddress)
          setBaseDetailAddress('')
        } else {
          setRelocationAddress(fullAddress)
          setRelocationDetailAddress('')
        }
      }
    }).open()
  }

  /**
   * 발주내역 항목 추가
   */
  const handleAddItem = () => {
    setItems([...items, createEmptyItem()])
  }

  /**
   * 발주내역 항목 삭제
   */
  const handleRemoveItem = (itemId: string) => {
    if (items.length === 1) {
      alert('최소 1개의 발주내역은 있어야 합니다')
      return
    }
    setItems(items.filter(item => item.id !== itemId))
  }

  /**
   * 발주내역 항목 수정
   */
  const handleItemChange = (itemId: string, field: keyof OrderItem, value: any) => {
    setItems(items.map(item =>
      item.id === itemId ? { ...item, [field]: value } : item
    ))
  }

  /**
   * 발주내역 항목 여러 필드 한번에 수정 (단가표 자동입력용)
   */
  const handleItemChangeMultiple = (itemId: string, updates: Partial<OrderItem>) => {
    setItems(items.map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    ))
  }

  /**
   * 이전설치 여부 확인
   */
  const isRelocation = items.some(item => item.workType === '이전설치')

  /**
   * 다음 스텝으로 이동
   */
  const handleNext = () => {
    // 유효성 검사
    if (currentStep === 1 && !affiliate) {
      alert('계열사를 선택해주세요')
      return
    }
    if (currentStep === 2) {
      // Step 2: 주소 + 사업자명 + 담당자 정보
      if (!baseAddress) {
        alert('작업 장소를 검색해주세요')
        return
      }
      if (!businessName) {
        alert('사업자명을 입력해주세요')
        return
      }
      if (!contactName) {
        alert('담당자 성함을 입력해주세요')
        return
      }
      if (!contactPhone) {
        alert('담당자 연락처를 입력해주세요')
        return
      }
    }
    if (currentStep === 3) {
      // Step 3: 작업내역 + (조건부) 이전주소
      const hasEmptyQuantity = items.some(item => !item.quantity || item.quantity < 1)
      if (hasEmptyQuantity) {
        alert('수량을 입력해주세요')
        return
      }

      // 이전설치가 있으면 이전 주소 필수
      if (isRelocation && !relocationAddress) {
        alert('이전할 주소를 검색해주세요')
        return
      }

      // Step 3 → Step 4로 넘어갈 때 문서번호와 설치요청일 자동 생성
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
      const dateStr = today.replace(/-/g, '') // YYYYMMDD

      // 문서번호: 사업자명-YYYYMMDD-01 (일련번호는 임시로 01, 실제는 DB 조회 필요)
      const autoDocNumber = `${businessName}-${dateStr}-01`
      setDocumentNumber(autoDocNumber)

      // 설치요청일: 오늘 날짜로 기본 설정
      setRequestedInstallDate(today)
    }

    setCurrentStep(currentStep + 1)
  }

  /**
   * 이전 스텝으로 이동
   */
  const handlePrev = () => {
    setCurrentStep(currentStep - 1)
  }

  /**
   * 폼 제출
   */
  const handleSubmit = () => {
    // 필수 항목 검증
    if (!documentNumber) {
      alert('문서번호를 입력해주세요')
      return
    }
    if (!requestedInstallDate) {
      alert('설치요청일을 선택해주세요')
      return
    }

    // 오늘 날짜
    const orderDate = new Date().toISOString().split('T')[0]

    // 주소 생성
    let finalAddress = ''
    if (isRelocation) {
      // 이전설치 있음: 작업장소 + 이전목적지
      const baseFull = baseDetailAddress ? `${baseAddress}, ${baseDetailAddress}` : baseAddress
      const relocationFull = relocationDetailAddress
        ? `${relocationAddress}, ${relocationDetailAddress}`
        : relocationAddress
      finalAddress = `작업장소: ${baseFull} / 이전목적지: ${relocationFull}`
    } else {
      // 신규/철거만: 작업장소만
      finalAddress = baseDetailAddress ? `${baseAddress}, ${baseDetailAddress}` : baseAddress
    }

    const formData: OrderFormData = {
      documentNumber,
      address: finalAddress,
      orderDate,
      orderNumber: '', // 주문번호는 빈 문자열 (사용 안 함)
      affiliate,
      businessName,
      contactName,
      contactPhone,
      buildingManagerPhone: buildingManagerPhone || undefined,
      requestedInstallDate,
      items,
      notes
    }

    onSubmit(formData)
  }

  /**
   * 진행률 계산
   */
  const progress = (currentStep / 4) * 100

  return (
    <div className="space-y-6">
      {/* 진행률 표시 */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Step {currentStep} / 4</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step 1: 계열사 선택 */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">어느 계열사인가요?</h2>
            <p className="text-gray-600">발주를 요청할 계열사를 선택해주세요</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {AFFILIATE_OPTIONS.map((option) => (
              <Card
                key={option}
                className={`cursor-pointer transition-all hover:shadow-lg ${
                  affiliate === option
                    ? 'border-blue-500 border-2 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => setAffiliate(option)}
              >
                <CardContent className="p-6 text-center">
                  <div className="text-4xl mb-2">
                    {option === '구몬' && '📚'}
                    {option === 'Wells 영업' && '💼'}
                    {option === 'Wells 서비스' && '🏢'}
                    {option === '교육플랫폼' && '🎓'}
                    {option === '기타' && '📋'}
                  </div>
                  <h3 className="font-bold text-lg">{option}</h3>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: 작업 장소 + 사업자명 + 담당자 정보 */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">작업 장소와 담당자 정보</h2>
            <p className="text-gray-600">작업이 진행될 장소와 연락할 담당자 정보를 입력해주세요</p>
          </div>

          {/* 장소 정보 섹션 */}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-lg">장소 정보</h3>
              </div>

              {/* 주소 검색 */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  작업 장소 (대표 주소) <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    value={baseAddress}
                    placeholder="주소 검색 버튼을 눌러주세요"
                    readOnly
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={() => handleSearchAddress('base')}
                    className="gap-2"
                  >
                    <MapPin className="h-4 w-4" />
                    주소 검색
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  💡 다음 우편번호 서비스로 정확한 주소를 검색하세요
                </p>
              </div>

              {/* 상세 주소 (선택) */}
              {baseAddress && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    상세 주소 (선택)
                  </label>
                  <Input
                    value={baseDetailAddress}
                    placeholder="예: 101동 1001호"
                    onChange={(e) => setBaseDetailAddress(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    💡 건물명, 동/호수 등을 입력하세요
                  </p>
                </div>
              )}

              {/* 사업자명 */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  사업자명 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="예: 구몬 화곡지국"
                />
              </div>
            </CardContent>
          </Card>

          {/* 담당자 정보 섹션 */}
          <Card className="border-blue-200">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-2xl">👤</div>
                <h3 className="font-bold text-lg">담당자 정보</h3>
              </div>

              {/* 담당자 성함 + 연락처 (한 행) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    성함 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="홍길동"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    연락처 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(formatPhoneNumber(e.target.value))}
                    placeholder="010-1234-5678"
                    maxLength={13}
                  />
                </div>
              </div>

              {/* 건물관리인 연락처 (선택) */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  건물관리인 연락처 (선택)
                </label>
                <Input
                  type="tel"
                  value={buildingManagerPhone}
                  onChange={(e) => setBuildingManagerPhone(formatPhoneNumber(e.target.value))}
                  placeholder="02-123-4567 또는 010-9876-5432"
                  maxLength={13}
                  className="max-w-md"
                />
                <p className="text-xs text-gray-500 mt-1">
                  💡 건물 소장이나 관리인과 연락해야 한다면 입력하세요
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: 작업 내역 + (조건부) 이전 주소 */}
      {currentStep === 3 && (
        <div className="space-y-5">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">📦 어떤 작업인가요?</h2>
            <p className="text-gray-600">설치할 장비 정보를 입력해주세요</p>
          </div>

          {/* 작업 항목 리스트 */}
          <div className="space-y-4">
            {items.map((item, index) => {
              // 작업종류별 색상
              const getBorderColor = () => {
                switch (item.workType) {
                  case '신규설치':
                    return 'border-green-300 bg-green-50'
                  case '이전설치':
                    return 'border-blue-300 bg-blue-50'
                  case '철거보관':
                    return 'border-purple-300 bg-purple-50'
                  case '철거폐기':
                    return 'border-orange-300 bg-orange-50'
                  default:
                    return 'border-gray-300'
                }
              }

              // 철거 작업 여부 (모델명/평형 선택사항)
              const isRemovalWork = item.workType === '철거보관' || item.workType === '철거폐기'
              // 신규/이전 작업 여부 (평형 필수)
              const needsSize = item.workType === '신규설치' || item.workType === '이전설치'

              return (
                <Card key={item.id} className={`relative ${getBorderColor()}`}>
                  <CardContent className="p-5">
                    {/* 삭제 버튼 */}
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(item.id!)}
                        className="absolute top-2 right-2 h-7 w-7 p-0 text-red-500 hover:bg-red-100 z-10"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}

                    <div className="mb-3">
                      <Badge variant="outline" className="text-base px-3 py-1">
                        작업 {index + 1}
                      </Badge>
                    </div>

                    <div className="mb-4">
                      <PriceTableSheet
                        onSelect={(model, size, category) => {
                          // 품목은 매핑 필요 (벽걸이형 → 벽걸이에어컨)
                          const categoryMap: Record<string, string> = {
                            '벽걸이형': '벽걸이에어컨',
                            '스탠드형': '스탠드에어컨'
                          }
                          // 단가표에서 선택한 값으로 자동 입력 (한번에 업데이트!)
                          handleItemChangeMultiple(item.id!, {
                            model: model,
                            size: size,
                            category: categoryMap[category] || category
                          })
                        }}
                      />
                    </div>

                    <div className="space-y-4">
                      {/* 작업종류 + 품목 */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            작업종류 <span className="text-red-500">*</span>
                          </label>
                          <Select
                            value={item.workType}
                            onValueChange={(value: any) =>
                              handleItemChange(item.id!, 'workType', value)
                            }
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {WORK_TYPE_OPTIONS.map(option => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">
                            품목 <span className="text-red-500">*</span>
                          </label>
                          <Select
                            value={item.category}
                            onValueChange={(value) =>
                              handleItemChange(item.id!, 'category', value)
                            }
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORY_OPTIONS.map(option => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* 모델명 + 평형 + 수량 */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            모델명 {isRemovalWork && <span className="text-gray-500 text-xs">(선택)</span>}
                          </label>
                          <Input
                            placeholder={isRemovalWork ? "미확인" : "AR-123"}
                            value={item.model}
                            onChange={(e) =>
                              handleItemChange(item.id!, 'model', e.target.value)
                            }
                            className="bg-white"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">
                            평형 {isRemovalWork && <span className="text-gray-500 text-xs">(선택)</span>}
                          </label>
                          <Select
                            value={item.size || ''}
                            onValueChange={(value) =>
                              handleItemChange(item.id!, 'size', value)
                            }
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder={isRemovalWork ? "미확인" : "선택하세요"} />
                            </SelectTrigger>
                            <SelectContent>
                              {SIZE_OPTIONS.map(size => (
                                <SelectItem key={size} value={size}>
                                  {size}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">
                            수량 <span className="text-red-500">*</span>
                          </label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(item.id!, 'quantity', parseInt(e.target.value) || 1)
                            }
                            className="bg-white"
                          />
                        </div>
                      </div>

                      {/* 안내문구 */}
                      {isRemovalWork ? (
                        <p className="text-xs text-gray-600 bg-white p-2 rounded border border-gray-200">
                          ℹ️ 철거 작업의 경우 모델명과 평형을 모르면 "미확인"으로 선택하세요
                        </p>
                      ) : (
                        <p className="text-xs text-gray-600 bg-white p-2 rounded border border-gray-200">
                          💡 모델명을 모르는 경우 공란으로 두고, 평형은 반드시 선택해주세요
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            <Button
              type="button"
              variant="outline"
              onClick={handleAddItem}
              className="w-full gap-2 h-12 text-base font-medium border-2 border-dashed hover:bg-gray-50"
            >
              <Plus className="h-5 w-5" />
              작업 추가
            </Button>
          </div>

          {/* 이전설치가 있으면 이전 목적지 입력 */}
          {isRelocation && (
            <Card className="border-blue-300 bg-blue-50">
              <CardContent className="p-6 space-y-4">
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2 mb-2">
                    🚚 이전설치 목적지
                  </h3>
                  <p className="text-sm text-gray-600">
                    "{baseAddress}"에서 어디로 옮기나요?
                  </p>
                </div>

                {/* 이전할 주소 검색 */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    이전할 주소 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={relocationAddress}
                      placeholder="주소 검색 버튼을 눌러주세요"
                      readOnly
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      onClick={() => handleSearchAddress('relocation')}
                      className="gap-2"
                    >
                      <MapPin className="h-4 w-4" />
                      주소 검색
                    </Button>
                  </div>
                </div>

                {/* 이전할 상세 주소 (선택) */}
                {relocationAddress && (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      상세 주소 (선택)
                    </label>
                    <Input
                      value={relocationDetailAddress}
                      placeholder="예: 102동 1002호"
                      onChange={(e) => setRelocationDetailAddress(e.target.value)}
                    />
                  </div>
                )}

                <p className="text-xs text-blue-600">
                  💡 TIP: 다른 작업(신규설치/철거)은 "{baseAddress}"에서 진행됩니다
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Step 4: 최종 확인 */}
      {currentStep === 4 && (
        <div className="space-y-5">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">✅ 최종 확인</h2>
            <p className="text-gray-600">입력한 내용을 확인하고 제출해주세요</p>
          </div>

          {/* 문서 정보 */}
          <Card className="border-purple-200 bg-purple-50">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-xl">📄</div>
                <h3 className="font-bold text-base">문서 정보</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  문서번호 <span className="text-gray-500 text-xs">(수정 가능)</span>
                </label>
                <Input
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  className="font-mono bg-white"
                  placeholder="예: 구몬 화곡지국-20260129-01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  설치요청일 <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  value={requestedInstallDate}
                  onChange={(e) => setRequestedInstallDate(e.target.value)}
                  className="bg-white"
                />
                <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                  ⚠️ 실제 설치일은 현장 상황에 따라 요청일과 다를 수 있습니다
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 발주처 정보 */}
          <Card className="border-blue-200">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-xl">🏢</div>
                <h3 className="font-bold text-base">발주처 정보</h3>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <p className="text-xs text-gray-600">계열사</p>
                  <p className="font-semibold text-sm">{affiliate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">사업자명</p>
                  <p className="font-semibold text-sm">{businessName}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 담당자 정보 */}
          <Card className="border-green-200">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-xl">👤</div>
                <h3 className="font-bold text-base">담당자</h3>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <p className="text-xs text-gray-600">성함</p>
                  <p className="font-semibold text-sm">{contactName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">연락처</p>
                  <p className="font-semibold text-sm">{contactPhone}</p>
                </div>
              </div>

              {buildingManagerPhone && (
                <div className="pt-2 border-t border-gray-200">
                  <p className="text-xs text-gray-600">건물관리인</p>
                  <p className="font-semibold text-sm">{buildingManagerPhone}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 작업 장소 */}
          <Card className="border-orange-200">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-5 w-5 text-orange-600" />
                <h3 className="font-bold text-base">작업 장소</h3>
              </div>

              <div>
                <p className="text-xs text-gray-600 mb-1">기본 작업 장소</p>
                <p className="font-semibold text-sm leading-relaxed">
                  {baseDetailAddress ? `${baseAddress}, ${baseDetailAddress}` : baseAddress}
                </p>
              </div>

              {isRelocation && (
                <div className="pt-2 border-t border-orange-200">
                  <p className="text-xs text-gray-600 mb-1">이전 목적지 (이전설치만)</p>
                  <p className="font-semibold text-sm text-blue-600 leading-relaxed">
                    → {relocationDetailAddress ? `${relocationAddress}, ${relocationDetailAddress}` : relocationAddress}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 작업 내역 */}
          <Card className="border-indigo-200">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-xl">📦</div>
                <h3 className="font-bold text-base">작업 내역</h3>
              </div>

              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                    <Badge variant="outline" className="font-mono">
                      {index + 1}
                    </Badge>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">
                        {item.workType} · {item.category}
                      </p>
                      <p className="text-xs text-gray-600">
                        {item.model && `${item.model} · `}
                        {item.size && `${item.size} · `}
                        {item.quantity}대
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 설치기사님 전달사항 */}
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-xl">💬</div>
                <h3 className="font-bold text-base">설치기사님께 전달사항</h3>
              </div>

              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="예: 주말 시공 요청, 층고 3.5m, 사다리차 필요, 오전 10시 이후 작업 가능 등..."
                rows={4}
                className="bg-white resize-none"
              />
              <p className="text-xs text-gray-500">
                💡 특이사항이나 기사님께 꼭 전달해야 할 내용을 자유롭게 작성해주세요
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 네비게이션 버튼 */}
      <div className="flex justify-between gap-4">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            취소
          </Button>
          {currentStep > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={handlePrev}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              이전
            </Button>
          )}
        </div>

        {currentStep < 4 ? (
          <Button onClick={handleNext} className="gap-2">
            다음
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? '저장 중...' : submitLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
