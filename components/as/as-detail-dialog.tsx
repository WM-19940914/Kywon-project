/**
 * AS 상세 정보 다이얼로그 (단계별 정보 노출 최적화 및 가독성 극대화 버전)
 */

'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { 
  Wrench, 
  Banknote, 
  Trash2, 
  X,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Search,
  Edit,
  RotateCcw,
  Save,
} from 'lucide-react'
import type { ASRequest } from '@/types/as'
import { AS_STATUS_LABELS } from '@/types/as'
import { AFFILIATE_OPTIONS } from '@/types/order'

interface ASDetailDialogProps {
  request: ASRequest | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (id: string, updates: Partial<ASRequest>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function formatAmount(amount?: number): string {
  if (!amount || amount === 0) return '0원'
  return `${amount.toLocaleString('ko-KR')}원`
}

function formatSettlementMonth(month?: string): string {
  if (!month) return '-'
  const parts = month.split('-')
  return parts.length < 2 ? month : `${parts[0]}년 ${parseInt(parts[1])}월`
}

export function ASDetailDialog({ request, open, onOpenChange, onUpdate, onDelete }: ASDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<Partial<ASRequest>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isDaumPostcodeLoaded, setIsDaumPostcodeLoaded] = useState(false)

  // 커스텀 확인창 상태
  const [confirmConfig, setConfirmConfig] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
    variant?: 'default' | 'destructive';
  }>({
    open: false,
    title: '',
    description: '',
    action: () => {},
  })

  useEffect(() => {
    if (request) {
      setFormData(request)
      setIsEditing(false)
    }
  }, [request, open])

