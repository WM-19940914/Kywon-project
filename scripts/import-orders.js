/**
 * 발주 데이터 임포트 스크립트
 *
 * 엑셀 파일에서 발주 데이터를 읽어 Supabase에 넣습니다.
 * 실행: node scripts/import-orders.js
 */

const XLSX = require('xlsx')
const { createClient } = require('@supabase/supabase-js')
const path = require('path')
const crypto = require('crypto')

// ===== Supabase 연결 (환경변수 사용) =====
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 환경변수가 설정되지 않았습니다!')
  console.error('   .env.local에 다음 값들이 있는지 확인하세요:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// ===== 엑셀 날짜 변환 (엑셀 시리얼 넘버 → YYYY-MM-DD) =====
function excelDateToString(value) {
  if (!value) return null
  if (typeof value === 'string') {
    // 이미 문자열이면 그대로
    if (value.match(/^\d{4}-\d{2}-\d{2}$/)) return value
    if (value.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
      const parts = value.split('-')
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
    }
    return value
  }
  if (typeof value === 'number') {
    // 엑셀 시리얼 넘버 → Date
    const date = new Date((value - 25569) * 86400 * 1000)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return null
}

// ===== 품목 문자열 파싱 =====
// "스탠드형_냉난방기 40평형;삼성" → { category, model, size }
// "DVM S 4WAY / AM060BN4DBH1 / 15평형" → { category, model, size }
function parseProduct(productStr) {
  if (!productStr) return { category: '', model: '', size: '' }

  let str = String(productStr).trim()

  // 패턴1: "카테고리 / 모델번호 / 평형" (DVM 등)
  if (str.includes(' / ')) {
    const parts = str.split(' / ').map(s => s.trim())
    return {
      category: parts[0] || '',
      model: parts[1] || '',
      size: (parts[2] || '').replace('형', '')  // "15평형" → "15평"
    }
  }

  // 패턴2: "카테고리 평형;삼성" (일반)
  // 삼성 제거
  str = str.replace(/;삼성$/, '').trim()

  // 추가 메모 부분 분리 (괄호나 대괄호 안의 내용)
  const extraMatch = str.match(/\s*[\[(（].*$/)
  let extra = ''
  if (extraMatch) {
    extra = extraMatch[0].trim()
    str = str.replace(extraMatch[0], '').trim()
  }

  // 평형 추출: "40평형", "40평", "83평형" 등
  const sizeMatch = str.match(/(\d+평)(형)?/)
  let size = ''
  let category = str

  if (sizeMatch) {
    size = sizeMatch[1]  // "40평"
    category = str.replace(sizeMatch[0], '').trim()
  }

  // 언더스코어를 공백으로
  category = category.replace(/_/g, ' ')

  // 비스포크 등 추가 키워드가 카테고리에 포함
  category = category.trim()

  return {
    category: category || str.replace(/_/g, ' '),
    model: '',
    size: size,
    extra: extra  // "(선구매 장비건사용)" 등
  }
}

// ===== 고유 ID 생성 =====
function generateId() {
  return crypto.randomUUID()
}

// ===== 메인 임포트 =====
async function main() {
  console.log('📂 엑셀 파일 읽는 중...')

  const filePath = path.join(require('os').homedir(), 'Desktop', '멜레아_데이터입력_템플릿.xlsx')
  const wb = XLSX.readFile(filePath)
  const ws = wb.Sheets['발주']
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

  // 헤더(0행) 제거, 빈 행 제거, 안내 문구 행 제거
  const dataRows = rows.slice(1).filter(row => {
    if (!row || row.length === 0) return false
    // 데이터가 하나도 없는 빈 행 제거
    const hasData = row.some(cell => cell !== null && cell !== undefined && cell !== '')
    if (!hasData) return false
    return true
  })

  console.log(`📊 데이터 행: ${dataRows.length}개`)

  // ===== 각 행을 파싱 =====
  const parsedRows = dataRows.map((row, idx) => {
    const docNum = row[0]  // 문서번호 (대부분 비어있음)
    const orderDate = excelDateToString(row[1])
    const affiliate = row[2] || ''
    const businessName = row[3] || ''
    const address = row[4] || ''
    const contactName = row[5] || ''
    const contactPhone = row[6] || ''
    const buildingManagerPhone = row[7] || ''
    const requestedInstallDate = excelDateToString(row[8])
    const status = row[9] || 'received'
    const notes = row[10] || ''
    const workType = row[11] || ''
    const productStr = row[12] || ''

    // 문서번호가 "※ 작성 안내" 같은 가이드 텍스트면 무시
    const cleanDocNum = (docNum && String(docNum).includes('※')) ? null : docNum

    // 품목 파싱
    const parsed = parseProduct(productStr)

    return {
      docNum: cleanDocNum,
      orderDate,
      affiliate,
      businessName,
      address,
      contactName,
      contactPhone: contactPhone ? String(contactPhone) : '',
      buildingManagerPhone: buildingManagerPhone ? String(buildingManagerPhone) : '',
      requestedInstallDate,
      status,
      notes: parsed.extra ? `${notes} ${parsed.extra}`.trim() : notes,
      workType,
      category: parsed.category,
      model: parsed.model,
      size: parsed.size,
      rowIndex: idx + 1  // 디버깅용
    }
  })

  // ===== 같은 현장 + 같은 날짜 묶기 =====
  // 그룹 키: (현장명 || 주소) + 발주일
  const groupMap = new Map()

  parsedRows.forEach(row => {
    // 그룹 키 생성
    const nameKey = row.businessName || row.address || row.contactName
    const dateKey = row.orderDate || 'no-date'
    const groupKey = `${nameKey}___${dateKey}`

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        // 첫 행의 기본 정보를 발주 정보로 사용
        orderDate: row.orderDate,
        affiliate: row.affiliate,
        businessName: row.businessName,
        address: row.address,
        contactName: row.contactName,
        contactPhone: row.contactPhone,
        buildingManagerPhone: row.buildingManagerPhone,
        requestedInstallDate: row.requestedInstallDate,
        status: row.status,
        notes: row.notes,
        items: []
      })
    }

    const group = groupMap.get(groupKey)

    // 비어있던 필드 보충 (나중 행에서 채워질 수 있음)
    if (!group.affiliate && row.affiliate) group.affiliate = row.affiliate
    if (!group.businessName && row.businessName) group.businessName = row.businessName
    if (!group.contactPhone && row.contactPhone) group.contactPhone = row.contactPhone
    if (row.notes && !group.notes) group.notes = row.notes

    // 작업 내역 추가
    if (row.workType) {
      group.items.push({
        workType: row.workType,
        category: row.category,
        model: row.model,
        size: row.size,
        quantity: 1
      })
    }
  })

  console.log(`📦 발주 건수 (묶은 후): ${groupMap.size}건`)

  // ===== 기존 데이터 삭제 =====
  console.log('\n🗑️  기존 orders 데이터 삭제 중...')
  // orders를 삭제하면 CASCADE로 order_items, equipment_items 등도 같이 삭제됨
  const { error: deleteError } = await supabase
    .from('orders')
    .delete()
    .neq('id', 'impossible-id')  // 전체 삭제 (WHERE id != 불가능한값)

  if (deleteError) {
    console.error('❌ 삭제 실패:', deleteError.message)
    return
  }
  console.log('✅ 기존 데이터 삭제 완료')

  // ===== 발주 데이터 삽입 =====
  console.log('\n📥 새 발주 데이터 삽입 중...')

  let orderCount = 0
  let itemCount = 0
  let errorCount = 0

  // 문서번호 자동 생성용 카운터 (년도별)
  const docCounters = {}

  const entries = Array.from(groupMap.entries())

  for (const [groupKey, group] of entries) {
    // 문서번호 생성
    const year = group.orderDate ? group.orderDate.substring(0, 4) : '2025'
    if (!docCounters[year]) docCounters[year] = 1
    const docNum = `DOC-${year}-${String(docCounters[year]).padStart(3, '0')}`
    docCounters[year]++

    const orderId = generateId()

    // orders 테이블 삽입
    const orderData = {
      id: orderId,
      document_number: docNum,
      order_date: group.orderDate || null,
      affiliate: group.affiliate || '',
      business_name: group.businessName || '',
      address: group.address || '',
      contact_name: group.contactName || '',
      contact_phone: group.contactPhone || '',
      building_manager_phone: group.buildingManagerPhone || null,
      requested_install_date: group.requestedInstallDate || null,
      status: group.status || 'completed',
      notes: group.notes || null,
      delivery_status: 'pending',
      // 설치완료 상태면 설치완료일을 발주일로 임시 설정
      install_complete_date: group.status === 'completed' ? group.orderDate : null,
      // 정산 상태 (과거 데이터니까 정산완료로)
      s1_settlement_status: group.status === 'completed' ? 'settled' : 'unsettled',
      s1_settlement_month: group.status === 'completed' && group.orderDate
        ? group.orderDate.substring(0, 7)  // "2026-01"
        : null,
    }

    const { error: orderError } = await supabase
      .from('orders')
      .insert(orderData)

    if (orderError) {
      console.error(`  ❌ 발주 삽입 실패 [${docNum}] ${group.businessName}:`, orderError.message)
      errorCount++
      continue
    }

    // order_items 테이블 삽입
    if (group.items.length > 0) {
      const itemsData = group.items.map(item => ({
        id: generateId(),
        order_id: orderId,
        work_type: item.workType,
        category: item.category,
        model: item.model || '',
        size: item.size || '',
        quantity: item.quantity || 1
      }))

      const { error: itemError } = await supabase
        .from('order_items')
        .insert(itemsData)

      if (itemError) {
        console.error(`  ⚠️  항목 삽입 실패 [${docNum}]:`, itemError.message)
      } else {
        itemCount += itemsData.length
      }
    }

    orderCount++
  }

  // ===== 결과 출력 =====
  console.log('\n' + '='.repeat(50))
  console.log('📊 임포트 결과')
  console.log('='.repeat(50))
  console.log(`  ✅ 발주: ${orderCount}건 삽입 완료`)
  console.log(`  ✅ 작업 내역: ${itemCount}건 삽입 완료`)
  if (errorCount > 0) {
    console.log(`  ❌ 오류: ${errorCount}건`)
  }
  console.log('')
  console.log('🌐 웹에서 확인: http://localhost:3001/orders')
  console.log('🌐 Supabase 대시보드에서도 확인 가능')
}

main().catch(err => {
  console.error('치명적 오류:', err)
  process.exit(1)
})
