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
    data: Record<string, unknown>[]
    columns: ExcelColumn<Record<string, unknown>>[]
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
