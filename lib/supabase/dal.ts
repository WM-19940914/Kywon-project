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
import type { Order, OrderItem, EquipmentItem, InstallationCostItem, CustomerQuote, QuoteItem, S1SettlementStatus, ReviewStatus, InventoryEvent, InventoryEventType, StoredEquipment, StoredEquipmentStatus } from '@/types/order'
import type { Warehouse } from '@/types/warehouse'
import type { ASRequest, ASRequestStatus } from '@/types/as'
import type { PrepurchaseEquipment, PrepurchaseUsage } from '@/types/prepurchase'

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

// ============================================================
// 📊 연간 단가표 (Price Table)
// ============================================================

/** 단가표 SET 모델 타입 */
export interface PriceTableSet {
  id: string
  category: string
  model: string
  size: string
  price: number
  listPrice: number          // SET 출하가 (삼성 출하가 합계)
  year: number
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

/** 단가표 구성품 타입 */
export interface PriceTableComponent {
  id: string
  setModel: string
  model: string
  type: string
  unitPrice: number
  salePrice: number
  quantity: number
  createdAt?: string
  updatedAt?: string
}

/** 단가표 행 (SET + 구성품) */
export interface PriceTableRow {
  category: string
  model: string
  size: string
  price: number
  listPrice: number          // SET 출하가
  components: Array<{
    model: string
    type: string
    unitPrice: number
    salePrice: number
    quantity: number
  }>
}

/**
 * 활성화된 단가표 조회 (기본 2026년)
 * @param year - 조회할 연도 (기본: 2026)
 * @returns PriceTableRow 배열
 */
export async function fetchPriceTable(year: number = 2026): Promise<PriceTableRow[]> {
  const supabase = createClient()

  // 1. SET 모델 조회
  const { data: sets, error: setsError } = await supabase
    .from('price_table_sets')
    .select('*')
    .eq('year', year)
    .eq('is_active', true)
    .order('category')
    .order('price', { ascending: false })

  if (setsError) {
    console.error('단가표 조회 실패:', setsError.message)
    return []
  }

  if (!sets || sets.length === 0) {
    return []
  }

  // 2. 모든 구성품 조회
  const setModels = sets.map(s => s.model)
  const { data: components, error: compError } = await supabase
    .from('price_table_components')
    .select('*')
    .in('set_model', setModels)

  if (compError) {
    console.error('구성품 조회 실패:', compError.message)
    return []
  }

  // 3. SET + 구성품 조합
  const result: PriceTableRow[] = sets.map(set => {
    const setComponents = (components || [])
      .filter(c => c.set_model === set.model)
      .map(c => ({
        model: c.model,
        type: c.type,
        unitPrice: c.unit_price,
        salePrice: c.sale_price,
        quantity: c.quantity,
      }))

    return {
      category: set.category,
      model: set.model,
      size: set.size,
      price: set.price,
      listPrice: set.list_price || 0,
      components: setComponents,
    }
  })

  return result
}

/**
 * SET 모델 추가/수정
 */
export async function upsertPriceTableSet(set: Omit<PriceTableSet, 'id' | 'createdAt' | 'updatedAt'>): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('price_table_sets')
    .upsert(toSnakeCase(set), { onConflict: 'model' })

  if (error) {
    console.error('SET 모델 저장 실패:', error.message)
    return false
  }

  return true
}

/**
 * SET 모델 삭제
 */
export async function deletePriceTableSet(model: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('price_table_sets')
    .delete()
    .eq('model', model)

  if (error) {
    console.error('SET 모델 삭제 실패:', error.message)
    return false
  }

  return true
}

/**
 * 구성품 일괄 저장 (기존 삭제 후 재삽입)
 * @param setModel - SET 모델명
 * @param components - 구성품 배열
 */
export async function savePriceTableComponents(
  setModel: string,
  components: Array<{ type: string; model: string; unitPrice: number; salePrice: number; quantity: number }>
): Promise<boolean> {
  const supabase = createClient()

  // 기존 구성품 삭제
  const { error: deleteError } = await supabase
    .from('price_table_components')
    .delete()
    .eq('set_model', setModel)

  if (deleteError) {
    console.error('구성품 삭제 실패:', deleteError.message)
    return false
  }

  // 새 구성품 삽입
  if (components.length > 0) {
    const rows = components.map(c => ({
      set_model: setModel,
      model: c.model,
      type: c.type,
      unit_price: c.unitPrice,
      sale_price: c.salePrice,
      quantity: c.quantity,
    }))

    const { error: insertError } = await supabase
      .from('price_table_components')
      .insert(rows)

    if (insertError) {
      console.error('구성품 저장 실패:', insertError.message)
      return false
    }
  }

  return true
}

// ============================================================
// 📦 철거보관 장비 (Stored Equipment)
// ============================================================

/**
 * 철거보관 장비 목록 조회
 * @param status - 상태 필터 (stored/released, 생략 시 전체)
 * @param warehouseId - 창고 필터 (생략 시 전체)
 */
export async function fetchStoredEquipment(status?: StoredEquipmentStatus, warehouseId?: string): Promise<StoredEquipment[]> {
  const supabase = createClient()
  let query = supabase
    .from('stored_equipment')
    .select('*')
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }
  if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId)
  }

  const { data, error } = await query

  if (error) {
    console.error('철거보관 장비 조회 실패:', error.message)
    return []
  }

  return toCamelCase<StoredEquipment[]>(data)
}

