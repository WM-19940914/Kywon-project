/**
 * snake_case ↔ camelCase 자동 변환 유틸리티
 *
 * Supabase(PostgreSQL)는 snake_case를 사용하고,
 * TypeScript(프론트엔드)는 camelCase를 사용합니다.
 *
 * 예: delivery_status → deliveryStatus (DB → 프론트)
 *     deliveryStatus → delivery_status (프론트 → DB)
 */

/**
 * snake_case 문자열을 camelCase로 변환
 * 예: "delivery_status" → "deliveryStatus"
 */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

/**
 * camelCase 문자열을 snake_case로 변환
 * 예: "deliveryStatus" → "delivery_status"
 */
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

/**
 * DB 응답 객체의 키를 snake_case → camelCase로 변환
 * 중첩 객체/배열도 재귀적으로 변환합니다.
 *
 * @param obj - DB에서 받은 snake_case 키를 가진 객체
 * @returns camelCase 키를 가진 객체
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toCamelCase<T>(obj: any): T {
  // null이나 undefined는 그대로 반환 (재귀 호출 시 필드 값 보존 필요)
  if (obj === null || obj === undefined) return obj

  // 배열이면 각 항목을 재귀 변환
  if (Array.isArray(obj)) {
    return obj.map((item) => toCamelCase(item)) as unknown as T
  }

  // 날짜 객체는 그대로
  if (obj instanceof Date) return obj as unknown as T

  // 객체가 아니면 (string, number 등) 그대로
  if (typeof obj !== 'object') return obj

  // 객체의 각 키를 camelCase로 변환
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(obj)) {
    const camelKey = snakeToCamel(key)
    result[camelKey] = toCamelCase(obj[key])
  }
  return result as T
}

/**
 * 프론트엔드 객체의 키를 camelCase → snake_case로 변환
 * DB에 저장하기 전에 사용합니다.
 *
 * @param obj - camelCase 키를 가진 프론트엔드 객체
 * @returns snake_case 키를 가진 DB용 객체
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toSnakeCase(obj: any): Record<string, unknown> {
  // null이나 undefined는 그대로 반환 (재귀 호출 시 필드 값 보존 필요)
  if (obj === null || obj === undefined) return obj

  if (Array.isArray(obj)) {
    return obj.map((item) => toSnakeCase(item)) as unknown as Record<string, unknown>
  }

  if (obj instanceof Date) return obj as unknown as Record<string, unknown>

  if (typeof obj !== 'object') return obj

  const result: Record<string, unknown> = {}
  for (const key of Object.keys(obj)) {
    const snakeKey = camelToSnake(key)
    // 중첩 객체/배열은 재귀 변환하지 않음 (1단계만, 관계 테이블은 별도 저장)
    result[snakeKey] = obj[key]
  }
  return result
}
