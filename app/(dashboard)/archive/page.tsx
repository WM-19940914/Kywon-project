'use client'

/**
 * 과거 자료 아카이브 페이지
 *
 * 기존 사이트에서 이전한 2020~2025년 발주 데이터를 조회합니다.
 * - 연도: 탭 버튼으로 한 번에 필터
 * - 사업장: 자동완성 검색으로 빠른 필터
 * - 같은 발주번호+사업장의 여러 유형을 한 행으로 그룹핑
 * - 행 클릭 시 바로 아래에 인라인 상세
 */

import { useState, useMemo, useCallback, Fragment, useRef, useEffect } from 'react'
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  X,
  MapPin,
  Phone,
  User,
  Calendar,
  Building2,
  ArrowUpDown,
  Hash,
} from 'lucide-react'
import archiveRaw from '@/lib/archive-data.json'

/* ───────────── 타입 ───────────── */

interface ArchiveOrder {
  no: number | null
  orderNumber: string
  documentName: string
  sender: string
  companyName: string
  orderDate: string
  orderType: string
  productModel: string
  quantity: number
  siteName: string
  zipCode: string
  address1: string
  address2: string
  manager: string
  title: string
  phone: string
  mobile: string
  note: string
  registeredDate: string
  status: string
  note2: string
}

interface OrderGroup {
  key: string
  items: ArchiveOrder[]
  orderNumber: string
  documentName: string
  sender: string
  orderDate: string
  siteName: string
  companyName: string
  manager: string
  title: string
  phone: string
  mobile: string
  address1: string
  address2: string
  zipCode: string
  registeredDate: string
  totalQty: number
  orderTypes: string[]
  statuses: string[]
  minNo: number
}

type SortKey = 'no' | 'orderDate' | 'sender' | 'siteName' | 'status'
type SortDir = 'asc' | 'desc'

/* ───────────── 상수 ───────────── */

const rawData: ArchiveOrder[] = archiveRaw as ArchiveOrder[]

const TYPE_COLORS: Record<string, string> = {
  '신규설치': 'bg-blue-100 text-blue-700 border-blue-200',
  '반납폐기': 'bg-red-100 text-red-700 border-red-200',
  '이전설치': 'bg-purple-100 text-purple-700 border-purple-200',
  '철거보관': 'bg-amber-100 text-amber-700 border-amber-200',
  '재고설치': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  '사전견적': 'bg-gray-100 text-gray-600 border-gray-200',
}

const STATUS_COLORS: Record<string, string> = {
  '완료': 'bg-green-100 text-green-700 border-green-200',
  '취소': 'bg-red-100 text-red-700 border-red-200',
  '보류': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  '처리중': 'bg-blue-100 text-blue-700 border-blue-200',
  '접수': 'bg-sky-100 text-sky-700 border-sky-200',
}

const SENDER_COLORS: Record<string, string> = {
  '구몬': 'bg-orange-100 text-orange-700',
  '교육플랫폼': 'bg-indigo-100 text-indigo-700',
  'Wells 영업': 'bg-teal-100 text-teal-700',
  'Wells 서비스': 'bg-cyan-100 text-cyan-700',
  '기타': 'bg-gray-100 text-gray-600',
}

const PAGE_SIZE_OPTIONS = [20, 50, 100]

/* ───────────── 유틸 ───────────── */

function extractYear(dateStr: string): string {
  if (!dateStr) return ''
  return String(dateStr).substring(0, 4)
}

function buildGroups(orders: ArchiveOrder[]): OrderGroup[] {
  const map = new Map<string, ArchiveOrder[]>()

  orders.forEach(row => {
    const base = row.orderNumber || row.documentName || `__solo_${row.no}`
    const key = `${base}|||${row.siteName || ''}`
    const arr = map.get(key)
    if (arr) arr.push(row)
    else map.set(key, [row])
  })

  const groups: OrderGroup[] = []
  map.forEach((items, key) => {
    const first = items[0]
    const typeSet = new Set<string>()
    const statusSet = new Set<string>()
    let totalQty = 0
    let minNo = Infinity

    items.forEach(item => {
      if (item.orderType) typeSet.add(item.orderType)
      if (item.status) statusSet.add(item.status)
      totalQty += item.quantity || 0
      if (item.no != null && item.no < minNo) minNo = item.no
    })

    groups.push({
      key, items,
      orderNumber: first.orderNumber, documentName: first.documentName,
      sender: first.sender, orderDate: first.orderDate,
      siteName: first.siteName, companyName: first.companyName,
      manager: first.manager, title: first.title,
      phone: first.phone, mobile: first.mobile,
      address1: first.address1, address2: first.address2,
      zipCode: first.zipCode, registeredDate: first.registeredDate,
      totalQty, orderTypes: Array.from(typeSet), statuses: Array.from(statusSet),
      minNo: minNo === Infinity ? 9999 : minNo,
    })
  })

  return groups
}

