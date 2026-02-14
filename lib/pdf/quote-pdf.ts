/**
 * 견적서 PDF 생성 모듈 (HTML → PDF 변환 방식)
 *
 * 견적서 다이얼로그의 DOM 요소를 html2canvas로 캡처한 뒤
 * jsPDF로 A4 PDF를 생성합니다.
 * (한글 폰트 별도 등록 불필요 — 이미지 기반 캡처)
 */

import { jsPDF } from 'jspdf'

/**
 * HTML 요소를 캡처하여 A4 PDF로 저장
 * @param element 캡처할 HTML 요소
 * @param fileName 저장할 파일명 (.pdf 확장자 포함)
 */
export async function generatePdfFromElement(
  element: HTMLElement,
  fileName: string
): Promise<void> {
  // html2canvas 동적 import (번들 크기 최적화)
  const html2canvas = (await import('html2canvas')).default

  // DOM → Canvas 캡처
  const canvas = await html2canvas(element, {
    scale: 2,                // 고해상도 (2배)
    useCORS: true,           // 외부 리소스 허용
    logging: false,          // 콘솔 로그 비활성화
    backgroundColor: '#ffffff',
  })

  // Canvas → PDF 변환
  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF('p', 'mm', 'a4')

  const pageWidth = pdf.internal.pageSize.getWidth()   // 210mm
  const pageHeight = pdf.internal.pageSize.getHeight()  // 297mm

  // 이미지 크기를 페이지 너비에 맞춤
  let imgWidth = pageWidth
  let imgHeight = (canvas.height * imgWidth) / canvas.width

  // 1장에 맞추기: 높이가 페이지를 넘으면 비율 유지하며 축소
  if (imgHeight > pageHeight) {
    const ratio = pageHeight / imgHeight
    imgWidth = imgWidth * ratio
    imgHeight = pageHeight
  }

  // 가로 중앙 정렬
  const xOffset = (pageWidth - imgWidth) / 2
  pdf.addImage(imgData, 'PNG', xOffset, 0, imgWidth, imgHeight)

  pdf.save(fileName)
}
