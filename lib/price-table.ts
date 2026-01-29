/**
 * 연간 단가표 (2026년 기준 - 교원그룹)
 *
 * 자동 생성된 파일입니다. 직접 수정하지 마세요.
 * 출처: 교원그룹_배송내역_수정본.xlsx
 *
 * SET 모델과 구성품의 판매가는 엑셀에서 직접 가져온 값입니다.
 * 구성품 판매가 합계 = SET 판매가
 */

/**
 * 구성품 상세 정보
 */
export interface ComponentDetail {
  model: string       // 모델명 (예: AP290DNPDHH1)
  type: string        // 구성품 타입 (실내기, 실외기, 자재박스, 브라켓, 리모컨)
  unitPrice: number   // 출하가
  salePrice: number   // 판매가 (VAT 별도)
  quantity: number    // 수량
}

/**
 * 단가표 행 (SET 모델 + 구성품)
 */
export interface PriceTableRow {
  category: string           // 품목 (벽걸이형, 스탠드형)
  model: string              // SET 모델명
  size: string               // 평형
  price: number              // SET 판매가 (VAT 별도)
  components: ComponentDetail[]  // 구성품 정보
}

/**
 * 교원그룹 단가표 데이터
 * 총 20개 제품
 */
export const priceTable: PriceTableRow[] = [
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

/**
 * 평형 옵션 (드롭다운용)
 */
export const SIZE_OPTIONS = [
  '7평',
  '9평',
  '11평',
  '13평',
  '15평',
  '16평',
  '18평',
  '23평',
  '30평',
  '36평',
  '40평',
  '64평',
  '83평',
  '미확인',
]

/**
 * 가격 포맷팅 (1,000,000원)
 */
export function formatPrice(price: number): string {
  return `${price.toLocaleString('ko-KR')}원`
}