/**
 * 철거보관 장비 등록 (직접 입력)
 * @param equipment - 새 장비 정보
 */
export async function createStoredEquipment(equipment: Omit<StoredEquipment, 'id' | 'createdAt' | 'updatedAt'>): Promise<StoredEquipment | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('stored_equipment')
    .insert(toSnakeCase(equipment))
    .select()
    .single()

  if (error) {
    console.error('철거보관 장비 등록 실패:', error.message)
    return null
  }

  return toCamelCase<StoredEquipment>(data)
}

/**
 * 철거보관 장비 수정
 * @param id - 장비 ID
 * @param updates - 수정할 필드
 */
export async function updateStoredEquipment(id: string, updates: Partial<StoredEquipment>): Promise<StoredEquipment | null> {
  const supabase = createClient()
  const dbUpdates = toSnakeCase(updates)
  dbUpdates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('stored_equipment')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('철거보관 장비 수정 실패:', error.message)
    return null
  }

  return toCamelCase<StoredEquipment>(data)
}

/**
 * 철거보관 장비 삭제
 * @param id - 장비 ID
 */
export async function deleteStoredEquipment(id: string): Promise<boolean> {
  const supabase = createClient()

  // 1) 연결된 order_items의 stored_equipment_id 참조 해제
  const { error: unlinkError } = await supabase
    .from('order_items')
    .update({ stored_equipment_id: null })
    .eq('stored_equipment_id', id)

  if (unlinkError) {
    console.error('[DAL] order_items 참조 해제 실패:', unlinkError.message)
    // 참조 해제 실패해도 삭제 시도 (참조가 없을 수도 있으므로)
  }

  // 2) 장비 삭제
  const { error } = await supabase
    .from('stored_equipment')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[DAL] 철거보관 장비 삭제 실패:', error.message, error)
    return false
  }

  return true
}

/**
 * 철거보관 장비 출고 처리
 * status를 'released'로 변경하고 출고 정보를 저장합니다.
 *
 * @param id - 장비 ID
 * @param releaseInfo - 출고 정보 (유형/날짜/목적지/메모)
 */
export async function releaseStoredEquipment(id: string, releaseInfo: {
  releaseType: string
  releaseDate: string
  releaseDestination?: string
  releaseNotes?: string
}): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('stored_equipment')
    .update({
      status: 'released',
      release_type: releaseInfo.releaseType,
      release_date: releaseInfo.releaseDate,
      release_destination: releaseInfo.releaseDestination || null,
      release_notes: releaseInfo.releaseNotes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('출고 처리 실패:', error.message)
    return false
  }

  return true
}

/**
 * 출고 되돌리기 (released → stored)
 * 출고 정보를 초기화하고 다시 보관중으로 변경합니다.
 *
 * @param id - 장비 ID
 */
export async function revertStoredEquipmentRelease(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('stored_equipment')
    .update({
      status: 'stored',
      release_type: null,
      release_date: null,
      release_destination: null,
      release_notes: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('출고 되돌리기 실패:', error.message)
    return false
  }

  return true
}

/**
 * 발주에서 철거보관 장비 자동 등록
 * 설치완료 처리 시 workType='철거보관'인 항목을 stored_equipment에 등록합니다.
 *
 * @param order - 발주 정보
 * @param warehouseId - 보관 창고 ID
 */
export async function createStoredEquipmentFromOrder(order: Order, warehouseId?: string): Promise<boolean> {
  const supabase = createClient()

  // 철거보관 항목만 추출
  const removalItems = order.items.filter(item => item.workType === '철거보관')
  if (removalItems.length === 0) return true

  // 이미 등록된 건 중복 방지
  const { data: existing } = await supabase
    .from('stored_equipment')
    .select('id')
    .eq('order_id', order.id)

  if (existing && existing.length > 0) {
    return true
  }

  // 각 철거보관 항목을 stored_equipment에 등록
  const records = removalItems.map(item => ({
    order_id: order.id,
    site_name: order.businessName,
    affiliate: order.affiliate || null,
    address: order.address || null,
    category: item.category,
    model: item.model || null,
    size: item.size || null,
    quantity: item.quantity,
    warehouse_id: warehouseId || null,
    storage_start_date: order.installCompleteDate || new Date().toISOString().split('T')[0],
    condition: 'good',
    status: 'stored',
  }))

  const { error } = await supabase
    .from('stored_equipment')
    .insert(records)

  if (error) {
    console.error('철거보관 장비 자동 등록 실패:', error.message)
    return false
  }

  return true
}

// ============================================================
// 🔧 AS 관리 (AS Requests)
// ============================================================

/**
 * AS 요청 목록 조회
 * @returns AS 요청 배열 (최신순)
 */
export async function fetchASRequests(): Promise<ASRequest[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('as_requests')
    .select('*')
    .order('reception_date', { ascending: false })

  if (error) {
    console.error('AS 요청 조회 실패:', error.message)
    return []
  }

  return toCamelCase<ASRequest[]>(data)
}

/**
 * AS 요청 등록
 * @param request - 새 AS 요청 정보
 */
export async function createASRequest(request: Omit<ASRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<ASRequest | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('as_requests')
    .insert(toSnakeCase(request))
    .select()
    .single()

  if (error) {
    console.error('AS 요청 등록 실패:', error.message)
    return null
  }

  return toCamelCase<ASRequest>(data)
}

/**
 * AS 요청 수정 (관리 정보 + 상태 변경)
 * @param id - AS 요청 ID
 * @param updates - 수정할 필드들
 */
export async function updateASRequest(id: string, updates: Partial<ASRequest>): Promise<ASRequest | null> {
  const supabase = createClient()
  const dbUpdates = toSnakeCase(updates)
  dbUpdates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('as_requests')
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('AS 요청 수정 실패:', error.message)
    return null
  }

  return toCamelCase<ASRequest>(data)
}

