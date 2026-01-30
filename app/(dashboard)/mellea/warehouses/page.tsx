/**
 * 창고 관리 페이지
 *
 * 장비를 보관하는 창고들을 관리하는 페이지입니다.
 * - 창고 목록 조회
 * - 창고별 재고 현황 확인
 */

'use client'

import { useState } from 'react'
import { mockWarehouses } from '@/lib/warehouse-data'
import type { Warehouse } from '@/types/warehouse'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Warehouse as WarehouseIcon, MapPin, User, Phone, Package } from 'lucide-react'

export default function WarehousesPage() {
  const [warehouses] = useState<Warehouse[]>(mockWarehouses)
  const [searchTerm, setSearchTerm] = useState('')

  // 검색 필터
  const filteredWarehouses = warehouses.filter(warehouse =>
    warehouse.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    warehouse.address.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 재고율 계산 (현재재고 / 수용가능용량 * 100)
  const getStockRate = (warehouse: Warehouse) => {
    if (!warehouse.capacity || !warehouse.currentStock) return 0
    return Math.round((warehouse.currentStock / warehouse.capacity) * 100)
  }

  // 재고율에 따른 색상
  const getStockColor = (rate: number) => {
    if (rate >= 80) return 'text-red-600 bg-red-50'
    if (rate >= 50) return 'text-yellow-600 bg-yellow-50'
    return 'text-green-600 bg-green-50'
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* 페이지 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-1 flex items-center gap-2">
          <WarehouseIcon className="h-6 w-6" />
          창고 관리
        </h1>
        <p className="text-muted-foreground">장비 보관 창고 현황을 확인하세요</p>
      </div>

      {/* 검색 영역 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <Input
            placeholder="창고명, 주소로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <p className="text-sm text-gray-500 mt-3">
            총 {filteredWarehouses.length}개 창고
          </p>
        </CardContent>
      </Card>

      {/* 창고 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredWarehouses.map(warehouse => {
          const stockRate = getStockRate(warehouse)

          return (
            <Card key={warehouse.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 space-y-4">
                {/* 창고명 + 재고율 */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-foreground mb-1">
                      {warehouse.name}
                    </h3>
                    {warehouse.capacity && warehouse.currentStock && (
                      <Badge className={getStockColor(stockRate)}>
                        재고율 {stockRate}%
                      </Badge>
                    )}
                  </div>
                  <WarehouseIcon className="h-8 w-8 text-blue-500" />
                </div>

                {/* 주소 */}
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                  <span className="text-gray-700">{warehouse.address}</span>
                </div>

                {/* 담당자 정보 */}
                {warehouse.managerName && (
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{warehouse.managerName}</span>
                    </div>
                    {warehouse.managerPhone && (
                      <div className="flex items-center gap-2 ml-6">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span className="text-gray-600">{warehouse.managerPhone}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* 재고 정보 */}
                {warehouse.capacity && warehouse.currentStock && (
                  <div className="pt-3 border-t">
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-gray-600 flex items-center gap-1">
                        <Package className="h-4 w-4" />
                        재고 현황
                      </span>
                      <span className="font-semibold">
                        {warehouse.currentStock} / {warehouse.capacity}
                      </span>
                    </div>
                    {/* 재고율 프로그레스 바 */}
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          stockRate >= 80 ? 'bg-red-500' :
                          stockRate >= 50 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${stockRate}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* 비고 */}
                {warehouse.notes && (
                  <div className="pt-3 border-t">
                    <p className="text-xs text-gray-600">
                      💡 {warehouse.notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
