/**
 * 유휴재고 직접 입력 및 수정 다이얼로그
 */

'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PlusCircle, Loader2, Save } from 'lucide-react'
import { createInventoryEvent, updateInventoryEvent } from '@/lib/supabase/dal'
import type { Warehouse } from '@/types/warehouse'
import type { InventoryEvent } from '@/types/order'
import { CATEGORY_OPTIONS } from '@/types/order'
import { useAlert } from '@/components/ui/custom-alert'

interface IdleInventoryDialogProps {
  warehouses: Warehouse[]
  onSuccess: () => void
  editData?: InventoryEvent // 수정 시 전달받는 기존 데이터
  onClose?: () => void      // 닫기 콜백 (수정 모드 전용)
}

export function IdleInventoryDialog({ 
  warehouses, 
  onSuccess, 
  editData,
  onClose 
}: IdleInventoryDialogProps) {
  const isEdit = !!editData
  const [open, setOpen] = useState(isEdit)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { showAlert } = useAlert()

  // 폼 상태
  const [formData, setFormData] = useState({
    modelName: '',
    category: '',
    quantity: 1,
    sourceWarehouseId: '',
    siteName: '직접 입력 재고',
    notes: '',
    eventDate: new Date().toISOString().split('T')[0],
  })

  // 수정 모드일 때 데이터 채우기
  useEffect(() => {
    if (editData) {
      setFormData({
        modelName: editData.modelName || '',
        category: editData.category || '',
        quantity: editData.quantity || 1,
        sourceWarehouseId: editData.sourceWarehouseId || '',
        siteName: editData.siteName || '직접 입력 재고',
        notes: editData.notes || '',
        eventDate: editData.eventDate || new Date().toISOString().split('T')[0],
      })
      setOpen(true)
    }
  }, [editData])

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen)
    if (!newOpen && onClose) {
      onClose()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.modelName || !formData.category || !formData.sourceWarehouseId) {
      showAlert('필수 항목을 모두 입력해주세요.', 'warning')
      return
    }

    setIsSubmitting(true)
    try {
      let result
      if (isEdit && editData?.id) {
        // 수정 모드
        result = await updateInventoryEvent(editData.id, {
          modelName: formData.modelName,
          category: formData.category,
          quantity: formData.quantity,
          sourceWarehouseId: formData.sourceWarehouseId,
          siteName: formData.siteName,
          notes: formData.notes,
          eventDate: formData.eventDate,
        })
      } else {
        // 등록 모드
        result = await createInventoryEvent({
          eventType: 'idle',
          modelName: formData.modelName,
          category: formData.category,
          quantity: formData.quantity,
          sourceWarehouseId: formData.sourceWarehouseId,
          siteName: formData.siteName,
          notes: formData.notes,
          eventDate: formData.eventDate,
          status: 'active',
        })
      }

      if (result) {
        showAlert(isEdit ? '수정이 완료되었습니다.' : '유휴재고가 등록되었습니다.', 'success')
        handleOpenChange(false)
        onSuccess()
        
        if (!isEdit) {
          // 등록 모드일 때만 폼 초기화
          setFormData({
            modelName: '',
            category: '',
            quantity: 1,
            sourceWarehouseId: '',
            siteName: '직접 입력 재고',
            notes: '',
            eventDate: new Date().toISOString().split('T')[0],
          })
        }
      } else {
        showAlert('처리에 실패했습니다. 다시 시도해주세요.', 'error')
      }
    } catch (error) {
      console.error('유휴재고 처리 오류:', error)
      showAlert('오류가 발생했습니다.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isEdit && (
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2 border-brick-200 text-brick-600 hover:bg-brick-50 hover:text-brick-700">
            <PlusCircle className="h-4 w-4" />
            유휴재고 직접 입력
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? '유휴재고 수정' : '유휴재고 직접 등록'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="modelName">모델명 <span className="text-red-500">*</span></Label>
              <Input
                id="modelName"
                placeholder="예: AP072BAPPBH2S"
                value={formData.modelName}
                onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>품목 <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                    <SelectItem value="기타">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="quantity">수량 <span className="text-red-500">*</span></Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>보관 창고 <span className="text-red-500">*</span></Label>
              <Select
                value={formData.sourceWarehouseId}
                onValueChange={(value) => setFormData({ ...formData, sourceWarehouseId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="창고 선택" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>{wh.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="siteName">출처 (현장명)</Label>
              <Input
                id="siteName"
                placeholder="예: 직접 입력, OO현장 취소건 등"
                value={formData.siteName}
                onChange={(e) => setFormData({ ...formData, siteName: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">메모/취소사유</Label>
              <Textarea
                id="notes"
                placeholder="추가 정보를 입력하세요"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
              취소
            </Button>
            <Button type="submit" className="bg-brick-600 hover:bg-brick-700" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : isEdit ? (
                <Save className="mr-2 h-4 w-4" />
              ) : null}
              {isEdit ? '수정 완료' : '등록 완료'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
