/**
 * 엑셀 내보내기 공통 유틸리티
 * - 모든 페이지에서 현재 탭 데이터를 .xlsx 파일로 다운로드할 때 사용
 * - ExcelJS 기반 — 셀 서식(테두리/배경색/폰트/병합) 지원
 */

import ExcelJS from 'exceljs'

/* ─────────────────────────── 타입 정의 ─────────────────────────── */

/** 엑셀 컬럼 설정 */
export interface ExcelColumn<T> {
  /** 엑셀 헤더(첫 번째 행)에 표시될 이름 */
  header: string
  /** 데이터 객체에서 값을 꺼낼 키 (단순 키) */
  key?: keyof T
  /** 커스텀 값 추출 함수 (복잡한 계산이나 중첩 데이터에 사용) */
  getValue?: (item: T) => string | number | null | undefined
  /** 엑셀 컬럼 너비 (기본 15) */
  width?: number
  /** 숫자 포맷 (예: '#,##0' → 1000 단위 쉼표) */
  numberFormat?: string
}

/** 일반 테이블 엑셀 변환 옵션 */
export interface ExportOptions<T> {
  /** 데이터 배열 */
  data: T[]
  /** 컬럼 설정 배열 */
  columns: ExcelColumn<T>[]
  /** 파일명 (확장자 제외) — buildExcelFileName()으로 생성 권장 */
  fileName: string
  /** 시트 이름 (기본: 'Sheet1') */
  sheetName?: string
}

/** 다중 시트 엑셀 옵션 */
export interface ExportMultiSheetOptions {
  /** 각 시트별 설정 */
  sheets: {
    sheetName: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    columns: ExcelColumn<any>[]
  }[]
  /** 파일명 (확장자 제외) */
  fileName: string
}

/** 부모+자식 중첩 데이터 엑셀 변환 옵션 (배송관리 등) */
export interface ExportFlattenedOptions<P, C> {
  /** 부모 데이터 배열 */
  parents: P[]
  /** 부모에서 자식 배열을 꺼내는 함수 */
  getChildren: (parent: P) => C[]
  /** 부모 컬럼 설정 */
  parentColumns: ExcelColumn<P>[]
  /** 자식 컬럼 설정 */
  childColumns: ExcelColumn<C>[]
  /** 파일명 (확장자 제외) */
  fileName: string
  /** 시트 이름 (기본: 'Sheet1') */
  sheetName?: string
}

/**
 * 정산관리 전용: 계열사별 시트 생성 (정산 요약 + 사업자별 견적 상세)
 *
 * 각 계열사 시트 구조:
 * ┌─────────────────────────────────────────────────┐
 * │ [정산 요약]                                       │
 * │ 사업자명 | 작업종류 | 발주일 | 완료일 | 부가세별도 | VAT | 합계 │
 * │ ...                                              │
 * │ ── 소계 ──                            xxx   xxx   │
 * │                                                   │
 * │ [견적서 상세]                                      │
 * │ ▸ 사업자A (작업종류)                               │
 * │   구분 | 항목명 | 수량 | 단가 | 금액                │
 * │   장비비  벽걸이형 16평  1   xxx   xxx              │
 * │   설치비  표준설치       1   xxx   xxx              │
 * │                                ── 소계: xxx ──     │
 * │                                                   │
 * │ ▸ 사업자B (작업종류)                               │
 * │   ...                                             │
 * └─────────────────────────────────────────────────┘
 */
export interface SettlementSheetData {
  /** 사업자명 */
  businessName: string
  /** 작업종류 */
  workTypes: string
  /** 발주일 */
  orderDate: string
  /** 설치완료일 */
  installCompleteDate: string
  /** 부가세별도 (공급가액+기업이윤) */
  subtotalWithProfit: number
  /** 부가세 */
  vat: number
  /** 합계(VAT포함) */
  grandTotal: number
  /** 장비비 절사 */
  equipRounding: number
  /** 설치비 절사 */
  installRounding: number
  /** 공급가액 (장비비소계+설치비소계) */
  supplyAmount: number
  /** 기업이윤 (설치비의 3%, 절사 반영) */
  adjustedProfit: number
  /** 견적서 항목 */
  quoteItems: {
    category: string    // '장비비' | '설치비'
    productName: string // 품목명
    modelName: string   // 모델명
    quantity: number
    unitPrice: number
    totalPrice: number
  }[]
}

