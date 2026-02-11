/**
 * 철거보관 장비 테이블 컴포넌트
 *
 * 데스크톱: 테이블 레이아웃
 * 모바일: 카드 레이아웃
 *
 * 보관중 탭: 수정/출고/삭제 액션
 * 출고완료 탭: 출고 정보 + 되돌리기
 */

'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  Edit2,
  FileText,
  LogOut,
  MapPin,
  Package,
  Trash2,
  Undo2,
  Warehouse as WarehouseIcon,
} from 'lucide-react'
import type { StoredEquipment, StoredEquipmentStatus, ReleaseType, Order } from '@/types/order'
import {
  RELEASE_TYPE_LABELS,
  RELEASE_TYPE_COLORS,
} from '@/types/order'
import type { Warehouse } from '@/types/warehouse'
import { OrderDetailDialog } from '@/components/orders/order-detail-dialog'
import { useAlert } from '@/components/ui/custom-alert'

/** 날짜를 짧게 표시 */
function formatDate(date?: string): string {
  if (!date) return '-'
  const parts = date.split('-')
  if (parts.length !== 3) return date
  return `${parts[0]}.${parts[1]}.${parts[2]}`
}

interface StoredEquipmentTableProps {
  items: StoredEquipment[]
  activeTab: StoredEquipmentStatus
  warehouses: Warehouse[]
  orders: Order[]
  onEdit: (item: StoredEquipment) => void
  onRelease: (item: StoredEquipment) => void
  onDelete: (id: string) => void
  onRevertRelease: (id: string) => void
  readOnly?: boolean
}

