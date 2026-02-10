/**
 * AS 관리 타입 정의
 *
 * 교원그룹에서 에어컨 AS 접수가 들어오면
 * 멜레아가 삼성AS센터에 연결하고 비용을 관리하는 흐름입니다.
 *
 * 상태 흐름 (4단계):
 *   AS접수 → AS처리중 → AS완료(정산대기) → 정산완료
 */

/**
 * AS 요청 상태 (4단계)
 * - received: AS접수 (교원에서 AS 요청이 들어옴)
 * - in-progress: AS처리중 (삼성AS센터 연결, 기사 방문 등 진행중)
 * - completed: AS완료 / 정산대기 (AS 처리 끝, 비용 확정, 정산 대기)
 * - settled: 정산완료 (월별 정산 마감됨)
 */
export type ASRequestStatus = 'received' | 'in-progress' | 'completed' | 'settled'

/** AS 상태 한글 표시용 */
export const AS_STATUS_LABELS: Record<ASRequestStatus, string> = {
  'received': 'AS접수',
  'in-progress': 'AS처리중',
  'completed': '정산대기',
  'settled': '정산완료',
}

/** AS 상태별 색상 (뱃지용) — 회색 → 주황 → 파랑 → 초록 */
export const AS_STATUS_COLORS: Record<ASRequestStatus, string> = {
  'received': 'bg-gray-100 text-gray-600 border-gray-200',
  'in-progress': 'bg-orange-50 text-orange-700 border-orange-200',
  'completed': 'bg-blue-50 text-blue-700 border-blue-200',
  'settled': 'bg-green-50 text-green-700 border-green-200',
}

/**
 * AS 요청 인터페이스
 *
 * 발주(Order)와는 독립적인 테이블입니다.
 * AS는 발주와 생명주기가 다르기 때문에 분리했어요.
 */
export interface ASRequest {
  id: string                        // 고유 ID (UUID)

  // === 접수 정보 (교원에서 들어오는 정보) ===
  receptionDate: string             // 접수일 (YYYY-MM-DD)
  affiliate: string                 // 계열사 (구몬, Wells 영업 등)
  businessName: string              // 사업자명 (현장명)
  address: string                   // 현장주소 (카카오 주소검색 결과, 도로명)
  detailAddress?: string            // 상세주소 (층/호수 등 수동입력)
  contactName?: string              // 담당자 성함
  contactPhone?: string             // 담당자 연락처
  asReason?: string                 // AS 사유
  modelName?: string                // 모델명
  outdoorUnitLocation?: string      // 실외기 위치

  // === 관리 정보 (멜레아가 입력) ===
  visitDate?: string                // 방문 예정일 (YYYY-MM-DD, 가장 중요!)
  samsungAsCenter?: string          // 삼성AS센터 (연결한 센터명)
  technicianName?: string           // AS 기사 이름
  technicianPhone?: string          // AS 기사 연락처
  processingDetails?: string        // 처리내역
  processedDate?: string            // 처리일 (YYYY-MM-DD, AS 완료 날짜)
  asCost?: number                   // AS 비용 (삼성AS 비용)
  receptionFee?: number             // 접수비 (멜레아 수수료)
  totalAmount?: number              // 총금액 (AS비용 + 접수비, 자동계산)

  // === 상태 ===
  status: ASRequestStatus           // AS접수 / AS처리중 / 정산대기 / 정산완료
  settlementMonth?: string          // 정산월 (YYYY-MM 형식, 예: "2026-02")
  notes?: string                    // 특이사항/메모

  // === 시스템 ===
  createdAt?: string
  updatedAt?: string
}
