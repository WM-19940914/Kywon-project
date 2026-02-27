/**
 * 발주 상세보기 모달
 *
 * 카드 클릭 시 열리는 모달로, 발주의 모든 정보를 자세히 보여줍니다.
 * 진행상태는 배송/설치/정산 데이터 기반으로 자동 계산되어 읽기전용 뱃지로 표시됩니다.
 */

'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ORDER_STATUS_LABELS,
  type Order,
  type StoredEquipment,
  type ContactPerson,
  type BuildingManager
} from '@/types/order'
import { computeKanbanStatus } from '@/lib/order-status-utils'
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
import { AlertTriangle, Edit, Trash2, XCircle, Phone, FileText } from 'lucide-react'
import { useAlert } from '@/components/ui/custom-alert'
import { useState, useEffect } from 'react'
import { countInventoryEvents } from '@/lib/supabase/dal'

/** 상태 뱃지 스타일 — Tailwind 기본 색상 체계 */
const STATUS_BADGE_STYLES: Record<string, string> = {
  'received':    'bg-amber-100 text-amber-700 border border-amber-200',
  'in-progress': 'bg-blue-100 text-blue-700 border border-blue-200',
  'completed':   'bg-emerald-100 text-emerald-700 border border-emerald-200',
  'settled':     'bg-slate-100 text-slate-600 border border-slate-200',
  'cancelled':   'bg-red-100 text-red-600 border border-red-200',
}

/** 작업종류별 좌측 컬러보더 */
const WORK_TYPE_BORDER_COLORS: Record<string, string> = {
  '신규설치': 'border-l-amber-400',
  '이전설치': 'border-l-blue-400',
  '철거보관': 'border-l-slate-400',
  '철거폐기': 'border-l-slate-400',
  '재고설치': 'border-l-violet-400',
  '반납폐기': 'border-l-rose-400',
}

/**
 * 컴포넌트가 받을 Props
 * (자동 분류이므로 onStatusChange 제거됨)
 */
interface OrderDetailDialogProps {
  order: Order | null                              // 보여줄 발주 (null이면 모달 안 열림)
  open: boolean                                    // 모달 열림/닫힘 상태
  onOpenChange: (open: boolean) => void           // 모달 닫기 함수
  onDelete?: (orderId: string) => void            // 완전 삭제 함수
  onEdit?: (order: Order) => void                 // 수정 함수
  onCancelOrder?: (orderId: string, reason: string) => void  // 발주 취소 함수
  onQuoteView?: (order: Order) => void            // 견적서 보기/작성 함수
  storedEquipment?: StoredEquipment[]             // 보관 장비 목록 (재고설치 정보 표시용)
}

/**
 * 발주 상세보기 모달
 */