/** 요약 통계에 사용할 계열사별 합계 */
export interface AffiliateSummary {
  name: string
  installCount: number
  installTotal: number  // VAT포함
  asCount: number
  asTotal: number       // VAT포함
}

export interface ExportSettlementOptions {
  /** 계열사별 설치정산 데이터 */
  affiliateData: Record<string, SettlementSheetData[]>
  /** 계열사별 AS정산 데이터 */
  asAffiliateData?: Record<string, Record<string, unknown>[]>
  asColumns?: ExcelColumn<Record<string, unknown>>[]
  /** 요약 통계 (첫 시트용) */
  summary?: AffiliateSummary[]
  /** 파일명 */
  fileName: string
  /** 월 라벨 (예: '2026년2월') */
  monthLabel: string
}

/* ─────────────────────────── 스타일 상수 ─────────────────────────── */

/** 헤더 배경 (진한 남색) */
const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF2B3A67' },
}

/** 헤더 폰트 (흰색 볼드 10pt 맑은고딕) */
const HEADER_FONT: Partial<ExcelJS.Font> = {
  name: '맑은 고딕',
  size: 10,
  bold: true,
  color: { argb: 'FFFFFFFF' },
}

/** 데이터 셀 기본 폰트 (10pt 맑은고딕) */
const DEFAULT_FONT: Partial<ExcelJS.Font> = {
  name: '맑은 고딕',
  size: 10,
}

/** 데이터 셀 얇은 테두리 */
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
  left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
  bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
  right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
}

/** 합계행 볼드 폰트 */
const TOTAL_FONT: Partial<ExcelJS.Font> = {
  name: '맑은 고딕',
  size: 10,
  bold: true,
}

/** 합계행 상단 두꺼운 테두리 */
const TOTAL_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'medium', color: { argb: 'FF2B3A67' } },
  left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
  bottom: { style: 'double', color: { argb: 'FF2B3A67' } },
  right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
}

/** 섹션 타이틀 폰트 (볼드 12pt) */
const SECTION_TITLE_FONT: Partial<ExcelJS.Font> = {
  name: '맑은 고딕',
  size: 12,
  bold: true,
}

/** 서브 헤더 배경 (연한 회색) */
const SUB_HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF0F0F0' },
}

/** 사업자 구분 배경 (연한 파란색) */
const BUSINESS_HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE8EDF5' },
}

/* ─────────────────────────── 스타일 헬퍼 함수 ─────────────────────────── */

/** 헤더행 스타일 적용 (배경+폰트+테두리+중앙정렬) */
function applyHeaderStyle(row: ExcelJS.Row) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = HEADER_FILL
    cell.font = HEADER_FONT
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF2B3A67' } },
      left: { style: 'thin', color: { argb: 'FF2B3A67' } },
      bottom: { style: 'thin', color: { argb: 'FF2B3A67' } },
      right: { style: 'thin', color: { argb: 'FF2B3A67' } },
    }
  })
  row.height = 22
}

/** 데이터 셀 스타일 적용 (테두리+정렬+숫자포맷) */
function applyDataCellStyle(cell: ExcelJS.Cell, numberFormat?: string) {
  cell.font = DEFAULT_FONT
  cell.border = THIN_BORDER
  cell.alignment = { vertical: 'middle' }

  // 숫자 셀은 오른쪽 정렬 + 포맷
  if (typeof cell.value === 'number') {
    cell.alignment = { horizontal: 'right', vertical: 'middle' }
    cell.numFmt = numberFormat || '#,##0'
  }
}

/** 합계행 스타일 적용 (볼드+상단 두꺼운 테두리) */
function applyTotalRowStyle(row: ExcelJS.Row) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = TOTAL_FONT
    cell.border = TOTAL_BORDER
    cell.alignment = { vertical: 'middle' }
    if (typeof cell.value === 'number') {
      cell.alignment = { horizontal: 'right', vertical: 'middle' }
      cell.numFmt = '#,##0'
    }
  })
}

