/**
 * AS 접수 폼 다이얼로그 (실무 최적화 버전)
 */

'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AFFILIATE_OPTIONS } from '@/types/order'
import type { ASRequest } from '@/types/as'
import { User, Phone, MapPin, Wrench, Calendar, Info, Building2, Smartphone, Search, FileText } from 'lucide-react'

interface ASFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: Omit<ASRequest, 'id' | 'createdAt' | 'updatedAt'>) => void
}

export function ASFormDialog({ open, onOpenChange, onSubmit }: ASFormDialogProps) {
  const [formData, setFormData] = useState({
    receptionDate: new Date().toISOString().split('T')[0],
    affiliate: AFFILIATE_OPTIONS[0] as string,
    businessName: '',
    address: '',
    detailAddress: '',
    contactName: '',
    contactPhone: '',
    modelName: '',
    asReason: '',
    notes: '', // visitDate 대신 notes 사용
    status: 'received' as const,
  })

  // 카카오 주소 검색 서비스 로드 상태 확인
  const [isDaumPostcodeLoaded, setIsDaumPostcodeLoaded] = useState(false)

  useEffect(() => {
    const checkDaumScript = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).daum && (window as any).daum.Postcode) {
        setIsDaumPostcodeLoaded(true)
      } else {
        const script = document.createElement('script')
        script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
        script.async = true
        script.onload = () => setIsDaumPostcodeLoaded(true)
        document.body.appendChild(script)
      }
    }
    checkDaumScript()
  }, [])

  const handleAddressSearch = () => {
    if (!isDaumPostcodeLoaded) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new (window as any).daum.Postcode({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      oncomplete: (data: any) => {
        setFormData(prev => ({
          ...prev,
          address: data.roadAddress || data.address,
          businessName: prev.businessName || data.buildingName // 건물명이 있으면 사업자명 자동 제안
        }))
      },
    }).open()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
    onOpenChange(false)
    setFormData({
      receptionDate: new Date().toISOString().split('T')[0],
      affiliate: AFFILIATE_OPTIONS[0],
      businessName: '',
      address: '',
      detailAddress: '',
      contactName: '',
      contactPhone: '',
      modelName: '',
      asReason: '',
      notes: '',
      status: 'received',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
        <DialogHeader className="bg-white px-8 py-4 border-b border-slate-100 flex-row items-center gap-2.5 space-y-0">
          <Wrench className="h-4.5 w-4.5 text-[#E09520]" strokeWidth={3} />
          <DialogTitle className="text-[17px] font-black tracking-tight text-slate-900">AS 접수</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          
          {/* 섹션 1: 고객 및 계열사 정보 */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
              <Building2 className="h-4 w-4 text-[#E09520]" />
              <h3 className="text-[15px] font-black text-slate-800">1. 고객 및 계열사 정보</h3>
            </div>
            
            <div className="space-y-3">
              <Label className="text-[13px] font-bold text-slate-500">소속 계열사 선택</Label>
              <div className="flex flex-wrap gap-2">
                {AFFILIATE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setFormData({ ...formData, affiliate: opt as string })}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all
                      ${formData.affiliate === opt 
                        ? 'bg-[#E09520] border-[#E09520] text-white shadow-md shadow-orange-100' 
                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[13px] font-bold text-slate-500">사업자명 (또는 지점명)</Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    required 
                    placeholder="예: 교원내외빌딩" 
                    className="pl-10 h-11 bg-slate-50/50 border-slate-200 rounded-xl focus:bg-white transition-all"
                    value={formData.businessName}
                    onChange={e => setFormData({ ...formData, businessName: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-bold text-slate-500">접수 일자</Label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    type="date" 
                    required 
                    className="pl-10 h-11 bg-slate-50/50 border-slate-200 rounded-xl focus:bg-white transition-all"
                    value={formData.receptionDate}
                    onChange={e => setFormData({ ...formData, receptionDate: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-bold text-slate-500 text-slate-500 flex justify-between">
                현장 주소
                <button 
                  type="button" 
                  onClick={handleAddressSearch}
                  className="text-orange-600 hover:text-orange-700 flex items-center gap-1 transition-colors"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>주소 검색</span>
                </button>
              </Label>
              <div className="space-y-2">
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    required 
                    readOnly
                    placeholder="주소 검색을 이용해 주세요" 
                    className="pl-10 h-11 bg-slate-50/50 border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-all"
                    onClick={handleAddressSearch}
                    value={formData.address}
                  />
                </div>
                <Input 
                  placeholder="상세 주소 (층, 호수 등)" 
                  className="h-11 bg-slate-50/50 border-slate-200 rounded-xl focus:bg-white transition-all"
                  value={formData.detailAddress}
                  onChange={e => setFormData({ ...formData, detailAddress: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[13px] font-bold text-slate-500">현장 접수자</Label>
                <Input 
                  required 
                  placeholder="성함 입력" 
                  className="h-11 bg-slate-50/50 border-slate-200 rounded-xl focus:bg-white transition-all"
                  value={formData.contactName}
                  onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-bold text-slate-500">접수자 연락처</Label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    required 
                    placeholder="010-0000-0000" 
                    className="pl-10 h-11 bg-slate-50/50 border-slate-200 rounded-xl focus:bg-white transition-all"
                    value={formData.contactPhone}
                    onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 섹션 2: 모델 및 AS 사유 */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
              <Smartphone className="h-4 w-4 text-[#E09520]" />
              <h3 className="text-[15px] font-black text-slate-800">2. 장비 및 AS 사유</h3>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-bold text-slate-500">모델명</Label>
              <Input 
                placeholder="예: AP083BNPPBH1" 
                className="h-11 bg-slate-50/50 border-slate-200 rounded-xl focus:bg-white transition-all"
                value={formData.modelName}
                onChange={e => setFormData({ ...formData, modelName: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-bold text-slate-500">AS 요청 사유</Label>
              <Textarea 
                required 
                placeholder="증상 및 불편 사항을 자세히 적어주세요." 
                className="min-h-[100px] bg-slate-50/50 border-slate-200 rounded-xl focus:bg-white transition-all resize-none p-4"
                value={formData.asReason}
                onChange={e => setFormData({ ...formData, asReason: e.target.value })}
              />
            </div>
          </div>

          {/* 섹션 3: 특이사항 (메모) */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
              <FileText className="h-4 w-4 text-[#E09520]" />
              <h3 className="text-[15px] font-black text-slate-800">3. 특이사항 (메모)</h3>
            </div>

            <div className="space-y-2">
              <Label className="text-[13px] font-bold text-slate-500">메모 및 전달사항</Label>
              <Textarea 
                placeholder="특이사항 및 전달사항을 적어주세요." 
                className="min-h-[80px] bg-slate-50/50 border-slate-200 rounded-xl focus:bg-white transition-all resize-none p-4"
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
              />
              <div className="flex items-start gap-2 bg-orange-50/50 p-3 rounded-xl border border-orange-100/50">
                <Info className="h-4 w-4 text-[#E09520] mt-0.5" />
                <p className="text-[11.5px] text-orange-700/70 leading-relaxed font-medium">
                  입력하신 메모는 내부 관리자 및 기사님 확인용으로 사용됩니다.
                </p>
              </div>
            </div>
          </div>
        </form>

        <DialogFooter className="p-6 bg-slate-50 border-t border-slate-100">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="rounded-xl font-bold text-slate-500 h-12 px-6"
          >
            취소
          </Button>
          <Button 
            onClick={handleSubmit} 
            className="bg-[#E09520] hover:bg-[#c87d1a] text-white font-black rounded-xl h-12 px-10 shadow-lg shadow-orange-100 transition-all active:scale-95"
          >
            AS 접수하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
