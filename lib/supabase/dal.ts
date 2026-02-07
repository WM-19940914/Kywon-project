/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Data Access Layer (DAL) — Supabase DB 조회/저장 함수 모음
 *
 * 모든 DB 호출은 이 파일을 통해서 합니다.
 * "데이터를 가져오는 택배 기사" 같은 역할이에요!
 *
 * 사용법:
 *   import { fetchOrders, updateOrder } from '@/lib/supabase/dal'
 *   const orders = await fetchOrders()
 */

import { createClient } from '@/lib/supabase/client'
import { toCamelCase, toSnakeCase } from '@/lib/supabase/transforms'
import type { Order, OrderItem, EquipmentItem, InstallationCostItem, CustomerQuote, QuoteItem, S1SettlementStatus, ReviewStatus, InventoryEvent, InventoryEventType } from '@/types/order'
import type { Warehouse } from '@/types/warehouse'

// ============================================================
// 🏠 창고 (Warehouses)
// ============================================================

/**
 * 모든 창고 목록 가져오기
 * @returns 창고 배열
 */
export async function fetchWarehouses(): Promise<Warehouse[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('warehouses')
    .select('*')
    .order('id')

  if (error) {
    console.error('창고 목록 조회 실패:', error.message)
    return []
  }

  return toCamelCase<Warehouse[]>(data)
}

/**
 * 창고 추가
 * @param warehouse - 새 창고 정보
 */
export async function createWarehouse(warehouse: Warehouse): Promise<Warehouse | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('warehouses')
    .insert(toSnakeCase(warehouse))
    .select()
    .single()

  if (error) {
    console.error('창고 추가 실패:', error.message)
    return null
  }

  return toCamelCase<Warehouse>(data)
}

/**
 * 창고 정보 수정
 * @param id - 창고 ID
 * @param updates - 수정할 필드들
 */
export async function updateWarehouse(id: string, updates: Partial<Warehouse>): Promise<Warehouse | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('warehouses')
    .update(toSnakeCase(updates))
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('창고 수정 실패:', error.message)
    return null
  }

  return toCamelCase<Warehouse>(data)
}

/**
 * 창고 삭제
 * @param id - 창고 ID
 */
export async function deleteWarehouse(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('warehouses')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('창고 삭제 실패:', error.message)
    return false
  }

  return true
}

// ============================================================
// 📦 발주 (Orders) — 메인 CRUD
// ============================================================

/**
 * DB에서 가져온 발주 데이터를 프론트엔드 Order 타입으로 변환
 *
 * DB는 관계형이라 order_items, equipment_items 등이 별도 테이블에 있지만,
 * 프론트엔드의 Order 타입은 이걸 하나의 객체 안에 중첩으로 가지고 있어요.
 * 이 함수가 그 변환을 해줍니다!
 */