/** 섹션 타이틀 적용 (셀 병합 + 큰 폰트) */
function applySectionTitle(ws: ExcelJS.Worksheet, rowNum: number, title: string, colSpan: number) {
  const row = ws.getRow(rowNum)
  row.getCell(1).value = title
  row.getCell(1).font = SECTION_TITLE_FONT
  row.getCell(1).alignment = { vertical: 'middle' }
  if (colSpan > 1) {
    ws.mergeCells(rowNum, 1, rowNum, colSpan)
  }
  row.height = 28
  row.commit()
}

/* ─────────────────────────── 핵심 함수 ─────────────────────────── */

/**
 * 컬럼 설정에 따라 데이터 한 행의 값을 추출
 */
function extractRowValues<T>(item: T, columns: ExcelColumn<T>[]): (string | number | null | undefined)[] {
  return columns.map((col) => {
    if (col.getValue) return col.getValue(item)
    if (col.key) return item[col.key] as string | number | null | undefined
    return ''
  })
}

/**
 * 워크북을 .xlsx 파일로 다운로드 (async Blob 패턴)
 */
async function downloadWorkbook(wb: ExcelJS.Workbook, fileName: string) {
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${fileName}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/* ─────────────────────────── 공개 API ─────────────────────────── */

/**
 * 일반 테이블 → 엑셀 다운로드
 *
 * 사용 예:
 * ```ts
 * exportToExcel({
 *   data: filteredItems,
 *   columns: [
 *     { header: '이름', key: 'name', width: 20 },
 *     { header: '금액', getValue: (item) => item.price, numberFormat: '#,##0' },
 *   ],
 *   fileName: buildExcelFileName('AS관리', 'AS접수'),
 * })
 * ```
 */
export async function exportToExcel<T>({ data, columns, fileName, sheetName = 'Sheet1' }: ExportOptions<T>) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(sheetName)

  // 1) 컬럼 너비 설정
  ws.columns = columns.map((c) => ({ width: c.width ?? 15 }))

  // 2) 헤더 행
  const headerRow = ws.addRow(columns.map((c) => c.header))
  applyHeaderStyle(headerRow)

  // 3) 데이터 행
  data.forEach((item) => {
    const values = extractRowValues(item, columns)
    const row = ws.addRow(values)
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const col = columns[colNumber - 1]
      applyDataCellStyle(cell, col?.numberFormat)
    })
  })

  await downloadWorkbook(wb, fileName)
}

/**
 * 다중 시트 엑셀 다운로드
 *
 * 사용 예: 정산관리 — 시트1: 설치정산, 시트2: AS정산
 */
export async function exportMultiSheetExcel({ sheets, fileName }: ExportMultiSheetOptions) {
  const wb = new ExcelJS.Workbook()

  sheets.forEach(({ sheetName, data, columns }) => {
    const ws = wb.addWorksheet(sheetName)
    ws.columns = columns.map((c) => ({ width: c.width ?? 15 }))

    const headerRow = ws.addRow(columns.map((c) => c.header))
    applyHeaderStyle(headerRow)

    data.forEach((item) => {
      const values = extractRowValues(item, columns)
      const row = ws.addRow(values)
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const col = columns[colNumber - 1]
        applyDataCellStyle(cell, col?.numberFormat)
      })
    })
  })

  await downloadWorkbook(wb, fileName)
}

/**
 * 부모+자식 중첩 데이터 → 1행=1자식으로 펼쳐서 엑셀 다운로드
 * (배송관리: 발주(부모) + 구성품(자식[]) 등)
 *
 * 부모 정보는 첫 번째 자식 행에만 표시하고, 나머지는 빈 칸
 */
