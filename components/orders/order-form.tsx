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

import { useState, useEffect, useMemo } from 'react'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, X, ChevronLeft, ChevronRight, MapPin, BookOpen, Briefcase, Building2, GraduationCap, ClipboardList, Package, User, FileText, MessageSquare, AlertTriangle, Lightbulb, Info, Truck, CalendarDays, Search } from 'lucide-react'
import {
  AFFILIATE_OPTIONS,
  CATEGORY_OPTIONS,
  WORK_TYPE_OPTIONS,
  EQUIPMENT_UNIT_TYPE_LABELS,
  EQUIPMENT_UNIT_TYPE_COLORS,
  type OrderItem,
  type StoredEquipment,
  type EquipmentUnitType,
  parseAddress
} from '@/types/order'
// import { PriceTableSheet } from '@/components/orders/price-table-dialog'

import { useAlert } from '@/components/ui/custom-alert'

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
  isPreliminaryQuote?: boolean  // 사전견적 요청 여부
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
  storedEquipment?: StoredEquipment[]
}

/**
 * 빈 OrderItem 생성
 */
function createEmptyItem(): OrderItem {
  return {
    id: `temp-${Date.now()}`,
    workType: '신규설치',
    category: '스탠드에어컨',
    model: '',
    size: '',
    quantity: 1
  }
}

