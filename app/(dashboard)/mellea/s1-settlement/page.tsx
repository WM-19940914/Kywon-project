/**
 * 에스원 정산관리 페이지
 *
 * 멜레아와 에스원(설치팀) 간 월별 설치비 정산을 관리합니다.
 * - 매달 20~29일경 설치 완료건에 대해 일괄 정산
 * - 3단계: 미정산 → 정산 진행중 → 정산 완료
 * - 애매한 건은 미정산에 남겨두고 나머지만 일괄 처리 가능
 */

'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { fetchOrders, updateS1SettlementStatus, batchUpdateS1SettlementStatus } from '@/lib/supabase/dal'
import type { Order, S1SettlementStatus } from '@/types/order'
import {
  S1_SETTLEMENT_STATUS_LABELS,
  S1_SETTLEMENT_STATUS_COLORS,
  WORK_TYPE_COLORS,
} from '@/types/order'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Receipt, ArrowRight, Undo2, CheckCircle2, Clock, CircleDot, ChevronDown, Pencil, StickyNote } from 'lucide-react'
import { useAlert } from '@/components/ui/custom-alert'
import { formatShortDate } from '@/lib/delivery-utils'
import { QuoteCreateDialog } from '@/components/quotes/quote-create-dialog'
import type { CustomerQuote } from '@/types/order'
import { saveCustomerQuote } from '@/lib/supabase/dal'

/** 탭 정의 */
type S1Tab = 'unsettled' | 'in-progress' | 'settled'

const TAB_CONFIG: { key: S1Tab; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'unsettled', label: '설치완료(미정산)', icon: <CircleDot className="h-4 w-4" />, color: 'text-gray-700' },
  { key: 'in-progress', label: '금월 정산 진행중', icon: <Clock className="h-4 w-4" />, color: 'text-orange-600' },
  { key: 'settled', label: '정산 완료', icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-green-600' },
]

/** 탭 안내 문구 */
const TAB_DESCRIPTIONS: Record<S1Tab, string> = {
  'unsettled': '설치 관리/견적 관리 페이지에서 설치완료 되어진 현장들만 조회되어 보여집니다.',
  'in-progress': '현재 정산 작업이 진행중인 건입니다. 확인이 끝나면 정산 완료 처리하세요.',
  'settled': '정산이 완료된 건입니다.',
}

