/**
 * 선구매 장비 타입 정의
 *
 * 교원그룹이 미리 대금을 지불하고 장비를 구매하는 건입니다.
 * 돈을 먼저 받고 → 장비를 사서 → 교원 재고로 넘기는 흐름.
 *
 * 나중에 "XX현장에서 선구매 장비 사용해주세요" 라고 오면
 * 사용 기록(PrepurchaseUsage)을 남겨서 추적합니다.
 */

/**
 * 선구매 장비 (메인 테이블)
 *
 * 예시: "Wells영업에서 2026년 2월분으로 벽걸이 에어컨 10대 선구매"
 */
export interface PrepurchaseEquipment {
  id: string                    // 고유 ID (UUID)
  affiliate: string             // 구매 계열사 (구몬, Wells영업 등)
  modelName: string             // 모델명
  quantity: number              // 구매 수량
  settlementMonth: string       // 선정산 월 (YYYY-MM, 예: "2026-02")
  usedQuantity: number          // 사용된 수량 (사용기록 합계)
  notes?: string                // 메모
  createdAt?: string
  updatedAt?: string
}

/**
 * 선구매 장비 사용 기록
 *
 * "XX현장에서 선구매 장비 3대 사용" 같은 기록
 * 하나의 선구매 건에 여러 사용 기록이 붙을 수 있음 (1:N)
 */
export interface PrepurchaseUsage {
  id: string                    // 고유 ID (UUID)
  prepurchaseId: string         // 어떤 선구매 건인지 (FK)
  affiliate?: string            // 계열사
  siteName: string              // 사업자명 (어디에서 사용했는지)
  usedQuantity: number          // 사용 수량
  usedDate: string              // 사용일 (YYYY-MM-DD)
  notes?: string                // 메모
  createdAt?: string
}
