/**
 * 설치일정 테이블 컴포넌트
 *
 * 모든 작업종류(신규설치/이전설치/철거보관/철거폐기)의 발주건을
 * 설치일정 중심으로 보여주는 테이블입니다.
 *
 * 주요 기능:
 * - 작업종류별 색상 뱃지
 * - 배송상태 컬럼 (신규설치만 표시, 나머지는 "-")
 * - 설치예정일/완료일 인라인 편집
 * - 메모 인라인 편집
 * - 데스크톱/모바일 반응형
 */

'use client'

import { useState, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  CalendarDays,
  ClipboardList,
  MapPin,
} from 'lucide-react'
import type { Order } from '@/types/order'
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  WORK_TYPE_COLORS,
  DELIVERY_STATUS_LABELS,
  DELIVERY_STATUS_COLORS,
} from '@/types/order'

/**
 * 날짜 문자열 자동 정규화 (delivery-table.tsx와 동일 로직)
 */
function normalizeDate(raw: string): string {
  const s = raw.trim().replace(/[./\s]/g, '-')
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{2}-\d{2}-\d{2}$/.test(s)) return `20${s}`
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 6) {
    return `20${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 6)}`
  }
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
  }
  return s
}

/**
 * 날짜 입력 컴포넌트 (텍스트 직접 입력 + 달력 버튼)
 */
function DateInput({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const dateRef = useRef<HTMLInputElement>(null)

  return (
    <div className="relative flex items-center">
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          const v = e.target.value.trim()
          if (v) onChange(normalizeDate(v))
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const v = (e.target as HTMLInputElement).value.trim()
            if (v) onChange(normalizeDate(v))
          }
        }}
        onPaste={(e) => {
          e.preventDefault()
          const pasted = e.clipboardData.getData('text').trim()
          onChange(normalizeDate(pasted))
        }}
        placeholder="YYYY-MM-DD"
        className="h-7 text-xs border-gray-200 pr-7"
      />
      <button
        type="button"
        className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
        onClick={(e) => {
          e.stopPropagation()
          dateRef.current?.showPicker()
        }}
        tabIndex={-1}
      >
        <CalendarDays className="h-3.5 w-3.5" />
      </button>
      <input
        ref={dateRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute w-0 h-0 opacity-0 pointer-events-none"
        tabIndex={-1}
      />
    </div>
  )
}

/**
 * 주소에서 지역/도시 파싱
 */
function parseRegionFromAddress(address: string): { region: string; city: string } {
  const parts = address.split(' ')
  return {
    region: parts[0] || '',
    city: parts[1] || '',
  }
}

/**
 * 발주건에 신규설치 작업이 포함되어 있는지 확인
 */
function hasNewInstallation(order: Order): boolean {
  return order.items.some(item => item.workType === '신규설치')
}

interface ScheduleTableProps {
  /** 모든 발주 데이터 */
  orders: Order[]
  /** 설치예정일 변경 시 콜백 */
  onUpdateOrder?: (orderId: string, updates: Partial<Order>) => void
}