export function StoredEquipmentTable({
  items,
  activeTab,
  warehouses,
  orders,
  onEdit,
  onRelease,
  onDelete,
  onRevertRelease,
  readOnly = false,
}: StoredEquipmentTableProps) {
  const { showAlert } = useAlert()

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; siteName: string } | null>(null)
  const [revertTarget, setRevertTarget] = useState<{ id: string; siteName: string } | null>(null)

  /** 삭제 확인 → onDelete 호출 후 다이얼로그 닫기 */
  const handleConfirmDelete = () => {
    if (!deleteTarget) return
    const targetId = deleteTarget.id
    setDeleteTarget(null)
    onDelete(targetId)
  }

  /** 되돌리기 확인 → onRevertRelease 호출 후 다이얼로그 닫기 */
  const handleConfirmRevert = () => {
    if (!revertTarget) return
    const targetId = revertTarget.id
    setRevertTarget(null)
    onRevertRelease(targetId)
  }
  const [orderDetailOpen, setOrderDetailOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  /** 창고 정보 */
  const getWarehouse = (warehouseId?: string): Warehouse | null => {
    if (!warehouseId) return null
    return warehouses.find(w => w.id === warehouseId) || null
  }

  /** 발주 정보 */
  const getOrder = (orderId?: string): Order | null => {
    if (!orderId) return null
    return orders.find(o => o.id === orderId) || null
  }

  /** 발주서 보기 */
  const handleViewOrder = (orderId?: string) => {
    if (!orderId) {
      showAlert('수동 등록된 장비로 연결된 발주서가 없습니다.', 'info')
      return
    }
    const order = getOrder(orderId)
    if (!order) {
      showAlert('발주서를 찾을 수 없습니다.', 'error')
      return
    }
    setSelectedOrder(order)
    setOrderDetailOpen(true)
  }

  // ─── 빈 목록 ───
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        {activeTab === 'stored' ? (
          <>
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Package className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-base font-medium text-slate-500">보관중인 장비가 없습니다</p>
            <p className="text-sm text-slate-400 mt-1">장비를 등록하면 여기에 표시됩니다</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
              <LogOut className="h-8 w-8 text-emerald-300" />
            </div>
            <p className="text-base font-medium text-slate-500">출고 완료된 장비가 없습니다</p>
            <p className="text-sm text-slate-400 mt-1">보관중인 장비를 출고하면 여기에 표시됩니다</p>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      {/* ═══ 데스크톱 테이블 (md 이상) ═══ */}
      <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider" style={{ width: '140px' }}>철거된 장소</th>
              <th className="text-center px-3 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider" style={{ width: '85px' }}>철거일</th>
              <th className="text-center px-3 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider" style={{ width: '85px' }}>제조년월</th>
              <th className="text-left px-4 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider" style={{ width: '180px' }}>장비 정보</th>
              <th className="text-center px-3 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider" style={{ width: '80px' }}>발주서</th>
              <th className="text-center px-3 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider" style={{ width: '50px' }}>수량</th>
              <th className="text-left px-3 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider" style={{ width: '65px' }}>제조사</th>
              {activeTab === 'released' && (
                <>
                  <th className="text-left px-3 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider" style={{ width: '80px' }}>출고유형</th>
                  <th className="text-center px-3 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider" style={{ width: '85px' }}>출고일</th>
                </>
              )}
              <th className="text-left px-4 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider" style={{ width: '180px' }}>
                {activeTab === 'released' ? '설치 장소' : '보관 창고'}
              </th>
              {!readOnly && (
                <th className="text-center px-3 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wider" style={{ width: activeTab === 'stored' ? '130px' : '80px' }}>액션</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, idx) => (
              <tr key={item.id} className={`transition-colors hover:bg-blue-50/30 ${idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'}`}>
                {/* 철거된 장소 */}
                <td className="px-4 py-3">
                  {item.affiliate && (
                    <p className="text-[11px] text-slate-400 font-medium mb-0.5">{item.affiliate}</p>
                  )}
                  <p className="text-sm font-semibold text-slate-800 truncate" title={item.siteName}>{item.siteName}</p>
                </td>

                {/* 철거일 */}
                <td className="px-3 py-3 text-center">
                  <span className="text-sm text-red-600 font-bold tabular-nums">
                    {item.removalDate ? formatDate(item.removalDate) : '-'}
                  </span>
                </td>

                {/* 제조년월 */}
                <td className="px-3 py-3 text-center">
                  <span className="text-sm font-bold text-blue-700 tabular-nums">
                    {item.manufacturingDate ? item.manufacturingDate.replace('-', '.') : '-'}
                  </span>
                </td>

                {/* 장비 정보 */}
                <td className="px-4 py-3">
                  <p className="text-sm text-slate-800 font-semibold">{item.category}</p>
                  <p className="text-sm text-slate-500 truncate" title={item.model || '-'}>{item.model || '-'}</p>
                </td>

                {/* 발주서 */}
                <td className="px-3 py-3 text-center">
                  {(() => {
                    const order = getOrder(item.orderId)
                    if (order) {
                      return (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs gap-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                          onClick={() => handleViewOrder(item.orderId)}
                        >
                          <FileText className="h-3 w-3" />
                          보기
                        </Button>
                      )
                    }
                    return <span className="text-xs text-slate-300">수동</span>
                  })()}
                </td>

                {/* 수량 */}
                <td className="px-3 py-3 text-center">
                  <span className="text-sm font-semibold text-slate-700 tabular-nums">{item.quantity}대</span>
                </td>

                {/* 제조사 */}
                <td className="px-3 py-3">
                  <span className="text-sm text-slate-600">{item.manufacturer || '-'}</span>
                </td>

                {/* 출고 정보 (출고완료 탭) */}
                {activeTab === 'released' && (
                  <>
                    <td className="px-3 py-3">
                      {item.releaseType ? (
                        <Badge className={`${RELEASE_TYPE_COLORS[item.releaseType as ReleaseType]} text-xs font-medium`}>
                          {RELEASE_TYPE_LABELS[item.releaseType as ReleaseType]}
                        </Badge>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-sm text-slate-600 tabular-nums">{formatDate(item.releaseDate)}</span>
                    </td>
                  </>
                )}

                {/* 보관 창고 / 설치 장소 */}
                <td className="px-4 py-3">
                  {activeTab === 'released' ? (
                    item.releaseDestination ? (
                      <div className="flex items-start gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        <p className="text-sm font-medium text-slate-800">{item.releaseDestination}</p>
                      </div>
                    ) : (
                      <span className="text-sm text-slate-300">-</span>
                    )
                  ) : (
                    (() => {
                      const warehouse = getWarehouse(item.warehouseId)
                      if (warehouse) {
                        return (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <WarehouseIcon className="h-3.5 w-3.5 text-slate-400" />
                              <span className="text-sm font-medium text-slate-700">{warehouse.name}</span>
                            </div>
                            {warehouse.address && (
                              <p className="text-xs text-slate-400 ml-5 mt-0.5">{warehouse.address}</p>
                            )}
                          </div>
                        )
                      }
                      return <span className="text-sm text-slate-300">-</span>
                    })()
                  )}
                </td>

                {/* 액션 */}
                {!readOnly && (
                  <td className="px-3 py-3 text-center">
                    {activeTab === 'stored' ? (
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs gap-1 border-slate-200 hover:border-slate-300"
                          onClick={() => onEdit(item)}
                        >
                          <Edit2 className="h-3 w-3" />
                          수정
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 px-2.5 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                          onClick={() => onRelease(item)}
                        >
                          <LogOut className="h-3 w-3" />
                          출고
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-slate-300 hover:text-red-500 hover:bg-red-50"
                          onClick={() => setDeleteTarget({ id: item.id, siteName: item.siteName })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs gap-1 text-slate-500 hover:text-amber-700 hover:border-amber-300 hover:bg-amber-50"
                        onClick={() => setRevertTarget({ id: item.id, siteName: item.siteName })}
                      >
                        <Undo2 className="h-3 w-3" />
                        되돌리기
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══ 모바일 카드 (md 미만) ═══ */}
      <div className="md:hidden space-y-3">
        {items.map((item) => {
          const warehouse = getWarehouse(item.warehouseId)
          const order = getOrder(item.orderId)

          return (
            <div key={item.id} className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
              {/* 상단: 현장명 + 수량 */}
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {item.affiliate && (
                      <p className="text-[11px] text-slate-400 font-medium">{item.affiliate}</p>
                    )}
                    <p className="text-base font-bold text-slate-900 truncate">{item.siteName}</p>
                  </div>
                  <span className="text-sm font-bold text-slate-700 tabular-nums shrink-0 bg-slate-100 px-2 py-0.5 rounded">{item.quantity}대</span>
                </div>
              </div>

              {/* 장비 정보 */}
              <div className="px-4 pb-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge variant="outline" className="text-xs font-semibold text-blue-700 border-blue-200 bg-blue-50/50">
                    {item.category}
                  </Badge>
                  {item.manufacturer && (
                    <span className="text-xs text-slate-400">{item.manufacturer}</span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-700">{item.model || '모델명 미입력'}</p>
              </div>

              {/* 날짜 정보 */}
              <div className="px-4 pb-3 flex items-center gap-4">
                <div className="text-xs">
                  <span className="text-slate-400">철거일</span>
                  <span className="ml-1.5 font-bold text-red-600 tabular-nums">{item.removalDate ? formatDate(item.removalDate) : '-'}</span>
                </div>
                <div className="text-xs">
                  <span className="text-slate-400">제조</span>
                  <span className="ml-1.5 font-bold text-blue-700 tabular-nums">{item.manufacturingDate ? item.manufacturingDate.replace('-', '.') : '-'}</span>
                </div>
              </div>

              {/* 출고 정보 (출고완료 탭) — 하나의 블록으로 통합 */}
              {activeTab === 'released' && item.releaseType && (
                <div className="mx-4 mb-3 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge className={`${RELEASE_TYPE_COLORS[item.releaseType as ReleaseType]} text-xs font-medium`}>
                      {RELEASE_TYPE_LABELS[item.releaseType as ReleaseType]}
                    </Badge>
                    <span className="text-xs text-slate-500 tabular-nums">{formatDate(item.releaseDate)}</span>
                  </div>
                  {item.releaseDestination && (
                    <div className="flex items-start gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      <p className="text-sm font-medium text-slate-800">{item.releaseDestination}</p>
                    </div>
                  )}
                </div>
              )}

              {/* 보관 창고 (보관중 탭만) */}
              {activeTab === 'stored' && (
                <div className="mx-4 mb-3 bg-slate-50 border border-slate-100 rounded-lg p-3">
                  {warehouse ? (
                    <div>
                      <div className="flex items-center gap-1.5 text-sm">
                        <WarehouseIcon className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-medium text-slate-700">{warehouse.name}</span>
                      </div>
                      {warehouse.address && (
                        <p className="text-xs text-slate-400 ml-5 mt-0.5">{warehouse.address}</p>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-slate-300">창고 미지정</span>
                  )}
                </div>
              )}

              {/* 하단: 발주서 + 액션 */}
              <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                {/* 발주서 */}
                {order ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2.5 text-xs gap-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                    onClick={() => handleViewOrder(item.orderId)}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    발주서 보기
                  </Button>
                ) : (
                  <span className="text-xs text-slate-300 px-1">수동등록</span>
                )}

                {/* 액션 */}
                {!readOnly && (
                  <div className="flex items-center gap-1.5">
                    {activeTab === 'stored' ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2.5 text-xs gap-1 border-slate-200"
                          onClick={() => onEdit(item)}
                        >
                          <Edit2 className="h-3 w-3" />
                          수정
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 px-2.5 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                          onClick={() => onRelease(item)}
                        >
                          <LogOut className="h-3 w-3" />
                          출고
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-slate-300 hover:text-red-500 hover:bg-red-50"
                          onClick={() => setDeleteTarget({ id: item.id, siteName: item.siteName })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 text-xs gap-1 text-slate-500 hover:text-amber-700 hover:border-amber-300 hover:bg-amber-50"
                        onClick={() => setRevertTarget({ id: item.id, siteName: item.siteName })}
                      >
                        <Undo2 className="h-3 w-3" />
                        되돌리기
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* ═══ 삭제 확인 다이얼로그 ═══ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>장비 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.siteName}&rdquo; 장비를 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleConfirmDelete}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ 되돌리기 확인 다이얼로그 ═══ */}
      <AlertDialog open={!!revertTarget} onOpenChange={(open) => { if (!open) setRevertTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>출고 되돌리기</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{revertTarget?.siteName}&rdquo; 장비를 다시 &ldquo;보관중&rdquo;으로 되돌리시겠습니까? 출고 정보가 초기화됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleConfirmRevert}
            >
              되돌리기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ 발주 상세 다이얼로그 ═══ */}
      {selectedOrder && (
        <OrderDetailDialog
          order={selectedOrder}
          open={orderDetailOpen}
          onOpenChange={setOrderDetailOpen}
        />
      )}
    </>
  )
}
