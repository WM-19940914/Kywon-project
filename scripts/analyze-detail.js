/**
 * 36평형, 30평형 상세 분석
 */

const XLSX = require('xlsx');

const excelPath = 'c:\\Users\\User\\OneDrive\\Desktop\\교원그룹_배송내역_수정본.xlsx';

try {
  const workbook = XLSX.readFile(excelPath, { cellStyles: true });
  const sheetName = workbook.SheetNames.find(name => name.includes('판매단가표'));
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

  console.log('📋 36평형과 30평형 제품 상세 분석:\n');

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const 품목명 = row[0];
    const 모델명 = row[1];
    const 판매가 = row[6];

    if (품목명 && (품목명.includes('36평형') || 품목명.includes('30평형'))) {
      console.log(`품목명: ${품목명}`);
      console.log(`모델명: ${모델명}`);
      console.log(`판매가: ${판매가?.toLocaleString() || 'N/A'}`);
      console.log('-'.repeat(80));
    }
  }

} catch (error) {
  console.error('❌ 에러:', error.message);
}