function transformOrderFromDB(dbOrder: Record<string, unknown>): Order {
  // 1단계: 메인 필드들 camelCase로 변환
  const order = toCamelCase<Record<string, unknown>>(dbOrder)

  // 2단계: 관계 테이블 데이터를 중첩 구조로 변환
  // Supabase의 select('*, order_items(*)')로 가져오면
  // { ..., order_items: [...] } 형태로 들어옵니다

  // order_items → items 배열
  const rawItems = (dbOrder.order_items as Record<string, unknown>[]) || []
  const items: OrderItem[] = rawItems.map(item => toCamelCase<OrderItem>(item))

  // equipment_items → equipmentItems 배열
  const rawEquipment = (dbOrder.equipment_items as Record<string, unknown>[]) || []
  const equipmentItems: EquipmentItem[] = rawEquipment.map(item => toCamelCase<EquipmentItem>(item))

  // installation_cost_items → installationCost 객체
  const rawInstallCost = (dbOrder.installation_cost_items as Record<string, unknown>[]) || []
  const installCostItems: InstallationCostItem[] = rawInstallCost.map(item => toCamelCase<InstallationCostItem>(item))

  // customer_quotes → customerQuote 객체 (1:1 관계)
  const rawQuotes = dbOrder.customer_quotes as Record<string, unknown>[] | Record<string, unknown> | null
  let customerQuote: CustomerQuote | undefined
  if (rawQuotes) {
    // select로 가져오면 배열 또는 단일 객체
    const quoteData = Array.isArray(rawQuotes) ? rawQuotes[0] : rawQuotes
    if (quoteData) {
      const rawQuoteItems = (quoteData.quote_items as Record<string, unknown>[]) || []
      const quoteItems: QuoteItem[] = rawQuoteItems.map(item => toCamelCase<QuoteItem>(item))
      const quoteBase = toCamelCase<Record<string, unknown>>(quoteData)
      customerQuote = {
        items: quoteItems,
        totalAmount: (quoteBase.totalAmount as number) || 0,
        issuedDate: quoteBase.issuedDate as string | undefined,
        validUntil: quoteBase.validUntil as string | undefined,
        notes: quoteBase.notes as string | undefined,
      }
    }
  }

  // 3단계: 최종 Order 객체 조합
  const result: Order = {
    ...(order as unknown as Order),
    items,
    equipmentItems: equipmentItems.length > 0 ? equipmentItems : undefined,
    installationCost: installCostItems.length > 0
      ? { items: installCostItems, totalAmount: installCostItems.reduce((sum, i) => sum + (i.totalPrice || 0), 0) }
      : undefined,
    customerQuote,
  }

  // 관계 테이블 필드 정리 (중복 제거)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resultAny = result as any
  delete resultAny.orderItems
  delete resultAny.equipmentItems_
  delete resultAny.installationCostItems
  delete resultAny.customerQuotes

  return result
}

/**
 * 모든 발주 목록 가져오기 (관련 테이블 포함)
 *
 * Supabase의 "관계 조인" 기능을 사용해서
 * orders + order_items + equipment_items + customer_quotes 를 한 번에 가져옵니다.
 */
export async function fetchOrders(): Promise<Order[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (*),
      equipment_items (*),
      installation_cost_items (*),
      customer_quotes (
        *,
        quote_items (*)
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('발주 목록 조회 실패:', error.message)
    return []
  }

  return (data || []).map(transformOrderFromDB)
}

/**
 * 단일 발주 상세 조회
 * @param id - 발주 ID
 */
export async function fetchOrderById(id: string): Promise<Order | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      order_items (*),
      equipment_items (*),
      installation_cost_items (*),
      customer_quotes (
        *,
        quote_items (*)
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('발주 상세 조회 실패:', error.message)
    return null
  }

  return transformOrderFromDB(data)
}

/**
 * 새 발주 등록
 *
 * 메인 테이블(orders) + 하위 테이블(order_items, equipment_items 등)을
 * 순서대로 INSERT 합니다.
 *
 * @param order - 새 발주 데이터
 * @returns 생성된 발주 (관계 데이터 포함)
 */