/**
 * AS 요청 삭제
 * @param id - AS 요청 ID
 */
export async function deleteASRequest(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('as_requests')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('AS 요청 삭제 실패:', error.message)
    return false
  }

  return true
}

/**
 * AS 요청 일괄 상태 변경 (정산대기 → 정산완료 등)
 * @param ids - AS 요청 ID 배열
 * @param status - 새 상태
 * @param settlementMonth - 정산월 (YYYY-MM 형식, 정산완료 시 자동 설정)
 */
export async function batchUpdateASStatus(ids: string[], status: ASRequestStatus, settlementMonth?: string): Promise<boolean> {
  const supabase = createClient()
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString()
  }

  // 정산완료 시 정산월 자동 입력
  if (status === 'settled') {
    if (settlementMonth) {
      updates.settlement_month = settlementMonth
    } else {
      const now = new Date()
      updates.settlement_month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    }
  }

  const { error } = await supabase
    .from('as_requests')
    .update(updates)
    .in('id', ids)

  if (error) {
    console.error('AS 일괄 상태 변경 실패:', error.message)
    return false
  }

  return true
}

// ─────────────────────────────────────────────────
// 월별 정산 확인 (settlement_confirmations)
// ─────────────────────────────────────────────────

/** 정산 확인 데이터 타입 */
export interface SettlementConfirmation {
  id: string
  year: number
  month: number
  melleeaAmount: number | null
  melleeaConfirmedAt: string | null
  melleeaConfirmedBy: string | null
  kyowonAmount: number | null
  kyowonConfirmedAt: string | null
  kyowonConfirmedBy: string | null
}

/** 월별 정산 확인 조회 */
export async function fetchSettlementConfirmation(year: number, month: number): Promise<SettlementConfirmation | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('settlement_confirmations')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    year: data.year,
    month: data.month,
    melleeaAmount: data.mellea_amount,
    melleeaConfirmedAt: data.mellea_confirmed_at,
    melleeaConfirmedBy: data.mellea_confirmed_by,
    kyowonAmount: data.kyowon_amount,
    kyowonConfirmedAt: data.kyowon_confirmed_at,
    kyowonConfirmedBy: data.kyowon_confirmed_by,
  }
}

/** 정산 확인금액 저장 (멜레아 또는 교원) */
export async function saveSettlementConfirmation(
  year: number,
  month: number,
  side: 'mellea' | 'kyowon',
  amount: number,
  confirmedBy: string
): Promise<boolean> {
  const supabase = createClient()
  const now = new Date().toISOString()
  const updateData = side === 'mellea'
    ? { mellea_amount: amount, mellea_confirmed_at: now, mellea_confirmed_by: confirmedBy, updated_at: now }
    : { kyowon_amount: amount, kyowon_confirmed_at: now, kyowon_confirmed_by: confirmedBy, updated_at: now }

  const { error } = await supabase
    .from('settlement_confirmations')
    .upsert(
      { year, month, ...updateData },
      { onConflict: 'year,month' }
    )

  if (error) {
    console.error('정산 확인 저장 실패:', error.message)
    return false
  }

  return true
}

/** 정산 확인금액 초기화 (멜레아 또는 교원) */
export async function clearSettlementConfirmation(
  year: number,
  month: number,
  side: 'mellea' | 'kyowon'
): Promise<boolean> {
  const supabase = createClient()
  const now = new Date().toISOString()
  const updateData = side === 'mellea'
    ? { mellea_amount: null, mellea_confirmed_at: null, mellea_confirmed_by: null, updated_at: now }
    : { kyowon_amount: null, kyowon_confirmed_at: null, kyowon_confirmed_by: null, updated_at: now }

  const { error } = await supabase
    .from('settlement_confirmations')
    .update(updateData)
    .eq('year', year)
    .eq('month', month)

  if (error) {
    console.error('정산 확인 초기화 실패:', error.message)
    return false
  }

  return true
}


// ============================================================
// 📋 지출결의서 (Expense Reports)
// ============================================================

/** 지출결의서 항목 타입 */
export interface ExpenseReportItem {
  id?: string
  reportId?: string
  sortOrder: number
  businessName: string
  affiliate: string
  supplier: string
  itemType: string
  specification: string
  quantity: number
  listPrice: number
  discountRate: number
  optionItem: string
  purchaseUnitPrice: number
  purchaseTotalPrice: number
  mgRate: number
  salesUnitPrice: number
  salesTotalPrice: number
  frontMarginUnit: number
  frontMarginTotal: number
  incentiveGradeRebRate: number
  incentiveGradeReb: number
  incentiveItemReb: number
  totalMargin: number
  sourceType: string
  orderDate?: string
}

