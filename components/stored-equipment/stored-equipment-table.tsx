/**
 * 철거보관 장비 테이블 컴포넌트 (순수 리스트 방식)
 *
 * 데스크톱: 테이블 레이아웃 — 품목/모델 → 평형/수량 → 제조사/제조년월 → 창고 → 계열사/지점 → 액션
 * 모바일: 카드 레이아웃
 *
 * 보관중 탭: 수정/출고/삭제 버튼 표시
 * 출고완료 탭: 출고 정보 표시 + 되돌리기 버튼
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
  Archive,
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
  STORED_EQUIPMENT_STATUS_LABELS,
  STORED_EQUIPMENT_STATUS_COLORS,
  RELEASE_TYPE_LABELS,
  RELEASE_TYPE_COLORS,
} from '@/types/order'
import type { Warehouse } from '@/types/warehouse'
import { OrderDetailDialog } from '@/components/orders/order-detail-dialog'
import { useAlert } from '@/components/ui/custom-alert'

/** 날짜를 짧게 표시 (MM.DD 또는 YYYY.MM.DD) */
function formatDate(date?: string): string {
  if (!date) return '-'
  const parts = date.split('-')
  if (parts.length !== 3) return date
  return `${parts[0]}.${parts[1]}.${parts[2]}`
}

interface StoredEquipmentTableProps {
  /** 장비 목록 */
  items: StoredEquipment[]
  /** 현재 탭 */
  activeTab: StoredEquipmentStatus
  /** 창고 목록 (이름 표시용) */
  warehouses: Warehouse[]
  /** 발주 목록 (발주서보기용) */
  orders: Order[]
  /** 수정 클릭 콜백 */
  onEdit: (item: StoredEquipment) => void
  /** 출고 클릭 콜백 */
  onRelease: (item: StoredEquipment) => void
  /** 삭제 클릭 콜백 */
  onDelete: (id: string) => void
  /** 출고 되돌리기 콜백 */
  onRevertRelease: (id: string) => void
  /** 읽기 전용 모드 (true면 액션 버튼 숨김) */
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

