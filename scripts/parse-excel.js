/**
 * 교원그룹 엑셀 파일 파싱 스크립트 V2
 *
 * 새로운 엑셀 구조:
 * - SET 모델: "냉난방기 83평형 스탠드 SET"
 * - 실내기: "냉난방기 83평형 스탠드 실내기"
 * - 실외기: "냉난방기 83평형 스탠드 실외기"
 * - 자재박스: "냉난방기 83평형 스탠드 자재박스"
 */

const XLSX = require('xlsx');
const fs = require('fs');

// 엑셀 파일 경로
const excelPath = 'c:\\Users\\User\\OneDrive\\Desktop\\교원그룹_배송내역_수정본.xlsx';

try {
  console.log('📂 엑셀 파일 읽는 중...');
  const workbook = XLSX.readFile(excelPath, { cellStyles: true });

  const sheetName = workbook.SheetNames.find(name => name.includes('판매단가표'));
  if (!sheetName) {
    throw new Error('판매단가표 시트를 찾을 수 없습니다.');
  }

  console.log(`✅ 시트 선택: ${sheetName}`);
  const worksheet = workbook.Sheets[sheetName];

  const data = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: null
  });

  console.log(`\n📊 총 ${data.length}개 행 발견`);

  // SET 모델 + 구성품 추출
  const priceTableData = [];
  const allRows = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const 품목명 = row[0];
    const 모델명 = row[1];
    const 출하가 = row[3];
    const 판매가 = row[6]; // MG률 = 멜레아 판매가(vat별도)

    if (품목명 && 모델명 && 판매가) {
      allRows.push({
        품목명,
        모델명,
        출하가: Math.round(출하가 || 0),
        판매가: Math.round(판매가 || 0)
      });
    }
  }

  console.log(`\n✅ 총 ${allRows.length}개 행 파싱 완료`);

  // SET 모델만 필터링 (품목명에 "SET" 포함)
  const setModels = allRows.filter(row => row.품목명.includes('SET'));

  console.log(`\n🔍 ${setModels.length}개 SET 모델 발견`);

  // 각 SET 모델에 대해 구성품 찾기
  for (const setModel of setModels) {
    // 평형 추출
    const 평형매치 = setModel.품목명.match(/(\d+)평형/);
    const 평형 = 평형매치 ? `${평형매치[1]}평` : '미확인';

    // 카테고리 판단 (삼상/단상 구분 포함)
    let 카테고리 = '';
    let 삼상단상 = '';

    // 삼상/단상 구분
    if (setModel.품목명.includes('_삼상')) {
      삼상단상 = ' 삼상';
    } else if (setModel.품목명.includes('_단상')) {
      삼상단상 = ' 단상';
    }

    if (setModel.품목명.includes('스탠드')) {
      if (setModel.품목명.includes('냉방전용')) {
        카테고리 = '스탠드형 냉방전용';
      } else {
        카테고리 = '스탠드형 냉난방';
      }
    } else if (setModel.품목명.includes('벽걸이')) {
      if (setModel.품목명.includes('냉방전용')) {
        카테고리 = '벽걸이형 냉방전용';
      } else {
        카테고리 = '벽걸이형 냉난방';
      }
    }

    if (!카테고리) continue;

    // 구성품 패턴 (SET를 제거한 기본 패턴)
    let basePattern = setModel.품목명.replace(/\s*SET\s*$/, '').trim();

    // 단상 제품의 경우 "_단상"을 제거한 패턴도 체크 (구성품에 단상이 안 붙어있는 경우 대응)
    const basePatternWithoutPhase = basePattern.replace(/_(삼상|단상)$/, '');

    // 구성품 찾기 (실외기, 실내기, 자재박스, 브라켓 등)
    const components = allRows.filter(row => {
      if (row === setModel) return false; // SET 자체 제외

      // 삼상/단상 구분이 있는 경우
      if (삼상단상 === ' 삼상') {
        // 삼상 SET: 구성품에 "_삼상"이 있어야 함
        if (!row.품목명.includes('_삼상')) return false;
        if (!row.품목명.startsWith(basePattern)) return false;
      } else if (삼상단상 === ' 단상') {
        // 단상 SET: 구성품에 "_삼상"이 없어야 함
        if (row.품목명.includes('_삼상')) return false;
        if (!row.품목명.startsWith(basePatternWithoutPhase)) return false;
      } else {
        // 삼상/단상 구분이 없는 경우
        if (!row.품목명.startsWith(basePattern)) return false;
      }

      const suffix = row.품목명.replace(basePattern, '').replace(basePatternWithoutPhase, '').trim();
      return ['실외기', '실내기', '자재박스', '브라켓', '리모컨', '무선리모컨'].some(type => suffix.includes(type));
    });

    // 구성품 타입 추론
    const mappedComponents = components.map(comp => {
      let type = '기타';
      if (comp.품목명.includes('실외기')) type = '실외기';
      else if (comp.품목명.includes('실내기')) type = '실내기';
      else if (comp.품목명.includes('자재박스')) type = '자재박스';
      else if (comp.품목명.includes('브라켓')) type = '브라켓';
      else if (comp.품목명.includes('리모컨')) type = '리모컨';

      return {
        model: comp.모델명,
        type,
        unitPrice: comp.출하가,
        salePrice: comp.판매가,
        quantity: 1
      };
    });

    priceTableData.push({
      category: 카테고리 + 삼상단상,
      model: setModel.모델명,
      size: 평형,
      price: setModel.판매가,
      productName: setModel.품목명,
      components: mappedComponents
    });
  }

  console.log(`\n✅ ${priceTableData.length}개 SET 제품 최종 추출 완료`);
  console.log('\n📋 추출된 제품 목록:');
  priceTableData.forEach((item, idx) => {
    console.log(`[${idx + 1}] ${item.category} ${item.size} - ${item.model} - ${item.price.toLocaleString()}원 (구성품 ${item.components.length}개)`);
  });

  // TypeScript 코드 생성
  const tsCode = generateTypeScriptCode(priceTableData);

  // 파일로 저장
  const outputPath = 'lib/price-table.ts';
  fs.writeFileSync(outputPath, tsCode, 'utf8');
  console.log(`\n💾 ${outputPath} 파일 생성 완료!`);

} catch (error) {
  console.error('❌ 에러 발생:', error.message);
  console.error(error);
  process.exit(1);
}

