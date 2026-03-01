/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 엑셀 내보내기 공통 유틸리티
 */

import ExcelJS from 'exceljs'

/* ─────────────────────────── 타입 정의 ─────────────────────────── */

export interface ExcelColumn<T> {
  header: string
  key?: keyof T
  getValue?: (item: T) => string | number | null | undefined
  width?: number
  numberFormat?: string
}

export interface ExportOptions<T> {
  data: T[]
  columns: ExcelColumn<T>[]
  fileName: string
  sheetName?: string
}

export interface ExportMultiSheetOptions {
  sheets: {
    sheetName: string
    data: unknown[]
    columns: ExcelColumn<any>[]
  }[]
  fileName: string
}

export interface SettlementSheetData {
  businessName: string
  workTypes: string
  orderDate: string
  installCompleteDate: string
  subtotalWithProfit: number
  vat: number
  grandTotal: number
  equipRounding: number
  installRounding: number
  supplyAmount: number
  adjustedProfit: number
  quoteItems: {
    category: string
    productName: string
    modelName: string
    quantity: number
    unitPrice: number
    totalPrice: number
  }[]
}

export interface AffiliateSummary {
  name: string
  installCount: number
  installTotal: number
  asCount: number
  asTotal: number
}

export interface ExportSettlementOptions {
  affiliateData: Record<string, SettlementSheetData[]>
  asAffiliateData?: Record<string, Record<string, unknown>[]>
  asColumns?: ExcelColumn<Record<string, unknown>>[]
  summary?: AffiliateSummary[] // 이 필드가 settlements/page.tsx에서 사용됨
  fileName: string
  monthLabel: string
}

/* ─────────────────────────── 스타일 상수 ─────────────────────────── */

const HEADER_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B3A67' } }
const HEADER_FONT: Partial<ExcelJS.Font> = { name: '맑은 고딕', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
const DEFAULT_FONT: Partial<ExcelJS.Font> = { name: '맑은 고딕', size: 10 }
const THIN_BORDER: Partial<ExcelJS.Borders> = { top: { style: 'thin', color: { argb: 'FFD0D0D0' } }, left: { style: 'thin', color: { argb: 'FFD0D0D0' } }, bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } }, right: { style: 'thin', color: { argb: 'FFD0D0D0' } } }
const TOTAL_FONT: Partial<ExcelJS.Font> = { name: '맑은 고딕', size: 10, bold: true }
const TOTAL_BORDER: Partial<ExcelJS.Borders> = { top: { style: 'medium', color: { argb: 'FF2B3A67' } }, left: { style: 'thin', color: { argb: 'FFD0D0D0' } }, bottom: { style: 'double', color: { argb: 'FF2B3A67' } }, right: { style: 'thin', color: { argb: 'FFD0D0D0' } } }
const SECTION_TITLE_FONT: Partial<ExcelJS.Font> = { name: '맑은 고딕', size: 12, bold: true }
const SUB_HEADER_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } }
const BUSINESS_HEADER_FILL: ExcelJS.FillPattern = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF5' } }

/* ─────────────────────────── 스타일 헬퍼 ─────────────────────────── */

function applyHeaderStyle(row: ExcelJS.Row) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = HEADER_FILL; cell.font = HEADER_FONT; cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = THIN_BORDER
  })
  row.height = 22
}

function applyDataCellStyle(cell: ExcelJS.Cell, numberFormat?: string) {
  cell.font = DEFAULT_FONT; cell.border = THIN_BORDER; cell.alignment = { vertical: 'middle' }
  const isNumeric = typeof cell.value === 'number' || (cell.value && typeof cell.value === 'object' && 'formula' in cell.value)
  if (isNumeric) { cell.alignment = { horizontal: 'right', vertical: 'middle' }; cell.numFmt = numberFormat || '#,##0' }
}

function applyTotalRowStyle(row: ExcelJS.Row) {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = TOTAL_FONT; cell.border = TOTAL_BORDER; cell.alignment = { vertical: 'middle' }
    if (typeof cell.value === 'number' || (cell.value && typeof cell.value === 'object' && 'formula' in cell.value)) { cell.alignment = { horizontal: 'right', vertical: 'middle' }; cell.numFmt = '#,##0' }
  })
}

