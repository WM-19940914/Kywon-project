/**
 * 발주 정보 타입 정의 (조직/진행상태 중심)
 *
 * 이 파일은 "발주"가 어떤 정보를 가지고 있는지 정의합니다.
 * 마치 "발주 양식"의 모든 항목을 적어놓은 것과 같아요.
 */

/**
 * 발주내역 (한 발주에 여러 작업이 있을 수 있어요!)
 * 예: 신규설치 2대 + 철거 1대 = 총 3개의 OrderItem
 */
export interface OrderItem {
  id?: string                  // 항목 고유번호 (수정 시 필요)
  workType: '신규설치' | '이전설치' | '철거보관' | '철거폐기' | '재고설치' | '반납폐기'  // 작업 종류
  category: string             // 품목 (시스템에어컨, 벽걸이에어컨 등)
  model: string                // 모델명 (예: AR-123)
  size: string                 // 평형 (예: 18평)
  quantity: number             // 수량 (몇 대?)
  storedEquipmentId?: string   // 재고설치 시: 사용한 보관 장비 ID
}

/**
 * 배송상태 타입 (Order 레벨 — 3단계, 수동 전환)
 * pending: 발주대기 (아직 삼성에 발주 안 넣음)
 * ordered: 진행중 (삼성에 발주 넣음)
 * delivered: 배송완료 (모든 구성품 입고 확인)
 *
 * 구성품별 세부 배송상태는 ItemDeliveryStatus로 별도 관리
 */
export type DeliveryStatus = 'pending' | 'ordered' | 'delivered'

/** 배송상태 한글 표시용 (Order 레벨) */
export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  'pending': '📋 발주대기',
  'ordered': '🚚 배송 진행중',
  'delivered': '✅ 배송완료'
}

/** 배송상태별 색상 (Order 레벨 배지용) */
export const DELIVERY_STATUS_COLORS: Record<DeliveryStatus, string> = {
  'pending': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'ordered': 'bg-blue-50 text-blue-700 border-blue-200',
  'delivered': 'bg-green-50 text-green-700 border-green-200'
}

/**
 * 구성품별 배송상태 타입 (EquipmentItem 레벨 — 4단계, 삼성 DPS 기준)
 * none: 공란 (주문일/주문번호 없음)
 * ordered: 주문완료 (주문일 또는 주문번호 입력됨)
 * scheduled: 배송예정 (배송예정일 입력됨)
 * confirmed: 배송확정 (배송확정일 입력됨)
 */
export type ItemDeliveryStatus = 'none' | 'ordered' | 'scheduled' | 'confirmed'

/** 구성품별 배송상태 한글 표시용 */
export const ITEM_DELIVERY_STATUS_LABELS: Record<ItemDeliveryStatus, string> = {
  'none': '—',
  'ordered': '주문완료',
  'scheduled': '배송예정',
  'confirmed': '배송확정'
}

/** 구성품별 배송상태 색상 (배지용) */
export const ITEM_DELIVERY_STATUS_COLORS: Record<ItemDeliveryStatus, string> = {
  'none': '',
  'ordered': 'bg-blue-50 text-blue-700 border-blue-200',
  'scheduled': 'bg-purple-50 text-purple-700 border-purple-200',
  'confirmed': 'bg-green-50 text-green-700 border-green-200'
}

/**
 * 진행상태 3단계 + 정산완료
 * 접수 → 진행 → 완료 → 정산완료 순서로 진행됩니다
 * (장비준비, 설치준비, 설치 모두 "진행중"으로 통합!)
 */
export type OrderStatus =
  | 'received'          // 접수중 (발주 막 들어옴)
  | 'in-progress'       // 진행중 (준비부터 설치까지 전부!)
  | 'completed'         // 완료 (설치 끝! 정산 대기)
  | 'settled'           // 정산완료 (돈 계산 끝)
  | 'cancelled'         // 발주취소 (취소 사유와 함께 보관)

/**
 * 발주 정보
 */
export interface Order {
  id: string                   // 고유 번호 (자동 생성)
  documentNumber: string       // 문서번호 (예: DOC-2024-001)
  address: string              // 설치 주소
  orderDate: string            // 발주일 (날짜)

  // 🏢 조직 구조 (2단계: 계열사 → 사업자명)
  affiliate: string            // 계열사 (예: 구몬, Wells 영업 등)
  businessName: string         // 사업자명 (예: 구몬 화곡지국)

