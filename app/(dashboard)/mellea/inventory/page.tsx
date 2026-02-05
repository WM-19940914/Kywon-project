/**
 * 재고 관리 페이지
 *
 * 창고별 재고 현황 조회
 * - 입고된 장비를 창고별로 조회
 * - 유휴재고 / 입고내역 / 설치완료 상태 자동 계산
 */

'use client'

import React, { useState, useEffect } from 'react'
import { fetchOrders, fetchWarehouses, fetchInventoryEvents } from '@/lib/supabase/dal'
import type { Order, InventoryEvent } from '@/types/order'
import type { Warehouse } from '@/types/warehouse'
import { Card, CardContent } from '@/components/ui/card'
import { Package } from 'lucide-react'
import { useAlert } from '@/components/ui/custom-alert'
import { InventoryWarehouseView } from '@/components/inventory/inventory-warehouse-view'

export default function InventoryPage() {
  const { showAlert } = useAlert()

  // 데이터 로딩 상태
  const [orders, setOrders] = useState<Order[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [events, setEvents] = useState<InventoryEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // 데이터 로딩
  useEffect(() => {
    Promise.all([
      fetchOrders(),
      fetchWarehouses(),
      fetchInventoryEvents(),
    ]).then(([ordersData, warehousesData, eventsData]) => {
      setOrders(ordersData)
      setWarehouses(warehousesData)
      setEvents(eventsData)
      setIsLoading(false)
    })
  }, [])

  return (
    <div className="container mx-auto py-8 px-4">
      {/* 페이지 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
          <Package className="h-6 w-6 text-primary" /> 재고 관리
        </h1>
        <p className="text-muted-foreground">창고별 재고 현황을 조회합니다.</p>
      </div>

      {/* 본문 */}
      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-400">
            데이터를 불러오는 중...
          </CardContent>
        </Card>
      ) : (
        <InventoryWarehouseView
          orders={orders}
          warehouses={warehouses}
          events={events}
        />
      )}
    </div>
  )
}
