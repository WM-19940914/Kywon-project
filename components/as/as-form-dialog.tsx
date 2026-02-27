/**
 * AS 접수 폼 다이얼로그
 *
 * 교원그룹에서 AS 요청이 들어오면 이 폼으로 접수합니다.
 * 접수 정보만 입력 (관리 정보는 상세 다이얼로그에서 입력)
 *
 * 입력 순서 (중요도순):
 *   1) 계열사 버튼 그룹 — 빠른 선택
 *   2) 사업자명 (필수)
 *   3) AS 사유 (가장 중요!) — 크게 표시
 *   4) 현장주소 (필수)
 *   5) 담당자 이름 + 연락처 (한 행)
 *   6) 모델명 + 실외기 위치 (선택)
 *   7) 메모 (선택)
 *   8) 접수일 (기본: 오늘)
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
import { AFFILIATE_OPTIONS } from '@/types/order'
import type { ASRequest } from '@/types/as'
import { ClipboardPlus, MapPin, Phone, Box, Fan, Search } from 'lucide-react'

/** Props */
interface ASFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: Omit<ASRequest, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
}

/** 전화번호 자동 하이픈 (010-XXXX-XXXX) */
function formatPhoneNumber(value: string): string {
  const nums = value.replace(/[^0-9]/g, '').slice(0, 11)
  if (nums.length <= 3) return nums
  if (nums.length <= 7) return `${nums.slice(0, 3)}-${nums.slice(3)}`
  return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7)}`
}

/** 오늘 날짜 (YYYY-MM-DD) */
function getTodayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ASFormDialog({ open, onOpenChange, onSubmit }: ASFormDialogProps) {
  // 폼 상태
  const [receptionDate, setReceptionDate] = useState(getTodayStr())
  const [affiliate, setAffiliate] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [address, setAddress] = useState('')
  const [detailAddress, setDetailAddress] = useState('')
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
    if (!affiliate || !businessName || !address || !asReason) return

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

  /** 필수값 미입력 여부 (계열사 + 사업자명 + 주소 + AS사유) */
  const isValid = affiliate && businessName && address && asReason

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto p-0">
        {/* 헤더 — teal 배경 */}
        <div className="bg-teal-600 text-white px-6 py-4 rounded-t-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white text-lg">
              <ClipboardPlus className="h-5 w-5" />
              AS 접수
            </DialogTitle>
          </DialogHeader>
          <p className="text-teal-100 text-xs mt-1">교원그룹 AS 요청 정보를 입력해주세요</p>
        </div>

        <div className="px-6 pb-6 pt-5 space-y-4">

          {/* ── 1. 계열사 버튼 그룹 ── */}
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

          {/* ── 2. 사업자명 ── */}
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

          {/* ── 3. AS 사유 (가장 중요!) ── */}
          <div className="space-y-1.5">
            <Label htmlFor="as-reason" className="text-xs text-gray-500 font-medium">
              AS 사유 <span className="text-brick-500">*</span>
            </Label>
            <Textarea
              id="as-reason"
              placeholder="어떤 증상인지 자세히 적어주세요 (예: 실외기 소음, 냉방 안됨)"
              value={asReason}
              onChange={e => setAsReason(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* ── 4. 현장주소 ── */}
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
            {/* 상세주소 — 기본주소 선택 후 표시 */}
            {address && (
              <Input
                placeholder="상세주소 (예: 3층 301호)"
                value={detailAddress}
                onChange={e => setDetailAddress(e.target.value)}
                className="h-9 mt-1.5"
              />
            )}
          </div>

          {/* ── 5. 담당자 이름 + 연락처 (한 행) ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="as-contact" className="text-xs text-gray-500 font-medium">담당자 이름</Label>
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

          {/* ── 6. 모델명 + 실외기 위치 (선택) ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="as-model" className="text-xs text-gray-500 font-medium flex items-center gap-1">
                <Box className="h-3 w-3" /> 모델명 <span className="text-gray-400 font-normal">(선택)</span>
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
                <Fan className="h-3 w-3" /> 실외기 위치 <span className="text-gray-400 font-normal">(선택)</span>
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

          {/* ── 7. 메모 (선택) ── */}
          <div className="space-y-1.5">
            <Label htmlFor="as-notes" className="text-xs text-gray-500 font-medium">
              메모 <span className="text-gray-400 font-normal">(선택)</span>
            </Label>
            <Textarea
              id="as-notes"
              placeholder="예: 주차 불가, 사다리차 필요, 오전 방문 요청 등"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          {/* ── 8. 접수일 (기본: 오늘) ── */}
          <div className="space-y-1.5">
            <Label htmlFor="as-date" className="text-xs text-gray-500 font-medium">접수일</Label>
            <Input
              id="as-date"
              type="date"
              value={receptionDate}
              onChange={e => setReceptionDate(e.target.value)}
              className="h-9 w-[180px]"
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