  // 👤 담당자 정보
  contactName?: string         // 담당자 성함
  contactPhone?: string        // 담당자 연락처
  buildingManagerPhone?: string // 건물관리인 연락처 (선택)

  // 📅 설치 정보
  requestedInstallDate?: string // 설치요청일

  // 📊 진행상태 (3단계 + 정산완료)
  status: OrderStatus

  // 📦 발주내역 (여러 개 가능!)
  items: OrderItem[]

  notes?: string               // 특이사항 (선택사항)
  createdAt?: string           // 등록일시 (자동 생성)

  // 💰 금액 정보 (DB에는 저장하지만 UI에는 안 보여줌)
  quoteAmount?: number         // 견적 금액
  actualCost?: number          // 실제 공사비

  // 📅 완료/정산 정보
  completionDate?: string      // 설치 완료일
  settlementDate?: string      // 정산 처리일
  settlementMonth?: string     // 정산 월 (예: "2024-01")
  isPreliminaryQuote?: boolean  // 🔍 사전견적 요청 여부 (현장 확인 전)

  // 🔧 장비 및 설치비 정보
  equipmentItems?: EquipmentItem[]      // 장비 입력 (선택)
  installationCost?: InstallationCost   // 설치비 입력 (선택)

  // 📄 소비자용 견적서 (새로 추가!)
  customerQuote?: CustomerQuote         // 소비자에게 보여줄 견적서 (판매가)

  // 💰 수익성 분석 (자동 계산)
  profitMargin?: number                 // 마진률 (%) = (판매가 - 원가) / 판매가 × 100
  profitAmount?: number                 // 이익금 (원) = 판매가 - 원가

  // 🚚 배송 정보 (Order 레벨에서 전체 배송 상태 관리)
  deliveryStatus?: DeliveryStatus       // 배송 상태
  requestedDeliveryDate?: string        // 배송요청일
  confirmedDeliveryDate?: string        // 배송확정일

  // 📦 삼성 주문번호 (배송관리에서 입력)
  samsungOrderNumber?: string           // 삼성전자 주문번호 (예: SO-2026-001)

  // 📋 설치일정 정보 (설치팀이 입력)
  installScheduleDate?: string          // 설치예정일 (YYYY-MM-DD)
  installCompleteDate?: string          // 설치완료일 (YYYY-MM-DD)
  installMemo?: string                  // 설치 관련 메모
  sitePhotos?: string[]                 // 현장사진 (URL 배열 — 설치팀장 업로드)

  // 💵 에스원 정산 정보 (멜레아 ↔ 에스원 설치비 정산)
  s1SettlementStatus?: S1SettlementStatus  // 에스원 정산 상태
  s1SettlementMonth?: string               // 에스원 정산 처리 월 (예: "2026-02")

  // ❌ 발주 취소 정보
  cancelReason?: string                    // 취소 사유
  cancelledAt?: string                     // 취소 일시 (ISO 문자열)

  // 💰 교원↔멜레아 정산: 기업이윤
  corporateProfit?: number                 // 기업이윤 (교원에게 청구할 이윤 금액)

  // ✅ 정산 검토 상태 (멜레아/교원 각각 확인)
  melleeaReviewStatus?: ReviewStatus       // 멜레아 검토 상태
  gyowonReviewStatus?: ReviewStatus        // 교원 검토 상태
}

/**
 * 진행상태 한글 표시용 (3단계)
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  'received': '접수중',
  'in-progress': '진행중',
  'completed': '완료',
  'settled': '정산완료',
  'cancelled': '발주취소',
}

/**
 * 진행상태별 색상 (칸반보드 컬럼 배경색)
 * 노란색 → 파란색 → 보라색 → 초록색 순서
 */
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  'received': 'bg-amber-100 text-amber-800 border border-amber-200',        // 앰버 (시작)
  'in-progress': 'bg-blue-100 text-blue-800 border border-blue-200',        // 블루 (진행)
  'completed': 'bg-violet-100 text-violet-800 border border-violet-200',    // 바이올렛 (완료)
  'settled': 'bg-emerald-100 text-emerald-800 border border-emerald-200',   // 에메랄드 (정산완료)
  'cancelled': 'bg-red-100 text-red-800 border border-red-200',             // 빨강 (취소)
}

