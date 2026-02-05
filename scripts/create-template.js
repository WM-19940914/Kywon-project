/**
 * 실제 데이터 입력용 엑셀 템플릿 생성 스크립트
 *
 * 실행: node scripts/create-template.js
 * 결과: 바탕화면에 "멜레아_데이터입력_템플릿.xlsx" 생성
 */

const XLSX = require('xlsx')
const path = require('path')
const os = require('os')

// ========== 시트1: 창고 ==========
const warehouseHeaders = ['창고이름', '주소', '상세주소', '담당자', '연락처', '용량', '비고']
const warehouseExample = ['파주창고', '경기도 파주시 탄현면 ...', '1층 창고동', '김철수', '010-1234-5678', 50, '']
const warehouseGuide = [
  '※ 작성 안내 ※',
  '창고이름: 나중에 배송 시트에서 입고창고로 사용됩니다',
  '용량: 보관 가능한 대수 (숫자만)',
  '',
  '',
  '',
  ''
]

// ========== 시트2: 발주 ==========
const orderHeaders = [
  '문서번호', '발주일', '계열사', '현장명', '주소',
  '담당자', '담당자연락처', '건물관리자연락처', '희망설치일',
  '진행상태', '특이사항',
  '작업종류1', '품목1', '모델명1', '평형1', '수량1',
  '작업종류2', '품목2', '모델명2', '평형2', '수량2',
  '작업종류3', '품목3', '모델명3', '평형3', '수량3',
]
const orderExample = [
  'DOC-2026-001', '2026-01-15', '구몬', '강남센터', '서울시 강남구 역삼동 123-4',
  '홍길동', '010-1234-5678', '02-1234-5678', '2026-02-01',
  'received', '주차 불가',
  '신규설치', '스탠드에어컨', 'AP072BAPPBH2S', '23평', 2,
  '', '', '', '', '',
  '', '', '', '', '',
]
const orderGuide = [
  '※ 작성 안내 ※',
  '날짜형식: 2026-01-15',
  '구몬, Wells영업, 교원L&C 등',
  '',
  '',
  '',
  '',
  '',
  '날짜형식: 2026-02-01',
  'received(접수) / in-progress(진행중) / completed(설치완료)',
  '',
  '신규설치 / 이전설치 / 철거보관 / 철거폐기',
  '스탠드에어컨 / 벽걸이에어컨 / 시스템에어컨 등',
  '삼성 모델번호',
  '18평, 23평 등',
  '숫자만',
  '작업이 2개면 여기에 추가',
  '', '', '', '',
  '작업이 3개면 여기에 추가',
  '', '', '', '',
]

// ========== 시트3: 배송 ==========
const deliveryHeaders = [
  '문서번호', 'SET모델', '구성품명', '구성품모델', '매입처',
  '주문번호', '주문일', '요청배송일', '배송예정일', '배송확정일',
  '수량', '매입단가', '입고창고'
]
const deliveryExample = [
  'DOC-2026-001', 'AP072BAPPBH2S', '실외기', 'AP072BNPPBH1', '삼성전자',
  'SO-2026-001', '2026-01-20', '2026-01-25', '2026-01-27', '2026-01-28',
  1, 1500000, '파주창고'
]
const deliveryGuide = [
  '※ 작성 안내 ※',
  '같은 발주의 구성품은 여러 행으로 적어주세요',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
]
const deliveryGuide2 = [
  '※ 예시: DOC-2026-001 발주에 스탠드 2대면 ※',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
]
const deliveryExample2 = [
  'DOC-2026-001', 'AP072BAPPBH2S', '실내기', 'AP072BVPPBH1', '삼성전자',
  'SO-2026-002', '2026-01-20', '', '', '',
  2, 800000, '파주창고'
]

// ========== 엑셀 생성 ==========
const wb = XLSX.utils.book_new()

// --- 시트1: 창고 ---
const wsWarehouse = XLSX.utils.aoa_to_sheet([
  warehouseHeaders,
  warehouseExample,
  [],
  warehouseGuide,
])
// 열 너비 설정
wsWarehouse['!cols'] = [
  { wch: 15 }, // 창고이름
  { wch: 35 }, // 주소
  { wch: 20 }, // 상세주소
  { wch: 10 }, // 담당자
  { wch: 16 }, // 연락처
  { wch: 8 },  // 용량
  { wch: 20 }, // 비고
]
XLSX.utils.book_append_sheet(wb, wsWarehouse, '창고')

// --- 시트2: 발주 ---
const wsOrder = XLSX.utils.aoa_to_sheet([
  orderHeaders,
  orderExample,
  [],
  orderGuide,
])
wsOrder['!cols'] = [
  { wch: 16 }, // 문서번호
  { wch: 12 }, // 발주일
  { wch: 12 }, // 계열사
  { wch: 18 }, // 현장명
  { wch: 35 }, // 주소
  { wch: 10 }, // 담당자
  { wch: 16 }, // 담당자연락처
  { wch: 16 }, // 건물관리자연락처
  { wch: 12 }, // 희망설치일
  { wch: 14 }, // 진행상태
  { wch: 20 }, // 특이사항
  { wch: 12 }, // 작업종류1
  { wch: 16 }, // 품목1
  { wch: 20 }, // 모델명1
  { wch: 8 },  // 평형1
  { wch: 6 },  // 수량1
  { wch: 12 }, // 작업종류2
  { wch: 16 }, // 품목2
  { wch: 20 }, // 모델명2
  { wch: 8 },  // 평형2
  { wch: 6 },  // 수량2
  { wch: 12 }, // 작업종류3
  { wch: 16 }, // 품목3
  { wch: 20 }, // 모델명3
  { wch: 8 },  // 평형3
  { wch: 6 },  // 수량3
]
XLSX.utils.book_append_sheet(wb, wsOrder, '발주')

// --- 시트3: 배송 ---
const wsDelivery = XLSX.utils.aoa_to_sheet([
  deliveryHeaders,
  deliveryExample,
  deliveryExample2,
  [],
  deliveryGuide,
  deliveryGuide2,
])
wsDelivery['!cols'] = [
  { wch: 16 }, // 문서번호
  { wch: 20 }, // SET모델
  { wch: 12 }, // 구성품명
  { wch: 20 }, // 구성품모델
  { wch: 12 }, // 매입처
  { wch: 16 }, // 주문번호
  { wch: 12 }, // 주문일
  { wch: 12 }, // 요청배송일
  { wch: 12 }, // 배송예정일
  { wch: 12 }, // 배송확정일
  { wch: 6 },  // 수량
  { wch: 12 }, // 매입단가
  { wch: 15 }, // 입고창고
]
XLSX.utils.book_append_sheet(wb, wsDelivery, '배송')

// 바탕화면에 저장
const desktopPath = path.join(os.homedir(), 'Desktop', '멜레아_데이터입력_템플릿.xlsx')
XLSX.writeFile(wb, desktopPath)

console.log('✅ 템플릿 파일 생성 완료!')
console.log(`📁 저장 위치: ${desktopPath}`)
console.log('')
console.log('📝 작성 방법:')
console.log('  1. 시트1 "창고" → 창고 정보 입력')
console.log('  2. 시트2 "발주" → 발주 정보 입력 (1행 = 1건)')
console.log('  3. 시트3 "배송" → 구성품 배송 정보 입력 (1행 = 구성품 1개)')
console.log('  ※ 예시 행(2행)은 참고용이니 실제 데이터로 덮어쓰세요')
console.log('  ※ 안내 문구 행은 삭제해도 됩니다')
