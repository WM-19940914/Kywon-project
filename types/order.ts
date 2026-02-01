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
  workType: '신규설치' | '이전설치' | '철거보관' | '철거폐기'  // 작업 종류
  category: string             // 품목 (시스템에어컨, 벽걸이에어컨 등)
  model: string                // 모델명 (예: AR-123)
  size: string                 // 평형 (예: 18평)
  quantity: number             // 수량 (몇 대?)
}

/**
 * 배송상태 타입 (Order 레벨 — 2단계)
 * pending: 발주대기 (아직 삼성에 발주 안 넣음)
 * ordered: 발주완료 (삼성에 발주 넣음)
 *
 * 구성품별 세부 배송상태는 ItemDeliveryStatus로 별도 관리
 */
export type DeliveryStatus = 'pending' | 'ordered'

/** 배송상태 한글 표시용 (Order 레벨) */
export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  'pending': '발주대기',
  'ordered': '발주완료'
}

/** 배송상태별 색상 (Order 레벨 배지용) */
export const DELIVERY_STATUS_COLORS: Record<DeliveryStatus, string> = {
  'pending': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'ordered': 'bg-blue-50 text-blue-700 border-blue-200'
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
}

/**
 * 진행상태 한글 표시용 (3단계)
 */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  'received': '접수중',
  'in-progress': '진행중',
  'completed': '완료',
  'settled': '정산완료'
}

/**
 * 진행상태별 색상 (칸반보드 컬럼 배경색)
 * 노란색 → 파란색 → 보라색 → 초록색 순서
 */
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  'received': 'bg-amber-100 text-amber-800 border border-amber-200',        // 앰버 (시작)
  'in-progress': 'bg-blue-100 text-blue-800 border border-blue-200',        // 블루 (진행)
  'completed': 'bg-violet-100 text-violet-800 border border-violet-200',    // 바이올렛 (완료)
  'settled': 'bg-emerald-100 text-emerald-800 border border-emerald-200'    // 에메랄드 (정산완료)
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
 * 작업종류별 뱃지 색상
 */
export const WORK_TYPE_COLORS: Record<string, string> = {
  '신규설치': 'bg-blue-100 text-blue-800 border-blue-200',
  '이전설치': 'bg-purple-100 text-purple-800 border-purple-200',
  '철거보관': 'bg-amber-100 text-amber-800 border-amber-200',
  '철거폐기': 'bg-red-100 text-red-800 border-red-200',
}

/**
 * 품목 목록 (드롭다운용)
 */
export const CATEGORY_OPTIONS = [
  '시스템에어컨',
  '벽걸이에어컨',
  '스탠드에어컨',
  '천장형에어컨',
  '기타'
] as const

/**
 * 작업종류 목록
 */
export const WORK_TYPE_OPTIONS = [
  '신규설치',
  '이전설치',
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
  warehouseId?: string           // 배송 창고 ID (warehouse-data.ts 참조)
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