export async function createOrder(order: Order): Promise<Order | null> {
  const supabase = createClient()

  // 1단계: orders 메인 테이블 INSERT
  const { items, equipmentItems, installationCost, customerQuote, ...mainFields } = order
  const dbMainFields = toSnakeCase(mainFields)
  // 관계 필드 제거 (DB에 없는 필드)
  delete dbMainFields.profit_margin
  delete dbMainFields.profit_amount

  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert(dbMainFields)
    .select()
    .single()

  if (orderError) {
    console.error('발주 등록 실패:', orderError.message)
    return null
  }

  const orderId = orderData.id

  // 2단계: order_items INSERT
  if (items && items.length > 0) {
    const dbItems = items.map(item => ({
      ...toSnakeCase(item),
      order_id: orderId,
      id: item.id || `${orderId}-${Math.random().toString(36).slice(2, 8)}`
    }))
    const { error } = await supabase.from('order_items').insert(dbItems)
    if (error) console.error('발주 내역 저장 실패:', error.message)
  }

  // 3단계: equipment_items INSERT
  if (equipmentItems && equipmentItems.length > 0) {
    const dbEquipment = equipmentItems.map(item => ({
      ...toSnakeCase(item),
      order_id: orderId,
      id: item.id || `eq-${orderId}-${Math.random().toString(36).slice(2, 8)}`
    }))
    const { error } = await supabase.from('equipment_items').insert(dbEquipment)
    if (error) console.error('구성품 저장 실패:', error.message)
  }

  // 4단계: installation_cost_items INSERT
  if (installationCost?.items && installationCost.items.length > 0) {
    const dbInstall = installationCost.items.map(item => ({
      ...toSnakeCase(item),
      order_id: orderId,
      id: item.id || `ic-${orderId}-${Math.random().toString(36).slice(2, 8)}`
    }))
    const { error } = await supabase.from('installation_cost_items').insert(dbInstall)
    if (error) console.error('설치비 저장 실패:', error.message)
  }

  // 5단계: customer_quotes + quote_items INSERT
  if (customerQuote) {
    await saveCustomerQuote(orderId, customerQuote)
  }

  // 최종: 생성된 발주를 다시 조회해서 반환 (관계 데이터 포함)
  return fetchOrderById(orderId)
}

/**
 * 발주 수정 (메인 필드만)
 *
 * items, equipmentItems 등 관계 데이터는 별도 함수로 저장합니다.
 *
 * @param id - 발주 ID
 * @param updates - 수정할 필드들
 */
export async function updateOrder(id: string, updates: Partial<Order>): Promise<Order | null> {
  const supabase = createClient()

  // 관계 데이터 분리
  const { items, equipmentItems, installationCost, customerQuote, ...mainUpdates } = updates

  // 메인 필드 업데이트
  if (Object.keys(mainUpdates).length > 0) {
    const dbUpdates = toSnakeCase(mainUpdates)
    // 관계 필드 정리
    delete dbUpdates.profit_margin
    delete dbUpdates.profit_amount
    dbUpdates.updated_at = new Date().toISOString()

    const { error } = await supabase
      .from('orders')
      .update(dbUpdates)
      .eq('id', id)

    if (error) {
      console.error('발주 수정 실패:', error.message)
      return null
    }
  }

  // order_items 업데이트 (전체 교체 방식)
  if (items) {
    await saveOrderItems(id, items)
  }

  // equipment_items 업데이트
  if (equipmentItems) {
    await saveEquipmentItems(id, equipmentItems)
  }

  // installation_cost_items 업데이트
  if (installationCost?.items) {
    await saveInstallationCostItems(id, installationCost.items)
  }

  // customer_quote 업데이트
  if (customerQuote) {
    await saveCustomerQuote(id, customerQuote)
  }

  return fetchOrderById(id)
}

/**
 * 발주에 연결된 유휴재고 이벤트 수 조회
 * @param orderId - 발주 ID
 * @returns 유휴재고 이벤트 수
 */
export async function countInventoryEvents(orderId: string): Promise<number> {
  const supabase = createClient()
  const { count, error } = await supabase
    .from('inventory_events')
    .select('*', { count: 'exact', head: true })
    .or(`source_order_id.eq.${orderId},target_order_id.eq.${orderId}`)

  if (error) {
    console.error('유휴재고 이벤트 조회 실패:', error.message)
    return 0
  }
  return count || 0
}

/**
 * 발주 삭제 (유휴재고 이벤트 포함 깔끔 정리)
 *
 * 삭제 순서:
 * 1. inventory_events에서 해당 발주 참조하는 이벤트 삭제
 * 2. orders 삭제 (CASCADE로 order_items, equipment_items 등 자동 삭제)
 *
 * @param id - 발주 ID
 */
