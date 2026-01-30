/**
 * 배송관리 페이지 (멜레아 전용)
 *
 * 삼성전자에 발주한 장비의 배송 현황을 테이블 리스트로 관리합니다.
 *
 * 주요 기능:
 * - 상태 탭 필터: 발주대기/배송중/입고완료 (발주대기 기본 선택)
 * - 테이블 리스트: 현장별 행 + 아코디언 구성품 상세 (SET 모델 + 구성품)
 * - 배송정보 입력 모달: 주문번호/배송일/창고 입력
 *
 * 배송 상태 자동 판정:
 * - 모든 구성품 확정일 ≤ 오늘 → 입고완료
 * - 주문번호 + 배송예정일 입력 → 배송중
 * - 그 외 → 발주대기
 */

'use client'

import { useState, useMemo } from 'react'
import { mockOrders } from '@/lib/mock-data'
import type { Order, DeliveryStatus, EquipmentItem } from '@/types/order'
import { DeliveryTable } from '@/components/delivery/delivery-table'
import { DeliveryInputDialog } from '@/components/delivery/delivery-input-dialog'
import { DeliveryDetailDialog } from '@/components/delivery/delivery-detail-dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Truck } from 'lucide-react'
import { computeDeliveryStatus } from '@/lib/delivery-utils'

export default function DeliveryPage() {
  // 발주 데이터 (나중에 Supabase로 교체)
  const [orders, setOrders] = useState<Order[]>(mockOrders)

  // 검색어
  const [searchTerm, setSearchTerm] = useState('')

  // 상태 탭 필터 (발주대기 기본 선택)
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus>('pending')

  // 배송정보 입력 모달
  const [inputDialogOpen, setInputDialogOpen] = useState(false)
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null)

  // 상세보기 모달
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [orderToView, setOrderToView] = useState<Order | null>(null)

  /**
   * 배송 대상 발주만 필터링 (deliveryStatus가 있는 발주)
   */
  const deliveryOrders = useMemo(() => {
    return orders.filter(order => order.deliveryStatus)
  }, [orders])

  /**
   * 검색 + 상태탭 필터 적용
   */
  const filteredOrders = useMemo(() => {
    return deliveryOrders.filter(order => {
      // 검색어 필터
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const matchesSearch = (
          order.businessName.toLowerCase().includes(term) ||
          order.address.toLowerCase().includes(term) ||
          order.documentNumber.toLowerCase().includes(term) ||
          (order.samsungOrderNumber || '').toLowerCase().includes(term)
        )
        if (!matchesSearch) return false
      }

      // 상태 탭 필터
      const computed = computeDeliveryStatus(order)
      if (computed !== statusFilter) return false

      return true
    })
  }, [deliveryOrders, searchTerm, statusFilter])

  /**
   * 상태별 건수 계산 (탭 표시용)
   */
  const statusCounts = useMemo(() => {
    const counts = { pending: 0, 'in-transit': 0, delivered: 0 }
    deliveryOrders.forEach(order => {
      const status = computeDeliveryStatus(order)
      counts[status]++
    })
    return counts
  }, [deliveryOrders])

  /**
   * 배송정보 입력 모달 열기
   */
  const handleEditDelivery = (order: Order) => {
    setOrderToEdit(order)
    setInputDialogOpen(true)
  }

  /**
   * 상세보기 모달 열기
   */
  const handleViewDetail = (order: Order) => {
    setOrderToView(order)
    setDetailDialogOpen(true)
  }

  /**
   * 배송정보 저장 핸들러
   */
  const handleSaveDelivery = (orderId: string, data: {
    samsungOrderNumber: string
    equipmentItems: EquipmentItem[]
  }) => {
    setOrders(prev => prev.map(order => {
      if (order.id !== orderId) return order

      const updated: Order = {
        ...order,
        samsungOrderNumber: data.samsungOrderNumber,
        equipmentItems: data.equipmentItems,
      }

      // 자동 상태 판정 적용
      updated.deliveryStatus = computeDeliveryStatus(updated)

      return updated
    }))

    alert('배송 정보가 저장되었습니다!')
  }

  /** 상태 탭 정의 (전체 탭 제거, 발주대기 먼저) */
  const statusTabs: { label: string; value: DeliveryStatus; count: number }[] = [
    { label: '발주대기', value: 'pending', count: statusCounts.pending },
    { label: '배송중', value: 'in-transit', count: statusCounts['in-transit'] },
    { label: '입고완료', value: 'delivered', count: statusCounts.delivered },
  ]

  return (
    <div className="container mx-auto py-8 px-4">
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
          <Truck className="h-6 w-6" />
          배송관리
        </h1>
        <p className="text-muted-foreground">삼성전자 장비 배송 현황을 한눈에 확인하세요</p>
      </div>

      {/* 검색 영역 */}
      <div className="mb-4">
        <Input
          placeholder="현장명, 주소, 문서번호, 주문번호로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* 상태 탭 필터 */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto">
        {statusTabs.map(tab => (
          <button
            key={tab.label}
            onClick={() => setStatusFilter(tab.value)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap
              ${statusFilter === tab.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
          >
            {tab.label}
            <Badge variant="secondary" className="text-xs ml-1 px-1.5 py-0">
              {tab.count}
            </Badge>
          </button>
        ))}

        {/* 결과 건수 */}
        <span className="text-sm text-gray-500 ml-auto">
          {filteredOrders.length}건 표시
          {searchTerm && (
            <span className="text-blue-600 font-medium ml-1">(검색중)</span>
          )}
        </span>
      </div>

      {/* 메인 테이블 */}
      <DeliveryTable
        orders={filteredOrders}
        onEditDelivery={handleEditDelivery}
        onViewDetail={handleViewDetail}
      />

      {/* 배송정보 입력 모달 */}
      <DeliveryInputDialog
        order={orderToEdit}
        open={inputDialogOpen}
        onOpenChange={setInputDialogOpen}
        onSave={handleSaveDelivery}
      />

      {/* 배송 상세 정보 모달 (기존 유지) */}
      <DeliveryDetailDialog
        order={orderToView}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  )
}