/** 지출결의서 헤더 타입 */
export interface ExpenseReport {
  id: string
  year: number
  month: number
  totalPurchase: number
  totalSales: number
  totalFrontMargin: number
  totalIncentive: number
  totalMargin: number
  createdAt: string
  items: ExpenseReportItem[]
}

/**
 * 특정 월의 확정된 지출결의서 조회
 * 없으면 null 반환
 */
export async function fetchExpenseReport(year: number, month: number): Promise<ExpenseReport | null> {
  const supabase = createClient()

  // 헤더 조회
  const { data: report, error } = await supabase
    .from('expense_reports')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  if (error) {
    console.error('지출결의서 조회 실패:', error.message)
    return null
  }
  if (!report) return null

  // 항목 조회
  const { data: items, error: itemsError } = await supabase
    .from('expense_report_items')
    .select('*')
    .eq('report_id', report.id)
    .order('sort_order')

  if (itemsError) {
    console.error('지출결의서 항목 조회 실패:', itemsError.message)
    return null
  }

  return {
    id: report.id,
    year: report.year,
    month: report.month,
    totalPurchase: report.total_purchase,
    totalSales: report.total_sales,
    totalFrontMargin: report.total_front_margin,
    totalIncentive: report.total_incentive,
    totalMargin: report.total_margin,
    createdAt: report.created_at,
    items: (items || []).map((item: any) => ({
      id: item.id,
      reportId: item.report_id,
      sortOrder: item.sort_order,
      businessName: item.business_name,
      affiliate: item.affiliate,
      supplier: item.supplier,
      itemType: item.item_type,
      specification: item.specification,
      quantity: item.quantity,
      listPrice: item.list_price,
      discountRate: Number(item.discount_rate),
      optionItem: item.option_item,
      purchaseUnitPrice: item.purchase_unit_price,
      purchaseTotalPrice: item.purchase_total_price,
      mgRate: Number(item.mg_rate),
      salesUnitPrice: item.sales_unit_price,
      salesTotalPrice: item.sales_total_price,
      frontMarginUnit: item.front_margin_unit,
      frontMarginTotal: item.front_margin_total,
      incentiveGradeRebRate: Number(item.incentive_grade_reb_rate) || 0,
      incentiveGradeReb: item.incentive_grade_reb,
      incentiveItemReb: item.incentive_item_reb,
      totalMargin: item.total_margin,
      sourceType: item.source_type,
      orderDate: item.order_date,
    })),
  }
}

/**
 * 지출결의서 확정 저장
 * 이미 존재하면 삭제 후 재생성 (재작성)
 */
export async function saveExpenseReport(
  year: number,
  month: number,
  items: ExpenseReportItem[],
  totals: { totalPurchase: number; totalSales: number; totalFrontMargin: number; totalIncentive: number; totalMargin: number }
): Promise<boolean> {
  const supabase = createClient()

  // 기존 데이터 삭제 (cascade로 items도 삭제됨)
  await supabase
    .from('expense_reports')
    .delete()
    .eq('year', year)
    .eq('month', month)

  // 헤더 생성
  const { data: report, error: reportError } = await supabase
    .from('expense_reports')
    .insert({
      year,
      month,
      total_purchase: totals.totalPurchase,
      total_sales: totals.totalSales,
      total_front_margin: totals.totalFrontMargin,
      total_incentive: totals.totalIncentive,
      total_margin: totals.totalMargin,
    })
    .select('id')
    .single()

  if (reportError || !report) {
    console.error('지출결의서 헤더 저장 실패:', reportError?.message)
    return false
  }

  // 항목 일괄 저장
  const rows = items.map((item, index) => ({
    report_id: report.id,
    sort_order: index,
    business_name: item.businessName,
    affiliate: item.affiliate,
    supplier: item.supplier,
    item_type: item.itemType,
    specification: item.specification,
    quantity: item.quantity,
    list_price: item.listPrice,
    discount_rate: item.discountRate,
    option_item: item.optionItem,
    purchase_unit_price: item.purchaseUnitPrice,
    purchase_total_price: item.purchaseTotalPrice,
    mg_rate: item.mgRate,
    sales_unit_price: item.salesUnitPrice,
    sales_total_price: item.salesTotalPrice,
    front_margin_unit: item.frontMarginUnit,
    front_margin_total: item.frontMarginTotal,
    incentive_grade_reb_rate: item.incentiveGradeRebRate,
    incentive_grade_reb: item.incentiveGradeReb,
    incentive_item_reb: item.incentiveItemReb,
    total_margin: item.totalMargin,
    source_type: item.sourceType,
    order_date: item.orderDate || null,
  }))

  const { error: itemsError } = await supabase
    .from('expense_report_items')
    .insert(rows)

  if (itemsError) {
    console.error('지출결의서 항목 저장 실패:', itemsError.message)
    return false
  }

  return true
}

/**
 * 지출결의서 삭제 (재작성 시 사용)
 */
export async function deleteExpenseReport(year: number, month: number): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('expense_reports')
    .delete()
    .eq('year', year)
    .eq('month', month)

  if (error) {
    console.error('지출결의서 삭제 실패:', error.message)
    return false
  }

  return true
}

/**
 * 지출결의서 수정 저장
 * 항목 전체 삭제 후 재삽입 + 헤더 합계 업데이트
 */
