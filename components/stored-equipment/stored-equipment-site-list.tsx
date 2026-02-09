/**
 * 철거보관 장비 — 현장 아코디언 리스트 컴포넌트
 *
 * 배송관리의 아코디언 패턴을 참고해서 만들었어요!
 * - 현장(발주) 헤더를 클릭하면 → 해당 현장의 장비 목록이 펼쳐짐
 * - 데스크톱: 현장 헤더 행 + 장비 인라인 테이블
 * - 모바일: 현장 카드 + 장비 카드 리스트
 *
 * 구조:
 *   ▼ 구몬 화곡지국 (Wells 영업) — 2024.01.15        3대 보관중
 *     │ 스탠드에어컨 · AR-123 · 18평 · 삼성 · 2020.06 │ 파주창고 │ 양호 │ [수정][출고]
 *     └ [+ 장비 추가]
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
  ChevronDown,
  ChevronRight,
  Edit2,
  LogOut,
  MapPin,
  Package,
  Plus,
  Trash2,
  Undo2,
  Warehouse as WarehouseIcon,
} from 'lucide-react'
import type { StoredEquipment, StoredEquipmentSite, StoredEquipmentStatus, ReleaseType } from '@/types/order'
import {
  EQUIPMENT_CONDITION_LABELS,
  EQUIPMENT_CONDITION_COLORS,
  RELEASE_TYPE_LABELS,
  RELEASE_TYPE_COLORS,
} from '@/types/order'
import type { Warehouse } from '@/types/warehouse'

/** 날짜를 YYYY.MM.DD 형식으로 표시 */
function formatDate(date?: string): string {
  if (!date) return '-'
  const parts = date.split('-')
  if (parts.length !== 3) return date
  return `${parts[0]}.${parts[1]}.${parts[2]}`
}

/** 제조년월 표시 (YYYY-MM → YYYY.MM) */
function formatManufDate(date?: string): string {
  if (!date) return '-'
  return date.replace('-', '.')
}

interface StoredEquipmentSiteListProps {
  /** 현장 그룹 목록 */
  sites: StoredEquipmentSite[]
  /** 현재 활성 탭 (보관중/출고완료) */
  activeTab: StoredEquipmentStatus
  /** 창고 목록 (이름 표시용) */
  warehouses: Warehouse[]
  /** 장비 추가 클릭 콜백 (현장 정보 전달) */
  onAddEquipment: (site: StoredEquipmentSite) => void
  /** 장비 수정 클릭 */
  onEdit: (item: StoredEquipment) => void
  /** 장비 출고 클릭 */
  onRelease: (item: StoredEquipment) => void
  /** 장비 삭제 클릭 */
  onDelete: (id: string) => void
  /** 출고 되돌리기 */
  onRevertRelease: (id: string) => void
}

