/**
 * 공통 유틸리티 함수 모음
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Tailwind CSS 클래스를 병합하는 유틸리티
 * - clsx로 조건부 클래스를 처리하고
 * - tailwind-merge로 충돌하는 클래스를 자동 해결
 *
 * @param inputs - 클래스 문자열, 객체, 배열 등
 * @returns 병합된 클래스 문자열
 *
 * @example
 * cn("px-4 py-2", isActive && "bg-blue-500", "px-6")
 * // → "py-2 px-6 bg-blue-500" (px-4가 px-6으로 대체됨)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
