/**
 * AS 관리 페이지
 * 
 * [개편 사항]
 * 1. 워크플로우 중심의 스텝 인디케이터 도입
 * 2. 탭 UI를 프로세스 흐름도 형태로 변경
 * 3. 상태별 맞춤형 통계 및 필터 제공
 */

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { fetchASRequests, createASRequest, updateASRequest, deleteASRequest, batchUpdateASStatus } from '@/lib/supabase/dal'
import type { ASRequest, ASRequestStatus } from '@/types/as'
import { AS_STATUS_LABELS } from '@/types/as'
import { AFFILIATE_OPTIONS } from '@/types/order'
import { ASTable } from '@/components/as/as-table'
import { ASFormDialog } from '@/components/as/as-form-dialog'
import { ASDetailDialog } from '@/components/as/as-detail-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAlert } from '@/components/ui/custom-alert'
import { useUserProfile } from '@/lib/auth/user-context'
import { 
  Wrench, 
  Plus, 
  CheckCircle2, 
  Search, 
  ArrowRight,
  ClipboardCheck,
  PlayCircle,
  Banknote,
  LucideIcon
} from 'lucide-react'
import { ExcelExportButton } from '@/components/ui/excel-export-button'
import { exportToExcel, buildExcelFileName, type ExcelColumn } from '@/lib/excel-export'

/** 프로세스 단계 설정 */
const PROCESS_STEPS: { key: ASRequestStatus; label: string; icon: LucideIcon; color: string; desc: string }[] = [
  { key: 'received', label: 'AS접수', icon: ClipboardCheck, color: 'text-blue-500', desc: '새로 접수된 요청' },
  { key: 'in-progress', label: 'AS처리중', icon: PlayCircle, color: 'text-amber-500', desc: '기사 방문 및 수리중' },
  { key: 'completed', label: '정산대기', icon: Banknote, color: 'text-teal-500', desc: '금월 정산 대기중' },
  { key: 'settled', label: '정산완료', icon: CheckCircle2, color: 'text-slate-500', desc: '과거 정산완료 내역' },
]