export async function updateExpenseReportWithItems(
  reportId: string,
  items: ExpenseReportItem[],
  totals: { totalPurchase: number; totalSales: number; totalFrontMargin: number; totalIncentive: number; totalMargin: number }
): Promise<boolean> {
  const supabase = createClient()

  // 기존 항목 삭제
  const { error: delError } = await supabase
    .from('expense_report_items')
    .delete()
    .eq('report_id', reportId)

  if (delError) {
    console.error('항목 삭제 실패:', delError.message)
    return false
  }

  // 항목 재삽입
  const rows = items.map((item, index) => ({
    report_id: reportId,
    sort_order: index,
    business_name: item.businessName,
    affiliate: item.affiliate,
    supplier: item.supplier,
    item_type: item.itemType,
    specification: item.specification,
    quantity: item.quantity,
    list_price: item.listPrice,
    discount_rate: item.discountRate,
    option_item: item.optionItem,
    purchase_unit_price: item.purchaseUnitPrice,
    purchase_total_price: item.purchaseTotalPrice,
    mg_rate: item.mgRate,
    sales_unit_price: item.salesUnitPrice,
    sales_total_price: item.salesTotalPrice,
    front_margin_unit: item.frontMarginUnit,
    front_margin_total: item.frontMarginTotal,
    incentive_grade_reb_rate: item.incentiveGradeRebRate,
    incentive_grade_reb: item.incentiveGradeReb,
    incentive_item_reb: item.incentiveItemReb,
    total_margin: item.totalMargin,
    source_type: item.sourceType,
    order_date: item.orderDate || null,
  }))

  const { error: insertError } = await supabase
    .from('expense_report_items')
    .insert(rows)

  if (insertError) {
    console.error('항목 재삽입 실패:', insertError.message)
    return false
  }

  // 헤더 합계 업데이트
  const { error: updateError } = await supabase
    .from('expense_reports')
    .update({
      total_purchase: totals.totalPurchase,
      total_sales: totals.totalSales,
      total_front_margin: totals.totalFrontMargin,
      total_incentive: totals.totalIncentive,
      total_margin: totals.totalMargin,
    })
    .eq('id', reportId)

  if (updateError) {
    console.error('합계 업데이트 실패:', updateError.message)
    return false
  }

  return true
}

// ============================================================
// 📦 배송 및 매입내역 (Purchase Reports)
// ============================================================

/** 매입내역 항목 타입 */
export interface PurchaseReportItem {
  id?: string
  reportId?: string
  sortOrder: number
  orderId: string
  businessName: string
  affiliate: string
  siteAddress: string
  orderDateDisplay: string
  deliveryStatus: string
  supplier: string
  orderNumber: string
  itemOrderDate: string
  scheduledDeliveryDate: string
  confirmedDeliveryDate: string
  componentModel: string
  componentName: string
  setModel: string
  quantity: number
  unitPrice: number
  totalPrice: number
  warehouseName: string
  warehouseAddress: string
}

/** 매입내역 보고서 헤더 타입 */
export interface PurchaseReport {
  id: string
  year: number
  month: number
  totalPurchase: number
  orderCount: number
  itemCount: number
  createdAt: string
  items: PurchaseReportItem[]
}

/**
 * 특정 월의 확정된 매입내역 조회
 */
export async function fetchPurchaseReport(year: number, month: number): Promise<PurchaseReport | null> {
  const supabase = createClient()

  const { data: report, error } = await supabase
    .from('purchase_reports')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  if (error) {
    console.error('매입내역 조회 실패:', error.message)
    return null
  }
  if (!report) return null

  const { data: items, error: itemsError } = await supabase
    .from('purchase_report_items')
    .select('*')
    .eq('report_id', report.id)
    .order('sort_order')

  if (itemsError) {
    console.error('매입내역 항목 조회 실패:', itemsError.message)
    return null
  }

  return {
    id: report.id,
    year: report.year,
    month: report.month,
    totalPurchase: Number(report.total_purchase),
    orderCount: report.order_count,
    itemCount: report.item_count,
    createdAt: report.created_at,
    items: (items || []).map((item: any) => ({
      id: item.id,
      reportId: item.report_id,
      sortOrder: item.sort_order,
      orderId: item.order_id,
      businessName: item.business_name,
      affiliate: item.affiliate,
      siteAddress: item.site_address || '',
      orderDateDisplay: item.order_date_display || '',
      deliveryStatus: item.delivery_status || '',
      supplier: item.supplier || '삼성전자',
      orderNumber: item.order_number || '',
      itemOrderDate: item.item_order_date || '',
      scheduledDeliveryDate: item.scheduled_delivery_date || '',
      confirmedDeliveryDate: item.confirmed_delivery_date || '',
      componentModel: item.component_model || '',
      componentName: item.component_name || '',
      setModel: item.set_model || '',
      quantity: item.quantity || 1,
      unitPrice: Number(item.unit_price) || 0,
      totalPrice: Number(item.total_price) || 0,
      warehouseName: item.warehouse_name || '',
      warehouseAddress: item.warehouse_address || '',
    })),
  }
}

/**
 * 매입내역 확정 저장 (기존 데이터 삭제 후 재생성)
 */
