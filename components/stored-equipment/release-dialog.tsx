/**
 * 출고 처리 다이얼로그
 *
 * 보관중인 장비를 출고(재설치/폐기)할 때 사용합니다.
 * - 출고 유형 선택 (재설치/폐기)
 * - 출고일 입력
 * - 출고 목적지 — 재설치 시: 재고설치 발주 목록(일정미정)에서 선택 또는 직접 입력
 * - 출고 메모 (선택)
 */

'use client'

import { useState, useEffect } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RELEASE_TYPE_LABELS } from '@/types/order'
import type { StoredEquipment, ReleaseType, Order } from '@/types/order'

interface ReleaseDialogProps {
  /** 출고 대상 장비 (null이면 다이얼로그 닫힘) */
  equipment: StoredEquipment | null
  /** 다이얼로그 열림/닫힘 */
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 출고 확인 콜백 */
  onRelease: (id: string, info: {
    releaseType: string
    releaseDate: string
    releaseDestination?: string
    releaseNotes?: string
  }) => void
  /** 출고 목적지 기본값 */
  defaultDestination?: string
  /** 재고설치 발주 목록 (일정미정 건 매칭용) */
  orders?: Order[]
}

export function ReleaseDialog({ equipment, open, onOpenChange, onRelease, defaultDestination, orders }: ReleaseDialogProps) {
  // 출고 유형 (기본: 재설치)
  const [releaseType, setReleaseType] = useState<ReleaseType>('reinstall')
  // 출고일 (기본: 오늘)
  const [releaseDate, setReleaseDate] = useState(new Date().toISOString().split('T')[0])
  // 출고 목적지
  const [releaseDestination, setReleaseDestination] = useState('')
  // 출고 메모
  const [releaseNotes, setReleaseNotes] = useState('')

  // 재고설치 발주 중 일정미정 건 필터
  const reinstallOrders = (orders || []).filter(order =>
    order.status !== 'cancelled' &&
    order.status !== 'settled' &&
    order.items.some(item => item.workType === '재고설치') &&
    !order.installScheduleDate && !order.installCompleteDate
  )

  // 다이얼로그 열릴 때 기본값 적용
  useEffect(() => {
    if (open && defaultDestination) {
      setReleaseType('reinstall')
      setReleaseDestination(defaultDestination)
    }
  }, [open, defaultDestination])

  /** 폼 초기화 */
  const resetForm = () => {
    setReleaseType('reinstall')
    setReleaseDate(new Date().toISOString().split('T')[0])
    setReleaseDestination('')
    setReleaseNotes('')
  }

  /** 출고 확인 */
  const handleConfirm = () => {
    if (!equipment) return
    onRelease(equipment.id, {
      releaseType,
      releaseDate,
      releaseDestination: releaseDestination || undefined,
      releaseNotes: releaseNotes || undefined,
    })
    resetForm()
    onOpenChange(false)
  }

  /** 재고설치 발주 선택 → 현장정보로 목적지 채움 */
  const handleOrderSelect = (order: Order) => {
    const dest = `${order.businessName}${order.address ? ` (${order.address})` : ''}`
    setReleaseDestination(dest)
  }

  // 출고 유형 옵션 (재설치/폐기만)
  const releaseTypes: ReleaseType[] = ['reinstall', 'dispose']

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>출고 처리</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              {/* 장비 정보 요약 */}
              {equipment && (
                <div className="bg-gray-50 rounded-md p-3 text-sm">
                  <p className="font-medium text-gray-700">{equipment.siteName}</p>
                  <p className="text-gray-500">{equipment.category} {equipment.model ? `· ${equipment.model}` : ''} {equipment.size ? `· ${equipment.size}` : ''} — {equipment.quantity}대</p>
                </div>
              )}

              {/* 출고 유형 선택 */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-2 block">출고 유형</Label>
                <div className="flex gap-2">
                  {releaseTypes.map(type => (
                    <button
                      key={type}
                      type="button"
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium border transition-all ${
                        releaseType === type
                          ? type === 'reinstall'
                            ? 'bg-green-50 text-green-700 border-green-300 ring-1 ring-green-300'
                            : 'bg-red-50 text-red-700 border-red-300 ring-1 ring-red-300'
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => setReleaseType(type)}
                    >
                      {RELEASE_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>

              {/* 출고일 */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1 block">출고일</Label>
                <Input
                  type="date"
                  value={releaseDate}
                  onChange={(e) => setReleaseDate(e.target.value)}
                  className="max-w-[200px]"
                />
              </div>

              {/* 출고 목적지 (재설치 시 표시) */}
              {releaseType === 'reinstall' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700 block">출고 목적지 (재설치 현장)</Label>

                  {/* 재고설치 발주 매칭 목록 */}
                  {reinstallOrders.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-blue-600 font-medium">재고설치 발주 (일정미정)</p>
                      <div className="max-h-[140px] overflow-y-auto space-y-1 border rounded-md p-1.5 bg-blue-50/30">
                        {reinstallOrders.map(order => (
                          <button
                            key={order.id}
                            type="button"
                            onClick={() => handleOrderSelect(order)}
                            className="w-full text-left px-2.5 py-2 rounded text-sm bg-white border border-transparent hover:border-blue-300 hover:bg-blue-50 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-gray-800">{order.businessName}</span>
                              <span className="text-xs text-gray-400">{order.orderDate}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {order.affiliate && (
                                <span className="text-xs text-gray-500">{order.affiliate}</span>
                              )}
                              {order.address && (
                                <span className="text-xs text-gray-400 truncate">{order.address}</span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 직접 입력 */}
                  <Input
                    type="text"
                    value={releaseDestination}
                    onChange={(e) => setReleaseDestination(e.target.value)}
                    placeholder="위에서 선택하거나 직접 입력하세요"
                  />
                </div>
              )}

              {/* 출고 메모 */}
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-1 block">메모 (선택)</Label>
                <textarea
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  placeholder="출고 관련 메모를 입력하세요"
                  className="w-full border rounded-md p-2 text-sm min-h-[60px] resize-none focus:outline-none focus:ring-1 focus:ring-blue-300 placeholder:text-gray-300"
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction
            className={`text-white ${
              releaseType === 'reinstall' ? 'bg-green-600 hover:bg-green-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
            disabled={!releaseDate}
            onClick={handleConfirm}
          >
            출고 처리
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
