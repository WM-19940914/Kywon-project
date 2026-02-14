/**
 * 엑셀 내보내기 공통 유틸리티
 * - 모든 페이지에서 현재 탭 데이터를 .xlsx 파일로 다운로드할 때 사용
 * - xlsx 라이브러리(v0.18.5) 기반
 */

import * as XLSX from 'xlsx'

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
 * 워크시트에 숫자 포맷 적용
 */
function applyNumberFormats<T>(ws: XLSX.WorkSheet, columns: ExcelColumn<T>[], rowCount: number) {
  columns.forEach((col, colIdx) => {
    if (!col.numberFormat) return
    // 데이터 행은 2번째 행부터 (1번째는 헤더)
    for (let rowIdx = 1; rowIdx <= rowCount; rowIdx++) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx })
      const cell = ws[cellRef]
      if (cell && typeof cell.v === 'number') {
        cell.z = col.numberFormat
      }
    }
  })
}

/**
 * 워크북을 .xlsx 파일로 다운로드
 */
function downloadWorkbook(wb: XLSX.WorkBook, fileName: string) {
  XLSX.writeFile(wb, `${fileName}.xlsx`)
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
export function exportToExcel<T>({ data, columns, fileName, sheetName = 'Sheet1' }: ExportOptions<T>) {
  // 1) 헤더 행 + 데이터 행 생성
  const headers = columns.map((c) => c.header)
  const rows = data.map((item) => extractRowValues(item, columns))

  // 2) 워크시트 생성
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])

  // 3) 컬럼 너비 설정
  ws['!cols'] = columns.map((c) => ({ wch: c.width ?? 15 }))

  // 4) 숫자 포맷 적용
  applyNumberFormats(ws, columns, data.length)

  // 5) 워크북 생성 & 다운로드
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  downloadWorkbook(wb, fileName)
}

/**
 * 다중 시트 엑셀 다운로드
 *
 * 사용 예: 정산관리 — 시트1: 설치정산, 시트2: AS정산
 */
export function exportMultiSheetExcel({ sheets, fileName }: ExportMultiSheetOptions) {
  const wb = XLSX.utils.book_new()

  sheets.forEach(({ sheetName, data, columns }) => {
    const headers = columns.map((c) => c.header)
    const rows = data.map((item) => extractRowValues(item, columns))
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = columns.map((c) => ({ wch: c.width ?? 15 }))
    applyNumberFormats(ws, columns, data.length)
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  })

  downloadWorkbook(wb, fileName)
}

/**
 * 부모+자식 중첩 데이터 → 1행=1자식으로 펼쳐서 엑셀 다운로드
 * (배송관리: 발주(부모) + 구성품(자식[]) 등)
 *
 * 부모 정보는 첫 번째 자식 행에만 표시하고, 나머지는 빈 칸
 */
export function exportFlattenedToExcel<P, C>({
  parents,
  getChildren,
  parentColumns,
  childColumns,
  fileName,
  sheetName = 'Sheet1',
}: ExportFlattenedOptions<P, C>) {
  const allColumns = [...parentColumns, ...childColumns]
  const headers = allColumns.map((c) => c.header)
  const rows: (string | number | null | undefined)[][] = []

  parents.forEach((parent) => {
    const children = getChildren(parent)
    const parentValues = extractRowValues(parent, parentColumns)

    if (children.length === 0) {
      // 자식이 없으면 부모만 1행
      rows.push([...parentValues, ...childColumns.map(() => '')])
    } else {
      children.forEach((child, idx) => {
        const childValues = extractRowValues(child, childColumns)
        if (idx === 0) {
          // 첫 번째 자식: 부모 정보 포함
          rows.push([...parentValues, ...childValues])
        } else {
          // 나머지 자식: 부모 컬럼은 빈 칸
          rows.push([...parentColumns.map(() => ''), ...childValues])
        }
      })
    }
  })

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws['!cols'] = allColumns.map((c) => ({ wch: (c as ExcelColumn<P | C>).width ?? 15 }))

  // 숫자 포맷 적용 (부모+자식 컬럼 합쳐서)
  allColumns.forEach((col, colIdx) => {
    const format = (col as ExcelColumn<P | C>).numberFormat
    if (!format) return
    for (let rowIdx = 1; rowIdx <= rows.length; rowIdx++) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx })
      const cell = ws[cellRef]
      if (cell && typeof cell.v === 'number') {
        cell.z = format
      }
    }
  })

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  downloadWorkbook(wb, fileName)
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

