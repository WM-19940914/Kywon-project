/**
 * AS 관리 페이지
 *
 * 교원그룹에서 에어컨 AS 요청이 들어오면
 * 멜레아가 삼성AS센터에 연결하고 비용을 관리합니다.
 *
 * 4탭 구조: AS접수 / AS처리중 / 정산대기 / 정산완료 (건수 표시)
 * 계열사 필터 + 검색창 + [+ AS 접수] 버튼
 * 정산대기 탭: 체크박스 일괄선택 → "정산완료 처리" 버튼
 * 정산완료 탭: 월별 필터 (지난달/이번달/다음달)
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { useAlert } from '@/components/ui/custom-alert'
import { Wrench, Plus, CircleDot, Clock, CreditCard, CheckCircle2, Search, ChevronLeft, ChevronRight, FileText, Receipt, Coins } from 'lucide-react'

/** 탭 설정 (4탭) */
const TAB_CONFIG: { key: ASRequestStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'received', label: 'AS접수', icon: <CircleDot className="h-4 w-4" />, color: 'text-gray-700' },
  { key: 'in-progress', label: 'AS처리중', icon: <Clock className="h-4 w-4" />, color: 'text-orange-600' },
  { key: 'completed', label: '정산대기', icon: <CreditCard className="h-4 w-4" />, color: 'text-blue-600' },
  { key: 'settled', label: '정산완료', icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-green-600' },
]

