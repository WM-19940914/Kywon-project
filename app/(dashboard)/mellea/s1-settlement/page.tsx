/**
 * 에스원 정산관리 페이지
 *
 * 멜레아와 에스원(설치팀) 간 월별 설치비 정산을 관리합니다.
 * - 매달 20~29일경 설치 완료건에 대해 일괄 정산
 * - 3단계: 미정산 → 정산 진행중 → 정산 완료
 * - 애매한 건은 미정산에 남겨두고 나머지만 일괄 처리 가능
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { fetchOrders, updateS1SettlementStatus, batchUpdateS1SettlementStatus } from '@/lib/supabase/dal'
import type { Order, S1SettlementStatus } from '@/types/order'
import {
  S1_SETTLEMENT_STATUS_LABELS,
  S1_SETTLEMENT_STATUS_COLORS,
  WORK_TYPE_COLORS,
} from '@/types/order'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Receipt, ArrowRight, Undo2, CheckCircle2, Clock, CircleDot } from 'lucide-react'
import { useAlert } from '@/components/ui/custom-alert'
import { formatShortDate } from '@/lib/delivery-utils'

/** 탭 정의 */
type S1Tab = 'unsettled' | 'in-progress' | 'settled'

const TAB_CONFIG: { key: S1Tab; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'unsettled', label: '미정산', icon: <CircleDot className="h-4 w-4" />, color: 'text-gray-700' },
  { key: 'in-progress', label: '정산 진행중', icon: <Clock className="h-4 w-4" />, color: 'text-orange-600' },
  { key: 'settled', label: '정산 완료', icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-green-600' },
]

