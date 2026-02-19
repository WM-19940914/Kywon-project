/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * 연간 단가표 페이지
 *
 * 교원그룹 단가표를 조회하는 페이지입니다.
 * SET 모델을 클릭하면 구성품(실내기, 실외기, 자재박스 등) 상세 정보를 확장해서 보여줍니다.
 */

'use client'

import { useState, useEffect } from 'react'
import { BookOpen, ChevronDown, ChevronRight, Search, Loader2, Plus, Trash2, Pencil, Hammer, Package } from 'lucide-react'
import { ExcelExportButton } from '@/components/ui/excel-export-button'
import { exportToExcel, exportMultiSheetExcel, buildExcelFileName, type ExcelColumn } from '@/lib/excel-export'
import { fetchPriceTable, fetchInstallationPriceItems, saveInstallationPriceItems, upsertPriceTableSet, savePriceTableComponents, deletePriceTableSet } from '@/lib/supabase/dal'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAlert } from '@/components/ui/custom-alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
// Select 컴포넌트 (추후 필터 기능에서 사용 예정)
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from '@/components/ui/select'

// 가격 포맷팅 함수
function formatPrice(price: number): string {
  return `${price.toLocaleString('ko-KR')}원`
}

/**
 * 장비 추가/수정 다이얼로그 컴포넌트
 */
