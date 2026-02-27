/**
 * 발주 등록 폼 컴포넌트 (2단계 구조)
 *
 * Step 1: 정보 입력 (플랫 단일 스크롤 폼 — 카드 없이 구분선으로 섹션 분리)
 * Step 2: 영수증형 최종 확인
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
import { Separator } from '@/components/ui/separator'
import { Plus, X, ChevronLeft, ChevronRight, MapPin, FileText, Info, Search, Building2, Users, ClipboardList, MessageSquare, Calendar, ArrowDown } from 'lucide-react'
import {
  AFFILIATE_OPTIONS,
  CATEGORY_OPTIONS,
  WORK_TYPE_OPTIONS,
  EQUIPMENT_UNIT_TYPE_LABELS,
  EQUIPMENT_UNIT_TYPE_COLORS,
  type OrderItem,
  type StoredEquipment,
  type EquipmentUnitType,
  type ContactPerson,
  type BuildingManager,
  parseAddress
} from '@/types/order'

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
  contactName: string           // 담당자 성함 (레거시 — 첫 번째 담당자와 동기화)
  contactPhone: string          // 담당자 연락처 (레거시)
  buildingManagerPhone?: string // 건물관리인 연락처 (레거시)
  contacts: ContactPerson[]     // 다중 담당자 배열 (최대 5명)
  buildingManagers: BuildingManager[] // 다중 건물관리인 배열 (최대 5명)
  requestedInstallDate?: string // 설치 희망일
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
  submitLabel = '발주 등록',
  isSubmitting = false,
  storedEquipment = []
}: OrderFormProps) {
  const { showAlert } = useAlert()

  // 스텝 관리 (1~2)
  const [currentStep, setCurrentStep] = useState(1)

  // 폼 데이터 상태
  const [affiliate, setAffiliate] = useState(initialData?.affiliate || '')
  const [isPreliminaryQuote, setIsPreliminaryQuote] = useState(
    initialData?.isPreliminaryQuote || false
  )
  const [items, setItems] = useState<OrderItem[]>(initialData?.items || [createEmptyItem()])
  const [baseAddress, setBaseAddress] = useState('') // 작업 장소
  const [baseDetailAddress, setBaseDetailAddress] = useState('') // 상세주소
  const [relocationAddress, setRelocationAddress] = useState('') // 이전 목적지
  const [relocationDetailAddress, setRelocationDetailAddress] = useState('') // 이전 목적지 상세주소
  const [isInBuildingMove, setIsInBuildingMove] = useState(false) // 건물 내 이동 여부
  const [businessName, setBusinessName] = useState(initialData?.businessName || '')
  // 다중 담당자 배열 (기본 2행)
  const [contacts, setContacts] = useState<ContactPerson[]>([
    { name: '', phone: '', memo: '' },
    { name: '', phone: '', memo: '' }
  ])
  // 다중 건물관리인 배열 (기본 0행 — "+" 버튼으로 추가)
  const [buildingManagers, setBuildingManagers] = useState<BuildingManager[]>([])
  const [documentNumber, setDocumentNumber] = useState('') // 문서번호 (자동 생성, 수정 가능)
  const [orderDate, setOrderDate] = useState(initialData?.orderDate || new Date().toISOString().split('T')[0]) // 발주일 (기본값: 오늘)
  const [requestedInstallDate, setRequestedInstallDate] = useState('') // 설치 희망일 (선택)
  const [notes, setNotes] = useState(initialData?.notes || '') // 설치기사님 전달사항

  // 사전견적 접힘/펼침 상태
  const [showPreliminaryQuote, setShowPreliminaryQuote] = useState(
    initialData?.isPreliminaryQuote || false
  )

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
      setShowPreliminaryQuote(initialData.isPreliminaryQuote || false)
      setItems(initialData.items || [createEmptyItem()])
      setBusinessName(initialData.businessName || '')

      // 다중 담당자 복원: contacts 배열 우선, 없으면 레거시 필드에서 복원
      if (initialData.contacts && initialData.contacts.length > 0) {
        setContacts(initialData.contacts)
      } else if (initialData.contactName || initialData.contactPhone) {
        setContacts([
          { name: initialData.contactName || '', phone: initialData.contactPhone || '', memo: '' },
          { name: '', phone: '', memo: '' }
        ])
      }

      // 다중 건물관리인 복원: buildingManagers 배열 우선, 없으면 레거시 필드에서 복원
      if (initialData.buildingManagers && initialData.buildingManagers.length > 0) {
        setBuildingManagers(initialData.buildingManagers)
      } else if (initialData.buildingManagerPhone) {
        setBuildingManagers([{ name: '', phone: initialData.buildingManagerPhone }])
      }

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
        // 도로명 주소 + 건물명 (있을 경우 괄호로 추가)
        const roadAddr = data.roadAddress || data.jibunAddress
        const building = data.buildingName ? ` (${data.buildingName})` : ''
        const fullAddress = roadAddr + building

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
   * 다음 스텝으로 이동 (Step 1 → Step 2)
   * 모든 검증을 Step 1에서 한 번에 수행
   */
  const handleNext = () => {
    if (currentStep === 1) {
      // 계열사 선택 검증
      if (!affiliate) {
        showAlert('계열사를 선택해주세요', 'warning')
        return
      }
      // 작업 장소 검증
      if (!baseAddress) {
        showAlert('작업 장소를 검색해주세요', 'warning')
        return
      }
      // 사업자명 검증
      if (!businessName) {
        showAlert('사업자명을 입력해주세요', 'warning')
        return
      }
      // 담당자 검증
      if (!contacts[0]?.name) {
        showAlert('첫 번째 담당자 성함을 입력해주세요', 'warning')
        return
      }
      if (!contacts[0]?.phone) {
        showAlert('첫 번째 담당자 연락처를 입력해주세요', 'warning')
        return
      }
      // 수량 검증 (사전견적 제외)
      if (!isPreliminaryQuote) {
        const hasEmptyQuantity = items.some(item => !item.quantity || item.quantity < 1)
        if (hasEmptyQuantity) {
          showAlert('수량을 입력해주세요', 'warning')
          return
        }
      }
      // 이전설치 주소 검증
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

    // 빈 행 제거 (이름도 연락처도 없으면 제거)
    const validContacts = contacts.filter(c => c.name.trim() || c.phone.trim())
    const validManagers = buildingManagers.filter(m => m.name.trim() || m.phone.trim())

    const formData: OrderFormData = {
      documentNumber,
      address: finalAddress,
      orderDate,
      orderNumber: '', // 주문번호는 빈 문자열 (사용 안 함)
      affiliate,
      businessName,
      // 레거시 필드 동기화 (첫 번째 담당자)
      contactName: validContacts[0]?.name || '',
      contactPhone: validContacts[0]?.phone || '',
      buildingManagerPhone: validManagers[0]?.phone || undefined,
      contacts: validContacts,
      buildingManagers: validManagers,
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
  const totalSteps = 2
  const progress = (currentStep / totalSteps) * 100

  return (
    <div className="space-y-6">
      {/* 진행률 표시 */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{currentStep === 1 ? '정보 입력' : '최종 확인'}</span>
          <span>{currentStep} / {totalSteps}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-1">
          <div
            className="bg-primary h-1 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* ============================================================ */}
      {/* Step 1: 정보 입력 — 플랫 단일 스크롤 폼 */}
      {/* ============================================================ */}
      {currentStep === 1 && (
        <div className="space-y-6">

          {/* ── 사전 견적 (접힌 토글, 맨 위) ── */}
          <div>
            <button
              type="button"
              onClick={() => setShowPreliminaryQuote(!showPreliminaryQuote)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showPreliminaryQuote ? 'rotate-90' : ''}`} />
              사전 견적이 필요하신가요?
            </button>
            {showPreliminaryQuote && (
              <div className="mt-2 pl-5">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPreliminaryQuote}
                    onChange={(e) => setIsPreliminaryQuote(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <div>
                    <p className="text-sm font-medium">사전 견적 신청</p>
                    <p className="text-xs text-muted-foreground">
                      대량 설치/천장형/환경 복잡 대상
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* ── 계열사 선택 (알약 버튼) ── */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              계열사 <span className="text-destructive">*</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {AFFILIATE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors
                    ${affiliate === option
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:border-primary/50'}`}
                  onClick={() => setAffiliate(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          {/* ── 발주일 + 설치 희망일 (2열) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />발주일
              </label>
              <Input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />설치 희망일 <span className="text-muted-foreground font-normal">(선택)</span>
              </label>
              <Input
                type="date"
                value={requestedInstallDate}
                onChange={(e) => setRequestedInstallDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                장비 입고 상황에 따라 변동될 수 있습니다
              </p>
            </div>
          </div>

          <div className="border-t border-border/50" />

          {/* ── 사업자명 + 작업장소 (4:6 비율) ── */}
          <div className="grid grid-cols-10 gap-2 items-end">
            {/* 사업자명 (4) */}
            <div className="col-span-4">
              <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />사업자명 <span className="text-destructive">*</span>
              </label>
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="예: 구몬 화곡지국"
              />
            </div>

            {/* 작업장소 (6) */}
            <div className="col-span-6">
              <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />작업 장소 <span className="text-destructive">*</span>
              </label>
              <div className="flex gap-2">
                <Input
                  value={baseAddress}
                  placeholder="주소 검색"
                  readOnly
                  className="flex-1 min-w-0"
                />
                <Button
                  type="button"
                  onClick={() => handleSearchAddress('base')}
                  size="sm"
                  className="shrink-0 h-9 px-2.5"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* 상세주소 (주소 입력 후에만 표시) */}
          {baseAddress && (
            <div>
              <label className="block text-sm font-medium mb-1.5">상세주소</label>
              <Input
                value={baseDetailAddress}
                placeholder="동/호수를 입력해주세요"
                onChange={(e) => setBaseDetailAddress(e.target.value)}
              />
            </div>
          )}

          <div className="border-t border-border/50" />

          {/* ── 담당자 ── */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              담당자
            </p>

            {/* 다중 담당자 입력 */}
            {contacts.map((contact, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground w-4 text-center shrink-0 pt-2.5">
                  {idx + 1}
                </span>
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <Input
                    value={contact.name}
                    onChange={(e) => {
                      const updated = [...contacts]
                      updated[idx] = { ...updated[idx], name: e.target.value }
                      setContacts(updated)
                    }}
                    placeholder={idx === 0 ? "성함 *" : "성함"}
                  />
                  <Input
                    type="tel"
                    value={contact.phone}
                    onChange={(e) => {
                      const updated = [...contacts]
                      updated[idx] = { ...updated[idx], phone: formatPhoneNumber(e.target.value) }
                      setContacts(updated)
                    }}
                    placeholder={idx === 0 ? "연락처 *" : "연락처"}
                    maxLength={13}
                  />
                  <Input
                    value={contact.memo || ''}
                    onChange={(e) => {
                      const updated = [...contacts]
                      updated[idx] = { ...updated[idx], memo: e.target.value }
                      setContacts(updated)
                    }}
                    placeholder="메모"
                    className="col-span-2 sm:col-span-1"
                  />
                </div>
                {contacts.length > 2 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 mt-0.5"
                    onClick={() => setContacts(contacts.filter((_, i) => i !== idx))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <div className="w-8 shrink-0" />
                )}
              </div>
            ))}

            {/* 다중 건물관리인 입력 (담당자와 동일한 3칸 구조) */}
            {buildingManagers.map((manager, idx) => (
              <div key={`bm-${idx}`} className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground w-4 text-center shrink-0 pt-2.5">
                  {contacts.length + idx + 1}
                </span>
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <Input
                    value={manager.name}
                    onChange={(e) => {
                      const updated = [...buildingManagers]
                      updated[idx] = { ...updated[idx], name: e.target.value }
                      setBuildingManagers(updated)
                    }}
                    placeholder="건물관리인"
                  />
                  <Input
                    type="tel"
                    value={manager.phone}
                    onChange={(e) => {
                      const updated = [...buildingManagers]
                      updated[idx] = { ...updated[idx], phone: formatPhoneNumber(e.target.value) }
                      setBuildingManagers(updated)
                    }}
                    placeholder="연락처"
                    maxLength={13}
                  />
                  <Input
                    value={manager.memo || ''}
                    onChange={(e) => {
                      const updated = [...buildingManagers]
                      updated[idx] = { ...updated[idx], memo: e.target.value }
                      setBuildingManagers(updated)
                    }}
                    placeholder="메모"
                    className="col-span-2 sm:col-span-1"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 mt-0.5"
                  onClick={() => setBuildingManagers(buildingManagers.filter((_, i) => i !== idx))}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}

            {/* 추가 버튼들 (나란히) */}
            <div className="flex gap-2 pt-1">
              {contacts.length < 5 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setContacts([...contacts, { name: '', phone: '', memo: '' }])}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  담당자 추가
                </Button>
              )}
              {buildingManagers.length < 5 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setBuildingManagers([...buildingManagers, { name: '건물관리인', phone: '' }])}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  건물관리인 추가
                </Button>
              )}
            </div>
          </div>

          <div className="border-t border-border/50" />

          {/* ── 작업 내역 (인라인 행) ── */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" />
              작업 내역
            </p>

            <div className="rounded-lg border border-border overflow-hidden">
              {/* 열 헤더 */}
              <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 bg-muted/50 border-b border-border text-[11px] font-medium text-muted-foreground">
                <span className="w-5 shrink-0">#</span>
                <span className="w-[110px]">작업종류</span>
                <span className="w-[130px]">품목</span>
                <span className="flex-1 min-w-[120px]">모델</span>
                <span className="w-16">수량</span>
              </div>
              {items.map((item, index) => {
                const isRemovalWork = item.workType === '철거보관' || item.workType === '철거폐기'
                return (
                  <div key={item.id} className="border-b border-border/50 last:border-b-0">
                    {/* 메인 행: 인라인 배치 (모바일에서 flex-wrap으로 자동 줄바꿈) */}
                    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                      <span className="text-xs text-muted-foreground w-5 shrink-0">{index + 1}</span>
                      <Select
                        value={item.workType}
                        onValueChange={(value: string) => handleItemChange(item.id!, 'workType', value)}
                      >
                        <SelectTrigger className="w-[110px] h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WORK_TYPE_OPTIONS.map(option => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={item.category}
                        onValueChange={(value) => handleItemChange(item.id!, 'category', value)}
                      >
                        <SelectTrigger className="w-[130px] h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORY_OPTIONS.map(option => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder={isRemovalWork ? "모델명이 있으면 입력 (선택)" : "예: 냉난방 40평 삼성"}
                        value={item.model}
                        onChange={(e) => handleItemChange(item.id!, 'model', e.target.value)}
                        className="flex-1 min-w-[120px] h-9"
                      />
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.id!, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-16 h-9"
                      />
                      {items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => handleRemoveItem(item.id!)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {/* 재고설치: 보관 장비 선택 링크 */}
                    {item.workType === '재고설치' && !item.storedEquipmentId && (
                      <div className="px-3 pb-2.5 pl-10">
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => handleOpenEquipmentDialog(item.id!)}
                        >
                          보관 장비 선택 ({availableEquipment.length}개)
                        </button>
                      </div>
                    )}

                    {/* 재고설치: 선택된 보관 장비 정보 (compact 1줄) */}
                    {item.workType === '재고설치' && item.storedEquipmentId && (() => {
                      const eq = storedEquipment.find(e => e.id === item.storedEquipmentId)
                      if (!eq) return null
                      const unitType = eq.equipmentUnitType as EquipmentUnitType | undefined
                      const unitLabel = unitType ? EQUIPMENT_UNIT_TYPE_LABELS[unitType] : null
                      return (
                        <div className="px-3 pb-2.5 pl-10 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          {unitLabel && <span className="font-medium text-destructive">[{unitLabel}]</span>}
                          <span>
                            {eq.affiliate && !eq.siteName.startsWith(eq.affiliate) ? `${eq.affiliate} · ` : ''}{eq.siteName} 철거 장비
                          </span>
                          {eq.removalDate && <span>· 철거 {eq.removalDate.replace(/-/g, '.')}</span>}
                          <button
                            type="button"
                            className="text-primary hover:underline"
                            onClick={() => handleOpenEquipmentDialog(item.id!)}
                          >
                            변경
                          </button>
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAddItem}
              className="text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              작업 추가
            </Button>
          </div>

          {/* ── 이전설치 목적지 (작업 내역 바로 아래, 이전설치 작업이 있을 때만) ── */}
          {isRelocation && (
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center gap-1.5">
                <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-sm font-medium">이전설치 목적지</p>
              </div>

              {/* 건물 내 이동 체크박스 */}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isInBuildingMove}
                  onChange={(e) => {
                    setIsInBuildingMove(e.target.checked)
                    if (e.target.checked) {
                      setRelocationAddress(baseAddress)
                      setRelocationDetailAddress('')
                    } else {
                      setRelocationAddress('')
                      setRelocationDetailAddress('')
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm">같은 건물 내 이동</span>
              </label>

              {isInBuildingMove ? (
                <Input
                  value={relocationDetailAddress}
                  placeholder="이동할 층/호실 (예: 3층 302호)"
                  onChange={(e) => setRelocationDetailAddress(e.target.value)}
                />
              ) : (
                <>
                  <div className="flex gap-2">
                    <Input
                      value={relocationAddress}
                      placeholder="주소 검색을 눌러주세요"
                      readOnly
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      onClick={() => handleSearchAddress('relocation')}
                      size="sm"
                      className="shrink-0 h-9"
                    >
                      <Search className="h-4 w-4 mr-1.5" />
                      주소 검색
                    </Button>
                  </div>
                  {relocationAddress && (
                    <div>
                      <label className="block text-sm font-medium mb-1.5">상세주소</label>
                      <Input
                        value={relocationDetailAddress}
                        placeholder="동/호수를 입력해주세요"
                        onChange={(e) => setRelocationDetailAddress(e.target.value)}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="border-t border-border/50" />

          {/* ── 전달사항 ── */}
          <div>
            <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />전달사항
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="현장 특이사항 및 설치기사님께 전달할 내용을 적어주세요"
              rows={3}
              className="resize-none"
            />
          </div>


        </div>
      )}

      {/* ============================================================ */}
      {/* Step 2: 영수증형 최종 확인 */}
      {/* ============================================================ */}
      {currentStep === 2 && (
        <div className="space-y-5">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">발주 접수 확인</h2>
            <p className="text-gray-600">입력한 내용을 확인하고 제출해주세요</p>
          </div>

          {/* 사전견적 배너 */}
          {isPreliminaryQuote && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm font-semibold text-yellow-800 flex items-center gap-2">
                <Info className="h-4 w-4" />
                사전견적 요청건 (현장 확인 후 장비 변경 가능)
              </p>
            </div>
          )}

          {/* 영수증 카드 */}
          <Card className="border-teal-200">
            <CardContent className="p-6">

              {/* 문서번호 */}
              <div className="pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-teal-600" />
                  <h3 className="font-bold text-base">문서번호</h3>
                  <span className="text-gray-500 text-xs">(수정 가능)</span>
                </div>
                <Input
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  className="font-mono"
                  placeholder="예: 구몬 화곡지국-20260129-01"
                />
              </div>

              <Separator />

              {/* 기본 정보 */}
              <div className="py-4">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div>
                    <p className="text-xs text-gray-500">계열사</p>
                    <p className="font-semibold text-sm">{affiliate}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">사업자명</p>
                    <p className="font-semibold text-sm">{businessName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">발주일</p>
                    <p className="font-semibold text-sm">{orderDate ? orderDate.replace(/-/g, '.') : '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">설치 희망일</p>
                    <p className="font-semibold text-sm">{requestedInstallDate ? requestedInstallDate.replace(/-/g, '.') : '-'}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 작업 장소 */}
              <div className="py-4">
                <p className="text-xs text-gray-500 mb-1">작업 장소</p>
                <p className="font-semibold text-sm leading-relaxed">
                  {baseDetailAddress ? `${baseAddress}, ${baseDetailAddress}` : baseAddress}
                </p>
                {isRelocation && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1">이전 목적지</p>
                    <p className="font-semibold text-sm text-teal-600 leading-relaxed">
                      → {isInBuildingMove
                        ? `건물 내 이동${relocationDetailAddress ? ` (${relocationDetailAddress})` : ''}`
                        : relocationDetailAddress
                          ? `${relocationAddress}, ${relocationDetailAddress}`
                          : relocationAddress}
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* 담당자 */}
              <div className="py-4">
                <p className="text-xs text-gray-500 mb-2">담당자</p>
                {contacts.filter(c => c.name || c.phone).map((c, idx) => (
                  <div key={idx} className={`flex items-center gap-3 ${idx > 0 ? 'mt-1.5' : ''}`}>
                    <p className="font-semibold text-sm">{c.name || '-'}</p>
                    <p className="text-sm text-gray-600">{c.phone || '-'}</p>
                    {c.memo && <span className="text-xs text-gray-400">({c.memo})</span>}
                  </div>
                ))}
                {buildingManagers.filter(m => m.name || m.phone).length > 0 && (
                  <div className="mt-3 pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">건물관리인</p>
                    {buildingManagers.filter(m => m.name || m.phone).map((m, idx) => (
                      <p key={idx} className="font-semibold text-sm">
                        {m.name ? `${m.name} ` : ''}{m.phone}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* 작업 내역 */}
              <div className="py-4">
                <p className="text-xs text-gray-500 mb-2">작업 내역</p>
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
                          <div className="ml-10 text-xs text-teal-600 bg-teal-50 rounded px-2 py-1.5">
                            <span className="font-medium">
                              {linkedEquip.affiliate && !linkedEquip.siteName.startsWith(linkedEquip.affiliate) ? `${linkedEquip.affiliate} · ` : ''}{linkedEquip.siteName} 철거 장비
                            </span>
                            <span className="text-teal-400 ml-2">
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
              </div>

              {/* 전달사항 (있을 때만 표시) */}
              {notes && (
                <>
                  <Separator />
                  <div className="pt-4">
                    <p className="text-xs text-gray-500 mb-1">설치기사님께 전달사항</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes}</p>
                  </div>
                </>
              )}

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
              수정하기
            </Button>
          )}
          {/* 수정 모드: Step 1에서 바로 저장 가능 (Step 2까지 안 가도 됨) */}
          {initialData && currentStep === 1 && (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isSubmitting ? '저장 중...' : '수정완료'}
            </Button>
          )}
        </div>

        {currentStep < 2 ? (
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
          <p className="text-sm text-gray-600 bg-teal-50 px-3 py-2 rounded-md">
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
                                  ? 'bg-teal-600 border-teal-600 text-white'
                                  : someChecked
                                    ? 'bg-teal-200 border-teal-400'
                                    : 'border-gray-300 hover:border-teal-400'
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
                              {someChecked && !allChecked && <span className="text-[8px] text-teal-600 font-bold">—</span>}
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
                              isChecked ? 'bg-teal-50' : 'hover:bg-gray-50'
                            }`}
                            onClick={() => handleToggleEquipment(equipment.id)}
                          >
                            {/* 체크박스 */}
                            <div className={`w-4 h-4 mt-0.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                              isChecked
                                ? 'bg-teal-600 border-teal-600 text-white'
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
                                  <Badge className="bg-teal-50 text-teal-700 text-xs shrink-0">
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
