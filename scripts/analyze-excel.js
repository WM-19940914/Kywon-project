/**
 * 엑셀 파일 상세 분석 스크립트
 *
 * SET 모델과 구성품 구조를 자세히 분석합니다.
 */

const XLSX = require('xlsx');

// 엑셀 파일 경로
const excelPath = 'c:\\Users\\User\\OneDrive\\Desktop\\교원그룹_배송내역_수정본.xlsx';

try {
  console.log('📂 엑셀 파일 읽는 중...\n');
  const workbook = XLSX.readFile(excelPath, { cellStyles: true });

  // '교원 판매단가표' 시트 선택
  const sheetName = workbook.SheetNames.find(name => name.includes('판매단가표'));
  if (!sheetName) {
    throw new Error('판매단가표 시트를 찾을 수 없습니다.');
  }

  console.log(`✅ 시트 선택: ${sheetName}\n`);
  const worksheet = workbook.Sheets[sheetName];

  // JSON으로 변환
  const data = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: null
  });

  console.log(`📊 총 ${data.length}개 행 발견\n`);
  console.log('📋 헤더:', data[0], '\n');

  // SET 모델과 구성품을 자세히 분석
  console.log('🔍 SET 모델 및 구성품 분석:\n');
  console.log('='.repeat(80), '\n');

  let setCount = 0;
  let currentSet = null;

  for (let i = 1; i < Math.min(100, data.length); i++) {
    const row = data[i];
    const 품목명 = row[0];
    const 모델명 = row[1];
    const 수량 = row[2];
    const 출하가 = row[3];
    const DC률 = row[4];
    const MG률 = row[6];

    // SET 모델 판단
    if (MG률 && 품목명 && typeof 품목명 === 'string') {
      setCount++;
      currentSet = {
        품목명,
        모델명,
        출하가,
        DC률,
        MG률,
        components: []
      };

      console.log(`\n[SET #${setCount}]`);
      console.log(`품목명: ${품목명}`);
      console.log(`모델명: ${모델명}`);
      console.log(`출하가: ${출하가?.toLocaleString() || 'N/A'}`);
      console.log(`DC률: ${DC률}`);
      console.log(`MG률: ${MG률}`);
      console.log('구성품:');
    }
    // 구성품
    else if (!품목명 && 모델명 && currentSet) {
      currentSet.components.push({
        모델명,
        수량,
        출하가
      });

      console.log(`  - ${모델명} | 수량: ${수량} | 출하가: ${출하가?.toLocaleString() || 'N/A'}`);
    }

    // 100번째 행까지만 출력
    if (setCount >= 25) break;
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n✅ 총 ${setCount}개 SET 모델 발견`);

} catch (error) {
  console.error('❌ 에러 발생:', error.message);
  console.error(error);
  process.exit(1);
}
