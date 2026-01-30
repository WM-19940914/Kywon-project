/**
 * 연간단가표를 CSV/Excel 형식으로 추출하는 스크립트
 *
 * 실행 방법: node scripts/export-price-table.js
 */

const fs = require('fs')
const path = require('path')

// 가격표 데이터 (price-table.ts에서 복사)
const priceTable = [
  {
    category: '스탠드형 냉난방',
    model: 'AP290DAPDHH1S',
    size: '83평',
    price: 3942800,
    components: [
      { model: 'AP290DNPDHH1', type: '실내기', unitPrice: 1917000, salePrice: 1081393, quantity: 1 },
      { model: 'AP290DXPDHH1', type: '실외기', unitPrice: 4707000, salePrice: 2655251, quantity: 1 },
      { model: 'FPH-3878XS', type: '자재박스', unitPrice: 365455, salePrice: 206156, quantity: 1 }
    ]
  },
  {
    category: '스탠드형 냉난방',
    model: 'AP230CAPDHH1S',
    size: '64평',
    price: 3514700,
    components: [
      { model: 'AP230CNPDHH1', type: '실내기', unitPrice: 1768000, salePrice: 997357, quantity: 1 },
      { model: 'AP230CXPDHH1', type: '실외기', unitPrice: 4097000, salePrice: 2311184, quantity: 1 },
      { model: 'FPH-3878XS', type: '자재박스', unitPrice: 365455, salePrice: 206159, quantity: 1 }
    ]
  },
  {
    category: '스탠드형 냉난방',
    model: 'AP145BAPPHH2S',
    size: '40평',
    price: 1972400,
    components: [
      { model: 'AP145BNPPHH1', type: '실내기', unitPrice: 1460000, salePrice: 823628, quantity: 1 },
      { model: 'AC145BXAPHH5', type: '실외기', unitPrice: 1830000, salePrice: 1032356, quantity: 1 },
      { model: 'FPH-3858XS5', type: '자재박스', unitPrice: 206364, salePrice: 116416, quantity: 1 }
    ]
  },
  {
    category: '스탠드형 냉난방 삼상',
    model: 'AP130BAPPHH2S',
    size: '36평',
    price: 1758000,
    components: [
      { model: 'AP130RNPPHH1', type: '실내기', unitPrice: 1260000, salePrice: 710790, quantity: 1 },
      { model: 'AC130BXAPHH3', type: '실외기', unitPrice: 1650000, salePrice: 930796, quantity: 1 },
      { model: 'FPH-3858XS5', type: '자재박스', unitPrice: 206364, salePrice: 116414, quantity: 1 }
    ]
  },
  {
    category: '스탠드형 냉난방 단상',
    model: 'AP130BAPPBH2S',
    size: '36평',
    price: 1758000,
    components: [
      { model: 'AP130RNPPBH1', type: '실내기', unitPrice: 1260000, salePrice: 710790, quantity: 1 },
      { model: 'AC130BXAPBH3', type: '실외기', unitPrice: 1650000, salePrice: 930796, quantity: 1 },
      { model: 'FPH-3858XS5', type: '자재박스', unitPrice: 206364, salePrice: 116414, quantity: 1 }
    ]
  },
  {
    category: '스탠드형 냉난방 삼상',
    model: 'AP110BAPPHH2S',
    size: '30평',
    price: 1656500,
    components: [
      { model: 'AP110RNPPHH1', type: '실내기', unitPrice: 1210000, salePrice: 682601, quantity: 1 },
      { model: 'AC110BXAPHH3', type: '실외기', unitPrice: 1520000, salePrice: 857482, quantity: 1 },
      { model: 'FPH-3858XS5', type: '자재박스', unitPrice: 206364, salePrice: 116417, quantity: 1 }
    ]
  },
  {
    category: '스탠드형 냉난방 단상',
    model: 'AP110BAPPBH2S',
    size: '30평',
    price: 1656500,
    components: [
      { model: 'AP110RNPPBH1', type: '실내기', unitPrice: 1210000, salePrice: 682601, quantity: 1 },
      { model: 'AC110BXAPBH3', type: '실외기', unitPrice: 1520000, salePrice: 857482, quantity: 1 },
      { model: 'FPH-3858XS5', type: '자재박스', unitPrice: 206364, salePrice: 116417, quantity: 1 }
    ]
  },
  {
    category: '스탠드형 냉난방',
    model: 'AP083BAPPBH2S',
    size: '23평',
    price: 1323600,
    components: [
      { model: 'AP083BNPPBH1', type: '실내기', unitPrice: 820000, salePrice: 462568, quantity: 1 },
      { model: 'AP083BXPPBH3', type: '실외기', unitPrice: 1320000, salePrice: 744621, quantity: 1 },
      { model: 'FPH-3858XS5', type: '자재박스', unitPrice: 206364, salePrice: 116411, quantity: 1 }
    ]
  },
  {
    category: '스탠드형 냉난방',
    model: 'AP072BAPPBH2S',
    size: '18평',
    price: 1217600,
    components: [
      { model: 'AP072BNPPBH1', type: '실내기', unitPrice: 740000, salePrice: 417457, quantity: 1 },
      { model: 'AC072BXAPBH5', type: '실외기', unitPrice: 1292000, salePrice: 728857, quantity: 1 },
      { model: 'FPH-1458XS1', type: '자재박스', unitPrice: 126364, salePrice: 71286, quantity: 1 }
    ]
  },
  {
    category: '스탠드형 냉난방',
    model: 'AP060BAPPBH2S',
    size: '15평',
    price: 1113900,
    components: [
      { model: 'AP060RNPPBH1', type: '실내기', unitPrice: 660000, salePrice: 372309, quantity: 1 },
      { model: 'AC060BXAPBH3', type: '실외기', unitPrice: 1161000, salePrice: 654925, quantity: 1 },
      { model: 'FPH-1412XS3', type: '자재박스', unitPrice: 153636, salePrice: 86667, quantity: 1 }
    ]
  },
  {
    category: '스탠드형 냉난방',
    model: 'AP052BAPPBH2S',
    size: '13평',
    price: 1076700,
    components: [
      { model: 'AP052BNPPBH1', type: '실내기', unitPrice: 600000, salePrice: 338472, quantity: 1 },
      { model: 'AP052BXPPBH3', type: '실외기', unitPrice: 1155000, salePrice: 651559, quantity: 1 },
      { model: 'FPH-1412XS3', type: '자재박스', unitPrice: 153636, salePrice: 86669, quantity: 1 }
    ]
  },
  {
    category: '스탠드형 냉방전용',
    model: 'AP145CSPDHC1S',
    size: '40평',
    price: 1774400,
    components: [
      { model: 'AP145CNPDHC1', type: '실내기', unitPrice: 866000, salePrice: 488538, quantity: 1 },
      { model: 'AP145CXPDHC1', type: '실외기', unitPrice: 2073000, salePrice: 1169445, quantity: 1 },
      { model: 'FPC-3858XS2', type: '자재박스', unitPrice: 206364, salePrice: 116417, quantity: 1 }
    ]
  },
  {
    category: '스탠드형 냉방전용',
    model: 'AP110CSPDBC1S',
    size: '30평',
    price: 1463000,
    components: [
      { model: 'AP110CNPDBC1', type: '실내기', unitPrice: 747000, salePrice: 421407, quantity: 1 },
      { model: 'AC110CXADBC1', type: '실외기', unitPrice: 1640000, salePrice: 925177, quantity: 1 },
      { model: 'FPC-3858XS2', type: '자재박스', unitPrice: 206364, salePrice: 116417, quantity: 1 }
    ]
  },
  {
    category: '스탠드형 냉방전용',
    model: 'AP083CSPDBC1S',
    size: '23평',
    price: 1144300,
    components: [
      { model: 'AP083CNPDBC1', type: '실내기', unitPrice: 557000, salePrice: 314231, quantity: 1 },
      { model: 'AC083CXADBC1', type: '실외기', unitPrice: 1265000, salePrice: 713649, quantity: 1 },
      { model: 'FPC-3858XS2', type: '자재박스', unitPrice: 206364, salePrice: 116420, quantity: 1 }
    ]
  },
  {
    category: '벽걸이형 냉난방',
    model: 'AR60F16C14WS',
    size: '16평',
    price: 1056500,
    components: [
      { model: 'AR60F16C14WNKO', type: '실내기', unitPrice: 635455, salePrice: 358492, quantity: 1 },
      { model: 'AR60F16C14WXKO', type: '실외기', unitPrice: 1123636, salePrice: 633900, quantity: 1 },
      { model: 'FRH-1412XA3', type: '자재박스', unitPrice: 70000, salePrice: 39491, quantity: 1 },
      { model: 'ARR-WK8F', type: '리모컨', unitPrice: 43636, salePrice: 24617, quantity: 1 }
    ]
  },
  {
    category: '벽걸이형 냉난방',
    model: 'AR60F13C13WS',
    size: '13평',
    price: 928300,
    components: [
      { model: 'AR60F13C13WNKO', type: '실내기', unitPrice: 435455, salePrice: 245666, quantity: 1 },
      { model: 'AR60F13C13WXKO', type: '실외기', unitPrice: 1096364, salePrice: 618525, quantity: 1 },
      { model: 'FRH-1412XA3', type: '자재박스', unitPrice: 70000, salePrice: 39491, quantity: 1 },
      { model: 'ARR-WK8F', type: '리모컨', unitPrice: 43636, salePrice: 24618, quantity: 1 }
    ]
  },
  {
    category: '벽걸이형 냉난방',
    model: 'AR60F11C13WS',
    size: '11평',
    price: 877000,
    components: [
      { model: 'AR60F11C13WNKO', type: '실내기', unitPrice: 513636, salePrice: 289769, quantity: 1 },
      { model: 'AR60F11C13WXKO', type: '실외기', unitPrice: 927273, salePrice: 523123, quantity: 1 },
      { model: 'FRH-1412NA3', type: '자재박스', unitPrice: 70000, salePrice: 39491, quantity: 1 },
      { model: 'ARR-WK8F', type: '리모컨', unitPrice: 43636, salePrice: 24617, quantity: 1 }
    ]
  },
  {
    category: '벽걸이형 냉난방',
    model: 'AR60F09C13WS',
    size: '9평',
    price: 774400,
    components: [
      { model: 'AR60F09C13WNKO', type: '실내기', unitPrice: 451818, salePrice: 254885, quantity: 1 },
      { model: 'AR60F09C13WXKO', type: '실외기', unitPrice: 827273, salePrice: 466692, quantity: 1 },
      { model: 'FRH-1438NH3', type: '자재박스', unitPrice: 50000, salePrice: 28207, quantity: 1 },
      { model: 'ARR-WK8F', type: '리모컨', unitPrice: 43636, salePrice: 24616, quantity: 1 }
    ]
  },
  {
    category: '벽걸이형 냉난방',
    model: 'AR60F07C14WS',
    size: '7평',
    price: 723100,
    components: [
      { model: 'AR60F07C14WNKO', type: '실내기', unitPrice: 370000, salePrice: 220525, quantity: 1 },
      { model: 'AR60F07C14WXKO', type: '실외기', unitPrice: 727273, salePrice: 417025, quantity: 1 },
      { model: 'FRH-1438NH3', type: '자재박스', unitPrice: 50000, salePrice: 44525, quantity: 1 },
      { model: 'ARR-WK8F', type: '리모컨', unitPrice: 43636, salePrice: 41025, quantity: 1 }
    ]
  },
  {
    category: '벽걸이형 냉방전용',
    model: 'AR60F07D12WS',
    size: '7평',
    price: 502600,
    components: [
      { model: 'AR60F07D12WNKO', type: '실내기', unitPrice: 329091, salePrice: 185654, quantity: 1 },
      { model: 'AR60F07D12WXKO', type: '실외기', unitPrice: 468182, salePrice: 264122, quantity: 1 },
      { model: 'FRC-1438NA2', type: '자재박스', unitPrice: 50000, salePrice: 28207, quantity: 1 },
      { model: 'ARR-WK8F', type: '리모컨', unitPrice: 43636, salePrice: 24617, quantity: 1 }
    ]
  }
]

