/**
 * 발주 관리 페이지 (칸반보드 + 과거내역/취소 탭 전환)
 *
 * 컴팩트 1줄 툴바 + 3가지 뷰 탭:
 * - 진행중: 3컬럼 칸반보드 (신규접수 / 설치예정 / 설치완료)
 * - 과거내역: 전체 너비 그리드 (정산완료 건)
 * - 취소: 전체 너비 그리드 (취소 건)
 */

'use client'

import { useState, useEffect } from 'react'
import { fetchOrders, createOrder as createOrderDB, updateOrder as updateOrderDB, deleteOrder as deleteOrderDB, cancelOrder as cancelOrderDB, fetchStoredEquipment, updateStoredEquipment, saveCustomerQuote } from '@/lib/supabase/dal'
import { type Order, type OrderStatus, type StoredEquipment, type CustomerQuote } from '@/types/order'
import { computeKanbanStatus } from '@/lib/order-status-utils'
import { OrderForm, type OrderFormData } from '@/components/orders/order-form'
import { OrderCard } from '@/components/orders/order-card'
import { OrderDetailDialog } from '@/components/orders/order-detail-dialog'
import { QuoteCreateDialog } from '@/components/quotes/quote-create-dialog'
import { SettledHistoryPanel } from '@/components/orders/settled-history-panel'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, ClipboardList, Plus } from 'lucide-react'
import { useAlert } from '@/components/ui/custom-alert'
import { ExcelExportButton } from '@/components/ui/excel-export-button'
import { exportMultiSheetExcel, buildExcelFileName, type ExcelColumn } from '@/lib/excel-export'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AFFILIATE_OPTIONS } from '@/types/order'

/** 뷰 탭 타입 */
type ViewTab = 'active' | 'history' | 'cancelled'