/** 탭 안내 문구 */
const TAB_DESCRIPTIONS: Record<S1Tab, string> = {
  'unsettled': '설치 완료됐지만 아직 정산하지 않은 건입니다. 정산할 건을 선택하여 진행중으로 이동하세요.',
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

  // 월 선택
  const currentMonth = new Date().toISOString().substring(0, 7)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)

  // 체크박스 선택 상태
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // 탭 변경 시 선택 초기화
  useEffect(() => {
    setSelectedIds(new Set())
  }, [activeTab, selectedMonth])

  /**
   * 설치 완료건 중 해당 월에 해당하는 발주 필터링
   * 설치완료일 기준으로 월을 판단 (installCompleteDate의 YYYY-MM)
   */
  const completedOrders = useMemo(() => {
    return orders.filter(order => {
      // 설치완료일이 있어야 함
      if (!order.installCompleteDate) return false
      // 설치완료일의 월이 선택한 월과 같아야 함
      const completeMonth = order.installCompleteDate.substring(0, 7)
      return completeMonth === selectedMonth
    })
  }, [orders, selectedMonth])

  /** 탭별 필터링된 발주 목록 */
  const filteredOrders = useMemo(() => {
    return completedOrders.filter(order => {
      const status = order.s1SettlementStatus || 'unsettled'
      return status === activeTab
    })
  }, [completedOrders, activeTab])

  /** 탭별 건수 */
  const tabCounts = useMemo(() => {
    const counts: Record<S1Tab, number> = { 'unsettled': 0, 'in-progress': 0, 'settled': 0 }
    completedOrders.forEach(order => {
      const status = (order.s1SettlementStatus || 'unsettled') as S1Tab
      counts[status] = (counts[status] || 0) + 1
    })
    return counts
  }, [completedOrders])

  /** 설치비 합계 계산 */
  const totalInstallCost = useMemo(() => {
    return filteredOrders.reduce((sum, order) => {
      return sum + (order.installationCost?.totalAmount || 0)
    }, 0)
  }, [filteredOrders])

  /** 월 옵션 생성 (최근 6개월) */
  const getMonthOptions = () => {
    const options = []
    const today = new Date()
    for (let i = 0; i < 6; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const month = date.toISOString().substring(0, 7)
      const label = `${date.getFullYear()}년 ${date.getMonth() + 1}월`
      options.push({ value: month, label })
    }
    return options
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
    const confirmed = await showConfirm(
      `선택한 ${ids.length}건을 "${statusLabel}" 상태로 변경하시겠습니까?`
    )
    if (!confirmed) return

    // DB 업데이트
    const success = await batchUpdateS1SettlementStatus(ids, targetStatus)
    if (success) {
      // UI 반영
      const now = new Date()
      const settlementMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      setOrders(prev => prev.map(order => {
        if (ids.includes(order.id)) {
          return {
            ...order,
            s1SettlementStatus: targetStatus,
            s1SettlementMonth: targetStatus === 'settled' ? settlementMonth : order.s1SettlementMonth,
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
   * 개별 되돌리기 (미정산으로)
   */
  const handleRevertToUnsettled = async (orderId: string, businessName: string) => {
    const confirmed = await showConfirm(
      `"${businessName}" 건을 미정산 상태로 되돌리시겠습니까?`
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
      showAlert('미정산 상태로 되돌렸습니다.', 'success')
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

      {/* 월 선택기 */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">정산 월 선택</CardTitle>
          <CardDescription>설치완료일 기준으로 해당 월의 건을 표시합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getMonthOptions().map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

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
      <p className="text-sm text-gray-500 mb-4">{TAB_DESCRIPTIONS[activeTab]}</p>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>표시 건수</CardDescription>
            <CardTitle className="text-2xl">{filteredOrders.length}건</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>설치비 합계</CardDescription>
            <CardTitle className="text-2xl text-blue-600">
              {totalInstallCost.toLocaleString('ko-KR')}원
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>전체 현황</CardDescription>
            <CardTitle className="text-sm space-y-0.5">
              <p className="text-gray-500">미정산 <span className="font-bold text-gray-700">{tabCounts['unsettled']}</span></p>
              <p className="text-orange-500">진행중 <span className="font-bold text-orange-700">{tabCounts['in-progress']}</span></p>
              <p className="text-green-500">완료 <span className="font-bold text-green-700">{tabCounts['settled']}</span></p>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

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

      {/* 테이블 */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            데이터를 불러오는 중...
          </CardContent>
        </Card>
      ) : filteredOrders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Receipt className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-lg">해당 월에 {S1_SETTLEMENT_STATUS_LABELS[activeTab]} 건이 없습니다.</p>
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
                  {activeTab !== 'settled' && (
                    <th className="p-3 text-center" style={{ width: '45px' }}>
                      <Checkbox
                        checked={selectedIds.size === filteredOrders.length && filteredOrders.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                  )}
                  <th className="text-left p-3 text-sm font-medium" style={{ width: '110px' }}>작업종류</th>
                  <th className="text-left p-3 text-sm font-medium" style={{ width: '95px' }}>설치완료일</th>
                  <th className="text-left p-3 text-sm font-medium" style={{ width: '220px' }}>현장명</th>
                  <th className="text-left p-3 text-sm font-medium" style={{ width: '200px' }}>주소</th>
                  <th className="text-left p-3 text-sm font-medium" style={{ width: '110px' }}>견적 상태</th>
                  <th className="text-right p-3 text-sm font-medium" style={{ width: '120px' }}>설치비</th>
                  <th className="text-center p-3 text-sm font-medium" style={{ width: '80px' }}>정산</th>
                  {/* 진행중 탭: 되돌리기 버튼 */}
                  {activeTab === 'in-progress' && (
                    <th className="text-center p-3 text-sm font-medium" style={{ width: '80px' }}></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(order => {
                  const s1Status = order.s1SettlementStatus || 'unsettled'
                  const quote = order.customerQuote
                  const hasEquipmentQuote = (quote?.items?.filter(i => i.category === 'equipment') || []).length > 0
                  const hasInstallQuote = (quote?.items?.filter(i => i.category === 'installation') || []).length > 0
                  const workTypes = Array.from(new Set(order.items.map(i => i.workType)))

                  return (
                    <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                      {/* 체크박스 */}
                      {activeTab !== 'settled' && (
                        <td className="p-3 text-center">
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

                      {/* 현장명 */}
                      <td className="p-3">
                        <p className="font-semibold text-sm truncate">{order.businessName}</p>
                      </td>

                      {/* 주소 */}
                      <td className="p-3">
                        <p className="text-xs text-gray-600 truncate">{order.address}</p>
                      </td>

                      {/* 견적 상태 (장비/설치비 미니 뱃지) */}
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                            hasEquipmentQuote ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'
                          }`}>
                            장비
                          </span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                            hasInstallQuote ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'
                          }`}>
                            설치비
                          </span>
                        </div>
                      </td>

                      {/* 설치비 금액 */}
                      <td className="p-3 text-right">
                        <p className="text-sm font-medium">
                          {order.installationCost?.totalAmount
                            ? `${order.installationCost.totalAmount.toLocaleString('ko-KR')}원`
                            : <span className="text-gray-400">-</span>
                          }
                        </p>
                      </td>

                      {/* 정산 상태 뱃지 */}
                      <td className="p-3 text-center">
                        <Badge className={`${S1_SETTLEMENT_STATUS_COLORS[s1Status]} text-[10px] border`}>
                          {S1_SETTLEMENT_STATUS_LABELS[s1Status]}
                        </Badge>
                      </td>

                      {/* 진행중 탭: 되돌리기 버튼 */}
                      {activeTab === 'in-progress' && (
                        <td className="p-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-gray-500 hover:text-gray-700"
                            onClick={() => handleRevertToUnsettled(order.id, order.businessName)}
                          >
                            <Undo2 className="h-3 w-3 mr-1" />
                            되돌리기
                          </Button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* 모바일 카드 리스트 */}
          <div className="md:hidden space-y-3">
            {filteredOrders.map(order => {
              const s1Status = order.s1SettlementStatus || 'unsettled'
              const workTypes = Array.from(new Set(order.items.map(i => i.workType)))

              return (
                <div key={order.id} className="border rounded-lg bg-white p-4 space-y-3">
                  {/* 상단: 체크 + 작업종류 + 정산 뱃지 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {activeTab !== 'settled' && (
                        <Checkbox
                          checked={selectedIds.has(order.id)}
                          onCheckedChange={() => handleSelectToggle(order.id)}
                        />
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
                    <Badge className={`${S1_SETTLEMENT_STATUS_COLORS[s1Status]} text-[10px] border`}>
                      {S1_SETTLEMENT_STATUS_LABELS[s1Status]}
                    </Badge>
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

                  {/* 진행중 탭: 되돌리기 */}
                  {activeTab === 'in-progress' && (
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-gray-500"
                        onClick={() => handleRevertToUnsettled(order.id, order.businessName)}
                      >
                        <Undo2 className="h-3 w-3 mr-1" />
                        되돌리기
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