// CSV 생성 함수 (엑셀에서 바로 열 수 있음)
function generateCSV() {
  // 1. 요약본: SET 모델 중심
  const summaryHeaders = ['구분', 'SET 모델명', '평형', 'SET 판매가(VAT별도)', '구성품 수']
  const summaryRows = priceTable.map(item => [
    item.category,
    item.model,
    item.size,
    item.price.toLocaleString('ko-KR'),
    item.components.length
  ])

  const summaryCSV = [
    summaryHeaders.join(','),
    ...summaryRows.map(row => row.join(','))
  ].join('\n')

  // 2. 상세본: 구성품까지 전부
  const detailHeaders = [
    '구분', 'SET 모델명', '평형', 'SET 판매가(VAT별도)',
    '구성품 모델', '구성품 타입', '출하가', '판매가', '수량'
  ]

  const detailRows = []
  priceTable.forEach(item => {
    item.components.forEach((comp, idx) => {
      detailRows.push([
        idx === 0 ? item.category : '', // 첫 행만 표시
        idx === 0 ? item.model : '',
        idx === 0 ? item.size : '',
        idx === 0 ? item.price.toLocaleString('ko-KR') : '',
        comp.model,
        comp.type,
        comp.unitPrice.toLocaleString('ko-KR'),
        comp.salePrice.toLocaleString('ko-KR'),
        comp.quantity
      ])
    })
  })

  const detailCSV = [
    detailHeaders.join(','),
    ...detailRows.map(row => row.join(','))
  ].join('\n')

  // 3. UTF-8 BOM 추가 (한글 깨짐 방지)
  const BOM = '\uFEFF'

  // 파일 저장
  const outputDir = path.join(__dirname, '../output')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  fs.writeFileSync(
    path.join(outputDir, '연간단가표_요약본.csv'),
    BOM + summaryCSV,
    'utf8'
  )

  fs.writeFileSync(
    path.join(outputDir, '연간단가표_상세본.csv'),
    BOM + detailCSV,
    'utf8'
  )

  console.log('✅ CSV 파일 생성 완료!')
  console.log('📁 저장 위치: output 폴더')
  console.log('   - 연간단가표_요약본.csv (20개 제품)')
  console.log('   - 연간단가표_상세본.csv (구성품 포함)')
}

// 실행
try {
  generateCSV()
} catch (error) {
  console.error('❌ 오류 발생:', error.message)
}
