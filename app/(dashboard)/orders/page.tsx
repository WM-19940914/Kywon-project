/**
 * 발주 목록 페이지 (칸반보드 3단계 형태)
 *
 * 진행상태별로 3개 컬럼을 나누어 한눈에 보기 쉽게!
 * 접수중 → 진행중 → 완료 순서로 표시됩니다.
 */

'use client'

import { useState, useEffect } from 'react'
import { fetchOrders, createOrder as createOrderDB, updateOrder as updateOrderDB, deleteOrder as deleteOrderDB, cancelOrder as cancelOrderDB, fetchStoredEquipment, updateStoredEquipment } from '@/lib/supabase/dal'
import { type Order, type OrderStatus, type StoredEquipment } from '@/types/order'
import { computeKanbanStatus } from '@/lib/order-status-utils'
import { OrderForm, type OrderFormData } from '@/components/orders/order-form'
import { OrderCard } from '@/components/orders/order-card'
import { OrderDetailDialog } from '@/components/orders/order-detail-dialog'
import { SettledHistoryPanel } from '@/components/orders/settled-history-panel'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ClipboardList, Search } from 'lucide-react'
import { useAlert } from '@/components/ui/custom-alert'
import { ExcelExportButton } from '@/components/ui/excel-export-button'
import { exportToExcel, buildExcelFileName, type ExcelColumn } from '@/lib/excel-export'
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

  const [searchTerm, setSearchTerm] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // URL에 ?action=new 가 있으면 신규 발주 다이얼로그 자동 오픈
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('action') === 'new') {
      setIsDialogOpen(true)
    }
  }, [])
  const [orders, setOrders] = useState<Order[]>([])
  const [storedEquipment, setStoredEquipment] = useState<StoredEquipment[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchOrders(), fetchStoredEquipment()]).then(([ordersData, equipmentData]) => {
      setOrders(ordersData)
      setStoredEquipment(equipmentData)
      setIsLoading(false)
    })
  }, [])

  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [orderToView, setOrderToView] = useState<Order | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null)
  const [affiliateFilter, setAffiliateFilter] = useState<string>('all')
  const [sortOrder, setSortOrder] = useState<string>('latest')

  /** 신규 발주 등록 */
  const handleSubmit = async (data: OrderFormData) => {
    setIsSubmitting(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { orderNumber: _orderNumber, ...orderData } = data
      const newOrder: Order = {
        id: Date.now().toString(),
        ...orderData,
        status: 'received',
        createdAt: new Date().toISOString(),
        isPreliminaryQuote: data.isPreliminaryQuote
      }
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

  const handleCardClick = (order: Order) => {
    setOrderToView(order)
    setDetailDialogOpen(true)
  }

  /** 발주 삭제 */
  const handleDelete = async (orderId: string) => {
    const orderToDelete = orders.find(o => o.id === orderId)
    const equipmentIds = (orderToDelete?.items || [])
      .filter(item => item.workType === '재고설치' && item.storedEquipmentId)
      .map(item => item.storedEquipmentId!)

    const success = await deleteOrderDB(orderId)
    if (success) {
      if (equipmentIds.length > 0) {
        await Promise.all(
          equipmentIds.map(eqId => updateStoredEquipment(eqId, { status: 'stored' }))
        )
        setStoredEquipment(prev =>
          prev.map(eq => equipmentIds.includes(eq.id) ? { ...eq, status: 'stored' as const } : eq)
        )
      }
      setOrders(orders.filter(o => o.id !== orderId))
      showAlert('발주가 삭제되었습니다.', 'success')
    } else {
      showAlert('발주 삭제에 실패했습니다.', 'error')
    }
  }

  /** 발주 취소 */
  const handleCancelOrder = async (orderId: string, reason: string) => {
    const success = await cancelOrderDB(orderId, reason)
    if (success) {
      const cancelledOrder = orders.find(o => o.id === orderId)
      const equipmentIds = (cancelledOrder?.items || [])
        .filter(item => item.workType === '재고설치' && item.storedEquipmentId)
        .map(item => item.storedEquipmentId!)

      if (equipmentIds.length > 0) {
        await Promise.all(
          equipmentIds.map(eqId => updateStoredEquipment(eqId, { status: 'stored' }))
        )
        setStoredEquipment(prev =>
          prev.map(eq => equipmentIds.includes(eq.id) ? { ...eq, status: 'stored' as const } : eq)
        )
      }

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

  const handleEdit = (order: Order) => {
    setOrderToEdit(order)
    setEditDialogOpen(true)
    setDetailDialogOpen(false)
  }

  /** 발주 수정 */
  const handleEditSubmit = async (data: OrderFormData) => {
    if (!orderToEdit) return
    setIsSubmitting(true)
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { orderNumber: _orderNumber, ...orderData } = data
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

  /** 필터링 + 정렬 */
  const filteredOrders = orders
    .filter((order) => {
      const kanbanStatus = computeKanbanStatus(order)
      if (kanbanStatus === 'settled' || kanbanStatus === 'cancelled') return false
      if (affiliateFilter !== 'all' && order.affiliate !== affiliateFilter) return false
      const matchesSearch =
        order.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.documentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.affiliate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.businessName.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesSearch
    })
    .sort((a, b) => {
      if (sortOrder === 'latest') {
        return new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
      } else if (sortOrder === 'oldest') {
        return new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime()
      }
      return 0
    })

  /** 칸반 그룹 */
  const groupedOrders: Record<OrderStatus, Order[]> = {
    'received': filteredOrders.filter(o => computeKanbanStatus(o) === 'received'),
    'in-progress': filteredOrders.filter(o => computeKanbanStatus(o) === 'in-progress'),
    'completed': filteredOrders.filter(o => computeKanbanStatus(o) === 'completed'),
    'settled': [],
    'cancelled': [],
  }

  const totalOrders = filteredOrders.length

  /** 엑셀 다운로드 — 필터된 전체 발주를 추출 */
  const handleExcelExport = () => {
    const columns: ExcelColumn<Order>[] = [
      { header: '문서번호', key: 'documentNumber', width: 16 },
      { header: '진행상태', getValue: (o) => {
        const s = computeKanbanStatus(o)
        return s === 'received' ? '접수중' : s === 'in-progress' ? '진행중' : s === 'completed' ? '완료' : s
      }, width: 10 },
      { header: '계열사', key: 'affiliate', width: 14 },
      { header: '사업자명', key: 'businessName', width: 20 },
      { header: '주소', key: 'address', width: 30 },
      { header: '발주일', key: 'orderDate', width: 12 },
      { header: '설치요청일', key: 'requestedInstallDate', width: 12 },
      { header: '작업종류', getValue: (o) => o.items.map(i => i.workType).join(', '), width: 18 },
      { header: '품목', getValue: (o) => o.items.map(i => i.category).join(', '), width: 18 },
      { header: '담당자', key: 'contactName', width: 10 },
      { header: '연락처', key: 'contactPhone', width: 14 },
    ]
    exportToExcel({
      data: filteredOrders,
      columns,
      fileName: buildExcelFileName('발주관리'),
    })
  }

  // 스켈레톤 로딩
  if (isLoading) {
    return (
      <div className="container mx-auto max-w-[1400px] py-6 px-4 md:px-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="flex gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="w-72 space-y-2">
              <Skeleton className="h-8 w-full rounded-xl" />
              {[...Array(3)].map((_, j) => <Skeleton key={j} className="h-24 w-full rounded-xl" />)}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-[1400px] py-6 px-4 md:px-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
          <ClipboardList className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">발주 관리</h1>
          <p className="text-muted-foreground mt-0.5">진행상태별로 한눈에 확인하세요</p>
        </div>
      </div>

      {/* 검색 + 필터 영역 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6 space-y-4">
        {/* 검색창 */}
        <div className="relative max-w-lg">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="주소, 문서번호, 계열사, 사업자명으로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-lg bg-white border-slate-200"
          />
        </div>

        {/* 필터/정렬/등록 */}
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={affiliateFilter} onValueChange={setAffiliateFilter}>
            <SelectTrigger className="w-[160px] rounded-lg">
              <SelectValue placeholder="계열사" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 계열사</SelectItem>
              {AFFILIATE_OPTIONS.map((affiliate) => (
                <SelectItem key={affiliate} value={affiliate}>{affiliate}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-[140px] rounded-lg">
              <SelectValue placeholder="정렬" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">최신순</SelectItem>
              <SelectItem value="oldest">오래된순</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />

          <ExcelExportButton onClick={handleExcelExport} disabled={filteredOrders.length === 0} />

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-lg">+ 신규 발주</Button>
            </DialogTrigger>
            <DialogContent
              className="max-w-3xl max-h-[90vh] overflow-y-auto"
              onInteractOutside={(e) => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle>신규 발주 등록</DialogTitle>
              </DialogHeader>
              <OrderForm
                onSubmit={handleSubmit}
                onCancel={() => setIsDialogOpen(false)}
                isSubmitting={isSubmitting}
                storedEquipment={storedEquipment}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* 검색 결과 개수 */}
        <p className="text-sm text-slate-500">
          총 {totalOrders}건의 발주
          {(searchTerm || affiliateFilter !== 'all') && (
            <span className="text-blue-600 font-medium ml-2">
              (필터링: {filteredOrders.length}건)
            </span>
          )}
        </p>
      </div>

      {/* 칸반보드 + 과거내역 */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        <div className="flex gap-4 flex-shrink-0">
          <KanbanColumn title="접수중" status="received" orders={groupedOrders['received']} onCardClick={handleCardClick} />
          <KanbanColumn title="진행중" status="in-progress" orders={groupedOrders['in-progress']} onCardClick={handleCardClick} />
          <KanbanColumn title="완료 (금월 정산대기중)" status="completed" orders={groupedOrders['completed']} onCardClick={handleCardClick} />
        </div>
        <SettledHistoryPanel orders={orders} onCardClick={handleCardClick} />
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
              onCancel={() => { setEditDialogOpen(false); setOrderToEdit(null) }}
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
              storedEquipment={storedEquipment}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** 칸반 컬럼 */
interface KanbanColumnProps {
  title: string
  status: OrderStatus
  orders: Order[]
  onCardClick: (order: Order) => void
}

function KanbanColumn({ title, status, orders, onCardClick }: KanbanColumnProps) {
  const columnStyles: Record<OrderStatus, { bg: string; stripe: string }> = {
    'received': { bg: 'bg-amber-50/50', stripe: 'border-t-4 border-t-amber-400' },
    'in-progress': { bg: 'bg-blue-50/50', stripe: 'border-t-4 border-t-blue-400' },
    'completed': { bg: 'bg-violet-50/50', stripe: 'border-t-4 border-t-violet-400' },
    'settled': { bg: 'bg-emerald-50/50', stripe: 'border-t-4 border-t-emerald-400' },
    'cancelled': { bg: 'bg-red-50/50', stripe: 'border-t-4 border-t-red-400' },
  }

  const style = columnStyles[status]

  return (
    <div className={`flex-shrink-0 w-72 ${style.bg} ${style.stripe} rounded-xl shadow-sm p-3`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm">{title}</h2>
        <Badge variant="outline" className="bg-white text-xs">
          {orders.length}건
        </Badge>
      </div>
      <div className="space-y-2 max-h-[calc(100vh-350px)] overflow-y-auto">
        {orders.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">
            발주가 없습니다
          </p>
        ) : (
          orders.map((order) => (
            <OrderCard key={order.id} order={order} onClick={onCardClick} />
          ))
        )}
      </div>
    </div>
  )
}
