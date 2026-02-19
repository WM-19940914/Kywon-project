/**
 * 재고 관리 페이지
 *
 * 창고별 재고 현황 조회
 */

'use client'

import React, { useState, useEffect } from 'react'
import { fetchOrders, fetchWarehouses, fetchInventoryEvents } from '@/lib/supabase/dal'
import type { Order, InventoryEvent } from '@/types/order'
import type { Warehouse } from '@/types/warehouse'
import { Skeleton } from '@/components/ui/skeleton'
import { Package } from 'lucide-react'
import { useAlert } from '@/components/ui/custom-alert'
import { InventoryWarehouseView } from '@/components/inventory/inventory-warehouse-view'

export default function InventoryPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { showAlert } = useAlert()

  const [orders, setOrders] = useState<Order[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [events, setEvents] = useState<InventoryEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)

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

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-[1400px] py-6 px-4 md:px-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-11 w-11 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-8 w-16" />
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
        <div className="bg-teal-50 text-teal-600 p-2.5 rounded-xl">
          <Package className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">재고 관리</h1>
          <p className="text-muted-foreground mt-0.5">창고별 재고 현황을 조회합니다</p>
        </div>
      </div>

      <InventoryWarehouseView
        orders={orders}
        warehouses={warehouses}
        events={events}
      />
    </div>
  )
}