/**
 * 계열사 목록 (드롭다운용)
 */
export const AFFILIATE_OPTIONS = [
  '구몬',
  'Wells 영업',
  'Wells 서비스',
  '교육플랫폼',
  '기타'
] as const

/**
 * 작업종류 표시 순서
 * 설치 계열 먼저 → 철거 계열 순서로 정렬
 */
export const WORK_TYPE_ORDER: string[] = [
  '신규설치',
  '이전설치',
  '재고설치',
  '철거보관',
  '철거폐기',
  '반납폐기',
]

/** 작업종류를 정해진 순서대로 정렬하는 헬퍼 함수 */
export function sortWorkTypes(types: string[]): string[] {
  return [...types].sort((a, b) => {
    const ai = WORK_TYPE_ORDER.indexOf(a)
    const bi = WORK_TYPE_ORDER.indexOf(b)
    // 목록에 없는 항목은 맨 뒤로
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })
}

/**
 * 작업종류별 뱃지 스타일
 * - 신규설치만 파란 강조, 나머지 회색
 */
export const WORK_TYPE_BADGE_STYLES: Record<string, { badge: string; icon: string }> = {
  '신규설치': { badge: 'text-blue-700 bg-blue-50 border-blue-200', icon: 'text-blue-500' },
  '이전설치': { badge: 'text-gray-600 bg-gray-50 border-gray-200', icon: 'text-gray-400' },
  '철거보관': { badge: 'text-gray-600 bg-gray-50 border-gray-200', icon: 'text-gray-400' },
  '철거폐기': { badge: 'text-gray-600 bg-gray-50 border-gray-200', icon: 'text-gray-400' },
  '재고설치': { badge: 'text-red-700 bg-red-50 border-red-200', icon: 'text-red-500' },
  '반납폐기': { badge: 'text-gray-600 bg-gray-50 border-gray-200', icon: 'text-gray-400' },
}
const DEFAULT_BADGE_STYLE = { badge: 'text-gray-600 bg-gray-50 border-gray-200', icon: 'text-gray-400' }
export function getWorkTypeBadgeStyle(type: string) {
  return WORK_TYPE_BADGE_STYLES[type] || DEFAULT_BADGE_STYLE
}

/** @deprecated WORK_TYPE_BADGE_STYLES 사용 권장 */
export const WORK_TYPE_COLORS: Record<string, string> = {
  '신규설치': 'bg-blue-50 text-blue-700 border-blue-200',
  '이전설치': 'bg-gray-100 text-gray-700 border-gray-200',
  '철거보관': 'bg-gray-100 text-gray-700 border-gray-200',
  '철거폐기': 'bg-gray-100 text-gray-700 border-gray-200',
  '재고설치': 'bg-gray-100 text-gray-700 border-gray-200',
  '반납폐기': 'bg-gray-100 text-gray-700 border-gray-200',
}

/**
 * 작업종류별 아이콘 이름 매핑
 *
 * - 설치 계열: PlusCircle(신규) / ArrowRightLeft(이전) / Package(재고)
 * - 철거 계열: Archive(보관) / Trash2(폐기) / RotateCcw(반납폐기)
 */
export const WORK_TYPE_ICONS: Record<string, string> = {
  '신규설치': 'plus-circle',
  '이전설치': 'arrow-right-left',
  '철거보관': 'archive',
  '철거폐기': 'trash-2',
  '재고설치': 'package',
  '반납폐기': 'rotate-ccw',
}

/**
 * 품목 목록 (드롭다운용)
 */
export const CATEGORY_OPTIONS = [
  '스탠드에어컨',
  '벽걸이에어컨',
  '단가계약 외'
] as const

/**
 * 작업종류 목록
 */
export const WORK_TYPE_OPTIONS = [
  '신규설치',
  '이전설치',
  '재고설치',
  '철거보관',
  '철거폐기'
] as const

/**
 * 장비 입력 항목
 * (장비 담당자가 입력하는 실제 구매/배송 정보)
 */