export function StoredEquipmentSiteList({
  sites,
  activeTab,
  warehouses,
  onAddEquipment,
  onEdit,
  onRelease,
  onDelete,
  onRevertRelease,
}: StoredEquipmentSiteListProps) {
  // 펼친 현장 ID 관리 (orderId 또는 siteName을 키로 사용)
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set())
  // 삭제/되돌리기 확인 다이얼로그
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; siteName: string } | null>(null)
  const [revertTarget, setRevertTarget] = useState<{ id: string; siteName: string } | null>(null)

  /** 현장 키 (orderId 또는 siteName) */
  const getSiteKey = (site: StoredEquipmentSite) => site.orderId || `manual-${site.siteName}`

  /** 아코디언 토글 */
  const toggleSite = (site: StoredEquipmentSite) => {
    const key = getSiteKey(site)
    setExpandedSites(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  /** 창고 ID → 이름 변환 */
  const getWarehouseName = (warehouseId?: string): string => {
    if (!warehouseId) return '-'
    const wh = warehouses.find(w => w.id === warehouseId)
    return wh ? wh.name : '-'
  }

  // 빈 목록
  if (sites.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Archive className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-lg font-medium">
          {activeTab === 'stored'
            ? '보관중인 장비가 없습니다'
            : '출고 완료된 장비가 없습니다'}
        </p>
        {activeTab === 'stored' && (
          <p className="text-sm mt-1">철거보관 발주가 접수되면 여기에 자동으로 표시됩니다</p>
        )}
      </div>
    )
  }

  return (
    <>
      {/* ─── 데스크톱 (md 이상) ─── */}
      <div className="hidden md:block space-y-2">
        {sites.map((site) => {
          const key = getSiteKey(site)
          const isExpanded = expandedSites.has(key)
          const equipCount = site.equipment.length

          return (
            <div key={key} className="border rounded-lg overflow-hidden">
              {/* 현장 헤더 (클릭→확장) */}
              <button
                type="button"
                onClick={() => toggleSite(site)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-muted/50 hover:bg-muted/80 transition-colors text-left"
              >
                {/* 화살표 아이콘 */}
                {isExpanded
                  ? <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-gray-500 flex-shrink-0" />
                }

                {/* 현장명 + 계열사 */}
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-sm">{site.siteName}</span>
                  {site.affiliate && (
                    <span className="text-xs text-gray-500 ml-2">({site.affiliate})</span>
                  )}
                  {!site.orderId && (
                    <Badge className="ml-2 text-[10px] bg-gray-100 text-gray-500 border-gray-200">수동등록</Badge>
                  )}
                </div>

                {/* 발주일 */}
                {site.orderDate && (
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {formatDate(site.orderDate)}
                  </span>
                )}

                {/* 장비 수 뱃지 */}
                <Badge
                  className={`flex-shrink-0 text-xs ${
                    equipCount > 0
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-gray-100 text-gray-400 border-gray-200'
                  }`}
                >
                  {equipCount}대{activeTab === 'stored' ? ' 보관중' : ' 출고완료'}
                </Badge>
              </button>

              {/* 장비 목록 (펼쳤을 때만) */}
              {isExpanded && (
                <div className="border-t">
                  {/* 주소 표시 */}
                  {site.address && (
                    <div className="px-4 py-2 bg-gray-50/50 flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="h-3 w-3" />
                      {site.address}
                    </div>
                  )}

                  {/* 장비 테이블 */}
                  {equipCount > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-muted/30">
                        <tr>
                          <th className="text-left px-4 py-2 font-medium text-xs text-gray-500" style={{ width: '120px' }}>품목</th>
                          <th className="text-left px-4 py-2 font-medium text-xs text-gray-500" style={{ width: '120px' }}>모델명</th>
                          <th className="text-left px-4 py-2 font-medium text-xs text-gray-500" style={{ width: '60px' }}>평형</th>
                          <th className="text-left px-4 py-2 font-medium text-xs text-gray-500" style={{ width: '70px' }}>제조사</th>
                          <th className="text-left px-4 py-2 font-medium text-xs text-gray-500" style={{ width: '80px' }}>제조년월</th>
                          <th className="text-left px-4 py-2 font-medium text-xs text-gray-500" style={{ width: '100px' }}>보관창고</th>
                          <th className="text-center px-4 py-2 font-medium text-xs text-gray-500" style={{ width: '60px' }}>장비상태</th>
                          {/* 출고완료 탭: 출고 정보 */}
                          {activeTab === 'released' && (
                            <>
                              <th className="text-left px-4 py-2 font-medium text-xs text-gray-500" style={{ width: '70px' }}>출고유형</th>
                              <th className="text-left px-4 py-2 font-medium text-xs text-gray-500" style={{ width: '90px' }}>출고일</th>
                              <th className="text-left px-4 py-2 font-medium text-xs text-gray-500" style={{ width: '100px' }}>출고목적지</th>
                            </>
                          )}
                          <th className="text-center px-4 py-2 font-medium text-xs text-gray-500" style={{ width: activeTab === 'stored' ? '130px' : '80px' }}>액션</th>
                        </tr>
                      </thead>
                      <tbody>
                        {site.equipment.map((eq) => (
                          <tr key={eq.id} className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors">
                            {/* 품목 */}
                            <td className="px-4 py-2">
                              <span className="text-xs text-gray-700">{eq.category}</span>
                            </td>
                            {/* 모델명 */}
                            <td className="px-4 py-2">
                              <span className="text-xs text-gray-700 truncate block">{eq.model || '(미입력)'}</span>
                            </td>
                            {/* 평형 */}
                            <td className="px-4 py-2">
                              <span className="text-xs text-gray-600">{eq.size || '-'}</span>
                            </td>
                            {/* 제조사 */}
                            <td className="px-4 py-2">
                              <span className="text-xs text-gray-600">{eq.manufacturer || '삼성'}</span>
                            </td>
                            {/* 제조년월 */}
                            <td className="px-4 py-2">
                              <span className="text-xs text-gray-500">{formatManufDate(eq.manufacturingDate)}</span>
                            </td>
                            {/* 보관창고 */}
                            <td className="px-4 py-2">
                              <span className="text-xs text-gray-700 font-medium flex items-center gap-1">
                                <WarehouseIcon className="h-3 w-3 text-gray-400" />
                                {getWarehouseName(eq.warehouseId)}
                              </span>
                            </td>
                            {/* 장비상태 */}
                            <td className="px-4 py-2 text-center">
                              <Badge className={`${EQUIPMENT_CONDITION_COLORS[eq.condition]} text-[10px]`}>
                                {EQUIPMENT_CONDITION_LABELS[eq.condition]}
                              </Badge>
                            </td>
                            {/* 출고완료 탭: 출고 정보 */}
                            {activeTab === 'released' && (
                              <>
                                <td className="px-4 py-2">
                                  {eq.releaseType ? (
                                    <Badge className={`${RELEASE_TYPE_COLORS[eq.releaseType as ReleaseType]} text-[10px]`}>
                                      {RELEASE_TYPE_LABELS[eq.releaseType as ReleaseType]}
                                    </Badge>
                                  ) : '-'}
                                </td>
                                <td className="px-4 py-2">
                                  <span className="text-xs text-gray-600">{formatDate(eq.releaseDate)}</span>
                                </td>
                                <td className="px-4 py-2">
                                  <span className="text-xs text-gray-600 truncate block">{eq.releaseDestination || '-'}</span>
                                </td>
                              </>
                            )}
                            {/* 액션 버튼 */}
                            <td className="px-4 py-2 text-center">
                              {activeTab === 'stored' ? (
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs gap-1"
                                    onClick={() => onEdit(eq)}
                                  >
                                    <Edit2 className="h-3 w-3" />
                                    수정
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-7 px-2 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                                    onClick={() => onRelease(eq)}
                                  >
                                    <LogOut className="h-3 w-3" />
                                    출고
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => setDeleteTarget({ id: eq.id, siteName: eq.siteName })}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs gap-1 text-gray-600 hover:text-orange-700 hover:border-orange-300 hover:bg-orange-50"
                                  onClick={() => setRevertTarget({ id: eq.id, siteName: eq.siteName })}
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
                  ) : (
                    <div className="px-4 py-6 text-center text-gray-400 text-sm">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>등록된 장비가 없습니다</p>
                      <p className="text-xs mt-1">아래 버튼으로 장비를 추가하세요</p>
                    </div>
                  )}

                  {/* 장비 추가 버튼 (보관중 탭에서만) */}
                  {activeTab === 'stored' && (
                    <div className="px-4 py-2 border-t bg-gray-50/30">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-3 text-xs gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={() => onAddEquipment(site)}
                      >
                        <Plus className="h-3 w-3" />
                        장비 추가
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ─── 모바일 (md 미만) ─── */}
      <div className="md:hidden space-y-3">
        {sites.map((site) => {
          const key = getSiteKey(site)
          const isExpanded = expandedSites.has(key)
          const equipCount = site.equipment.length

          return (
            <div key={key} className="border rounded-lg overflow-hidden bg-white">
              {/* 현장 카드 헤더 */}
              <button
                type="button"
                onClick={() => toggleSite(site)}
                className="w-full px-4 py-3 flex items-center gap-2 text-left"
              >
                {isExpanded
                  ? <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{site.siteName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {site.affiliate && (
                      <span className="text-[10px] text-gray-400">{site.affiliate}</span>
                    )}
                    {site.orderDate && (
                      <span className="text-[10px] text-gray-400">{formatDate(site.orderDate)}</span>
                    )}
                    {!site.orderId && (
                      <Badge className="text-[9px] bg-gray-100 text-gray-400 border-gray-200 px-1 py-0">수동</Badge>
                    )}
                  </div>
                </div>
                <Badge
                  className={`flex-shrink-0 text-[10px] ${
                    equipCount > 0
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-gray-100 text-gray-400 border-gray-200'
                  }`}
                >
                  {equipCount}대
                </Badge>
              </button>

              {/* 장비 카드 목록 (펼쳤을 때) */}
              {isExpanded && (
                <div className="border-t px-4 py-3 space-y-2">
                  {/* 주소 */}
                  {site.address && (
                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-2">
                      <MapPin className="h-3 w-3" />
                      {site.address}
                    </p>
                  )}

                  {equipCount > 0 ? (
                    site.equipment.map((eq) => (
                      <div key={eq.id} className="border rounded-md p-3 space-y-2 bg-gray-50/50">
                        {/* 품목 + 장비상태 */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-700">{eq.category}</span>
                            <Badge className={`${EQUIPMENT_CONDITION_COLORS[eq.condition]} text-[10px]`}>
                              {EQUIPMENT_CONDITION_LABELS[eq.condition]}
                            </Badge>
                          </div>
                          <span className="text-[10px] text-gray-400">{eq.quantity}대</span>
                        </div>

                        {/* 모델/평형/제조사/제조년월 */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <div>
                            <span className="text-[10px] text-gray-400">모델명</span>
                            <p className="text-gray-700 truncate">{eq.model || '(미입력)'}</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-400">평형</span>
                            <p className="text-gray-700">{eq.size || '-'}</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-400">제조사</span>
                            <p className="text-gray-700">{eq.manufacturer || '삼성'}</p>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-400">제조년월</span>
                            <p className="text-gray-700">{formatManufDate(eq.manufacturingDate)}</p>
                          </div>
                        </div>

                        {/* 보관창고 */}
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <WarehouseIcon className="h-3 w-3 text-gray-400" />
                          {getWarehouseName(eq.warehouseId)}
                        </div>

                        {/* 출고 정보 (출고완료 탭) */}
                        {activeTab === 'released' && eq.releaseType && (
                          <div className="bg-white rounded-md p-2 space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge className={`${RELEASE_TYPE_COLORS[eq.releaseType as ReleaseType]} text-[10px]`}>
                                {RELEASE_TYPE_LABELS[eq.releaseType as ReleaseType]}
                              </Badge>
                              <span className="text-xs text-gray-500">{formatDate(eq.releaseDate)}</span>
                            </div>
                            {eq.releaseDestination && (
                              <p className="text-xs text-gray-600">목적지: {eq.releaseDestination}</p>
                            )}
                          </div>
                        )}

                        {/* 메모 */}
                        {(eq.notes || eq.removalReason) && (
                          <p className="text-[10px] text-gray-400 truncate">
                            {eq.notes || eq.removalReason}
                          </p>
                        )}

                        {/* 액션 버튼 */}
                        <div className="flex justify-end gap-1 pt-1">
                          {activeTab === 'stored' ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs gap-1"
                                onClick={() => onEdit(eq)}
                              >
                                <Edit2 className="h-3 w-3" />
                                수정
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 px-2 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => onRelease(eq)}
                              >
                                <LogOut className="h-3 w-3" />
                                출고
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                onClick={() => setDeleteTarget({ id: eq.id, siteName: eq.siteName })}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs gap-1 text-gray-600 hover:text-orange-700 hover:border-orange-300 hover:bg-orange-50"
                              onClick={() => setRevertTarget({ id: eq.id, siteName: eq.siteName })}
                            >
                              <Undo2 className="h-3 w-3" />
                              되돌리기
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-gray-400 text-sm">
                      <Package className="h-6 w-6 mx-auto mb-1 opacity-50" />
                      <p className="text-xs">등록된 장비가 없습니다</p>
                    </div>
                  )}

                  {/* 장비 추가 버튼 (보관중 탭에서만) */}
                  {activeTab === 'stored' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full h-8 text-xs gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => onAddEquipment(site)}
                    >
                      <Plus className="h-3 w-3" />
                      장비 추가
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        })}
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
