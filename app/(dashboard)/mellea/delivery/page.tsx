/**
 * 배송관리 페이지 (멜레아 전용)
 *
 * 삼성전자에 발주한 장비의 배송 현황을 관리합니다.
 * - 상태 탭 필터: 발주대기/발주완료 (발주대기 기본 선택)
 * - 테이블 리스트: 현장별 행 + 아코디언 구성품 상세
 * - 배송정보 입력 모달: 주문번호/배송일/창고 입력
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

      // 상태 탭 필터 (order.deliveryStatus 직접 사용)
      if (order.deliveryStatus !== statusFilter) return false

      return true
    })
  }, [deliveryOrders, searchTerm, statusFilter])

  /**
   * 상태별 건수 계산 (탭 표시용)
   */
  const statusCounts = useMemo(() => {
    const counts = { pending: 0, ordered: 0 }
    deliveryOrders.forEach(order => {
      // order.deliveryStatus 직접 사용
      if (order.deliveryStatus) counts[order.deliveryStatus]++
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
   * 배송상태 수동 전환 핸들러
   * 발주대기 → 발주완료 한 방향만
   */
  const handleChangeDeliveryStatus = (orderId: string, newStatus: DeliveryStatus) => {
    setOrders(prev => prev.map(order => {
      if (order.id !== orderId) return order
      return { ...order, deliveryStatus: newStatus }
    }))
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

      // 자동 판정 제거 — deliveryStatus는 수동 전환으로만 변경
      return {
        ...order,
        samsungOrderNumber: data.samsungOrderNumber,
        equipmentItems: data.equipmentItems,
      }
    }))

    alert('배송 정보가 저장되었습니다!')
  }

  /** 상태 탭 정의 (2단계: 발주대기/발주완료) */
  const statusTabs: { label: string; value: DeliveryStatus; count: number }[] = [
    { label: '발주대기', value: 'pending', count: statusCounts.pending },
    { label: '발주완료', value: 'ordered', count: statusCounts.ordered },
  ]

  return (
    <div className="container mx-auto py-8 px-4">
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
          <Truck className="h-6 w-6" />
          배송관리
        </h1>
        <p className="text-muted-foreground">삼성전자에 발주한 장비의 배송 현황을 관리하세요</p>
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

      {/* 탭별 안내 문구 */}
      <p className="text-sm text-muted-foreground mb-3">
        {statusFilter === 'pending' && <span className="inline-flex items-center gap-3"><span className="inline-flex items-baseline px-3 py-1.5 rounded-md shadow-sm" style={{ backgroundColor: '#E09520' }}><span className="font-extrabold text-sm tracking-wide" style={{ color: '#2D2519' }}>M</span><span className="italic text-white" style={{ fontSize: '1rem', margin: '0 1px 0 1px', paddingRight: '1.5px' }}>e</span><span className="font-extrabold text-sm tracking-wide" style={{ color: '#2D2519' }}>LEA</span></span><span className="text-muted-foreground">삼성전자에 발주를 신속히 진행하고 발주완료로 변경해주세요.</span></span>}
        {statusFilter === 'ordered' && '삼성전자에 발주 완료된 장비입니다. 구성품별 배송현황을 확인하세요.'}
      </p>

      {/* 메인 테이블 */}
      <DeliveryTable
        orders={filteredOrders}
        onEditDelivery={handleEditDelivery}
        onViewDetail={handleViewDetail}
        onChangeStatus={handleChangeDeliveryStatus}
        onSaveItems={(orderId, items) => {
          setOrders(prev => prev.map(order => {
            if (order.id !== orderId) return order
            return { ...order, equipmentItems: items }
          }))
        }}
      />

      {/* 배송정보 입력 모달 */}
      <DeliveryInputDialog
        order={orderToEdit}
        open={inputDialogOpen}
        onOpenChange={setInputDialogOpen}
        onSave={handleSaveDelivery}
      />

      {/* 배송 상세 정보 모달 */}
      <DeliveryDetailDialog
        order={orderToView}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  )
}