export interface EquipmentItem {
  id?: string                    // 항목 고유번호
  setModel?: string              // SET 모델명 (예: AP072BAPPBH2S) - 단가표 기준 (배송관리에서는 미표시)
  componentName: string          // 구성품명 (예: 실외기, 실내기, 자재박스, 리모컨)
  componentModel?: string        // 구성품 모델명 (예: AP072BNPPBH1) - 배송관리 테이블에 표시
  supplier?: string              // 매입처 (기본값: 삼성전자)
  orderNumber?: string           // 개별 주문번호 (구성품마다 다를 수 있음)
  orderDate: string              // 발주일
  requestedDeliveryDate?: string // 배송요청일 (내가 삼성에 요청한 날짜)
  scheduledDeliveryDate?: string // 배송예정일 (삼성에서 알려준 실제 배송 예정 날짜)
  confirmedDeliveryDate?: string // 배송확정일 (실제 입고된 날짜, 배송중 단계에서 입력)
  quantity: number               // 수량
  unitPrice?: number             // 매입단가
  totalPrice?: number            // 매입금액 (자동 계산: 수량 × 단가)
  warehouseId?: string           // 배송 창고 ID (warehouses 테이블 참조)
  /**
   * 구성품별 개별 배송 상태 (삼성 DPS 4단계)
   * - none: 공란 (주문일/주문번호 없음)
   * - ordered: 주문완료 (주문일 또는 주문번호 입력됨)
   * - scheduled: 배송예정 (배송예정일 입력됨)
   * - confirmed: 배송확정 (배송확정일 입력됨)
   */
  deliveryStatus?: ItemDeliveryStatus
}

/**
 * 구성품명 옵션
 */
export const COMPONENT_OPTIONS = [
  '실외기',
  '실내기',
  '패널',
  '리모컨',
  '배관세트',
  '전선',
  '기타'
] as const

/**
 * 설치비 입력 항목
 * (설치팀이 입력하는 실제 설치비용 정보)
 */
export interface InstallationCostItem {
  id?: string                 // 항목 고유번호
  itemName: string            // 항목명 (예: 기본설치비, 배관추가, 실외기 이동 등)
  unitPrice: number           // 단가
  quantity: number            // 수량
  totalPrice?: number         // 금액 (자동 계산: 수량 × 단가)
  notes?: string              // 비고
}

/**
 * 설치비 입력 정보
 */
export interface InstallationCost {
  items: InstallationCostItem[]   // 설치비 항목들
  totalAmount?: number            // 총 설치비 (자동 계산)
}

/**
 * 설치비 항목명 옵션
 */
export const INSTALLATION_ITEM_OPTIONS = [
  '기본설치비',
  '배관추가',
  '실외기 이동',
  '천장형 설치',
  '고층 작업비',
  '철거비',
  '기타'
] as const

/**
 * 소비자용 견적 항목 (판매가 기준)
 *
 * 이건 "소비자에게 보여줄 견적서"에 들어가는 항목이에요!
 * 예: "벽걸이형 16평 1대 - 1,200,000원"
 *
 * ⚠️ 주의: 원가(매입단가) 정보는 절대 포함하지 않습니다!
 */
export interface QuoteItem {
  id?: string                           // 항목 고유번호
  itemName: string                      // 항목명 (예: "벽걸이형 16평 1대", "기본설치비")
  category: 'equipment' | 'installation' // 장비 or 설치비
  quantity: number                      // 수량
  unit?: string                         // 단위 (예: 대, m, 식, EA 등 — 직접 입력)
  unitPrice: number                     // 판매 단가 (소비자에게 보여줄 가격)
  totalPrice: number                    // 판매 금액 (수량 × 단가)
  description?: string                  // 추가 설명
}

/**
 * 소비자용 견적서
 *
 * 발주처(소비자)에게 제공할 깔끔한 견적서입니다.
 * 인쇄 가능하고, 원가 정보는 절대 포함되지 않아요!
 */
export interface CustomerQuote {
  items: QuoteItem[]          // 견적 항목들 (장비 + 설치비)
  totalAmount: number         // 총 견적 금액 (자동 계산)
  issuedDate?: string         // 견적서 발행일
  validUntil?: string         // 유효기간
  notes?: string              // 견적서 비고
}

/**
 * OrderForm이 생성한 주소 문자열을 역파싱
 * "작업장소: 서울..., 101동 / 이전목적지: 경기..." → 분리된 필드
 */
export interface ParsedAddress {
  baseAddress: string
  baseDetailAddress?: string
  relocationAddress?: string
  relocationDetailAddress?: string
  isRelocation: boolean
}