export default function ASPage() {
  const { showAlert } = useAlert()
  const userProfile = useUserProfile()

  const [requests, setRequests] = useState<ASRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchASRequests().then(data => {
      setRequests(data)
      setIsLoading(false)
    })
  }, [])

  const [activeTab, setActiveTab] = useState<ASRequestStatus>('received')
  const [affiliateFilter, setAffiliateFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // 정산 관련 날짜 상태
  const [currentMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [selectedSettlementMonth, setSelectedSettlementMonth] = useState(currentMonth)
  
  // 정산완료 탭 전용 상태
  const [settledViewMode, setSettledViewMode] = useState<'monthly' | 'all'>('monthly')
  const [selectedSettledMonth, setSelectedSettledMonth] = useState(currentMonth)

  // 비동기 액션 로딩
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ASRequest | null>(null)
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false)

  // URL 파라미터 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('action') === 'new') setFormDialogOpen(true)
  }, [])

  const handleTabChange = useCallback((tab: ASRequestStatus) => {
    setActiveTab(tab)
    setSelectedIds(new Set())
  }, [])

  /** 단계별 건수 계산 */
  const stepCounts = useMemo(() => {
    const counts: Record<ASRequestStatus, number> = { 'received': 0, 'in-progress': 0, 'completed': 0, 'settled': 0 }
    requests.forEach(req => { counts[req.status] = (counts[req.status] || 0) + 1 })
    return counts
  }, [requests])

  /** 필터링 로직 (최신순 정렬 포함) */
  const filteredRequests = useMemo(() => {
    return requests
      .filter(req => {
        if (req.status !== activeTab) return false
        if (affiliateFilter !== 'all' && req.affiliate !== affiliateFilter) return false
        
        // 정산대기 탭 필터
        if (activeTab === 'completed' && req.settlementMonth !== selectedSettlementMonth) return false
        
        // 정산완료 탭 필터 (전체보기 vs 월별보기)
        if (activeTab === 'settled') {
          if (settledViewMode === 'monthly' && req.settlementMonth !== selectedSettledMonth) return false
        }

        if (searchQuery) {
          const q = searchQuery.toLowerCase()
          const target = [req.businessName, req.address, req.asReason, req.modelName, req.contactName].filter(Boolean).join(' ').toLowerCase()
          if (!target.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => new Date(b.receptionDate).getTime() - new Date(a.receptionDate).getTime()) // 최신순 정렬 추가
  }, [requests, activeTab, affiliateFilter, searchQuery, selectedSettlementMonth, settledViewMode, selectedSettledMonth])

  // 정산 통계 계산 (계열사별 절사 로직 반영)
  const stats = useMemo(() => {
    if (activeTab !== 'completed' && activeTab !== 'settled') return null
    
    const totalCount = filteredRequests.length
    
    // 계열사별로 그룹화하여 각각 절사 후 합산
    const grouped = filteredRequests.reduce((acc, req) => {
      if (!acc[req.affiliate]) acc[req.affiliate] = 0;
      acc[req.affiliate] += (Number(req.asCost) || 0) + (Number(req.receptionFee) || 0);
      return acc;
    }, {} as Record<string, number>);

    let totalSubtotal = 0; // 절사 후 합계(VAT별도)
    Object.values(grouped).forEach(affTotal => {
      totalSubtotal += Math.floor(affTotal / 1000) * 1000;
    });

    const finalGrandTotal = Math.round(totalSubtotal * 1.1); // 최종 정산금액(VAT포함)

    return { totalCount, totalSubtotal, finalGrandTotal }
  }, [filteredRequests, activeTab])

  // 핸들러들 (기존 로직 유지)
  const handleCreate = async (data: Omit<ASRequest, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const created = await createASRequest(data)
      if (created) {
        setRequests(prev => [created, ...prev])
        showAlert('AS 접수가 완료되었습니다.', 'success')
      }
    } catch (error) {
      console.error(error)
    }
  }

  const handleUpdate = async (id: string, updates: Partial<ASRequest>) => {
    try {
      // 2단계(in-progress)로 상태 변경 시 정산월 자동 설정
      const finalUpdates = { ...updates }
      if (updates.status === 'in-progress' && !updates.settlementMonth) {
        finalUpdates.settlementMonth = new Date().toISOString().slice(0, 7)
      }

      const updated = await updateASRequest(id, finalUpdates)
      if (updated) {
        setRequests(prev => prev.map(r => r.id === id ? updated : r))
        setSelectedRequest(updated)
        
        // 상태값만 단독으로 변경된 경우 (테이블 버튼 클릭 등)
        if (Object.keys(updates).length === 1 && updates.status) {
          showAlert(`${AS_STATUS_LABELS[updates.status as ASRequestStatus]}(으)로 변경되었습니다.`, 'success')
        } else {
          // 그 외의 경우 (상세 팝업에서 수정 저장 등)
          showAlert('수정이 완료되었습니다.', 'success')
        }
      }
    } catch (error) {
      console.error(error)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const success = await deleteASRequest(id)
      if (success) {
        setRequests(prev => prev.filter(r => r.id !== id))
        showAlert('삭제되었습니다.', 'success')
      }
    } catch (error) {
      console.error(error)
    }
  }

  const confirmBatchSettle = async () => {
    if (selectedIds.size === 0) return
    try {
      const ids = Array.from(selectedIds)
      const success = await batchUpdateASStatus(ids, 'settled', selectedSettlementMonth)
      if (success) {
        setRequests(prev => prev.map(r => ids.includes(r.id) ? { ...r, status: 'settled', settlementMonth: selectedSettlementMonth } as ASRequest : r))
        setSelectedIds(new Set())
        setBatchConfirmOpen(false)
        showAlert(`${ids.length}건이 정산완료 처리되었습니다.`, 'success')
      }
    } catch (error) {
      console.error(error)
      showAlert('일괄 처리에 실패했습니다.', 'error')
    }
  }

  const handleExcelExport = () => {
    const tabLabel = AS_STATUS_LABELS[activeTab]
    
    // 엑셀 데이터용 실시간 합계 계산 반영
    const exportData = filteredRequests.map(req => ({
      ...req,
      totalAmount: (Number(req.asCost) || 0) + (Number(req.receptionFee) || 0)
    }))

    const columns: ExcelColumn<ASRequest>[] = [
      { header: '접수일', key: 'receptionDate', width: 12 },
      { header: '계열사', key: 'affiliate', width: 14 },
      { header: '사업자명', key: 'businessName', width: 20 },
      { header: 'AS사유', key: 'asReason', width: 25 },
      { header: '합계(VAT별도)', key: 'totalAmount', width: 15, numberFormat: '#,##0' },
    ]
    exportToExcel({ data: exportData, columns, fileName: buildExcelFileName('AS관리', tabLabel), sheetName: tabLabel })
  }

  if (isLoading) {
    return <div className="p-8 space-y-6"><Skeleton className="h-20 w-full rounded-2xl" /><Skeleton className="h-64 w-full rounded-2xl" /></div>
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-2">
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <div className="p-2 bg-[#E09520] rounded-xl shadow-lg shadow-orange-200">
              <Wrench className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            AS 접수 및 현황
          </h1>
          <p className="text-[13.5px] font-medium text-slate-400 pl-11">
            교원그룹 에어컨 AS 요청의 접수부터 최종 정산까지의 프로세스를 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExcelExportButton onClick={handleExcelExport} disabled={filteredRequests.length === 0} />
          <Button onClick={() => setFormDialogOpen(true)} className="bg-[#E09520] hover:bg-[#c87d1a] text-white font-black rounded-xl px-4 h-9.5 shadow-md shadow-orange-100 transition-all active:scale-95 text-[13px]">
            <Plus className="h-4 w-4 mr-1.5" strokeWidth={3} />
            AS 접수
          </Button>
        </div>
      </div>

      {/* ── [핵심] 프로세스 스텝 인디케이터 ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {PROCESS_STEPS.filter(step => {
          if (userProfile?.role === 'affiliate' && (step.key === 'completed' || step.key === 'settled')) return false
          return true
        }).map((step, index) => {
          const isActive = activeTab === step.key
          const StepIcon = step.icon
          
          return (
            <button
              key={step.key}
              onClick={() => handleTabChange(step.key)}
              className={`relative flex flex-col p-4 rounded-2xl border transition-all duration-300 text-left group
                ${isActive 
                  ? 'bg-white border-orange-200 shadow-xl shadow-orange-50 z-10 scale-[1.02]' 
                  : 'bg-slate-50/50 border-slate-200 hover:bg-white hover:border-slate-300'}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-xl transition-colors ${isActive ? 'bg-[#E09520] text-white' : 'bg-slate-200/50 text-slate-400 group-hover:bg-slate-200'}`}>
                  <StepIcon className="h-5 w-5" strokeWidth={2.5} />
                </div>
                <div className={`text-xl font-black tabular-nums ${isActive ? 'text-[#E09520]' : 'text-slate-300'}`}>
                  {stepCounts[step.key]}
                </div>
              </div>
              <div>
                <h3 className={`text-[15px] font-bold tracking-tight ${isActive ? 'text-slate-900' : 'text-slate-500'}`}>
                  {step.label}
                </h3>
                <p className={`text-[11.5px] font-medium mt-0.5 ${isActive ? 'text-orange-600/80' : 'text-slate-400'}`}>
                  {step.desc}
                </p>
              </div>
              
              {/* 화살표 장식 (마지막 단계 제외) */}
              {index < PROCESS_STEPS.length - 1 && (
                <div className="hidden lg:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-20 pointer-events-none">
                  <div className="p-1 rounded-full bg-white shadow-md border border-slate-100">
                    <ArrowRight className="h-3 w-3 text-slate-300" strokeWidth={3} />
                  </div>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* 필터 및 검색 영역 */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="사업자명, 주소, AS 사유로 검색..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 h-11 bg-slate-50/50 border-slate-200 rounded-xl focus:bg-white transition-all"
          />
        </div>

        <Select value={affiliateFilter} onValueChange={setAffiliateFilter}>
          <SelectTrigger className="w-[160px] h-11 rounded-xl border-slate-200 bg-slate-50/50">
            <SelectValue placeholder="전체 계열사" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 계열사</SelectItem>
            {AFFILIATE_OPTIONS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* 정산대기 탭 전용 월 필터: 년도 / < 월 > 네비게이션 */}
        {activeTab === 'completed' && (
          <div className="flex items-center bg-white border border-slate-200 rounded-xl h-11 px-1 overflow-hidden shadow-sm">
            <div className="px-3 border-r border-slate-100 flex items-center gap-2">
              <span className="text-[13px] font-black text-slate-900">
                {selectedSettlementMonth.split('-')[0]}년
              </span>
            </div>
            
            <div className="flex items-center gap-1 px-1">
              <button
                onClick={() => {
                  const [y, m] = selectedSettlementMonth.split('-').map(Number);
                  const d = new Date(y, m - 2, 1);
                  setSelectedSettlementMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                }}
                className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-orange-600 transition-all"
              >
                <ArrowRight className="h-4 w-4 rotate-180" strokeWidth={3} />
              </button>
              
              <div className="px-3 min-w-[60px] text-center">
                <span className="text-[14px] font-black text-orange-600">
                  {parseInt(selectedSettlementMonth.split('-')[1])}월
                </span>
              </div>
              
              <button
                onClick={() => {
                  const [y, m] = selectedSettlementMonth.split('-').map(Number);
                  const d = new Date(y, m, 1);
                  setSelectedSettlementMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                }}
                className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-orange-600 transition-all"
              >
                <ArrowRight className="h-4 w-4" strokeWidth={3} />
              </button>
            </div>
          </div>
        )}

        {/* 정산완료 탭 전용 필터: 전체보기 / 년도 / < 월 > 네비게이션 */}
        {activeTab === 'settled' && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSettledViewMode('all')}
              className={`px-4 h-11 text-xs font-bold rounded-xl border transition-all 
                ${settledViewMode === 'all' 
                  ? 'bg-zinc-900 border-zinc-900 text-white shadow-md' 
                  : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              전체보기
            </button>
            
            <div className="flex items-center bg-white border border-slate-200 rounded-xl h-11 px-1 overflow-hidden shadow-sm">
              <div className="px-3 border-r border-slate-100 flex items-center gap-2">
                <span className="text-[13px] font-black text-slate-900">
                  {selectedSettledMonth.split('-')[0]}년
                </span>
              </div>
              
              <div className="flex items-center gap-1 px-1">
                <button
                  onClick={() => {
                    setSettledViewMode('monthly');
                    const [y, m] = selectedSettledMonth.split('-').map(Number);
                    const d = new Date(y, m - 2, 1);
                    setSelectedSettledMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                  }}
                  className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-orange-600 transition-all"
                >
                  <ArrowRight className="h-4 w-4 rotate-180" strokeWidth={3} />
                </button>
                
                <div className={`px-3 min-w-[60px] text-center transition-all ${settledViewMode === 'monthly' ? 'opacity-100' : 'opacity-30'}`}>
                  <span className="text-[14px] font-black text-orange-600">
                    {parseInt(selectedSettledMonth.split('-')[1])}월
                  </span>
                </div>
                
                <button
                  onClick={() => {
                    setSettledViewMode('monthly');
                    const [y, m] = selectedSettledMonth.split('-').map(Number);
                    const d = new Date(y, m, 1);
                    setSelectedSettledMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                  }}
                  className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-orange-600 transition-all"
                >
                  <ArrowRight className="h-4 w-4" strokeWidth={3} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 정산 일괄 처리 버튼 */}
        {activeTab === 'completed' && selectedIds.size > 0 && (
          <Button onClick={() => setBatchConfirmOpen(true)} className="bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl h-11 shadow-md shadow-orange-100">
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            정산완료 처리 ({selectedIds.size}건)
          </Button>
        )}
      </div>

      {/* 정산 통계 카드 (정산대기/완료 탭에서만 노출) */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">전체 정산 건수</p>
            <p className="text-2xl font-black text-slate-900">{stats.totalCount}<span className="text-sm font-bold ml-1 text-slate-400">건</span></p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">총 합계 (VAT 별도 / 절사 반영)</p>
            <p className="text-2xl font-black text-slate-700">{stats.totalSubtotal.toLocaleString()}<span className="text-sm font-bold ml-1 text-slate-400">원</span></p>
          </div>
          <div className="bg-white p-5 rounded-2xl border-2 border-orange-100 shadow-lg shadow-orange-50">
            <p className="text-[11px] font-bold text-orange-500 uppercase tracking-wider mb-1 text-center">최종 정산 합계 (VAT 포함)</p>
            <p className="text-3xl font-black text-[#E09520] text-center">{stats.finalGrandTotal.toLocaleString()}<span className="text-base font-bold ml-1">원</span></p>
          </div>
        </div>
      )}

      {/* 메인 리스트 영역 */}
      <div className="space-y-8">
        {filteredRequests.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/20 py-20">
            <EmptyState
              icon={Wrench}
              title={`${AS_STATUS_LABELS[activeTab]} 내역이 없습니다`}
              description="필터 조건을 변경하거나 새로운 AS를 등록해 보세요."
            />
          </div>
        ) : (activeTab === 'completed' || activeTab === 'settled') ? (
          /* 정산대기 & 정산완료 탭: 계열사별 그룹화 뷰 (항상 모든 계열사 노출) */
          (() => {
            const grouped = filteredRequests.reduce((acc, req) => {
              if (!acc[req.affiliate]) acc[req.affiliate] = [];
              acc[req.affiliate].push(req);
              return acc;
            }, {} as Record<string, ASRequest[]>);

            return (AFFILIATE_OPTIONS as unknown as string[]).map((affiliate) => {
              const affiliateRequests = grouped[affiliate] || [];
              const tabLabel = AS_STATUS_LABELS[activeTab];
              
              return (
                <div key={affiliate} className="space-y-4">
                  <div className="flex items-center justify-between px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-8 bg-[#E09520] rounded-full" />
                      <h2 className="text-xl font-black text-slate-900">{affiliate}</h2>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${affiliateRequests.length > 0 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'}`}>
                        {affiliateRequests.length}건
                      </span>
                    </div>
                    {affiliateRequests.length > 0 && (() => {
                      const subTotal = affiliateRequests.reduce((sum, r) => sum + (Number(r.asCost) || 0) + (Number(r.receptionFee) || 0), 0);
                      const truncatedTotal = Math.floor(subTotal / 1000) * 1000;
                      const discountAmount = subTotal - truncatedTotal;
                      const finalVatIncluded = Math.round(truncatedTotal * 1.1);
                      
                      return (
                        <div className="flex items-center bg-slate-50/80 px-5 py-2.5 rounded-2xl border border-slate-100 gap-6 text-right">
                          <div className="flex flex-col">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">부가세 별도</p>
                            <p className="text-[13.5px] font-bold text-slate-600">{subTotal.toLocaleString()}</p>
                          </div>
                          
                          <div className="w-px h-6 bg-slate-200/60" />
                          
                          <div className="flex flex-col">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">단위절사</p>
                            <p className={`text-[13.5px] font-bold ${discountAmount > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                              -{discountAmount.toLocaleString()}
                            </p>
                          </div>
                          
                          <div className="w-px h-6 bg-slate-200/60" />
                          
                          <div className="flex flex-col">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">소계</p>
                            <p className="text-[13.5px] font-bold text-slate-800">{truncatedTotal.toLocaleString()}</p>
                          </div>
                          
                          <div className="w-px h-6 bg-slate-200/60" />
                          
                          <div className="flex flex-col">
                            <p className="text-[10px] font-bold text-[#E09520]/70 uppercase tracking-tighter mb-0.5">부가세포함</p>
                            <p className="text-[16px] font-black text-[#E09520] leading-none">{finalVatIncluded.toLocaleString()}원</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/20 overflow-hidden">
                    {affiliateRequests.length === 0 ? (
                      <div className="py-12 bg-slate-50/30 flex flex-col items-center justify-center border-t border-slate-100">
                        <div className="p-3 bg-white rounded-2xl shadow-sm mb-3">
                          <Wrench className="h-6 w-6 text-slate-200" />
                        </div>
                        <p className="text-[13px] font-bold text-slate-300">해당 계열사의 {tabLabel} 내역이 없습니다.</p>
                      </div>
                    ) : (
                      <ASTable
                        requests={affiliateRequests}
                        activeTab={activeTab}
                        onRowClick={(req) => { setSelectedRequest(req); setDetailDialogOpen(true); }}
                        onStatusChange={(id, newStatus) => handleUpdate(id, { status: newStatus })}
                        selectedIds={selectedIds}
                        onSelectToggle={(id) => {
                          const next = new Set(selectedIds);
                          if (next.has(id)) next.delete(id); else next.add(id);
                          setSelectedIds(next);
                        }}
                        onSelectAll={(checked) => {
                          const next = new Set(selectedIds);
                          affiliateRequests.forEach(r => {
                            if (checked) next.add(r.id); else next.delete(r.id);
                          });
                          setSelectedIds(next);
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            });
          })()
        ) : (
          /* 일반 탭: 단일 테이블 뷰 */
          <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-200/20 overflow-hidden">
            <ASTable
              requests={filteredRequests}
              activeTab={activeTab}
              onRowClick={(req) => { setSelectedRequest(req); setDetailDialogOpen(true); }}
              onStatusChange={(id, newStatus) => handleUpdate(id, { status: newStatus })}
              selectedIds={selectedIds}
              onSelectToggle={(id) => {
                const next = new Set(selectedIds);
                if (next.has(id)) next.delete(id); else next.add(id);
                setSelectedIds(next);
              }}
              onSelectAll={(checked) => {
                if (checked) setSelectedIds(new Set(filteredRequests.map(r => r.id)));
                else setSelectedIds(new Set());
              }}
            />
          </div>
        )}
      </div>

      {/* 다이얼로그들 */}
      <ASFormDialog open={formDialogOpen} onOpenChange={setFormDialogOpen} onSubmit={handleCreate} />
      <ASDetailDialog
        request={selectedRequest}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      <AlertDialog open={batchConfirmOpen} onOpenChange={setBatchConfirmOpen}>
        <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black text-slate-900">정산완료 일괄 처리</AlertDialogTitle>
            <AlertDialogDescription className="text-[14.5px] font-medium text-slate-500 leading-relaxed pt-2">
              선택하신 <span className="text-blue-600 font-bold">{selectedIds.size}건</span>의 AS 내역을 모두 <span className="text-slate-900 font-bold">정산완료</span> 상태로 변경하시겠습니까? <br />
              이 작업은 되돌릴 수 없으므로 신중히 진행해 주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel className="rounded-xl font-bold border-slate-200 h-11">취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBatchSettle} className="rounded-xl font-bold bg-teal-600 hover:bg-teal-700 h-11 px-6">
              네, 일괄 처리합니다
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
