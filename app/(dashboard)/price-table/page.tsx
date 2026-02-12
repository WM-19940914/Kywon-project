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
import { BookOpen, ChevronDown, ChevronRight, Search, Loader2, Plus, Trash2, Pencil } from 'lucide-react'
import { fetchPriceTable } from '@/lib/supabase/dal'
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
            <div className={`h-10 w-10 rounded-xl ${mode === 'add' ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-gradient-to-br from-amber-500 to-amber-600'} flex items-center justify-center shadow-md`}>
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
          <div className="space-y-4 p-5 border-2 border-blue-100 rounded-xl bg-gradient-to-br from-blue-50 to-white">
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 bg-blue-500 rounded-full"></div>
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
                  className="h-10 border-slate-200 focus:border-blue-500 rounded-lg"
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
                  className="h-10 border-slate-200 focus:border-blue-500 rounded-lg"
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
                  className="h-10 font-mono border-slate-200 focus:border-blue-500 rounded-lg"
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
                  className="h-10 border-slate-200 focus:border-blue-500 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* 구성품 정보 */}
          <div className="space-y-4 p-5 border-2 border-emerald-100 rounded-xl bg-gradient-to-br from-emerald-50 to-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-1 bg-emerald-500 rounded-full"></div>
                <h3 className="font-bold text-base text-gray-800">구성품 정보</h3>
              </div>
              <Button size="sm" onClick={addComponent} className="bg-emerald-600 hover:bg-emerald-700 rounded-lg">
                <Plus className="h-4 w-4 mr-1.5" />
                구성품 추가
              </Button>
            </div>

            <div className="space-y-3">
              {components.map((comp, idx) => (
                <div key={idx} className="p-4 border-2 border-slate-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-emerald-700">#{idx + 1}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-700">구성품</span>
                    </div>
                    {components.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeComponent(idx)}
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
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
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-amber-600 hover:bg-amber-700'
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
        className="h-8 w-8 p-0 text-amber-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg"
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

  // 장비 추가 핸들러 (임시 비활성화 - DB 구조 변경으로 추후 재구현 예정)
  const handleAdd = async (_data: any) => {
    showAlert('장비 추가 기능은 준비 중입니다.', 'info')
    // const created = await createPriceTableRow(data)
    // if (created) {
    //   await refreshPriceTable()
    //   showAlert('장비가 추가되었습니다!', 'success')
    // } else {
    //   showAlert('장비 추가에 실패했습니다.', 'error')
    // }
  }

  // 장비 수정 핸들러 (임시 비활성화 - DB 구조 변경으로 추후 재구현 예정)
  const handleUpdate = async (_data: any) => {
    showAlert('장비 수정 기능은 준비 중입니다.', 'info')
    // const success = await updatePriceTableRow(data.id, data)
    // if (success) {
    //   await refreshPriceTable()
    //   showAlert('장비가 수정되었습니다!', 'success')
    // } else {
    //   showAlert('장비 수정에 실패했습니다.', 'error')
    // }
  }

  // 장비 삭제 핸들러 (임시 비활성화 - DB 구조 변경으로 추후 재구현 예정)
  const handleDelete = async (_id: string, model: string) => {
    showAlert(`"${model}" 삭제 기능은 준비 중입니다.`, 'info')
    // const confirmed = await showConfirm(`"${model}" 제품을 삭제하시겠습니까?\n구성품도 함께 삭제됩니다.`)
    // if (confirmed) {
    //   const success = await deletePriceTableRow(id)
    //   if (success) {
    //     await refreshPriceTable()
    //     showAlert('장비가 삭제되었습니다!', 'success')
    //   } else {
    //     showAlert('장비 삭제에 실패했습니다.', 'error')
    //   }
    // }
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
          <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">연간 단가표</h1>
            <p className="text-muted-foreground mt-0.5">SET 모델 및 구성품 단가를 조회합니다</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm border-slate-200">
            총 {displayedTable.length}개 제품
          </Badge>
          <PriceTableDialog mode="add" onSave={handleAdd} />
        </div>
      </div>

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
                      className={`border-b border-slate-200 transition-colors ${
                        row.model === 'AR60F07C14WS'
                          ? 'bg-red-50 hover:bg-red-100'
                          : 'hover:bg-blue-50/40'
                      }`}
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
                        {row.model === 'AR60F07C14WS' && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500 text-white">가격확인필요</span>
                        )}
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
                        <span className="text-sm font-semibold text-orange-600">45%</span>
                      </td>
                      <td
                        className="px-4 py-3 text-right cursor-pointer"
                        onClick={() => toggleRow(row.model)}
                      >
                        <span className="tabular-nums font-semibold text-emerald-600">
                          {row.listPrice > 0 ? formatPrice(Math.round(row.listPrice * 0.55)) : '-'}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 text-right cursor-pointer"
                        onClick={() => toggleRow(row.model)}
                      >
                        <span className="font-semibold text-blue-600">
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
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
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
                                    <tr key={idx} className="border-b border-slate-100 last:border-b-0 hover:bg-blue-50/40 transition-colors">
                                      <td className="px-4 py-2 text-sm text-gray-700">{comp.type}</td>
                                      <td className="px-4 py-2 text-sm font-mono text-gray-800">{comp.model}</td>
                                      <td className="px-4 py-2 text-sm text-center text-gray-700">{comp.quantity}개</td>
                                      <td className="px-4 py-2 text-sm text-right tabular-nums text-slate-500">
                                        {comp.unitPrice?.toLocaleString() || 0}원
                                      </td>
                                      <td className="px-4 py-2 text-sm text-center font-semibold text-orange-600">
                                        45%
                                      </td>
                                      <td className="px-4 py-2 text-sm text-right tabular-nums font-semibold text-emerald-600">
                                        {comp.unitPrice ? Math.round(comp.unitPrice * 0.55).toLocaleString() : 0}원
                                      </td>
                                      <td className="px-4 py-2 text-sm text-right font-semibold text-blue-600">
                                        {comp.salePrice.toLocaleString()}원
                                      </td>
                                    </tr>
                                  ))}
                                  {/* 합계 행 */}
                                  <tr className="bg-blue-50 border-t-2 border-blue-200">
                                    <td colSpan={3} className="px-4 py-2 text-sm font-semibold text-gray-800">
                                      합계
                                    </td>
                                    <td className="px-4 py-2 text-sm text-right font-bold text-slate-600">
                                      {row.components
                                        .reduce((sum: number, comp: any) => sum + (comp.unitPrice || 0), 0)
                                        .toLocaleString()}원
                                    </td>
                                    <td className="px-4 py-2 text-sm text-center font-bold text-orange-600">
                                      45%
                                    </td>
                                    <td className="px-4 py-2 text-sm text-right font-bold text-emerald-600">
                                      {Math.round(row.components
                                        .reduce((sum: number, comp: any) => sum + (comp.unitPrice || 0), 0) * 0.55)
                                        .toLocaleString()}원
                                    </td>
                                    <td className="px-4 py-2 text-sm text-right font-bold text-blue-600">
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
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 mt-6">
        <p className="text-sm text-blue-800 leading-relaxed">
          <strong>사용 방법</strong>
          <br />
          SET 모델 행을 클릭하면 구성품별 판매가를 확인할 수 있습니다.
          구성품 표시 순서: 실외기 - 실내기 - 자재박스 - 리모컨.
          스탠드형은 실외기/실내기/자재박스로, 벽걸이형은 실외기/실내기/자재박스/리모컨으로 구성됩니다.
          표시되는 판매가는 모두 VAT 별도 금액이며, 구성품 판매가 합계 = SET 판매가 입니다.
        </p>
      </div>
    </div>
  )
}
