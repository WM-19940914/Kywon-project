/**
 * 발주 목록 페이지 (칸반보드 3단계 형태)
 *
 * 진행상태별로 3개 컬럼을 나누어 한눈에 보기 쉽게!
 * 접수중 → 진행중 → 완료 순서로 표시됩니다.
 * 마치 "할일판"처럼, 각 단계별로 어떤 발주가 있는지 바로 알 수 있어요.
 */

'use client'

import { useState } from 'react'
import { mockOrders } from '@/lib/mock-data'
import { type Order, type OrderStatus, type CustomerQuote } from '@/types/order'
import { OrderForm, type OrderFormData } from '@/components/orders/order-form'
import { OrderCard } from '@/components/orders/order-card'
import { OrderDetailDialog } from '@/components/orders/order-detail-dialog'
import { QuoteCreateDialog } from '@/components/quotes/quote-create-dialog'
import { SettledHistoryPanel } from '@/components/orders/settled-history-panel'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LayoutGrid, List } from 'lucide-react'
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
  // 상태 관리
  const [searchTerm, setSearchTerm] = useState('') // 검색어
  const [isDialogOpen, setIsDialogOpen] = useState(false) // 신규 등록 모달
  const [orders, setOrders] = useState(mockOrders) // 발주 목록
  const [isSubmitting, setIsSubmitting] = useState(false) // 제출 중 상태

  // 상세보기 모달 상태
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [orderToView, setOrderToView] = useState<Order | null>(null)

  // 수정 모달 상태
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [orderToEdit, setOrderToEdit] = useState<Order | null>(null)

  // 견적서 작성 모달 상태
  const [quoteCreateDialogOpen, setQuoteCreateDialogOpen] = useState(false)
  const [orderForQuote, setOrderForQuote] = useState<Order | null>(null)

  // 필터/정렬 상태
  const [affiliateFilter, setAffiliateFilter] = useState<string>('all') // 계열사 필터
  const [sortOrder, setSortOrder] = useState<string>('latest') // 정렬 순서

  /**
   * 신규 발주 등록 핸들러
   */
  const handleSubmit = async (data: OrderFormData) => {
    setIsSubmitting(true)

    try {
      const newOrder: Order = {
        id: Date.now().toString(),
        ...data,
        status: 'received', // 신규 발주는 항상 '접수중'으로 시작
        createdAt: new Date().toISOString(),
        isPreliminaryQuote: data.isPreliminaryQuote  // 🔥 추가
      }

      setOrders([newOrder, ...orders])
      alert('발주가 등록되었습니다!')
      setIsDialogOpen(false)
    } catch (error) {
      console.error('발주 등록 실패:', error)
      alert('발주 등록에 실패했습니다.')
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
   * 진행상태 변경 핸들러
   */
  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    setOrders(orders.map(o =>
      o.id === orderId ? { ...o, status: newStatus } : o
    ))
    alert('진행상태가 변경되었습니다!')
  }

  /**
   * 발주 삭제 핸들러
   */
  const handleDelete = (orderId: string) => {
    setOrders(orders.filter(o => o.id !== orderId))
    alert('발주가 삭제되었습니다.')
  }

  /**
   * 견적서 작성/수정 버튼 클릭 핸들러
   */
  const handleQuoteCreate = (order: Order) => {
    setOrderForQuote(order)
    setQuoteCreateDialogOpen(true)
    setDetailDialogOpen(false)  // 상세 모달 닫기
  }

  /**
   * 견적서 저장 핸들러
   *
   * QuoteCreateDialog에서 "저장" 버튼을 누르면 여기로 데이터가 전달됩니다.
   * 발주(Order)의 customerQuote 필드에 견적서 데이터를 저장해요.
   *
   * @param orderId - 발주 ID
   * @param quote - 저장할 견적서 데이터
   */
  const handleQuoteSave = (orderId: string, quote: CustomerQuote) => {
    setOrders(prev => prev.map(order =>
      order.id === orderId
        ? { ...order, customerQuote: quote }  // 해당 발주의 customerQuote 필드 업데이트
        : order
    ))
    console.log('✅ 견적서 저장됨:', { orderId, quote })
  }

  /**
   * 견적서 저장 후 목록 새로고침
   */
  const handleRefresh = () => {
    // 실제로는 Supabase에서 다시 불러와야 하지만
    // 지금은 더미 데이터라서 현재 orders 상태를 그대로 유지
    setOrderForQuote(null)
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
      const updatedOrder: Order = {
        ...orderToEdit,
        ...data,
        // id, createdAt, status 등은 유지
      }

      setOrders(orders.map(o => o.id === orderToEdit.id ? updatedOrder : o))
      alert('발주가 수정되었습니다!')
      setEditDialogOpen(false)
      setOrderToEdit(null)
    } catch (error) {
      console.error('수정 실패:', error)
      alert('수정에 실패했습니다.')
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
      // 1. 정산완료 제외
      if (order.status === 'settled') return false

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
   * 진행상태별로 그룹화 (3단계)
   */
  const groupedOrders: Record<OrderStatus, Order[]> = {
    'received': filteredOrders.filter(o => o.status === 'received'),
    'in-progress': filteredOrders.filter(o => o.status === 'in-progress'),
    'completed': filteredOrders.filter(o => o.status === 'completed'),
    'settled': [] // 정산완료는 별도 페이지
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

        {/* 오른쪽: 과거내역 패널 */}
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
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
        onEdit={handleEdit}
        onQuoteInput={handleQuoteCreate}
      />

      {/* 견적서 작성/수정 모달 */}
      <QuoteCreateDialog
        order={orderForQuote}
        open={quoteCreateDialogOpen}
        onOpenChange={setQuoteCreateDialogOpen}
        onSuccess={handleRefresh}
        onSave={handleQuoteSave}  // 견적서 저장 핸들러 연결
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
    'settled': { bg: 'bg-emerald-50/70', stripe: 'border-t-4 border-t-emerald-400' }
  }

  const style = columnStyles[status]

  return (
    <div className={`flex-shrink-0 w-80 ${style.bg} ${style.stripe} rounded-xl p-4`}>
      {/* 컬럼 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-base">{title}</h2>
        <Badge variant="outline" className="bg-white">
          {orders.length}건
        </Badge>
      </div>

      {/* 카드 리스트 */}
      <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto">
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