/**
 * TypeScript 코드 생성 함수
 */
function generateTypeScriptCode(data) {
  // PriceTableRow 생성 (구성품 포함)
  const rows = data.map(item => {
    const components = (item.components || []).map(comp =>
      `      { model: '${comp.model}', type: '${comp.type}', unitPrice: ${comp.unitPrice}, salePrice: ${comp.salePrice}, quantity: ${comp.quantity} }`
    ).join(',\n');

    return `  {
    category: '${item.category}',
    model: '${item.model}',
    size: '${item.size}',
    price: ${item.price},
    components: [
${components}
    ]
  }`;
  }).join(',\n');

  // 평형 옵션 추출 (중복 제거, 정렬)
  const sizes = [...new Set(data.map(item => item.size))]
    .filter(s => s !== '미확인')
    .sort((a, b) => parseInt(a) - parseInt(b));
  sizes.push('미확인');

  const sizeOptions = sizes.map(s => `  '${s}',`).join('\n');

  return `/**
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
 * 총 ${data.length}개 제품
 */
export const priceTable: PriceTableRow[] = [
${rows}
]

/**
 * 평형 옵션 (드롭다운용)
 */
export const SIZE_OPTIONS = [
${sizeOptions}
]

/**
 * 가격 포맷팅 (1,000,000원)
 */
export function formatPrice(price: number): string {
  return \`\${price.toLocaleString('ko-KR')}원\`
}
`;
}
