/**
 * 선구매 장비 페이지
 *
 * 교원그룹이 미리 대금을 지불하고 구매한 장비를 관리합니다.
 * - 돈을 먼저 받고 → 장비를 사서 → 교원 재고로 넘기는 건들
 * - 선구매 등록 (계열사/모델명/수량/선정산 월)
 * - 사용 기록: 나중에 "XX현장에서 선구매 장비 써주세요" → 기록 남기기
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  fetchPrepurchaseEquipment,
  createPrepurchaseEquipment,
  deletePrepurchaseEquipment,
  fetchPrepurchaseUsage,
  createPrepurchaseUsage,
  deletePrepurchaseUsage,
} from '@/lib/supabase/dal'
import type { PrepurchaseEquipment, PrepurchaseUsage } from '@/types/prepurchase'
import { AFFILIATE_OPTIONS } from '@/types/order'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { useAlert } from '@/components/ui/custom-alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import { priceTable, type PriceTableRow } from '@/lib/price-table'
import {
  ShoppingCart,
  Plus,
  MapPin,
  Trash2,
  Package,
  ChevronDown,
  ChevronUp,
  Search,
  FileText,
} from 'lucide-react'
import { ExcelExportButton } from '@/components/ui/excel-export-button'
import { exportToExcel, buildExcelFileName, type ExcelColumn } from '@/lib/excel-export'

export default function PrepurchasePage() {
  const { showAlert } = useAlert()

  // === 상태 ===
  const [items, setItems] = useState<PrepurchaseEquipment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [registerOpen, setRegisterOpen] = useState(false) // 등록 다이얼로그

  // 사용기록 관련
  const [expandedId, setExpandedId] = useState<string | null>(null) // 펼쳐진 행
  const [usageMap, setUsageMap] = useState<Record<string, PrepurchaseUsage[]>>({})
  const [usageLoading, setUsageLoading] = useState<string | null>(null)
  const [usageDialogOpen, setUsageDialogOpen] = useState(false)
  const [usageTarget, setUsageTarget] = useState<PrepurchaseEquipment | null>(null)

  // 필터
  const [affiliateFilter, setAffiliateFilter] = useState('all')

  // === 삭제 확인창 상태 ===
  // 1. 선구매 건 리스트 전체 삭제용
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  // 2. 개별 사용 기록 삭제용
  const [usageDeleteConfirmOpen, setUsageDeleteConfirmOpen] = useState(false)
  const [pendingUsageDelete, setPendingUsageDelete] = useState<PrepurchaseUsage | null>(null)

  // === 데이터 로드 ===
  useEffect(() => {
    fetchPrepurchaseEquipment().then(data => {
      setItems(data)
      setIsLoading(false)
    })
  }, [])

  // 필터링된 목록
  const filteredItems = useMemo(() => {
    if (affiliateFilter === 'all') return items
    return items.filter(i => i.affiliate === affiliateFilter)
  }, [items, affiliateFilter])

  // === 행 펼치기 → 사용기록 로드 ===
  const handleToggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    if (!usageMap[id]) {
      setUsageLoading(id)
      const usages = await fetchPrepurchaseUsage(id)
      setUsageMap(prev => ({ ...prev, [id]: usages }))
      setUsageLoading(null)
    }
  }

  // === 등록 ===
  const handleRegister = async (data: {
    affiliate: string
    modelName: string
    quantity: number
    settlementMonth: string
    notes?: string
  }) => {
    const created = await createPrepurchaseEquipment(data)
    if (created) {
      setItems(prev => [created, ...prev])
      showAlert('선구매 장비가 등록되었습니다.', 'success')
      setRegisterOpen(false)
    } else {
      showAlert('등록에 실패했습니다.', 'error')
    }
  }

  // === 삭제 (선구매 장비 전체) ===
  const handleDeleteTarget = (id: string) => {
    setPendingDeleteId(id)
    setDeleteConfirmOpen(true)
  }

  const confirmDelete = async () => {
    if (!pendingDeleteId) return

    setDeleteConfirmOpen(false)
    const success = await deletePrepurchaseEquipment(pendingDeleteId)
    if (success) {
      setItems(prev => prev.filter(i => i.id !== pendingDeleteId))
      setExpandedId(null)
      showAlert('삭제되었습니다.', 'success')
    } else {
      showAlert('삭제에 실패했습니다.', 'error')
    }
  }

  // === 사용기록 추가 ===
  const handleAddUsage = async (data: {
    prepurchaseId: string
    affiliate?: string
    siteName: string
    usedQuantity: number
    usedDate: string
    notes?: string
  }) => {
    const created = await createPrepurchaseUsage(data)
    if (created) {
      // 사용기록 목록 갱신
      setUsageMap(prev => ({
        ...prev,
        [data.prepurchaseId]: [created, ...(prev[data.prepurchaseId] || [])],
      }))
      // 메인 목록의 usedQuantity 갱신
      setItems(prev =>
        prev.map(i =>
          i.id === data.prepurchaseId
            ? { ...i, usedQuantity: i.usedQuantity + data.usedQuantity }
            : i
        )
      )
      showAlert('사용 기록이 추가되었습니다.', 'success')
      setUsageDialogOpen(false)
    } else {
      showAlert('사용 기록 추가에 실패했습니다.', 'error')
    }
  }

  // === 사용기록 삭제 ===
  const handleDeleteUsageTarget = (usage: PrepurchaseUsage) => {
    setPendingUsageDelete(usage)
    setUsageDeleteConfirmOpen(true)
  }

  const confirmDeleteUsage = async () => {
    if (!pendingUsageDelete) return

    setUsageDeleteConfirmOpen(false)
    const success = await deletePrepurchaseUsage(pendingUsageDelete.id, pendingUsageDelete.prepurchaseId, pendingUsageDelete.usedQuantity)
    if (success) {
      setUsageMap(prev => ({
        ...prev,
        [pendingUsageDelete.prepurchaseId]: (prev[pendingUsageDelete.prepurchaseId] || []).filter(u => u.id !== pendingUsageDelete.id),
      }))
      setItems(prev =>
        prev.map(i =>
          i.id === pendingUsageDelete.prepurchaseId
            ? { ...i, usedQuantity: Math.max(0, i.usedQuantity - pendingUsageDelete.usedQuantity) }
            : i
        )
      )
      showAlert('사용 기록이 삭제되었습니다.', 'success')
    }
  }

  /** 엑셀 다운로드 */
  const handleExcelExport = () => {
    const columns: ExcelColumn<PrepurchaseEquipment>[] = [
      { header: '계열사', key: 'affiliate', width: 14 },
      { header: '모델명', key: 'modelName', width: 22 },
      { header: '구매수량', key: 'quantity', width: 10, numberFormat: '#,##0' },
      { header: '사용수량', key: 'usedQuantity', width: 10, numberFormat: '#,##0' },
      { header: '잔여수량', getValue: (i) => i.quantity - i.usedQuantity, width: 10, numberFormat: '#,##0' },
      { header: '선정산월', key: 'settlementMonth', width: 10 },
      { header: '메모', key: 'notes', width: 20 },
    ]
    exportToExcel({
      data: filteredItems,
      columns,
      fileName: buildExcelFileName('선구매장비'),
    })
  }

  // === 스켈레톤 ===
  if (isLoading) {
    return (
      <div className="container mx-auto max-w-[1400px] py-6 px-4 md:px-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-[1400px] py-6 px-4 md:px-6">
      {/* 헤더 */}
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-teal-50 text-teal-600 p-2.5 rounded-xl">
          <ShoppingCart className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">선구매 장비</h1>
          <p className="text-muted-foreground mt-0.5">
            대금 선지급 후 구매 → 교원 재고로 입고되는 장비
          </p>
        </div>
      </div>

      {/* 필터 + 등록 버튼 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={affiliateFilter} onValueChange={setAffiliateFilter}>
            <SelectTrigger className="w-[160px] rounded-lg">
              <SelectValue placeholder="전체 계열사" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 계열사</SelectItem>
              {AFFILIATE_OPTIONS.map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className="text-sm text-slate-500">
            총 {filteredItems.length}건
          </p>

          <div className="flex-1" />

          <ExcelExportButton onClick={handleExcelExport} disabled={filteredItems.length === 0} />
          <Button onClick={() => setRegisterOpen(true)} className="rounded-lg">
            <Plus className="h-4 w-4 mr-1" />
            선구매 등록
          </Button>
        </div>
      </div>

      {/* 테이블 */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="선구매 장비가 없습니다"
          description="'선구매 등록' 버튼으로 새 건을 추가하세요"
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* 테이블 헤더 */}
          <div className="hidden md:grid grid-cols-[1fr_1.5fr_1fr_80px_100px_100px_60px] gap-2 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500">
            <span>계열사</span>
            <span>모델명</span>
            <span>메모</span>
            <span className="text-center">수량</span>
            <span className="text-center">사용/잔여</span>
            <span className="text-center">선정산 월</span>
            <span className="text-center"></span>
          </div>

          {/* 테이블 바디 */}
          <div className="divide-y divide-slate-100">
            {filteredItems.map(item => {
              const remaining = item.quantity - item.usedQuantity
              const isExpanded = expandedId === item.id
              const usages = usageMap[item.id] || []

              return (
                <div key={item.id}>
                  {/* === 메인 행 === */}
                  <div
                    className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_1fr_80px_100px_100px_60px] gap-2 px-5 py-3.5 hover:bg-slate-50/50 transition-colors cursor-pointer items-center"
                    onClick={() => handleToggleExpand(item.id)}
                  >
                    {/* 계열사 */}
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs bg-slate-50">
                        {item.affiliate}
                      </Badge>
                      {/* 모바일에서만 보이는 모델명 */}
                      <span className="md:hidden text-sm font-medium text-slate-700 truncate">
                        {item.modelName}
                      </span>
                    </div>

                    {/* 모델명 (데스크톱) */}
                    <span className="hidden md:block text-sm font-medium text-slate-700 truncate">
                      {item.modelName}
                    </span>

                    {/* 메모 (데스크톱) */}
                    <span className="hidden md:block text-xs text-slate-400 truncate">
                      {item.notes || '-'}
                    </span>

                    {/* 수량 */}
                    <span className="hidden md:block text-center text-sm font-bold text-slate-800">
                      {item.quantity}대
                    </span>

                    {/* 사용/잔여 */}
                    <div className="hidden md:flex items-center justify-center gap-1">
                      <span className="text-xs text-slate-400">
                        {item.usedQuantity}사용
                      </span>
                      <span className="text-xs text-slate-300">/</span>
                      <span className={`text-xs font-bold ${remaining > 0 ? 'text-teal-600' : 'text-slate-400'}`}>
                        {remaining}잔여
                      </span>
                    </div>

                    {/* 선정산 월 */}
                    <span className="hidden md:block text-center text-sm text-slate-600">
                      {item.settlementMonth}
                    </span>

                    {/* 펼치기 아이콘 */}
                    <div className="hidden md:flex items-center justify-center">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      )}
                    </div>

                    {/* 모바일 서브 정보 */}
                    <div className="md:hidden flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      <span>{item.quantity}대</span>
                      <span>{item.usedQuantity}사용 / {remaining}잔여</span>
                      <span>{item.settlementMonth}</span>
                      {item.notes && (
                        <span className="truncate max-w-[150px]">{item.notes}</span>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5 ml-auto" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 ml-auto" />
                      )}
                    </div>
                  </div>

                  {/* === 펼친 영역: 사용 기록 === */}
                  {isExpanded && (
                    <div className="bg-slate-50/80 border-t border-slate-100 px-5 py-4 space-y-3">
                      {/* 상단: 메모 + 버튼 */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-slate-400" />
                          <span className="text-sm font-semibold text-slate-600">사용 기록</span>
                          {item.notes && (
                            <span className="text-xs text-slate-400">| {item.notes}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs rounded-lg"
                            onClick={(e) => {
                              e.stopPropagation()
                              setUsageTarget(item)
                              setUsageDialogOpen(true)
                            }}
                          >
                            <MapPin className="h-3.5 w-3.5 mr-1" />
                            사용 기록 추가
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-brick-500 hover:text-brick-600 hover:bg-brick-50 rounded-lg"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteTarget(item.id)
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            삭제
                          </Button>
                        </div>
                      </div>

                      {/* 사용기록 목록 */}
                      {usageLoading === item.id ? (
                        <div className="space-y-2">
                          <Skeleton className="h-8 w-full" />
                          <Skeleton className="h-8 w-full" />
                        </div>
                      ) : usages.length === 0 ? (
                        <p className="text-xs text-slate-400 py-3 text-center">
                          아직 사용 기록이 없습니다
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {usages.map(usage => (
                            <div
                              key={usage.id}
                              className="flex items-center justify-between bg-white rounded-lg border border-slate-200 px-4 py-2.5"
                            >
                              <div className="flex items-center gap-3 flex-wrap">
                                {usage.affiliate && (
                                  <Badge variant="outline" className="text-[10px] bg-slate-50">
                                    {usage.affiliate}
                                  </Badge>
                                )}
                                <span className="text-sm font-medium text-slate-700">
                                  {usage.siteName}
                                </span>
                                <Badge variant="outline" className="text-[10px]">
                                  {usage.usedQuantity}대
                                </Badge>
                                <span className="text-xs text-slate-400">
                                  {usage.usedDate}
                                </span>
                                {usage.notes && (
                                  <span className="text-xs text-slate-400 truncate max-w-[200px]">
                                    {usage.notes}
                                  </span>
                                )}
                              </div>
                              <button
                                className="text-slate-300 hover:text-brick-500 transition-colors p-1"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteUsageTarget(usage)
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* === 등록 다이얼로그 === */}
      <RegisterDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onSubmit={handleRegister}
      />

      {/* === 사용기록 추가 다이얼로그 === */}
      <UsageDialog
        open={usageDialogOpen}
        onOpenChange={setUsageDialogOpen}
        target={usageTarget}
        onSubmit={handleAddUsage}
      />

      {/* 
          [삭제 알림창 1] 선구매 장비 삭제 (전체 삭제) 
          실수로 장비를 삭제하는 것을 막아주는 예쁜 빨간색 알림창입니다.
      */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-[420px] border-2 border-brick-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <div className="bg-brick-100 p-1.5 rounded-full">
                <Trash2 className="h-5 w-5 text-brick-600" />
              </div>
              선구매 장비 삭제
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-3 pb-2 text-base text-slate-600">
              정말로 이 <span className="font-bold text-brick-600">선구매 건을 삭제</span>하시겠습니까?
              <br /><br />
              이 장비에 등록된 <span className="text-brick-600 font-semibold underline decoration-brick-300 underline-offset-4">과거 사용 기록들도 모두 함께 삭제</span>되어 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 mt-2">
            <AlertDialogCancel className="rounded-xl border-slate-200 hover:bg-slate-50 font-semibold h-11">
              아니요, 취소할게요
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-brick-600 hover:bg-brick-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 h-11"
            >
              네, 삭제하겠습니다
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 
          [삭제 알림창 2] 단일 사용 기록 삭제
          어디서 얼마나 사용했는지 기록한 '내역 1줄'만 지울 때 나오는 알림창입니다.
      */}
      <AlertDialog open={usageDeleteConfirmOpen} onOpenChange={setUsageDeleteConfirmOpen}>
        <AlertDialogContent className="max-w-[400px] border-2 border-brick-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <div className="bg-brick-100 p-1.5 rounded-full">
                <Trash2 className="h-5 w-5 text-brick-600" />
              </div>
              사용 기록 삭제
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-3 pb-2 text-base text-slate-600">
              <span className="font-semibold text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 mb-3 block">
                현장명: {pendingUsageDelete?.siteName} ({pendingUsageDelete?.usedQuantity}대)
              </span>
              해당 현장에 사용된 기록을 <span className="text-brick-600 font-bold">삭제</span>하시겠습니까?
              <br />
              <span className="text-[12px] text-slate-400 mt-2 block italic">※ 삭제하시면 메인 장비의 '사용 수량'이 즉시 이전으로 되돌아갑니다.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 mt-2">
            <AlertDialogCancel className="rounded-xl border-slate-200 hover:bg-slate-50 font-semibold h-11">
              아니요, 놔둘게요
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUsage}
              className="bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 h-11"
            >
              네, 삭제하겠습니다
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}

// ============================================================
// 등록 다이얼로그
// ============================================================

function RegisterDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSubmit: (data: {
    affiliate: string
    modelName: string
    quantity: number
    settlementMonth: string
    notes?: string
  }) => Promise<void>
}) {
  const [affiliate, setAffiliate] = useState('')
  const [modelName, setModelName] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [settlementMonth, setSettlementMonth] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [priceSheetOpen, setPriceSheetOpen] = useState(false)

  // 기본 선정산 월: 이번 달
  useEffect(() => {
    if (open) {
      const now = new Date()
      setSettlementMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
      setAffiliate('')
      setModelName('')
      setQuantity(1)
      setNotes('')
    }
  }, [open])

  const handleSubmit = async () => {
    if (!affiliate || !modelName || !settlementMonth) return
    setIsSubmitting(true)
    await onSubmit({
      affiliate,
      modelName,
      quantity,
      settlementMonth,
      notes: notes || undefined,
    })
    setIsSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>선구매 장비 등록</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* 계열사 */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">구매 계열사</label>
            <Select value={affiliate} onValueChange={setAffiliate}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="계열사 선택" />
              </SelectTrigger>
              <SelectContent>
                {AFFILIATE_OPTIONS.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 모델명 */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">모델명</label>
            <div className="flex gap-2">
              <Input
                placeholder="예: AP290DAPDHH1S"
                value={modelName}
                onChange={e => setModelName(e.target.value)}
                className="rounded-lg flex-1"
              />
              <Button
                type="button"
                variant="outline"
                className="rounded-lg text-xs shrink-0"
                onClick={() => setPriceSheetOpen(true)}
              >
                <FileText className="h-3.5 w-3.5 mr-1" />
                단가표
              </Button>
            </div>
          </div>

          {/* 수량 */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">수량</label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={e => setQuantity(Number(e.target.value) || 1)}
              className="rounded-lg w-32"
            />
          </div>

          {/* 선정산 월 */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">선정산 월</label>
            <Input
              type="month"
              value={settlementMonth}
              onChange={e => setSettlementMonth(e.target.value)}
              className="rounded-lg w-48"
            />
          </div>

          {/* 메모 */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">메모 (선택)</label>
            <Input
              placeholder="특이사항 메모"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="rounded-lg"
            />
          </div>

          {/* 버튼 */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
            <Button
              className="rounded-lg"
              disabled={!affiliate || !modelName || !settlementMonth || isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? '등록 중...' : '등록'}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* 단가표 Sheet (우측 Drawer) */}
      <PrepurchasePriceSheet
        open={priceSheetOpen}
        onOpenChange={setPriceSheetOpen}
        onSelect={(model) => {
          setModelName(model)
          setPriceSheetOpen(false)
        }}
      />
    </Dialog>
  )
}

// ============================================================
// 단가표 선택 Sheet
// ============================================================

/** 카테고리별 그룹핑 */
function groupByCategory(rows: PriceTableRow[]) {
  const groups: { category: string; items: PriceTableRow[] }[] = []
  for (const row of rows) {
    const existing = groups.find(g => g.category === row.category)
    if (existing) {
      existing.items.push(row)
    } else {
      groups.push({ category: row.category, items: [row] })
    }
  }
  return groups
}

function PrepurchasePriceSheet({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSelect: (model: string) => void
}) {
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = priceTable.filter(row =>
    row.category.includes(searchTerm) ||
    row.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.size.includes(searchTerm)
  )
  const grouped = groupByCategory(filtered)

  return (
    <Sheet open={open} onOpenChange={(v) => {
      onOpenChange(v)
      if (!v) setSearchTerm('')
    }}>
      <SheetContent className="w-[32vw] min-w-[400px] p-0 overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-b from-slate-50 to-white">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-gray-900">
              단가표에서 모델 선택
            </SheetTitle>
            <p className="text-sm text-gray-500 mt-1">
              SET 모델을 클릭하면 모델명이 자동 입력됩니다
            </p>
          </SheetHeader>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 placeholder:text-gray-400"
              placeholder="품목, 모델명, 평형으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* 리스트 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {grouped.map((group) => (
            <div key={group.category}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-full">
                  {group.category}
                </span>
                <span className="text-xs text-gray-400">
                  {group.items.length}개
                </span>
              </div>

              <div className="space-y-1.5">
                {group.items.map((row) => (
                  <button
                    key={row.model}
                    type="button"
                    onClick={() => onSelect(row.model)}
                    className="w-full text-left group px-4 py-3 rounded-lg border border-gray-150 bg-white hover:border-teal-300 hover:bg-teal-50/60 hover:shadow-sm transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center min-w-[40px] px-2 py-0.5 text-xs font-bold text-gray-700 bg-gray-100 rounded-md group-hover:bg-teal-100 group-hover:text-teal-700 transition-colors">
                        {row.size}
                      </span>
                      <span className="text-sm font-mono font-semibold text-gray-800 group-hover:text-teal-700 truncate">
                        {row.model}
                      </span>
                    </div>
                    {/* 구성품 미리보기 */}
                    <div className="mt-1.5 flex items-center gap-2 ml-0.5">
                      {row.components
                        .filter(c => c.type === '실내기' || c.type === '실외기')
                        .map((comp, ci) => (
                          <span
                            key={ci}
                            className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded group-hover:bg-teal-50 group-hover:text-teal-500"
                          >
                            [{comp.type}] {comp.model}
                          </span>
                        ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {grouped.length === 0 && (
            <div className="text-center py-12">
              <Search className="h-8 w-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">검색 결과가 없습니다</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ============================================================
// 사용기록 추가 다이얼로그
// ============================================================

function UsageDialog({
  open,
  onOpenChange,
  target,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  target: PrepurchaseEquipment | null
  onSubmit: (data: {
    prepurchaseId: string
    affiliate?: string
    siteName: string
    usedQuantity: number
    usedDate: string
    notes?: string
  }) => Promise<void>
}) {
  const [affiliate, setAffiliate] = useState('')
  const [siteName, setSiteName] = useState('')
  const [usedQuantity, setUsedQuantity] = useState(1)
  const [usedDate, setUsedDate] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setAffiliate('')
      setSiteName('')
      setUsedQuantity(1)
      setUsedDate(new Date().toISOString().split('T')[0])
      setNotes('')
    }
  }, [open])

  if (!target) return null

  const remaining = target.quantity - target.usedQuantity

  const handleSubmit = async () => {
    if (!siteName || !usedDate || usedQuantity < 1) return
    setIsSubmitting(true)
    await onSubmit({
      prepurchaseId: target.id,
      affiliate: affiliate || undefined,
      siteName,
      usedQuantity,
      usedDate,
      notes: notes || undefined,
    })
    setIsSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>사용 기록 추가</DialogTitle>
        </DialogHeader>

        {/* 대상 장비 정보 */}
        <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{target.affiliate}</Badge>
            <span className="font-medium text-slate-700">{target.modelName}</span>
          </div>
          <p className="text-xs text-slate-400">
            총 {target.quantity}대 중 {remaining}대 잔여
          </p>
        </div>

        <div className="space-y-4 mt-2">
          {/* 계열사 */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">계열사</label>
            <Select value={affiliate} onValueChange={setAffiliate}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="계열사 선택" />
              </SelectTrigger>
              <SelectContent>
                {AFFILIATE_OPTIONS.map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 사업자명 */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">사업자명</label>
            <Input
              placeholder="예: OO초등학교, XX아파트"
              value={siteName}
              onChange={e => setSiteName(e.target.value)}
              className="rounded-lg"
            />
          </div>

          {/* 사용 수량 */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">사용 수량</label>
            <Input
              type="number"
              min={1}
              max={remaining}
              value={usedQuantity}
              onChange={e => setUsedQuantity(Number(e.target.value) || 1)}
              className="rounded-lg w-32"
            />
            {remaining > 0 && (
              <p className="text-xs text-slate-400 mt-1">최대 {remaining}대까지 가능</p>
            )}
          </div>

          {/* 사용일 */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">사용일</label>
            <Input
              type="date"
              value={usedDate}
              onChange={e => setUsedDate(e.target.value)}
              className="rounded-lg w-48"
            />
          </div>

          {/* 메모 */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">메모 (선택)</label>
            <Input
              placeholder="발주번호, 특이사항 등"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="rounded-lg"
            />
          </div>

          {/* 버튼 */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
            <Button
              className="rounded-lg"
              disabled={!siteName || !usedDate || usedQuantity < 1 || usedQuantity > remaining || isSubmitting}
              onClick={handleSubmit}
            >
              {isSubmitting ? '저장 중...' : '기록 추가'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
