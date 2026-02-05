/**
 * 발주 목록 페이지 (칸반보드 3단계 형태)
 *
 * 진행상태별로 3개 컬럼을 나누어 한눈에 보기 쉽게!
 * 접수중 → 진행중 → 완료 순서로 표시됩니다.
 * 마치 "할일판"처럼, 각 단계별로 어떤 발주가 있는지 바로 알 수 있어요.
 */

'use client'

import { useState, useEffect } from 'react'
import { fetchOrders, createOrder as createOrderDB, updateOrder as updateOrderDB, deleteOrder as deleteOrderDB, cancelOrder as cancelOrderDB } from '@/lib/supabase/dal'
import { type Order, type OrderStatus } from '@/types/order'
import { computeKanbanStatus } from '@/lib/order-status-utils'
import { OrderForm, type OrderFormData } from '@/components/orders/order-form'
import { OrderCard } from '@/components/orders/order-card'
import { OrderDetailDialog } from '@/components/orders/order-detail-dialog'
import { SettledHistoryPanel } from '@/components/orders/settled-history-panel'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LayoutGrid, List } from 'lucide-react'
import { useAlert } from '@/components/ui/custom-alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AFFILIATE_OPTIONS } from '@/types/order'

export default function OrdersPage() {
  const { showAlert } = useAlert()

  // 상태 관리
  const [searchTerm, setSearchTerm] = useState('') // 검색어
  const [isDialogOpen, setIsDialogOpen] = useState(false) // 신규 등록 모달
  const [orders, setOrders] = useState<Order[]>([]) // 발주 목록 (DB에서 로드)
  const [isSubmitting, setIsSubmitting] = useState(false) // 제출 중 상태
  const [, setIsLoading] = useState(true) // 로딩 상태

  // Supabase에서 발주 데이터 가져오기
  useEffect(() => {
    fetchOrders().then(data => {
      setOrders(data)
      setIsLoading(false)
    })
  }, [])

  // 상세보기 모달 상태
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [orderToView, setOrderToView] = useState<Order | null>(null)

  // 수정 모달 상태
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null)

  // 필터/정렬 상태
  const [affiliateFilter, setAffiliateFilter] = useState<string>('all') // 계열사 필터
  const [sortOrder, setSortOrder] = useState<string>('latest') // 정렬 순서

  /**
   * 신규 발주 등록 핸들러
   */
  const handleSubmit = async (data: OrderFormData) => {
    setIsSubmitting(true)

    try {
      // orderNumber는 DB에 없는 필드이므로 제거 (사용하지 않으므로 _로 표시)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { orderNumber: _orderNumber, ...orderData } = data

      const newOrder: Order = {
        id: Date.now().toString(),
        ...orderData,
        status: 'received',
        createdAt: new Date().toISOString(),
        isPreliminaryQuote: data.isPreliminaryQuote
      }

      // DB에 저장
      const created = await createOrderDB(newOrder)
      if (created) {
        setOrders([created, ...orders])
        showAlert('발주가 등록되었습니다!', 'success')
        setIsDialogOpen(false)
      } else {
        showAlert('발주 등록에 실패했습니다.', 'error')
      }
    } catch (error) {
      console.error('발주 등록 실패:', error)
      showAlert('발주 등록에 실패했습니다.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * 카드 클릭 핸들러 (상세보기 모달 열기)
   */
  const handleCardClick = (order: Order) => {
    setOrderToView(order)
    setDetailDialogOpen(true)
  }

  /**
   * 발주 삭제 핸들러
   */
  const handleDelete = async (orderId: string) => {
    const success = await deleteOrderDB(orderId)
    if (success) {
      setOrders(orders.filter(o => o.id !== orderId))
      showAlert('발주가 삭제되었습니다.', 'success')
    } else {
      showAlert('발주 삭제에 실패했습니다.', 'error')
    }
  }

  /**
   * 발주 취소 핸들러 (soft delete — 기록 보관)
   */
  const handleCancelOrder = async (orderId: string, reason: string) => {
    const success = await cancelOrderDB(orderId, reason)
    if (success) {
      setOrders(orders.map(o =>
        o.id === orderId
          ? { ...o, status: 'cancelled' as const, cancelReason: reason, cancelledAt: new Date().toISOString() }
          : o
      ))
      showAlert('발주가 취소되었습니다.', 'success')
    } else {
      showAlert('발주 취소에 실패했습니다.', 'error')
    }
  }

  /**
   * 발주 수정 버튼 클릭 핸들러
   */
  const handleEdit = (order: Order) => {
    setOrderToEdit(order)
    setEditDialogOpen(true)
    setDetailDialogOpen(false)  // 상세 모달 닫기
  }

  /**
   * 발주 수정 제출 핸들러
   */
  const handleEditSubmit = async (data: OrderFormData) => {
    if (!orderToEdit) return

    setIsSubmitting(true)
    try {
      // orderNumber는 DB에 없는 필드이므로 제거 (사용하지 않으므로 _로 표시)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { orderNumber: _orderNumber, ...orderData } = data
      // DB에 수정 반영
      const updated = await updateOrderDB(orderToEdit.id, orderData)
      if (updated) {
        setOrders(orders.map(o => o.id === orderToEdit.id ? updated : o))
        showAlert('발주가 수정되었습니다!', 'success')
        setEditDialogOpen(false)
        setOrderToEdit(null)
      } else {
        showAlert('수정에 실패했습니다.', 'error')
      }
    } catch (error) {
      console.error('수정 실패:', error)
      showAlert('수정에 실패했습니다.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * 검색 + 필터링 + 정렬
   * 정산완료(settled)는 제외! (별도 페이지에서 관리)
   */
  const filteredOrders = orders
    .filter((order) => {
      // 1. 정산완료/취소는 칸반보드 메인 흐름에서 제외 (별도 표시)
      const kanbanStatus = computeKanbanStatus(order)
      if (kanbanStatus === 'settled' || kanbanStatus === 'cancelled') return false

      // 2. 계열사 필터
      if (affiliateFilter !== 'all' && order.affiliate !== affiliateFilter) {
        return false
      }

      // 3. 검색어 필터
      const matchesSearch =
        order.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.documentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.affiliate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.businessName.toLowerCase().includes(searchTerm.toLowerCase())

      return matchesSearch
    })
    .sort((a, b) => {
      // 4. 정렬
      if (sortOrder === 'latest') {
        // 최신순 (발주일 기준)
        return new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
      } else if (sortOrder === 'oldest') {
        // 오래된순 (발주일 기준)
        return new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime()
      }
      return 0
    })

  /**
   * 진행상태별로 그룹화 (자동 분류!)
   * order.status 대신 computeKanbanStatus()로 계산된 상태 사용
   */
  const groupedOrders: Record<OrderStatus, Order[]> = {
    'received': filteredOrders.filter(o => computeKanbanStatus(o) === 'received'),
    'in-progress': filteredOrders.filter(o => computeKanbanStatus(o) === 'in-progress'),
    'completed': filteredOrders.filter(o => computeKanbanStatus(o) === 'completed'),
    'settled': [], // 과거내역은 별도 패널
    'cancelled': [], // 취소 건은 과거내역 패널에서 표시
  }

  /**
   * 통계 계산
   */
  const totalOrders = filteredOrders.length

  return (
    <div className="container mx-auto py-8 px-4">
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1">발주 관리</h1>
        <p className="text-muted-foreground">진행상태별로 한눈에 확인하세요</p>
      </div>


      {/* 검색 + 필터 영역 */}
      <Card className="mb-6">
        <CardContent className="pt-6 space-y-4">
          {/* 첫 번째 줄: 검색창 */}
          <div className="flex gap-3">
            <Input
              placeholder="주소, 문서번호, 계열사, 사업자명으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>

          {/* 두 번째 줄: 필터/정렬/뷰/내보내기/신규등록 */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* 계열사 필터 */}
            <Select value={affiliateFilter} onValueChange={setAffiliateFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="계열사" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 계열사</SelectItem>
                {AFFILIATE_OPTIONS.map((affiliate) => (
                  <SelectItem key={affiliate} value={affiliate}>
                    {affiliate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 정렬 옵션 */}
            <Select value={sortOrder} onValueChange={setSortOrder}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="정렬" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">최신순</SelectItem>
                <SelectItem value="oldest">오래된순</SelectItem>
              </SelectContent>
            </Select>

            {/* 뷰 전환 (일단 칸반뷰만) */}
            <Button variant="outline" disabled className="gap-1.5">
              <LayoutGrid className="h-4 w-4" />
              칸반뷰
            </Button>
            <Button variant="ghost" disabled className="gap-1.5">
              <List className="h-4 w-4" />
              리스트뷰 (준비중)
            </Button>

            {/* 구분선 */}
            <div className="flex-1"></div>

            {/* 신규 발주 등록 버튼 */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>+ 신규 발주</Button>
              </DialogTrigger>

              <DialogContent
                className="max-w-3xl max-h-[90vh] overflow-y-auto"
                onInteractOutside={(e) => {
                  // 바깥 클릭해도 모달 안 닫히게 (입력 중 실수로 닫히는 것 방지)
                  e.preventDefault()
                }}
              >
                <DialogHeader>
                  <DialogTitle>신규 발주 등록</DialogTitle>
                </DialogHeader>

                <OrderForm
                  onSubmit={handleSubmit}
                  onCancel={() => setIsDialogOpen(false)}
                  isSubmitting={isSubmitting}
                />
              </DialogContent>
            </Dialog>
          </div>

          {/* 검색 결과 개수 */}
          <p className="text-sm text-gray-500">
            총 {totalOrders}건의 발주
            {(searchTerm || affiliateFilter !== 'all') && (
              <span className="text-blue-600 font-medium ml-2">
                (필터링: {filteredOrders.length}건)
              </span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* 칸반보드 + 과거내역 (2단 구조) */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {/* 왼쪽: 칸반보드 3개 컬럼 (그룹화) */}
        <div className="flex gap-4 flex-shrink-0">
          {/* 접수중 컬럼 */}
          <KanbanColumn
            title="접수중"
            status="received"
            orders={groupedOrders['received']}
            onCardClick={handleCardClick}
          />

          {/* 진행중 컬럼 */}
          <KanbanColumn
            title="진행중"
            status="in-progress"
            orders={groupedOrders['in-progress']}
            onCardClick={handleCardClick}
          />

          {/* 완료 컬럼 */}
          <KanbanColumn
            title="완료 (금월 정산대기중)"
            status="completed"
            orders={groupedOrders['completed']}
            onCardClick={handleCardClick}
          />
        </div>

        {/* 오른쪽: 과거내역 패널 (정산완료 + 취소내역) */}
        <SettledHistoryPanel
          orders={orders}
          onCardClick={handleCardClick}
        />
      </div>

      {/* 상세보기 모달 */}
      <OrderDetailDialog
        order={orderToView}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onDelete={handleDelete}
        onEdit={handleEdit}
        onCancelOrder={handleCancelOrder}
      />

      {/* 수정 모달 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent
          className="max-w-3xl max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>발주 수정</DialogTitle>
          </DialogHeader>

          {orderToEdit && (
            <OrderForm
              onSubmit={handleEditSubmit}
              onCancel={() => {
                setEditDialogOpen(false)
                setOrderToEdit(null)
              }}
              initialData={{
                documentNumber: orderToEdit.documentNumber,
                address: orderToEdit.address,
                orderDate: orderToEdit.orderDate,
                affiliate: orderToEdit.affiliate,
                businessName: orderToEdit.businessName,
                contactName: orderToEdit.contactName,
                contactPhone: orderToEdit.contactPhone,
                buildingManagerPhone: orderToEdit.buildingManagerPhone,
                requestedInstallDate: orderToEdit.requestedInstallDate,
                items: orderToEdit.items,
                notes: orderToEdit.notes,
                isPreliminaryQuote: orderToEdit.isPreliminaryQuote
              }}
              submitLabel="수정 완료"
              isSubmitting={isSubmitting}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * 칸반 컬럼 컴포넌트
 * 각 진행상태별로 하나씩 만들어져요
 */
interface KanbanColumnProps {
  title: string                      // 컬럼 제목 (예: "접수중")
  status: OrderStatus                // 진행상태
  orders: Order[]                    // 이 컬럼에 표시할 발주들
  onCardClick: (order: Order) => void // 카드 클릭 핸들러
}

function KanbanColumn({ title, status, orders, onCardClick }: KanbanColumnProps) {
  // 상태별 배경색 + 상단 스트라이프 (3단계)
  const columnStyles: Record<OrderStatus, { bg: string; stripe: string }> = {
    'received': { bg: 'bg-amber-50/70', stripe: 'border-t-4 border-t-amber-400' },
    'in-progress': { bg: 'bg-blue-50/70', stripe: 'border-t-4 border-t-blue-400' },
    'completed': { bg: 'bg-violet-50/70', stripe: 'border-t-4 border-t-violet-400' },
    'settled': { bg: 'bg-emerald-50/70', stripe: 'border-t-4 border-t-emerald-400' },
    'cancelled': { bg: 'bg-red-50/70', stripe: 'border-t-4 border-t-red-400' },
  }

  const style = columnStyles[status]

  return (
    <div className={`flex-shrink-0 w-72 ${style.bg} ${style.stripe} rounded-xl p-3`}>
      {/* 컬럼 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-base">{title}</h2>
        <Badge variant="outline" className="bg-white">
          {orders.length}건
        </Badge>
      </div>

      {/* 카드 리스트 */}
      <div className="space-y-2 max-h-[calc(100vh-350px)] overflow-y-auto">
        {orders.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            발주가 없습니다
          </p>
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onClick={onCardClick}
            />
          ))
        )}
      </div>
    </div>
  )
}

