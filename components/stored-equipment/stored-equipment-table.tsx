/**
 * 철거보관 장비 메인 테이블 컴포넌트
 *
 * 데스크톱: 테이블 레이아웃
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
  LogOut,
  MapPin,
  Package,
  Trash2,
  Undo2,
  Warehouse as WarehouseIcon,
} from 'lucide-react'
import type { StoredEquipment, StoredEquipmentStatus, ReleaseType } from '@/types/order'
import {
  STORED_EQUIPMENT_STATUS_LABELS,
  STORED_EQUIPMENT_STATUS_COLORS,
  EQUIPMENT_CONDITION_LABELS,
  EQUIPMENT_CONDITION_COLORS,
  RELEASE_TYPE_LABELS,
  RELEASE_TYPE_COLORS,
} from '@/types/order'
import type { Warehouse } from '@/types/warehouse'

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
  /** 수정 클릭 콜백 */
  onEdit: (item: StoredEquipment) => void
  /** 출고 클릭 콜백 */
  onRelease: (item: StoredEquipment) => void
  /** 삭제 클릭 콜백 */
  onDelete: (id: string) => void
  /** 출고 되돌리기 콜백 */
  onRevertRelease: (id: string) => void
}

export function StoredEquipmentTable({
  items,
  activeTab,
  warehouses,
  onEdit,
  onRelease,
  onDelete,
  onRevertRelease,
}: StoredEquipmentTableProps) {
  // 삭제 확인 다이얼로그
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; siteName: string } | null>(null)
  // 되돌리기 확인 다이얼로그
  const [revertTarget, setRevertTarget] = useState<{ id: string; siteName: string } | null>(null)

  /** 창고 ID → 이름 변환 */
  const getWarehouseName = (warehouseId?: string): string => {
    if (!warehouseId) return '-'
    const wh = warehouses.find(w => w.id === warehouseId)
    return wh ? wh.name : '-'
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
        <table className="w-full text-sm">
          <thead className="bg-muted/80">
            <tr>
              <th className="text-left p-3 font-medium" style={{ width: '60px' }}>상태</th>
              <th className="text-left p-3 font-medium" style={{ width: '90px' }}>보관시작일</th>
              <th className="text-left p-3 font-medium" style={{ width: '120px' }}>창고</th>
              <th className="text-left p-3 font-medium" style={{ width: '160px' }}>현장명</th>
              <th className="text-left p-3 font-medium" style={{ width: '120px' }}>품목</th>
              <th className="text-left p-3 font-medium" style={{ width: '120px' }}>모델/평형</th>
              <th className="text-center p-3 font-medium" style={{ width: '50px' }}>수량</th>
              <th className="text-center p-3 font-medium" style={{ width: '60px' }}>장비상태</th>
              {/* 출고완료 탭: 출고 정보 */}
              {activeTab === 'released' && (
                <>
                  <th className="text-left p-3 font-medium" style={{ width: '70px' }}>출고유형</th>
                  <th className="text-left p-3 font-medium" style={{ width: '90px' }}>출고일</th>
                  <th className="text-left p-3 font-medium" style={{ width: '120px' }}>출고목적지</th>
                </>
              )}
              <th className="text-left p-3 font-medium" style={{ width: '150px' }}>메모</th>
              <th className="text-center p-3 font-medium" style={{ width: activeTab === 'stored' ? '130px' : '80px' }}>액션</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                {/* 상태 뱃지 */}
                <td className="p-3">
                  <Badge className={`${STORED_EQUIPMENT_STATUS_COLORS[item.status]} text-[10px]`}>
                    {STORED_EQUIPMENT_STATUS_LABELS[item.status]}
                  </Badge>
                </td>

                {/* 보관 시작일 */}
                <td className="p-3">
                  <span className="text-xs text-gray-600">{formatDate(item.storageStartDate)}</span>
                </td>

                {/* 창고 */}
                <td className="p-3">
                  <span className="text-xs text-gray-700 font-medium">{getWarehouseName(item.warehouseId)}</span>
                </td>

                {/* 현장명 + 계열사 */}
                <td className="p-3">
                  <p className="font-semibold text-xs truncate">{item.siteName}</p>
                  {item.affiliate && (
                    <p className="text-[10px] text-gray-400">{item.affiliate}</p>
                  )}
                </td>

                {/* 품목 */}
                <td className="p-3">
                  <span className="text-xs text-gray-700">{item.category}</span>
                </td>

                {/* 모델/평형 */}
                <td className="p-3">
                  <p className="text-xs text-gray-700 truncate">{item.model || '-'}</p>
                  {item.size && <p className="text-[10px] text-gray-400">{item.size}</p>}
                </td>

                {/* 수량 */}
                <td className="p-3 text-center">
                  <span className="text-xs font-medium">{item.quantity}대</span>
                </td>

                {/* 장비 상태 */}
                <td className="p-3 text-center">
                  <Badge className={`${EQUIPMENT_CONDITION_COLORS[item.condition]} text-[10px]`}>
                    {EQUIPMENT_CONDITION_LABELS[item.condition]}
                  </Badge>
                </td>

                {/* 출고완료 탭: 출고 정보 */}
                {activeTab === 'released' && (
                  <>
                    <td className="p-3">
                      {item.releaseType ? (
                        <Badge className={`${RELEASE_TYPE_COLORS[item.releaseType as ReleaseType]} text-[10px]`}>
                          {RELEASE_TYPE_LABELS[item.releaseType as ReleaseType]}
                        </Badge>
                      ) : '-'}
                    </td>
                    <td className="p-3">
                      <span className="text-xs text-gray-600">{formatDate(item.releaseDate)}</span>
                    </td>
                    <td className="p-3">
                      <span className="text-xs text-gray-600 truncate">{item.releaseDestination || '-'}</span>
                    </td>
                  </>
                )}

                {/* 메모 */}
                <td className="p-3">
                  <span className="text-xs text-gray-500 truncate block">{item.notes || item.removalReason || '-'}</span>
                </td>

                {/* 액션 버튼 */}
                <td className="p-3 text-center">
                  {activeTab === 'stored' ? (
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs gap-1"
                        onClick={() => onEdit(item)}
                      >
                        <Edit2 className="h-3 w-3" />
                        수정
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 px-2 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => onRelease(item)}
                      >
                        <LogOut className="h-3 w-3" />
                        출고
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => setDeleteTarget({ id: item.id, siteName: item.siteName })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs gap-1 text-gray-600 hover:text-orange-700 hover:border-orange-300 hover:bg-orange-50"
                      onClick={() => setRevertTarget({ id: item.id, siteName: item.siteName })}
                    >
                      <Undo2 className="h-3 w-3" />
                      되돌리기
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── 모바일 카드 리스트 (md 미만) ─── */}
      <div className="md:hidden space-y-3">
        {items.map((item) => (
          <div key={item.id} className="border rounded-lg bg-white p-4 space-y-3">
            {/* 상단: 상태 + 장비상태 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className={`${STORED_EQUIPMENT_STATUS_COLORS[item.status]} text-[10px]`}>
                  {STORED_EQUIPMENT_STATUS_LABELS[item.status]}
                </Badge>
                <Badge className={`${EQUIPMENT_CONDITION_COLORS[item.condition]} text-[10px]`}>
                  {EQUIPMENT_CONDITION_LABELS[item.condition]}
                </Badge>
              </div>
              <span className="text-xs text-gray-400">{item.quantity}대</span>
            </div>

            {/* 현장명 */}
            <div>
              <h3 className="font-semibold text-sm">{item.siteName}</h3>
              {item.affiliate && <p className="text-[10px] text-gray-400">{item.affiliate}</p>}
              {item.address && (
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" />
                  {item.address}
                </p>
              )}
            </div>

            {/* 품목/모델/창고 */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                  <Package className="h-3 w-3" />품목
                </span>
                <p className="text-gray-700">{item.category}</p>
              </div>
              <div>
                <span className="text-[10px] text-gray-400">모델/평형</span>
                <p className="text-gray-700 truncate">{item.model || '-'} {item.size ? `(${item.size})` : ''}</p>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                  <WarehouseIcon className="h-3 w-3" />창고
                </span>
                <p className="text-gray-700">{getWarehouseName(item.warehouseId)}</p>
              </div>
            </div>

            {/* 날짜 + 메모 */}
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>보관시작: {formatDate(item.storageStartDate)}</span>
              {item.removalReason && <span>사유: {item.removalReason}</span>}
            </div>
            {item.notes && <p className="text-xs text-gray-400">메모: {item.notes}</p>}

            {/* 출고 정보 (출고완료 탭) */}
            {activeTab === 'released' && item.releaseType && (
              <div className="bg-gray-50 rounded-md p-2 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className={`${RELEASE_TYPE_COLORS[item.releaseType as ReleaseType]} text-[10px]`}>
                    {RELEASE_TYPE_LABELS[item.releaseType as ReleaseType]}
                  </Badge>
                  <span className="text-xs text-gray-500">{formatDate(item.releaseDate)}</span>
                </div>
                {item.releaseDestination && (
                  <p className="text-xs text-gray-600">목적지: {item.releaseDestination}</p>
                )}
                {item.releaseNotes && (
                  <p className="text-xs text-gray-400">{item.releaseNotes}</p>
                )}
              </div>
            )}

            {/* 액션 버튼 */}
            <div className="flex justify-end gap-1">
              {activeTab === 'stored' ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => onEdit(item)}
                  >
                    <Edit2 className="h-3 w-3" />
                    수정
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => onRelease(item)}
                  >
                    <LogOut className="h-3 w-3" />
                    출고
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteTarget({ id: item.id, siteName: item.siteName })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs gap-1 text-gray-600 hover:text-orange-700 hover:border-orange-300 hover:bg-orange-50"
                  onClick={() => setRevertTarget({ id: item.id, siteName: item.siteName })}
                >
                  <Undo2 className="h-3 w-3" />
                  되돌리기
                </Button>
              )}
            </div>
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
    </>
  )
}