export async function deleteOrder(id: string): Promise<boolean> {
  const supabase = createClient()

  // 1. 유휴재고 이벤트 먼저 삭제 (외래키 제약 방지)
  const { error: eventError } = await supabase
    .from('inventory_events')
    .delete()
    .or(`source_order_id.eq.${id},target_order_id.eq.${id}`)

  if (eventError) {
    console.error('유휴재고 이벤트 삭제 실패:', eventError.message)
    return false
  }

  // 2. 발주 삭제 (CASCADE로 하위 테이블 자동 삭제)
  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('발주 삭제 실패:', error.message)
    return false
  }

  return true
}

/**
 * 발주 취소 (soft delete)
 * 삭제 대신 status를 'cancelled'로 변경하고 취소 사유를 저장합니다.
 * 이미 입고완료된 구성품이 있으면 → 유휴재고 이벤트를 자동 생성합니다.
 */
export async function cancelOrder(id: string, reason: string): Promise<boolean> {
  const supabase = createClient()
  const now = new Date().toISOString()

  // 1. 발주 상태를 'cancelled'로 변경
  const { error } = await supabase
    .from('orders')
    .update({
      status: 'cancelled',
      cancel_reason: reason,
      cancelled_at: now,
      updated_at: now,
    })
    .eq('id', id)

  if (error) {
    console.error('발주 취소 실패:', error.message)
    return false
  }

  // 2. 입고완료된 구성품 조회 (confirmed_delivery_date가 있는 것 = 이미 창고에 들어온 장비)
  const { data: deliveredItems } = await supabase
    .from('equipment_items')
    .select('id, warehouse_id')
    .eq('order_id', id)
    .not('confirmed_delivery_date', 'is', null)

  // 3. 입고된 구성품이 있으면 각각에 대해 유휴재고 이벤트 생성
  if (deliveredItems && deliveredItems.length > 0) {
    const events = deliveredItems.map(item => ({
      event_type: 'cancelled',
      equipment_item_id: item.id,
      source_order_id: id,
      source_warehouse_id: item.warehouse_id,
      status: 'active',
      event_date: now.split('T')[0],
      notes: `발주취소 — ${reason}`,
    }))

    const { error: eventError } = await supabase
      .from('inventory_events')
      .insert(events)

    if (eventError) {
      console.error('유휴재고 이벤트 생성 실패:', eventError.message)
      // 발주 취소 자체는 성공했으므로 true 반환 (이벤트는 나중에 수동 처리 가능)
    }
  }

  return true
}

/**
 * 발주 상태 변경
 * @param id - 발주 ID
 * @param status - 새 상태 (received/in-progress/completed/settled)
 */
export async function updateOrderStatus(id: string, status: string): Promise<boolean> {
  const supabase = createClient()
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString()
  }

  // 정산완료 시 정산일 자동 입력
  if (status === 'settled') {
    const now = new Date()
    updates.settlement_date = now.toISOString().split('T')[0]
    updates.settlement_month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }

  const { error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('상태 변경 실패:', error.message)
    return false
  }

  return true
}

/**
 * 배송상태 변경 (Order 레벨)
 * @param id - 발주 ID
 * @param deliveryStatus - 새 배송상태 (pending/ordered)
 */
