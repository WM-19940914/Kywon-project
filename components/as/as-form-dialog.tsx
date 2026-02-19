/**
 * AS 접수 폼 다이얼로그
 *
 * 교원그룹에서 AS 요청이 들어오면 이 폼으로 접수합니다.
 * 접수 정보만 입력 (관리 정보는 상세 다이얼로그에서 입력)
 *
 * 섹션 구조:
 *   1) 기본 정보 — 접수일, 계열사
 *   2) 현장 정보 — 사업자명, 주소
 *   3) 담당자 — 이름, 연락처
 *   4) AS 내용 — 사유, 모델명, 실외기 위치
 */

'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AFFILIATE_OPTIONS } from '@/types/order'
import type { ASRequest } from '@/types/as'
import { ClipboardPlus, Building2, MapPin, User, Phone, AlertTriangle, Box, Fan, Search } from 'lucide-react'

/** Props */
interface ASFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: Omit<ASRequest, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
}

/** 오늘 날짜 (YYYY-MM-DD) */
/** 전화번호 자동 하이픈 (010-XXXX-XXXX) */
function formatPhoneNumber(value: string): string {
  const nums = value.replace(/[^0-9]/g, '').slice(0, 11)
  if (nums.length <= 3) return nums
  if (nums.length <= 7) return `${nums.slice(0, 3)}-${nums.slice(3)}`
  return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7)}`
}

function getTodayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ASFormDialog({ open, onOpenChange, onSubmit }: ASFormDialogProps) {
  // 폼 상태
  const [receptionDate, setReceptionDate] = useState(getTodayStr())
  const [affiliate, setAffiliate] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [address, setAddress] = useState('')          // 기본주소 (카카오 검색 결과)
  const [detailAddress, setDetailAddress] = useState('') // 상세주소 (수동 입력)
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [asReason, setAsReason] = useState('')
  const [modelName, setModelName] = useState('')
  const [outdoorUnitLocation, setOutdoorUnitLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  /** 다음 주소검색 스크립트 로드 */
  useEffect(() => {
    const w = window as unknown as { daum?: { Postcode: unknown } }
    if (w.daum?.Postcode) return
    const script = document.createElement('script')
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.async = true
    document.body.appendChild(script)
    return () => {
      document.body.removeChild(script)
    }
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

  /** 폼 초기화 */
  const resetForm = () => {
    setReceptionDate(getTodayStr())
    setAffiliate('')
    setBusinessName('')
    setAddress('')
    setDetailAddress('')
    setContactName('')
    setContactPhone('')
    setAsReason('')
    setModelName('')
    setOutdoorUnitLocation('')
    setNotes('')
  }

  /** 제출 — 기본주소 + 상세주소 따로 저장 */
  const handleSubmit = async () => {
    if (!affiliate || !businessName || !address) return

    setIsSubmitting(true)
    try {
      await onSubmit({
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
        notes,
        status: 'received',
        asCost: 0,
        receptionFee: 0,
        totalAmount: 0,
      })
      resetForm()
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  /** 필수값 미입력 여부 */
  const isValid = affiliate && businessName && address

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto p-0">
        {/* 헤더 — 파란 배경 */}
        <div className="bg-teal-600 text-white px-6 py-4 rounded-t-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white text-lg">
              <ClipboardPlus className="h-5 w-5" />
              AS 접수
            </DialogTitle>
          </DialogHeader>
          <p className="text-teal-100 text-xs mt-1">교원그룹 AS 요청 정보를 입력해주세요</p>
        </div>

        <div className="px-6 pb-6 pt-2 space-y-5">

          {/* ── 1. 기본 정보 ── */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="as-date" className="text-xs text-gray-500 font-medium">접수일</Label>
              <Input
                id="as-date"
                type="date"
                value={receptionDate}
                onChange={e => setReceptionDate(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="as-affiliate" className="text-xs text-gray-500 font-medium">
                계열사 <span className="text-brick-500">*</span>
              </Label>
              <Select value={affiliate} onValueChange={setAffiliate}>
                <SelectTrigger id="as-affiliate" className="h-9">
                  <SelectValue placeholder="선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {AFFILIATE_OPTIONS.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 구분선 */}
          <div className="border-t" />

          {/* ── 2. 현장 정보 ── */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> 현장 정보
            </h4>
            <div className="space-y-1.5">
              <Label htmlFor="as-business" className="text-xs text-gray-500 font-medium">
                사업자명 <span className="text-brick-500">*</span>
              </Label>
              <Input
                id="as-business"
                placeholder="예: 구몬 화곡지국"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                className="h-9"
              />
            </div>
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
            </div>
            {/* 상세주소 — 기본주소 선택 후 표시 */}
            {address && (
              <div className="space-y-1.5">
                <Label htmlFor="as-detail-addr" className="text-xs text-gray-500 font-medium">
                  상세주소
                </Label>
                <Input
                  id="as-detail-addr"
                  placeholder="예: 3층 301호"
                  value={detailAddress}
                  onChange={e => setDetailAddress(e.target.value)}
                  className="h-9"
                />
              </div>
            )}
          </div>

          {/* 구분선 */}
          <div className="border-t" />

          {/* ── 3. 담당자 정보 ── */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> 담당자
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="as-contact" className="text-xs text-gray-500 font-medium">이름</Label>
                <Input
                  id="as-contact"
                  placeholder="성함"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="as-phone" className="text-xs text-gray-500 font-medium flex items-center gap-1">
                  <Phone className="h-3 w-3" /> 연락처
                </Label>
                <Input
                  id="as-phone"
                  placeholder="010-0000-0000"
                  value={contactPhone}
                  onChange={e => setContactPhone(formatPhoneNumber(e.target.value))}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          {/* 구분선 */}
          <div className="border-t" />

          {/* ── 4. AS 내용 ── */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> AS 내용
            </h4>
            <div className="space-y-1.5">
              <Label htmlFor="as-reason" className="text-xs text-gray-500 font-medium">AS 사유</Label>
              <Textarea
                id="as-reason"
                placeholder="예: 실외기 소음 발생, 냉방 안됨 등"
                value={asReason}
                onChange={e => setAsReason(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="as-model" className="text-xs text-gray-500 font-medium flex items-center gap-1">
                  <Box className="h-3 w-3" /> 모델명
                </Label>
                <Input
                  id="as-model"
                  placeholder="예: AR-WF07"
                  value={modelName}
                  onChange={e => setModelName(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="as-outdoor" className="text-xs text-gray-500 font-medium flex items-center gap-1">
                  <Fan className="h-3 w-3" /> 실외기 위치
                </Label>
                <Input
                  id="as-outdoor"
                  placeholder="예: 옥상, 1층 뒤편"
                  value={outdoorUnitLocation}
                  onChange={e => setOutdoorUnitLocation(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          {/* 구분선 */}
          <div className="border-t" />

          {/* ── 5. 메모 ── */}
          <div className="space-y-1.5">
            <Label htmlFor="as-notes" className="text-xs text-gray-500 font-medium">메모 (특이사항)</Label>
            <Textarea
              id="as-notes"
              placeholder="예: 주차 불가, 사다리차 필요, 오전 방문 요청 등"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* ── 하단 버튼 ── */}
          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-gray-500">
              취소
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isValid || isSubmitting}
              className="bg-teal-600 hover:bg-teal-700 px-6"
            >
              {isSubmitting ? '등록 중...' : 'AS 접수하기'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