function PriceTableDialog({
  mode = 'add',
  initialData,
  onSave,
  externalOpen,
  onOpenChange,
}: {
  mode?: 'add' | 'edit'
  initialData?: any
  onSave: (data: any) => void
  externalOpen?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const { showAlert } = useAlert()
  const [internalOpen, setInternalOpen] = useState(false)

  // 외부에서 open을 제어하는 경우와 내부에서 제어하는 경우를 구분
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen
  const [formData, setFormData] = useState({
    category: initialData?.category || '',
    model: initialData?.model || '',
    size: initialData?.size || '',
    price: initialData?.price || 0,
  })
  const [components, setComponents] = useState<any[]>(
    initialData?.components?.length > 0
      ? initialData.components
      : [{ type: '실외기', model: '', unitPrice: 0, salePrice: 0, quantity: 1 }]
  )

  // initialData가 변경되면 폼 데이터 업데이트
  useEffect(() => {
    if (initialData && open) {
      setFormData({
        category: initialData.category || '',
        model: initialData.model || '',
        size: initialData.size || '',
        price: initialData.price || 0,
      })
      setComponents(
        initialData.components?.length > 0
          ? initialData.components
          : [{ type: '실외기', model: '', unitPrice: 0, salePrice: 0, quantity: 1 }]
      )
    }
  }, [initialData, open])

  // 구성품 추가
  const addComponent = () => {
    setComponents([...components, { type: '실내기', model: '', unitPrice: 0, salePrice: 0, quantity: 1 }])
  }

  // 구성품 삭제
  const removeComponent = (index: number) => {
    setComponents(components.filter((_, i) => i !== index))
  }

  // 구성품 필드 변경
  const updateComponent = (index: number, field: string, value: any) => {
    const updated = [...components]
    updated[index] = { ...updated[index], [field]: value }
    setComponents(updated)
  }

  // 저장
  const handleSave = async () => {
    if (!formData.category || !formData.model || !formData.size || !formData.price) {
      showAlert('필수 항목을 모두 입력해주세요', 'warning')
      return
    }

    const data = {
      id: initialData?.id,
      ...formData,
      components: components,
    }

    await onSave(data)

    // 폼 초기화
    setFormData({ category: '', model: '', size: '', price: 0 })
    setComponents([{ type: '실외기', model: '', unitPrice: 0, salePrice: 0, quantity: 1 }])
    setOpen(false)
  }

  // 다이얼로그 닫을 때 폼 초기화
  const handleClose = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen && mode === 'add') {
      setFormData({ category: '', model: '', size: '', price: 0 })
      setComponents([{ type: '실외기', model: '', unitPrice: 0, salePrice: 0, quantity: 1 }])
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {mode === 'add' && (
        <DialogTrigger asChild>
          <Button className="flex items-center gap-2 rounded-lg">
            <Plus className="h-4 w-4" />
            장비 추가
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl ${mode === 'add' ? 'bg-gradient-to-br from-teal-500 to-teal-600' : 'bg-gradient-to-br from-gold-500 to-gold-600'} flex items-center justify-center shadow-md`}>
              <Plus className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">
                {mode === 'add' ? '새 장비 추가' : '장비 수정'}
              </DialogTitle>
              <DialogDescription className="text-sm">
                SET 모델과 구성품 정보를 {mode === 'add' ? '입력' : '수정'}하세요
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* SET 모델 정보 */}
          <div className="space-y-4 p-5 border-2 border-teal-100 rounded-xl bg-gradient-to-br from-teal-50 to-white">
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 bg-teal-500 rounded-full"></div>
              <h3 className="font-bold text-base text-gray-800">SET 모델 정보</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* 카테고리 */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">카테고리 *</label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="예: 스탠드형 냉난방"
                  className="h-10 border-slate-200 focus:border-teal-500 rounded-lg"
                />
                <p className="text-xs text-gray-500">스탠드형/벽걸이형 등</p>
              </div>

              {/* 평형 */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">평형 *</label>
                <Input
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  placeholder="예: 36평"
                  className="h-10 border-slate-200 focus:border-teal-500 rounded-lg"
                />
                <p className="text-xs text-gray-500">숫자+평 형식</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* SET 모델명 */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">SET 모델명 *</label>
                <Input
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="예: AP290DAPDHH1S"
                  className="h-10 font-mono border-slate-200 focus:border-teal-500 rounded-lg"
                />
              </div>

              {/* 판매가 */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700">판매가 (VAT별도) *</label>
                <Input
                  type="number"
                  value={formData.price || ''}
                  onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  className="h-10 border-slate-200 focus:border-teal-500 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* 구성품 정보 */}
          <div className="space-y-4 p-5 border-2 border-olive-100 rounded-xl bg-gradient-to-br from-olive-50 to-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 bg-olive-500 rounded-full"></div>
                <h3 className="font-bold text-base text-gray-800">구성품 정보</h3>
              </div>
              <Button size="sm" onClick={addComponent} className="bg-olive-600 hover:bg-olive-700 rounded-lg">
                <Plus className="h-4 w-4 mr-1.5" />
                구성품 추가
              </Button>
            </div>

            <div className="space-y-3">
              {components.map((comp, idx) => (
                <div key={idx} className="p-4 border-2 border-slate-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-olive-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-olive-700">#{idx + 1}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-700">구성품</span>
                    </div>
                    {components.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeComponent(idx)}
                        className="h-7 w-7 p-0 text-brick-500 hover:text-brick-700 hover:bg-brick-50 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {/* 타입 */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-600">타입</label>
                      <Input
                        className="h-9 text-sm rounded-lg"
                        value={comp.type}
                        onChange={(e) => updateComponent(idx, 'type', e.target.value)}
                        placeholder="예: 실외기"
                      />
                    </div>

                    {/* 모델명 */}
                    <div className="space-y-1.5 col-span-2">
                      <label className="text-xs font-semibold text-gray-600">모델명</label>
                      <Input
                        className="h-9 text-sm font-mono rounded-lg"
                        value={comp.model}
                        onChange={(e) => updateComponent(idx, 'model', e.target.value)}
                        placeholder="예: AP290DNPDHH1"
                      />
                    </div>

                    {/* 출하가 */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-600">출하가</label>
                      <Input
                        className="h-9 text-sm rounded-lg"
                        type="number"
                        value={comp.unitPrice || ''}
                        onChange={(e) => updateComponent(idx, 'unitPrice', parseInt(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>

                    {/* 판매가 */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-600">판매가</label>
                      <Input
                        className="h-9 text-sm rounded-lg"
                        type="number"
                        value={comp.salePrice || ''}
                        onChange={(e) => updateComponent(idx, 'salePrice', parseInt(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>

                    {/* 수량 */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-600">수량</label>
                      <Input
                        className="h-9 text-sm rounded-lg"
                        type="number"
                        value={comp.quantity || 1}
                        onChange={(e) => updateComponent(idx, 'quantity', parseInt(e.target.value) || 1)}
                        placeholder="1"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 저장 버튼 */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSave}
              className={`flex-1 h-11 text-base font-semibold shadow-md hover:shadow-lg transition-all rounded-lg ${
                mode === 'add'
                  ? 'bg-teal-600 hover:bg-teal-700'
                  : 'bg-gold-600 hover:bg-gold-700'
              }`}
            >
              <Plus className="h-5 w-5 mr-2" />
              {mode === 'add' ? '저장하기' : '수정하기'}
            </Button>
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
              className="flex-1 h-11 text-base font-semibold border-2 border-slate-200 hover:bg-gray-100 rounded-lg"
            >
              취소
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * 수정 버튼 + Dialog 컴포넌트
 */
function EditButton({ data, onSave }: { data: any; onSave: (data: any) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        className="h-8 w-8 p-0 text-gold-500 hover:text-gold-700 hover:bg-gold-50 rounded-lg"
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <PriceTableDialog
        mode="edit"
        initialData={data}
        externalOpen={open}
        onOpenChange={setOpen}
        onSave={async (updatedData) => {
          await onSave(updatedData)
          setOpen(false)
        }}
      />
    </>
  )
}

export default function PriceTablePage() {
  // 탭 상태: 장비 단가 / 설치비 단가
  const [activeTab, setActiveTab] = useState<'equipment' | 'installation'>('equipment')

  // 단가계약 항목 (DB에서 불러옴)
  const [newInstallRows, setNewInstallRows] = useState<{ category: string; model: string; price: number }[]>([])
  const [relocationRows, setRelocationRows] = useState<{ category: string; model: string; price: number }[]>([])
  const [additionalRows, setAdditionalRows] = useState<{ category: string; model: string; price: number }[]>([])
  const [returnRows, setReturnRows] = useState<{ category: string; model: string; price: number }[]>([])

  // 전기공사 / 기타공사 state + DB 연동
  const [elecRows, setElecRows] = useState<{ category: string; model: string }[]>([])
  const [etcRows, setEtcRows] = useState<{ category: string; model: string }[]>([])
  const [savingElec, setSavingElec] = useState(false)
  const [savingEtc, setSavingEtc] = useState(false)

  // DB에서 불러오기
  useEffect(() => {
    fetchInstallationPriceItems('new_install').then(items => {
      setNewInstallRows(items.map(r => ({ category: r.category, model: r.model, price: r.price })))
    })
    fetchInstallationPriceItems('relocation').then(items => {
      setRelocationRows(items.map(r => ({ category: r.category, model: r.model, price: r.price })))
    })
    fetchInstallationPriceItems('additional').then(items => {
      setAdditionalRows(items.map(r => ({ category: r.category, model: r.model, price: r.price })))
    })
    fetchInstallationPriceItems('return').then(items => {
      setReturnRows(items.map(r => ({ category: r.category, model: r.model, price: r.price })))
    })
    fetchInstallationPriceItems('electric').then(items => {
      if (items.length > 0) setElecRows(items.map(r => ({ category: r.category, model: r.model })))
    })
    fetchInstallationPriceItems('etc').then(items => {
      if (items.length > 0) setEtcRows(items.map(r => ({ category: r.category, model: r.model })))
    })
  }, [])

  // 전기공사 수정 + 1초 후 자동저장
  const elecTimerRef = { current: null as ReturnType<typeof setTimeout> | null }
  const handleElecChange = (index: number, field: 'category' | 'model', value: string) => {
    setElecRows(prev => {
      const next = prev.map((row, i) => i === index ? { ...row, [field]: value } : row)
      if (elecTimerRef.current) clearTimeout(elecTimerRef.current)
      elecTimerRef.current = setTimeout(async () => {
        setSavingElec(true)
        await saveInstallationPriceItems('electric', next)
        setSavingElec(false)
      }, 1000)
      return next
    })
  }
  const addElecRow = () => {
    setElecRows(prev => [...prev, { category: '', model: '' }])
  }

  // 기타공사 수정 + 1초 후 자동저장
  const etcTimerRef = { current: null as ReturnType<typeof setTimeout> | null }
  const handleEtcChange = (index: number, field: 'category' | 'model', value: string) => {
    setEtcRows(prev => {
      const next = prev.map((row, i) => i === index ? { ...row, [field]: value } : row)
      if (etcTimerRef.current) clearTimeout(etcTimerRef.current)
      etcTimerRef.current = setTimeout(async () => {
        setSavingEtc(true)
        await saveInstallationPriceItems('etc', next)
        setSavingEtc(false)
      }, 1000)
      return next
    })
  }
  const addEtcRow = () => {
    setEtcRows(prev => [...prev, { category: '', model: '' }])
  }

  // Supabase에서 단가표 데이터 가져오기
  const { showAlert, showConfirm } = useAlert()
  const [priceTable, setPriceTable] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchPriceTable().then(data => {
      // 카테고리 순서 정의
      const categoryOrder: Record<string, number> = {
        '스탠드형 냉난방': 1,
        '스탠드형 냉난방 삼상': 2,
        '스탠드형 냉난방 단상': 3,
        '스탠드형 냉방전용': 4,
        '벽걸이형 냉난방': 5,
        '벽걸이형 냉방전용': 6,
      }

      // 평형 숫자 추출 함수 (예: '83평' → 83)
      const getSizeNum = (size: string) => parseInt(size.replace('평', ''))

      // 정렬: 카테고리 → 평형 큰 순
      const sorted = [...data].sort((a, b) => {
        const catA = categoryOrder[a.category] || 999
        const catB = categoryOrder[b.category] || 999
        if (catA !== catB) return catA - catB
        return getSizeNum(b.size) - getSizeNum(a.size)  // 평형 큰 것부터
      })

      setPriceTable(sorted)
      setIsLoading(false)
    })
  }, [])

  // 구성품 순서 정의 (실외기 → 실내기 → 자재박스 → 브라켓/리모컨)
  const componentOrder: { [key: string]: number } = {
    '실외기': 1,
    '실내기': 2,
    '자재박스': 3,
    '브라켓': 4,
    '기타': 5
  }

  // 구성품 정렬 함수
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortComponents = (components: any[]) => {
    return [...components].sort((a, b) => {
      const orderA = componentOrder[a.type] || 999
      const orderB = componentOrder[b.type] || 999
      return orderA - orderB
    })
  }

  // 구성품은 이미 엑셀에서 판매가(salePrice)를 가져왔으므로 계산 불필요

  // 검색 필터링
  const displayedTable = priceTable.filter(row =>
    row.category.includes(searchTerm) ||
    row.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    row.size.includes(searchTerm)
  )

  // 행 확장/축소 토글
  const toggleRow = (model: string) => {
    const newExpandedRows = new Set(expandedRows)
    if (expandedRows.has(model)) {
      newExpandedRows.delete(model)
    } else {
      newExpandedRows.add(model)
    }
    setExpandedRows(newExpandedRows)
  }

  // 목록 새로고침 함수
  const refreshPriceTable = async () => {
    const updated = await fetchPriceTable()

    // 정렬 적용
    const categoryOrder: Record<string, number> = {
      '스탠드형 냉난방': 1,
      '스탠드형 냉난방 삼상': 2,
      '스탠드형 냉난방 단상': 3,
      '스탠드형 냉방전용': 4,
      '벽걸이형 냉난방': 5,
      '벽걸이형 냉방전용': 6,
    }
    const getSizeNum = (size: string) => parseInt(size.replace('평', ''))
    const sorted = [...updated].sort((a, b) => {
      const catA = categoryOrder[a.category] || 999
      const catB = categoryOrder[b.category] || 999
      if (catA !== catB) return catA - catB
      return getSizeNum(b.size) - getSizeNum(a.size)
    })

    setPriceTable(sorted)
  }

  // 장비 추가
  const handleAdd = async (data: any) => {
    // SET 모델 저장
    const setSuccess = await upsertPriceTableSet({
      category: data.category,
      model: data.model,
      size: data.size,
      price: data.price,
      listPrice: data.components?.reduce((sum: number, c: any) => sum + (c.unitPrice || 0), 0) || 0,
      year: 2026,
      isActive: true,
    })
    if (!setSuccess) {
      showAlert('장비 추가에 실패했습니다.', 'error')
      return
    }
    // 구성품 저장
    if (data.components?.length > 0) {
      await savePriceTableComponents(data.model, data.components)
    }
    await refreshPriceTable()
    showAlert('장비가 추가되었습니다!', 'success')
  }

  // 장비 수정
  const handleUpdate = async (data: any) => {
    const setSuccess = await upsertPriceTableSet({
      category: data.category,
      model: data.model,
      size: data.size,
      price: data.price,
      listPrice: data.components?.reduce((sum: number, c: any) => sum + (c.unitPrice || 0), 0) || 0,
      year: 2026,
      isActive: true,
    })
    if (!setSuccess) {
      showAlert('장비 수정에 실패했습니다.', 'error')
      return
    }
    if (data.components?.length > 0) {
      await savePriceTableComponents(data.model, data.components)
    }
    await refreshPriceTable()
    showAlert('장비가 수정되었습니다!', 'success')
  }

  // 장비 삭제
  const handleDelete = async (_id: string, model: string) => {
    const confirmed = await showConfirm(`"${model}" 제품을 삭제하시겠습니까?\n구성품도 함께 삭제됩니다.`)
    if (confirmed) {
      const success = await deletePriceTableSet(model)
      if (success) {
        await refreshPriceTable()
        showAlert('장비가 삭제되었습니다!', 'success')
      } else {
        showAlert('장비 삭제에 실패했습니다.', 'error')
      }
    }
  }

  /** 장비 단가표 엑셀 다운로드 — SET + 구성품 펼쳐서 추출 */
  const handleEquipmentExcelExport = () => {
    // SET 행 + 구성품 행을 모두 펼침
    const rows: Record<string, unknown>[] = []
    displayedTable.forEach((set: any) => {
      const sorted = sortComponents(set.components || [])
      sorted.forEach((comp: any, idx: number) => {
        rows.push({
          category: idx === 0 ? `${set.category} ${set.size}` : '',
          setModel: idx === 0 ? set.model : '',
          listPrice: idx === 0 ? set.listPrice || 0 : '',
          dcRate: idx === 0 ? '45%' : '',
          purchasePrice: idx === 0 ? Math.round((set.listPrice || 0) * 0.55) : '',
          setPrice: idx === 0 ? set.price : '',
          compType: comp.type,
          compModel: comp.model,
          compQty: comp.quantity,
          compUnitPrice: comp.unitPrice || 0,
          compSalePrice: comp.salePrice || 0,
        })
      })
    })
    const columns: ExcelColumn<Record<string, unknown>>[] = [
      { header: '품목', key: 'category', width: 22 },
      { header: 'SET모델명', key: 'setModel', width: 22 },
      { header: '삼성출하가', key: 'listPrice', width: 14, numberFormat: '#,##0' },
      { header: 'DC율', key: 'dcRate', width: 8 },
      { header: '매입가', key: 'purchasePrice', width: 14, numberFormat: '#,##0' },
      { header: '판매가(VAT별도)', key: 'setPrice', width: 16, numberFormat: '#,##0' },
      { header: '구성품', key: 'compType', width: 10 },
      { header: '구성품모델명', key: 'compModel', width: 22 },
      { header: '수량', key: 'compQty', width: 6 },
      { header: '구성품매입가', key: 'compUnitPrice', width: 14, numberFormat: '#,##0' },
      { header: '구성품판매가', key: 'compSalePrice', width: 14, numberFormat: '#,##0' },
    ]
    exportToExcel({
      data: rows,
      columns,
      fileName: buildExcelFileName('연간단가표', '장비단가'),
      sheetName: '장비단가',
    })
  }

  // 로딩 중이면 스켈레톤 표시
  if (isLoading) {
    return (
      <div className="container mx-auto max-w-[1400px] py-6 px-4 md:px-6">
        {/* 헤더 스켈레톤 */}
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div>
            <Skeleton className="h-7 w-40 mb-1.5" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>

        {/* 검색 스켈레톤 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
          <Skeleton className="h-10 w-full max-w-md rounded-lg" />
        </div>

        {/* 테이블 스켈레톤 */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-50/80 px-4 py-3">
            <Skeleton className="h-4 w-full" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3 border-b border-slate-100">
              <Skeleton className="h-5 w-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-[1400px] py-6 px-4 md:px-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="bg-teal-50 text-teal-600 p-2.5 rounded-xl">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">연간 단가표</h1>
            <p className="text-muted-foreground mt-0.5">
              {activeTab === 'equipment' ? 'SET 모델 및 구성품 단가를 조회합니다' : '설치 공사 항목별 단가를 조회합니다'}
            </p>
          </div>
        </div>

        {activeTab === 'equipment' && (
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm border-slate-200">
              총 {displayedTable.length}개 제품
            </Badge>
            <ExcelExportButton onClick={handleEquipmentExcelExport} disabled={displayedTable.length === 0} />
            <PriceTableDialog mode="add" onSave={handleAdd} />
          </div>
        )}
      </div>

      {/* ── 탭 전환 ── */}
      <div className="flex items-center gap-1 mb-5 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('equipment')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'equipment'
              ? 'bg-white text-teal-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Package className="h-4 w-4" />
          장비 단가
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('installation')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'installation'
              ? 'bg-white text-olive-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Hammer className="h-4 w-4" />
          설치비 단가
        </button>
      </div>

      {/* ══════ 장비 단가 탭 ══════ */}
      {activeTab === 'equipment' && (
      <>
      {/* 검색창 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="품목, 모델명, 평형으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-lg bg-white border-slate-200"
          />
        </div>
      </div>

      {/* 단가표 테이블 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* 테이블 헤더 */}
            <thead className="bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold w-12"></th>
                <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold">품목</th>
                <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold">SET 모델명</th>
                <th className="px-4 py-3 text-right text-xs text-slate-500 font-semibold">삼성 출하가</th>
                <th className="px-4 py-3 text-center text-xs text-slate-500 font-semibold">DC율</th>
                <th className="px-4 py-3 text-right text-xs text-slate-500 font-semibold">매입가</th>
                <th className="px-4 py-3 text-right text-xs text-slate-500 font-semibold">판매가 (VAT별도)</th>
                <th className="px-4 py-3 text-center text-xs text-slate-500 font-semibold w-24">관리</th>
              </tr>
            </thead>

            {/* 테이블 바디 */}
            <tbody>
              {displayedTable.map((row) => {
                const isExpanded = expandedRows.has(row.model)

                return (
                  <>
                    {/* SET 모델 행 */}
                    <tr
                      key={row.model}
                      className="border-b border-slate-200 transition-colors hover:bg-teal-50/40"
                    >
                      <td
                        className="px-4 py-3 cursor-pointer"
                        onClick={() => toggleRow(row.model)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-slate-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-500" />
                        )}
                      </td>
                      <td
                        className="px-4 py-3 cursor-pointer"
                        onClick={() => toggleRow(row.model)}
                      >
                        <span className="font-medium text-gray-900">
                          {row.category} {row.size}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 cursor-pointer"
                        onClick={() => toggleRow(row.model)}
                      >
                        <span className="font-mono text-sm text-gray-800">{row.model}</span>
                      </td>
                      <td
                        className="px-4 py-3 text-right cursor-pointer"
                        onClick={() => toggleRow(row.model)}
                      >
                        <span className="tabular-nums text-slate-500">
                          {row.listPrice > 0 ? formatPrice(row.listPrice) : '-'}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 text-center cursor-pointer"
                        onClick={() => toggleRow(row.model)}
                      >
                        <span className="text-sm font-semibold text-carrot-600">45%</span>
                      </td>
                      <td
                        className="px-4 py-3 text-right cursor-pointer"
                        onClick={() => toggleRow(row.model)}
                      >
                        <span className="tabular-nums font-semibold text-olive-600">
                          {row.listPrice > 0 ? formatPrice(Math.round(row.listPrice * 0.55)) : '-'}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 text-right cursor-pointer"
                        onClick={() => toggleRow(row.model)}
                      >
                        <span className="font-semibold text-teal-600">
                          {formatPrice(row.price)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <EditButton data={row} onSave={handleUpdate} />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(row.id, row.model)
                            }}
                            className="h-8 w-8 p-0 text-brick-500 hover:text-brick-700 hover:bg-brick-50 rounded-lg"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {/* 구성품 상세 정보 (확장 시 표시) */}
                    {isExpanded && (() => {
                      const sortedComponents = sortComponents(row.components)

                      return (
                        <tr key={`${row.model}-details`} className="bg-slate-50/60">
                          <td colSpan={8} className="px-4 py-4">
                            <div className="ml-8">
                              <div className="text-xs font-semibold text-slate-500 mb-3">
                                구성품 상세
                              </div>

                              {/* 구성품 테이블 */}
                              <table className="w-full border border-slate-200 rounded-lg overflow-hidden bg-white">
                                <thead className="bg-slate-50/80 border-b border-slate-200">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs text-slate-500 font-semibold">구성품</th>
                                    <th className="px-4 py-2 text-left text-xs text-slate-500 font-semibold">모델명</th>
                                    <th className="px-4 py-2 text-center text-xs text-slate-500 font-semibold">수량</th>
                                    <th className="px-4 py-2 text-right text-xs text-slate-500 font-semibold">삼성 출하가</th>
                                    <th className="px-4 py-2 text-center text-xs text-slate-500 font-semibold">DC율</th>
                                    <th className="px-4 py-2 text-right text-xs text-slate-500 font-semibold">매입가</th>
                                    <th className="px-4 py-2 text-right text-xs text-slate-500 font-semibold">판매가 (VAT별도)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sortedComponents.map((comp, idx) => (
                                    <tr key={idx} className="border-b border-slate-100 last:border-b-0 hover:bg-teal-50/40 transition-colors">
                                      <td className="px-4 py-2 text-sm text-gray-700">{comp.type}</td>
                                      <td className="px-4 py-2 text-sm font-mono text-gray-800">{comp.model}</td>
                                      <td className="px-4 py-2 text-sm text-center text-gray-700">{comp.quantity}개</td>
                                      <td className="px-4 py-2 text-sm text-right tabular-nums text-slate-500">
                                        {comp.unitPrice?.toLocaleString() || 0}원
                                      </td>
                                      <td className="px-4 py-2 text-sm text-center font-semibold text-carrot-600">
                                        45%
                                      </td>
                                      <td className="px-4 py-2 text-sm text-right tabular-nums font-semibold text-olive-600">
                                        {comp.unitPrice ? Math.round(comp.unitPrice * 0.55).toLocaleString() : 0}원
                                      </td>
                                      <td className="px-4 py-2 text-sm text-right font-semibold text-teal-600">
                                        {comp.salePrice.toLocaleString()}원
                                      </td>
                                    </tr>
                                  ))}
                                  {/* 합계 행 */}
                                  <tr className="bg-teal-50 border-t-2 border-teal-200">
                                    <td colSpan={3} className="px-4 py-2 text-sm font-semibold text-gray-800">
                                      합계
                                    </td>
                                    <td className="px-4 py-2 text-sm text-right font-bold text-slate-600">
                                      {row.components
                                        .reduce((sum: number, comp: any) => sum + (comp.unitPrice || 0), 0)
                                        .toLocaleString()}원
                                    </td>
                                    <td className="px-4 py-2 text-sm text-center font-bold text-carrot-600">
                                      45%
                                    </td>
                                    <td className="px-4 py-2 text-sm text-right font-bold text-olive-600">
                                      {Math.round(row.components
                                        .reduce((sum: number, comp: any) => sum + (comp.unitPrice || 0), 0) * 0.55)
                                        .toLocaleString()}원
                                    </td>
                                    <td className="px-4 py-2 text-sm text-right font-bold text-teal-600">
                                      {row.components
                                        .reduce((sum: number, comp: any) => sum + comp.salePrice, 0)
                                        .toLocaleString()}원
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )
                    })()}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 안내 문구 */}
      <div className="bg-teal-50 rounded-xl p-4 border border-teal-200 mt-6">
        <p className="text-sm text-teal-800 leading-relaxed">
          <strong>사용 방법</strong>
          <br />
          SET 모델 행을 클릭하면 구성품별 판매가를 확인할 수 있습니다.
          구성품 표시 순서: 실외기 - 실내기 - 자재박스 - 리모컨.
          스탠드형은 실외기/실내기/자재박스로, 벽걸이형은 실외기/실내기/자재박스/리모컨으로 구성됩니다.
          표시되는 판매가는 모두 VAT 별도 금액이며, 구성품 판매가 합계 = SET 판매가 입니다.
        </p>
      </div>
      </>
      )}

      {/* ══════ 설치비 단가 탭 ══════ */}
      {activeTab === 'installation' && (
        <div className="flex gap-6 items-start">
        {/* ── 좌측: 단가계약 설치비 ── */}
        <div className="space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-olive-500" />
          <span className="text-[13px] font-bold text-slate-700">단가계약 항목</span>
          <span className="text-[10px] text-olive-600 bg-olive-50 px-2 py-0.5 rounded-full font-medium">고정 단가</span>
        </div>
        <div className="max-w-[400px] space-y-5">

        {/* ── 신규 설치비 ── */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200/80 flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-teal-500" />
            <h3 className="text-[13px] font-bold text-slate-800">신규 설치비</h3>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '180px' }}>품목</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '130px' }}>모델명</th>
                <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '120px' }}>단가 (VAT별도)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {newInstallRows.map((row, i) => (
                <tr key={`ns-${i}`} className="hover:bg-teal-50/30 transition-colors">
                  <td className="px-5 py-2 font-semibold text-slate-700 border-r border-slate-100">{row.category}</td>
                  <td className="px-4 py-2 text-slate-600">{row.model}</td>
                  <td className="px-5 py-2 text-right font-semibold text-slate-800 tabular-nums">{row.price.toLocaleString()}원</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── 이전 설치비 ── */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200/80 flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-teal-500" />
            <h3 className="text-[13px] font-bold text-slate-800">이전 설치비</h3>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '180px' }}>품목</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '130px' }}>모델명</th>
                <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '120px' }}>단가 (VAT별도)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {relocationRows.map((row, i) => (
                <tr key={`os-${i}`} className="hover:bg-teal-50/30 transition-colors">
                  <td className="px-5 py-2 font-semibold text-slate-700 border-r border-slate-100">{row.category}</td>
                  <td className="px-4 py-2 text-slate-600">{row.model}</td>
                  <td className="px-5 py-2 text-right font-semibold text-slate-800 tabular-nums">{row.price.toLocaleString()}원</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── 추가 설치비 ── */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200/80 flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-olive-500" />
            <h3 className="text-[13px] font-bold text-slate-800">추가 설치비</h3>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '180px' }}>품목</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '130px' }}>모델명</th>
                <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '120px' }}>단가 (VAT별도)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {additionalRows.map((row, i) => (
                <tr key={`ex-${i}`} className="hover:bg-olive-50/30 transition-colors">
                  <td className="px-5 py-2 font-semibold text-slate-700 border-r border-slate-100">{row.category}</td>
                  <td className={`px-4 py-2 ${row.model === '-' ? 'text-slate-400' : 'text-slate-600'} ${row.category === '냉매관 설치' ? 'font-mono text-[11px]' : ''}`}>{row.model}</td>
                  <td className="px-5 py-2 text-right font-semibold text-slate-800 tabular-nums">{row.price.toLocaleString()}원</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── 반납 비용 ── */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200/80 flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-gold-500" />
            <h3 className="text-[13px] font-bold text-slate-800">반납 비용</h3>
            <span className="ml-auto text-[10px] text-slate-400 font-medium">신규기기 설치 동반 시 무료</span>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '180px' }}>품목</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '130px' }}>모델명</th>
                <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '120px' }}>단가 (VAT별도)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {returnRows.map((row, i) => (
                <tr key={`rt-${i}`} className="hover:bg-gold-50/30 transition-colors">
                  <td className="px-5 py-2 font-semibold text-slate-700 border-r border-slate-100">{row.category}</td>
                  <td className="px-4 py-2 text-slate-400">{row.model}</td>
                  <td className="px-5 py-2 text-right font-semibold text-slate-800 tabular-nums">{row.price.toLocaleString()}원</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 안내 */}
        <p className="text-[11px] text-slate-400 leading-relaxed">
          ※ 모든 단가는 VAT 별도 금액입니다. 배관은 m당 단가이며, 현장 조건에 따라 추가비용이 발생할 수 있습니다.
        </p>

        </div>
        </div>

        {/* ── 구분선 ── */}
        <div className="w-px self-stretch bg-slate-200 mx-1" />

        {/* ── 우측: 현장별 변동 비용 ── */}
        <div className="space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-gold-500" />
          <span className="text-[13px] font-bold text-slate-700">현장별 변동 항목</span>
          <span className="text-[10px] text-gold-600 bg-gold-50 px-2 py-0.5 rounded-full font-medium">현장별 상이</span>
        </div>
        <p className="text-[11px] text-gold-600/80 bg-gold-50/50 border border-gold-200/50 rounded-lg px-3 py-2 leading-relaxed">
          아래 항목은 현장 조건에 따라 금액이 달라집니다. 견적서 작성 시 현장 확인 후 별도 산출합니다.
        </p>
        <div className="flex gap-5 items-start">

        {/* ── 전기공사 ── */}
        <div className="bg-white rounded-xl border border-dashed border-gold-300/80 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gold-200/50 bg-gold-50/30 flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-teal-500" />
            <h3 className="text-[13px] font-bold text-slate-800">전기공사</h3>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '140px' }}>품목</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '140px' }}>모델명</th>
                <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '140px' }}>단가 (VAT별도)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {elecRows.map((row, i) => (
                <tr key={`elec-${i}`} className="hover:bg-teal-50/30 transition-colors">
                  <td className="px-2 py-1 border-r border-slate-100">
                    <input
                      type="text"
                      value={row.category}
                      onChange={(e) => handleElecChange(i, 'category', e.target.value)}
                      placeholder="품목 입력"
                      className="w-full text-[12px] font-semibold text-slate-700 bg-transparent border border-transparent rounded px-2 py-1 hover:border-slate-200 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-200 placeholder:text-slate-300"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={row.model}
                      onChange={(e) => handleElecChange(i, 'model', e.target.value)}
                      placeholder="모델명 입력"
                      className="w-full text-[12px] text-slate-600 bg-transparent border border-transparent rounded px-2 py-1 hover:border-slate-200 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-200 placeholder:text-slate-300"
                    />
                  </td>
                  <td className="px-5 py-2 text-right text-slate-300">-</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} className="px-5 py-2">
                  <button onClick={addElecRow} className="text-[11px] text-teal-500 hover:text-teal-700 font-medium transition-colors">+ 행 추가</button>
                  {savingElec && <span className="text-[10px] text-slate-400 ml-3">저장 중...</span>}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── 기타공사 ── */}
        <div className="bg-white rounded-xl border border-dashed border-gold-300/80 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gold-200/50 bg-gold-50/30 flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-carrot-500" />
            <h3 className="text-[13px] font-bold text-slate-800">기타공사</h3>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-slate-50/80">
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '140px' }}>품목</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '140px' }}>모델명</th>
                <th className="px-5 py-2.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider" style={{ width: '140px' }}>단가 (VAT별도)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {etcRows.map((row, i) => (
                <tr key={`etc-${i}`} className="hover:bg-carrot-50/30 transition-colors">
                  <td className="px-2 py-1 border-r border-slate-100">
                    <input
                      type="text"
                      value={row.category}
                      onChange={(e) => handleEtcChange(i, 'category', e.target.value)}
                      placeholder="품목 입력"
                      className="w-full text-[12px] font-semibold text-slate-700 bg-transparent border border-transparent rounded px-2 py-1 hover:border-slate-200 focus:outline-none focus:border-carrot-400 focus:ring-1 focus:ring-carrot-200 placeholder:text-slate-300"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      type="text"
                      value={row.model}
                      onChange={(e) => handleEtcChange(i, 'model', e.target.value)}
                      placeholder="모델명 입력"
                      className="w-full text-[12px] text-slate-600 bg-transparent border border-transparent rounded px-2 py-1 hover:border-slate-200 focus:outline-none focus:border-carrot-400 focus:ring-1 focus:ring-carrot-200 placeholder:text-slate-300"
                    />
                  </td>
                  <td className="px-5 py-2 text-right text-slate-300">-</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} className="px-5 py-2">
                  <button onClick={addEtcRow} className="text-[11px] text-carrot-500 hover:text-carrot-700 font-medium transition-colors">+ 행 추가</button>
                  {savingEtc && <span className="text-[10px] text-slate-400 ml-3">저장 중...</span>}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        </div>
        </div>
        </div>
      )}
    </div>
  )
}
