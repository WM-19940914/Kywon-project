/**
 * 연간 단가표 (2026년 기준)
 *
 * 품목, 모델명, 평형, 단가로 구성된 단순 테이블
 * 사용자가 단가표에서 선택하면 자동으로 입력됩니다.
 */

export interface PriceTableRow {
  category: string   // 품목 (벽걸이형, 스탠드형)
  model: string      // 모델명
  size: string       // 평형
  price: number      // 단가
}

/**
 * 단가표 더미 데이터
 */
export const priceTable: PriceTableRow[] = [
  // 벽걸이형
  { category: '벽걸이형', model: 'AW-06B2WKD', size: '6평', price: 600000 },
  { category: '벽걸이형', model: 'AW-09B2WKD', size: '9평', price: 800000 },
  { category: '벽걸이형', model: 'AW-12B2WKD', size: '12평', price: 1000000 },
  { category: '벽걸이형', model: 'AW-18B2WKD', size: '18평', price: 1400000 },
  { category: '벽걸이형', model: 'AW-24B2WKD', size: '24평', price: 1800000 },

  // 스탠드형
  { category: '스탠드형', model: 'AS-09F2WKD', size: '9평', price: 900000 },
  { category: '스탠드형', model: 'AS-12F2WKD', size: '12평', price: 1100000 },
  { category: '스탠드형', model: 'AS-18F2WKD', size: '18평', price: 1500000 },
  { category: '스탠드형', model: 'AS-24F2WKD', size: '24평', price: 2000000 },
  { category: '스탠드형', model: 'AS-30F2WKD', size: '30평', price: 2500000 },
  { category: '스탠드형', model: 'AS-36F2WKD', size: '36평', price: 3000000 },
]

/**
 * 평형 옵션 (드롭다운용)
 */
export const SIZE_OPTIONS = [
  '6평',
  '9평',
  '12평',
  '18평',
  '24평',
  '30평',
  '36평',
  '48평',
  '미확인'
]

/**
 * 가격 포맷팅 (1,000,000원)
 */
export function formatPrice(price: number): string {
  return `${price.toLocaleString('ko-KR')}원`
}
