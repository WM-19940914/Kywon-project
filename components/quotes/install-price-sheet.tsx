/**
 * 설치비 단가표 Sheet (우측 Drawer)
 *
 * 견적서 작성 시 "설치비 단가표로 입력하기" 버튼을 누르면
 * 우측에서 슬라이드로 나타나는 설치비 단가표입니다.
 * 항목을 클릭하면 견적서 설치비 행에 자동 입력됩니다.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Hammer, Search, ArrowRight, Zap, Check } from 'lucide-react'
import { fetchInstallationPriceItems, type InstallationPriceItem } from '@/lib/supabase/dal'

/** 고정 단가 설치비 데이터 (단가계약 항목) */
const FIXED_INSTALL_COSTS = {
  new: [
    { category: '신규 설치비_스탠드형', model: '58평형 이상', price: 360000, unit: '식' },
    { category: '신규 설치비_스탠드형', model: '30평형 이상', price: 280000, unit: '식' },
    { category: '신규 설치비_스탠드형', model: '23평형', price: 150000, unit: '식' },
    { category: '신규 설치비_스탠드형', model: '23평형 미만', price: 130000, unit: '식' },
    { category: '신규 설치비_벽걸이형', model: '13평형', price: 60000, unit: '식' },
    { category: '신규 설치비_벽걸이형', model: '9평형', price: 60000, unit: '식' },
    { category: '신규 설치비_벽걸이형', model: '7평형', price: 60000, unit: '식' },
    { category: '신규 설치비_벽걸이형', model: '6평형', price: 60000, unit: '식' },
  ],
  relocation: [
    { category: '이전 설치비_스탠드형', model: '58평형 이상', price: 360000, unit: '식' },
    { category: '이전 설치비_스탠드형', model: '30평형 이상', price: 300000, unit: '식' },
    { category: '이전 설치비_스탠드형', model: '23평형', price: 150000, unit: '식' },
    { category: '이전 설치비_스탠드형', model: '23평형 미만', price: 130000, unit: '식' },
    { category: '이전 설치비_벽걸이형', model: '13평형', price: 60000, unit: '식' },
    { category: '이전 설치비_벽걸이형', model: '9평형', price: 60000, unit: '식' },
    { category: '이전 설치비_벽걸이형', model: '7평형', price: 60000, unit: '식' },
    { category: '이전 설치비_벽걸이형', model: '6평형', price: 60000, unit: '식' },
  ],
  additional: [
    { category: '냉매관 설치', model: '냉매관 Φ22.09mm', price: 17000, unit: 'm' },
    { category: '냉매관 설치', model: '냉매관 Φ19.05mm', price: 14000, unit: 'm' },
    { category: '냉매관 설치', model: '냉매관 Φ15.88mm_K', price: 13000, unit: 'm' },
    { category: '냉매관 설치', model: '냉매관 Φ12.70mm', price: 9000, unit: 'm' },
    { category: '냉매관 설치', model: '냉매관 Φ09.52mm', price: 7900, unit: 'm' },
    { category: '냉매관 설치', model: '냉매관 Φ06.35mm', price: 2500, unit: 'm' },
    { category: '실내전원통신', model: '-', price: 7500, unit: '식' },
    { category: '배수펌프', model: '10m', price: 100000, unit: 'EA' },
    { category: '실외기거치대', model: '앵글', price: 100000, unit: 'EA' },
    { category: '실외기거치대', model: '일자받침대', price: 28000, unit: 'EA' },
  ],
  return: [
    { category: '반납 보관비', model: '-', price: 100000, unit: '식' },
    { category: '반납 폐기비', model: '-', price: 100000, unit: '식' },
  ],
}

/** 선택 콜백에 넘길 데이터 */
interface InstallSelectItem {
  product: string   // 품목
  model: string     // 모델명
  price: number     // 단가 (0이면 현장별 상이)
  unit: string      // 단위
}

interface InstallPriceSheetProps {
  onSelect: (item: InstallSelectItem) => void
}