export async function updateDeliveryStatus(id: string, deliveryStatus: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('orders')
    .update({
      delivery_status: deliveryStatus,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)

  if (error) {
    console.error('배송상태 변경 실패:', error.message)
    return false
  }

  return true
}

// ============================================================
// 📋 발주 내역 (Order Items)
// ============================================================

/**
 * 발주 내역 전체 교체 (기존 삭제 → 새로 INSERT)
 *
 * "전체 교체" 방식을 사용하는 이유:
 * - 아이템 추가/삭제/수정이 동시에 일어날 수 있어서
 * - 개별 upsert보다 간단하고 안전합니다
 */
export async function saveOrderItems(orderId: string, items: OrderItem[]): Promise<boolean> {
  const supabase = createClient()

  // 기존 데이터 삭제
  const { error: deleteError } = await supabase
    .from('order_items')
    .delete()
    .eq('order_id', orderId)

  if (deleteError) {
    console.error('발주 내역 삭제 실패:', deleteError.message)
    return false
  }

  // 새 데이터 삽입
  if (items.length > 0) {
    const dbItems = items.map((item, idx) => ({
      ...toSnakeCase(item),
      order_id: orderId,
      id: item.id || `${orderId}-${idx + 1}`
    }))
    const { error: insertError } = await supabase.from('order_items').insert(dbItems)
    if (insertError) {
      console.error('발주 내역 저장 실패:', insertError.message)
      return false
    }
  }

  return true
}

// ============================================================
// 🔧 구성품 배송 (Equipment Items)
// ============================================================

/**
 * 구성품 정보 전체 교체
 * 배송관리에서 인라인 편집 후 저장할 때 사용
 */
export async function saveEquipmentItems(orderId: string, items: EquipmentItem[]): Promise<boolean> {
  const supabase = createClient()

  // 기존 삭제
  const { error: deleteError } = await supabase
    .from('equipment_items')
    .delete()
    .eq('order_id', orderId)

  if (deleteError) {
    console.error('구성품 삭제 실패:', deleteError.message)
    return false
  }

  // 새로 삽입
  if (items.length > 0) {
    const dbItems = items.map((item, idx) => ({
      ...toSnakeCase(item),
      order_id: orderId,
      id: item.id || `eq-${orderId}-${idx + 1}`
    }))
    const { error: insertError } = await supabase.from('equipment_items').insert(dbItems)
    if (insertError) {
      console.error('구성품 저장 실패:', insertError.message)
      return false
    }
  }

  return true
}

// ============================================================
// 💰 설치비 (Installation Cost Items)
// ============================================================

/**
 * 설치비 항목 전체 교체
 */
export async function saveInstallationCostItems(orderId: string, items: InstallationCostItem[]): Promise<boolean> {
  const supabase = createClient()

  const { error: deleteError } = await supabase
    .from('installation_cost_items')
    .delete()
    .eq('order_id', orderId)

  if (deleteError) {
    console.error('설치비 삭제 실패:', deleteError.message)
    return false
  }

  if (items.length > 0) {
    const dbItems = items.map((item, idx) => ({
      ...toSnakeCase(item),
      order_id: orderId,
      id: item.id || `ic-${orderId}-${idx + 1}`
    }))
    const { error: insertError } = await supabase.from('installation_cost_items').insert(dbItems)
    if (insertError) {
      console.error('설치비 저장 실패:', insertError.message)
      return false
    }
  }

  return true
}

// ============================================================
// 📄 소비자 견적서 (Customer Quotes)
// ============================================================

/**
 * 소비자 견적서 저장 (upsert 방식)
 * customer_quotes (1:1) + quote_items (1:N) 동시 저장
 */
export async function saveCustomerQuote(orderId: string, quote: CustomerQuote): Promise<boolean> {
  const supabase = createClient()

  // 기존 견적서 조회 (이미 있으면 update, 없으면 insert)
  const { data: existing } = await supabase
    .from('customer_quotes')
    .select('id')
    .eq('order_id', orderId)
    .single()

  const quoteId = existing?.id || `quote-${orderId}`

  if (existing) {
    // 기존 견적서 업데이트
    const { error } = await supabase
      .from('customer_quotes')
      .update({
        total_amount: quote.totalAmount,
        issued_date: quote.issuedDate,
        valid_until: quote.validUntil,
        notes: quote.notes,
      })
      .eq('id', quoteId)

    if (error) {
      console.error('견적서 수정 실패:', error.message)
      return false
    }
  } else {
    // 새 견적서 생성
    const { error } = await supabase
      .from('customer_quotes')
      .insert({
        id: quoteId,
        order_id: orderId,
        total_amount: quote.totalAmount,
        issued_date: quote.issuedDate,
        valid_until: quote.validUntil,
        notes: quote.notes,
      })

    if (error) {
      console.error('견적서 생성 실패:', error.message)
      return false
    }
  }

  // quote_items 전체 교체
  const { error: deleteError } = await supabase
    .from('quote_items')
    .delete()
    .eq('quote_id', quoteId)

  if (deleteError) {
    console.error('견적 항목 삭제 실패:', deleteError.message)
    return false
  }

  if (quote.items && quote.items.length > 0) {
    const dbItems = quote.items.map((item, idx) => ({
      ...toSnakeCase(item),
      quote_id: quoteId,
      id: item.id || `qi-${orderId}-${idx + 1}`
    }))
    const { error: insertError } = await supabase.from('quote_items').insert(dbItems)
    if (insertError) {
      console.error('견적 항목 저장 실패:', insertError.message)
      return false
    }
  }

  return true
}

// ============================================================
// 💰 연간 단가표 (Price Table)
// ============================================================

/**
 * 연간 단가표 전체 조회 (구성품 포함)
 * @returns 단가표 배열
 */
export async function fetchPriceTable(): Promise<any[]> {
  const supabase = createClient()

  // price_table + price_table_components 조인
  const { data, error } = await supabase
    .from('price_table')
    .select(`
      *,
      components:price_table_components(*)
    `)
    .order('size', { ascending: false })

  if (error) {
    console.error('단가표 조회 실패:', error.message)
    return []
  }

  // snake_case → camelCase 변환
  return toCamelCase(data)
}

/**
 * 단가표 제품 추가 (SET + 구성품)
 * @param priceTableRow - 새 제품 정보
 */
export async function createPriceTableRow(priceTableRow: any): Promise<any | null> {
  const supabase = createClient()

  // 1. SET 모델 추가
  const { data: setData, error: setError } = await supabase
    .from('price_table')
    .insert({
      category: priceTableRow.category,
      model: priceTableRow.model,
      size: priceTableRow.size,
      price: priceTableRow.price,
    })
    .select()
    .single()

  if (setError) {
    console.error('단가표 추가 실패:', setError.message)
    return null
  }

  // 2. 구성품 추가
  if (priceTableRow.components && priceTableRow.components.length > 0) {
    const componentsData = priceTableRow.components.map((comp: any) => ({
      price_table_id: setData.id,
      type: comp.type,
      model: comp.model,
      unit_price: comp.unitPrice || comp.unit_price,
      sale_price: comp.salePrice || comp.sale_price,
      quantity: comp.quantity || 1,
    }))

    const { error: compError } = await supabase
      .from('price_table_components')
      .insert(componentsData)

    if (compError) {
      console.error('구성품 추가 실패:', compError.message)
      // SET은 추가됐으니 롤백하거나 경고만
    }
  }

  // 3. 생성된 데이터 반환 (구성품 포함)
  const { data: fullData } = await supabase
    .from('price_table')
    .select(`
      *,
      components:price_table_components(*)
    `)
    .eq('id', setData.id)
    .single()

  return toCamelCase(fullData)
}

/**
 * 단가표 제품 수정
 * @param id - 제품 ID
 * @param updates - 수정할 필드
 */
export async function updatePriceTableRow(id: string, updates: any): Promise<boolean> {
  const supabase = createClient()

  // SET 모델 정보 업데이트
  const { error } = await supabase
    .from('price_table')
    .update({
      category: updates.category,
      model: updates.model,
      size: updates.size,
      price: updates.price,
    })
    .eq('id', id)

  if (error) {
    console.error('단가표 수정 실패:', error.message)
    return false
  }

  // 구성품은 전체 교체 (삭제 후 재추가)
  if (updates.components) {
    await supabase
      .from('price_table_components')
      .delete()
      .eq('price_table_id', id)

    const componentsData = updates.components.map((comp: any) => ({
      price_table_id: id,
      type: comp.type,
      model: comp.model,
      unit_price: comp.unitPrice || comp.unit_price,
      sale_price: comp.salePrice || comp.sale_price,
      quantity: comp.quantity || 1,
    }))

    await supabase
      .from('price_table_components')
      .insert(componentsData)
  }

  return true
}

/**
 * 단가표 제품 삭제
 * @param id - 제품 ID
 */
export async function deletePriceTableRow(id: string): Promise<boolean> {
  const supabase = createClient()

  // CASCADE 설정으로 구성품도 자동 삭제됨
  const { error } = await supabase
    .from('price_table')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('단가표 삭제 실패:', error.message)
    return false
  }

  return true
}