export async function exportFlattenedToExcel<P, C>({
  parents,
  getChildren,
  parentColumns,
  childColumns,
  fileName,
  sheetName = 'Sheet1',
}: ExportFlattenedOptions<P, C>) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(sheetName)

  const allColumns = [...parentColumns, ...childColumns]
  ws.columns = allColumns.map((c) => ({ width: (c as ExcelColumn<P | C>).width ?? 15 }))

  // 헤더 행
  const headerRow = ws.addRow(allColumns.map((c) => c.header))
  applyHeaderStyle(headerRow)

  // 데이터 행
  parents.forEach((parent) => {
    const children = getChildren(parent)
    const parentValues = extractRowValues(parent, parentColumns)

    if (children.length === 0) {
      // 자식이 없으면 부모만 1행
      const row = ws.addRow([...parentValues, ...childColumns.map(() => '')])
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const col = allColumns[colNumber - 1]
        applyDataCellStyle(cell, (col as ExcelColumn<P | C>)?.numberFormat)
      })
    } else {
      children.forEach((child, idx) => {
        const childValues = extractRowValues(child, childColumns)
        const rowValues = idx === 0
          ? [...parentValues, ...childValues]
          : [...parentColumns.map(() => ''), ...childValues]
        const row = ws.addRow(rowValues)
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const col = allColumns[colNumber - 1]
          applyDataCellStyle(cell, (col as ExcelColumn<P | C>)?.numberFormat)
        })
      })
    }
  })

  await downloadWorkbook(wb, fileName)
}

/**
 * 정산관리 전용: 요약 시트 + 계열사별 시트 + AS 시트 생성
 * 보고서 수준 서식 적용 (테두리/배경색/폰트/병합/숫자포맷)
 */