/**
 * 설치일정 탭 상태 타입
 * - unscheduled: 일정미정 (설치예정일 없음)
 * - scheduled: 설치예정 (설치예정일 있음, 완료일 없음)
 * - completed: 설치완료 (설치완료일 있음)
 */
export type InstallScheduleStatus = 'unscheduled' | 'scheduled' | 'completed'

/**
 * 에스원 정산 상태 타입 (멜레아 ↔ 에스원 설치비 정산)
 * - unsettled: 미정산 (설치 완료됐지만 아직 정산 안 함)
 * - in-progress: 정산 진행중 (매달 20~29일 정산 작업 중)
 * - settled: 정산 완료
 */
export type S1SettlementStatus = 'unsettled' | 'in-progress' | 'settled'

/** 에스원 정산 상태 한글 표시용 */
export const S1_SETTLEMENT_STATUS_LABELS: Record<S1SettlementStatus, string> = {
  'unsettled': '미정산',
  'in-progress': '정산진행중',
  'settled': '정산완료'
}

/** 에스원 정산 상태 색상 (뱃지용) */
export const S1_SETTLEMENT_STATUS_COLORS: Record<S1SettlementStatus, string> = {
  'unsettled': 'bg-gray-100 text-gray-500 border-gray-200',
  'in-progress': 'bg-orange-50 text-orange-700 border-orange-200',
  'settled': 'bg-green-50 text-green-700 border-green-200'
}

// ============================================================
// 📦 재고 이벤트 (Inventory Events) — 특수 케이스 관리
// ============================================================

/**
 * 재고 이벤트 종류
 * - prepaid: 선입금 장비 (교원이 돈만 먼저 줌, 아직 발주 안 넣음)
 * - cancelled: 취소/미배정 장비 (현장 취소됐는데 장비는 창고에 있음)
 * - substitution: 대체사용 이력 (A현장 취소 장비를 B현장에서 사용)
 * - transfer_out: 타창고 이동 (다른 창고에서 빌려옴)
 * - transfer_return: 타창고 반환 (빌려온 장비를 원래 창고로 돌려보냄)
 */
export type InventoryEventType = 'prepaid' | 'cancelled' | 'substitution' | 'transfer_out' | 'transfer_return'

/** 재고 이벤트 상태 */
export type InventoryEventStatus = 'active' | 'resolved'

/** 재고 이벤트 인터페이스 */
export interface InventoryEvent {
  id: string
  eventType: InventoryEventType         // 이벤트 종류
  equipmentItemId?: string              // 관련 구성품 ID (선입금은 null)
  sourceOrderId?: string                // 원래 발주 ID
  targetOrderId?: string                // 새 발주 ID (대체사용/연결 시)
  sourceWarehouseId?: string            // 출발 창고
  targetWarehouseId?: string            // 도착 창고
  prepaidAmount?: number                // 선입금 금액
  affiliate?: string                    // 입금처/계열사 (선입금용)
  modelName?: string                    // 모델명 (표시용)
  siteName?: string                     // 현장명 (표시용)
  status: InventoryEventStatus          // 처리 상태
  notes?: string                        // 메모
  eventDate: string                     // 이벤트 발생일
  resolvedDate?: string                 // 처리 완료일
  createdAt?: string                    // 등록일시
}

/** 재고 이벤트 종류별 한글 라벨 */
export const INVENTORY_EVENT_TYPE_LABELS: Record<InventoryEventType, string> = {
  'prepaid': '선입금',
  'cancelled': '취소/미배정',
  'substitution': '대체사용',
  'transfer_out': '타창고 이동',
  'transfer_return': '타창고 반환',
}

/** 재고 이벤트 종류별 색상 */
export const INVENTORY_EVENT_TYPE_COLORS: Record<InventoryEventType, string> = {
  'prepaid': 'bg-purple-50 text-purple-700 border-purple-200',
  'cancelled': 'bg-red-50 text-red-700 border-red-200',
  'substitution': 'bg-blue-50 text-blue-700 border-blue-200',
  'transfer_out': 'bg-orange-50 text-orange-700 border-orange-200',
  'transfer_return': 'bg-orange-50 text-orange-700 border-orange-200',
}

/** 재고 이벤트 상태별 한글 라벨 */
export const INVENTORY_EVENT_STATUS_LABELS: Record<InventoryEventStatus, string> = {
  'active': '진행중',
  'resolved': '처리완료',
}