/* ───────────── 메인 ───────────── */

export default function ArchivePage() {
  const [search, setSearch] = useState('')
  const [yearFilter, setYearFilter] = useState<string>('all')
  const [siteFilter, setSiteFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [senderFilter, setSenderFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showMoreFilters, setShowMoreFilters] = useState(false)

  const [sortKey, setSortKey] = useState<SortKey>('no')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  // 사업장 자동완성
  const [siteInput, setSiteInput] = useState('')
  const [showSiteSuggestions, setShowSiteSuggestions] = useState(false)
  const siteInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // 바깥 클릭 시 자동완성 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        siteInputRef.current && !siteInputRef.current.contains(e.target as Node)
      ) {
        setShowSiteSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* ─── 필터 옵션 ─── */
  const filterOptions = useMemo(() => {
    const years = new Set<string>()
    const types = new Set<string>()
    const senders = new Set<string>()
    const statuses = new Set<string>()
    const sites = new Set<string>()

    rawData.forEach(d => {
      const y = extractYear(d.orderDate)
      if (y && y.match(/^20/)) years.add(y)
      if (d.orderType) types.add(d.orderType)
      if (d.sender) senders.add(d.sender)
      if (d.status) statuses.add(d.status)
      if (d.siteName) sites.add(d.siteName)
    })

    return {
      years: Array.from(years).sort().reverse(),
      types: Array.from(types).sort(),
      senders: Array.from(senders).sort(),
      statuses: Array.from(statuses).sort(),
      sites: Array.from(sites).sort(),
    }
  }, [])

  /* 사업장 자동완성 목록 */
  const siteSuggestions = useMemo(() => {
    if (!siteInput.trim()) return []
    const q = siteInput.trim().toLowerCase()
    return filterOptions.sites.filter(s => s.toLowerCase().includes(q)).slice(0, 8)
  }, [siteInput, filterOptions.sites])

  /* ─── 필터 → 그룹핑 → 정렬 ─── */
  const groups = useMemo(() => {
    let rows = rawData

    if (yearFilter !== 'all') rows = rows.filter(d => extractYear(d.orderDate) === yearFilter)
    if (typeFilter !== 'all') rows = rows.filter(d => d.orderType === typeFilter)
    if (senderFilter !== 'all') rows = rows.filter(d => d.sender === senderFilter)
    if (statusFilter !== 'all') rows = rows.filter(d => d.status === statusFilter)
    if (siteFilter) rows = rows.filter(d => d.siteName === siteFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter(d =>
        d.documentName.toLowerCase().includes(q) ||
        d.orderNumber.toLowerCase().includes(q) ||
        d.siteName.toLowerCase().includes(q) ||
        d.address1.toLowerCase().includes(q) ||
        d.address2.toLowerCase().includes(q) ||
        d.manager.toLowerCase().includes(q) ||
        d.companyName.toLowerCase().includes(q) ||
        d.productModel.toLowerCase().includes(q) ||
        d.note.toLowerCase().includes(q)
      )
    }

    const grouped = buildGroups(rows)

    grouped.sort((a, b) => {
      let va: string | number = ''
      let vb: string | number = ''
      switch (sortKey) {
        case 'no': va = a.minNo; vb = b.minNo; break
        case 'orderDate': va = a.orderDate; vb = b.orderDate; break
        case 'sender': va = a.sender; vb = b.sender; break
        case 'siteName': va = a.siteName; vb = b.siteName; break
        case 'status': va = a.statuses[0] || ''; vb = b.statuses[0] || ''; break
      }
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va
      const sa = String(va); const sb = String(vb)
      return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa)
    })

    return grouped
  }, [search, yearFilter, siteFilter, typeFilter, senderFilter, statusFilter, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(groups.length / pageSize))
  const safePageNum = Math.min(page, totalPages)
  const paged = groups.slice((safePageNum - 1) * pageSize, safePageNum * pageSize)

  const stats = useMemo(() => {
    const totalQty = groups.reduce((s, g) => s + g.totalQty, 0)
    const totalItems = groups.reduce((s, g) => s + g.items.length, 0)
    const byType: Record<string, number> = {}
    groups.forEach(g => g.items.forEach(item => {
      const t = item.orderType || '기타'
      byType[t] = (byType[t] || 0) + 1
    }))
    return { groupCount: groups.length, totalItems, totalQty, byType }
  }, [groups])

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }, [sortKey])

  const resetFilters = () => {
    setSearch(''); setYearFilter('all'); setSiteFilter(''); setSiteInput('')
    setTypeFilter('all'); setSenderFilter('all'); setStatusFilter('all')
    setPage(1)
  }

  const hasActiveFilter = yearFilter !== 'all' || siteFilter !== '' || typeFilter !== 'all' || senderFilter !== 'all' || statusFilter !== 'all' || search.trim() !== ''
  const hasMoreFilter = typeFilter !== 'all' || senderFilter !== 'all' || statusFilter !== 'all'

  const selectSite = (site: string) => {
    setSiteFilter(site); setSiteInput(site); setShowSiteSuggestions(false); setPage(1)
  }

  const clearSite = () => {
    setSiteFilter(''); setSiteInput(''); setPage(1)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* ────── 헤더 ────── */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            과거 자료 아카이브
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            기존 사이트 발주 데이터 · 2020년 ~ 2025년 · 총 {rawData.length.toLocaleString()}건
          </p>
        </div>

        {/* ────── 연도 탭 ────── */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 mr-1">연도</span>
          {['all', ...filterOptions.years].map(y => (
            <button
              key={y}
              onClick={() => { setYearFilter(y); setPage(1) }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                yearFilter === y
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600'
              }`}
            >
              {y === 'all' ? '전체' : `${y}년`}
            </button>
          ))}
        </div>

        {/* ────── 검색 + 사업장 필터 ────── */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* 통합 검색 */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="문서명, 주소, 담당자, 모델명 검색..."
                className="w-full pl-10 pr-10 py-2.5 text-sm border border-gray-200 rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                           placeholder:text-gray-400"
              />
              {search && (
                <button onClick={() => { setSearch(''); setPage(1) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* 사업장 검색 (자동완성) */}
            <div className="relative w-full sm:w-72">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={siteInputRef}
                type="text"
                value={siteInput}
                onChange={e => {
                  setSiteInput(e.target.value)
                  setShowSiteSuggestions(true)
                  if (!e.target.value.trim()) { setSiteFilter(''); setPage(1) }
                }}
                onFocus={() => { if (siteInput.trim()) setShowSiteSuggestions(true) }}
                placeholder="사업장 검색..."
                className={`w-full pl-10 pr-10 py-2.5 text-sm border rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400
                           placeholder:text-gray-400 ${
                             siteFilter ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200'
                           }`}
              />
              {(siteInput || siteFilter) && (
                <button onClick={clearSite}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* 자동완성 드롭다운 */}
              {showSiteSuggestions && siteSuggestions.length > 0 && (
                <div ref={suggestionsRef}
                  className="absolute z-50 top-full mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg max-h-60 overflow-y-auto">
                  {siteSuggestions.map(site => (
                    <button
                      key={site}
                      onClick={() => selectSite(site)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0"
                    >
                      <span className="text-gray-800">{site}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 추가 필터 토글 */}
            <button
              onClick={() => setShowMoreFilters(v => !v)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all whitespace-nowrap ${
                showMoreFilters || hasMoreFilter
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <Filter className="w-4 h-4" />
              필터
              {hasMoreFilter && (
                <span className="bg-blue-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {[typeFilter, senderFilter, statusFilter].filter(f => f !== 'all').length}
                </span>
              )}
            </button>

            {hasActiveFilter && (
              <button onClick={resetFilters}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-sm text-red-600 hover:bg-red-50 whitespace-nowrap">
                <X className="w-3.5 h-3.5" />
                초기화
              </button>
            )}
          </div>

          {/* 활성 사업장 필터 뱃지 */}
          {siteFilter && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-gray-500">사업장:</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                <Building2 className="w-3 h-3" />
                {siteFilter}
                <button onClick={clearSite} className="hover:text-blue-600">
                  <X className="w-3 h-3" />
                </button>
              </span>
            </div>
          )}

          {/* 추가 필터 패널 */}
          {showMoreFilters && (
            <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-3">
              <FilterSelect label="발주유형" value={typeFilter} onChange={v => { setTypeFilter(v); setPage(1) }}
                options={filterOptions.types.map(t => ({ value: t, label: t }))} />
              <FilterSelect label="발신(조직)" value={senderFilter} onChange={v => { setSenderFilter(v); setPage(1) }}
                options={filterOptions.senders.map(s => ({ value: s, label: s }))} />
              <FilterSelect label="상태" value={statusFilter} onChange={v => { setStatusFilter(v); setPage(1) }}
                options={filterOptions.statuses.map(s => ({ value: s, label: s }))} />
            </div>
          )}
        </div>

        {/* ────── 통계 ────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="현장 수" value={stats.groupCount} />
          <StatCard label="총 건수" value={stats.totalItems} sub="(개별 유형 기준)" />
          <StatCard label="총 수량" value={stats.totalQty} />
          {Object.entries(stats.byType).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([type, count]) => (
            <StatCard key={type} label={type} value={count} />
          ))}
        </div>

        {/* ────── 테이블 ────── */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200">
                  <SortTh label="No" sortKey="no" currentKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-16" />
                  <SortTh label="발주일" sortKey="orderDate" currentKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-24" />
                  <SortTh label="발신" sortKey="sender" currentKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-24" />
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 min-w-[120px]">유형</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 min-w-[160px]">문서번호</th>
                  <SortTh label="사업장" sortKey="siteName" currentKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="min-w-[160px]" />
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 min-w-[250px]">문서명</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 min-w-[140px]">담당자</th>
                  <SortTh label="상태" sortKey="status" currentKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-16 text-center" />
                </tr>
              </thead>
              <tbody>
                {paged.map((group, idx) => {
                  const isExpanded = expandedKey === group.key
                  return (
                    <Fragment key={group.key}>
                      <tr
                        onClick={() => setExpandedKey(isExpanded ? null : group.key)}
                        className={`cursor-pointer transition-colors border-b ${
                          isExpanded
                            ? 'bg-blue-50/60 border-blue-200'
                            : `${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} border-gray-100 hover:bg-blue-50/30`
                        }`}
                      >
                        <td className="px-3 py-2.5 text-xs text-gray-400 font-mono">
                          {group.minNo < 9999 ? group.minNo : '-'}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap">
                          {group.orderDate || '-'}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${SENDER_COLORS[group.sender] || 'bg-gray-100 text-gray-600'}`}>
                            {group.sender || '-'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {group.orderTypes.map(type => (
                              <span key={type} className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-medium leading-tight ${TYPE_COLORS[type] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                {type}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-500 max-w-[200px] truncate" title={group.orderNumber}>
                          {group.orderNumber || '-'}
                        </td>
                        {/* 사업장 — 클릭하면 해당 사업장으로 필터 */}
                        <td className="px-3 py-2.5 text-xs font-medium text-gray-900 max-w-[200px] truncate" title={group.siteName}>
                          <button
                            onClick={(e) => { e.stopPropagation(); selectSite(group.siteName) }}
                            className="hover:text-blue-600 hover:underline text-left truncate max-w-full"
                            title={`"${group.siteName}" 필터`}
                          >
                            {group.siteName || '-'}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 max-w-[300px] truncate" title={group.documentName}>
                          {group.documentName || '-'}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">
                          <div className="truncate">{group.manager || '-'}{group.title ? ` (${group.title})` : ''}</div>
                          {(group.mobile || group.phone) && (
                            <div className="text-[10px] text-gray-400 truncate">{group.mobile || group.phone}</div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {group.statuses.map(st => (
                            <span key={st} className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-medium ${STATUS_COLORS[st] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                              {st}
                            </span>
                          ))}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="p-0">
                            <InlineDetail group={group} onClose={() => setExpandedKey(null)} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                {paged.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-16 text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <Search className="w-8 h-8 opacity-30" />
                        <p className="text-sm">검색 결과가 없습니다</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ────── 페이지네이션 ────── */}
        {groups.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white rounded-xl border border-gray-200/80 shadow-sm px-4 py-3">
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>
                {((safePageNum - 1) * pageSize + 1).toLocaleString()} - {Math.min(safePageNum * pageSize, groups.length).toLocaleString()}
                {' '}/ {groups.length.toLocaleString()}개 현장
              </span>
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
                className="px-2 py-1 border border-gray-200 rounded-md text-xs focus:outline-none">
                {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}개씩</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <PageBtn onClick={() => setPage(1)} disabled={safePageNum <= 1}><ChevronsLeft className="w-4 h-4" /></PageBtn>
              <PageBtn onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePageNum <= 1}><ChevronLeft className="w-4 h-4" /></PageBtn>
              {generatePageNumbers(safePageNum, totalPages).map((pn, i) =>
                pn === '...' ? (
                  <span key={`dot-${i}`} className="px-1 text-xs text-gray-400">...</span>
                ) : (
                  <button key={pn} onClick={() => setPage(Number(pn))}
                    className={`min-w-[32px] h-8 rounded-md text-xs font-medium transition-colors ${
                      Number(pn) === safePageNum ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                    }`}>{pn}</button>
                )
              )}
              <PageBtn onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePageNum >= totalPages}><ChevronRight className="w-4 h-4" /></PageBtn>
              <PageBtn onClick={() => setPage(totalPages)} disabled={safePageNum >= totalPages}><ChevronsRight className="w-4 h-4" /></PageBtn>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   하위 컴포넌트
   ═══════════════════════════════════════════ */

function InlineDetail({ group, onClose }: { group: OrderGroup; onClose: () => void }) {
  return (
    <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/40 border-y border-blue-200/60 px-6 py-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-sm font-bold text-gray-900">{group.siteName || '(사업장 미입력)'}</h4>
          <p className="text-xs text-gray-500 mt-0.5">{group.orderNumber || group.documentName}</p>
        </div>
        <button onClick={(e) => { e.stopPropagation(); onClose() }} className="text-gray-400 hover:text-gray-600 p-1 -mr-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-1.5 text-xs mb-4">
        <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label="발주일" value={group.orderDate} />
        <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label="등록일" value={group.registeredDate} />
        <InfoRow icon={<Building2 className="w-3.5 h-3.5" />} label="회사명" value={group.companyName} />
        <InfoRow icon={<User className="w-3.5 h-3.5" />} label="담당자" value={`${group.manager} ${group.title}`.trim()} />
        <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label="주소" value={`${group.address1} ${group.address2}`.trim()} />
        <InfoRow icon={<Hash className="w-3.5 h-3.5" />} label="우편번호" value={group.zipCode} />
        <InfoRow icon={<Phone className="w-3.5 h-3.5" />} label="연락처" value={group.phone} />
        <InfoRow icon={<Phone className="w-3.5 h-3.5" />} label="휴대폰" value={group.mobile} />
      </div>

      <div className="border-t border-blue-200/40 pt-3">
        <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
          품목 상세 ({group.items.length}건)
        </p>
        <div className="space-y-1.5">
          {group.items.map((item, i) => (
            <div key={i} className="flex items-center gap-3 bg-white/70 rounded-lg px-3 py-2 border border-gray-100">
              <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-medium ${TYPE_COLORS[item.orderType] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                {item.orderType}
              </span>
              <span className="text-xs text-gray-800 flex-1 truncate" title={item.productModel}>
                {item.productModel || '-'}
              </span>
              <span className="text-xs font-semibold text-gray-600 shrink-0">{item.quantity}대</span>
              <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-medium ${STATUS_COLORS[item.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                {item.status}
              </span>
              {item.note && (
                <span className="shrink-0 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded max-w-[200px] truncate" title={item.note}>
                  {item.note}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value.toLocaleString()}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400">
        <option value="all">전체</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function SortTh({ label, sortKey, currentKey, sortDir, onSort, className = '' }: {
  label: string; sortKey: SortKey; currentKey: SortKey; sortDir: SortDir; onSort: (key: SortKey) => void; className?: string
}) {
  return (
    <th onClick={() => onSort(sortKey)}
      className={`${className} px-3 py-3 text-left text-xs font-semibold text-gray-600 cursor-pointer hover:bg-gray-100/80 select-none transition-colors`}>
      <span className="flex items-center gap-1">
        {label}
        {currentKey !== sortKey
          ? <ArrowUpDown className="w-3 h-3 opacity-30" />
          : sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-600" /> : <ChevronDown className="w-3 h-3 text-blue-600" />
        }
      </span>
    </th>
  )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  if (!value || value.trim() === '') return null
  return (
    <div className="flex items-start gap-2 py-0.5">
      <span className="text-gray-400 mt-0.5 flex-shrink-0">{icon}</span>
      <span className="text-gray-500 w-14 flex-shrink-0">{label}</span>
      <span className="text-gray-800 break-all">{value}</span>
    </div>
  )
}

function PageBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
      {children}
    </button>
  )
}

function generatePageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | string)[] = []
  if (current <= 4) { for (let i = 1; i <= 5; i++) pages.push(i); pages.push('...'); pages.push(total) }
  else if (current >= total - 3) { pages.push(1); pages.push('...'); for (let i = total - 4; i <= total; i++) pages.push(i) }
  else { pages.push(1); pages.push('...'); for (let i = current - 1; i <= current + 1; i++) pages.push(i); pages.push('...'); pages.push(total) }
  return pages
}
