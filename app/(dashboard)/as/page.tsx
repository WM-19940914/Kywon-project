/**
 * AS 관리 페이지
 *
 * 교원그룹에서 에어컨 AS 요청이 들어오면
 * 멜레아가 삼성AS센터에 연결하고 비용을 관리합니다.
 *
 * 4탭 구조: AS접수 / AS처리중 / 정산대기 / 정산완료
 */

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { fetchASRequests, createASRequest, updateASRequest, deleteASRequest, batchUpdateASStatus } from '@/lib/supabase/dal'
import type { ASRequest } from '@/types/as'
import type { ASRequestStatus } from '@/types/as'
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
import { Wrench, Plus, CheckCircle2, Search, ChevronLeft, ChevronRight, FileText, Receipt, Coins } from 'lucide-react'
import { ExcelExportButton } from '@/components/ui/excel-export-button'
import { exportToExcel, buildExcelFileName, type ExcelColumn } from '@/lib/excel-export'

/** 탭 설정 */
const TAB_CONFIG: { key: ASRequestStatus; label: string }[] = [
  { key: 'received', label: 'AS접수' },
  { key: 'in-progress', label: 'AS처리중' },
  { key: 'completed', label: '정산대기' },
  { key: 'settled', label: '정산완료' },
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

  // 정산대기 월별 필터 — 마운트 시 한 번만 계산
  const [currentMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const settlementMonthOptions = useMemo(() => {
    const [y, m] = currentMonth.split('-').map(Number)
    const options: { label: string; value: string }[] = []
    for (let offset = -1; offset <= 1; offset++) {
      const d = new Date(y, m - 1 + offset, 1)
      const dy = d.getFullYear()
      const dm = d.getMonth() + 1
      const value = `${dy}-${String(dm).padStart(2, '0')}`
      const label = `${dy}년 ${dm}월`
      options.push({ label, value })
    }
    return options
  }, [currentMonth])
  const [selectedSettlementMonth, setSelectedSettlementMonth] = useState(currentMonth)

  // 정산완료 탭 월별 필터
  const [settledMonth, setSettledMonth] = useState(currentMonth)

  const navigateSettledMonth = useCallback((direction: -1 | 1) => {
    setSettledMonth(prev => {
      const [y, m] = prev.split('-').map(Number)
      const d = new Date(y, m - 1 + direction, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
  }, [])

  const settledMonthLabel = useMemo(() => {
    const [y, m] = settledMonth.split('-').map(Number)
    return `${y}년 ${m}월`
  }, [settledMonth])

  // 비동기 액션 중복 실행 방지
  const [actionLoading, setActionLoading] = useState(false)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ASRequest | null>(null)

  /** 
   * [일괄 정산 처리 확인창 상태]
   * 여러 건을 한 번에 정산완료 처리할 때, 실수를 막기 위해 예쁜 안내창을 띄우는 용도입니다.
   */
  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false)

  // URL에 ?action=new 가 있으면 AS 접수 다이얼로그 자동 오픈
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('action') === 'new') {
      setFormDialogOpen(true)
    }
  }, [])

  const handleTabChange = useCallback((tab: ASRequestStatus) => {
    setActiveTab(tab)
    setSelectedIds(new Set())
  }, [])

  /** 탭별 건수 */
  const tabCounts = useMemo(() => {
    const counts: Record<ASRequestStatus, number> = { 'received': 0, 'in-progress': 0, 'completed': 0, 'settled': 0 }
    requests.forEach(req => {
      counts[req.status] = (counts[req.status] || 0) + 1
    })
    return counts
  }, [requests])

  /** 필터링 */
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      if (req.status !== activeTab) return false
      if (affiliateFilter !== 'all' && req.affiliate !== affiliateFilter) return false
      if (activeTab === 'completed' && req.settlementMonth !== selectedSettlementMonth) return false
      if (activeTab === 'settled' && req.settlementMonth !== settledMonth) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const searchTarget = [
          req.businessName, req.address, req.asReason, req.modelName, req.contactName,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!searchTarget.includes(q)) return false
      }
      return true
    })
  }, [requests, activeTab, affiliateFilter, searchQuery, selectedSettlementMonth, settledMonth])

  /** 계열사별 그룹핑 */
  const groupedByAffiliate = useMemo(() => {
    if (activeTab !== 'completed' && activeTab !== 'settled') return null
    const groups: Record<string, ASRequest[]> = {}
    AFFILIATE_OPTIONS.forEach(aff => { groups[aff] = [] })
    filteredRequests.forEach(req => {
      const key = req.affiliate || '기타'
      if (!groups[key]) groups[key] = []
      groups[key].push(req)
    })
    return groups
  }, [filteredRequests, activeTab])

  /** 정산 통계 */
  const settlementStats = useMemo(() => {
    if (activeTab !== 'completed' && activeTab !== 'settled') return null
    const totalCount = filteredRequests.length
    const totalAsCost = filteredRequests.reduce((sum, r) => sum + (r.asCost || 0), 0)
    const totalReceptionFee = filteredRequests.reduce((sum, r) => sum + (r.receptionFee || 0), 0)
    const totalAmount = filteredRequests.reduce((sum, r) => sum + (r.totalAmount || 0), 0)
    const affiliateGroups: Record<string, number> = {}
    filteredRequests.forEach(r => {
      const key = r.affiliate || '기타'
      affiliateGroups[key] = (affiliateGroups[key] || 0) + (r.totalAmount || 0)
    })
    const truncatedTotal = Object.values(affiliateGroups).reduce(
      (sum, amt) => sum + Math.floor(amt / 1000) * 1000, 0
    )
    const truncationDiff = totalAmount - truncatedTotal
    return { totalCount, totalAsCost, totalReceptionFee, totalAmount, truncatedTotal, truncationDiff }
  }, [filteredRequests, activeTab])

  const handleRowClick = (req: ASRequest) => {
    setSelectedRequest(req)
    setDetailDialogOpen(true)
  }

  const handleCreate = async (data: Omit<ASRequest, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (actionLoading) return
    setActionLoading(true)
    try {
      const created = await createASRequest(data)
      if (created) {
        setRequests(prev => [created, ...prev])
        showAlert('AS 접수가 완료되었습니다.', 'success')
      } else {
        showAlert('AS 접수에 실패했습니다.', 'error')
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleUpdate = async (id: string, updates: Partial<ASRequest>) => {
    if (actionLoading) return
    setActionLoading(true)
    try {
      const updated = await updateASRequest(id, updates)
      if (updated) {
        setRequests(prev => prev.map(r => r.id === id ? updated : r))
        setSelectedRequest(updated)
        if (updates.status) {
          showAlert(`${AS_STATUS_LABELS[updates.status]}(으)로 변경되었습니다.`, 'success')
        }
      } else {
        showAlert('저장에 실패했습니다.', 'error')
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (actionLoading) return
    setActionLoading(true)
    try {
      const success = await deleteASRequest(id)
      if (success) {
        setRequests(prev => prev.filter(r => r.id !== id))
        showAlert('삭제되었습니다.', 'success')
      } else {
        showAlert('삭제에 실패했습니다.', 'error')
      }
    } finally {
      setActionLoading(false)
    }
  }

  /**
   * [정산완료 일괄 처리 시작]
   * 버튼을 누르면 즉시 처리하지 않고 안내창(AlertDialog)을 먼저 띄웁니다.
   */
  const handleBatchSettleInit = () => {
    if (selectedIds.size === 0) return
    setBatchConfirmOpen(true) // 예쁜 알림창 열기
  }

  /**
   * [정산완료 일괄 처리 확정]
   * 사용자가 안내창에서 [네, 일괄 처리하겠습니다]를 눌렀을 때 실행됩니다.
   */
  const confirmBatchSettle = async () => {
    if (actionLoading) return
    if (selectedIds.size === 0) return

    setActionLoading(true)
    try {
      const ids = Array.from(selectedIds)
      const success = await batchUpdateASStatus(ids, 'settled', selectedSettlementMonth)

      if (success) {
        setRequests(prev => prev.map(r =>
          ids.includes(r.id)
            ? { ...r, status: 'settled' as ASRequestStatus, settlementMonth: selectedSettlementMonth }
            : r
        ))
        setSelectedIds(new Set())
        setBatchConfirmOpen(false) // 창 닫기
        showAlert(`${ids.length}건이 정산완료 처리되었습니다.`, 'success')
      } else {
        showAlert('일괄 변경에 실패했습니다.', 'error')
      }
    } finally {
      setActionLoading(false)
    }
  }

  const handleSelectToggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }, [])

  const handleSelectAll = useCallback((checked: boolean, visibleRequests: ASRequest[]) => {
    if (checked) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        visibleRequests.forEach(r => next.add(r.id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        visibleRequests.forEach(r => next.delete(r.id))
        return next
      })
    }
  }, [])

  /** 엑셀 다운로드 */
  const handleExcelExport = () => {
    const tabLabel = TAB_CONFIG.find(t => t.key === activeTab)?.label || activeTab
    const columns: ExcelColumn<ASRequest>[] = [
      { header: '접수일', key: 'receptionDate', width: 12 },
      { header: '계열사', key: 'affiliate', width: 14 },
      { header: '사업자명', key: 'businessName', width: 20 },
      { header: '주소', getValue: (r) => [r.address, r.detailAddress].filter(Boolean).join(' '), width: 30 },
      { header: '담당자', key: 'contactName', width: 10 },
      { header: '모델명', key: 'modelName', width: 20 },
      { header: 'AS사유', key: 'asReason', width: 20 },
      { header: '방문예정일', key: 'visitDate', width: 12 },
      { header: '처리일', key: 'processedDate', width: 12 },
      { header: 'AS비용', key: 'asCost', width: 12, numberFormat: '#,##0' },
      { header: '접수비', key: 'receptionFee', width: 12, numberFormat: '#,##0' },
      { header: '합계', key: 'totalAmount', width: 12, numberFormat: '#,##0' },
      { header: '정산월', key: 'settlementMonth', width: 10 },
    ]
    exportToExcel({
      data: filteredRequests,
      columns,
      fileName: buildExcelFileName('AS관리', tabLabel),
      sheetName: tabLabel,
    })
  }

  // 스켈레톤 로딩
  if (isLoading) {
    return (
      <div className="container mx-auto max-w-[1400px] py-6 px-4 md:px-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <Skeleton className="h-10 w-full max-w-sm" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
          <Skeleton className="h-8 w-full" />
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-[1400px] py-6 px-4 md:px-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-teal-50 text-teal-600 p-2.5 rounded-xl">
          <Wrench className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AS 관리</h1>
          <p className="text-muted-foreground mt-0.5">교원그룹 에어컨 AS 접수 및 삼성AS센터 연결/비용 관리</p>
        </div>
      </div>

      {/* 탭 (border-b 스타일) — 계열사 역할은 정산대기/정산완료 탭 숨김 */}
      <div className="border-b border-slate-200 mb-6">
        <div className="flex items-center gap-1 -mb-px overflow-x-auto">
          {TAB_CONFIG.filter(tab => {
            if (userProfile?.role === 'affiliate' && (tab.key === 'completed' || tab.key === 'settled')) return false
            return true
          }).map(tab => (
            <button
              key={tab.key}
              className={`pb-3 px-4 text-sm font-medium transition-colors whitespace-nowrap
                ${activeTab === tab.key
                  ? 'border-b-2 border-teal-500 text-teal-600 font-semibold'
                  : 'text-slate-500 hover:text-slate-700'
                }`}
              onClick={() => handleTabChange(tab.key)}
            >
              {tab.label}
              <span className={`ml-1.5 px-2 py-0.5 rounded-full text-xs ${activeTab === tab.key
                  ? 'bg-teal-100 text-teal-600'
                  : 'bg-slate-100 text-slate-500'
                }`}>
                {tabCounts[tab.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 필터 바 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          {/* 정산대기 탭: 월 선택 */}
          {activeTab === 'completed' && (
            <div className="flex items-center gap-1">
              {settlementMonthOptions.map(opt => (
                <button
                  key={opt.value}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${selectedSettlementMonth === opt.value
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  onClick={() => setSelectedSettlementMonth(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* 정산완료 탭: 월 네비게이션 */}
          {activeTab === 'settled' && (
            <div className="flex items-center gap-1">
              <button
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
                onClick={() => navigateSettledMonth(-1)}
              >
                <ChevronLeft className="h-4 w-4 text-slate-600" />
              </button>
              <span className="px-3 py-1.5 text-sm font-semibold text-olive-700 min-w-[100px] text-center">
                {settledMonthLabel}
              </span>
              <button
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
                onClick={() => navigateSettledMonth(1)}
              >
                <ChevronRight className="h-4 w-4 text-slate-600" />
              </button>
            </div>
          )}

          <Select value={affiliateFilter} onValueChange={setAffiliateFilter}>
            <SelectTrigger className="w-[140px] rounded-lg">
              <SelectValue placeholder="전체 계열사" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 계열사</SelectItem>
              {AFFILIATE_OPTIONS.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[200px] max-w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="사업자명, 주소, AS사유 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 rounded-lg bg-white border-slate-200"
            />
          </div>

          {/* 정산완료 일괄 처리 */}
          {activeTab === 'completed' && selectedIds.size > 0 && (
            <Button onClick={handleBatchSettleInit} disabled={actionLoading} className="bg-olive-600 hover:bg-olive-700 text-white rounded-lg">
              <CheckCircle2 className="h-4 w-4 mr-1" />              정산완료 처리 ({selectedIds.size}건)
            </Button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <ExcelExportButton onClick={handleExcelExport} disabled={filteredRequests.length === 0} />
            <Button onClick={() => setFormDialogOpen(true)} className="rounded-lg">
              <Plus className="h-4 w-4 mr-1" />
              AS 접수
            </Button>
          </div>
        </div>
      </div>

      {/* 통계 카드 */}
      {(activeTab === 'completed' || activeTab === 'settled') && settlementStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className={`bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow ${activeTab === 'settled' ? 'border-olive-200' : 'border-teal-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <FileText className={`h-4 w-4 ${activeTab === 'settled' ? 'text-olive-500' : 'text-teal-500'}`} />
              <span className="text-xs text-slate-500">총 건수</span>
            </div>
            <p className={`text-2xl font-bold ${activeTab === 'settled' ? 'text-olive-700' : 'text-teal-700'}`}>
              {settlementStats.totalCount}<span className="text-sm font-medium ml-0.5">건</span>
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="h-4 w-4 text-slate-400" />
              <span className="text-xs text-slate-500">AS 비용 <span className="text-slate-400">(부가세별도)</span></span>
            </div>
            <p className="text-lg font-bold text-slate-700">
              {settlementStats.totalAsCost.toLocaleString('ko-KR')}<span className="text-xs font-medium ml-0.5">원</span>
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="h-4 w-4 text-slate-400" />
              <span className="text-xs text-slate-500">접수비 <span className="text-slate-400">(부가세별도)</span></span>
            </div>
            <p className="text-lg font-bold text-slate-700">
              {settlementStats.totalReceptionFee.toLocaleString('ko-KR')}<span className="text-xs font-medium ml-0.5">원</span>
            </p>
          </div>
          <div className={`bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow ${activeTab === 'settled' ? 'border-olive-200' : 'border-teal-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Coins className={`h-4 w-4 ${activeTab === 'settled' ? 'text-olive-500' : 'text-teal-500'}`} />
              <span className="text-xs text-slate-500">합계</span>
              {settlementStats.truncationDiff > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-brick-50 text-[10px] text-brick-400">
                  절사 -{settlementStats.truncationDiff.toLocaleString('ko-KR')}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1.5">
              <p className={`text-2xl font-bold ${activeTab === 'settled' ? 'text-olive-700' : 'text-teal-700'}`}>
                {settlementStats.truncatedTotal.toLocaleString('ko-KR')}
              </p>
              <span className={`text-sm font-medium ${activeTab === 'settled' ? 'text-olive-600' : 'text-teal-600'}`}>원</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-50 text-[10px] text-slate-400 border border-slate-200">VAT별도</span>
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <p className={`text-base font-semibold ${activeTab === 'settled' ? 'text-olive-600/70' : 'text-teal-600/70'}`}>
                {Math.round(settlementStats.truncatedTotal * 1.1).toLocaleString('ko-KR')}
              </p>
              <span className="text-xs text-slate-400">원</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-50 text-[10px] text-slate-400 border border-slate-200">VAT포함</span>
            </div>
          </div>
        </div>
      )}

      {/* 테이블 / 빈 상태 */}
      {filteredRequests.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={searchQuery || affiliateFilter !== 'all'
            ? '검색 결과가 없습니다'
            : `${AS_STATUS_LABELS[activeTab]} 상태의 AS 요청이 없습니다`
          }
          description="검색 조건을 변경하거나 새 AS를 접수하세요"
        />
      ) : (activeTab === 'completed' || activeTab === 'settled') && groupedByAffiliate ? (
        <div className="space-y-6">
          {Object.entries(groupedByAffiliate).map(([affiliate, reqs]) => (
            <div key={affiliate}>
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-700">{affiliate}</h3>
                <span className="text-[11px] text-slate-400">{reqs.length}건</span>
                {reqs.length > 0 && (() => {
                  const rawTotal = reqs.reduce((sum, r) => sum + (r.totalAmount || 0), 0)
                  const truncated = Math.floor(rawTotal / 1000) * 1000
                  const diff = rawTotal - truncated
                  return (
                    <div className="flex items-center gap-1 ml-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-[11px] text-slate-500">
                        합계 <span className="font-semibold text-slate-700">{rawTotal.toLocaleString('ko-KR')}</span>
                      </span>
                      {diff > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-brick-50 text-[11px] text-brick-400">
                          절사 <span className="font-medium">-{diff.toLocaleString('ko-KR')}</span>
                        </span>
                      )}
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold ${activeTab === 'settled'
                          ? 'bg-olive-50 text-olive-700 border border-olive-200'
                          : 'bg-teal-50 text-teal-700 border border-teal-200'
                        }`}>
                        소계 {truncated.toLocaleString('ko-KR')}원
                      </span>
                      <span className="text-[10px] text-slate-400">[VAT별도]</span>
                    </div>
                  )
                })()}
              </div>
              {reqs.length > 0 ? (
                <ASTable
                  requests={reqs}
                  activeTab={activeTab}
                  onRowClick={handleRowClick}
                  selectedIds={selectedIds}
                  onSelectToggle={handleSelectToggle}
                  onSelectAll={(checked) => handleSelectAll(checked, reqs)}
                />
              ) : (
                <div className="border border-slate-200 rounded-xl bg-slate-50 py-4 text-center text-sm text-slate-400">
                  해당 월 AS 건이 없습니다
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <ASTable
          requests={filteredRequests}
          activeTab={activeTab}
          onRowClick={handleRowClick}
          selectedIds={selectedIds}
          onSelectToggle={handleSelectToggle}
          onSelectAll={(checked) => handleSelectAll(checked, filteredRequests)}
        />
      )}

      <ASFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        onSubmit={handleCreate}
      />

      <ASDetailDialog
        request={selectedRequest}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      {/* 
          정산완료 일괄 처리용 '예쁜 확인창' (AlertDialog)
          실수로 대량의 데이터가 변경되는 것을 방지합니다.
      */}
      <AlertDialog open={batchConfirmOpen} onOpenChange={setBatchConfirmOpen}>
        <AlertDialogContent className="max-w-[420px] border-2 border-olive-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <div className="bg-olive-100 p-1.5 rounded-full">
                <CheckCircle2 className="h-5 w-5 text-olive-600" />
              </div>
              정산완료 일괄 처리
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-3 pb-2 text-base text-slate-600">
              <span className="font-bold text-olive-700 text-lg">{selectedIds.size}</span>개의 AS 처리 건을 한 번에
              <span className="font-bold text-slate-800"> [정산완료]</span> 상태로 변경하시겠습니까?
              <br /><br />
              <span className="text-sm text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 block">
                선택된 월: <span className="font-semibold">{selectedSettlementMonth}</span>
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 mt-4">
            <AlertDialogCancel className="rounded-xl border-slate-200 hover:bg-slate-50 font-semibold h-11">
              아니요, 취소할게요
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBatchSettle}
              className="bg-olive-600 hover:bg-olive-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 h-11"
            >
              네, 일괄 처리하겠습니다
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