export async function savePurchaseReport(
  year: number,
  month: number,
  items: PurchaseReportItem[],
  totals: { totalPurchase: number; orderCount: number; itemCount: number }
): Promise<boolean> {
  const supabase = createClient()

  // 기존 삭제 (cascade)
  await supabase
    .from('purchase_reports')
    .delete()
    .eq('year', year)
    .eq('month', month)

  // 헤더 생성
  const { data: report, error: reportError } = await supabase
    .from('purchase_reports')
    .insert({
      year,
      month,
      total_purchase: totals.totalPurchase,
      order_count: totals.orderCount,
      item_count: totals.itemCount,
    })
    .select('id')
    .single()

  if (reportError || !report) {
    console.error('매입내역 헤더 저장 실패:', reportError?.message)
    return false
  }

  // 항목 저장
  const rows = items.map((item, index) => ({
    report_id: report.id,
    sort_order: index,
    order_id: item.orderId,
    business_name: item.businessName,
    affiliate: item.affiliate,
    site_address: item.siteAddress,
    order_date_display: item.orderDateDisplay,
    delivery_status: item.deliveryStatus,
    supplier: item.supplier,
    order_number: item.orderNumber,
    item_order_date: item.itemOrderDate,
    scheduled_delivery_date: item.scheduledDeliveryDate,
    confirmed_delivery_date: item.confirmedDeliveryDate,
    component_model: item.componentModel,
    component_name: item.componentName,
    set_model: item.setModel,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    total_price: item.totalPrice,
    warehouse_name: item.warehouseName,
    warehouse_address: item.warehouseAddress,
  }))

  const { error: itemsError } = await supabase
    .from('purchase_report_items')
    .insert(rows)

  if (itemsError) {
    console.error('매입내역 항목 저장 실패:', itemsError.message)
    return false
  }

  return true
}

/**
 * 매입내역 수정 저장 (항목 삭제 후 재삽입 + 헤더 합계 업데이트)
 */
export async function updatePurchaseReportWithItems(
  reportId: string,
  items: PurchaseReportItem[],
  totals: { totalPurchase: number; orderCount: number; itemCount: number }
): Promise<boolean> {
  const supabase = createClient()

  // 기존 항목 삭제
  const { error: delError } = await supabase
    .from('purchase_report_items')
    .delete()
    .eq('report_id', reportId)

  if (delError) {
    console.error('매입내역 항목 삭제 실패:', delError.message)
    return false
  }

  // 항목 재삽입
  const rows = items.map((item, index) => ({
    report_id: reportId,
    sort_order: index,
    order_id: item.orderId,
    business_name: item.businessName,
    affiliate: item.affiliate,
    site_address: item.siteAddress,
    order_date_display: item.orderDateDisplay,
    delivery_status: item.deliveryStatus,
    supplier: item.supplier,
    order_number: item.orderNumber,
    item_order_date: item.itemOrderDate,
    scheduled_delivery_date: item.scheduledDeliveryDate,
    confirmed_delivery_date: item.confirmedDeliveryDate,
    component_model: item.componentModel,
    component_name: item.componentName,
    set_model: item.setModel,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    total_price: item.totalPrice,
    warehouse_name: item.warehouseName,
    warehouse_address: item.warehouseAddress,
  }))

  const { error: insertError } = await supabase
    .from('purchase_report_items')
    .insert(rows)

  if (insertError) {
    console.error('매입내역 항목 재삽입 실패:', insertError.message)
    return false
  }

  // 헤더 합계 업데이트
  const { error: updateError } = await supabase
    .from('purchase_reports')
    .update({
      total_purchase: totals.totalPurchase,
      order_count: totals.orderCount,
      item_count: totals.itemCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reportId)

  if (updateError) {
    console.error('매입내역 합계 업데이트 실패:', updateError.message)
    return false
  }

  return true
}

// ============================================================
// ⚡ 설치비 단가표 항목 (Installation Price Items)
// ============================================================

/** 설치비 단가표 항목 타입 구분 */
export type InstallationPriceType = 'new_install' | 'relocation' | 'additional' | 'return' | 'electric' | 'etc'

/** 설치비 단가표 항목 타입 */
export interface InstallationPriceItem {
  id?: string
  type: InstallationPriceType
  category: string
  model: string
  price: number
  sortOrder: number
}

/**
 * 설치비 단가표 항목 전체 조회 (타입별)
 */
export async function fetchInstallationPriceItems(type: InstallationPriceType): Promise<InstallationPriceItem[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('installation_price_items')
    .select('*')
    .eq('type', type)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('설치비 단가표 조회 실패:', error.message)
    return []
  }

  return (data || []).map(row => ({
    id: row.id,
    type: row.type,
    category: row.category,
    model: row.model,
    price: row.price ?? 0,
    sortOrder: row.sort_order,
  }))
}

/**
 * 설치비 단가표 항목 일괄 저장 (삭제 후 재삽입)
 */
export async function saveInstallationPriceItems(
  type: InstallationPriceType,
  items: { category: string; model: string; price?: number }[]
): Promise<boolean> {
  const supabase = createClient()

  // 기존 항목 삭제
  const { error: delError } = await supabase
    .from('installation_price_items')
    .delete()
    .eq('type', type)

  if (delError) {
    console.error('설치비 단가표 삭제 실패:', delError.message)
    return false
  }

  // 새 항목 삽입
  if (items.length === 0) return true

  const rows = items.map((item, i) => ({
    type,
    category: item.category,
    model: item.model,
    price: item.price ?? 0,
    sort_order: i,
  }))

  const { error: insertError } = await supabase
    .from('installation_price_items')
    .insert(rows)

  if (insertError) {
    console.error('설치비 단가표 저장 실패:', insertError.message)
    return false
  }

  return true
}