export function exportSettlementExcel({ affiliateData, asAffiliateData, asColumns, summary, fileName, monthLabel }: ExportSettlementOptions) {
  const wb = XLSX.utils.book_new()

  // ── 첫 번째 시트: 요약 통계 ──
  if (summary && summary.length > 0) {
    const rows: (string | number | null)[][] = []

    rows.push([`${monthLabel} 정산 요약`])
    rows.push([])

    // 설치 정산 요약
    rows.push(['[ 설치 정산 ]'])
    rows.push(['계열사', '건수', '합계(VAT포함)'])
    let installTotalCount = 0
    let installTotalAmount = 0
    summary.forEach(s => {
      rows.push([s.name, s.installCount, s.installCount > 0 ? s.installTotal : 0])
      installTotalCount += s.installCount
      installTotalAmount += s.installTotal
    })
    rows.push([])
    rows.push(['합 계', installTotalCount, installTotalAmount])
    rows.push([])
    rows.push([])

    // AS 정산 요약
    rows.push(['[ AS 정산 ]'])
    rows.push(['계열사', '건수', '합계(VAT포함)'])
    let asTotalCount = 0
    let asTotalAmount = 0
    summary.forEach(s => {
      rows.push([s.name, s.asCount, s.asCount > 0 ? s.asTotal : 0])
      asTotalCount += s.asCount
      asTotalAmount += s.asTotal
    })
    rows.push([])
    rows.push(['합 계', asTotalCount, asTotalAmount])
    rows.push([])
    rows.push([])

    // 최종 합계
    rows.push(['[ 최종 정산금액 ]'])
    rows.push(['구분', '건수', '합계(VAT포함)'])
    rows.push(['설치 정산', installTotalCount, installTotalAmount])
    rows.push(['AS 정산', asTotalCount, asTotalAmount])
    rows.push([])
    rows.push(['최종 합계', installTotalCount + asTotalCount, installTotalAmount + asTotalAmount])

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 20 }]
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < (rows[r]?.length || 0); c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c })
        const cell = ws[cellRef]
        if (cell && typeof cell.v === 'number') cell.z = '#,##0'
      }
    }
    XLSX.utils.book_append_sheet(wb, ws, `${monthLabel} 정산`)
  }

  // 계열사별 시트 생성 (0건도 포함)
  Object.entries(affiliateData).forEach(([affiliate, orders]) => {
    const rows: (string | number | null)[][] = []

    // ── 상단: 정산 요약 테이블 ──
    rows.push([`[ ${affiliate} ] ${monthLabel} 정산 요약 — ${orders.length}건`])
    rows.push([])
    rows.push(['사업자명', '작업종류', '발주일', '설치완료일', '공급가액', '기업이윤', '소계(부가세별도)', '부가세', '합계(VAT포함)'])

    let totalSupply = 0
    let totalProfit = 0
    let totalSubtotal = 0
    let totalVat = 0
    let totalGrand = 0

    orders.forEach(o => {
      rows.push([
        o.businessName, o.workTypes, o.orderDate, o.installCompleteDate,
        o.supplyAmount, o.adjustedProfit, o.subtotalWithProfit, o.vat, o.grandTotal,
      ])
      totalSupply += o.supplyAmount
      totalProfit += o.adjustedProfit
      totalSubtotal += o.subtotalWithProfit
      totalVat += o.vat
      totalGrand += o.grandTotal
    })

    // 합계 행
    rows.push([])
    rows.push(['', '', '', '합 계', totalSupply, totalProfit, totalSubtotal, totalVat, totalGrand])
    rows.push([])
    rows.push([])

    // ── 하단: 사업자별 견적서 상세 ──
    rows.push([`[ ${affiliate} ] 견적서 상세`])
    rows.push([])

    orders.forEach(o => {
      if (!o.quoteItems || o.quoteItems.length === 0) return

      // 사업자 구분 헤더
      rows.push([`▸ ${o.businessName}  (${o.workTypes})`])
      rows.push(['', '구분', '품목명', '모델명', '수량', '단가', '금액'])

      const equipItems = o.quoteItems.filter(q => q.category === '장비비')
      const installItems = o.quoteItems.filter(q => q.category === '설치비')

      // 장비비 항목
      if (equipItems.length > 0) {
        equipItems.forEach(q => {
          rows.push(['', q.category, q.productName, q.modelName, q.quantity, q.unitPrice, q.totalPrice])
        })
        // 장비비 절사
        if (o.equipRounding > 0) {
          rows.push(['', '', '', '', '', '장비비 절사', -o.equipRounding])
        }
      }

      // 설치비 항목
      if (installItems.length > 0) {
        installItems.forEach(q => {
          rows.push(['', q.category, q.productName, q.modelName, q.quantity, q.unitPrice, q.totalPrice])
        })
        // 설치비 절사
        if (o.installRounding > 0) {
          rows.push(['', '', '', '', '', '설치비 절사', -o.installRounding])
        }
      }

      // 공급가액 / 기업이윤 / 소계 / VAT / 합계
      rows.push([])
      rows.push(['', '', '', '', '', '공급가액', o.supplyAmount])
      rows.push(['', '', '', '', '', '기업이윤(3%)', o.adjustedProfit])
      rows.push(['', '', '', '', '', '소계(부가세별도)', o.subtotalWithProfit])
      rows.push(['', '', '', '', '', '부가세(10%)', o.vat])
      rows.push(['', '', '', '', '', '합계(VAT포함)', o.grandTotal])
      rows.push([])
      rows.push(['', '─────', '─────', '─────', '─────', '─────', '─────'])  // 구분선
      rows.push([])
    })

    // 워크시트 생성
    const ws = XLSX.utils.aoa_to_sheet(rows)

    // 컬럼 너비 설정
    ws['!cols'] = [
      { wch: 22 }, // A: 사업자명/구분헤더
      { wch: 10 }, // B: 작업종류/구분
      { wch: 22 }, // C: 발주일/품목명
      { wch: 20 }, // D: 설치완료일/모델명
      { wch: 8 },  // E: 공급가액/수량
      { wch: 16 }, // F: 기업이윤/단가/라벨
      { wch: 16 }, // G: 소계/금액
      { wch: 14 }, // H: 부가세
      { wch: 16 }, // I: 합계
    ]

    // 숫자 포맷 적용 (모든 숫자 셀에 #,##0)
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < (rows[r]?.length || 0); c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c })
        const cell = ws[cellRef]
        if (cell && typeof cell.v === 'number') {
          cell.z = '#,##0'
        }
      }
    }

    // 시트명은 최대 31자 제한 (엑셀 규격)
    const sheetName = affiliate.length > 31 ? affiliate.substring(0, 31) : affiliate
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  })

  // AS정산 시트 (계열사별)
  if (asAffiliateData && asColumns) {
    Object.entries(asAffiliateData).forEach(([affiliate, data]) => {
      const headers = asColumns.map(c => c.header)
      const asRows = data.map(item => extractRowValues(item, asColumns))
      const ws = XLSX.utils.aoa_to_sheet([headers, ...asRows])
      ws['!cols'] = asColumns.map(c => ({ wch: c.width ?? 15 }))
      applyNumberFormats(ws, asColumns, data.length)
      const sheetName = `AS_${affiliate}`.substring(0, 31)
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
    })
  }

  downloadWorkbook(wb, fileName)
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