export default function OrdersPage() {
  const { showAlert } = useAlert()

  const [searchTerm, setSearchTerm] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [viewTab, setViewTab] = useState<ViewTab>('active')

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
  // 삭제/취소 등 비동기 액션 중복 실행 방지
  const [actionLoading, setActionLoading] = useState(false)

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
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false)
  const [orderForQuote, setOrderForQuote] = useState<Order | null>(null)

  /** 견적서 보기/작성 */
  const handleQuoteView = (order: Order) => {
    setOrderForQuote(order)
    setQuoteDialogOpen(true)
  }

  /** 견적서 저장 */
  const handleQuoteSave = async (orderId: string, quote: CustomerQuote) => {
    await saveCustomerQuote(orderId, quote)
    setOrders(prev => prev.map(o =>
      o.id === orderId ? { ...o, customerQuote: quote } : o
    ))
  }

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
    if (actionLoading) return
    setActionLoading(true)
    try {
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
    } finally {
      setActionLoading(false)
    }
  }

  /** 발주 취소 */
  const handleCancelOrder = async (orderId: string, reason: string) => {
    if (actionLoading) return
    setActionLoading(true)
    try {
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
    } finally {
      setActionLoading(false)
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

  /** 필터링 + 정렬 (진행중 칸반용) */
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

  /** 엑셀 다운로드 — 활성 발주 + 과거내역 + 발주취소 3시트 */
  const handleExcelExport = () => {
    const baseColumns: ExcelColumn<Order>[] = [
      { header: '문서번호', key: 'documentNumber', width: 16 },
      { header: '진행상태', getValue: (o) => {
        const s = computeKanbanStatus(o)
        return s === 'received' ? '접수중' : s === 'in-progress' ? '진행중' : s === 'completed' ? '완료' : s === 'settled' ? '정산완료' : s
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

    const cancelledColumns: ExcelColumn<Order>[] = [
      ...baseColumns,
      { header: '취소사유', getValue: (o) => o.cancelReason ?? '', width: 20 },
      { header: '취소일', getValue: (o) => o.cancelledAt ? o.cancelledAt.slice(0, 10) : '', width: 12 },
    ]

    const settledOrders = orders.filter(o => computeKanbanStatus(o) === 'settled')
    const cancelledOrders = orders.filter(o => computeKanbanStatus(o) === 'cancelled')

    exportMultiSheetExcel({
      sheets: [
        {
          sheetName: '발주현황',
          data: filteredOrders,
          columns: baseColumns,
        },
        {
          sheetName: '과거내역(정산완료)',
          data: settledOrders,
          columns: baseColumns,
        },
        {
          sheetName: '발주취소',
          data: cancelledOrders,
          columns: cancelledColumns,
        },
      ],
      fileName: buildExcelFileName('발주관리'),
    })
  }

  // 스켈레톤 로딩
  if (isLoading) {
    return (
      <div className="container mx-auto max-w-[1400px] py-6 px-4 md:px-6 space-y-4">
        {/* 툴바 스켈레톤 */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-5 w-10" />
          <Skeleton className="h-8 w-56 rounded-lg" />
          <div className="flex-1" />
          <Skeleton className="h-9 w-48" />
        </div>
        {/* 칸반 스켈레톤 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-muted/40 rounded-xl p-3 space-y-2">
              <Skeleton className="h-6 w-full" />
              {[...Array(3)].map((_, j) => <Skeleton key={j} className="h-20 w-full rounded-lg" />)}
            </div>
          ))}
        </div>
      </div>
    )
  }

  /** 뷰 탭 버튼 */
  const tabItems: { key: ViewTab; label: string }[] = [
    { key: 'active', label: '진행중' },
    { key: 'history', label: '과거내역' },
    { key: 'cancelled', label: '취소' },
  ]

  return (
    <div className="container mx-auto max-w-[1400px] py-6 px-4 md:px-6 space-y-6">
      {/* 페이지 헤더 — AS 페이지와 스타일 통일 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-2">
        <div className="space-y-1">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <div className="p-2 bg-[#E09520] rounded-xl shadow-lg shadow-orange-200">
              <ClipboardList className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            설치 발주 및 현황
          </h1>
          <p className="text-[13.5px] font-medium text-slate-400 pl-11">
            교원그룹 에어컨 설치 발주 내역을 확인하고 진행 상태를 실시간으로 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExcelExportButton onClick={handleExcelExport} disabled={filteredOrders.length === 0} />
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#E09520] hover:bg-[#c87d1a] text-white font-black rounded-xl px-4 h-9.5 shadow-md shadow-orange-100 transition-all active:scale-95 text-[13px]">
                <Plus className="h-4 w-4 mr-1.5" strokeWidth={3} />
                신규 발주
              </Button>
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
      </div>

      {/* 툴바 필터 영역 */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 flex flex-wrap items-center gap-3">
        {/* 뷰 탭 (pill 형태) */}
        <div className="flex bg-slate-100 rounded-xl p-1">
          {tabItems.map((tab) => (
            <button
              key={tab.key}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all
                ${viewTab === tab.key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'}`}
              onClick={() => setViewTab(tab.key)}
            >
              {tab.label}
              {viewTab === tab.key && tab.key === 'active' && (
                <span className="ml-1.5 opacity-50">{totalOrders}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="문서번호, 사업자명, 주소 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 bg-slate-50/50 border-slate-200 rounded-xl focus:bg-white transition-all"
          />
        </div>

        {viewTab === 'active' && (
          <div className="flex items-center gap-2">
            <Select value={affiliateFilter} onValueChange={setAffiliateFilter}>
              <SelectTrigger className="w-[140px] h-10 rounded-xl border-slate-200 bg-slate-50/50">
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
              <SelectTrigger className="w-[110px] h-10 rounded-xl border-slate-200 bg-slate-50/50">
                <SelectValue placeholder="정렬" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">최신순</SelectItem>
                <SelectItem value="oldest">오래된순</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* 탭 기반 뷰 전환 */}
      {viewTab === 'active' ? (
        /* 진행중: 3컬럼 칸반보드 */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KanbanColumn title="신규접수" status="received" orders={groupedOrders['received']} onCardClick={handleCardClick} />
          <KanbanColumn title="설치예정" status="in-progress" orders={groupedOrders['in-progress']} onCardClick={handleCardClick} />
          <KanbanColumn title="설치완료" status="completed" orders={groupedOrders['completed']} onCardClick={handleCardClick} subtitle="아직 정산이 되지 않은 건입니다" />
        </div>
      ) : viewTab === 'history' ? (
        <SettledHistoryPanel orders={orders} onCardClick={handleCardClick} mode="history" />
      ) : (
        <SettledHistoryPanel orders={orders} onCardClick={handleCardClick} mode="cancelled" />
      )}

      {/* 상세보기 모달 */}
      <OrderDetailDialog
        order={orderToView}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onDelete={handleDelete}
        onEdit={handleEdit}
        onCancelOrder={handleCancelOrder}
        onQuoteView={handleQuoteView}
        storedEquipment={storedEquipment}
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
                contacts: orderToEdit.contacts,
                buildingManagers: orderToEdit.buildingManagers,
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

      {/* 견적서 보기/작성 다이얼로그 */}
      <QuoteCreateDialog
        order={orderForQuote}
        open={quoteDialogOpen}
        onOpenChange={setQuoteDialogOpen}
        onSave={handleQuoteSave}
        readOnly
      />
    </div>
  )
}

/** 칸반 컬럼 (상태별 색상 뱃지 + 컬러 보더) */
interface KanbanColumnProps {
  title: string
  status: OrderStatus
  orders: Order[]
  onCardClick: (order: Order) => void
  subtitle?: string
}

/** 컬럼별 스타일 (뱃지 색상, 상단 보더, 배경 틴트) */
const COLUMN_STYLES: Record<string, { badge: string; border: string; bg: string; countBg: string }> = {
  'received': {
    badge: 'bg-amber-100 text-amber-700 border border-amber-200',
    border: 'border-t-2 border-t-amber-400',
    bg: 'bg-amber-50/30',
    countBg: 'bg-amber-100 text-amber-700',
  },
  'in-progress': {
    badge: 'bg-blue-100 text-blue-700 border border-blue-200',
    border: 'border-t-2 border-t-blue-400',
    bg: 'bg-blue-50/30',
    countBg: 'bg-blue-100 text-blue-700',
  },
  'completed': {
    badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    border: 'border-t-2 border-t-emerald-400',
    bg: 'bg-emerald-50/30',
    countBg: 'bg-emerald-100 text-emerald-700',
  },
}

function KanbanColumn({ title, status, orders, onCardClick, subtitle }: KanbanColumnProps) {
  const style = COLUMN_STYLES[status] || {
    badge: 'bg-gray-100 text-gray-600',
    border: 'border-t-2 border-t-gray-300',
    bg: 'bg-muted/40',
    countBg: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className={`${style.bg} ${style.border} rounded-xl p-3 min-h-[200px]`}>
      {/* 컬럼 헤더: 컬러 뱃지 + 건수 */}
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${style.badge}`}>
            {title}
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[28px] text-center ${style.countBg}`}>
            {orders.length}
          </span>
        </div>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground mt-1.5 pl-0.5">{subtitle}</p>
        )}
      </div>

      {/* 카드 목록 */}
      <div className="space-y-2.5 max-h-[calc(100vh-200px)] overflow-y-auto kanban-scroll">
        {orders.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">발주가 없습니다</p>
        ) : (
          orders.map((order) => (
            <OrderCard key={order.id} order={order} onClick={onCardClick} />
          ))
        )}
      </div>
    </div>
  )
}
