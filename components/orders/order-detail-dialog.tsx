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
import { Separator } from '@/components/ui/separator'
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
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
import { ClipboardList, Package, MessageSquare, CalendarDays, AlertTriangle, Edit, Trash2, XCircle, User, Phone, Calendar, FileText } from 'lucide-react'
import { useAlert } from '@/components/ui/custom-alert'
import { useState, useEffect } from 'react'
import { countInventoryEvents } from '@/lib/supabase/dal'

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        {/* 헤더 */}
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle>발주 상세</DialogTitle>
              <Badge className={ORDER_STATUS_COLORS[kanbanStatus]}>
                {ORDER_STATUS_LABELS[kanbanStatus]}
              </Badge>
              {order.isPreliminaryQuote && (
                <Badge className="bg-brick-50 text-brick-600 border-brick-200">
                  사전견적건
                </Badge>
              )}
            </div>
          </div>
          <DialogDescription>
            문서번호: {order.documentNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 기본 정보 섹션 */}
          <div>
            <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" /> 기본 정보
            </h3>
            <div className="bg-muted/50 p-4 rounded-xl space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm text-gray-500">계열사</span>
                <span className="col-span-2 font-medium">{order.affiliate}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm text-gray-500">사업자명</span>
                <span className="col-span-2 font-medium">{order.businessName}</span>
              </div>
              <Separator />
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm text-gray-500">주소</span>
                <span className="col-span-2">{order.address}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm text-gray-500">발주일</span>
                <span className="col-span-2">{formatDate(order.orderDate)}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="text-sm text-gray-500 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />설치요청일
                </span>
                <span className="col-span-2">{formatDate(order.requestedInstallDate)}</span>
              </div>

              {/* 담당자 정보 — contacts 배열 우선, 없으면 레거시 필드 fallback */}
              {(() => {
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
                const hasAny = contactList.length > 0 || managerList.length > 0
                if (!hasAny) return null
                return (
                  <>
                    <Separator />
                    {contactList.map((c, idx) => (
                      <div key={idx} className="grid grid-cols-3 gap-2">
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          <User className="h-3.5 w-3.5" />담당자{contactList.length > 1 ? ` ${idx + 1}` : ''}
                        </span>
                        <span className="col-span-2">
                          <span className="font-medium">{c.name || '-'}</span>
                          {c.phone && <span className="ml-2 text-gray-600">{c.phone}</span>}
                          {c.memo && <span className="ml-2 text-xs text-gray-400">({c.memo})</span>}
                        </span>
                      </div>
                    ))}
                    {managerList.map((m, idx) => (
                      <div key={idx} className="grid grid-cols-3 gap-2">
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5" />건물관리인{managerList.length > 1 ? ` ${idx + 1}` : ''}
                        </span>
                        <span className="col-span-2">
                          {m.name && <span className="font-medium">{m.name} </span>}
                          <span>{m.phone}</span>
                        </span>
                      </div>
                    ))}
                  </>
                )
              })()}
            </div>
          </div>

          {/* 발주내역 섹션 */}
          <div>
            <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" /> 발주내역
            </h3>

            {order.isPreliminaryQuote ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-yellow-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  사전견적 요청건 (현장 확인 후 장비 선택 예정)
                </p>
                <p className="text-xs text-gray-600 mt-2">
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

                  return (
                    <div
                      key={item.id}
                      className="border border-gray-200 rounded-lg p-3 bg-white hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {/* 작업종류 - 신규설치는 파란색, 재고설치는 보라색으로 강조 */}
                          <Badge
                            variant="outline"
                            className={`font-normal ${
                              item.workType === '신규설치'
                                ? 'bg-teal-100 text-teal-700 border-teal-300 font-semibold'
                                : item.workType === '재고설치'
                                  ? 'bg-teal-100 text-teal-700 border-teal-300 font-semibold'
                                  : ''
                            }`}
                          >
                            {item.workType}
                          </Badge>
                          {/* 품목 */}
                          <span className="font-medium">{item.category}</span>
                        </div>
                        {/* 수량 */}
                        <span className="text-lg font-bold text-teal-600">
                          {item.quantity}대
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-gray-600 flex gap-4">
                        <span>모델명: <span className="font-mono">{item.model}</span></span>
                      </div>
                      {/* 재고설치: 철거 현장 + 제조 정보 */}
                      {linkedEquip && (
                        <div className="mt-2 text-xs bg-teal-50 border border-teal-200 rounded-md px-3 py-2 space-y-0.5">
                          <p className="font-semibold text-teal-800">
                            {linkedEquip.affiliate && !linkedEquip.siteName.startsWith(linkedEquip.affiliate) ? `${linkedEquip.affiliate} · ` : ''}{linkedEquip.siteName} 철거 장비
                          </p>
                          <div className="flex gap-3 text-teal-500 flex-wrap">
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

          {/* 특이사항 섹션 */}
          {order.notes && (
            <div>
              <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" /> 특이사항
              </h3>
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <p className="text-sm">{order.notes}</p>
              </div>
            </div>
          )}

          {/* 완료/정산 정보 (있을 경우만) */}
          {(order.completionDate || order.settlementDate) && (
            <div>
              <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" /> 완료/정산 정보
              </h3>
              <div className="bg-muted/50 p-4 rounded-xl space-y-2">
                {order.completionDate && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm text-gray-500">설치완료일</span>
                    <span className="col-span-2">{formatDate(order.completionDate)}</span>
                  </div>
                )}
                {order.settlementDate && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm text-gray-500">정산처리일</span>
                    <span className="col-span-2">{formatDate(order.settlementDate)}</span>
                  </div>
                )}
                {order.settlementMonth && (
                  <div className="grid grid-cols-3 gap-2">
                    <span className="text-sm text-gray-500">정산월</span>
                    <span className="col-span-2">{order.settlementMonth}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 하단 버튼 (수동 상태 전환 버튼 제거 — 자동 분류!) */}
        <div className="flex justify-between items-center pt-6 border-t mt-6">
          {/* 왼쪽: 삭제 + 수정 */}
          <div className="flex gap-2">
            {(onDelete || onCancelOrder) && (
              <Button
                variant="destructive"
                onClick={handleDeleteClick}
                className="gap-1"
              >
                <Trash2 className="h-4 w-4" />
                삭제
              </Button>
            )}
            {onEdit && (
              <Button variant="secondary" onClick={handleEdit} className="gap-1">
                <Edit className="h-4 w-4" />
                수정
              </Button>
            )}
          </div>

          {/* 오른쪽: 견적서 + 닫기 */}
          <div className="flex gap-2">
            {onQuoteView && (
              order.customerQuote?.items?.length ? (
                <Button
                  variant="outline"
                  className="gap-1 text-teal-600 border-teal-300 hover:bg-teal-50"
                  onClick={() => { onQuoteView(order); onOpenChange(false) }}
                >
                  <FileText className="h-4 w-4" />
                  견적서 보기
                </Button>
              ) : (
                <Button variant="outline" className="gap-1" disabled>
                  <FileText className="h-4 w-4" />
                  견적서 미작성
                </Button>
              )
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
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