// ============================================================
// 🛒 선구매 장비 (Prepurchase Equipment)
// ============================================================

/**
 * 선구매 장비 목록 조회
 * @returns 선구매 장비 배열 (최신순)
 */
export async function fetchPrepurchaseEquipment(): Promise<PrepurchaseEquipment[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('prepurchase_equipment')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('선구매 장비 조회 실패:', error.message)
    return []
  }
  return toCamelCase<PrepurchaseEquipment[]>(data)
}

/**
 * 선구매 장비 등록
 */
export async function createPrepurchaseEquipment(
  item: Omit<PrepurchaseEquipment, 'id' | 'usedQuantity' | 'createdAt' | 'updatedAt'>
): Promise<PrepurchaseEquipment | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('prepurchase_equipment')
    .insert(toSnakeCase(item))
    .select()
    .single()

  if (error) {
    console.error('선구매 장비 등록 실패:', error.message)
    return null
  }
  return toCamelCase<PrepurchaseEquipment>(data)
}

/**
 * 선구매 장비 수정
 */
export async function updatePrepurchaseEquipment(
  id: string,
  updates: Partial<PrepurchaseEquipment>
): Promise<PrepurchaseEquipment | null> {
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = updates as any
  const { data, error } = await supabase
    .from('prepurchase_equipment')
    .update(toSnakeCase(rest))
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('선구매 장비 수정 실패:', error.message)
    return null
  }
  return toCamelCase<PrepurchaseEquipment>(data)
}

/**
 * 선구매 장비 삭제
 */
export async function deletePrepurchaseEquipment(id: string): Promise<boolean> {
  const supabase = createClient()
  const { error } = await supabase
    .from('prepurchase_equipment')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('선구매 장비 삭제 실패:', error.message)
    return false
  }
  return true
}

// ============================================================
// 📋 선구매 사용 기록 (Prepurchase Usage)
// ============================================================

/**
 * 특정 선구매 건의 사용 기록 조회
 */
export async function fetchPrepurchaseUsage(prepurchaseId: string): Promise<PrepurchaseUsage[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('prepurchase_usage')
    .select('*')
    .eq('prepurchase_id', prepurchaseId)
    .order('used_date', { ascending: false })

  if (error) {
    console.error('사용 기록 조회 실패:', error.message)
    return []
  }
  return toCamelCase<PrepurchaseUsage[]>(data)
}

/**
 * 사용 기록 추가 + 선구매 장비의 usedQuantity 자동 갱신
 */
export async function createPrepurchaseUsage(
  usage: Omit<PrepurchaseUsage, 'id' | 'createdAt'>
): Promise<PrepurchaseUsage | null> {
  const supabase = createClient()

  // 1) 사용 기록 INSERT
  const { data, error } = await supabase
    .from('prepurchase_usage')
    .insert(toSnakeCase(usage))
    .select()
    .single()

  if (error) {
    console.error('사용 기록 등록 실패:', error.message)
    return null
  }

  // 2) 선구매 장비의 used_quantity 갱신 (기존값 + 이번 사용량)
  const { error: updateError } = await supabase.rpc('increment_used_quantity', {
    row_id: usage.prepurchaseId,
    amount: usage.usedQuantity,
  })

  // RPC가 없으면 직접 업데이트 (fallback)
  if (updateError) {
    const { data: current } = await supabase
      .from('prepurchase_equipment')
      .select('used_quantity')
      .eq('id', usage.prepurchaseId)
      .single()

    if (current) {
      await supabase
        .from('prepurchase_equipment')
        .update({ used_quantity: (current.used_quantity || 0) + usage.usedQuantity })
        .eq('id', usage.prepurchaseId)
    }
  }

  return toCamelCase<PrepurchaseUsage>(data)
}

/**
 * 사용 기록 삭제 + usedQuantity 차감
 */
export async function deletePrepurchaseUsage(
  usageId: string,
  prepurchaseId: string,
  quantity: number
): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('prepurchase_usage')
    .delete()
    .eq('id', usageId)

  if (error) {
    console.error('사용 기록 삭제 실패:', error.message)
    return false
  }

  // usedQuantity 차감
  const { data: current } = await supabase
    .from('prepurchase_equipment')
    .select('used_quantity')
    .eq('id', prepurchaseId)
    .single()

  if (current) {
    await supabase
      .from('prepurchase_equipment')
      .update({ used_quantity: Math.max(0, (current.used_quantity || 0) - quantity) })
      .eq('id', prepurchaseId)
  }

  return true
}

// ============================================================
// 📊 정산관리 스냅샷 (Settlement Reports)
// ============================================================

/** 정산관리 헤더 타입 */
export interface SettlementReport {
  id: string
  year: number
  month: number
  installCount: number
  installSubtotal: number
  installVat: number
  installTotal: number
  asCount: number
  asTotal: number
  createdAt: string
  items: SettlementReportItem[]
  asItems: SettlementReportAsItem[]
}

/** 설치정산 항목 타입 */
export interface SettlementReportItem {
  id?: string
  reportId?: string
  sortOrder: number
  orderId: string
  businessName: string
  affiliate: string
  workTypes: string
  orderDate: string
  installCompleteDate: string
  subtotalWithProfit: number
  vat: number
  grandTotal: number
  quoteSnapshot: any
  sitePhotos?: any
}