export async function exportSettlementExcel({ affiliateData, asAffiliateData, asColumns, summary, fileName, monthLabel }: ExportSettlementOptions) {
  const wb = new ExcelJS.Workbook()

  // ═══════════════════════════════════════════════════
  //  첫 번째 시트: 요약 통계
  // ═══════════════════════════════════════════════════
  if (summary && summary.length > 0) {
    const ws = wb.addWorksheet(`${monthLabel} 정산`)
    ws.columns = [{ width: 18 }, { width: 12 }, { width: 20 }]

    let installTotalCount = 0
    let installTotalAmount = 0
    let asTotalCount = 0
    let asTotalAmount = 0

    // ── 대제목 ──
    applySectionTitle(ws, 1, `${monthLabel} 정산 요약`, 3)
    ws.addRow([]) // 빈 행

    // ── 설치 정산 섹션 ──
    const installSectionRow = ws.addRow(['설치 정산'])
    installSectionRow.getCell(1).font = { ...TOTAL_FONT, size: 11 }
    installSectionRow.commit()

    const installHeaderRow = ws.addRow(['계열사', '건수', '합계(VAT포함)'])
    applyHeaderStyle(installHeaderRow)

    summary.forEach((s) => {
      const row = ws.addRow([s.name, s.installCount, s.installCount > 0 ? s.installTotal : 0])
      row.eachCell({ includeEmpty: true }, (cell) => applyDataCellStyle(cell))
      installTotalCount += s.installCount
      installTotalAmount += s.installTotal
    })

    // 설치 합계행
    const installTotalRow = ws.addRow(['합 계', installTotalCount, installTotalAmount])
    applyTotalRowStyle(installTotalRow)

    ws.addRow([]) // 빈 행
    ws.addRow([]) // 빈 행

    // ── AS 정산 섹션 ──
    const asSectionRow = ws.addRow(['AS 정산'])
    asSectionRow.getCell(1).font = { ...TOTAL_FONT, size: 11 }
    asSectionRow.commit()

    const asHeaderRow = ws.addRow(['계열사', '건수', '합계(VAT포함)'])
    applyHeaderStyle(asHeaderRow)

    summary.forEach((s) => {
      const row = ws.addRow([s.name, s.asCount, s.asCount > 0 ? s.asTotal : 0])
      row.eachCell({ includeEmpty: true }, (cell) => applyDataCellStyle(cell))
      asTotalCount += s.asCount
      asTotalAmount += s.asTotal
    })

    // AS 합계행
    const asTotalRow = ws.addRow(['합 계', asTotalCount, asTotalAmount])
    applyTotalRowStyle(asTotalRow)

    ws.addRow([]) // 빈 행
    ws.addRow([]) // 빈 행

    // ── 최종 합계 섹션 ──
    const finalSectionRow = ws.addRow(['최종 정산금액'])
    finalSectionRow.getCell(1).font = { ...TOTAL_FONT, size: 11 }
    finalSectionRow.commit()

    const finalHeaderRow = ws.addRow(['구분', '건수', '합계(VAT포함)'])
    applyHeaderStyle(finalHeaderRow)

    const finalInstallRow = ws.addRow(['설치 정산', installTotalCount, installTotalAmount])
    finalInstallRow.eachCell({ includeEmpty: true }, (cell) => applyDataCellStyle(cell))

    const finalAsRow = ws.addRow(['AS 정산', asTotalCount, asTotalAmount])
    finalAsRow.eachCell({ includeEmpty: true }, (cell) => applyDataCellStyle(cell))

    // 최종 합계행
    const finalTotalRow = ws.addRow(['최종 합계', installTotalCount + asTotalCount, installTotalAmount + asTotalAmount])
    applyTotalRowStyle(finalTotalRow)
  }

  // ═══════════════════════════════════════════════════
  //  계열사별 시트 (0건도 포함)
  // ═══════════════════════════════════════════════════
  Object.entries(affiliateData).forEach(([affiliate, orders]) => {
    const sheetName = affiliate.length > 31 ? affiliate.substring(0, 31) : affiliate
    const ws = wb.addWorksheet(sheetName)

    // 컬럼 너비 설정
    ws.columns = [
      { width: 22 }, // A: 사업자명/구분헤더
      { width: 10 }, // B: 작업종류/구분
      { width: 22 }, // C: 발주일/품목명
      { width: 20 }, // D: 설치완료일/모델명
      { width: 10 }, // E: 공급가액/수량
      { width: 16 }, // F: 기업이윤/단가/라벨
      { width: 16 }, // G: 소계/금액
      { width: 14 }, // H: 부가세
      { width: 16 }, // I: 합계
    ]

    // ── 상단: 정산 요약 테이블 ──
    applySectionTitle(ws, 1, `[ ${affiliate} ] ${monthLabel} 정산 요약 — ${orders.length}건`, 9)
    ws.addRow([]) // 빈 행

    // 정산 요약 헤더
    const summaryHeaderRow = ws.addRow([
      '사업자명', '작업종류', '발주일', '설치완료일',
      '공급가액', '기업이윤', '소계(부가세별도)', '부가세', '합계(VAT포함)',
    ])
    applyHeaderStyle(summaryHeaderRow)

    let totalSupply = 0
    let totalProfit = 0
    let totalSubtotal = 0
    let totalVat = 0
    let totalGrand = 0

    // 데이터 행
    orders.forEach((o) => {
      const row = ws.addRow([
        o.businessName, o.workTypes, o.orderDate, o.installCompleteDate,
        o.supplyAmount, o.adjustedProfit, o.subtotalWithProfit, o.vat, o.grandTotal,
      ])
      row.eachCell({ includeEmpty: true }, (cell) => applyDataCellStyle(cell))
      totalSupply += o.supplyAmount
      totalProfit += o.adjustedProfit
      totalSubtotal += o.subtotalWithProfit
      totalVat += o.vat
      totalGrand += o.grandTotal
    })

    // 합계행
    ws.addRow([]) // 빈 행
    const totalRow = ws.addRow([
      '', '', '', '합 계',
      totalSupply, totalProfit, totalSubtotal, totalVat, totalGrand,
    ])
    applyTotalRowStyle(totalRow)

    ws.addRow([]) // 빈 행
    ws.addRow([]) // 빈 행

    // ── 하단: 사업자별 견적서 상세 ──
    applySectionTitle(ws, ws.rowCount + 1, `[ ${affiliate} ] 견적서 상세`, 9)
    ws.addRow([]) // 빈 행

    orders.forEach((o) => {
      if (!o.quoteItems || o.quoteItems.length === 0) return

      // 사업자 구분 헤더 (연한 파란 배경)
      const bizRow = ws.addRow([`▸ ${o.businessName}  (${o.workTypes})`])
      bizRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = BUSINESS_HEADER_FILL
        cell.font = TOTAL_FONT
        cell.border = THIN_BORDER
      })
      ws.mergeCells(bizRow.number, 1, bizRow.number, 7)

      // 서브 헤더 (연한 회색 배경)
      const subHeaderRow = ws.addRow(['', '구분', '품목명', '모델명', '수량', '단가', '금액'])
      subHeaderRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.fill = SUB_HEADER_FILL
        cell.font = { ...DEFAULT_FONT, bold: true }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = THIN_BORDER
      })

      const equipItems = o.quoteItems.filter((q) => q.category === '장비비')
      const installItems = o.quoteItems.filter((q) => q.category === '설치비')

      // 장비비 항목
      if (equipItems.length > 0) {
        equipItems.forEach((q) => {
          const row = ws.addRow(['', q.category, q.productName, q.modelName, q.quantity, q.unitPrice, q.totalPrice])
          row.eachCell({ includeEmpty: true }, (cell) => applyDataCellStyle(cell))
        })
        // 장비비 절사
        if (o.equipRounding > 0) {
          const row = ws.addRow(['', '', '', '', '', '장비비 절사', -o.equipRounding])
          row.eachCell({ includeEmpty: true }, (cell) => applyDataCellStyle(cell))
          row.getCell(6).font = { ...DEFAULT_FONT, italic: true, color: { argb: 'FF888888' } }
          row.getCell(7).font = { ...DEFAULT_FONT, italic: true, color: { argb: 'FF888888' } }
        }
      }

      // 설치비 항목
      if (installItems.length > 0) {
        installItems.forEach((q) => {
          const row = ws.addRow(['', q.category, q.productName, q.modelName, q.quantity, q.unitPrice, q.totalPrice])
          row.eachCell({ includeEmpty: true }, (cell) => applyDataCellStyle(cell))
        })
        // 설치비 절사
        if (o.installRounding > 0) {
          const row = ws.addRow(['', '', '', '', '', '설치비 절사', -o.installRounding])
          row.eachCell({ includeEmpty: true }, (cell) => applyDataCellStyle(cell))
          row.getCell(6).font = { ...DEFAULT_FONT, italic: true, color: { argb: 'FF888888' } }
          row.getCell(7).font = { ...DEFAULT_FONT, italic: true, color: { argb: 'FF888888' } }
        }
      }

      // 공급가액 / 기업이윤 / 소계 / VAT / 합계 — 요약 라인
      ws.addRow([]) // 빈 행
      const summaryLabels = [
        ['공급가액', o.supplyAmount],
        ['기업이윤(3%)', o.adjustedProfit],
        ['소계(부가세별도)', o.subtotalWithProfit],
        ['부가세(10%)', o.vat],
        ['합계(VAT포함)', o.grandTotal],
      ] as const

      summaryLabels.forEach(([label, value]) => {
        const row = ws.addRow(['', '', '', '', '', label, value])
        row.getCell(6).font = { ...DEFAULT_FONT, bold: true }
        row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' }
        row.getCell(6).border = THIN_BORDER
        row.getCell(7).font = { ...DEFAULT_FONT, bold: true }
        row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' }
        row.getCell(7).numFmt = '#,##0'
        row.getCell(7).border = THIN_BORDER
      })

      // 합계(VAT포함) 행 — 이중 테두리로 강조
      const lastDataRow = ws.getRow(ws.rowCount)
      lastDataRow.getCell(6).border = TOTAL_BORDER
      lastDataRow.getCell(7).border = TOTAL_BORDER

      ws.addRow([]) // 빈 행 (사업자 간 구분)
    })
  })

  // ═══════════════════════════════════════════════════
  //  AS정산 시트 (계열사별)
  // ═══════════════════════════════════════════════════
  if (asAffiliateData && asColumns) {
    Object.entries(asAffiliateData).forEach(([affiliate, data]) => {
      const sheetName = `AS_${affiliate}`.substring(0, 31)
      const ws = wb.addWorksheet(sheetName)
      ws.columns = asColumns.map((c) => ({ width: c.width ?? 15 }))

      const headerRow = ws.addRow(asColumns.map((c) => c.header))
      applyHeaderStyle(headerRow)

      // AS비용/접수비/합계 누적 합산
      let sumAsCost = 0
      let sumReceptionFee = 0
      let sumTotalAmount = 0

      data.forEach((item) => {
        const values = extractRowValues(item, asColumns)
        const row = ws.addRow(values)
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const col = asColumns[colNumber - 1]
          applyDataCellStyle(cell, col?.numberFormat)
        })
        sumAsCost += ((item.asCost as number) || 0)
        sumReceptionFee += ((item.receptionFee as number) || 0)
        sumTotalAmount += ((item.totalAmount as number) || 0)
      })

      // ── AS 시트 하단: 합계 + 단위절사 + 부가세 요약 ──
      if (data.length > 0) {
        ws.addRow([]) // 빈 행

        // asColumns에서 AS비용/접수비/합계 컬럼 인덱스 찾기 (1-based)
        const asCostIdx = asColumns.findIndex((c) => c.key === 'asCost') + 1
        const receptionFeeIdx = asColumns.findIndex((c) => c.key === 'receptionFee') + 1
        const totalAmountIdx = asColumns.findIndex((c) => c.key === 'totalAmount') + 1

        // 합계행: AS비용/접수비/합계 각각 합산
        const totalRow = ws.addRow([])
        // "합 계" 라벨을 첫 번째 셀에
        totalRow.getCell(1).value = '합 계'
        if (asCostIdx > 0) totalRow.getCell(asCostIdx).value = sumAsCost
        if (receptionFeeIdx > 0) totalRow.getCell(receptionFeeIdx).value = sumReceptionFee
        if (totalAmountIdx > 0) totalRow.getCell(totalAmountIdx).value = sumTotalAmount
        applyTotalRowStyle(totalRow)

        ws.addRow([]) // 빈 행

        // 단위절사 / 부가세 / VAT포함 계산 (합계 컬럼 위치에 맞춰 표시)
        // 라벨은 접수비 컬럼, 값은 합계 컬럼 위치 사용
        const labelIdx = receptionFeeIdx > 0 ? receptionFeeIdx : (totalAmountIdx > 0 ? totalAmountIdx - 1 : asColumns.length - 1)
        const valueIdx = totalAmountIdx > 0 ? totalAmountIdx : asColumns.length

        const truncated = Math.floor(sumTotalAmount / 1000) * 1000
        const rounding = sumTotalAmount - truncated
        const vatAmount = Math.floor(truncated * 0.1)
        const grandTotal = truncated + vatAmount

        const asSummaryLines: [string, number][] = [
          ['합계(부가세별도)', sumTotalAmount],
          ['단위절사(천원)', rounding > 0 ? -rounding : 0],
          ['소계', truncated],
          ['부가세(10%)', vatAmount],
          ['합계(VAT포함)', grandTotal],
        ]

        asSummaryLines.forEach(([label, value], idx) => {
          const row = ws.addRow([])
          row.getCell(labelIdx).value = label
          row.getCell(valueIdx).value = value
          row.getCell(labelIdx).font = { ...DEFAULT_FONT, bold: true }
          row.getCell(labelIdx).alignment = { horizontal: 'right', vertical: 'middle' }
          row.getCell(labelIdx).border = THIN_BORDER
          row.getCell(valueIdx).font = { ...DEFAULT_FONT, bold: true }
          row.getCell(valueIdx).alignment = { horizontal: 'right', vertical: 'middle' }
          row.getCell(valueIdx).numFmt = '#,##0'
          row.getCell(valueIdx).border = THIN_BORDER
          // 마지막 행(VAT포함) 이중 테두리 강조
          if (idx === asSummaryLines.length - 1) {
            row.getCell(labelIdx).border = TOTAL_BORDER
            row.getCell(valueIdx).border = TOTAL_BORDER
          }
        })
      }
    })
  }

  await downloadWorkbook(wb, fileName)
}

/**
 * 파일명 생성 유틸
 * @returns `페이지명_탭명_2026-02-13` 형식 (탭명이 없으면 `페이지명_2026-02-13`)
 */
export function buildExcelFileName(pageName: string, tabName?: string): string {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  const dateStr = `${yyyy}-${mm}-${dd}`

  if (tabName) {
    return `${pageName}_${tabName}_${dateStr}`
  }
  return `${pageName}_${dateStr}`
}