export function OrderDetailDialog({
  order,
  open,
  onOpenChange,
  onDelete,
  onEdit,
  onCancelOrder,
  onQuoteView,
  storedEquipment = []
}: OrderDetailDialogProps) {

  const { showConfirm } = useAlert()

  // 삭제/취소 선택 다이얼로그
  const [deleteChoiceOpen, setDeleteChoiceOpen] = useState(false)
  // 취소 사유 입력 다이얼로그
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  // 유휴재고 이벤트 수 (삭제 경고용)
  const [inventoryEventCount, setInventoryEventCount] = useState(0)

  // 삭제/취소 선택 다이얼로그 열릴 때 유휴재고 이벤트 수 조회
  useEffect(() => {
    if (deleteChoiceOpen && order) {
      countInventoryEvents(order.id).then(setInventoryEventCount)
    }
  }, [deleteChoiceOpen, order])

  // order가 없으면 모달 안 보여줌
  if (!order) return null

  // 자동 계산된 칸반 상태
  const kanbanStatus = computeKanbanStatus(order)

  // 날짜 포맷팅 (2024-01-15 → 2024.01.15)
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return dateString.replace(/-/g, '.')
  }

  // 삭제 버튼 클릭 → 선택지 다이얼로그
  const handleDeleteClick = () => {
    setDeleteChoiceOpen(true)
  }

  // 완전 삭제 실행
  const handlePermanentDelete = async () => {
    if (!onDelete) return
    setDeleteChoiceOpen(false)

    const warningMsg = inventoryEventCount > 0
      ? `"${order.documentNumber}" 발주를 완전 삭제하시겠습니까?\n\n⚠️ 유휴재고 이벤트 ${inventoryEventCount}건도 함께 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`
      : `"${order.documentNumber}" 발주를 완전 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`
    const confirmed = await showConfirm(warningMsg)

    if (confirmed) {
      onDelete(order.id)
      onOpenChange(false)
    }
  }

  // 발주취소 선택 → 사유 입력 다이얼로그
  const handleCancelChoice = () => {
    setDeleteChoiceOpen(false)
    setCancelReason('')
    setCancelDialogOpen(true)
  }

  // 발주취소 실행
  const handleCancelConfirm = () => {
    if (!onCancelOrder || !cancelReason.trim()) return
    onCancelOrder(order.id, cancelReason.trim())
    setCancelDialogOpen(false)
    onOpenChange(false)
  }

  // 수정 버튼 클릭
  const handleEdit = () => {
    if (!onEdit) return
    onEdit(order)
    onOpenChange(false)  // 상세 모달 닫기
  }

  // ─── 담당자/건물관리인 fallback 로직 (JSX 밖에서 계산) ───
  const contactList: ContactPerson[] = (order.contacts && order.contacts.length > 0)
    ? order.contacts
    : (order.contactName || order.contactPhone)
      ? [{ name: order.contactName || '', phone: order.contactPhone || '' }]
      : []
  const managerList: BuildingManager[] = (order.buildingManagers && order.buildingManagers.length > 0)
    ? order.buildingManagers
    : order.buildingManagerPhone
      ? [{ name: '', phone: order.buildingManagerPhone }]
      : []
  const hasContacts = contactList.length > 0 || managerList.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">

        {/* ─── 헤더: 사업자명 대제목 + 서브라인 + 우측 아이콘 버튼 ─── */}
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl font-bold text-foreground truncate font-heading">
                {order.businessName}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground tabular-nums">{order.documentNumber}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-xs text-muted-foreground">{order.affiliate}</span>
                  <Badge className={`text-[11px] px-2 py-0.5 ${STATUS_BADGE_STYLES[kanbanStatus] || 'bg-slate-100 text-slate-600'}`}>
                    {ORDER_STATUS_LABELS[kanbanStatus]}
                  </Badge>
                  {order.isPreliminaryQuote && (
                    <Badge className="text-[11px] px-2 py-0.5 bg-brick-50 text-brick-600 border-brick-200">
                      사전견적건
                    </Badge>
                  )}
                </div>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-0">

          {/* ─── 기본 정보: 컴팩트 키-밸류 스택 ─── */}
          <div className="border-t border-border/50 pt-4 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">발주일</div>
                <div className="text-sm font-medium text-foreground mt-0.5">{formatDate(order.orderDate)}</div>
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">설치요청일</div>
                <div className="text-sm font-medium text-foreground mt-0.5">{formatDate(order.requestedInstallDate)}</div>
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">계열사</div>
                <div className="text-sm font-medium text-foreground mt-0.5">{order.affiliate}</div>
              </div>
              <div className="col-span-full">
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">주소</div>
                <div className="text-sm font-medium text-foreground mt-0.5">{order.address}</div>
              </div>
            </div>
          </div>

          {/* ─── 담당자: 카드형 + tel: 링크 ─── */}
          {hasContacts && (
            <div className="border-t border-border/50 pt-4 pb-4">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400 mb-2">담당자</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {contactList.map((c, idx) => (
                  <div key={`contact-${idx}`} className="bg-slate-50 rounded-lg px-3 py-2">
                    <div className="text-sm font-medium text-foreground">
                      {c.name || '담당자'}{contactList.length > 1 ? ` ${idx + 1}` : ''}
                    </div>
                    {c.phone && (
                      <a
                        href={`tel:${c.phone}`}
                        className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-0.5"
                      >
                        <Phone className="h-3 w-3" />
                        {c.phone}
                      </a>
                    )}
                    {c.memo && (
                      <div className="text-[11px] text-slate-400 mt-0.5">{c.memo}</div>
                    )}
                  </div>
                ))}
                {managerList.map((m, idx) => (
                  <div key={`manager-${idx}`} className="bg-slate-50 rounded-lg px-3 py-2">
                    <div className="text-sm font-medium text-foreground">
                      {m.name || '건물관리인'}{managerList.length > 1 ? ` ${idx + 1}` : ''}
                    </div>
                    {m.phone && (
                      <a
                        href={`tel:${m.phone}`}
                        className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-0.5"
                      >
                        <Phone className="h-3 w-3" />
                        {m.phone}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── 발주내역: 작업종류별 좌측 컬러보더 ─── */}
          <div className="border-t border-border/50 pt-4 pb-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400 mb-2">발주내역</div>

            {order.isPreliminaryQuote ? (
              <div className="bg-amber-50/60 border border-amber-100 rounded-lg p-4">
                <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  사전견적 요청건 (현장 확인 후 장비 선택 예정)
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  설치기사님 현장 방문 후 적합한 장비를 선택하여 견적을 받는 발주입니다.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {order.items.map((item) => {
                  // 재고설치인 경우 원본 보관 장비 정보 조회
                  const linkedEquip = item.storedEquipmentId
                    ? storedEquipment.find(e => e.id === item.storedEquipmentId)
                    : null
                  const borderColor = WORK_TYPE_BORDER_COLORS[item.workType] || 'border-l-slate-300'

                  return (
                    <div
                      key={item.id}
                      className={`border border-border/60 rounded-lg p-3 bg-white hover:bg-slate-50/50 transition-colors border-l-[3px] ${borderColor}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-medium">{item.workType}</span>
                          <span className="text-slate-300">·</span>
                          <span className="text-sm font-medium text-foreground">{item.category}</span>
                        </div>
                        <span className="text-base font-bold text-foreground">
                          {item.quantity}대
                        </span>
                      </div>
                      <div className="mt-1.5 text-sm text-slate-600 font-medium">
                        {item.model}
                      </div>
                      {/* 재고설치: 철거 현장 + 제조 정보 */}
                      {linkedEquip && (
                        <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                          <p className="font-medium text-foreground">
                            {linkedEquip.affiliate && !linkedEquip.siteName.startsWith(linkedEquip.affiliate) ? `${linkedEquip.affiliate} · ` : ''}{linkedEquip.siteName} 철거 장비
                          </p>
                          <div className="flex gap-3 flex-wrap">
                            {linkedEquip.removalDate && <span>철거일: {linkedEquip.removalDate.replace(/-/g, '.')}</span>}
                            {linkedEquip.manufacturer && <span>제조사: {linkedEquip.manufacturer}</span>}
                            {linkedEquip.manufacturingDate && <span>{linkedEquip.manufacturingDate}년식</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ─── 특이사항: 부드러운 amber ─── */}
          {order.notes && (
            <div className="border-t border-border/50 pt-4 pb-4">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400 mb-2">특이사항</div>
              <div className="bg-amber-50/60 border border-amber-100 p-3 rounded-lg">
                <p className="text-sm text-amber-900 leading-relaxed">{order.notes}</p>
              </div>
            </div>
          )}

          {/* ─── 완료/정산 정보 (있을 경우만) ─── */}
          {(order.completionDate || order.settlementDate) && (
            <div className="border-t border-border/50 pt-4 pb-4">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400 mb-2">완료/정산</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                {order.completionDate && (
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">설치완료일</div>
                    <div className="text-sm font-medium text-foreground mt-0.5">{formatDate(order.completionDate)}</div>
                  </div>
                )}
                {order.settlementDate && (
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">정산처리일</div>
                    <div className="text-sm font-medium text-foreground mt-0.5">{formatDate(order.settlementDate)}</div>
                  </div>
                )}
                {order.settlementMonth && (
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">정산월</div>
                    <div className="text-sm font-medium text-foreground mt-0.5">{order.settlementMonth}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── 하단: 수정/삭제(좌) + 견적서/닫기(우) ─── */}
        <div className="flex justify-between items-center gap-2 pt-4 border-t border-border/50">
          {/* 좌측: 수정/삭제 */}
          <div className="flex items-center gap-1">
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={handleEdit}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {(onDelete || onCancelOrder) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={handleDeleteClick}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          {/* 우측: 견적서 + 닫기 */}
          <div className="flex items-center gap-2">
          {onQuoteView && (
            order.customerQuote?.items?.length ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                onClick={() => { onQuoteView(order); onOpenChange(false) }}
              >
                <FileText className="h-4 w-4" />
                견적서 보기
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="gap-1" disabled>
                <FileText className="h-4 w-4" />
                견적서 미작성
              </Button>
            )
          )}
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
          </div>
        </div>
      </DialogContent>

      {/* ─── 삭제/취소 선택 다이얼로그 ─── */}
      <AlertDialog open={deleteChoiceOpen} onOpenChange={setDeleteChoiceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>발주 삭제 방법 선택</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>&ldquo;{order.businessName}&rdquo; 발주를 어떻게 처리하시겠습니까?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            {onCancelOrder && (
              <button
                className="w-full text-left border rounded-lg p-3 hover:bg-carrot-50 hover:border-carrot-300 transition-colors"
                onClick={handleCancelChoice}
              >
                <div className="flex items-center gap-2 font-medium text-sm text-carrot-700">
                  <XCircle className="h-4 w-4" />
                  발주취소 (기록 보관)
                </div>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  취소 사유를 입력하고, 과거내역에서 확인할 수 있습니다.
                </p>
              </button>
            )}
            {onDelete && (
              <button
                className="w-full text-left border rounded-lg p-3 hover:bg-brick-50 hover:border-brick-300 transition-colors"
                onClick={handlePermanentDelete}
              >
                <div className="flex items-center gap-2 font-medium text-sm text-brick-700">
                  <Trash2 className="h-4 w-4" />
                  완전 삭제 (복구 불가)
                </div>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  DB에서 완전히 삭제됩니다. 되돌릴 수 없습니다.
                </p>
                {inventoryEventCount > 0 && (
                  <div className="flex items-start gap-1.5 mt-2 ml-6 p-2 bg-gold-50 border border-gold-200 rounded-md">
                    <AlertTriangle className="h-3.5 w-3.5 text-gold-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-gold-700">
                      이 발주에 연결된 <span className="font-bold">유휴재고 이벤트 {inventoryEventCount}건</span>이 있습니다.
                      완전 삭제 시 유휴재고 기록도 함께 삭제됩니다.
                    </p>
                  </div>
                )}
              </button>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>돌아가기</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── 취소 사유 입력 다이얼로그 ─── */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>발주 취소</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>&ldquo;{order.businessName}&rdquo; 발주의 취소 사유를 입력해주세요.</p>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="취소 사유를 입력해주세요"
                  className="w-full border rounded-md p-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-brick-300 focus:border-brick-400"
                />
                <p className="text-xs text-gray-500">
                  취소된 발주는 과거내역에서 확인할 수 있습니다.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>돌아가기</AlertDialogCancel>
            <AlertDialogAction
              className="bg-brick-600 hover:bg-brick-700 text-white"
              disabled={!cancelReason.trim()}
              onClick={handleCancelConfirm}
            >
              발주 취소
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