/** 재고 이벤트 상태별 색상 */
export const INVENTORY_EVENT_STATUS_COLORS: Record<InventoryEventStatus, string> = {
  'active': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'resolved': 'bg-green-50 text-green-700 border-green-200',
}

/**
 * 창고 재고 상태 (탭1에서 사용 — 기존 데이터로 파생, DB 필드 불필요)
 * - idle: 유휴재고 (현장 취소됨, 갈 곳 없이 창고에 있는 장비)
 * - in_stock: 입고내역 (입고됨, 정상적으로 현장 배정된 장비)
 * - install_done: 설치완료 (설치까지 끝난 장비)
 */
export type WarehouseStockStatus = 'idle' | 'in_stock' | 'install_done'

export const WAREHOUSE_STOCK_STATUS_LABELS: Record<WarehouseStockStatus, string> = {
  'idle': '유휴재고',
  'in_stock': '입고내역',
  'install_done': '설치완료',
}

export const WAREHOUSE_STOCK_STATUS_COLORS: Record<WarehouseStockStatus, string> = {
  'idle': 'bg-red-50 text-red-700 border-red-200',
  'in_stock': 'bg-green-50 text-green-700 border-green-200',
  'install_done': 'bg-gray-100 text-gray-500 border-gray-200',
}

// ============================================================
// ✅ 정산 검토 상태 (Review Status)
// ============================================================

/**
 * 정산 검토 상태 — 멜레아/교원 각각 독립적으로 관리
 * - pending: 아직 검토 안 함
 * - reviewed: 검토 완료
 */
export type ReviewStatus = 'pending' | 'reviewed'

/** 검토 주체별 라벨 설정 */
export const REVIEW_STATUS_CONFIG = {
  mellea: { label: '멜레아', pendingText: '미검토', reviewedText: '검토완료' },
  gyowon: { label: '교원', pendingText: '미확인', reviewedText: '확인완료' },
}

// ============================================================
// 📦 철거보관 장비 (Stored Equipment)
// ============================================================

/**
 * 철거보관 장비 보관 상태
 * - stored: 보관중 (창고에 있음)
 * - released: 출고완료 (재설치/폐기/반납 됨)
 */
export type StoredEquipmentStatus = 'stored' | 'released'

/**
 * 출고 유형 (어디로 나갔는지)
 * - reinstall: 재설치 (다른 현장에 다시 설치)
 * - dispose: 폐기 (못 쓰게 되어서 버림)
 */
export type ReleaseType = 'reinstall' | 'dispose'

/**
 * 장비 유형 — 실내기/실외기/SET 등 구분
 */
export type EquipmentUnitType = 'set' | 'indoor' | 'outdoor' | 'etc'

/** 장비 유형 한글 라벨 */
export const EQUIPMENT_UNIT_TYPE_LABELS: Record<EquipmentUnitType, string> = {
  'set': 'SET',
  'indoor': '실내기',
  'outdoor': '실외기',
  'etc': '기타',
}

/** 장비 유형 색상 (뱃지용) */
export const EQUIPMENT_UNIT_TYPE_COLORS: Record<EquipmentUnitType, string> = {
  'set': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'indoor': 'bg-sky-50 text-sky-700 border-sky-200',
  'outdoor': 'bg-amber-50 text-amber-700 border-amber-200',
  'etc': 'bg-gray-50 text-gray-500 border-gray-200',
}

/** 장비 유형 옵션 (드롭다운용) */
export const EQUIPMENT_UNIT_TYPE_OPTIONS: EquipmentUnitType[] = [
  'set', 'indoor', 'outdoor', 'etc',
]

/** 철거보관 장비 인터페이스 */
export interface StoredEquipment {
  id: string
  orderId?: string                    // 연결된 발주 ID (직접 입력 시 null)
  siteName: string                    // 현장명
  affiliate?: string                  // 계열사
  address?: string                    // 현장 주소
  category: string                    // 품목 (스탠드에어컨, 벽걸이에어컨 등)
  equipmentUnitType?: EquipmentUnitType // 장비 유형 (SET/실내기/실외기 등)
  model?: string                      // 모델명
  size?: string                       // 평형
  quantity: number                    // 수량
  manufacturer?: string               // 제조사 (삼성/LG/캐리어/기타)
  manufacturingDate?: string           // 제조년월 (YYYY-MM 형식)