  // 삭제 확인 다이얼로그
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; siteName: string } | null>(null)
  // 되돌리기 확인 다이얼로그
  const [revertTarget, setRevertTarget] = useState<{ id: string; siteName: string } | null>(null)
  // 발주 상세 다이얼로그
  const [orderDetailOpen, setOrderDetailOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  /** 창고 정보 가져오기 */
  const getWarehouse = (warehouseId?: string): Warehouse | null => {
    if (!warehouseId) return null
    return warehouses.find(w => w.id === warehouseId) || null
  }

  /** 발주 정보 가져오기 */
  const getOrder = (orderId?: string): Order | null => {
    if (!orderId) return null
    return orders.find(o => o.id === orderId) || null
  }

  /** 재고설치 발주에서 사용 중인지 확인 */
  const getReinstallOrder = (equipmentId: string): Order | null => {
    return orders.find(order =>
      order.status !== 'cancelled' &&
      order.items.some(item =>
        item.workType === '재고설치' && item.storedEquipmentId === equipmentId
      )
    ) || null
  }

  /** 발주서 보기 클릭 */
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

  // 빈 목록
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Archive className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-lg font-medium">
          {activeTab === 'stored' ? '보관중인 장비가 없습니다' : '출고 완료된 장비가 없습니다'}
        </p>
      </div>
    )
  }

  return (
    <>
      {/* ─── 데스크톱 테이블 (md 이상) ─── */}
      <div className="hidden md:block border rounded-lg overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/80">
            <tr>
              <th className="text-left p-3 font-semibold text-sm" style={{ width: '140px' }}>철거된 장소</th>
              <th className="text-center p-3 font-semibold text-sm" style={{ width: '90px' }}>철거일</th>
              <th className="text-center p-3 font-semibold text-sm" style={{ width: '90px' }}>제조년월</th>
              <th className="text-left p-3 font-semibold text-sm" style={{ width: '180px' }}>보관중인 장비</th>
              <th className="text-center p-3 font-semibold text-sm" style={{ width: '100px' }}>발주서보기</th>
              <th className="text-center p-3 font-semibold text-sm" style={{ width: '50px' }}>수량</th>
              <th className="text-left p-3 font-semibold text-sm" style={{ width: '70px' }}>제조사</th>
              {/* 출고완료 탭: 출고 정보 */}
              {activeTab === 'released' && (
                <>
                  <th className="text-left p-3 font-semibold text-sm" style={{ width: '80px' }}>출고유형</th>
                  <th className="text-center p-3 font-semibold text-sm" style={{ width: '90px' }}>출고일</th>
                </>
              )}
              <th className="text-left p-3 font-semibold text-sm" style={{ width: '180px' }}>보관중인 창고</th>
              {!readOnly && (
                <th className="text-center p-3 font-semibold text-sm" style={{ width: activeTab === 'stored' ? '130px' : '80px' }}>액션</th>
              )}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                {/* 계열사/지점 */}
                <td className="p-3">
                  {item.affiliate && (
                    <p className="text-xs text-gray-500">{item.affiliate}</p>
                  )}
                  <p className="font-semibold text-sm truncate">{item.siteName}</p>
                </td>

                {/* 철거일 */}
                <td className="p-3 text-center">
                  <span className="text-sm text-red-600 font-bold">
                    {item.removalDate ? formatDate(item.removalDate) : '-'}
                  </span>
                </td>

                {/* 제조년월 */}
                <td className="p-3 text-center">
                  <span className="text-sm font-bold text-blue-700">
                    {item.manufacturingDate ? item.manufacturingDate.replace('-', '.') : '-'}
                  </span>
                </td>

                {/* 품목/모델명 */}
                <td className="p-3">
                  <p className="text-sm text-gray-800 font-semibold">{item.category}</p>
                  <p className="text-sm text-gray-600 truncate">{item.model || '-'}</p>
                </td>

                {/* 발주서보기 */}
                <td className="p-3 text-center">
                  {(() => {
                    const order = getOrder(item.orderId)
                    if (order) {
                      return (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-sm gap-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                          onClick={() => handleViewOrder(item.orderId)}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          발주서
                        </Button>
                      )
                    }
                    return (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-sm text-gray-400 cursor-not-allowed"
                        onClick={() => handleViewOrder(item.orderId)}
                      >
                        수동등록
                      </Button>
                    )
                  })()}
                </td>

                {/* 수량 */}
                <td className="p-3 text-center">
                  <span className="text-sm font-semibold text-gray-800">{item.quantity}대</span>
                </td>

                {/* 제조사 */}
                <td className="p-3">
                  <span className="text-sm text-gray-700">{item.manufacturer || '-'}</span>
                </td>

                {/* 출고완료 탭: 출고 정보 */}
                {activeTab === 'released' && (
                  <>
                    <td className="p-3">
                      {item.releaseType ? (
                        <Badge className={`${RELEASE_TYPE_COLORS[item.releaseType as ReleaseType]} text-xs`}>
                          {RELEASE_TYPE_LABELS[item.releaseType as ReleaseType]}
                        </Badge>
                      ) : '-'}
                    </td>
                    <td className="p-3 text-center">
                      <span className="text-sm text-gray-700">{formatDate(item.releaseDate)}</span>
                    </td>
                  </>
                )}

                {/* 창고 */}
                <td className="p-3">
                  {(() => {
                    const warehouse = getWarehouse(item.warehouseId)
                    if (warehouse) {
                      return (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <WarehouseIcon className="h-4 w-4 text-gray-400" />
                            <span className="text-sm text-gray-800 font-semibold">{warehouse.name}</span>
                          </div>
                          {warehouse.address && (
                            <p className="text-xs text-gray-500 ml-5">{warehouse.address}</p>
                          )}
                        </div>
                      )
                    }
                    return <span className="text-sm text-gray-400">-</span>
                  })()}
                </td>

                {/* 액션 버튼 */}
                {!readOnly && (
                  <td className="p-3 text-center">
                    {activeTab === 'stored' ? (
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-3 text-sm gap-1"
                          onClick={() => onEdit(item)}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          수정
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 px-3 text-sm gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => onRelease(item)}
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          출고
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => setDeleteTarget({ id: item.id, siteName: item.siteName })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : activeTab === 'requested' ? (
                      <div className="flex items-center justify-center gap-1">
                        {(() => {
                          const reinstallOrder = getReinstallOrder(item.id)
                          if (reinstallOrder) {
                            return (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-3 text-sm gap-1 text-blue-600 border-blue-300 hover:bg-blue-50"
                                onClick={() => handleViewOrder(reinstallOrder.id)}
                              >
                                <FileText className="h-3.5 w-3.5" />
                                발주 확인
                              </Button>
                            )
                          }
                          return null
                        })()}
                        <Button
                          size="sm"
                          className="h-8 px-3 text-sm gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => onRelease(item)}
                        >
                          <LogOut className="h-3.5 w-3.5" />
                          출고
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 text-sm gap-1 text-gray-600 hover:text-orange-700 hover:border-orange-300 hover:bg-orange-50"
                        onClick={() => setRevertTarget({ id: item.id, siteName: item.siteName })}
                      >
                        <Undo2 className="h-3.5 w-3.5" />
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

      {/* ─── 모바일 카드 리스트 (md 미만) ─── */}
      <div className="md:hidden space-y-3">
        {items.map((item) => (
          <div key={item.id} className="border rounded-lg bg-white p-4 space-y-3">
            {/* 계열사/지점 + 수량 */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                {item.affiliate && <p className="text-sm text-gray-500">{item.affiliate}</p>}
                <p className="font-semibold text-base text-gray-900">{item.siteName}</p>
              </div>
              <span className="text-sm font-semibold text-gray-700">{item.quantity}대</span>
            </div>

            {/* 철거일 + 제조년월 */}
            <div className="flex items-center gap-4 text-sm">
              <div className="text-red-600 font-bold">
                <span className="font-medium text-gray-700">철거일:</span> {item.removalDate ? formatDate(item.removalDate) : '-'}
              </div>
              <div className="text-blue-700 font-bold">
                <span className="font-medium text-gray-700">제조:</span> {item.manufacturingDate ? item.manufacturingDate.replace('-', '.') : '-'}
              </div>
            </div>

            {/* 품목/모델명 */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-blue-50 text-blue-700 text-sm font-semibold">
                  {item.category}
                </Badge>
              </div>
              <p className="text-base font-semibold text-gray-800">{item.model || '모델명 미입력'}</p>
            </div>

            {/* 제조사 */}
            <div className="text-sm text-gray-700">
              제조사: <span className="font-medium">{item.manufacturer || '-'}</span>
            </div>

            {/* 발주서보기 */}
            <div>
              {(() => {
                const order = getOrder(item.orderId)
                if (order) {
                  return (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-3 text-sm gap-1.5 text-blue-600 hover:text-blue-800 border-blue-200 hover:bg-blue-50"
                      onClick={() => handleViewOrder(item.orderId)}
                    >
                      <FileText className="h-4 w-4" />
                      발주서 보기
                    </Button>
                  )
                }
                return <span className="text-sm text-gray-400">수동등록</span>
              })()}
            </div>

            {/* 출고 정보 (출고완료 탭) */}
            {activeTab === 'released' && item.releaseType && (
              <div className="bg-gray-50 rounded-md p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className={`${RELEASE_TYPE_COLORS[item.releaseType as ReleaseType]} text-sm`}>
                    {RELEASE_TYPE_LABELS[item.releaseType as ReleaseType]}
                  </Badge>
                  <span className="text-sm text-gray-600">{formatDate(item.releaseDate)}</span>
                </div>
                {item.releaseDestination && (
                  <p className="text-sm text-gray-700">목적지: {item.releaseDestination}</p>
                )}
              </div>
            )}

            {/* 창고 */}
            <div className="bg-gray-50 rounded-md p-3">
              {(() => {
                const warehouse = getWarehouse(item.warehouseId)
                if (warehouse) {
                  return (
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-800">
                        <WarehouseIcon className="h-4 w-4 text-gray-400" />
                        <span className="font-semibold">{warehouse.name}</span>
                      </div>
                      {warehouse.address && (
                        <p className="text-xs text-gray-500 ml-6 mt-1">{warehouse.address}</p>
                      )}
                    </div>
                  )
                }
                return <span className="text-sm text-gray-400">-</span>
              })()}
            </div>

            {/* 액션 버튼 */}
            {!readOnly && (
              <div className="flex justify-end gap-2">
                {activeTab === 'stored' ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-3 text-sm gap-1.5"
                      onClick={() => onEdit(item)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      수정
                    </Button>
                    <Button
                      size="sm"
                      className="h-9 px-3 text-sm gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => onRelease(item)}
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      출고
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                      onClick={() => setDeleteTarget({ id: item.id, siteName: item.siteName })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                ) : activeTab === 'requested' ? (
                  <>
                    {(() => {
                      const reinstallOrder = getReinstallOrder(item.id)
                      if (reinstallOrder) {
                        return (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 px-3 text-sm gap-1.5 text-blue-600 border-blue-300 hover:bg-blue-50"
                            onClick={() => handleViewOrder(reinstallOrder.id)}
                          >
                            <FileText className="h-4 w-4" />
                            발주 확인
                          </Button>
                        )
                      }
                      return null
                    })()}
                    <Button
                      size="sm"
                      className="h-9 px-3 text-sm gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => onRelease(item)}
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      출고
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 px-3 text-sm gap-1.5 text-gray-600 hover:text-orange-700 hover:border-orange-300 hover:bg-orange-50"
                    onClick={() => setRevertTarget({ id: item.id, siteName: item.siteName })}
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    되돌리기
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ─── 삭제 확인 다이얼로그 ─── */}
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
              onClick={() => {
                if (deleteTarget) onDelete(deleteTarget.id)
                setDeleteTarget(null)
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── 되돌리기 확인 다이얼로그 ─── */}
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
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={() => {
                if (revertTarget) onRevertRelease(revertTarget.id)
                setRevertTarget(null)
              }}
            >
              되돌리기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── 발주 상세 다이얼로그 ─── */}
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
