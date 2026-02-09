/**
 * 출고 처리 다이얼로그
 *
 * 보관중인 장비를 출고(재설치/폐기/반납)할 때 사용합니다.
 * - 출고 유형 선택 (재설치/폐기/반납)
 * - 출고일 입력
 * - 출고 목적지 입력 (재설치 시 필요)
 * - 출고 메모 (선택)
 */

'use client'

import { useState } from 'react'
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
import type { StoredEquipment, ReleaseType } from '@/types/order'

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
}

export function ReleaseDialog({ equipment, open, onOpenChange, onRelease }: ReleaseDialogProps) {
  // 출고 유형 (기본: 재설치)
  const [releaseType, setReleaseType] = useState<ReleaseType>('reinstall')
  // 출고일 (기본: 오늘)
  const [releaseDate, setReleaseDate] = useState(new Date().toISOString().split('T')[0])
  // 출고 목적지
  const [releaseDestination, setReleaseDestination] = useState('')
  // 출고 메모
  const [releaseNotes, setReleaseNotes] = useState('')

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

  // 출고 유형 옵션
  const releaseTypes: ReleaseType[] = ['reinstall', 'dispose', 'return']

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
                            : type === 'dispose'
                              ? 'bg-red-50 text-red-700 border-red-300 ring-1 ring-red-300'
                              : 'bg-orange-50 text-orange-700 border-orange-300 ring-1 ring-orange-300'
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
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-1 block">출고 목적지 (재설치 현장명)</Label>
                  <Input
                    type="text"
                    value={releaseDestination}
                    onChange={(e) => setReleaseDestination(e.target.value)}
                    placeholder="재설치할 현장명을 입력하세요"
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
                : releaseType === 'dispose' ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-orange-600 hover:bg-orange-700'
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