export default function ASPage() {
  const { showAlert } = useAlert()

  // 데이터 로딩
  const [requests, setRequests] = useState<ASRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchASRequests().then(data => {
      setRequests(data)
      setIsLoading(false)
    })
  }, [])

  // 현재 탭
  const [activeTab, setActiveTab] = useState<ASRequestStatus>('received')

  // 필터
  const [affiliateFilter, setAffiliateFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // 정산대기 월별 필터 (지난달 / 이번달 / 다음달)
  const now = new Date()
  const settlementMonthOptions = useMemo(() => {
    const options: { label: string; value: string }[] = []
    for (let offset = -1; offset <= 1; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
      const y = d.getFullYear()
      const m = d.getMonth() + 1
      const value = `${y}-${String(m).padStart(2, '0')}`
      const label = `${y}년 ${m}월`
      options.push({ label, value })
    }
    return options
  }, [])
  const [selectedSettlementMonth, setSelectedSettlementMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )

  // 정산완료 탭 월별 필터 (과거 어느 달이든 자유롭게 이동 가능)
  const [settledMonth, setSettledMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )

  /** 정산완료 탭: 이전/다음 달 이동 */
  const navigateSettledMonth = useCallback((direction: -1 | 1) => {
    setSettledMonth(prev => {
      const [y, m] = prev.split('-').map(Number)
      const d = new Date(y, m - 1 + direction, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })
  }, [])

  /** 정산완료 월 표시 텍스트 ("2026년 2월") */
  const settledMonthLabel = useMemo(() => {
    const [y, m] = settledMonth.split('-').map(Number)
    return `${y}년 ${m}월`
  }, [settledMonth])

  // 체크박스 선택 상태 (정산대기 탭)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // 다이얼로그 상태
  const [formDialogOpen, setFormDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<ASRequest | null>(null)

  /** 탭 전환 시 선택 초기화 */
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

  /** 필터링된 목록 (탭 + 계열사 + 검색 + 정산월) */
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      if (req.status !== activeTab) return false
      if (affiliateFilter !== 'all' && req.affiliate !== affiliateFilter) return false
      // 정산대기 탭: 정산월 필터 적용
      if (activeTab === 'completed' && req.settlementMonth !== selectedSettlementMonth) return false
      // 정산완료 탭: 정산월 필터 적용
      if (activeTab === 'settled' && req.settlementMonth !== settledMonth) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const searchTarget = [
          req.businessName,
          req.address,
          req.asReason,
          req.modelName,
          req.contactName,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!searchTarget.includes(q)) return false
      }
      return true
    })
  }, [requests, activeTab, affiliateFilter, searchQuery, selectedSettlementMonth, settledMonth])

  /** 정산대기 & 정산완료: 계열사별 그룹핑 (모든 계열사 항상 표시) */
  const groupedByAffiliate = useMemo(() => {
    if (activeTab !== 'completed' && activeTab !== 'settled') return null
    const groups: Record<string, ASRequest[]> = {}
    // 모든 계열사 빈 배열로 초기화
    AFFILIATE_OPTIONS.forEach(aff => { groups[aff] = [] })
    filteredRequests.forEach(req => {
      const key = req.affiliate || '기타'
      if (!groups[key]) groups[key] = []
      groups[key].push(req)
    })
    return groups
  }, [filteredRequests, activeTab])

  /** 정산대기 & 정산완료 탭: 통계 요약 */
  const settlementStats = useMemo(() => {
    if (activeTab !== 'completed' && activeTab !== 'settled') return null
    const totalCount = filteredRequests.length
    const totalAsCost = filteredRequests.reduce((sum, r) => sum + (r.asCost || 0), 0)
    const totalReceptionFee = filteredRequests.reduce((sum, r) => sum + (r.receptionFee || 0), 0)
    const totalAmount = filteredRequests.reduce((sum, r) => sum + (r.totalAmount || 0), 0)
    // 계열사별 절사 후 합산 (각 계열사 소계를 백원단위 절사한 뒤 더함)
    const affiliateGroups: Record<string, number> = {}
    filteredRequests.forEach(r => {
      const key = r.affiliate || '기타'
      affiliateGroups[key] = (affiliateGroups[key] || 0) + (r.totalAmount || 0)
    })
    const truncatedTotal = Object.values(affiliateGroups).reduce(
      (sum, amt) => sum + Math.floor(amt / 1000) * 1000, 0
    )
    const truncationDiff = totalAmount - truncatedTotal  // 전체 절사 금액
    return { totalCount, totalAsCost, totalReceptionFee, totalAmount, truncatedTotal, truncationDiff }
  }, [filteredRequests, activeTab])

  /** 행 클릭 → 상세 다이얼로그 */
  const handleRowClick = (req: ASRequest) => {
    setSelectedRequest(req)
    setDetailDialogOpen(true)
  }

  /** AS 접수 (새 등록) */
  const handleCreate = async (data: Omit<ASRequest, 'id' | 'createdAt' | 'updatedAt'>) => {
    const created = await createASRequest(data)
    if (created) {
      setRequests(prev => [created, ...prev])
      showAlert('AS 접수가 완료되었습니다.', 'success')
    } else {
      showAlert('AS 접수에 실패했습니다.', 'error')
    }
  }

  /** AS 수정 (관리 정보 + 상태 변경) */
  const handleUpdate = async (id: string, updates: Partial<ASRequest>) => {
    const updated = await updateASRequest(id, updates)
    if (updated) {
      setRequests(prev => prev.map(r => r.id === id ? updated : r))
      setSelectedRequest(updated)
      // 자동저장일 때는 알림 안 보여줌 (상태변경일 때만)
      if (updates.status) {
        showAlert(`${AS_STATUS_LABELS[updates.status]}(으)로 변경되었습니다.`, 'success')
      }
    } else {
      showAlert('저장에 실패했습니다.', 'error')
    }
  }

  /** AS 삭제 */
  const handleDelete = async (id: string) => {
    const success = await deleteASRequest(id)
    if (success) {
      setRequests(prev => prev.filter(r => r.id !== id))
      showAlert('삭제되었습니다.', 'success')
    } else {
      showAlert('삭제에 실패했습니다.', 'error')
    }
  }

  /** 정산대기 → 정산완료 일괄 처리 */
  const handleBatchSettle = async () => {
    if (selectedIds.size === 0) return

    const ok = window.confirm(`선택한 ${selectedIds.size}건을 정산완료로 처리하시겠습니까?`)
    if (!ok) return

    const ids = Array.from(selectedIds)
    const success = await batchUpdateASStatus(ids, 'settled', selectedSettlementMonth)

    if (success) {
      // 로컬 상태 업데이트 (정산완료로 변경 + 정산월 설정)
      setRequests(prev => prev.map(r =>
        ids.includes(r.id)
          ? { ...r, status: 'settled' as ASRequestStatus, settlementMonth: selectedSettlementMonth }
          : r
      ))
      setSelectedIds(new Set())
      showAlert(`${ids.length}건이 정산완료 처리되었습니다.`, 'success')
    } else {
      showAlert('일괄 변경에 실패했습니다.', 'error')
    }
  }

  /** 체크박스: 개별 토글 */
  const handleSelectToggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  /** 체크박스: 현재 테이블에 보이는 전체 선택/해제 */
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

  return (
    <div className="container mx-auto py-8 px-4">
      {/* 페이지 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
          <Wrench className="h-6 w-6 text-primary" /> AS 관리
        </h1>
        <p className="text-muted-foreground">교원그룹 에어컨 AS 접수 및 삼성AS센터 연결/비용 관리</p>
      </div>

      {/* 4탭 */}
      <div className="flex border-b mb-6 overflow-x-auto">
        {TAB_CONFIG.map(tab => (
          <button
            key={tab.key}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? `${tab.color} border-current`
                : 'text-gray-400 border-transparent hover:text-gray-600'
            }`}
            onClick={() => handleTabChange(tab.key)}
          >
            {tab.icon}
            {tab.label}
            <span className={`ml-1 text-xs font-bold px-1.5 py-0.5 rounded-full ${
              activeTab === tab.key ? 'bg-gray-100' : 'bg-gray-50'
            }`}>
              {tabCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* 필터 바: 계열사 + 검색 + (정산대기/정산완료: 월 선택) + 접수 버튼 */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* 정산대기 탭: 지난달/이번달/다음달 버튼 */}
        {activeTab === 'completed' && (
          <div className="flex items-center gap-1">
            {settlementMonthOptions.map(opt => (
              <button
                key={opt.value}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  selectedSettlementMonth === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                onClick={() => setSelectedSettlementMonth(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {/* 정산완료 탭: ← YYYY년 M월 → 자유 이동 */}
        {activeTab === 'settled' && (
          <div className="flex items-center gap-1">
            <button
              className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"
              onClick={() => navigateSettledMonth(-1)}
              title="이전 달"
            >
              <ChevronLeft className="h-4 w-4 text-gray-600" />
            </button>
            <span className="px-3 py-1.5 text-sm font-semibold text-green-700 min-w-[100px] text-center">
              {settledMonthLabel}
            </span>
            <button
              className="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"
              onClick={() => navigateSettledMonth(1)}
              title="다음 달"
            >
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        )}

        <Select value={affiliateFilter} onValueChange={setAffiliateFilter}>
          <SelectTrigger className="w-[140px]">
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="사업자명, 주소, AS사유 검색..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* 정산대기 탭: 정산완료 일괄 처리 버튼 */}
        {activeTab === 'completed' && selectedIds.size > 0 && (
          <Button
            onClick={handleBatchSettle}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            정산완료 처리 ({selectedIds.size}건)
          </Button>
        )}

        <div className="ml-auto">
          <Button onClick={() => setFormDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            AS 접수
          </Button>
        </div>
      </div>

      {/* 정산대기 & 정산완료: 통계 카드 */}
      {(activeTab === 'completed' || activeTab === 'settled') && settlementStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {/* 총 건수 */}
          <div className={`rounded-lg border p-4 ${activeTab === 'settled' ? 'bg-green-50/50 border-green-100' : 'bg-blue-50/50 border-blue-100'}`}>
            <div className="flex items-center gap-2 mb-1">
              <FileText className={`h-4 w-4 ${activeTab === 'settled' ? 'text-green-500' : 'text-blue-500'}`} />
              <span className="text-xs text-gray-500">총 건수</span>
            </div>
            <p className={`text-2xl font-bold ${activeTab === 'settled' ? 'text-green-700' : 'text-blue-700'}`}>
              {settlementStats.totalCount}<span className="text-sm font-medium ml-0.5">건</span>
            </p>
          </div>
          {/* AS 비용 합계 */}
          <div className="rounded-lg border p-4 bg-gray-50/50 border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <Wrench className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-500">AS 비용 <span className="text-gray-400">(부가세별도)</span></span>
            </div>
            <p className="text-lg font-bold text-gray-700">
              {settlementStats.totalAsCost.toLocaleString('ko-KR')}<span className="text-xs font-medium ml-0.5">원</span>
            </p>
          </div>
          {/* 접수비 합계 */}
          <div className="rounded-lg border p-4 bg-gray-50/50 border-gray-100">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="h-4 w-4 text-gray-400" />
              <span className="text-xs text-gray-500">접수비 <span className="text-gray-400">(부가세별도)</span></span>
            </div>
            <p className="text-lg font-bold text-gray-700">
              {settlementStats.totalReceptionFee.toLocaleString('ko-KR')}<span className="text-xs font-medium ml-0.5">원</span>
            </p>
          </div>
          {/* 합계 (절사 + 부가세별도/포함) */}
          <div className={`rounded-lg border p-4 ${activeTab === 'settled' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Coins className={`h-4 w-4 ${activeTab === 'settled' ? 'text-green-500' : 'text-blue-500'}`} />
              <span className="text-xs text-gray-500">합계</span>
              {settlementStats.truncationDiff > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 text-[10px] text-red-400">
                  절사 -{settlementStats.truncationDiff.toLocaleString('ko-KR')}
                </span>
              )}
            </div>
            {/* VAT별도 (메인) */}
            <div className="flex items-baseline gap-1.5">
              <p className={`text-2xl font-bold ${activeTab === 'settled' ? 'text-green-700' : 'text-blue-700'}`}>
                {settlementStats.truncatedTotal.toLocaleString('ko-KR')}
              </p>
              <span className={`text-sm font-medium ${activeTab === 'settled' ? 'text-green-600' : 'text-blue-600'}`}>원</span>
              <span className="px-1.5 py-0.5 rounded bg-white/60 text-[10px] text-gray-400 border border-gray-200">VAT별도</span>
            </div>
            {/* VAT포함 (서브) */}
            <div className="flex items-baseline gap-1.5 mt-1">
              <p className={`text-base font-semibold ${activeTab === 'settled' ? 'text-green-600/70' : 'text-blue-600/70'}`}>
                {Math.round(settlementStats.truncatedTotal * 1.1).toLocaleString('ko-KR')}
              </p>
              <span className="text-xs text-gray-400">원</span>
              <span className="px-1.5 py-0.5 rounded bg-white/60 text-[10px] text-gray-400 border border-gray-200">VAT포함</span>
            </div>
          </div>
        </div>
      )}

      {/* 테이블 / 빈 상태 */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            데이터를 불러오는 중...
          </CardContent>
        </Card>
      ) : filteredRequests.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Wrench className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-lg">
              {searchQuery || affiliateFilter !== 'all'
                ? '검색 결과가 없습니다.'
                : `${AS_STATUS_LABELS[activeTab]} 상태의 AS 요청이 없습니다.`
              }
            </p>
          </CardContent>
        </Card>
      ) : (activeTab === 'completed' || activeTab === 'settled') && groupedByAffiliate ? (
        /* 정산대기 & 정산완료: 계열사별 테이블 분리 */
        <div className="space-y-6">
          {Object.entries(groupedByAffiliate).map(([affiliate, reqs]) => (
            <div key={affiliate}>
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                <h3 className="text-sm font-bold text-gray-700">{affiliate}</h3>
                <span className="text-[11px] text-gray-400">{reqs.length}건</span>
                {reqs.length > 0 && (() => {
                  const rawTotal = reqs.reduce((sum, r) => sum + (r.totalAmount || 0), 0)
                  const truncated = Math.floor(rawTotal / 1000) * 1000
                  const diff = rawTotal - truncated
                  return (
                    <div className="flex items-center gap-1 ml-1">
                      {/* 합계 */}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-[11px] text-gray-500">
                        합계 <span className="font-semibold text-gray-700">{rawTotal.toLocaleString('ko-KR')}</span>
                      </span>
                      {/* 단위절사 */}
                      {diff > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 text-[11px] text-red-400">
                          절사 <span className="font-medium">-{diff.toLocaleString('ko-KR')}</span>
                        </span>
                      )}
                      {/* 소계 (메인 강조) */}
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold ${
                        activeTab === 'settled'
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        소계 {truncated.toLocaleString('ko-KR')}원
                      </span>
                      <span className="text-[10px] text-gray-400">[VAT별도]</span>
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
                <div className="border rounded-lg bg-gray-50 py-4 text-center text-sm text-gray-400">
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

      {/* AS 접수 폼 다이얼로그 */}
      <ASFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        onSubmit={handleCreate}
      />

      {/* AS 상세/관리 다이얼로그 */}
      <ASDetailDialog
        request={selectedRequest}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  )
}