  // 카카오 주소 검색 스크립트 로드
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
    if (open) checkDaumScript()
  }, [open])

  const handleAddressSearch = () => {
    if (!isDaumPostcodeLoaded) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    new (window as any).daum.Postcode({
      oncomplete: (data: any) => {
        setFormData(prev => ({
          ...prev,
          address: data.roadAddress || data.address,
          businessName: prev.businessName || data.buildingName
        }))
      },
    }).open()
  }

  if (!request) return null

  const status = request.status
  const totalAmount = (Number(formData.asCost) || 0) + (Number(formData.receptionFee) || 0)

  const handleSave = async () => {
    if (isSaving) return
    setIsSaving(true)
    try {
      await onUpdate(request.id, formData)
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  // 닫힐 때 자동 저장 로직 추가
  const handleOpenChange = async (newOpen: boolean) => {
    if (!newOpen) {
      const isModified = JSON.stringify(formData) !== JSON.stringify(request)
      if (isModified && !isSaving) {
        await handleSave()
      }
    }
    onOpenChange(newOpen)
  }

  const handleDelete = () => {
    setConfirmConfig({
      open: true,
      title: 'AS 접수 삭제',
      description: '이 AS 요청 내역을 정말 삭제하시겠습니까? 삭제된 데이터는 복구할 수 없습니다.',
      variant: 'destructive',
      action: async () => {
        await onDelete(request.id)
        onOpenChange(false)
      }
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[750px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl bg-slate-50">
        
        {/* 상단 헤더 */}
        <div className="bg-white px-8 py-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-zinc-900 rounded-2xl flex items-center justify-center shadow-lg shadow-zinc-200">
              <Wrench className="h-6 w-6 text-orange-500" strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-orange-500 text-white border-none px-2.5 py-0.5 h-5 text-[10px] font-black uppercase tracking-wider shadow-sm">
                  {AS_STATUS_LABELS[status]}
                </Badge>
                <span className="text-zinc-400 text-[11px] font-bold font-mono">ID: {request.id.slice(0, 8)}</span>
              </div>
              <DialogTitle className="text-2xl font-black text-zinc-900 tracking-tight leading-none">
                {request.businessName}
              </DialogTitle>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar bg-white">
          
          {/* 섹션 1: 접수 및 고객 정보 (언제나 노출) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-zinc-900" />
                <h3 className="text-lg font-black text-zinc-900 tracking-tight">1. 접수 및 고객 정보</h3>
              </div>
              {!isEditing && (
                <Button 
                  onClick={() => setIsEditing(true)} 
                  className="h-8 bg-orange-50 border border-orange-200 text-orange-600 font-bold hover:bg-orange-100 px-4 rounded-lg shadow-sm text-xs transition-all active:scale-95"
                >
                  <Edit className="h-3 w-3 mr-1.5" />수정
                </Button>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-zinc-100 border-b border-zinc-100">
                <DataField label="계열사" value={formData.affiliate} isEditing={isEditing} 
                  input={<SelectInput value={formData.affiliate} options={AFFILIATE_OPTIONS as unknown as string[]} onChange={v => setFormData({...formData, affiliate: v})} />} 
                />
                <DataField label="사업자명" value={formData.businessName} isEditing={isEditing}
                  input={<Input value={formData.businessName} onChange={e => setFormData({...formData, businessName: e.target.value})} className="h-10 border-zinc-200 font-bold" />}
                />
              </div>
              <div className="grid grid-cols-2 divide-x divide-zinc-100 border-b border-zinc-100">
                <DataField label="접수일자" value={formData.receptionDate} isEditing={isEditing}
                  input={<Input type="date" value={formData.receptionDate} onChange={e => setFormData({...formData, receptionDate: e.target.value})} className="h-10 border-zinc-200" />}
                />
                <DataField label="현장 접수자" value={formData.contactName} isEditing={isEditing}
                  input={<Input value={formData.contactName} onChange={e => setFormData({...formData, contactName: e.target.value})} className="h-10 border-zinc-200" />}
                />
              </div>
              <div className="grid grid-cols-2 divide-x divide-zinc-100 border-b border-zinc-100">
                <DataField label="접수자 연락처" value={formData.contactPhone} isEditing={isEditing}
                  input={<Input value={formData.contactPhone} onChange={e => setFormData({...formData, contactPhone: e.target.value})} className="h-10 border-zinc-200" />}
                />
                <DataField label="모델명" value={formData.modelName} isEditing={isEditing}
                  input={<Input value={formData.modelName} onChange={e => setFormData({...formData, modelName: e.target.value})} className="h-10 border-zinc-200 font-bold" />}
                />
              </div>
              <div className="p-5 border-b border-zinc-100">
                <DataField label="현장 주소" value={`${formData.address} ${formData.detailAddress || ''}`} isEditing={isEditing} fullWidth
                  input={
                    <div className="space-y-2 w-full">
                      <div className="flex gap-2">
                        <Input 
                          value={formData.address} 
                          readOnly 
                          placeholder="주소 검색을 클릭해주세요" 
                          className="h-10 bg-zinc-50 border-zinc-200 flex-1 cursor-default" 
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          onClick={handleAddressSearch}
                          className="h-10 border-orange-200 text-orange-600 font-bold bg-orange-50 hover:bg-orange-100 transition-all"
                        >
                          <Search className="h-4 w-4 mr-1.5" />주소 검색
                        </Button>
                      </div>
                      <Input value={formData.detailAddress} onChange={e => setFormData({...formData, detailAddress: e.target.value})} placeholder="상세주소" className="h-10 border-zinc-200" />
                    </div>
                  }
                />
              </div>
              <div className="p-5 border-b border-zinc-100">
                <DataField label="AS 요청사유" value={formData.asReason} isEditing={isEditing} fullWidth
                  input={<Textarea value={formData.asReason} onChange={e => setFormData({...formData, asReason: e.target.value})} className="min-h-[100px] border-zinc-200 resize-none" />}
                />
              </div>
              <div className="p-5">
                <DataField label="메모" value={formData.notes} isEditing={isEditing} fullWidth
                  input={<Textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="특이사항 입력" className="min-h-[60px] border-zinc-200 resize-none" />}
                />
              </div>
            </div>
          </div>

          {/* 섹션 2: AS 처리 내용 (통합 섹션) */}
          {status !== 'received' && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 px-1">
                <Wrench className="h-5 w-5 text-zinc-900" />
                <h3 className="text-lg font-black text-zinc-900 tracking-tight">2. AS 처리 내용</h3>
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
                <div className="grid grid-cols-2 divide-x divide-zinc-100 border-b border-zinc-100">
                  <DataField label="삼성 AS 센터" value={formData.samsungAsCenter} isEditing={isEditing || status === 'in-progress'}
                    input={<Input value={formData.samsungAsCenter} onChange={e => setFormData({...formData, samsungAsCenter: e.target.value})} className="h-10 border-zinc-200" />}
                  />
                  <DataField label="방문 예정일" value={formData.visitDate} isEditing={isEditing || status === 'in-progress'}
                    input={<Input type="date" value={formData.visitDate} onChange={e => setFormData({...formData, visitDate: e.target.value})} className="h-10 border-zinc-200 font-bold text-orange-600" />}
                  />
                </div>
                <div className="grid grid-cols-2 divide-x divide-zinc-100 border-b border-zinc-100">
                  <DataField label="담당 기사" value={formData.technicianName} isEditing={isEditing || status === 'in-progress'}
                    input={<Input value={formData.technicianName} onChange={e => setFormData({...formData, technicianName: e.target.value})} className="h-10 border-zinc-200" />}
                  />
                  <DataField label="기사 연락처" value={formData.technicianPhone} isEditing={isEditing || status === 'in-progress'}
                    input={<Input value={formData.technicianPhone} onChange={e => setFormData({...formData, technicianPhone: e.target.value})} className="h-10 border-zinc-200" />}
                  />
                </div>
                <div className="grid grid-cols-3 divide-x divide-zinc-100 border-b border-zinc-100 bg-zinc-50/30">
                  <div className="p-5 space-y-2">
                    <Label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-0.5 flex items-center justify-between">
                      AS 수리비용 (삼성) <span className="text-[9px] text-orange-500 font-bold ml-1">VAT 별도</span>
                    </Label>
                    {isEditing || status === 'in-progress' ? (
                      <Input 
                        type="text" 
                        value={formData.asCost ? formData.asCost.toLocaleString('ko-KR') : ''} 
                        onChange={e => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setFormData({...formData, asCost: val === '' ? 0 : Number(val)});
                        }} 
                        className="h-10 border-zinc-200 font-bold" 
                        placeholder="0"
                      />
                    ) : (
                      <p className="text-[15px] font-bold text-zinc-800">{formatAmount(formData.asCost)}</p>
                    )}
                  </div>
                  <div className="p-5 space-y-2">
                    <Label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-0.5 flex items-center justify-between">
                      AS 접수비 (멜레아) <span className="text-[9px] text-orange-500 font-bold ml-1">VAT 별도</span>
                    </Label>
                    {isEditing || status === 'in-progress' ? (
                      <Input 
                        type="text" 
                        value={formData.receptionFee ? formData.receptionFee.toLocaleString('ko-KR') : ''} 
                        onChange={e => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setFormData({...formData, receptionFee: val === '' ? 0 : Number(val)});
                        }} 
                        className="h-10 border-zinc-200 font-bold" 
                        placeholder="0"
                      />
                    ) : (
                      <p className="text-[15px] font-bold text-zinc-800">{formatAmount(formData.receptionFee)}</p>
                    )}
                  </div>
                  <div className="p-5 space-y-1 bg-white">
                    <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-0.5">최종 합계</p>
                    <p className="text-xl font-black text-orange-600 tracking-tight">{totalAmount.toLocaleString()}원</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 divide-x divide-zinc-100 border-b border-zinc-100">
                  <div className="p-5 space-y-1 bg-white">
                    <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-0.5">정산월</p>
                    {isEditing || status === 'in-progress' || (status === 'completed' && !formData.settlementMonth) ? (
                      <Input 
                        type="month" 
                        value={formData.settlementMonth} 
                        onChange={e => setFormData({...formData, settlementMonth: e.target.value})} 
                        className="h-9 w-full border-zinc-200 bg-white font-bold text-sm" 
                      />
                    ) : (
                      <p className="text-[15px] font-bold text-zinc-800">{formatSettlementMonth(formData.settlementMonth)}</p>
                    )}
                  </div>
                  <div className="p-5 space-y-1 bg-white">
                    <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-0.5">AS 처리완료일</p>
                    {isEditing || status === 'in-progress' ? (
                      <Input 
                        type="date" 
                        value={formData.processedDate || ''} 
                        onChange={e => setFormData({...formData, processedDate: e.target.value})} 
                        className="h-9 w-full border-zinc-200 bg-white font-bold text-sm" 
                      />
                    ) : (
                      <p className="text-[15px] font-bold text-zinc-800">{formData.processedDate || '-'}</p>
                    )}
                  </div>
                </div>

                <div className="p-5 bg-zinc-50/20 flex items-center italic text-[12px] text-zinc-400 font-medium border-b border-zinc-100">
                  * 모든 금액은 부가세(VAT) 별도 기준입니다.
                </div>

                <div className="p-5">
                  <DataField label="수리 처리내역" value={formData.processingDetails} isEditing={isEditing || status === 'in-progress'} fullWidth
                    input={<Textarea value={formData.processingDetails} onChange={e => setFormData({...formData, processingDetails: e.target.value})} placeholder="상세 처리 내역을 입력하세요" className="min-h-[100px] border-zinc-200 resize-none" />}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 액션 */}
        <DialogFooter className="px-8 py-6 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between sm:justify-between w-full">
          <Button variant="ghost" onClick={handleDelete} className="text-zinc-400 hover:text-rose-600 font-bold text-xs h-10 px-4">
            <Trash2 className="h-4 w-4 mr-2" />접수 삭제
          </Button>
          
          <div className="flex items-center gap-3">
            {status === 'received' && (
              <Button 
                onClick={() => onUpdate(request.id, { 
                  status: 'in-progress',
                  settlementMonth: new Date().toISOString().slice(0, 7)
                })} 
                className="bg-orange-600 hover:bg-orange-700 text-white font-black rounded-xl h-11 px-10 shadow-lg transition-all active:scale-95"
              >
                접수완료 처리 <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
                          {status === 'in-progress' && (
                            <>
                              <Button 
                                variant="ghost" 
                                onClick={() => {
                                  setConfirmConfig({
                                    open: true,
                                    title: '단계 되돌리기',
                                    description: '이 건을 다시 AS 접수(1단계) 상태로 되돌리겠습니까?',
                                    action: () => onUpdate(request.id, { status: 'received' })
                                  })
                                }} 
                                className="text-zinc-400 hover:text-orange-600 font-bold h-11 px-4"
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />접수 단계로 이동
                              </Button>                <Button 
                  variant="outline"
                  onClick={handleSave} 
                  disabled={isSaving}
                  className="border-zinc-200 text-zinc-900 font-black rounded-xl h-11 px-10 shadow-sm hover:bg-zinc-50 transition-all active:scale-95"
                >
                  {isSaving ? '저장 중...' : '즉시저장'} <Save className="h-4 w-4 ml-2" />
                </Button>
              </>
            )}
                          {status === 'completed' && (
                            <>
                              <Button 
                                variant="ghost" 
                                onClick={() => {
                                  setConfirmConfig({
                                    open: true,
                                    title: '단계 되돌리기',
                                    description: '이 건을 다시 AS 처리중(2단계) 상태로 되돌리겠습니까?',
                                    action: () => onUpdate(request.id, { status: 'in-progress' })
                                  })
                                }} 
                                className="text-zinc-400 hover:text-teal-600 font-bold h-11 px-4"
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />AS 처리 단계로 이동
                              </Button>                <Button 
                  variant="outline"
                  onClick={handleSave} 
                  disabled={isSaving}
                  className="border-zinc-200 text-zinc-900 font-black rounded-xl h-11 px-10 shadow-sm hover:bg-zinc-50 transition-all active:scale-95"
                >
                  {isSaving ? '저장 중...' : '즉시저장'} <Save className="h-4 w-4 ml-2" />
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
              </DialogContent>
            </Dialog>
      
            {/* 커스텀 확인 다이얼로그 */}
            <AlertDialog 
              open={confirmConfig.open} 
              onOpenChange={(open) => setConfirmConfig(prev => ({ ...prev, open }))}
            >
              <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-xl font-black text-slate-900">
                    {confirmConfig.title}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-[14.5px] font-medium text-slate-500 leading-relaxed pt-2">
                    {confirmConfig.description}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-6 gap-2">
                  <AlertDialogCancel className="rounded-xl font-bold border-slate-200 h-11">
                    취소
                  </AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => {
                      confirmConfig.action();
                      setConfirmConfig(prev => ({ ...prev, open: false }));
                    }} 
                    className={`rounded-xl font-bold h-11 px-6 ${confirmConfig.variant === 'destructive' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                  >
                    확인
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )
      }
function DataField({ label, value, isEditing, input, fullWidth = false }: { label: string; value?: string | number; isEditing: boolean; input: React.ReactNode; fullWidth?: boolean }) {
  if (isEditing) {
    return (
      <div className={`p-5 space-y-2 ${fullWidth ? 'w-full' : ''}`}>
        <Label className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-0.5">{label}</Label>
        {input}
      </div>
    )
  }
  return (
    <div className={`p-5 space-y-1.5 ${fullWidth ? 'w-full' : ''}`}>
      <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-0.5">{label}</p>
      <p className={`text-[15px] font-bold text-zinc-800 leading-snug ${fullWidth ? '' : 'truncate'}`}>
        {value || <span className="text-zinc-200 font-medium italic text-[13px]">미입력</span>}
      </p>
    </div>
  )
}

function SelectInput({ value, options, onChange }: { value?: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 rounded-xl text-[12px] font-extrabold border transition-all
            ${value === opt ? 'bg-zinc-900 border-zinc-900 text-white shadow-md' : 'bg-white border-zinc-200 text-slate-500 hover:border-zinc-300 hover:bg-zinc-50'}`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}