/**
 * 다음 우편번호 서비스 타입 선언
 */
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  isSubmitting = false,
  storedEquipment = []
}: OrderFormProps) {
  const { showAlert } = useAlert()

  // 스텝 관리 (1~4)
  const [currentStep, setCurrentStep] = useState(1)

  // 폼 데이터 상태
  const [affiliate, setAffiliate] = useState(initialData?.affiliate || '')
  const [isPreliminaryQuote, setIsPreliminaryQuote] = useState(
    initialData?.isPreliminaryQuote || false
  )
  const [items, setItems] = useState<OrderItem[]>(initialData?.items || [createEmptyItem()])
  const [baseAddress, setBaseAddress] = useState('') // 기본 작업 장소 (Step 2)
  const [baseDetailAddress, setBaseDetailAddress] = useState('') // 기본 상세주소
  const [relocationAddress, setRelocationAddress] = useState('') // 이전 목적지 (Step 3, 조건부)
  const [relocationDetailAddress, setRelocationDetailAddress] = useState('') // 이전 목적지 상세주소
  const [isInBuildingMove, setIsInBuildingMove] = useState(false) // 건물 내 이동 여부
  const [businessName, setBusinessName] = useState(initialData?.businessName || '')
  const [contactName, setContactName] = useState('') // 담당자 성함
  const [contactPhone, setContactPhone] = useState('') // 담당자 연락처
  const [buildingManagerPhone, setBuildingManagerPhone] = useState('') // 건물관리인 연락처 (선택)
  const [documentNumber, setDocumentNumber] = useState('') // 문서번호 (자동 생성, 수정 가능)
  const [orderDate, setOrderDate] = useState(initialData?.orderDate || new Date().toISOString().split('T')[0]) // 발주일 (기본값: 오늘)
  const [requestedInstallDate, setRequestedInstallDate] = useState('') // 설치요청일 (선택)
  const [notes, setNotes] = useState(initialData?.notes || '') // 설치기사님 전달사항

  // 보관 장비 선택 Dialog 상태
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null) // 어느 작업 항목에 장비를 적용할지
  const [equipmentSearch, setEquipmentSearch] = useState('') // 보관 장비 검색어
  const [checkedEquipmentIds, setCheckedEquipmentIds] = useState<Set<string>>(new Set()) // 다중 선택용 체크된 장비 ID

  // 선택 가능한 보관 장비 (이미 발주내역에 연결된 장비 제외)
  const availableEquipment = useMemo(() => {
    const usedIds = items
      .filter(item => item.storedEquipmentId)
      .map(item => item.storedEquipmentId!)
    return storedEquipment.filter(
      e => e.status === 'stored' && !usedIds.includes(e.id)
    )
  }, [items, storedEquipment])

  // 검색 필터링된 장비 목록
  const filteredEquipment = useMemo(() => {
    if (!equipmentSearch.trim()) return availableEquipment
    const keyword = equipmentSearch.trim().toLowerCase()
    return availableEquipment.filter(e =>
      (e.siteName && e.siteName.toLowerCase().includes(keyword)) ||
      (e.model && e.model.toLowerCase().includes(keyword)) ||
      (e.affiliate && e.affiliate.toLowerCase().includes(keyword)) ||
      (e.address && e.address.toLowerCase().includes(keyword))
    )
  }, [availableEquipment, equipmentSearch])

  // 현장별 그룹핑 (siteName + warehouseId 기준)
  const equipmentGroups = useMemo(() => {
    const typeOrder: Record<string, number> = { indoor: 0, outdoor: 1, set: 2, etc: 3 }
    const groupMap = new Map<string, StoredEquipment[]>()

    for (const item of filteredEquipment) {
      const key = `${item.siteName}__${item.warehouseId || ''}`
      const arr = groupMap.get(key) || []
      arr.push(item)
      groupMap.set(key, arr)
    }

    // 그룹 내부: 실내기→실외기 순서 정렬
    const groups: { key: string; siteName: string; items: StoredEquipment[] }[] = []
    for (const [key, groupItems] of Array.from(groupMap)) {
      groupItems.sort((a, b) =>
        (typeOrder[a.equipmentUnitType || ''] ?? 9) - (typeOrder[b.equipmentUnitType || ''] ?? 9)
      )
      groups.push({ key, siteName: groupItems[0].siteName, items: groupItems })
    }

    // 그룹 간: 현장명 가나다 순
    groups.sort((a, b) => a.siteName.localeCompare(b.siteName))
    return groups
  }, [filteredEquipment])

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
   * initialData가 있으면 모든 필드 복원 (수정 모드)
   */
  useEffect(() => {
    if (initialData) {
      // 기존 데이터 복원
      setAffiliate(initialData.affiliate || '')
      setIsPreliminaryQuote(initialData.isPreliminaryQuote || false)
      setItems(initialData.items || [createEmptyItem()])
      setBusinessName(initialData.businessName || '')
      setContactName(initialData.contactName || '')
      setContactPhone(initialData.contactPhone || '')
      setBuildingManagerPhone(initialData.buildingManagerPhone || '')
      setDocumentNumber(initialData.documentNumber || '')
      setOrderDate(initialData.orderDate || new Date().toISOString().split('T')[0])
      setRequestedInstallDate(initialData.requestedInstallDate || '')
      setNotes(initialData.notes || '')

      // 주소 파싱 (OrderForm이 생성한 주소를 다시 개별 필드로 분리)
      if (initialData.address) {
        const parsed = parseAddress(initialData.address)
        setBaseAddress(parsed.baseAddress)
        setBaseDetailAddress(parsed.baseDetailAddress || '')
        if (parsed.isRelocation) {
          setRelocationAddress(parsed.relocationAddress || '')
          setRelocationDetailAddress(parsed.relocationDetailAddress || '')
        }
      }
    }
  }, [initialData])

  /**
   * 주소 검색 팝업 열기
   */
  const handleSearchAddress = (type: 'base' | 'relocation') => {
    if (!window.daum) {
      showAlert('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.', 'info')
      return
    }

    new window.daum.Postcode({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      oncomplete: function(data: any) {
        // 도로명 주소 (순수 주소만)
        const roadAddr = data.roadAddress || data.jibunAddress

        if (type === 'base') {
          setBaseAddress(roadAddr)
          setBaseDetailAddress('')
        } else {
          setRelocationAddress(roadAddr)
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
      showAlert('최소 1개의 발주내역은 있어야 합니다', 'warning')
      return
    }
    setItems(items.filter(item => item.id !== itemId))
  }

  /**
   * 발주내역 항목 수정
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleItemChange = (itemId: string, field: keyof OrderItem, value: any) => {
    setItems(items.map(item =>
      item.id === itemId ? { ...item, [field]: value } : item
    ))
  }

  /**
   * 보관 장비 선택 Dialog 열기
   */
  const handleOpenEquipmentDialog = (itemId: string) => {
    setSelectedItemId(itemId)
    setEquipmentSearch('') // 검색어 초기화
    setCheckedEquipmentIds(new Set()) // 체크 초기화
    setEquipmentDialogOpen(true)
  }

  /**
   * 장비 체크박스 토글 (다중 선택용)
   */
  const handleToggleEquipment = (equipmentId: string) => {
    setCheckedEquipmentIds(prev => {
      const next = new Set(prev)
      if (next.has(equipmentId)) {
        next.delete(equipmentId)
      } else {
        next.add(equipmentId)
      }
      return next
    })
  }

  /**
   * 선택 확정 — 체크된 장비들을 발주내역에 추가
   * 첫 번째 장비: 현재 선택된 항목(selectedItemId)에 채움
   * 나머지 장비: 새 OrderItem 행을 자동 생성
   */
  const handleConfirmEquipmentSelection = () => {
    if (checkedEquipmentIds.size === 0) {
      showAlert('장비를 1개 이상 선택해주세요', 'warning')
      return
    }

    // 체크된 장비 목록 (실내기→실외기 순서로 정렬)
    const typeOrder: Record<string, number> = { indoor: 0, outdoor: 1, set: 2, etc: 3 }
    const selected = availableEquipment
      .filter(e => checkedEquipmentIds.has(e.id))
      .sort((a, b) =>
        (typeOrder[a.equipmentUnitType || ''] ?? 9) - (typeOrder[b.equipmentUnitType || ''] ?? 9)
      )

    // 첫 번째 장비 → 현재 항목에 채움, 나머지 → 새 행 생성
    const [firstEquip, ...restEquip] = selected

    const updatedItems = items.map(item => {
      if (item.id === selectedItemId) {
        return {
          ...item,
          category: firstEquip.category,
          model: firstEquip.model || '',
          size: firstEquip.size || '',
          quantity: firstEquip.quantity,
          storedEquipmentId: firstEquip.id,
        }
      }
      return item
    })

    // 나머지 장비는 새 OrderItem 행으로 추가
    const additionalItems = restEquip.map(equip => ({
      id: `temp-${Date.now()}-${equip.id}`,
      workType: '재고설치' as const,
      category: equip.category,
      model: equip.model || '',
      size: equip.size || '',
      quantity: equip.quantity,
      storedEquipmentId: equip.id,
    }))

    const newItems = [...updatedItems, ...additionalItems]

    setItems(newItems)
    setEquipmentDialogOpen(false)
    showAlert(`${selected.length}개 장비가 발주내역에 추가되었습니다`, 'success')
  }


  /**
   * 이전설치 여부 확인
   */
  const isRelocation = items.some(item => item.workType === '이전설치')

  /**
   * 다음 스텝으로 이동
   */
  const handleNext = () => {
    // Step 1: 계열사 선택
    if (currentStep === 1 && !affiliate) {
      showAlert('계열사를 선택해주세요', 'warning')
      return
    }

    // Step 2: 장소 + 담당자
    if (currentStep === 2) {
      // 기존 검증 로직 유지
      if (!baseAddress) {
        showAlert('작업 장소를 검색해주세요', 'warning')
        return
      }
      if (!businessName) {
        showAlert('사업자명을 입력해주세요', 'warning')
        return
      }
      if (!contactName) {
        showAlert('담당자 성함을 입력해주세요', 'warning')
        return
      }
      if (!contactPhone) {
        showAlert('담당자 연락처를 입력해주세요', 'warning')
        return
      }

      // (사전견적도 일반 발주와 동일하게 4단계 진행)
    }

    // Step 3: 작업 내역
    if (currentStep === 3) {
      // 사전견적이 아닐 때만 수량 검증
      if (!isPreliminaryQuote) {
        const hasEmptyQuantity = items.some(item => !item.quantity || item.quantity < 1)
        if (hasEmptyQuantity) {
          showAlert('수량을 입력해주세요', 'warning')
          return
        }
      }

      if (isRelocation && !isInBuildingMove && !relocationAddress) {
        showAlert('이전할 주소를 검색해주세요', 'warning')
        return
      }

      // 문서번호 자동 생성
      const today = new Date().toISOString().split('T')[0]
      const dateStr = today.replace(/-/g, '')
      const autoDocNumber = `${businessName}-${dateStr}-01`
      setDocumentNumber(autoDocNumber)
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
      showAlert('문서번호를 입력해주세요', 'warning')
      return
    }

    // 🔥 사전견적이 아닐 때만 items 검증
    if (!isPreliminaryQuote && items.length === 0) {
      showAlert('최소 1개의 작업 내역이 필요합니다', 'warning')
      return
    }

    // 주소 생성
    let finalAddress = ''
    if (isRelocation) {
      const baseFull = baseDetailAddress ? `${baseAddress}, ${baseDetailAddress}` : baseAddress
      if (isInBuildingMove) {
        // 건물 내 이동: 같은 주소 + 이동할 층/호실
        const moveTo = relocationDetailAddress ? relocationDetailAddress : ''
        finalAddress = `작업장소: ${baseFull} / 건물내이동: ${moveTo || '상세 미입력'}`
      } else {
        // 다른 건물로 이전
        const relocationFull = relocationDetailAddress
          ? `${relocationAddress}, ${relocationDetailAddress}`
          : relocationAddress
        finalAddress = `작업장소: ${baseFull} / 이전목적지: ${relocationFull}`
      }
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
      items,  // 사전견적일 때는 빈 배열
      notes,
      isPreliminaryQuote
    }

    onSubmit(formData)
  }

  /**
   * 진행률 계산
   */
  // 전체 스텝 수 (항상 4단계)
  const totalSteps = 4
  const progress = (currentStep / totalSteps) * 100

  return (
    <div className="space-y-6">
      {/* 진행률 표시 */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Step {currentStep} / {totalSteps}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5">
          <div
            className="bg-primary h-1.5 rounded-full transition-all duration-300"
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
                  <div className="flex justify-center mb-2 text-primary">
                    {option === '구몬' && <BookOpen className="h-10 w-10" />}
                    {option === 'Wells 영업' && <Briefcase className="h-10 w-10" />}
                    {option === 'Wells 서비스' && <Building2 className="h-10 w-10" />}
                    {option === '교육플랫폼' && <GraduationCap className="h-10 w-10" />}
                    {option === '기타' && <ClipboardList className="h-10 w-10" />}
                  </div>
                  <h3 className="font-bold text-lg">{option}</h3>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 발주일 (오늘 날짜 기본, 수정 가능) */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-base">발주일</h3>
              </div>
              <Input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="max-w-xs"
              />
              <p className="text-xs text-gray-500 mt-1">
                오늘 날짜가 기본으로 들어갑니다. 필요하면 수정하세요.
              </p>
            </CardContent>
          </Card>

          {/* 사전견적 요청 체크박스 */}
          <Card className="border-blue-300 bg-blue-50/50">
            <CardContent className="p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPreliminaryQuote}
                  onChange={(e) => setIsPreliminaryQuote(e.target.checked)}
                  className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                />
                <div>
                  <p className="font-semibold text-base">사전 견적 신청 (대량 설치/천장형/환경 복잡 대상)</p>
                  <p className="text-sm text-gray-600 mt-1">
                    일반 발주 건도 기사님이 방문하여 추가 비용 여부를 상세히 안내해 드립니다.
                  </p>
                </div>
              </label>
            </CardContent>
          </Card>
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
                  다음 우편번호 서비스로 정확한 주소를 검색하세요
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
                    건물명, 동/호수 등을 입력하세요
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
                <p className="text-xs text-gray-500 mt-1">
                  계열사+지국명으로 적어주세요 ex) 구몬 xx지국, Wells영업 xxxx
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 담당자 정보 섹션 */}
          <Card className="border-blue-200">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-5 w-5 text-blue-600" />
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
                  건물 소장이나 관리인과 연락해야 한다면 입력하세요
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 설치요청일 섹션 */}
          <Card className="border-orange-200">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="h-5 w-5 text-orange-600" />
                <h3 className="font-bold text-lg">설치요청일</h3>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  희망 설치일 <span className="text-gray-500 text-xs">(선택)</span>
                </label>
                <Input
                  type="date"
                  value={requestedInstallDate}
                  onChange={(e) => setRequestedInstallDate(e.target.value)}
                  className="max-w-xs"
                />
              </div>

              {/* 안내 문구 */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-orange-700">
                  설치 일정은 장비 입고 상황 및 현장 여건에 따라 변동될 수 있습니다.
                  확정된 설치일은 담당자에게 별도 안내드립니다.
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
            <h2 className="text-2xl font-bold mb-2">어떤 작업인가요?</h2>
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

              // 철거 작업 여부 (모델명 선택사항)
              const isRemovalWork = item.workType === '철거보관' || item.workType === '철거폐기'
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

                    <div className="space-y-4">
                      {/* 작업종류 + 품목 + 모델명 + 수량 (한 줄) */}
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            작업종류 <span className="text-red-500">*</span>
                          </label>
                          <Select
                            value={item.workType}
                            onValueChange={(value: string) =>
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

                          {/* 재고설치 선택 시: 보관 장비 선택 버튼 */}
                          {item.workType === '재고설치' && (
                            <div className="mt-3">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="w-full gap-2 text-blue-600 border-blue-300 hover:bg-blue-50"
                                onClick={() => handleOpenEquipmentDialog(item.id!)}
                              >
                                <Package className="h-4 w-4" />
                                보관 장비 선택 ({availableEquipment.length}개)
                              </Button>
                            </div>
                          )}
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

                        <div>
                          <label className="block text-sm font-medium mb-2">
                            모델명 {isRemovalWork && <span className="text-gray-500 text-xs">(선택)</span>}
                          </label>
                          <Input
                            placeholder={isRemovalWork ? "미확인" : "예: 냉난방 40평"}
                            value={item.model}
                            onChange={(e) =>
                              handleItemChange(item.id!, 'model', e.target.value)
                            }
                            className="bg-white"
                          />
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

                      {/* 재고설치: 선택된 보관 장비 정보 카드 (전체 너비) */}
                      {item.workType === '재고설치' && item.storedEquipmentId && (() => {
                        const eq = storedEquipment.find(e => e.id === item.storedEquipmentId)
                        if (!eq) return null
                        const unitType = eq.equipmentUnitType as EquipmentUnitType | undefined
                        const unitLabel = unitType ? EQUIPMENT_UNIT_TYPE_LABELS[unitType] : null
                        return (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* 실내기/실외기 표시 (빨간 글씨) */}
                              {unitLabel && (
                                <span className="text-red-600 font-bold text-sm">
                                  [{unitLabel}]
                                </span>
                              )}
                              <span className="font-bold text-blue-900 text-sm">
                                {eq.affiliate && !eq.siteName.startsWith(eq.affiliate) ? `${eq.affiliate} · ` : ''}{eq.siteName} 철거 장비
                              </span>
                            </div>
                            {eq.address && (
                              <p className="text-sm text-blue-700">{eq.address}</p>
                            )}
                            <div className="flex gap-4 text-sm text-blue-600 flex-wrap">
                              {eq.removalDate && <span>철거일: {eq.removalDate.replace(/-/g, '.')}</span>}
                              {eq.manufacturer && <span>제조사: {eq.manufacturer}</span>}
                              {eq.manufacturingDate && <span>{eq.manufacturingDate}년식</span>}
                              {eq.size && <span>평형: {eq.size}</span>}
                            </div>
                          </div>
                        )
                      })()}

                      {/* 안내문구 */}
                      {isRemovalWork ? (
                        <p className="text-xs text-muted-foreground bg-white p-2 rounded border border-border/60 flex items-start gap-1.5">
                          <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          철거 작업의 경우 모델명을 모르면 빈칸으로 두세요
                        </p>
                      ) : item.workType !== '재고설치' && (
                        <p className="text-xs text-muted-foreground bg-white p-2 rounded border border-border/60 flex items-start gap-1.5">
                          <Lightbulb className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          모델명에 냉난방/냉방 + 평형을 같이 적어주세요 (예: 냉난방 40평)
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
                    <Truck className="h-5 w-5 text-blue-600" /> 이전설치 목적지
                  </h3>
                  <p className="text-sm text-gray-600">
                    &quot;{baseAddress}&quot;에서 어디로 옮기나요?
                  </p>
                </div>

                {/* 건물 내 이동 체크박스 */}
                <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-blue-200 bg-white">
                  <input
                    type="checkbox"
                    checked={isInBuildingMove}
                    onChange={(e) => {
                      setIsInBuildingMove(e.target.checked)
                      if (e.target.checked) {
                        // 건물 내 이동이면 주소를 같은 건물로 설정
                        setRelocationAddress(baseAddress)
                        setRelocationDetailAddress('')
                      } else {
                        // 체크 해제 시 주소 초기화
                        setRelocationAddress('')
                        setRelocationDetailAddress('')
                      }
                    }}
                    className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="font-semibold text-sm">같은 건물 내 이동</p>
                    <p className="text-xs text-gray-500">같은 건물 안에서 다른 층/호실로 옮기는 경우</p>
                  </div>
                </label>

                {/* 건물 내 이동이면 → 상세주소(층/호실)만 입력 */}
                {isInBuildingMove ? (
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      이동할 층/호실
                    </label>
                    <Input
                      value={relocationDetailAddress}
                      placeholder="예: 3층 302호"
                      onChange={(e) => setRelocationDetailAddress(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      같은 건물 내 어디로 옮기는지 적어주세요
                    </p>
                  </div>
                ) : (
                  <>
                    {/* 다른 건물로 이동 → 주소 검색 */}
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
                  </>
                )}

                <p className="text-xs text-blue-600">
                  TIP: 다른 작업(신규설치/철거)은 &quot;{baseAddress}&quot;에서 진행됩니다
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
            <h2 className="text-2xl font-bold mb-2">최종 확인</h2>
            <p className="text-gray-600">입력한 내용을 확인하고 제출해주세요</p>
          </div>

          {/* 문서 정보 */}
          <Card className="border-purple-200 bg-purple-50">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5 text-violet-600" />
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

              <div className="grid grid-cols-2 gap-x-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    발주일
                  </label>
                  <p className="font-semibold text-sm">{orderDate ? orderDate.replace(/-/g, '.') : '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    설치요청일
                  </label>
                  <p className="font-semibold text-sm">{requestedInstallDate ? requestedInstallDate.replace(/-/g, '.') : '-'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 발주처 정보 */}
          <Card className="border-blue-200">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-5 w-5 text-blue-600" />
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
                <User className="h-5 w-5 text-emerald-600" />
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
                <Package className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-base">작업 내역</h3>
              </div>

              {isPreliminaryQuote && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-2">
                  <p className="text-sm font-semibold text-yellow-800 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    사전견적 요청건 (현장 확인 후 장비 변경 가능)
                  </p>
                </div>
              )}
              <div className="space-y-2">
                {items.length > 0 ? items.map((item, index) => {
                  // 재고설치인 경우 원본 보관 장비 정보 조회
                  const linkedEquip = item.storedEquipmentId
                    ? storedEquipment.find(e => e.id === item.storedEquipmentId)
                    : null

                  return (
                    <div key={item.id} className="p-2.5 bg-gray-50 rounded space-y-1">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono">
                          {index + 1}
                        </Badge>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">
                            {item.workType} · {item.category}
                          </p>
                          <p className="text-xs text-gray-600">
                            {item.model && `${item.model} · `}
                            {item.quantity}대
                          </p>
                        </div>
                      </div>
                      {/* 재고설치: 철거 현장 + 제조년월 정보 */}
                      {linkedEquip && (
                        <div className="ml-10 text-xs text-blue-600 bg-blue-50 rounded px-2 py-1.5">
                          <span className="font-medium">
                            {linkedEquip.affiliate && !linkedEquip.siteName.startsWith(linkedEquip.affiliate) ? `${linkedEquip.affiliate} · ` : ''}{linkedEquip.siteName} 철거 장비
                          </span>
                          <span className="text-blue-400 ml-2">
                            {linkedEquip.removalDate && `철거 ${linkedEquip.removalDate.replace(/-/g, '.')}`}
                            {linkedEquip.manufacturingDate && ` · ${linkedEquip.manufacturingDate}년식`}
                            {linkedEquip.manufacturer && ` · ${linkedEquip.manufacturer}`}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                }) : (
                  <p className="text-sm text-gray-400 text-center py-2">작업 내역 없음</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 설치기사님 전달사항 */}
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-5 w-5 text-amber-600" />
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
                특이사항이나 기사님께 꼭 전달해야 할 내용을 자유롭게 작성해주세요
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

      {/* 보관 장비 선택 Dialog — 검색 + 현장별 그룹핑 + 다중 선택 */}
      <Dialog open={equipmentDialogOpen} onOpenChange={setEquipmentDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>보관 중인 장비 선택</DialogTitle>
          </DialogHeader>

          {/* 안내 문구 */}
          <p className="text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded-md">
            철거 보관중인 실내기 및 실외기를 선택해주세요. 여러 대를 한번에 선택할 수 있습니다.
          </p>

          {/* 검색 입력 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="현장명, 모델명, 계열사로 검색..."
              value={equipmentSearch}
              onChange={(e) => setEquipmentSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* 장비 목록 (스크롤 영역) */}
          <div className="flex-1 overflow-y-auto space-y-4 py-2 min-h-0">
            {availableEquipment.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                선택 가능한 보관 장비가 없습니다.
              </p>
            ) : equipmentGroups.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                &quot;{equipmentSearch}&quot; 검색 결과가 없습니다.
              </p>
            ) : (
              equipmentGroups.map((group) => {
                const first = group.items[0]
                const totalQty = group.items.reduce((sum, e) => sum + e.quantity, 0)
                // 그룹 내 전체 선택 여부
                const allChecked = group.items.every(e => checkedEquipmentIds.has(e.id))
                const someChecked = group.items.some(e => checkedEquipmentIds.has(e.id))

                return (
                  <div
                    key={group.key}
                    className="rounded-lg border border-gray-200 overflow-hidden"
                  >
                    {/* 현장 헤더 */}
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* 그룹 전체 선택 체크박스 */}
                            <button
                              type="button"
                              className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
                                allChecked
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : someChecked
                                    ? 'bg-blue-200 border-blue-400'
                                    : 'border-gray-300 hover:border-blue-400'
                              }`}
                              onClick={() => {
                                setCheckedEquipmentIds(prev => {
                                  const next = new Set(prev)
                                  if (allChecked) {
                                    // 전체 해제
                                    group.items.forEach(e => next.delete(e.id))
                                  } else {
                                    // 전체 선택
                                    group.items.forEach(e => next.add(e.id))
                                  }
                                  return next
                                })
                              }}
                            >
                              {allChecked && <span className="text-[10px] font-bold">✓</span>}
                              {someChecked && !allChecked && <span className="text-[8px] text-blue-600 font-bold">—</span>}
                            </button>
                            <MapPin className="h-4 w-4 text-gray-500 shrink-0" />
                            {first.affiliate && (
                              <Badge variant="outline" className="text-xs shrink-0">
                                {first.affiliate}
                              </Badge>
                            )}
                            <span className="font-semibold text-gray-900 truncate">
                              {first.siteName}
                            </span>
                          </div>
                          {first.address && (
                            <p className="text-xs text-gray-500 mt-1 ml-10 truncate">
                              {first.address}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 ml-10 flex-wrap">
                            {first.removalDate && (
                              <span>철거일: {first.removalDate.replace(/-/g, '.')}</span>
                            )}
                          </div>
                        </div>
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          {totalQty}대
                        </Badge>
                      </div>
                    </div>

                    {/* 그룹 내 장비 리스트 */}
                    <div className="divide-y divide-gray-100">
                      {group.items.map((equipment) => {
                        const unitType = equipment.equipmentUnitType as EquipmentUnitType | undefined
                        const unitLabel = unitType ? EQUIPMENT_UNIT_TYPE_LABELS[unitType] : null
                        const unitColor = unitType ? EQUIPMENT_UNIT_TYPE_COLORS[unitType] : ''
                        const isChecked = checkedEquipmentIds.has(equipment.id)

                        return (
                          <button
                            type="button"
                            key={equipment.id}
                            className={`w-full flex items-start gap-3 px-4 py-3 transition-colors text-left ${
                              isChecked ? 'bg-blue-50' : 'hover:bg-gray-50'
                            }`}
                            onClick={() => handleToggleEquipment(equipment.id)}
                          >
                            {/* 체크박스 */}
                            <div className={`w-4 h-4 mt-0.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                              isChecked
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-gray-300'
                            }`}>
                              {isChecked && <span className="text-[10px] font-bold">✓</span>}
                            </div>

                            <div className="flex-1 min-w-0">
                              {/* 1줄: 장비유형 + 모델명 + 평형 + 수량 */}
                              <div className="flex items-center gap-2 flex-wrap">
                                {unitLabel ? (
                                  <Badge className={`${unitColor} text-xs shrink-0 border`}>
                                    {unitLabel}
                                  </Badge>
                                ) : (
                                  <Badge className="bg-blue-50 text-blue-700 text-xs shrink-0">
                                    {equipment.category}
                                  </Badge>
                                )}
                                <span className="text-sm text-gray-700 truncate">
                                  {equipment.model || '모델명 미입력'}
                                </span>
                                {equipment.size && (
                                  <span className="text-xs text-gray-500 shrink-0">
                                    {equipment.size}
                                  </span>
                                )}
                                <span className="text-xs text-gray-400 shrink-0">
                                  {equipment.quantity}대
                                </span>
                              </div>
                              {/* 2줄: 제조사 + 제조년월 */}
                              {(equipment.manufacturer || equipment.manufacturingDate) && (
                                <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                                  {equipment.manufacturer && (
                                    <span>제조사: {equipment.manufacturer}</span>
                                  )}
                                  {equipment.manufacturingDate && (
                                    <span>{equipment.manufacturingDate}년식</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* 하단: 선택 현황 + 확인 버튼 */}
          <div className="flex items-center justify-between pt-3 border-t">
            <span className="text-sm text-gray-500">
              {checkedEquipmentIds.size > 0
                ? `${checkedEquipmentIds.size}개 장비 선택됨`
                : `총 ${availableEquipment.length}대 보관중`}
              {equipmentSearch && ` · 검색 결과 ${filteredEquipment.length}대`}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEquipmentDialogOpen(false)}
              >
                취소
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={checkedEquipmentIds.size === 0}
                onClick={handleConfirmEquipmentSelection}
              >
                {checkedEquipmentIds.size > 0
                  ? `${checkedEquipmentIds.size}개 장비 추가`
                  : '장비 추가'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