export function ScheduleTable({ orders, onUpdateOrder }: ScheduleTableProps) {
  // 검색어 상태
  const [searchTerm, setSearchTerm] = useState('')

  /**
   * 발주의 작업종류 목록 추출 (중복 제거)
   */
  const getWorkTypes = (order: Order): string[] => {
    const types = new Set(order.items.map(item => item.workType))
    return Array.from(types)
  }

  /**
   * 검색 필터 적용
   */
  const filteredOrders = orders.filter(order => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      order.businessName.toLowerCase().includes(term) ||
      order.address.toLowerCase().includes(term) ||
      order.documentNumber.toLowerCase().includes(term) ||
      order.items.some(item => item.workType.toLowerCase().includes(term))
    )
  })

  /**
   * 설치예정일 기준 정렬 (미입력은 맨 뒤)
   */
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const dateA = a.installScheduleDate || a.requestedInstallDate || '9999-12-31'
    const dateB = b.installScheduleDate || b.requestedInstallDate || '9999-12-31'
    return dateA.localeCompare(dateB)
  })

  /** 인라인 편집 핸들러 */
  const handleFieldChange = (orderId: string, field: keyof Order, value: string) => {
    if (onUpdateOrder) {
      onUpdateOrder(orderId, { [field]: value })
    }
  }

  if (sortedOrders.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-lg font-medium">표시할 설치일정이 없습니다</p>
      </div>
    )
  }

  return (
    <div>
      {/* 검색 영역 */}
      <div className="mb-4">
        <Input
          placeholder="현장명, 주소, 문서번호, 작업종류로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* 결과 건수 */}
      <div className="flex items-center mb-3">
        <span className="text-sm text-gray-500">
          {sortedOrders.length}건 표시
          {searchTerm && (
            <span className="text-blue-600 font-medium ml-1">(검색중)</span>
          )}
        </span>
      </div>

      {/* 데스크톱 테이블 (md 이상) */}
      <div className="hidden md:block border rounded-lg overflow-hidden">
        <table className="w-full table-fixed">
          <thead className="bg-muted/80">
            <tr>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '110px' }}>작업종류</th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '180px' }}>현장명</th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '100px' }}>현장위치</th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '90px' }}>배송상태</th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '160px' }}>설치예정일</th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '160px' }}>설치완료일</th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap" style={{ width: '90px' }}>진행상태</th>
              <th className="text-left p-3 text-sm font-medium whitespace-nowrap">메모</th>
            </tr>
          </thead>
          <tbody>
            {sortedOrders.map((order) => {
              const workTypes = getWorkTypes(order)
              const { region, city } = parseRegionFromAddress(order.address)
              const isNewInstall = hasNewInstallation(order)

              return (
                <tr key={order.id} className="hover:bg-gray-50/50 transition-colors border-b border-gray-100">
                  {/* 작업종류 뱃지 */}
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {workTypes.map(type => (
                        <Badge
                          key={type}
                          className={`${WORK_TYPE_COLORS[type] || 'bg-gray-100 text-gray-700'} text-xs border`}
                        >
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  {/* 현장명 */}
                  <td className="p-3">
                    <p className="font-semibold text-sm truncate">{order.businessName}</p>
                    <p className="text-xs text-gray-500 truncate">{order.address}</p>
                  </td>
                  {/* 현장위치 */}
                  <td className="p-3">
                    <p className="text-xs font-medium text-gray-700">{region}</p>
                    <p className="text-xs text-gray-500">{city}</p>
                  </td>
                  {/* 배송상태 (신규설치만 표시) */}
                  <td className="p-3">
                    {isNewInstall && order.deliveryStatus ? (
                      <Badge className={`${DELIVERY_STATUS_COLORS[order.deliveryStatus]} text-xs border`}>
                        {DELIVERY_STATUS_LABELS[order.deliveryStatus]}
                      </Badge>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  {/* 설치예정일 (인라인 편집) */}
                  <td className="p-3">
                    <DateInput
                      value={order.installScheduleDate || order.requestedInstallDate || ''}
                      onChange={(val) => handleFieldChange(order.id, 'installScheduleDate', val)}
                    />
                  </td>
                  {/* 설치완료일 (인라인 편집) */}
                  <td className="p-3">
                    <DateInput
                      value={order.installCompleteDate || ''}
                      onChange={(val) => handleFieldChange(order.id, 'installCompleteDate', val)}
                    />
                  </td>
                  {/* 진행상태 */}
                  <td className="p-3">
                    <Badge className={`${ORDER_STATUS_COLORS[order.status]} text-xs`}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                  </td>
                  {/* 메모 (인라인 편집) */}
                  <td className="p-3">
                    <Input
                      value={order.installMemo || ''}
                      onChange={(e) => handleFieldChange(order.id, 'installMemo', e.target.value)}
                      placeholder="메모 입력..."
                      className="h-7 text-xs border-gray-200"
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 모바일 카드 리스트 (md 미만) */}
      <div className="md:hidden space-y-3">
        {sortedOrders.map((order) => {
          const workTypes = getWorkTypes(order)
          const { region, city } = parseRegionFromAddress(order.address)
          const isNewInstall = hasNewInstallation(order)

          return (
            <div key={order.id} className="border rounded-lg bg-white p-4 space-y-3">
              {/* 상단: 작업종류 뱃지 + 진행상태 */}
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1">
                  {workTypes.map(type => (
                    <Badge
                      key={type}
                      className={`${WORK_TYPE_COLORS[type] || 'bg-gray-100 text-gray-700'} text-xs border`}
                    >
                      {type}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  {/* 배송상태 뱃지 (신규설치만) */}
                  {isNewInstall && order.deliveryStatus && (
                    <Badge className={`${DELIVERY_STATUS_COLORS[order.deliveryStatus]} text-xs border`}>
                      {DELIVERY_STATUS_LABELS[order.deliveryStatus]}
                    </Badge>
                  )}
                  <Badge className={`${ORDER_STATUS_COLORS[order.status]} text-xs`}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </Badge>
                </div>
              </div>

              {/* 현장 정보 */}
              <div>
                <h3 className="font-semibold text-sm">{order.businessName}</h3>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" />
                  {region} {city} · {order.address}
                </p>
              </div>

              {/* 설치일정 편집 */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-400">설치예정일</label>
                  <DateInput
                    value={order.installScheduleDate || order.requestedInstallDate || ''}
                    onChange={(val) => handleFieldChange(order.id, 'installScheduleDate', val)}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400">설치완료일</label>
                  <DateInput
                    value={order.installCompleteDate || ''}
                    onChange={(val) => handleFieldChange(order.id, 'installCompleteDate', val)}
                  />
                </div>
              </div>

              {/* 메모 */}
              <div>
                <label className="text-[10px] text-gray-400">메모</label>
                <Input
                  value={order.installMemo || ''}
                  onChange={(e) => handleFieldChange(order.id, 'installMemo', e.target.value)}
                  placeholder="메모 입력..."
                  className="h-7 text-xs border-gray-200"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
