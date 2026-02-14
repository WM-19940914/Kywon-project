/**
 * 한글 폰트 동적 로딩 유틸
 *
 * PDF 생성 시 한글을 표시하려면 TTF 폰트를 base64로 변환하여
 * jsPDF VFS에 등록해야 합니다.
 *
 * 최초 1회만 fetch하고, 이후에는 메모리 캐시를 사용합니다.
 * (폰트 파일: public/fonts/NotoSansKR-Regular.ttf, 약 10MB)
 */

import { jsPDF } from 'jspdf'

/** 폰트 base64 메모리 캐시 */
let cachedFontBase64: string | null = null

/**
 * Noto Sans KR Regular 폰트를 fetch하고 base64로 변환
 * - 첫 호출 시에만 네트워크 요청 (1~2초)
 * - 이후 메모리 캐시에서 즉시 반환
 */
async function loadKoreanFont(): Promise<string> {
  if (cachedFontBase64) return cachedFontBase64

  const response = await fetch('/fonts/NotoSansKR-Regular.ttf')
  const arrayBuffer = await response.arrayBuffer()
  const uint8Array = new Uint8Array(arrayBuffer)

  // ArrayBuffer → base64 변환
  let binary = ''
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i])
  }
  cachedFontBase64 = btoa(binary)
  return cachedFontBase64
}

/**
 * jsPDF 인스턴스에 한글 폰트 등록
 * - VFS에 TTF 파일 추가 → 폰트 등록 → 기본 폰트 설정
 */
export async function registerKoreanFont(doc: jsPDF): Promise<void> {
  const base64 = await loadKoreanFont()
  doc.addFileToVFS('NotoSansKR-Regular.ttf', base64)
  doc.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'normal')
  doc.setFont('NotoSansKR')
}
