/**
 * 창고 정보 타입 정의
 *
 * 장비를 보관하는 창고의 정보를 관리합니다.
 */

export interface Warehouse {
  id: string                    // 창고 고유번호
  name: string                  // 창고명 (예: 파주 창고)
  address: string               // 주소
  managerName?: string          // 담당자명
  managerPhone?: string         // 담당자 연락처
  capacity?: number             // 수용 가능 용량 (선택)
  currentStock?: number         // 현재 재고 수량 (선택)
  notes?: string                // 비고
  createdAt?: string            // 등록일시
}
