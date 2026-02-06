/**
 * 배송 관련 유틸리티 함수들
 *
 * 배송 상태 자동 판정, 알림 분류, 날짜 계산 등
 * 배송관리 페이지에서 사용하는 핵심 로직을 모아놓았습니다.
 *
 * 구성품별 배송 상태 자동 판정 규칙 (삼성 DPS 4단계):
 * - 배송확정일 있음 → confirmed (배송확정)
 * - 배송예정일 있음 → scheduled (배송예정)
 * - 주문일 또는 주문번호 있음 → ordered (주문완료)
 * - 그 외 → none (공란)
 */

import type { Order, DeliveryStatus, ItemDeliveryStatus, EquipmentItem } from '@/types/order'
import type { Warehouse } from '@/types/warehouse'

/**
 * 창고 목록 캐시 (컴포넌트에서 setWarehouses로 설정)
 * DB에서 가져온 창고 데이터를 여기에 저장하면
 * getWarehouseName, getWarehouseDetail 등의 함수에서 사용할 수 있습니다.
 */
let _warehouseCache: Warehouse[] = []

/**
 * 창고 캐시 설정 (페이지 로드 시 호출)
 * 예: setWarehouseCache(await fetchWarehouses())
 */
export function setWarehouseCache(warehouses: Warehouse[]) {
  _warehouseCache = warehouses
}

/**
 * 현재 캐시된 창고 목록 반환
 */
export function getWarehouseCache(): Warehouse[] {
  return _warehouseCache
}

/**
 * 오늘 날짜를 YYYY-MM-DD 형식으로 반환
 */