export function InstallPriceSheet({ onSelect }: InstallPriceSheetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'fixed' | 'variable'>('fixed')
  const [addedCount, setAddedCount] = useState(0)  // 이번 세션에서 추가한 항목 수
  const [lastAdded, setLastAdded] = useState('')    // 마지막 추가한 항목명
  const [clickedKey, setClickedKey] = useState<string | null>(null) // 클릭 시 초록 하이라이트 피드백
  const [elecItems, setElecItems] = useState<InstallationPriceItem[]>([])
  const [etcItems, setEtcItems] = useState<InstallationPriceItem[]>([])

  // 클릭 피드백: 0.6초 뒤 하이라이트 해제
  const flashItem = useCallback((key: string) => {
    setClickedKey(key)
    setTimeout(() => setClickedKey(null), 600)
  }, [])

  // DB에서 전기공사/기타공사 불러오기 + 카운트 리셋
  useEffect(() => {
    if (isOpen) {
      fetchInstallationPriceItems('electric').then(setElecItems)
      fetchInstallationPriceItems('etc').then(setEtcItems)
      setAddedCount(0)
      setLastAdded('')
    }
  }, [isOpen])

  // 검색 필터 함수
  const matchSearch = (category: string, model: string) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return category.toLowerCase().includes(term) || model.toLowerCase().includes(term)
  }

  // 고정 단가 항목 클릭 (시트 안 닫힘, 연속 선택 가능)
  const handleFixedClick = (key: string, item: { category: string; model: string; price: number; unit: string }) => {
    onSelect({ product: item.category, model: item.model, price: item.price, unit: item.unit })
    setAddedCount(prev => prev + 1)
    setLastAdded(`${item.category} ${item.model !== '-' ? item.model : ''}`.trim())
    flashItem(key)
  }

  // 변동 항목 클릭 (단가 0, 시트 안 닫힘)
  const handleVariableClick = (key: string, item: InstallationPriceItem) => {
    onSelect({ product: item.category, model: item.model, price: 0, unit: '식' })
    setAddedCount(prev => prev + 1)
    setLastAdded(`${item.category} ${item.model || ''}`.trim())
    flashItem(key)
  }

  /** 고정 단가 그룹 렌더링 */
  const renderFixedGroup = (title: string, color: string, items: typeof FIXED_INSTALL_COSTS.new) => {
    const filtered = items.filter(i => matchSearch(i.category, i.model))
    if (filtered.length === 0) return null
    return (
      <div key={title}>
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
          <span className="text-xs font-bold text-slate-600">{title}</span>
          <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">{filtered.length}건</span>
        </div>
        <div className="space-y-1">
          {filtered.map((item, i) => {
            const key = `${title}-${i}`
            const isClicked = clickedKey === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleFixedClick(key, item)}
                className={`w-full text-left group rounded-lg border px-4 py-2.5 active:scale-[0.99] transition-all duration-150 cursor-pointer ${
                  isClicked
                    ? 'border-emerald-400 bg-emerald-50 shadow-sm'
                    : 'border-gray-150 bg-white hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-slate-700">{item.category}</span>
                      {item.model !== '-' && (
                        <span className="text-[11px] text-slate-500">{item.model}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <div className="text-right">
                      <span className="text-[12px] font-bold text-emerald-700">
                        {item.price.toLocaleString()}원
                      </span>
                      <span className="text-[10px] text-slate-400 ml-1">/ {item.unit}</span>
                    </div>
                    {isClicked ? (
                      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <ArrowRight className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  /** 변동 항목 그룹 렌더링 */
  const renderVariableGroup = (title: string, color: string, items: InstallationPriceItem[]) => {
    const filtered = items.filter(i => matchSearch(i.category, i.model))
    if (filtered.length === 0) return null
    return (
      <div key={title}>
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
          <span className="text-xs font-bold text-slate-600">{title}</span>
          <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">현장별 상이</span>
        </div>
        <div className="space-y-1">
          {filtered.map((item, i) => {
            const key = `var-${title}-${i}`
            const isClicked = clickedKey === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleVariableClick(key, item)}
                className={`w-full text-left group rounded-lg border border-dashed px-4 py-2.5 active:scale-[0.99] transition-all duration-150 cursor-pointer ${
                  isClicked
                    ? 'border-amber-400 bg-amber-50 shadow-sm'
                    : 'border-amber-200 bg-white hover:border-amber-400 hover:bg-amber-50/50 hover:shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-slate-700">{item.category}</span>
                      {item.model && (
                        <span className="text-[11px] text-slate-500">{item.model}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <span className="text-[11px] text-amber-500 font-medium">직접 입력</span>
                    {isClicked ? (
                      <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <ArrowRight className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Hammer className="h-4 w-4" />
          설치비 단가표로 입력하기
        </Button>
      </SheetTrigger>

      <SheetContent className="w-[35vw] min-w-[480px] p-0 overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-b from-slate-50 to-white">
          <SheetHeader>
            <SheetTitle className="text-xl font-bold text-gray-900">
              설치비 단가표
            </SheetTitle>
            <p className="text-sm text-gray-500 mt-1">
              항목을 클릭하면 견적서 설치비 행에 자동 입력됩니다
            </p>
          </SheetHeader>

          {/* 검색 */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 placeholder:text-gray-400"
              placeholder="품목, 모델명으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* 탭 토글 */}
          <div className="flex mt-4 bg-slate-100 rounded-lg p-1 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('fixed')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[12px] font-semibold transition-all ${
                activeTab === 'fixed'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              단가계약 항목
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === 'fixed' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>고정</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('variable')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[12px] font-semibold transition-all ${
                activeTab === 'variable'
                  ? 'bg-white text-amber-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              전기 · 기타공사
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeTab === 'variable' ? 'bg-amber-50 text-amber-600' : 'bg-slate-200 text-slate-400'}`}>변동</span>
            </button>
          </div>
        </div>

        {/* 리스트 영역 (스크롤) */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* 고정 단가 탭 */}
          {activeTab === 'fixed' && (
            <>
              {renderFixedGroup('신규 설치비', 'bg-blue-500', FIXED_INSTALL_COSTS.new)}
              {renderFixedGroup('이전 설치비', 'bg-violet-500', FIXED_INSTALL_COSTS.relocation)}
              {renderFixedGroup('추가 설치비', 'bg-emerald-500', FIXED_INSTALL_COSTS.additional)}
              {renderFixedGroup('반납 비용', 'bg-amber-500', FIXED_INSTALL_COSTS.return)}
            </>
          )}

          {/* 변동 비용 탭 */}
          {activeTab === 'variable' && (
            <>
              <p className="text-[11px] text-amber-600/80 bg-amber-50/50 border border-amber-200/50 rounded-lg px-3 py-2 leading-relaxed">
                아래 항목은 현장 조건에 따라 금액이 달라집니다. 품목만 자동 입력되며, 단가는 직접 입력하세요.
              </p>
              {renderVariableGroup('전기공사', 'bg-sky-500', elecItems)}
              {renderVariableGroup('기타공사', 'bg-orange-500', etcItems)}
            </>
          )}
        </div>

        {/* 하단: 추가 건수 표시 + 완료 버튼 */}
        <div className="border-t bg-slate-50 px-6 py-3">
          {addedCount > 0 ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                  <span className="text-sm font-bold text-emerald-700">{addedCount}건</span>
                  <span className="text-xs text-slate-500">추가됨</span>
                </div>
                {lastAdded && (
                  <span className="text-[11px] text-slate-400 truncate">
                    — {lastAdded}
                  </span>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => setIsOpen(false)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shrink-0 ml-3"
              >
                <Check className="h-3.5 w-3.5" />
                완료
              </Button>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <Zap className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-gray-500 leading-relaxed">
                {activeTab === 'fixed'
                  ? '항목 클릭 시 품목·모델명·단가가 자동 입력됩니다. 여러 항목을 연속으로 선택할 수 있습니다.'
                  : '항목 클릭 시 품목·모델명만 입력됩니다. 단가는 현장 확인 후 직접 입력하세요.'
                }
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
