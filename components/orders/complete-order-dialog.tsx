/**
 * 발주 완료 처리 모달 컴포넌트
 *
 * 진행중인 발주가 설치 완료되면 이 모달을 띄워서:
 * 1. 완료일 입력
 * 2. 실제 공사비 입력 (견적가와 비교)
 * 3. 완료 처리 → 상태를 'completed', 정산 상태를 'pending'으로 변경
 *
 * 비유: 마치 "공사 완료 확인서"를 작성하는 것처럼!
 */

'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, ClipboardList } from 'lucide-react'
import type { Order } from '@/types/order'

/**
 * 컴포넌트가 받을 Props
 */
interface CompleteOrderDialogProps {
  order: Order | null              // 완료 처리할 발주 (null이면 모달 안 열림)
  open: boolean                    // 모달 열림 상태
  onOpenChange: (open: boolean) => void  // 모달 열림/닫힘 제어
  onComplete: (updatedOrder: Order) => void  // 완료 처리 완료 시 실행할 함수
}

/**
 * 발주 완료 처리 모달
 */
export function CompleteOrderDialog({
  order,
  open,
  onOpenChange,
  onComplete
}: CompleteOrderDialogProps) {
  // 폼 데이터 상태
  const [formData, setFormData] = useState({
    completionDate: getTodayDate(),         // 완료일 (기본값: 오늘)
    actualCost: order?.quoteAmount || 0,    // 실제 공사비 (기본값: 견적가)
  })

  // order가 null이면 아무것도 안 함
  if (!order) return null

  // 견적가 vs 실제 공사비 차액 계산
  const costDifference = formData.actualCost - (order.quoteAmount || 0)

  /**
   * 완료 처리 실행
   */
  const handleComplete = () => {
    // 업데이트된 발주 정보
    const updatedOrder: Order = {
      ...order,
      status: 'completed',                  // 상태를 "완료"로 변경
      completionDate: formData.completionDate,  // 완료일 설정
      actualCost: formData.actualCost,      // 실제 공사비 설정
      settlementMonth: formData.completionDate.substring(0, 7)  // 정산 월 (YYYY-MM)
    }

    // 부모 컴포넌트로 전달
    onComplete(updatedOrder)

    // 모달 닫기
    onOpenChange(false)
  }

  /**
   * 오늘 날짜를 YYYY-MM-DD 형식으로 반환
   */
  function getTodayDate() {
    return new Date().toISOString().split('T')[0]
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" /> 설치 완료 처리
          </DialogTitle>
          <DialogDescription>
            설치가 완료되었습니다. 완료 정보를 입력해주세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 발주 정보 요약 */}
          <Card className="bg-gray-50">
            <CardContent className="pt-4 space-y-2">
              <p className="text-sm">
                <span className="text-gray-600">문서번호:</span>{' '}
                <span className="font-mono font-medium">{order.documentNumber}</span>
              </p>
              <p className="text-sm">
                <span className="text-gray-600">주소:</span>{' '}
                <span className="font-medium">{order.address}</span>
              </p>
              <p className="text-sm">
                <span className="text-gray-600">계열사:</span>{' '}
                <span className="font-medium">{order.affiliate}</span>
              </p>
              <p className="text-sm">
                <span className="text-gray-600">사업자명:</span>{' '}
                <span className="font-medium">{order.businessName}</span>
              </p>
            </CardContent>
          </Card>

          {/* 완료일 입력 */}
          <div>
            <label htmlFor="completionDate" className="block text-sm font-medium mb-2">
              설치 완료일 <span className="text-red-500">*</span>
            </label>
            <Input
              id="completionDate"
              type="date"
              value={formData.completionDate}
              max={getTodayDate()}  // 오늘 이후 날짜는 선택 불가
              onChange={(e) => setFormData(prev => ({
                ...prev,
                completionDate: e.target.value
              }))}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              실제로 설치가 완료된 날짜를 선택하세요
            </p>
          </div>

          {/* 실제 공사비 입력 */}
          <div>
            <label htmlFor="actualCost" className="block text-sm font-medium mb-2">
              실제 공사비 (원) <span className="text-red-500">*</span>
            </label>

            {/* 견적 금액 표시 */}
            <div className="bg-blue-50 p-3 rounded-lg mb-2 border border-blue-100">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ClipboardList className="h-3 w-3" /> 견적 금액
              </p>
              <p className="text-lg font-bold text-blue-600">
                {order.quoteAmount?.toLocaleString('ko-KR') || '미입력'}원
              </p>
            </div>

            {/* 실제 공사비 입력 */}
            <div className="relative">
              <Input
                id="actualCost"
                type="number"
                min="0"
                step="10000"
                value={formData.actualCost || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  actualCost: parseInt(e.target.value) || 0
                }))}
                required
                className="pr-12"
              />
              <span className="absolute right-3 top-2.5 text-sm text-gray-500">원</span>
            </div>

            {/* 천 단위 콤마로 표시 */}
            {formData.actualCost > 0 && (
              <p className="text-sm text-gray-700 mt-1 font-medium">
                실제: {formData.actualCost.toLocaleString('ko-KR')}원
              </p>
            )}

            {/* 차액 표시 */}
            {costDifference !== 0 && (
              <div className={`mt-2 p-2 rounded ${
                costDifference > 0
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}>
                <p className="text-sm font-medium">
                  {costDifference > 0 ? '견적 초과' : '견적 절감'}:{' '}
                  {costDifference > 0 ? '+' : ''}{costDifference.toLocaleString('ko-KR')}원
                </p>
              </div>
            )}

            <p className="text-xs text-muted-foreground mt-2">
              실제로 지불한 공사비를 정확히 입력해주세요 (정산 시 사용)
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
          <Button
            onClick={handleComplete}
            disabled={!formData.completionDate || formData.actualCost <= 0}
          >
            완료 처리
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
