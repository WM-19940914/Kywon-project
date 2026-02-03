/**
 * 배송관리 페이지 (멜레아 전용)
 *
 * 삼성전자에 발주한 장비의 배송 현황을 관리합니다.
 * - 상태 탭 필터: 발주대기 / 진행중 / 배송완료 (3단계, 수동 전환)
 * - 테이블 리스트: 현장별 행 + 아코디언 구성품 상세
 * - 각 탭에서 앞/뒤 상태로 버튼 클릭으로 이동
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { fetchOrders, updateOrder, updateDeliveryStatus, saveEquipmentItems } from '@/lib/supabase/dal'
import { fetchWarehouses } from '@/lib/supabase/dal'
import { setWarehouseCache } from '@/lib/delivery-utils'
import type { Order, DeliveryStatus, EquipmentItem } from '@/types/order'
import { DeliveryTable } from '@/components/delivery/delivery-table'
import { DeliveryInputDialog } from '@/components/delivery/delivery-input-dialog'
import { OrderDetailDialog } from '@/components/orders/order-detail-dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Truck, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAlert } from '@/components/ui/custom-alert'

export default function DeliveryPage() {
  const { showAlert } = useAlert()

  // Supabase에서 데이터 로드
  const [orders, setOrders] = useState<Order[]>([])
  const [, setIsLoading] = useState(true)

  useEffect(() => {
    // 창고 + 발주 데이터 동시 로드
    Promise.all([fetchWarehouses(), fetchOrders()]).then(([warehouses, ordersData]) => {
      setWarehouseCache(warehouses)
      setOrders(ordersData)
      setIsLoading(false)
    })
  }, [])

  // 검색어
  const [searchTerm, setSearchTerm] = useState('')

  // 상태 탭 필터 (발주대기 기본 선택)
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus>('pending')

  // 배송완료 탭 년/월 필터
  const now = new Date()
  const [filterYear, setFilterYear] = useState<number>(now.getFullYear())
  const [filterMonth, setFilterMonth] = useState<number>(now.getMonth() + 1)
  const [monthFilterEnabled, setMonthFilterEnabled] = useState(false)

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
    return orders.filter(order => {
      if (!order.deliveryStatus) return false
      // 배송관리는 신규설치 건만 표시 (장비 발주가 필요한 작업만)
      const hasNewInstall = order.items.some(item => item.workType === '신규설치')
      return hasNewInstall
    })
  }, [orders])

  /**
   * 상태별 건수 계산 (탭 표시용)
   * deliveryStatus 값 기준으로 단순 카운트 (자동 로직 없음)
   */
  const statusCounts = useMemo(() => {
    const counts = { pending: 0, ordered: 0, delivered: 0 }
    deliveryOrders.forEach(order => {
      const status = order.deliveryStatus as DeliveryStatus
      if (status && counts[status] !== undefined) {
        counts[status]++
      }
    })
    return counts
  }, [deliveryOrders])

  /**
   * 검색 + 상태탭 필터 적용
   * deliveryStatus 값으로만 필터 (자동 판정 없음)
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

      // 배송완료 탭: 년/월 필터
      if (statusFilter === 'delivered') {
        if (order.deliveryStatus !== 'delivered') return false
        if (monthFilterEnabled) {
          const prefix = `${filterYear}-${String(filterMonth).padStart(2, '0')}`
          const hasMatchingDate = (order.equipmentItems || []).some(
            item => item.confirmedDeliveryDate && item.confirmedDeliveryDate.startsWith(prefix)
          )
          if (!hasMatchingDate) return false
        }
        return true
      }

      // 발주대기/진행중 탭: deliveryStatus 값 일치
      return order.deliveryStatus === statusFilter
    })
  }, [deliveryOrders, searchTerm, statusFilter, monthFilterEnabled, filterYear, filterMonth])

  /**
   * 배송정보 입력 모달 열기
   */
  const handleEditDelivery = (order: Order) => {
    setOrderToEdit(order)
    setInputDialogOpen(true)
  }

  /**
   * 배송상태 수동 전환 핸들러
   * 발주대기 ↔ 진행중 ↔ 배송완료 양방향 이동
   */
  const handleChangeDeliveryStatus = async (orderId: string, newStatus: DeliveryStatus) => {
    await updateDeliveryStatus(orderId, newStatus)
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
  const handleSaveDelivery = async (orderId: string, data: {
    samsungOrderNumber: string
    equipmentItems: EquipmentItem[]
  }) => {
    await updateOrder(orderId, { samsungOrderNumber: data.samsungOrderNumber })
    await saveEquipmentItems(orderId, data.equipmentItems)

    setOrders(prev => prev.map(order => {
      if (order.id !== orderId) return order
      return {
        ...order,
        samsungOrderNumber: data.samsungOrderNumber,
        equipmentItems: data.equipmentItems,
      }
    }))

    showAlert('배송 정보가 저장되었습니다!', 'success')
  }

  // 배송완료 탭 페이지네이션 (10개씩)
  const DELIVERED_PAGE_SIZE = 10
  const [deliveredPage, setDeliveredPage] = useState(1)

  // 탭/검색/필터 변경 시 첫 페이지로 리셋
  useEffect(() => { setDeliveredPage(1) }, [statusFilter, searchTerm, monthFilterEnabled, filterYear, filterMonth])

  const deliveredTotalPages = statusFilter === 'delivered'
    ? Math.max(1, Math.ceil(filteredOrders.length / DELIVERED_PAGE_SIZE))
    : 1
  const displayOrders = statusFilter === 'delivered'
    ? filteredOrders.slice((deliveredPage - 1) * DELIVERED_PAGE_SIZE, deliveredPage * DELIVERED_PAGE_SIZE)
    : filteredOrders

  /** 상태 탭 정의 (3단계: 발주대기/진행중/배송완료) */
  const statusTabs: { label: string; value: DeliveryStatus; count: number }[] = [
    { label: '발주대기', value: 'pending', count: statusCounts.pending },
    { label: '진행중', value: 'ordered', count: statusCounts.ordered },
    { label: '배송완료', value: 'delivered', count: statusCounts.delivered },
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
                ? tab.value === 'delivered'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-primary text-primary-foreground shadow-sm'
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

      {/* 배송완료 탭: 년/월 필터 */}
      {statusFilter === 'delivered' && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Button
            variant={monthFilterEnabled ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMonthFilterEnabled(prev => !prev)}
            className="gap-1.5"
          >
            <CalendarDays className="h-4 w-4" />
            {monthFilterEnabled ? '월별 필터 ON' : '월별 필터'}
          </Button>
          {monthFilterEnabled && (
            <div className="flex items-center gap-1 bg-muted rounded-lg px-1 py-0.5">
              {/* 이전 달 */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  if (filterMonth === 1) {
                    setFilterYear(prev => prev - 1)
                    setFilterMonth(12)
                  } else {
                    setFilterMonth(prev => prev - 1)
                  }
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {/* 년/월 표시 */}
              <span className="text-sm font-medium min-w-[100px] text-center">
                {filterYear}년 {filterMonth}월
              </span>
              {/* 다음 달 */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  if (filterMonth === 12) {
                    setFilterYear(prev => prev + 1)
                    setFilterMonth(1)
                  } else {
                    setFilterMonth(prev => prev + 1)
                  }
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 탭별 안내 문구 */}
      <p className="text-sm text-muted-foreground mb-3">
        {statusFilter === 'pending' && <span className="inline-flex items-center gap-3"><span className="inline-flex items-baseline px-3 py-1.5 rounded-md shadow-sm" style={{ backgroundColor: '#E09520' }}><span className="font-extrabold text-sm tracking-wide" style={{ color: '#2D2519' }}>M</span><span className="italic text-white" style={{ fontSize: '1rem', margin: '0 1px 0 1px', paddingRight: '1.5px' }}>e</span><span className="font-extrabold text-sm tracking-wide" style={{ color: '#2D2519' }}>LEA</span></span><span className="text-muted-foreground">삼성전자에 발주를 신속히 진행하고 진행중으로 변경해주세요.</span></span>}
        {statusFilter === 'ordered' && '삼성전자에 발주 완료된 장비입니다. 구성품별 배송현황을 확인하세요.'}
        {statusFilter === 'delivered' && '배송완료 처리된 건입니다.'}
      </p>

      {/* 메인 테이블 */}
      <DeliveryTable
        orders={displayOrders}
        onEditDelivery={handleEditDelivery}
        onViewDetail={handleViewDetail}
        onChangeStatus={handleChangeDeliveryStatus}
        onSaveItems={async (orderId, items) => {
          await saveEquipmentItems(orderId, items)
          setOrders(prev => prev.map(order => {
            if (order.id !== orderId) return order
            return { ...order, equipmentItems: items }
          }))
        }}
        readOnly={false}
        currentTab={statusFilter}
      />

      {/* 배송완료 탭 페이지네이션 */}
      {statusFilter === 'delivered' && deliveredTotalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2"
            disabled={deliveredPage <= 1}
            onClick={() => setDeliveredPage(p => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600">
            {deliveredPage} / {deliveredTotalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 px-2"
            disabled={deliveredPage >= deliveredTotalPages}
            onClick={() => setDeliveredPage(p => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* 배송정보 입력 모달 */}
      <DeliveryInputDialog
        order={orderToEdit}
        open={inputDialogOpen}
        onOpenChange={setInputDialogOpen}
        onSave={handleSaveDelivery}
      />

      {/* 발주 상세 모달 (전체 페이지 공용) */}
      <OrderDetailDialog
        order={orderToView}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  )
}