export default function S1SettlementPage() {
  const { showAlert, showConfirm } = useAlert()

  // 데이터 로딩
  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchOrders().then(data => {
      setOrders(data)
      setIsLoading(false)
    })
  }, [])

  // 현재 탭
  const [activeTab, setActiveTab] = useState<S1Tab>('unsettled')

  // 아코디언 펼침 상태 (어떤 현장이 펼쳐져 있는지)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // 견적서 수정 다이얼로그 상태
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false)
  const [orderForQuote, setOrderForQuote] = useState<Order | null>(null)

  // 메모 상태 (orderId → 메모 텍스트)
  const [memos, setMemos] = useState<Record<string, string>>({})

  // 정산 월 (기본값: 현재 년월, 수동 변경 가능)
  const now = new Date()
  const [settlementYear, setSettlementYear] = useState(now.getFullYear())
  const [settlementMonth, setSettlementMonth] = useState(now.getMonth() + 1)
  const [isEditingMonth, setIsEditingMonth] = useState(false)

  // 체크박스 선택 상태
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // 탭 변경 시 선택 초기화
  useEffect(() => {
    setSelectedIds(new Set())
  }, [activeTab])

  /**
   * 설치 완료건만 필터링 (설치완료일이 있는 발주)
   */
  const completedOrders = useMemo(() => {
    return orders.filter(order => !!order.installCompleteDate)
  }, [orders])

  /** 탭별 필터링된 발주 목록 */
  const filteredOrders = useMemo(() => {
    return completedOrders.filter(order => {
      const status = order.s1SettlementStatus || 'unsettled'
      return status === activeTab
    })
  }, [completedOrders, activeTab])

  /** 정산 완료 탭: 월별 그룹핑 (예: { "2026-02": [order1, order2], "2026-01": [order3] }) */
  const settledByMonth = useMemo(() => {
    const settled = completedOrders.filter(o => (o.s1SettlementStatus || 'unsettled') === 'settled')
    const grouped: Record<string, Order[]> = {}
    settled.forEach(order => {
      const month = order.s1SettlementMonth || '미지정'
      if (!grouped[month]) grouped[month] = []
      grouped[month].push(order)
    })
    // 최신 월이 위로 오도록 정렬
    const sorted = Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]))
    return sorted
  }, [completedOrders])

  /** 탭별 건수 */
  const tabCounts = useMemo(() => {
    const counts: Record<S1Tab, number> = { 'unsettled': 0, 'in-progress': 0, 'settled': 0 }
    completedOrders.forEach(order => {
      const status = (order.s1SettlementStatus || 'unsettled') as S1Tab
      counts[status] = (counts[status] || 0) + 1
    })
    return counts
  }, [completedOrders])

  /** 아코디언 토글 (현장 클릭 시 설치비 상세 펼침/접기) */
  const handleToggleExpand = (orderId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }

  /** 견적서 수정하기 버튼 클릭 */
  const handleOpenQuote = (order: Order) => {
    setOrderForQuote(order)
    setQuoteDialogOpen(true)
  }

  /** 견적서 저장 후 로컬 상태 반영 */
  const handleQuoteSave = async (orderId: string, quote: CustomerQuote) => {
    await saveCustomerQuote(orderId, quote)
    setOrders(prev => prev.map(order =>
      order.id === orderId ? { ...order, customerQuote: quote } : order
    ))
  }

  /** 메모 변경 */
  const handleMemoChange = (orderId: string, text: string) => {
    setMemos(prev => ({ ...prev, [orderId]: text }))
  }

  /** 전체 선택/해제 */
  const handleSelectAll = () => {
    if (selectedIds.size === filteredOrders.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredOrders.map(o => o.id)))
    }
  }

  /** 개별 선택 토글 */
  const handleSelectToggle = (orderId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
  }

  /**
   * 일괄 상태 변경 (선택된 건들)
   * @param targetStatus - 변경할 상태
   */
  const handleBatchStatusChange = async (targetStatus: S1SettlementStatus) => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) {
      showAlert('선택된 항목이 없습니다.', 'warning')
      return
    }

    const statusLabel = S1_SETTLEMENT_STATUS_LABELS[targetStatus]

    /** 정산 완료는 월별 마감 행위이므로 더 신중한 확인 메시지 */
    let confirmMessage: string
    if (targetStatus === 'settled') {
      // 선택된 현장들의 설치비 합계 계산
      const selectedTotal = orders
        .filter(o => ids.includes(o.id))
        .reduce((total, order) => {
          const items = order.customerQuote?.items?.filter(i => i.category === 'installation') || []
          const notesStr = order.customerQuote?.notes || ''
          const roundMatch = notesStr.match(/설치비절사:\s*([\d,]+)/)
          const rounding = roundMatch ? parseInt(roundMatch[1].replace(/,/g, '')) : 0
          return total + items.reduce((sum, i) => sum + i.totalPrice, 0) - rounding
        }, 0)
      confirmMessage = `⚠️ ${settlementYear}년 ${settlementMonth}월 정산 마감\n\n• 정산 현장: ${ids.length}건\n• ${settlementMonth}월 정산 합계: ${selectedTotal.toLocaleString('ko-KR')}원\n\n정산 완료 후에도 되돌릴 수 있지만, 월별 마감 기록으로 남습니다.\n\n정말 정산 완료 처리하시겠습니까?`
    } else {
      confirmMessage = `선택한 ${ids.length}건을 "${statusLabel}" 상태로 변경하시겠습니까?`
    }

    const confirmed = await showConfirm(confirmMessage)
    if (!confirmed) return

    // DB 업데이트
    const success = await batchUpdateS1SettlementStatus(ids, targetStatus)
    if (success) {
      // UI 반영 (수동 설정한 정산 월 사용)
      const settMonth = `${settlementYear}-${String(settlementMonth).padStart(2, '0')}`
      setOrders(prev => prev.map(order => {
        if (ids.includes(order.id)) {
          return {
            ...order,
            s1SettlementStatus: targetStatus,
            s1SettlementMonth: targetStatus === 'settled' ? settMonth : order.s1SettlementMonth,
          }
        }
        return order
      }))
      setSelectedIds(new Set())
      showAlert(`${ids.length}건이 "${statusLabel}" 상태로 변경되었습니다.`, 'success')
    } else {
      showAlert('상태 변경에 실패했습니다.', 'error')
    }
  }

  /**
   * 개별 미정산으로 제외 (미정산으로)
   */
  const handleRevertToUnsettled = async (orderId: string, businessName: string) => {
    const confirmed = await showConfirm(
      `"${businessName}" 건을 이번 달 정산에서 제외하고 미정산 목록으로 보내시겠습니까?`
    )
    if (!confirmed) return

    const success = await updateS1SettlementStatus(orderId, 'unsettled')
    if (success) {
      setOrders(prev => prev.map(order => {
        if (order.id === orderId) {
          return { ...order, s1SettlementStatus: 'unsettled' as const }
        }
        return order
      }))
      showAlert('미정산 목록으로 제외되었습니다.', 'success')
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* 페이지 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
          <Receipt className="h-6 w-6 text-primary" /> 에스원 정산관리
        </h1>
        <p className="text-muted-foreground">멜레아와 에스원(설치팀) 간 월별 설치비 정산을 관리합니다.</p>
      </div>

      {/* 탭 */}
      <div className="flex border-b mb-6">
        {TAB_CONFIG.map(tab => (
          <button
            key={tab.key}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? `${tab.color} border-current`
                : 'text-gray-400 border-transparent hover:text-gray-600'
            }`}
            onClick={() => setActiveTab(tab.key)}
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

      {/* 탭 안내 문구 */}
      {activeTab === 'in-progress' ? (
        <div className="mb-4 space-y-1.5">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            {/* 정산 월 뱃지 (클릭하면 수정 모드) */}
            {isEditingMonth ? (
              <span className="inline-flex items-center gap-1.5 bg-orange-100 border border-orange-300 rounded-md px-2 py-1">
                <Clock className="h-3.5 w-3.5 text-orange-600" />
                <select
                  className="bg-transparent text-orange-800 font-bold text-sm focus:outline-none cursor-pointer"
                  value={settlementYear}
                  onChange={(e) => setSettlementYear(Number(e.target.value))}
                >
                  {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                    <option key={y} value={y}>{y}년</option>
                  ))}
                </select>
                <select
                  className="bg-transparent text-orange-800 font-bold text-sm focus:outline-none cursor-pointer"
                  value={settlementMonth}
                  onChange={(e) => setSettlementMonth(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>{m}월</option>
                  ))}
                </select>
                <span className="text-orange-800 font-bold text-sm">정산</span>
                <button
                  className="ml-1 text-[10px] bg-orange-500 text-white rounded px-1.5 py-0.5 hover:bg-orange-600"
                  onClick={() => setIsEditingMonth(false)}
                >
                  확인
                </button>
              </span>
            ) : (
              <button
                className="inline-flex items-center gap-1.5 bg-orange-100 border border-orange-300 text-orange-800 font-bold px-3 py-1 rounded-md hover:bg-orange-200 transition-colors"
                onClick={() => setIsEditingMonth(true)}
                title="클릭하여 정산 월 변경"
              >
                <Clock className="h-3.5 w-3.5" />
                {settlementYear}년 {settlementMonth}월 정산
                <Pencil className="h-3 w-3 ml-1 text-orange-500" />
              </button>
            )}
            <ArrowRight className="h-4 w-4 text-orange-400" />
            <span className="text-gray-600">이번달 정산 예정중인 현장입니다.</span>
          </div>
          <p className="text-xs text-gray-400 ml-1">멜레아에서 정산이 완료되면 정산 완료 페이지로 처리하세요. (정산 월은 현재 날짜 기준 자동 반영, 클릭하여 변경 가능)</p>
        </div>
      ) : (
        <p className="text-sm text-gray-500 mb-4">{TAB_DESCRIPTIONS[activeTab]}</p>
      )}

      {/* 액션 버튼 (미정산/진행중 탭에서만) */}
      {activeTab === 'unsettled' && (
        <div className="flex items-center gap-3 mb-4">
          <Button
            onClick={() => handleBatchStatusChange('in-progress')}
            disabled={selectedIds.size === 0}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <ArrowRight className="h-4 w-4 mr-1" />
            정산 진행중으로 이동 ({selectedIds.size}건)
          </Button>
        </div>
      )}
      {activeTab === 'in-progress' && (
        <div className="flex items-center gap-3 mb-4">
          <Button
            onClick={() => handleBatchStatusChange('settled')}
            disabled={selectedIds.size === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            정산 완료 처리 ({selectedIds.size}건)
          </Button>
        </div>
      )}
      {activeTab === 'settled' && (
        <div className="flex items-center gap-3 mb-4">
          <Button
            onClick={() => handleBatchStatusChange('in-progress')}
            disabled={selectedIds.size === 0}
            variant="outline"
          >
            <Undo2 className="h-4 w-4 mr-1" />
            정산 진행중으로 되돌리기 ({selectedIds.size}건)
          </Button>
        </div>
      )}

      {/* ============================================ */}
      {/* 정산 완료 탭: 월별 그룹 UI */}
      {/* ============================================ */}
      {activeTab === 'settled' && !isLoading && (
        settledByMonth.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Receipt className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 text-lg">정산 완료 건이 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {settledByMonth.map(([monthKey, monthOrders]) => {
              // "2026-02" → "2026년 2월"
              const monthLabel = monthKey !== '미지정'
                ? `${monthKey.split('-')[0]}년 ${parseInt(monthKey.split('-')[1])}월`
                : '미지정'

              // 해당 월 설치비 합계
              const monthTotal = monthOrders.reduce((total, order) => {
                const items = order.customerQuote?.items?.filter(i => i.category === 'installation') || []
                const notesStr = order.customerQuote?.notes || ''
                const roundMatch = notesStr.match(/설치비절사:\s*([\d,]+)/)
                const rounding = roundMatch ? parseInt(roundMatch[1].replace(/,/g, '')) : 0
                return total + items.reduce((sum, i) => sum + i.totalPrice, 0) - rounding
              }, 0)

              return (
                <div key={monthKey}>
                  {/* 월별 헤더 */}
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-gray-800">{monthLabel} 정산</h3>
                      <span className="text-sm text-gray-500">({monthOrders.length}건)</span>
                    </div>
                    <span className="text-base font-extrabold text-gray-900">
                      {monthTotal.toLocaleString('ko-KR')} 원
                    </span>
                  </div>

                  {/* 해당 월 현장 테이블 */}
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted/80">
                        <tr>
                          <th className="p-3 text-center" style={{ width: '45px' }}>
                            <Checkbox
                              checked={monthOrders.every(o => selectedIds.has(o.id))}
                              onCheckedChange={() => {
                                const allSelected = monthOrders.every(o => selectedIds.has(o.id))
                                setSelectedIds(prev => {
                                  const next = new Set(prev)
                                  monthOrders.forEach(o => {
                                    if (allSelected) next.delete(o.id)
                                    else next.add(o.id)
                                  })
                                  return next
                                })
                              }}
                            />
                          </th>
                          <th className="text-left p-3 text-sm font-medium" style={{ width: '110px' }}>작업종류</th>
                          <th className="text-left p-3 text-sm font-medium" style={{ width: '95px' }}>설치완료일</th>
                          <th className="text-center p-3 text-sm font-medium">현장명</th>
                          <th className="text-center p-3 text-sm font-medium" style={{ width: '200px' }}>주소</th>
                          <th className="text-center p-3 text-sm font-medium" style={{ width: '130px' }}>설치비 소계</th>
                          <th className="text-center p-3 text-sm font-medium" style={{ width: '110px' }}>정산</th>
                          <th className="text-center p-3 text-sm font-medium" style={{ width: '90px' }}>정산월</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthOrders.map(order => {
                          const quote = order.customerQuote
                          const workTypes = Array.from(new Set(order.items.map(i => i.workType)))
                          const installItems = quote?.items?.filter(i => i.category === 'installation') || []
                          const isExpanded = expandedIds.has(order.id)

                          return (
                            <React.Fragment key={order.id}>
                              <tr
                                className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors cursor-pointer ${isExpanded ? 'bg-green-50/40' : ''}`}
                                onClick={() => handleToggleExpand(order.id)}
                              >
                                <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                  <Checkbox
                                    checked={selectedIds.has(order.id)}
                                    onCheckedChange={() => handleSelectToggle(order.id)}
                                  />
                                </td>
                                <td className="p-3">
                                  <div className="flex flex-wrap gap-1">
                                    {workTypes.map(type => (
                                      <Badge key={type} className={`${WORK_TYPE_COLORS[type] || 'bg-gray-100 text-gray-700'} text-xs border`}>
                                        {type}
                                      </Badge>
                                    ))}
                                  </div>
                                </td>
                                <td className="p-3 text-sm">{formatShortDate(order.installCompleteDate)}</td>
                                <td className="p-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    <p className="font-semibold text-sm truncate">{order.businessName}</p>
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  <p className="text-xs text-gray-600 truncate">{order.address}</p>
                                </td>
                                <td className="p-3 text-center">
                                  <p className="text-sm font-semibold">
                                    {(() => {
                                      const items = quote?.items?.filter(i => i.category === 'installation') || []
                                      const notesStr = quote?.notes || ''
                                      const roundMatch = notesStr.match(/설치비절사:\s*([\d,]+)/)
                                      const rounding = roundMatch ? parseInt(roundMatch[1].replace(/,/g, '')) : 0
                                      const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0) - rounding
                                      return subtotal > 0 ? `${subtotal.toLocaleString('ko-KR')}원` : <span className="text-gray-400">-</span>
                                    })()}
                                  </p>
                                </td>
                                {/* 정산 상태 */}
                                <td className="p-3 text-center">
                                  <Badge className={`${S1_SETTLEMENT_STATUS_COLORS['settled']} text-[10px] border`}>
                                    {S1_SETTLEMENT_STATUS_LABELS['settled']}
                                  </Badge>
                                </td>
                                {/* 정산월 */}
                                <td className="p-3 text-center">
                                  <span className="text-xs font-medium text-green-700">
                                    {order.s1SettlementMonth
                                      ? `${order.s1SettlementMonth.split('-')[0]}년 ${parseInt(order.s1SettlementMonth.split('-')[1])}월`
                                      : '-'
                                    }
                                  </span>
                                </td>
                              </tr>

                              {/* 아코디언: 설치비 견적서 */}
                              {isExpanded && (
                                <tr>
                                  <td colSpan={8} className="p-0">
                                    <div className="mx-4 my-3">
                                      <div className="border border-green-200 rounded-lg overflow-hidden bg-white shadow-sm" style={{ width: '870px' }}>
                                        <div className="flex items-center gap-2 px-3 py-2 bg-green-600">
                                          <Receipt className="h-3.5 w-3.5 text-white" />
                                          <span className="text-xs font-bold text-white tracking-wide">설치비 견적서</span>
                                        </div>
                                        {(() => {
                                          const notesStr = quote?.notes || ''
                                          const roundMatch = notesStr.match(/설치비절사:\s*([\d,]+)/)
                                          const installRounding = roundMatch ? parseInt(roundMatch[1].replace(/,/g, '')) : 0
                                          const rawSubtotal = installItems.reduce((sum, i) => sum + i.totalPrice, 0)
                                          const finalSubtotal = rawSubtotal - installRounding

                                          return installItems.length > 0 ? (
                                            <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                                              <colgroup>
                                                <col style={{ width: '36px' }} />
                                                <col style={{ width: '140px' }} />
                                                <col style={{ width: '160px' }} />
                                                <col style={{ width: '50px' }} />
                                                <col style={{ width: '100px' }} />
                                                <col style={{ width: '100px' }} />
                                                <col style={{ width: '140px' }} />
                                              </colgroup>
                                              <thead>
                                                <tr className="bg-green-50 border-b border-green-200 text-green-900">
                                                  <th className="text-center py-2 px-2 font-semibold">No.</th>
                                                  <th className="text-center py-2 px-2 font-semibold">품목</th>
                                                  <th className="text-center py-2 px-2 font-semibold">규격</th>
                                                  <th className="text-center py-2 px-2 font-semibold">수량</th>
                                                  <th className="text-right py-2 px-2 font-semibold">단가</th>
                                                  <th className="text-right py-2 px-2 font-semibold">금액</th>
                                                  <th className="text-center py-2 px-2 font-semibold">비고</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {installItems.map((item, idx) => {
                                                  const hasModel = item.itemName.includes('|||')
                                                  const displayName = hasModel ? item.itemName.split('|||')[0] : item.itemName
                                                  const displayModel = hasModel ? item.itemName.split('|||')[1] : '-'
                                                  return (
                                                    <tr key={item.id || idx} className="border-b border-gray-100 hover:bg-green-50/30">
                                                      <td className="py-2 px-2 text-center text-gray-400">{idx + 1}</td>
                                                      <td className="py-2 px-2 text-center text-gray-800 font-medium truncate">{displayName}</td>
                                                      <td className="py-2 px-2 text-center text-gray-500 truncate">{displayModel}</td>
                                                      <td className="py-2 px-2 text-center text-gray-600">{item.quantity}</td>
                                                      <td className="py-2 px-2 text-right text-gray-600">{item.unitPrice.toLocaleString('ko-KR')}</td>
                                                      <td className="py-2 px-2 text-right font-semibold text-gray-800">{item.totalPrice.toLocaleString('ko-KR')}</td>
                                                      <td className="py-2 px-2 text-center text-gray-500 truncate">{item.description || ''}</td>
                                                    </tr>
                                                  )
                                                })}
                                              </tbody>
                                              <tfoot>
                                                {installRounding > 0 && (
                                                  <tr className="border-t border-gray-200">
                                                    <td colSpan={5} className="py-1.5 px-1.5 text-right text-gray-500">단위절사</td>
                                                    <td className="py-1.5 px-1.5 text-right text-red-500 font-medium">-{installRounding.toLocaleString('ko-KR')}</td>
                                                    <td></td>
                                                  </tr>
                                                )}
                                                <tr className="bg-green-50 border-t border-green-200">
                                                  <td colSpan={5} className="py-2 px-1.5 text-right font-bold text-green-800">설치비 소계</td>
                                                  <td className="py-2 px-1.5 text-right font-bold text-green-800">{finalSubtotal.toLocaleString('ko-KR')}</td>
                                                  <td></td>
                                                </tr>
                                              </tfoot>
                                            </table>
                                          ) : (
                                            <div className="px-3 py-5 text-center">
                                              <p className="text-xs text-gray-400">견적서에 설치비 항목이 없습니다.</p>
                                            </div>
                                          )
                                        })()}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* ============================================ */}
      {/* 미정산 / 금월 정산 진행중 탭: 기존 테이블 */}
      {/* ============================================ */}
      {activeTab !== 'settled' && (isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            데이터를 불러오는 중...
          </CardContent>
        </Card>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Receipt className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-lg">{S1_SETTLEMENT_STATUS_LABELS[activeTab]} 건이 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* 데스크톱 테이블 */}
          <div className="hidden md:block border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/80">
                <tr>
                  {/* 체크박스 (정산완료 탭에서는 숨김) */}
                  {true && (
                    <th className="p-3 text-center" style={{ width: '45px' }}>
                      <Checkbox
                        checked={selectedIds.size === filteredOrders.length && filteredOrders.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                  )}
                  <th className="text-left p-3 text-sm font-medium" style={{ width: '110px' }}>작업종류</th>
                  <th className="text-left p-3 text-sm font-medium" style={{ width: '95px' }}>설치완료일</th>
                  <th className="text-center p-3 text-sm font-medium" style={{ width: '220px' }}>현장명</th>
                  <th className="text-center p-3 text-sm font-medium" style={{ width: '200px' }}>주소</th>
                  <th className="text-center p-3 text-sm font-medium" style={{ width: '130px' }}>설치비 소계</th>
                  <th className="text-center p-3 text-sm font-medium" style={{ width: '110px' }}>정산</th>
                  {/* 진행중 탭: 정산월 */}
                  {activeTab === 'in-progress' && (
                    <th className="text-center p-3 text-sm font-medium" style={{ width: '90px' }}>정산월</th>
                  )}
                  {/* 진행중 탭: 미정산으로 제외 버튼 */}
                  {activeTab === 'in-progress' && (
                    <th className="text-center p-3 text-sm font-medium" style={{ width: '80px' }}></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(order => {
                  const s1Status = order.s1SettlementStatus || 'unsettled'
                  const quote = order.customerQuote
                  const installItems = quote?.items?.filter(i => i.category === 'installation') || []
                  const isExpanded = expandedIds.has(order.id)
                  const workTypes = Array.from(new Set(order.items.map(i => i.workType)))

                  {/* 테이블 컬럼 수 (아코디언 colspan용) */}
                  const colCount = 1 + 6 + (activeTab === 'in-progress' ? 2 : 0)

                  return (
                    <React.Fragment key={order.id}>
                      {/* 현장 행 (클릭하면 아코디언 열림) */}
                      <tr
                        className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors cursor-pointer ${isExpanded ? 'bg-orange-50/40' : ''}`}
                        onClick={() => handleToggleExpand(order.id)}
                      >
                        {/* 체크박스 */}
                        {true && (
                          <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(order.id)}
                              onCheckedChange={() => handleSelectToggle(order.id)}
                            />
                          </td>
                        )}

                        {/* 작업종류 뱃지 */}
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {workTypes.map(type => (
                              <Badge
                                key={type}
                                className={`${WORK_TYPE_COLORS[type] || 'bg-gray-100 text-gray-700'} text-xs border`}
                              >
                                {type}
                              </Badge>
                            ))}
                          </div>
                        </td>

                        {/* 설치완료일 */}
                        <td className="p-3">
                          <p className="text-sm">{formatShortDate(order.installCompleteDate)}</p>
                        </td>

                        {/* 현장명 + 펼침 아이콘 */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            <p className="font-semibold text-sm truncate">{order.businessName}</p>
                          </div>
                        </td>

                        {/* 주소 */}
                        <td className="p-3 text-center">
                          <p className="text-xs text-gray-600 truncate">{order.address}</p>
                        </td>

                        {/* 설치비 소계 */}
                        <td className="p-3 text-center">
                          <p className="text-sm font-semibold">
                            {(() => {
                              const items = quote?.items?.filter(i => i.category === 'installation') || []
                              const notesStr = quote?.notes || ''
                              const roundMatch = notesStr.match(/설치비절사:\s*([\d,]+)/)
                              const rounding = roundMatch ? parseInt(roundMatch[1].replace(/,/g, '')) : 0
                              const subtotal = items.reduce((sum, i) => sum + i.totalPrice, 0) - rounding
                              return subtotal > 0
                                ? `${subtotal.toLocaleString('ko-KR')}원`
                                : <span className="text-gray-400">-</span>
                            })()}
                          </p>
                        </td>

                        {/* 정산 상태 뱃지 */}
                        <td className="p-3 text-center">
                          <Badge className={`${S1_SETTLEMENT_STATUS_COLORS[s1Status]} text-[10px] border`}>
                            {S1_SETTLEMENT_STATUS_LABELS[s1Status]}
                          </Badge>
                        </td>

                        {/* 진행중 탭: 정산월 */}
                        {activeTab === 'in-progress' && (
                          <td className="p-3 text-center">
                            <span className="text-xs font-medium text-orange-700">
                              {order.s1SettlementMonth
                                ? `${order.s1SettlementMonth.split('-')[0]}년 ${parseInt(order.s1SettlementMonth.split('-')[1])}월`
                                : `${settlementYear}년 ${settlementMonth}월`
                              }
                            </span>
                          </td>
                        )}

                        {/* 진행중 탭: 미정산으로 제외 버튼 */}
                        {activeTab === 'in-progress' && (
                          <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-gray-500 hover:text-gray-700"
                              onClick={() => handleRevertToUnsettled(order.id, order.businessName)}
                            >
                              <Undo2 className="h-3 w-3 mr-1" />
                              미정산으로 제외
                            </Button>
                          </td>
                        )}
                      </tr>

                      {/* 아코디언: 설치비 견적서(좌) + 메모(우) */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={colCount} className="p-0">
                            <div className="mx-4 my-3 flex gap-3">
                              {/* ===== 좌측: 설치비 견적서 ===== */}
                              <div className="flex-shrink-0 border border-orange-200 rounded-lg overflow-hidden bg-white shadow-sm" style={{ width: '870px' }}>
                                {/* 견적서 헤더 + 수정 버튼 */}
                                <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-orange-500 to-orange-400">
                                  <div className="flex items-center gap-2">
                                    <Receipt className="h-3.5 w-3.5 text-white" />
                                    <span className="text-xs font-bold text-white tracking-wide">설치비 견적서</span>
                                  </div>
                                  <button
                                    className="flex items-center gap-1 text-[10px] font-medium text-white/90 hover:text-white bg-white/20 hover:bg-white/30 rounded px-2 py-1 transition-colors"
                                    onClick={(e) => { e.stopPropagation(); handleOpenQuote(order) }}
                                  >
                                    <Pencil className="h-3 w-3" />
                                    견적서 수정
                                  </button>
                                </div>
                                {(() => {
                                  const notesStr = quote?.notes || ''
                                  const roundMatch = notesStr.match(/설치비절사:\s*([\d,]+)/)
                                  const installRounding = roundMatch ? parseInt(roundMatch[1].replace(/,/g, '')) : 0
                                  const rawSubtotal = installItems.reduce((sum, i) => sum + i.totalPrice, 0)
                                  const finalSubtotal = rawSubtotal - installRounding

                                  return installItems.length > 0 ? (
                                  <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                                    <colgroup>
                                      <col style={{ width: '36px' }} />
                                      <col style={{ width: '140px' }} />
                                      <col style={{ width: '160px' }} />
                                      <col style={{ width: '50px' }} />
                                      <col style={{ width: '100px' }} />
                                      <col style={{ width: '100px' }} />
                                      <col style={{ width: '140px' }} />
                                    </colgroup>
                                    <thead>
                                      <tr className="bg-orange-50 border-b border-orange-200 text-orange-900">
                                        <th className="text-center py-2 px-2 font-semibold">No.</th>
                                        <th className="text-center py-2 px-2 font-semibold">품목</th>
                                        <th className="text-center py-2 px-2 font-semibold">규격</th>
                                        <th className="text-center py-2 px-2 font-semibold">수량</th>
                                        <th className="text-right py-2 px-2 font-semibold">단가</th>
                                        <th className="text-right py-2 px-2 font-semibold">금액</th>
                                        <th className="text-center py-2 px-2 font-semibold">비고</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {installItems.map((item, idx) => {
                                        const hasModel = item.itemName.includes('|||')
                                        const displayName = hasModel ? item.itemName.split('|||')[0] : item.itemName
                                        const displayModel = hasModel ? item.itemName.split('|||')[1] : '-'
                                        return (
                                        <tr key={item.id || idx} className="border-b border-gray-100 hover:bg-orange-50/30">
                                          <td className="py-2 px-2 text-center text-gray-400">{idx + 1}</td>
                                          <td className="py-2 px-2 text-center text-gray-800 font-medium truncate">{displayName}</td>
                                          <td className="py-2 px-2 text-center text-gray-500 truncate">{displayModel}</td>
                                          <td className="py-2 px-2 text-center text-gray-600">{item.quantity}</td>
                                          <td className="py-2 px-2 text-right text-gray-600">{item.unitPrice.toLocaleString('ko-KR')}</td>
                                          <td className="py-2 px-2 text-right font-semibold text-gray-800">{item.totalPrice.toLocaleString('ko-KR')}</td>
                                          <td className="py-2 px-2 text-center text-gray-500 truncate">{item.description || ''}</td>
                                        </tr>
                                        )
                                      })}
                                    </tbody>
                                    <tfoot>
                                      {installRounding > 0 && (
                                        <tr className="border-t border-gray-200">
                                          <td colSpan={5} className="py-1.5 px-1.5 text-right text-gray-500">단위절사</td>
                                          <td className="py-1.5 px-1.5 text-right text-red-500 font-medium">-{installRounding.toLocaleString('ko-KR')}</td>
                                          <td></td>
                                        </tr>
                                      )}
                                      <tr className="bg-orange-50 border-t border-orange-200">
                                        <td colSpan={5} className="py-2 px-1.5 text-right font-bold text-orange-800">설치비 소계</td>
                                        <td className="py-2 px-1.5 text-right font-bold text-orange-800">
                                          {finalSubtotal.toLocaleString('ko-KR')}
                                        </td>
                                        <td></td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                ) : (
                                  <div className="px-3 py-5 text-center">
                                    <p className="text-xs text-gray-400">견적서에 설치비 항목이 없습니다.</p>
                                  </div>
                                )
                                })()}
                              </div>

                              {/* ===== 우측: 메모 영역 ===== */}
                              <div className="flex-1 min-w-[200px] border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm flex flex-col">
                                <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-100 to-yellow-50 border-b border-amber-200">
                                  <StickyNote className="h-3.5 w-3.5 text-amber-600" />
                                  <span className="text-xs font-bold text-amber-800 tracking-wide">메모</span>
                                </div>
                                <textarea
                                  className="flex-1 w-full p-3 text-sm text-gray-700 resize-none focus:outline-none placeholder:text-gray-300 bg-amber-50/30"
                                  placeholder="자유롭게 메모를 입력하세요..."
                                  value={memos[order.id] || ''}
                                  onChange={(e) => handleMemoChange(order.id, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  rows={6}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* 금월 정산 진행중 탭: 정산 합계 */}
          {activeTab === 'in-progress' && filteredOrders.length > 0 && (
            <div className="hidden md:flex items-center justify-end gap-2 mt-4 px-1">
              <span className="text-base font-bold text-gray-600">정산 합계:</span>
              <span className="text-xl font-extrabold text-gray-900">
                {filteredOrders.reduce((total, order) => {
                  const items = order.customerQuote?.items?.filter(i => i.category === 'installation') || []
                  const notesStr = order.customerQuote?.notes || ''
                  const roundMatch = notesStr.match(/설치비절사:\s*([\d,]+)/)
                  const rounding = roundMatch ? parseInt(roundMatch[1].replace(/,/g, '')) : 0
                  return total + items.reduce((sum, i) => sum + i.totalPrice, 0) - rounding
                }, 0).toLocaleString('ko-KR')} 원
              </span>
            </div>
          )}

          {/* 모바일 카드 리스트 */}
          <div className="md:hidden space-y-3">
            {filteredOrders.map(order => {
              const s1Status = order.s1SettlementStatus || 'unsettled'
              const workTypes = Array.from(new Set(order.items.map(i => i.workType)))
              const installItems = order.customerQuote?.items?.filter(i => i.category === 'installation') || []
              const isExpanded = expandedIds.has(order.id)

              return (
                <div key={order.id} className={`border rounded-lg bg-white overflow-hidden ${isExpanded ? 'border-orange-200' : ''}`}>
                  {/* 카드 본문 (클릭하면 아코디언 토글) */}
                  <div
                    className="p-4 space-y-3 cursor-pointer"
                    onClick={() => handleToggleExpand(order.id)}
                  >
                    {/* 상단: 체크 + 작업종류 + 정산 뱃지 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {true && (
                          <div onClick={e => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.has(order.id)}
                              onCheckedChange={() => handleSelectToggle(order.id)}
                            />
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {workTypes.map(type => (
                            <Badge
                              key={type}
                              className={`${WORK_TYPE_COLORS[type] || 'bg-gray-100 text-gray-700'} text-xs border`}
                            >
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${S1_SETTLEMENT_STATUS_COLORS[s1Status]} text-[10px] border`}>
                          {S1_SETTLEMENT_STATUS_LABELS[s1Status]}
                        </Badge>
                        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </div>

                    {/* 현장명 + 주소 */}
                    <div>
                      <h3 className="font-semibold text-sm">{order.businessName}</h3>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{order.address}</p>
                    </div>

                    {/* 날짜 + 설치비 */}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>설치완료: {formatShortDate(order.installCompleteDate)}</span>
                      <span className="font-medium text-gray-700">
                        {order.installationCost?.totalAmount
                          ? `${order.installationCost.totalAmount.toLocaleString('ko-KR')}원`
                          : '-'
                        }
                      </span>
                    </div>

                    {/* 진행중 탭: 미정산으로 제외 */}
                    {activeTab === 'in-progress' && (
                      <div className="flex justify-end" onClick={e => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-gray-500"
                          onClick={() => handleRevertToUnsettled(order.id, order.businessName)}
                        >
                          <Undo2 className="h-3 w-3 mr-1" />
                          미정산으로 제외
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* 아코디언: 설치비 상세 */}
                  {isExpanded && (
                    <div className="mx-3 mb-3 border border-orange-200 rounded-lg overflow-hidden bg-white shadow-sm">
                      {/* 견적서 헤더 */}
                      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-orange-500 to-orange-400">
                        <Receipt className="h-3.5 w-3.5 text-white" />
                        <span className="text-xs font-bold text-white tracking-wide">설치비 견적서</span>
                      </div>
                      {(() => {
                        const notesStr = order.customerQuote?.notes || ''
                        const roundMatch = notesStr.match(/설치비절사:\s*([\d,]+)/)
                        const installRounding = roundMatch ? parseInt(roundMatch[1].replace(/,/g, '')) : 0
                        const rawSubtotal = installItems.reduce((sum, i) => sum + i.totalPrice, 0)
                        const finalSubtotal = rawSubtotal - installRounding

                        return installItems.length > 0 ? (
                        <div className="divide-y divide-gray-100">
                          {installItems.map((item, idx) => {
                            const hasModel = item.itemName.includes('|||')
                            const displayName = hasModel ? item.itemName.split('|||')[0] : item.itemName
                            const displayModel = hasModel ? item.itemName.split('|||')[1] : ''
                            return (
                            <div key={item.id || idx} className="flex items-center justify-between px-3 py-2.5">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-gray-400 bg-gray-100 rounded w-5 h-5 flex items-center justify-center">{idx + 1}</span>
                                  <p className="font-medium text-sm text-gray-800">{displayName}</p>
                                  {displayModel && <span className="text-xs text-gray-400">({displayModel})</span>}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5 ml-7">{item.quantity}개 × {item.unitPrice.toLocaleString('ko-KR')}원</p>
                              </div>
                              <p className="font-semibold text-sm text-gray-800">{item.totalPrice.toLocaleString('ko-KR')}</p>
                            </div>
                            )
                          })}
                          {/* 단위절사 (값이 있을 때만) */}
                          {installRounding > 0 && (
                            <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                              <span className="text-xs text-gray-500">단위절사</span>
                              <span className="text-sm text-red-500 font-medium">-{installRounding.toLocaleString('ko-KR')}</span>
                            </div>
                          )}
                          {/* 소계 */}
                          <div className="flex items-center justify-between px-3 py-2.5 bg-orange-50">
                            <span className="text-sm font-bold text-orange-800">설치비 소계</span>
                            <span className="text-sm font-bold text-orange-800">{finalSubtotal.toLocaleString('ko-KR')}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="px-3 py-6 text-center">
                          <p className="text-xs text-gray-400">견적서에 설치비 항목이 없습니다.</p>
                        </div>
                      )
                      })()}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      ))}
      {/* 견적서 수정 다이얼로그 */}
      <QuoteCreateDialog
        order={orderForQuote}
        open={quoteDialogOpen}
        onOpenChange={setQuoteDialogOpen}
        onSave={handleQuoteSave}
      />
    </div>
  )
}
