/**
 * AS 상세/관리 다이얼로그
 *
 * 실시간 자동저장 (1초 디바운스)
 *
 * 상태별 다른 UI:
 *   AS접수 — 접수 정보(풀) + 메모만
 *   AS처리중 — 접수 정보(컴팩트) + 방문예정일 + 처리내역 + 비용
 *   정산대기 — 처리 요약 + 비용 확정 + 처리일/정산월
 *   정산완료 — 모든 정보 읽기 전용 (수정 불가)
 */

'use client'

import { useState, useEffect, useRef, useCallback, Fragment } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { ASRequest, ASRequestStatus } from '@/types/as'
import { AS_STATUS_LABELS } from '@/types/as'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AFFILIATE_OPTIONS } from '@/types/order'
import {
  CalendarClock, ArrowRight, Undo2, Trash2, Calendar,
  MapPin, Wrench, CircleDot, Clock, CreditCard, CheckCircle2,
  Check, Loader2, Lock, Phone, Search, Box, Fan,
} from 'lucide-react'

/** Props */
interface ASDetailDialogProps {
  request: ASRequest | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (id: string, updates: Partial<ASRequest>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

/** 상태 변경 버튼 설정 (4단계) */
const STATUS_TRANSITIONS: Record<ASRequestStatus, { next?: ASRequestStatus; prev?: ASRequestStatus }> = {
  'received': { next: 'in-progress' },
  'in-progress': { next: 'completed', prev: 'received' },
  'completed': { next: 'settled', prev: 'in-progress' },
  'settled': { prev: 'completed' },
}

/** 상태별 헤더 배경색 */
const STATUS_HEADER_BG: Record<ASRequestStatus, string> = {
  'received': 'bg-gray-600',
  'in-progress': 'bg-carrot-500',
  'completed': 'bg-teal-600',
  'settled': 'bg-olive-600',
}

/** 상태별 아이콘 */
const STATUS_ICONS: Record<ASRequestStatus, React.ReactNode> = {
  'received': <CircleDot className="h-4 w-4" />,
  'in-progress': <Clock className="h-4 w-4" />,
  'completed': <CreditCard className="h-4 w-4" />,
  'settled': <CheckCircle2 className="h-4 w-4" />,
}

/** 상태변경 버튼 색상 */
const NEXT_STATUS_BUTTON_COLOR: Record<ASRequestStatus, string> = {
  'received': 'bg-carrot-500 hover:bg-carrot-600',
  'in-progress': 'bg-teal-600 hover:bg-teal-700',
  'completed': 'bg-olive-600 hover:bg-olive-700',
  'settled': '',
}

/** 스텝 인디케이터 — 4단계 진행 상태 레이블 */
const STEPS = [
  { label: 'AS접수', status: 'received' as ASRequestStatus },
  { label: '처리중', status: 'in-progress' as ASRequestStatus },
  { label: '정산대기', status: 'completed' as ASRequestStatus },
  { label: '정산완료', status: 'settled' as ASRequestStatus },
]

/** 상태 → 스텝 인덱스 (0~3) */
const STEP_INDEX: Record<ASRequestStatus, number> = {
  'received': 0,
  'in-progress': 1,
  'completed': 2,
  'settled': 3,
}

type SaveStatus = 'idle' | 'saving' | 'saved'

/** 전화번호 자동 하이픈 (010-XXXX-XXXX) */
function formatPhoneNumber(value: string): string {
  const nums = value.replace(/[^0-9]/g, '').slice(0, 11)
  if (nums.length <= 3) return nums
  if (nums.length <= 7) return `${nums.slice(0, 3)}-${nums.slice(3)}`
  return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7)}`
}

/** 금액 포맷 */
function formatAmount(amount?: number): string {
  if (!amount || amount === 0) return '-'
  return `${amount.toLocaleString('ko-KR')}원`
}

/** 정산월 포맷 */
function formatSettlementMonth(month?: string): string {
  if (!month) return '-'
  const parts = month.split('-')
  if (parts.length < 2) return month
  return `${parts[0]}년 ${parseInt(parts[1])}월`
}

export function ASDetailDialog({ request, open, onOpenChange, onUpdate, onDelete }: ASDetailDialogProps) {
  // 접수 정보 편집 상태 (AS접수 상태에서만 수정 가능)
  const [receptionDate, setReceptionDate] = useState('')
  const [affiliate, setAffiliate] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [address, setAddress] = useState('')
  const [detailAddress, setDetailAddress] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [asReason, setAsReason] = useState('')
  const [modelName, setModelName] = useState('')
  const [outdoorUnitLocation, setOutdoorUnitLocation] = useState('')

  // 관리 정보 편집 상태
  const [visitDate, setVisitDate] = useState('')
  const [samsungAsCenter, setSamsungAsCenter] = useState('')
  const [technicianName, setTechnicianName] = useState('')
  const [technicianPhone, setTechnicianPhone] = useState('')
  const [processingDetails, setProcessingDetails] = useState('')
  const [processedDate, setProcessedDate] = useState('')
  const [asCost, setAsCost] = useState(0)
  const [receptionFee, setReceptionFee] = useState(0)
  const [notes, setNotes] = useState('')

  // 자동저장 상태
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isInitializing = useRef(true)

  // 정산월 상태 — 마운트 시점 연/월 고정
  const currentYearRef = useRef(new Date().getFullYear())
  const currentMonthRef = useRef(new Date().getMonth() + 1)
  const [settlementYear, setSettlementYear] = useState(currentYearRef.current)
  const [settlementMonthNum, setSettlementMonthNum] = useState(currentMonthRef.current)

  /** 다음 주소검색 스크립트 로드 */
  useEffect(() => {
    const w = window as unknown as { daum?: { Postcode: unknown } }
    if (w.daum?.Postcode) return
    const script = document.createElement('script')
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.async = true
    document.body.appendChild(script)
    return () => { document.body.removeChild(script) }
  }, [])

  /** 카카오 주소 검색 열기 */
  const handleSearchAddress = () => {
    const w = window as unknown as { daum?: { Postcode: new (opts: { oncomplete: (data: { roadAddress: string; jibunAddress: string }) => void }) => { open: () => void } } }
    if (!w.daum?.Postcode) return
    new w.daum.Postcode({
      oncomplete: (data) => {
        setAddress(data.roadAddress || data.jibunAddress)
        setDetailAddress('')
      },
    }).open()
  }

  // request가 바뀌면 관리 정보 초기화
  useEffect(() => {
    if (request) {
      isInitializing.current = true
      // 접수 정보 초기화
      setReceptionDate(request.receptionDate || '')
      setAffiliate(request.affiliate || '')
      setBusinessName(request.businessName || '')
      setAddress(request.address || '')
      setDetailAddress(request.detailAddress || '')
      setContactName(request.contactName || '')
      setContactPhone(request.contactPhone || '')
      setAsReason(request.asReason || '')
      setModelName(request.modelName || '')
      setOutdoorUnitLocation(request.outdoorUnitLocation || '')
      // 관리 정보 초기화
      setVisitDate(request.visitDate || '')
      setSamsungAsCenter(request.samsungAsCenter || '')
      setTechnicianName(request.technicianName || '')
      setTechnicianPhone(request.technicianPhone || '')
      setProcessingDetails(request.processingDetails || '')
      setProcessedDate(request.processedDate || '')
      setAsCost(request.asCost || 0)
      setReceptionFee(request.receptionFee || 0)
      setNotes(request.notes || '')
      setSaveStatus('idle')
      if (request.settlementMonth) {
        const parts = request.settlementMonth.split('-')
        if (parts.length === 2) {
          setSettlementYear(parseInt(parts[0]))
          setSettlementMonthNum(parseInt(parts[1]))
        }
      } else {
        setSettlementYear(currentYearRef.current)
        setSettlementMonthNum(currentMonthRef.current)
      }
      setTimeout(() => { isInitializing.current = false }, 100)
    }
  }, [request])

  /** 자동저장 실행 함수 */
  const doAutoSave = useCallback(async () => {
    if (!request || isInitializing.current || request.status === 'settled') return
    const currentTotal = asCost + receptionFee
    const currentSettlementMonth = `${settlementYear}-${String(settlementMonthNum).padStart(2, '0')}`
    setSaveStatus('saving')
    try {
      await onUpdate(request.id, {
        // 접수 정보 (received 상태에서 수정 가능)
        ...(request.status === 'received' ? {
          receptionDate,
          affiliate,
          businessName,
          address,
          detailAddress,
          contactName,
          contactPhone,
          asReason,
          modelName,
          outdoorUnitLocation,
        } : {}),
        // 관리 정보
        visitDate,
        samsungAsCenter,
        technicianName,
        technicianPhone,
        processingDetails,
        processedDate,
        asCost,
        receptionFee,
        totalAmount: currentTotal,
        notes,
        ...(request.status !== 'received' ? { settlementMonth: currentSettlementMonth } : {}),
      })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('idle')
    }
  }, [request, receptionDate, affiliate, businessName, address, detailAddress,
      contactName, contactPhone, asReason, modelName, outdoorUnitLocation,
      visitDate, samsungAsCenter, technicianName, technicianPhone,
      processingDetails, processedDate, asCost, receptionFee, notes,
      settlementYear, settlementMonthNum, onUpdate])

  /** 값이 바뀔 때마다 1초 디바운스 자동저장 (정산완료 상태에서는 비활성) */
  useEffect(() => {
    if (!request || isInitializing.current || !open || request.status === 'settled') return

    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      doAutoSave()
    }, 1000)

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [request, open, doAutoSave, receptionDate, affiliate, businessName, address, detailAddress,
      contactName, contactPhone, asReason, modelName, outdoorUnitLocation,
      visitDate, samsungAsCenter, technicianName, technicianPhone,
      processingDetails, processedDate, asCost, receptionFee, notes,
      settlementYear, settlementMonthNum])

  if (!request) return null

  const totalAmount = asCost + receptionFee
  const settlementMonthStr = `${settlementYear}-${String(settlementMonthNum).padStart(2, '0')}`
  const isSettled = request.status === 'settled'

  /** 상태 변경 (다음 단계로) */
  const handleStatusForward = async () => {
    const nextStatus = STATUS_TRANSITIONS[request.status].next
    if (!nextStatus) return
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    await onUpdate(request.id, {
      status: nextStatus,
      receptionDate,
      affiliate,
      businessName,
      address,
      detailAddress,
      contactName,
      contactPhone,
      asReason,
      modelName,
      outdoorUnitLocation,
      visitDate,
      samsungAsCenter,
      technicianName,
      technicianPhone,
      processingDetails,
      processedDate,
      asCost,
      receptionFee,
      totalAmount,
      notes,
      settlementMonth: settlementMonthStr,
    })
  }

  /** 상태 되돌리기 */
  const handleStatusBack = async () => {
    const prevStatus = STATUS_TRANSITIONS[request.status].prev
    if (!prevStatus) return
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    await onUpdate(request.id, { status: prevStatus })
  }

  /** 삭제 */
  const handleDelete = async () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    await onDelete(request.id)
    onOpenChange(false)
  }

  const transitions = STATUS_TRANSITIONS[request.status]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto p-0">

        {/* ===== 헤더 — 상태별 컬러 배경 ===== */}
        <div className={`${STATUS_HEADER_BG[request.status]} text-white px-6 py-4 rounded-t-lg`}>
          <DialogHeader>
            <DialogTitle className="text-white text-base font-normal flex items-center gap-2">
              {STATUS_ICONS[request.status]}
              <span className="text-white/70 text-sm">{AS_STATUS_LABELS[request.status]}</span>
              {isSettled && <Lock className="h-3.5 w-3.5 text-white/50 ml-1" />}
            </DialogTitle>
          </DialogHeader>
          <h2 className="text-lg font-bold mt-1">{request.businessName}</h2>
          <p className="text-white/70 text-xs mt-0.5 flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {request.address}{request.detailAddress ? `, ${request.detailAddress}` : ''}
          </p>
        </div>

        {/* ===== 스텝 인디케이터 — 현재 진행 단계 시각화 ===== */}
        <div className="px-6 py-3 border-b bg-gray-50">
          <div className="flex items-center">
            {STEPS.map((step, idx) => {
              const currentStepIdx = STEP_INDEX[request.status]
              const isCompleted = idx < currentStepIdx
              const isCurrent = idx === currentStepIdx
              return (
                <Fragment key={step.status}>
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                      ${isCompleted ? 'bg-teal-600 text-white' : ''}
                      ${isCurrent ? `${STATUS_HEADER_BG[request.status]} text-white` : ''}
                      ${!isCompleted && !isCurrent ? 'bg-gray-200 text-gray-400' : ''}
                    `}>
                      {isCompleted ? <Check className="h-3 w-3" /> : idx + 1}
                    </div>
                    <span className={`text-[10px] font-medium whitespace-nowrap
                      ${isCurrent ? 'text-gray-800' : isCompleted ? 'text-teal-600' : 'text-gray-400'}
                    `}>
                      {step.label}
                    </span>
                  </div>
                  {/* 단계 사이 연결선 */}
                  {idx < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mb-4 mx-1 ${idx < currentStepIdx ? 'bg-teal-600' : 'bg-gray-200'}`} />
                  )}
                </Fragment>
              )
            })}
          </div>
        </div>

        <div className="px-6 pb-6 pt-4 space-y-4">

          {/* ============================================================
              AS접수 — 접수 정보 수정 가능 폼 (중요도 순 배치)
              ============================================================ */}
          {request.status === 'received' && (
            <div className="space-y-4">
              {/* 계열사 버튼 그룹 */}
              <div className="space-y-2">
                <Label className="text-xs text-gray-500 font-medium">
                  계열사 <span className="text-brick-500">*</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {AFFILIATE_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setAffiliate(opt)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors
                        ${affiliate === opt
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-teal-400'
                        }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* 사업자명 */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-business" className="text-xs text-gray-500 font-medium">
                  사업자명 <span className="text-brick-500">*</span>
                </Label>
                <Input
                  id="edit-business"
                  placeholder="예: 구몬 화곡지국"
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  className="h-9"
                />
              </div>

              {/* AS 사유 (가장 중요!) */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-reason" className="text-xs text-gray-500 font-medium">
                  AS 사유 <span className="text-brick-500">*</span>
                </Label>
                <Textarea
                  id="edit-reason"
                  placeholder="어떤 증상인지 자세히 적어주세요 (예: 실외기 소음, 냉방 안됨)"
                  value={asReason}
                  onChange={e => setAsReason(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* 현장주소 */}
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500 font-medium flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> 현장주소 <span className="text-brick-500">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    placeholder="주소 검색 버튼을 눌러주세요"
                    value={address}
                    className="h-9 flex-1 bg-gray-50 cursor-pointer"
                    onClick={handleSearchAddress}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSearchAddress}
                    className="h-9 px-3 shrink-0"
                  >
                    <Search className="h-4 w-4 mr-1" />
                    주소 검색
                  </Button>
                </div>
                {address && (
                  <Input
                    placeholder="상세주소 (예: 3층 301호)"
                    value={detailAddress}
                    onChange={e => setDetailAddress(e.target.value)}
                    className="h-9 mt-1.5"
                  />
                )}
              </div>

              {/* 담당자 이름 + 연락처 (한 행) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-contact" className="text-xs text-gray-500 font-medium">담당자 이름</Label>
                  <Input
                    id="edit-contact"
                    placeholder="성함"
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-phone" className="text-xs text-gray-500 font-medium flex items-center gap-1">
                    <Phone className="h-3 w-3" /> 연락처
                  </Label>
                  <Input
                    id="edit-phone"
                    placeholder="010-0000-0000"
                    value={contactPhone}
                    onChange={e => setContactPhone(formatPhoneNumber(e.target.value))}
                    className="h-9"
                  />
                </div>
              </div>

              {/* 모델명 + 실외기 위치 (선택) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-model" className="text-xs text-gray-500 font-medium flex items-center gap-1">
                    <Box className="h-3 w-3" /> 모델명 <span className="text-gray-400 font-normal">(선택)</span>
                  </Label>
                  <Input
                    id="edit-model"
                    placeholder="예: AR-WF07"
                    value={modelName}
                    onChange={e => setModelName(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-outdoor" className="text-xs text-gray-500 font-medium flex items-center gap-1">
                    <Fan className="h-3 w-3" /> 실외기 위치 <span className="text-gray-400 font-normal">(선택)</span>
                  </Label>
                  <Input
                    id="edit-outdoor"
                    placeholder="예: 옥상, 1층 뒤편"
                    value={outdoorUnitLocation}
                    onChange={e => setOutdoorUnitLocation(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              {/* 접수일 */}
              <div className="space-y-1.5">
                <Label htmlFor="edit-date" className="text-xs text-gray-500 font-medium">접수일</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={receptionDate}
                  onChange={e => setReceptionDate(e.target.value)}
                  className="h-9 w-[180px]"
                />
              </div>
            </div>
          )}

          {/* ============================================================
              AS처리중 — 접수 정보 컴팩트 (3열)
              ============================================================ */}
          {request.status === 'in-progress' && (
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">접수 정보</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400">접수일</span>
                  <span className="font-medium text-gray-700">{request.receptionDate}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400">계열사</span>
                  <span className="font-medium text-gray-700">{request.affiliate}</span>
                </div>
                {request.contactName && (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400">담당자</span>
                    <span className="font-medium text-gray-700">{request.contactName}</span>
                  </div>
                )}
                {request.contactPhone && (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400">연락처</span>
                    <span className="font-medium text-gray-700">{request.contactPhone}</span>
                  </div>
                )}
                {request.modelName && (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400">모델명</span>
                    <span className="font-medium text-gray-700">{request.modelName}</span>
                  </div>
                )}
                {request.outdoorUnitLocation && (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400">실외기 위치</span>
                    <span className="font-medium text-gray-700">{request.outdoorUnitLocation}</span>
                  </div>
                )}
                {request.asReason && (
                  <div className="flex flex-col col-span-2 mt-1 pt-1.5 border-t border-gray-200">
                    <span className="text-[10px] text-gray-400">AS 사유</span>
                    <span className="text-gray-700">{request.asReason}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================
              정산대기 — 처리 요약 (읽기 전용 요약)
              ============================================================ */}
          {request.status === 'completed' && (
            <div className="bg-teal-50 rounded-lg px-4 py-3">
              <h4 className="text-[11px] font-bold text-teal-400 uppercase tracking-wider mb-2">AS 처리 요약</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="flex flex-col">
                  <span className="text-[10px] text-teal-400">접수일</span>
                  <span className="font-medium text-gray-700">{request.receptionDate}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-teal-400">계열사</span>
                  <span className="font-medium text-gray-700">{request.affiliate}</span>
                </div>
                {request.contactName && (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-teal-400">담당자</span>
                    <span className="font-medium text-gray-700">{request.contactName}</span>
                  </div>
                )}
                {request.contactPhone && (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-teal-400">연락처</span>
                    <span className="font-medium text-gray-700">{request.contactPhone}</span>
                  </div>
                )}
                {request.modelName && (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-teal-400">모델명</span>
                    <span className="font-medium text-gray-700">{request.modelName}</span>
                  </div>
                )}
                {request.outdoorUnitLocation && (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-teal-400">실외기 위치</span>
                    <span className="font-medium text-gray-700">{request.outdoorUnitLocation}</span>
                  </div>
                )}
                {request.asReason && (
                  <div className="flex flex-col col-span-2 mt-1 pt-1.5 border-t border-teal-200">
                    <span className="text-[10px] text-teal-400">AS 사유</span>
                    <span className="text-gray-700">{request.asReason}</span>
                  </div>
                )}
                {/* AS 처리 정보 */}
                <div className="flex flex-col col-span-2 mt-1 pt-1.5 border-t border-teal-200">
                  <span className="text-[10px] text-teal-400 font-bold mb-1">AS 처리 정보</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-teal-400">삼성AS센터</span>
                  <span className="font-medium text-gray-700">{request.samsungAsCenter || '-'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-teal-400">방문일</span>
                  <span className="font-medium text-gray-700">{request.visitDate || '-'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-teal-400">AS 기사</span>
                  <span className="font-medium text-gray-700">{request.technicianName || '-'}</span>
                </div>
                {request.technicianPhone && (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-teal-400">기사 연락처</span>
                    <span className="font-medium text-gray-700">{request.technicianPhone}</span>
                  </div>
                )}
                {request.processingDetails && (
                  <div className="flex flex-col col-span-2 mt-1 pt-1.5 border-t border-teal-200">
                    <span className="text-[10px] text-teal-400">처리내역</span>
                    <span className="text-gray-700">{request.processingDetails}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================
              정산완료 — 전체 정보 읽기 전용
              ============================================================ */}
          {isSettled && (
            <div className="bg-olive-50 rounded-lg px-4 py-3">
              <h4 className="text-[11px] font-bold text-olive-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Lock className="h-3 w-3" /> 정산 완료 — 수정 불가
              </h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {/* 접수 정보 */}
                <div className="flex flex-col">
                  <span className="text-[10px] text-olive-400">접수일</span>
                  <span className="font-medium text-gray-700">{request.receptionDate}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-olive-400">계열사</span>
                  <span className="font-medium text-gray-700">{request.affiliate}</span>
                </div>
                {request.contactName && (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-olive-400">담당자</span>
                    <span className="font-medium text-gray-700">{request.contactName}</span>
                  </div>
                )}
                {request.contactPhone && (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-olive-400">연락처</span>
                    <span className="font-medium text-gray-700">{request.contactPhone}</span>
                  </div>
                )}
                {request.modelName && (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-olive-400">모델명</span>
                    <span className="font-medium text-gray-700">{request.modelName}</span>
                  </div>
                )}
                {request.outdoorUnitLocation && (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-olive-400">실외기 위치</span>
                    <span className="font-medium text-gray-700">{request.outdoorUnitLocation}</span>
                  </div>
                )}
                {request.asReason && (
                  <div className="flex flex-col col-span-2 mt-1 pt-1.5 border-t border-olive-200">
                    <span className="text-[10px] text-olive-400">AS 사유</span>
                    <span className="text-gray-700">{request.asReason}</span>
                  </div>
                )}
                {/* AS 처리 정보 */}
                <div className="flex flex-col col-span-2 mt-1 pt-1.5 border-t border-olive-200">
                  <span className="text-[10px] text-olive-400 font-bold mb-1">AS 처리 정보</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-olive-400">삼성AS센터</span>
                  <span className="font-medium text-gray-700">{request.samsungAsCenter || '-'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-olive-400">방문일</span>
                  <span className="font-medium text-gray-700">{request.visitDate || '-'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-olive-400">AS 기사</span>
                  <span className="font-medium text-gray-700">{request.technicianName || '-'}</span>
                </div>
                {request.technicianPhone && (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-olive-400">기사 연락처</span>
                    <span className="font-medium text-gray-700">{request.technicianPhone}</span>
                  </div>
                )}
                {request.processingDetails && (
                  <div className="flex flex-col col-span-2 mt-1 pt-1.5 border-t border-olive-200">
                    <span className="text-[10px] text-olive-400">처리내역</span>
                    <span className="text-gray-700">{request.processingDetails}</span>
                  </div>
                )}
                {/* 정산 정보 */}
                <div className="flex flex-col col-span-2 mt-1 pt-1.5 border-t border-olive-200">
                  <span className="text-[10px] text-olive-400 font-bold mb-1">정산 정보</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-olive-400">처리일</span>
                  <span className="font-medium text-gray-700">{request.processedDate || '-'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-olive-400">정산월</span>
                  <span className="font-bold text-olive-700">{formatSettlementMonth(request.settlementMonth)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-olive-400">총금액</span>
                  <span className="font-bold text-olive-700">{formatAmount(request.totalAmount)}</span>
                </div>
                {request.notes && (
                  <div className="flex flex-col col-span-2 mt-1 pt-1.5 border-t border-olive-200">
                    <span className="text-[10px] text-olive-400">메모</span>
                    <span className="text-gray-700">{request.notes}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================
              편집 가능 영역 (정산완료가 아닌 경우만)
              ============================================================ */}
          {!isSettled && (
            <>
              {/* 방문 예정일 — 빨간 강조 (처리중에서만 표시) */}
              {request.status === 'in-progress' && (
                <div className="border-2 border-brick-300 rounded-lg p-3 bg-brick-50 space-y-2">
                  <p className="text-xs text-brick-500">삼성 AS 접수 후 방문일을 입력하세요</p>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="visit-date" className="flex items-center gap-1.5 text-brick-600 font-bold text-sm">
                      <CalendarClock className="h-4 w-4" />
                      방문 예정일
                    </Label>
                    <Input
                      id="visit-date"
                      type="date"
                      value={visitDate}
                      onChange={e => setVisitDate(e.target.value)}
                      className="w-[180px] h-9 border-brick-300 bg-white text-brick-700 font-bold text-center"
                    />
                  </div>
                </div>
              )}

              {/* 삼성AS센터 + 기사 + 처리내역 (처리중에서만 표시) */}
              {request.status === 'in-progress' && (
                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Wrench className="h-3.5 w-3.5" /> AS 처리
                  </h4>
                  <div className="space-y-1.5">
                    <Label htmlFor="as-center" className="text-xs text-gray-500">삼성AS센터</Label>
                    <Input
                      id="as-center"
                      placeholder="예: 삼성전자 강서센터"
                      value={samsungAsCenter}
                      onChange={e => setSamsungAsCenter(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="tech-name" className="text-xs text-gray-500">AS 기사</Label>
                      <Input
                        id="tech-name"
                        placeholder="기사 이름"
                        value={technicianName}
                        onChange={e => setTechnicianName(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="tech-phone" className="text-xs text-gray-500">AS 기사 번호</Label>
                      <Input
                        id="tech-phone"
                        placeholder="010-0000-0000"
                        value={technicianPhone}
                        onChange={e => setTechnicianPhone(formatPhoneNumber(e.target.value))}
                        className="h-9"
                      />
                    </div>
                  </div>
                  {/* 처리내역은 처리중에서만 */}
                  {request.status === 'in-progress' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="as-details" className="text-xs text-gray-500">처리내역</Label>
                      <Textarea
                        id="as-details"
                        placeholder="AS 진행 상황을 적어주세요"
                        value={processingDetails}
                        onChange={e => setProcessingDetails(e.target.value)}
                        rows={2}
                        className="resize-none"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* 비용 섹션 (처리중/정산대기에서 표시) */}
              {(request.status === 'in-progress' || request.status === 'completed') && (
                <div className="border-2 border-teal-300 rounded-lg p-4 bg-teal-50/50 space-y-3">
                  <h4 className="text-[11px] font-bold text-teal-600 uppercase tracking-wider">비용 <span className="text-[10px] font-normal text-gray-400 normal-case">(부가세 별도)</span></h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="as-cost" className="text-xs text-teal-500 font-medium">AS 비용</Label>
                      <Input
                        id="as-cost"
                        type="number"
                        placeholder="0"
                        value={asCost || ''}
                        onChange={e => setAsCost(Number(e.target.value) || 0)}
                        className="h-9 bg-white border-teal-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="as-fee" className="text-xs text-teal-500 font-medium">접수비</Label>
                      <Input
                        id="as-fee"
                        type="number"
                        placeholder="0"
                        value={receptionFee || ''}
                        onChange={e => setReceptionFee(Number(e.target.value) || 0)}
                        className="h-9 bg-white border-teal-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-teal-500 font-medium">총금액</Label>
                      <div className="h-9 flex items-center justify-center px-3 bg-teal-600 rounded-md text-sm font-bold text-white">
                        {totalAmount.toLocaleString('ko-KR')}원
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 일정 섹션 — 처리일 + 정산월 (처리중/정산대기에서 표시) */}
              {(request.status === 'in-progress' || request.status === 'completed') && (
                <div className="space-y-3">
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> 일정
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="processed-date" className="text-xs text-gray-500">처리일</Label>
                      <Input
                        id="processed-date"
                        type="date"
                        value={processedDate}
                        onChange={e => setProcessedDate(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-500">정산월</Label>
                      <div className="flex items-center gap-1.5">
                        <Select
                          value={String(settlementYear)}
                          onValueChange={v => setSettlementYear(Number(v))}
                        >
                          <SelectTrigger className="h-9 w-[90px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[currentYearRef.current - 1, currentYearRef.current, currentYearRef.current + 1].map(y => (
                              <SelectItem key={y} value={String(y)}>{y}년</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={String(settlementMonthNum)}
                          onValueChange={v => setSettlementMonthNum(Number(v))}
                        >
                          <SelectTrigger className="h-9 w-[80px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                              <SelectItem key={m} value={String(m)}>{m}월</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 메모 */}
              <div className="space-y-1.5">
                <Label htmlFor="as-notes" className="text-xs text-gray-500">메모</Label>
                <Textarea
                  id="as-notes"
                  placeholder="특이사항이 있으면 메모하세요"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>
            </>
          )}

          {/* ===== 하단 액션 바 ===== */}
          <div className="flex items-center justify-between pt-3 border-t">
            {/* 좌측: 삭제 + 자동저장 상태 */}
            <div className="flex items-center gap-3">
              {!isSettled && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-brick-400 hover:text-brick-600 hover:bg-brick-50 text-xs">
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      삭제
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>AS 요청 삭제</AlertDialogTitle>
                      <AlertDialogDescription>
                        &quot;{request.businessName}&quot; AS 요청을 삭제하시겠습니까?
                        <br />삭제된 데이터는 복구할 수 없습니다.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>취소</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-brick-600 hover:bg-brick-700">
                        삭제
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {/* 자동저장 상태 표시 */}
              {!isSettled && (
                <span className="text-[11px] text-gray-400 flex items-center gap-1">
                  {saveStatus === 'saving' && (
                    <><Loader2 className="h-3 w-3 animate-spin" /> 저장 중...</>
                  )}
                  {saveStatus === 'saved' && (
                    <><Check className="h-3 w-3 text-olive-500" /> 자동 저장됨</>
                  )}
                  {saveStatus === 'idle' && '입력 시 자동 저장'}
                </span>
              )}
            </div>

            {/* 우측: 되돌리기 + 상태변경 */}
            <div className="flex items-center gap-2">
              {transitions.prev && (
                <Button variant="ghost" size="sm" onClick={handleStatusBack} className="text-xs text-gray-500">
                  <Undo2 className="h-3.5 w-3.5 mr-1" />
                  {AS_STATUS_LABELS[transitions.prev]}으로
                </Button>
              )}
              {transitions.next && (
                <Button size="sm" onClick={handleStatusForward} className={NEXT_STATUS_BUTTON_COLOR[request.status]}>
                  <ArrowRight className="h-3.5 w-3.5 mr-1" />
                  {AS_STATUS_LABELS[transitions.next]}으로 변경
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