function applySectionTitle(ws: ExcelJS.Worksheet, rowNum: number, title: string, colSpan: number) {
  const row = ws.getRow(rowNum); row.getCell(1).value = title; row.getCell(1).font = SECTION_TITLE_FONT; row.getCell(1).alignment = { vertical: 'middle' }
  if (colSpan > 1) { ws.mergeCells(rowNum, 1, rowNum, colSpan) }
  row.height = 28; row.commit()
}

/* ─────────────────────────── 핵심 함수 ─────────────────────────── */

function extractRowValues<T>(item: T, columns: ExcelColumn<T>[]): (string | number | null | undefined)[] {
  return columns.map((col) => { if (col.getValue) return col.getValue(item); if (col.key) return item[col.key] as string | number | null | undefined; return '' })
}

async function downloadWorkbook(wb: ExcelJS.Workbook, fileName: string) {
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${fileName}.xlsx`; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url)
}

/* ─────────────────────────── 공개 API ─────────────────────────── */

export async function exportToExcel<T>({ data, columns, fileName, sheetName = 'Sheet1' }: ExportOptions<T>) {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet(sheetName); ws.columns = columns.map((c) => ({ width: c.width ?? 15 }))
  const headerRow = ws.addRow(columns.map((c) => c.header)); applyHeaderStyle(headerRow)
  data.forEach((item) => { const values = extractRowValues(item, columns); const row = ws.addRow(values); row.eachCell({ includeEmpty: true }, (cell, colNumber) => { const col = columns[colNumber - 1]; applyDataCellStyle(cell, col?.numberFormat) }) })
  await downloadWorkbook(wb, fileName)
}

/**
 * 여러 시트를 한 번에 내보내는 공통 함수
 */
export async function exportMultiSheetExcel({ sheets, fileName }: ExportMultiSheetOptions) {
  const wb = new ExcelJS.Workbook()

  sheets.forEach(({ sheetName, data, columns }) => {
    const ws = wb.addWorksheet(sheetName)
    ws.columns = columns.map((c) => ({ width: c.width ?? 15 }))
    
    // 헤더 추가
    const headerRow = ws.addRow(columns.map((c) => c.header))
    applyHeaderStyle(headerRow)

    // 데이터 추가
    data.forEach((item) => {
      const values = extractRowValues(item, (columns as any))
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
 * 부모-자식 관계의 데이터를 한 줄로 펼쳐서 내보내는 함수 (Flatten)
 * 예: 하나의 발주서(부모)에 속한 여러 개의 품목(자식)을 각각 한 줄씩 출력
 */
export async function exportFlattenedToExcel<P, C>({
  parents,
  getChildren,
  parentColumns,
  childColumns,
  fileName,
  sheetName = 'Sheet1',
}: {
  parents: P[]
  getChildren: (parent: P) => C[]
  parentColumns: ExcelColumn<P>[]
  childColumns: ExcelColumn<C>[]
  fileName: string
  sheetName?: string
}) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(sheetName)

  // 헤더 구성 (부모 컬럼 + 자식 컬럼)
  const allColumns = [...parentColumns, ...childColumns]
  ws.columns = allColumns.map((c) => ({ width: c.width ?? 15 }))
  const headerRow = ws.addRow(allColumns.map((c) => c.header))
  applyHeaderStyle(headerRow)

  // 데이터 구성
  parents.forEach((parent) => {
    const children = getChildren(parent)
    const parentValues = extractRowValues(parent, parentColumns)

    if (children.length === 0) {
      // 자식이 없더라도 부모 정보는 한 줄 출력
      const row = ws.addRow([...parentValues, ...new Array(childColumns.length).fill('')])
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const col = allColumns[colNumber - 1]
        applyDataCellStyle(cell, col?.numberFormat)
      })
    } else {
      // 자식 수만큼 행 생성 (부모 정보 반복)
      children.forEach((child) => {
        const childValues = extractRowValues(child, childColumns)
        const row = ws.addRow([...parentValues, ...childValues])
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          const col = allColumns[colNumber - 1]
          applyDataCellStyle(cell, col?.numberFormat)
        })
      })
    }
  })

  await downloadWorkbook(wb, fileName)
}

/** 
 * ★ 교원 월별 정산 내역 표준 엑셀 함수 (100% 동일 양식)
 */
export async function exportSettlementExcel(options: ExportSettlementOptions) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { affiliateData, asAffiliateData, asColumns, summary, fileName, monthLabel } = options
  
  const wb = new ExcelJS.Workbook()
  const installSheetTotalCells: Record<string, string> = {}
  const asSheetTotalCells: Record<string, string> = {}
  const detailBusinessRows: { sheetKey: string; bizName: string; cellRef: string; isAs: boolean }[] = []

  const summaryWs = wb.addWorksheet(`${monthLabel} 정산`)

  // 1. 상세 시트 생성
  for (const [key, orders] of Object.entries(affiliateData)) {
    const sheetName = key.length > 31 ? key.substring(0, 31) : key
    const ws = wb.addWorksheet(sheetName)
    ws.columns = [{ width: 22 }, { width: 12 }, { width: 15 }, { width: 15 }, { width: 18 }, { width: 14 }, { width: 18 }]
    applySectionTitle(ws, 1, `[ ${key} ] ${monthLabel} 정산 요약`, 7)
    ws.addRow([])
    const hdr = ws.addRow(['사업자명', '작업종류', '발주일', '설치완료일', '소계(부가세별도)', '부가세', '합계(VAT포함)']); applyHeaderStyle(hdr)
    
    const summaryRows: { row: ExcelJS.Row; bizName: string }[] = []
    orders.forEach(o => { 
      const r = ws.addRow([o.businessName, o.workTypes, o.orderDate, o.installCompleteDate, 0, 0, 0])
      summaryRows.push({ row: r, bizName: o.businessName }); r.eachCell(c => applyDataCellStyle(c, '#,##0')) 
    })
    
    const sStart = hdr.number + 1; const sEnd = ws.rowCount
    ws.addRow([])
    const totRow = ws.addRow(['', '', '', '합 계', 0, 0, 0])
    totRow.getCell(5).value = { formula: `SUM(E${sStart}:E${sEnd})`, result: 0 }
    totRow.getCell(6).value = { formula: `SUM(F${sStart}:F${sEnd})`, result: 0 }
    totRow.getCell(7).value = { formula: `SUM(G${sStart}:G${sEnd})`, result: 0 }
    applyTotalRowStyle(totRow)
    installSheetTotalCells[key] = `'${sheetName}'!G${totRow.number}`

    ws.addRow([]); ws.addRow([])
    applySectionTitle(ws, ws.rowCount + 1, `[ ${key} ] 견적서 상세`, 7)
    ws.addRow([])
    orders.forEach((o, idx) => {
      const bRow = ws.addRow([`▸ ${o.businessName}  (${o.workTypes})`]); bRow.eachCell(c => { c.fill = BUSINESS_HEADER_FILL; c.font = TOTAL_FONT; c.border = THIN_BORDER }); ws.mergeCells(bRow.number, 1, bRow.number, 7)
      const subHdr = ws.addRow(['', '구분', '품목명', '모델명', '수량', '단가', '금액']); subHdr.eachCell(c => { c.fill = SUB_HEADER_FILL; c.font = { ...DEFAULT_FONT, bold: true }; c.alignment = { horizontal: 'center' }; c.border = THIN_BORDER })
      
      const eqs = o.quoteItems.filter(q => q.category === '장비비'); const ins = o.quoteItems.filter(q => q.category === '설치비')
      let eqSub: ExcelJS.Row | null = null
      if (eqs.length > 0) {
        const start = ws.rowCount + 1
        eqs.forEach(q => { const r = ws.addRow(['', q.category, q.productName, q.modelName, q.quantity, q.unitPrice, { formula: `E${ws.rowCount+1}*F${ws.rowCount+1}`, result: q.totalPrice }]); r.eachCell(c => applyDataCellStyle(c, '#,##0')) })
        if (o.equipRounding > 0) { const r = ws.addRow(['', '', '', '', '', '장비비 절사', -o.equipRounding]); r.eachCell(c => applyDataCellStyle(c, '#,##0')) }
        eqSub = ws.addRow(['', '', '', '', '', '장비비 소계', { formula: `SUM(G${start}:G${ws.rowCount})`, result: 0 }]); eqSub.eachCell(c => { if (c.col >= 6) { c.font = TOTAL_FONT; c.border = THIN_BORDER; c.numFmt = '#,##0'; c.alignment = { horizontal: 'right' } } })
      }
      const iStart = ws.rowCount + 1
      ins.forEach(q => { const r = ws.addRow(['', q.category, q.productName, q.modelName, q.quantity, q.unitPrice, { formula: `E${ws.rowCount+1}*F${ws.rowCount+1}`, result: q.totalPrice }]); r.eachCell(c => applyDataCellStyle(c, '#,##0')) })
      if (o.installRounding > 0) { const r = ws.addRow(['', '', '', '', '', '설치비 절사', -o.installRounding]); r.eachCell(c => applyDataCellStyle(c, '#,##0')) }
      const iSub = ws.addRow(['', '', '', '', '', '설치비 소계', { formula: `SUM(G${iStart}:G${ws.rowCount})`, result: 0 }]); iSub.eachCell(c => { if (c.col >= 6) { c.font = TOTAL_FONT; c.border = THIN_BORDER; c.numFmt = '#,##0'; c.alignment = { horizontal: 'right' } } })
      
      ws.addRow([])
      const rowS = ws.addRow(['', '', '', '', '', '공급가액', { formula: `${eqSub ? `G${eqSub.number}` : '0'}+G${iSub.number}`, result: o.supplyAmount }])
      const rowP = ws.addRow(['', '', '', '', '', '기업이윤(3%)', { formula: `FLOOR(G${rowS.number}+ROUND(SUM(G${iStart}:G${iSub.number-1})*0.03, 0), 1000)-G${rowS.number}`, result: o.adjustedProfit }])
      const rowSt = ws.addRow(['', '', '', '', '', '소계(부가세별도)', { formula: `G${rowS.number}+G${rowP.number}`, result: o.subtotalWithProfit }])
      const rowV = ws.addRow(['', '', '', '', '', '부가세(10%)', { formula: `ROUND(G${rowSt.number}*0.1, 0)`, result: o.vat }])
      const rowG = ws.addRow(['', '', '', '', '', '합계(VAT포함)', { formula: `G${rowSt.number}+G${rowV.number}`, result: o.grandTotal }])
      
      const summRows = [rowS, rowP, rowSt, rowV, rowG]
      summRows.forEach((r, si) => { 
        r.getCell(6).font = TOTAL_FONT; r.getCell(6).alignment = { horizontal: 'right' }; r.getCell(6).border = THIN_BORDER
        r.getCell(7).font = TOTAL_FONT; r.getCell(7).alignment = { horizontal: 'right' }; r.getCell(7).numFmt = '#,##0'; r.getCell(7).border = (si === 4 ? TOTAL_BORDER : THIN_BORDER)
        if (si === 4) { r.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } }; r.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDFA' } }; r.getCell(6).border = TOTAL_BORDER }
      })
      
      const sR = summaryRows[idx].row; sR.getCell(5).value = { formula: `G${rowSt.number}`, result: 0 }; sR.getCell(6).value = { formula: `G${rowV.number}`, result: 0 }; sR.getCell(7).value = { formula: `G${rowG.number}`, result: 0 }
      detailBusinessRows.push({ sheetKey: key, bizName: o.businessName, cellRef: `'${sheetName}'!G${sR.number}`, isAs: false })
      ws.addRow([])
    })
  }

  if (asAffiliateData && asColumns) {
    for (const [affiliate, data] of Object.entries(asAffiliateData)) {
      const sName = `AS_${affiliate}`.substring(0, 31); const ws = wb.addWorksheet(sName); ws.columns = asColumns.map(c => ({ width: c.width ?? 15 }))
      const hRow = ws.addRow(asColumns.map(c => c.header)); applyHeaderStyle(hRow)
      const start = ws.rowCount + 1; const totalIdx = asColumns.findIndex(c => (c as any).key === 'totalAmount') + 1
      data.forEach(item => { const r = ws.addRow(extractRowValues(item, asColumns)); r.eachCell(c => applyDataCellStyle(c, '#,##0')) })
      if (data.length === 0) ws.addRow(['데이터 없음'])
      const end = ws.rowCount
      ws.addRow([])
      const asCostIdx = asColumns.findIndex(c => (c as any).key === 'asCost') + 1; const recIdx = asColumns.findIndex(c => (c as any).key === 'receptionFee') + 1
      const totalRow = ws.addRow([]); totalRow.getCell(1).value = '합 계'
      if (asCostIdx > 0) totalRow.getCell(asCostIdx).value = { formula: `SUM(${ws.getColumn(asCostIdx).letter}${start}:${ws.getColumn(asCostIdx).letter}${end})`, result: 0 }
      if (recIdx > 0) totalRow.getCell(recIdx).value = { formula: `SUM(${ws.getColumn(recIdx).letter}${start}:${ws.getColumn(recIdx).letter}${end})`, result: 0 }
      if (totalIdx > 0) totalRow.getCell(totalIdx).value = { formula: `SUM(${ws.getColumn(totalIdx).letter}${start}:${ws.getColumn(totalIdx).letter}${end})`, result: 0 }
      applyTotalRowStyle(totalRow)
      ws.addRow([])
      const lIdx = recIdx > 0 ? recIdx : totalIdx - 1; const vIdx = totalIdx > 0 ? totalIdx : asColumns.length; const tCol = ws.getColumn(totalIdx).letter
      const rowRa = ws.addRow([]); rowRa.getCell(lIdx).value = '합계(부가세별도)'; rowRa.getCell(vIdx).value = { formula: `${tCol}${totalRow.number}`, result: 0 }
      const rowTr = ws.addRow([]); rowTr.getCell(lIdx).value = '단위절사(천원)'; rowTr.getCell(vIdx).value = { formula: `-( ${tCol}${totalRow.number} - FLOOR(${tCol}${totalRow.number}, 1000) )`, result: 0 }
      const rowSu = ws.addRow([]); rowSu.getCell(lIdx).value = '소계'; rowSu.getCell(vIdx).value = { formula: `${ws.getColumn(vIdx).letter}${rowRa.number}+${ws.getColumn(vIdx).letter}${rowTr.number}`, result: 0 }
      const rowVa = ws.addRow([]); rowVa.getCell(lIdx).value = '부가세(10%)'; rowVa.getCell(vIdx).value = { formula: `ROUND(${ws.getColumn(vIdx).letter}${rowSu.number}*0.1, 0)`, result: 0 }
      const rowGr = ws.addRow([]); rowGr.getCell(lIdx).value = '합계(VAT포함)'; rowGr.getCell(vIdx).value = { formula: `${ws.getColumn(vIdx).letter}${rowSu.number}+${ws.getColumn(vIdx).letter}${rowVa.number}`, result: 0 }
      const asSummRows = [rowRa, rowTr, rowSu, rowVa, rowGr]
      asSummRows.forEach((r, ai) => { r.getCell(lIdx).font = TOTAL_FONT; r.getCell(lIdx).alignment = { horizontal: 'right' }; r.getCell(lIdx).border = THIN_BORDER; r.getCell(vIdx).font = TOTAL_FONT; r.getCell(vIdx).alignment = { horizontal: 'right' }; r.getCell(vIdx).numFmt = '#,##0'; r.getCell(vIdx).border = (ai === 4 ? TOTAL_BORDER : THIN_BORDER); if (ai === 4) { r.getCell(lIdx).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0E0' } }; r.getCell(vIdx).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0E0' } }; r.getCell(lIdx).border = TOTAL_BORDER } })
      const gTRef = `'${sName}'!${ws.getColumn(vIdx).letter}${rowGr.number}`
      asSheetTotalCells[affiliate] = gTRef
      detailBusinessRows.push({ sheetKey: `AS_${affiliate}`, bizName: `${affiliate} AS 합계`, cellRef: gTRef, isAs: true })
    }
  }

  // 2. 요약 시트 채우기 (교원 업무 표준 양식)
  summaryWs.columns = [{ width: 25 }, { width: 12 }, { width: 22 }, { width: 5 }, { width: 25 }, { width: 12 }, { width: 22 }]
  applySectionTitle(summaryWs, 1, `${monthLabel} 정산 통합 요약`, 7)
  summaryWs.addRow([])
  const finalSec = summaryWs.addRow(['최종 정산 통합금액']); finalSec.getCell(1).font = { ...TOTAL_FONT, size: 12, bold: true }
  const finalHdr = summaryWs.addRow(['구분', '건수', '합계(VAT포함)']); applyHeaderStyle(finalHdr)
  const finInstRow = summaryWs.addRow(['설치 정산 합계', 0, 0]); const finAsRow = summaryWs.addRow(['AS 정산 합계', 0, 0]); const finTotRow = summaryWs.addRow(['총 합계', 0, 0])
  finInstRow.eachCell(c => applyDataCellStyle(c, '#,##0')); finAsRow.eachCell(c => applyDataCellStyle(c, '#,##0')); applyTotalRowStyle(finTotRow); finTotRow.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFE0' } }; if (c.col >= 2) c.numFmt = '#,##0' })
  
  summaryWs.addRow([]); summaryWs.addRow([])
  const subTitle = summaryWs.addRow([]); subTitle.getCell(1).value = '설치 정산 상세 요약'; subTitle.getCell(1).font = { ...TOTAL_FONT, size: 11, color: { argb: 'FF0D9488' } }; subTitle.getCell(5).value = 'AS 정산 상세 요약'; subTitle.getCell(5).font = { ...TOTAL_FONT, size: 11, color: { argb: 'FFEA580C' } }
  const subHdr = summaryWs.addRow([]); ['상세 시트명', '건수', '합계(VAT포함)'].forEach((h, i) => { subHdr.getCell(i + 1).value = h }); ['상세 시트명', '건수', '합계(VAT포함)'].forEach((h, i) => { subHdr.getCell(i + 5).value = h })
  subHdr.eachCell({ includeEmpty: false }, c => { if (c.col !== 4) { c.fill = HEADER_FILL; c.font = HEADER_FONT; c.alignment = { horizontal: 'center' }; c.border = THIN_BORDER } })
  
  const instKeys = Object.keys(affiliateData); const asKeys = asAffiliateData ? Object.keys(asAffiliateData) : []; const maxRows = Math.max(instKeys.length, asKeys.length); const tStart = subHdr.number + 1
  for (let i = 0; i < maxRows; i++) {
    const r = summaryWs.addRow([])
    if (i < instKeys.length) { const k = instKeys[i]; r.getCell(1).value = k; r.getCell(2).value = affiliateData[k].length; if (installSheetTotalCells[k]) r.getCell(3).value = { formula: installSheetTotalCells[k], result: 0 }; [1, 2, 3].forEach(c => applyDataCellStyle(r.getCell(c), '#,##0')) }
    if (i < asKeys.length) { const k = asKeys[i]; r.getCell(5).value = `AS_${k}`; r.getCell(6).value = asAffiliateData[k].length; if (asSheetTotalCells[k]) r.getCell(7).value = { formula: asSheetTotalCells[k], result: 0 }; [5, 6, 7].forEach(c => applyDataCellStyle(r.getCell(c), '#,##0')) }
  }
  const tEnd = summaryWs.rowCount; const subTot = summaryWs.addRow([]); subTot.getCell(1).value = '설치 합계'; subTot.getCell(2).value = { formula: `SUM(B${tStart}:B${tEnd})`, result: 0 }; subTot.getCell(3).value = { formula: `SUM(C${tStart}:C${tEnd})`, result: 0 }; subTot.getCell(5).value = 'AS 합계'; subTot.getCell(6).value = { formula: `SUM(F${tStart}:F${tEnd})`, result: 0 }; subTot.getCell(7).value = { formula: `SUM(G${tStart}:G${tEnd})`, result: 0 }
  const appSubS = (sc: number) => { [0, 1, 2].forEach(i => { const c = subTot.getCell(sc + i); c.font = TOTAL_FONT; c.border = TOTAL_BORDER; c.alignment = { horizontal: i === 0 ? 'left' : 'right' }; if (i > 0) c.numFmt = '#,##0' }) }; appSubS(1); appSubS(5)
  finInstRow.getCell(2).value = { formula: `B${subTot.number}`, result: 0 }; finInstRow.getCell(3).value = { formula: `C${subTot.number}`, result: 0 }; finAsRow.getCell(2).value = { formula: `F${subTot.number}`, result: 0 }; finAsRow.getCell(3).value = { formula: `G${subTot.number}`, result: 0 }; finTotRow.getCell(2).value = { formula: `B${finInstRow.number}+B${finAsRow.number}`, result: 0 }; finTotRow.getCell(3).value = { formula: `C${finInstRow.number}+C${finAsRow.number}`, result: 0 }
  
  summaryWs.addRow([]); summaryWs.addRow([]); const bTitle = summaryWs.addRow(['시트별/사업자별 정산 내역 요약 (상세 시트 순서)']); bTitle.getCell(1).font = { ...TOTAL_FONT, size: 12, color: { argb: 'FF1E293B' } }
  const bHdr = summaryWs.addRow(['정산 구분 (시트명)', '사업자명', '정산 금액(VAT포함)']); applyHeaderStyle(bHdr)
  const bStart = summaryWs.rowCount + 1; detailBusinessRows.forEach(item => { const r = summaryWs.addRow([item.sheetKey, item.bizName, { formula: item.cellRef, result: 0 }]); r.eachCell(c => applyDataCellStyle(c, '#,##0')); r.getCell(1).font = { ...DEFAULT_FONT, color: { argb: item.isAs ? 'FFEA580C' : 'FF0D9488' } } })
  const bEnd = summaryWs.rowCount; const bTot = summaryWs.addRow(['합계 확인', '', { formula: `SUM(C${bStart}:C${bEnd})`, result: 0 }]); applyTotalRowStyle(bTot); bTot.getCell(1).alignment = { horizontal: 'left' }
  await downloadWorkbook(wb, fileName)
}

/** 
 * 멜레아 배송/매입 내역 엑셀 (셀 병합 + 주문별 구분 스타일)
 * 내부정산 및 배송관리 페이지 공용
 */
export async function exportDeliveryPurchaseExcel(options: { 
  orders?: any[], 
  items?: any[], 
  fileName: string, 
  monthLabel: string,
  hidePricing?: boolean // 가격 정보 숨김 옵션 추가
}) {
  const { orders, items, fileName, monthLabel, hidePricing = false } = options
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('배송 및 매입 내역')
  
  // 1. 컬럼 정의
  const baseColumns = [
    { header: '계열사', width: 12 }, 
    { header: '사업자명', width: 22 }, 
    { header: '현장주소', width: 35 }, 
    { header: '매입처', width: 12 }, 
    { header: '주문번호', width: 18 }, 
    { header: '주문일', width: 14 }, 
    { header: '배송예정일', width: 14 }, 
    { header: '배송확정일', width: 14 }, 
    { header: '모델명', width: 22 }, 
    { header: '수량', width: 8 }, 
  ]
  
  const pricingColumns = [
    { header: '매입단가', width: 15 }, 
    { header: '매입금액', width: 18 }, 
    { header: '매입금액(VAT포함)', width: 18 }, 
  ]
  
  const warehouseColumns = [
    { header: '창고명', width: 15 }, 
    { header: '창고주소', width: 35 }
  ]

  // hidePricing 옵션에 따라 컬럼 구성
  ws.columns = hidePricing 
    ? [...baseColumns, ...warehouseColumns] 
    : [...baseColumns, ...pricingColumns, ...warehouseColumns]
  
  applySectionTitle(ws, 1, monthLabel ? `${monthLabel} 정산 내역` : '배송 및 매입 내역 상세', ws.columns.length); ws.addRow([])
  const headerRow = ws.addRow(ws.columns.map(c => c.header)); applyHeaderStyle(headerRow)
  
  const warehouseCache = (typeof window !== 'undefined' && (window as any)._warehouseCache) || []
  let currentIdx = headerRow.number + 1

  // 데이터 통합 로직 동일...
  let flatData: any[] = []
  if (orders && Array.isArray(orders)) {
    orders.forEach(order => {
      const equipmentItems = (order.equipmentItems && order.equipmentItems.length > 0)
        ? order.equipmentItems 
        : [{ componentName: '정보없음' }]
      equipmentItems.forEach((item: any) => {
        flatData.push({ ...item, _order: order, orderId: order.id })
      })
    })
  } else if (items && Array.isArray(items)) {
    flatData = items.map(item => ({ ...item, orderId: item.orderId || item.id }))
  }

  const groups: Record<string, any[]> = {}
  flatData.forEach(item => {
    const key = item.orderId || 'unknown'
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  })

  Object.values(groups).forEach((groupItems) => {
    const startR = currentIdx
    groupItems.forEach((item: any) => {
      const order = item._order || item
      const warehouse = warehouseCache.find((w: any) => w.id === item.warehouseId)
      
      // 날짜 필드 보정 (우선순위: item 레벨 -> order 레벨)
      const orderDate = item.orderDate || order.orderDate || item.orderDateDisplay || '-'
      const scheduledDate = item.scheduledDeliveryDate || order.scheduledDeliveryDate || '-'
      const confirmedDate = item.confirmedDeliveryDate || order.confirmedDeliveryDate || '-'
      
      const rowValues = [
        order.affiliate || item.affiliate || '기타',
        order.businessName || item.businessName || '-',
        order.address || item.address || item.siteAddress || '-',
        item.supplier || '삼성전자',
        item.orderNumber || order.samsungOrderNumber || item.samsungOrderNumber || '-',
        orderDate,      // 주문일
        scheduledDate,  // 배송예정일
        confirmedDate,  // 배송확정일
        item.componentModel || '-',
        Number(item.quantity) || 0,
      ]

      if (!hidePricing) {
        rowValues.push(Number(item.unitPrice) || 0, 0, 0) // 매입단가, 매입금액, VAT포함 (금액은 수식으로 아래에서 처리)
      }

      rowValues.push(
        warehouse?.name || item.warehouseName || '-',
        warehouse?.address || item.warehouseAddress || '-'
      )

      const row = ws.addRow(rowValues)
      const ri = row.number

      if (!hidePricing) {
        const itemQty = Number(item.quantity) || 0
        const itemPrice = Number(item.unitPrice) || 0
        // 가격 정보가 있을 때만 수식 적용 (J:10, K:11, L:12, M:13)
        row.getCell(12).value = { formula: `J${ri}*K${ri}`, result: itemQty * itemPrice }
        row.getCell(13).value = { formula: `L${ri}*1.1`, result: Math.round(itemQty * itemPrice * 1.1) }
      }
      
      row.eachCell({ includeEmpty: true }, (c) => { 
        // 숫자 데이터 스타일 적용 (J열 이후부터)
        if (c.col >= 10 && c.col <= (hidePricing ? 10 : 13)) {
          applyDataCellStyle(c, '#,##0')
        } else {
          applyDataCellStyle(c)
        }
        if (c.col === 5) { c.alignment = { horizontal: 'center' }; c.numFmt = '@' } 
      })
      currentIdx++
    })
    
    const endR = currentIdx - 1
    if (endR > startR) {
      // 병합할 컬럼 인덱스 (계열사, 사업자명, 현장주소, 주문번호 + 창고정보)
      // hidePricing일 때 창고정보는 11, 12번 컬럼임
      const mergeCols = hidePricing ? [1, 2, 3, 5, 11, 12] : [1, 2, 3, 5, 14, 15]
      mergeCols.forEach(col => {
        ws.mergeCells(startR, col, endR, col)
        const cell = ws.getCell(startR, col)
        cell.alignment = { vertical: 'middle', horizontal: (col === 3 || col === (hidePricing ? 12 : 15)) ? 'left' : 'center', wrapText: true }
      })
    }
    ws.getRow(endR).eachCell(c => { c.border = { ...c.border, bottom: { style: 'medium', color: { argb: 'FF2B3A67' } } } })
  })
  
  await downloadWorkbook(wb, fileName)
}

export function buildExcelFileName(pageName: string, tabName?: string): string {
  const t = new Date(); const y = t.getFullYear(); const m = String(t.getMonth() + 1).padStart(2, '0'); const d = String(t.getDate()).padStart(2, '0'); const dateStr = `${y}-${m}-${d}`
  if (tabName) return `${pageName}_${tabName}_${dateStr}`
  return `${pageName}_${dateStr}`
}