// ============================================================
// 💵 에스원 정산 (S1 Settlement)
// ============================================================

/**
 * 개별 발주의 에스원 정산 상태 변경
 * @param orderId - 발주 ID
 * @param status - 새 정산 상태 (unsettled/in-progress/settled)
 */
export async function updateS1SettlementStatus(orderId: string, status: S1SettlementStatus): Promise<boolean> {
  const supabase = createClient()
  const updates: Record<string, unknown> = {
    s1_settlement_status: status,
    updated_at: new Date().toISOString()
  }

  // 정산 완료 시 정산 월 자동 입력
  if (status === 'settled') {
    const now = new Date()
    updates.s1_settlement_month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }

  const { error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', orderId)

  if (error) {
    console.error('에스원 정산 상태 변경 실패:', error.message)
    return false
  }

  return true
}

/**
 * 여러 발주의 에스원 정산 상태 일괄 변경
 * @param orderIds - 발주 ID 배열
 * @param status - 새 정산 상태
 * @param settlementMonth - 정산월 (YYYY-MM 형식, 정산완료 시 필수)
 */
export async function batchUpdateS1SettlementStatus(orderIds: string[], status: S1SettlementStatus, settlementMonth?: string): Promise<boolean> {
  const supabase = createClient()
  const updates: Record<string, unknown> = {
    s1_settlement_status: status,
    updated_at: new Date().toISOString()
  }

  // 정산 완료 시 정산 월 저장 (화면에서 선택한 월 사용)
  if (status === 'settled' && settlementMonth) {
    updates.s1_settlement_month = settlementMonth
  }

  const { error } = await supabase
    .from('orders')
    .update(updates)
    .in('id', orderIds)

  if (error) {
    console.error('에스원 정산 일괄 변경 실패:', error.message)
    return false
  }

  return true
}

// ============================================================
// 💰 교원↔멜레아 정산 (Gyowon Settlement)
// ============================================================

/**
 * 교원↔멜레아 정산 완료 일괄 처리
 *
 * 한 번의 호출로 다음을 동시에 처리:
 * - orders.status → 'settled'
 * - orders.settlement_month → 정산월
 * - orders.s1_settlement_status → 'settled'
 * - orders.s1_settlement_month → 정산월
 *
 * @param orderIds - 정산 대상 발주 ID 배열
 * @param settlementMonth - 정산월 (YYYY-MM 형식, 예: "2026-02")
 */
export async function batchCompleteGyowonSettlement(orderIds: string[], settlementMonth: string): Promise<boolean> {
  const supabase = createClient()
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('orders')
    .update({
      status: 'settled',
      settlement_date: now.split('T')[0],
      settlement_month: settlementMonth,
      s1_settlement_status: 'settled',
      s1_settlement_month: settlementMonth,
      updated_at: now,
    })
    .in('id', orderIds)

  if (error) {
    console.error('교원 정산 완료 실패:', error.message)
    return false
  }

  return true
}

/**
 * 교원↔멜레아 정산 되돌리기
 *
 * 정산완료 → 정산진행중으로 복원:
 * - orders.status → 'completed'
 * - orders.settlement_month → null
 * - orders.settlement_date → null
 * - orders.s1_settlement_status → 'in-progress'
 * - orders.s1_settlement_month → null
 *
 * @param orderId - 되돌릴 발주 ID
 */
export async function revertGyowonSettlement(orderId: string): Promise<boolean> {
  const supabase = createClient()
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('orders')
    .update({
      status: 'completed',
      settlement_date: null,
      settlement_month: null,
      s1_settlement_status: 'in-progress',
      s1_settlement_month: null,
      updated_at: now,
    })
    .eq('id', orderId)

  if (error) {
    console.error('교원 정산 되돌리기 실패:', error.message)
    return false
  }

  return true
}

/**
 * 기업이윤 저장 (교원↔멜레아 정산용)
 * @param orderId - 발주 ID
 * @param amount - 기업이윤 금액
 */
export async function updateCorporateProfit(orderId: string, amount: number): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('orders')
    .update({
      corporate_profit: amount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  if (error) {
    console.error('기업이윤 저장 실패:', error.message)
    return false
  }

  return true
}

// ============================================================
// ✅ 정산 검토 상태 (Review Status)
// ============================================================

/**
 * 검토 상태 토글 (멜레아/교원)
 * @param orderId - 발주 ID
 * @param reviewer - 검토 주체 ('mellea' | 'gyowon')
 * @param status - 새 상태 ('pending' | 'reviewed')
 */
export async function updateReviewStatus(orderId: string, reviewer: 'mellea' | 'gyowon', status: ReviewStatus): Promise<boolean> {
  const supabase = createClient()
  const column = reviewer === 'mellea' ? 'melleea_review_status' : 'gyowon_review_status'

  const { error } = await supabase
    .from('orders')
    .update({
      [column]: status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  if (error) {
    console.error(`${reviewer} 검토 상태 변경 실패:`, error.message)
    return false
  }

  return true
}

// ============================================================
// 📦 재고 이벤트 (Inventory Events) — 특수 케이스 관리
// ============================================================

/**
 * 재고 이벤트 목록 조회
 * @param eventType - 특정 이벤트 타입만 필터 (선택)
 * @returns 재고 이벤트 배열
 */
export async function fetchInventoryEvents(eventType?: InventoryEventType): Promise<InventoryEvent[]> {
  const supabase = createClient()
  let query = supabase
    .from('inventory_events')
    .select('*')
    .order('event_date', { ascending: false })

  if (eventType) {
    query = query.eq('event_type', eventType)
  }

  const { data, error } = await query

  if (error) {
    console.error('재고 이벤트 조회 실패:', error.message)
    return []
  }

  return toCamelCase<InventoryEvent[]>(data)
}

/**
 * 재고 이벤트 생성
 * @param event - 새 이벤트 정보
 */
export async function createInventoryEvent(event: Omit<InventoryEvent, 'id' | 'createdAt'>): Promise<InventoryEvent | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('inventory_events')
    .insert(toSnakeCase(event))
    .select()
    .single()

  if (error) {
    console.error('재고 이벤트 생성 실패:', error.message)
    return null
  }

  return toCamelCase<InventoryEvent>(data)
}

/**
 * 재고 이벤트 수정
 * @param id - 이벤트 ID
 * @param updates - 수정할 필드
 */
export async function updateInventoryEvent(id: string, updates: Partial<InventoryEvent>): Promise<InventoryEvent | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('inventory_events')
    .update(toSnakeCase(updates))
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('재고 이벤트 수정 실패:', error.message)
    return null
  }

  return toCamelCase<InventoryEvent>(data)
}

/**
 * 재고 이벤트 삭제
 * @param id - 이벤트 ID
 */
export async function deleteInventoryEvent(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('inventory_events')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('재고 이벤트 삭제 실패:', error.message)
    return false
  }

  return true
}

/**
 * 재고 이벤트 상태 변경 (active → resolved)
 * @param id - 이벤트 ID
 * @param status - 새 상태
 */
export async function resolveInventoryEvent(id: string, targetOrderId?: string): Promise<boolean> {
  const supabase = createClient()
  const updates: Record<string, unknown> = {
    status: 'resolved',
    resolved_date: new Date().toISOString().split('T')[0],
  }
  if (targetOrderId) {
    updates.target_order_id = targetOrderId
  }

  const { error } = await supabase
    .from('inventory_events')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('재고 이벤트 처리 실패:', error.message)
    return false
  }

  return true
}