export function getToday(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * 두 날짜 간의 일수 차이 계산
 * @param a - 기준 날짜 (YYYY-MM-DD)
 * @param b - 비교 날짜 (YYYY-MM-DD)
 * @returns a - b 일수 (양수: a가 미래, 음수: a가 과거)
 */
export function daysDiff(a: string, b: string): number {
  const dateA = new Date(a + 'T00:00:00')
  const dateB = new Date(b + 'T00:00:00')
  const diffMs = dateA.getTime() - dateB.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Order의 유효 배송일 가져오기 (확정일 우선, 없으면 요청일)
 * @param order - 발주 정보
 * @returns 유효 배송일 문자열 또는 undefined
 */
export function getEffectiveDeliveryDate(order: Order): string | undefined {
  return order.confirmedDeliveryDate || order.requestedDeliveryDate
}

/**
 * 구성품별 배송 상태 자동 판정 (삼성 DPS 4단계)
 *
 * 판정 우선순위:
 * 1. 배송확정일 있음 → confirmed (배송확정)
 * 2. 배송예정일 있음 → scheduled (배송예정)
 * 3. 주문일 또는 주문번호 있음 → ordered (주문완료)
 * 4. 그 외 → none (공란)
 *
 * @param item - 구성품 항목
 * @returns 계산된 배송 상태
 */
export function computeItemDeliveryStatus(item: EquipmentItem): ItemDeliveryStatus {
  // 배송확정일 입력됨 → 배송확정
  if (item.confirmedDeliveryDate) {
    return 'confirmed'
  }

  // 배송예정일 입력됨 → 배송예정
  if (item.scheduledDeliveryDate) {
    return 'scheduled'
  }

  // 주문일 또는 주문번호 입력됨 → 주문완료
  if (item.orderDate || (item.orderNumber && item.orderNumber.trim())) {
    return 'ordered'
  }

  // 그 외 → 공란
  return 'none'
}

/**
 * 배송 진행률 계산
 * 구성품 전체 수와 배송확정/배송예정 수를 반환
 *
 * @param order - 발주 정보
 * @returns { total: 전체 구성품 수, confirmed: 배송확정 수, scheduled: 배송예정 수 }
 */
export function computeDeliveryProgress(order: Order): { total: number; confirmed: number; scheduled: number } {
  const items = order.equipmentItems || []
  if (items.length === 0) return { total: 0, confirmed: 0, scheduled: 0 }

  let confirmed = 0
  let scheduled = 0

  for (const item of items) {
    const status = computeItemDeliveryStatus(item)
    if (status === 'confirmed') confirmed++
    else if (status === 'scheduled') scheduled++
  }

  return { total: items.length, confirmed, scheduled }
}

/**
 * Order 전체의 배송 상태 자동 판정 (2단계)
 *
 * 규칙:
 * 1. 삼성 주문번호가 있으면 → 'ordered' (발주완료)
 * 2. 그 외 → 'pending' (발주대기)
 *
 * @param order - 발주 정보
 * @returns 계산된 배송 상태
 */
export function computeDeliveryStatus(order: Order): DeliveryStatus {
  if (order.samsungOrderNumber) return 'ordered'
  return 'pending'
}

/**
 * 알림 유형 분류
 * - delayed: 배송지연 (배송예정일이 지났는데 입고 안 됨)
 * - today: 오늘 입고 예정
 * - tomorrow: 내일 입고 예정
 * - this-week: 이번 주 입고 예정
 * - none: 알림 없음
 *
 * @param order - 발주 정보
 * @returns 알림 유형
 */
export type AlertType = 'delayed' | 'today' | 'tomorrow' | 'this-week' | 'none'

export function getAlertType(order: Order): AlertType {
  const today = getToday()
  // order.deliveryStatus 직접 사용 (자동 판정 대신 수동 전환 값)
  const status = order.deliveryStatus || 'pending'

  // 발주대기 상태면 알림 없음
  if (status === 'pending') return 'none'

  // 유효 배송일 가져오기
  const effectiveDate = getEffectiveDeliveryDate(order)
  if (!effectiveDate) return 'none'

  const diff = daysDiff(effectiveDate, today)

  // 배송예정일이 지났는데 입고 안 됨 → 지연
  if (diff < 0) return 'delayed'

  // 오늘 입고 예정
  if (diff === 0) return 'today'

  // 내일 입고 예정
  if (diff === 1) return 'tomorrow'

  // 이번 주 내 (7일 이내)
  if (diff <= 7) return 'this-week'

  return 'none'
}

/**
 * 창고 ID로 창고명 변환
 * @param warehouseId - 창고 ID
 * @returns 창고명 (없으면 '-')
 */
export function getWarehouseName(warehouseId?: string): string {
  if (!warehouseId) return '-'
  const warehouse = _warehouseCache.find(w => w.id === warehouseId)
  return warehouse?.name || '-'
}

/**
 * 창고 ID로 창고 상세 정보 (인수자 + 창고명 + 창고주소) 반환
 * @param warehouseId - 창고 ID
 * @returns { managerName, managerPhone, name, address } 또는 null
 */
export function getWarehouseDetail(warehouseId?: string) {
  if (!warehouseId) return null
  const warehouse = _warehouseCache.find(w => w.id === warehouseId)
  if (!warehouse) return null
  return {
    managerName: warehouse.managerName,
    managerPhone: warehouse.managerPhone,
    name: warehouse.name,
    address: warehouse.address
  }
}

/**
 * 알림 유형별 스타일 정보
 */
export const ALERT_STYLES: Record<AlertType, { label: string; color: string; bgColor: string; borderColor: string }> = {
  'delayed': { label: '배송지연', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  'today': { label: '오늘입고', color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
  'tomorrow': { label: '내일입고', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  'this-week': { label: '이번주', color: 'text-gray-700', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' },
  'none': { label: '', color: '', bgColor: '', borderColor: '' }
}

/**
 * Order에서 품목 요약 텍스트 생성
 * 예: "시스템에어컨 2대"
 */
export function getItemsSummary(order: Order): string {
  const installItems = order.items.filter(i => i.workType === '신규설치')
  if (installItems.length === 0) return '신규설치 없음'
  return installItems.map(i => `${i.category} ${i.quantity}대`).join(', ')
}

/**
 * 주소 짧게 자르기 (테이블에서 사용)
 */
export function shortenAddress(address: string, maxLength: number = 25): string {
  if (address.length <= maxLength) return address
  return address.substring(0, maxLength) + '...'
}

/**
 * 주소에서 광역지역 + 시/군 추출
 * 예: "서울시 강서구 화곡로 123" → { region: "수도권", city: "서울 강서구" }
 * 예: "강원도 춘천시 중앙로 456" → { region: "강원도", city: "춘천시" }
 *
 * @param address - 전체 주소 문자열
 * @returns { region: 광역지역명, city: 시/군/구명 }
 */
export function parseRegionFromAddress(address: string): { region: string; city: string } {
  // "작업장소:" 접두사 제거
  const clean = address.replace(/^작업장소:\s*/, '').trim()
  const parts = clean.split(/\s+/)

  const first = parts[0] || ''
  const second = parts[1] || ''

  // 수도권 판정 (서울, 경기, 인천)
  if (first.startsWith('서울')) {
    return { region: '수도권', city: `서울 ${second}` }
  }
  if (first.startsWith('경기') || first === '경기도') {
    return { region: '수도권', city: second }
  }
  if (first.startsWith('인천')) {
    return { region: '수도권', city: `인천 ${second}` }
  }

  // 광역시 매핑 (접두사 기반으로 판정)
  const metroPatterns: { prefix: string; region: string; label: string }[] = [
    { prefix: '대전', region: '충청남도', label: '대전' },
    { prefix: '세종', region: '충청남도', label: '세종' },
    { prefix: '광주', region: '전라남도', label: '광주' },
    { prefix: '대구', region: '경상북도', label: '대구' },
    { prefix: '부산', region: '경상남도', label: '부산' },
    { prefix: '울산', region: '경상남도', label: '울산' },
  ]

  const metro = metroPatterns.find(m => first.startsWith(m.prefix))
  if (metro) {
    return { region: metro.region, city: `${metro.label} ${second}` }
  }

  // 도 단위 매핑
  const doMap: Record<string, string> = {
    '충북': '충청북도',
    '충청북도': '충청북도',
    '충남': '충청남도',
    '충청남도': '충청남도',
    '전북': '전라북도',
    '전북특별자치도': '전라북도',
    '전라북도': '전라북도',
    '전남': '전라남도',
    '전라남도': '전라남도',
    '경북': '경상북도',
    '경상북도': '경상북도',
    '경남': '경상남도',
    '경상남도': '경상남도',
    '강원': '강원도',
    '강원도': '강원도',
    '강원특별자치도': '강원도',
    '제주': '제주도',
    '제주도': '제주도',
    '제주특별자치도': '제주도',
  }

  if (doMap[first]) {
    return { region: doMap[first], city: second }
  }

  return { region: '-', city: first }
}

/**
 * 날짜를 MM/DD 형식으로 표시 (테이블에서 공간 절약)
 */
export function formatShortDate(dateString?: string): string {
  if (!dateString) return '-'
  const parts = dateString.split('-')
  if (parts.length < 3) return dateString
  // YY.MM.DD 형식 (예: 26.01.30)
  const yy = parts[0].length === 4 ? parts[0].slice(2) : parts[0]
  return `${yy}.${parts[1]}.${parts[2]}`
}

/**
 * 주문의 구성품별 배송 지연 현황 분석
 *
 * 각 EquipmentItem의 requestedDeliveryDate vs scheduledDeliveryDate 비교:
 * - 둘 다 있고 scheduled <= requested → 정상
 * - 둘 다 있고 scheduled > requested → 지연 (+N일)
 * - 하나라도 없으면 → 미입력
 *
 * @param items - 구성품 목록
 * @returns { total, normal, delayed, noDate, maxDelayDays }
 */
export function analyzeDeliveryDelay(items?: EquipmentItem[]): {
  total: number
  normal: number
  delayed: number
  noDate: number
  maxDelayDays: number
} {
  if (!items || items.length === 0) {
    return { total: 0, normal: 0, delayed: 0, noDate: 0, maxDelayDays: 0 }
  }

  let normal = 0
  let delayed = 0
  let noDate = 0
  let maxDelayDays = 0

  for (const item of items) {
    const requested = item.requestedDeliveryDate
    const scheduled = item.scheduledDeliveryDate

    // 하나라도 없으면 미입력
    if (!requested || !scheduled) {
      noDate++
      continue
    }

    // 날짜 비교: scheduled - requested 일수
    const diff = daysDiff(scheduled, requested)
    if (diff <= 0) {
      // 예정일이 요청일 이하 → 정상
      normal++
    } else {
      // 예정일이 요청일보다 뒤 → 지연
      delayed++
      if (diff > maxDelayDays) maxDelayDays = diff
    }
  }

  return { total: items.length, normal, delayed, noDate, maxDelayDays }
}

/**
 * 발주완료 탭 문서상태 2단계 타입
 * - in-progress: 진행중 (배송확정일이 1개라도 없거나, 오늘 이후인 경우)
 * - completed: 완료 (모든 구성품의 배송확정일이 입력되어 있고, 모두 과거인 경우)
 */
export type OrderedDocStatus = 'in-progress' | 'completed'

/**
 * 발주완료 탭 문서상태 자동 계산 (구성품 배열을 직접 받음)
 *
 * - 완료: 모든 구성품의 배송확정일이 입력 + 모두 오늘 이전(과거)
 * - 진행중: 그 외 전부 (배송확정일 미입력, 오늘, 미래 포함)
 *
 * @param items - 구성품 배열 (편집 중이면 editingItems, 아니면 order.equipmentItems)
 * @returns 계산된 문서상태
 */
export function computeOrderedDocStatus(items: EquipmentItem[]): OrderedDocStatus {
  const today = getToday()

  // 구성품이 없으면 진행중
  if (items.length === 0) return 'in-progress'

  // 모든 구성품에 배송확정일이 있고, 전부 과거(오늘 미포함)인지 확인
  const allDone = items.every(item => {
    if (!item.confirmedDeliveryDate) return false
    // daysDiff(확정일, 오늘) < 0 → 확정일이 과거 (오늘은 포함 안 함)
    return daysDiff(item.confirmedDeliveryDate, today) < 0
  })

  return allDone ? 'completed' : 'in-progress'
}

/**
 * 발주완료 탭 문서상태별 뱃지 스타일
 */
export const ORDERED_DOC_STATUS_STYLES: Record<OrderedDocStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  'in-progress': { label: '🚚 배송 진행중', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  'completed': { label: '✅ 배송완료', color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
}

/**
 * 날짜를 YYYY.MM.DD 형식으로 표시
 */
export function formatDate(dateString?: string): string {
  if (!dateString) return '-'
  return dateString.replace(/-/g, '.')
}