/** AS정산 항목 타입 */
export interface SettlementReportAsItem {
  id?: string
  reportId?: string
  sortOrder: number
  asRequestId: string
  affiliate: string
  businessName: string
  contactName: string
  contactPhone: string
  modelName: string
  asReason: string
  receptionDate: string
  processedDate: string
  asCost: number
  receptionFee: number
  processingDetails: string
  totalAmount: number
}

/**
 * 정산관리 스냅샷 조회
 */
export async function fetchSettlementReport(year: number, month: number): Promise<SettlementReport | null> {
  const supabase = createClient()

  const { data: report, error } = await supabase
    .from('settlement_reports')
    .select('*')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()

  if (error) {
    console.error('정산관리 조회 실패:', error.message)
    return null
  }
  if (!report) return null

  const { data: items } = await supabase
    .from('settlement_report_items')
    .select('*')
    .eq('report_id', report.id)
    .order('sort_order')

  const { data: asItems } = await supabase
    .from('settlement_report_as_items')
    .select('*')
    .eq('report_id', report.id)
    .order('sort_order')

  return {
    id: report.id,
    year: report.year,
    month: report.month,
    installCount: report.install_count,
    installSubtotal: report.install_subtotal,
    installVat: report.install_vat,
    installTotal: report.install_total,
    asCount: report.as_count,
    asTotal: report.as_total,
    createdAt: report.created_at,
    items: (items || []).map((item: any) => ({
      id: item.id,
      reportId: item.report_id,
      sortOrder: item.sort_order,
      orderId: item.order_id,
      businessName: item.business_name,
      affiliate: item.affiliate,
      workTypes: item.work_types,
      orderDate: item.order_date,
      installCompleteDate: item.install_complete_date,
      subtotalWithProfit: item.subtotal_with_profit,
      vat: item.vat,
      grandTotal: item.grand_total,
      quoteSnapshot: item.quote_snapshot,
      sitePhotos: item.site_photos,
    })),
    asItems: (asItems || []).map((item: any) => ({
      id: item.id,
      reportId: item.report_id,
      sortOrder: item.sort_order,
      asRequestId: item.as_request_id,
      affiliate: item.affiliate,
      businessName: item.business_name,
      contactName: item.contact_name,
      contactPhone: item.contact_phone,
      modelName: item.model_name,
      asReason: item.as_reason,
      receptionDate: item.reception_date,
      processedDate: item.processed_date,
      asCost: item.as_cost,
      receptionFee: item.reception_fee,
      processingDetails: item.processing_details,
      totalAmount: item.total_amount,
    })),
  }
}

/**
 * 정산관리 스냅샷 저장 (기존 삭제 → 재생성)
 */
export async function saveSettlementReport(
  year: number,
  month: number,
  installItems: SettlementReportItem[],
  asItems: SettlementReportAsItem[],
  totals: {
    installCount: number; installSubtotal: number; installVat: number; installTotal: number
    asCount: number; asTotal: number
  }
): Promise<boolean> {
  const supabase = createClient()

  await supabase
    .from('settlement_reports')
    .delete()
    .eq('year', year)
    .eq('month', month)

  const { data: report, error: reportError } = await supabase
    .from('settlement_reports')
    .insert({
      year,
      month,
      install_count: totals.installCount,
      install_subtotal: totals.installSubtotal,
      install_vat: totals.installVat,
      install_total: totals.installTotal,
      as_count: totals.asCount,
      as_total: totals.asTotal,
    })
    .select('id')
    .single()

  if (reportError || !report) {
    console.error('정산관리 헤더 저장 실패:', reportError?.message)
    return false
  }

  if (installItems.length > 0) {
    const rows = installItems.map((item, i) => ({
      report_id: report.id,
      sort_order: i,
      order_id: item.orderId,
      business_name: item.businessName,
      affiliate: item.affiliate,
      work_types: item.workTypes,
      order_date: item.orderDate,
      install_complete_date: item.installCompleteDate,
      subtotal_with_profit: item.subtotalWithProfit,
      vat: item.vat,
      grand_total: item.grandTotal,
      quote_snapshot: item.quoteSnapshot,
      site_photos: item.sitePhotos,
    }))

    const { error: itemsError } = await supabase
      .from('settlement_report_items')
      .insert(rows)

    if (itemsError) {
      console.error('설치정산 항목 저장 실패:', itemsError.message)
      return false
    }
  }

  if (asItems.length > 0) {
    const asRows = asItems.map((item, i) => ({
      report_id: report.id,
      sort_order: i,
      as_request_id: item.asRequestId,
      affiliate: item.affiliate,
      business_name: item.businessName,
      contact_name: item.contactName,
      contact_phone: item.contactPhone,
      model_name: item.modelName,
      as_reason: item.asReason,
      reception_date: item.receptionDate,
      processed_date: item.processedDate,
      as_cost: item.asCost,
      reception_fee: item.receptionFee,
      processing_details: item.processingDetails,
      total_amount: item.totalAmount,
    }))

    const { error: asError } = await supabase
      .from('settlement_report_as_items')
      .insert(asRows)

    if (asError) {
      console.error('AS정산 항목 저장 실패:', asError.message)
      return false
    }
  }

  return true
}