  // 보관 정보
  warehouseId?: string                // 보관 창고 ID
  storageStartDate?: string           // 보관 시작일 (YYYY-MM-DD)
  removalDate?: string                // 철거일 (YYYY-MM-DD)
  removalReason?: string              // 철거 사유
  notes?: string                      // 메모

  // 출고 정보
  status: StoredEquipmentStatus       // 보관중 / 출고완료
  releaseType?: ReleaseType           // 출고 유형
  releaseDate?: string                // 출고일
  releaseDestination?: string         // 출고 목적지 (설치 현장명)
  releaseAddress?: string             // 출고 목적지 주소
  releaseNotes?: string               // 출고 메모

  // 시스템
  createdAt?: string
  updatedAt?: string
}

/**
 * 평형 옵션 (드롭다운용)
 * 에어컨 규격에 맞는 표준 평형 목록
 */
export const SIZE_OPTIONS = [
  '7평',
  '10평',
  '13평',
  '15평',
  '18평',
  '23평',
  '28평',
  '30평',
  '36평',
  '40평',
  '60평',
] as const

/**
 * 제조사 옵션 (드롭다운용)
 */
export const MANUFACTURER_OPTIONS = [
  '삼성',
  'LG',
  '캐리어',
  '기타',
] as const

/**
 * 현장 그룹 (철거보관 페이지용)
 *
 * 발주서 1건 = 현장 1개로 매핑
 * 현장 안에 여러 대의 장비가 있을 수 있습니다
 */
export interface StoredEquipmentSite {
  /** 발주 ID (수동 등록 그룹이면 null) */
  orderId: string | null
  /** 현장명 (발주의 businessName 또는 수동 입력 siteName) */
  siteName: string
  /** 계열사 */
  affiliate?: string
  /** 현장 주소 */
  address?: string
  /** 발주일 */
  orderDate?: string
  /** 해당 발주의 철거보관 OrderItem 목록 (장비 등록 시 자동채움용) */
  orderItems?: OrderItem[]
  /** 이 현장에 등록된 장비 목록 */
  equipment: StoredEquipment[]
}

/** 보관 상태 한글 라벨 */
export const STORED_EQUIPMENT_STATUS_LABELS: Record<StoredEquipmentStatus, string> = {
  'stored': '보관중',
  'released': '출고완료',
}

/** 보관 상태 색상 */
export const STORED_EQUIPMENT_STATUS_COLORS: Record<StoredEquipmentStatus, string> = {
  'stored': 'bg-blue-50 text-blue-700 border-blue-200',
  'released': 'bg-gray-100 text-gray-500 border-gray-200',
}

/** 출고 유형 한글 라벨 */
export const RELEASE_TYPE_LABELS: Record<ReleaseType, string> = {
  'reinstall': '재설치',
  'dispose': '폐기',
}

/** 출고 유형 색상 */
export const RELEASE_TYPE_COLORS: Record<ReleaseType, string> = {
  'reinstall': 'bg-green-50 text-green-700 border-green-200',
  'dispose': 'bg-red-50 text-red-700 border-red-200',
}

/**
 * 주소 문자열 파싱 유틸리티
 * OrderForm에서 생성한 주소를 다시 개별 필드로 분리합니다
 */
export function parseAddress(address: string): ParsedAddress {
  const hasRelocation = address.includes('이전목적지:')

  if (hasRelocation) {
    const [baseText, relocationText] = address.split(' / ')
    const baseClean = baseText.replace('작업장소:', '').trim()
    const relocationClean = relocationText.replace('이전목적지:', '').trim()

    const [base, baseDetail] = baseClean.split(',').map(s => s.trim())
    const [relocation, relocationDetail] = relocationClean.includes(',')
      ? relocationClean.split(',').map(s => s.trim())
      : [relocationClean, undefined]

    return {
      baseAddress: base,
      baseDetailAddress: baseDetail,
      relocationAddress: relocation,
      relocationDetailAddress: relocationDetail,
      isRelocation: true
    }
  } else {
    const [base, baseDetail] = address.includes(',')
      ? address.split(',').map(s => s.trim())
      : [address, undefined]

    return {
      baseAddress: base,
      baseDetailAddress: baseDetail,
      isRelocation: false
    }
  }
}
