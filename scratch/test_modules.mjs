import { parseExcel } from '../server/src/excelParser.js';
import { applyMapping } from '../server/src/mappingEngine.js';
import { CONFIG } from '../server/src/config.js';

const files = [
  '30_10_danhsachthutuc (1).xls',
  '30_10_danhsachthutuc.xls'
];

for (const file of files) {
  console.log('Testing file:', file);
  const parsed = parseExcel(file);
  console.log('Detected header row:', parsed.detectedHeaderIndex + 1);
  console.log('Total data rows:', parsed.totalRows);
  console.log('Domains detected:', parsed.domains);

  // Apply default mapping
  const mappingResult = applyMapping(parsed.rows, {
    maThuTucCol: 'B',
    tenVietTatCol: 'C',
    tenThuTucCol: 'D',
    linhVucCol: 'E',
    defaults: {
      idLinhVuc: CONFIG.SAMPLE_DOMAIN_ID
    }
  }, {
    'Đất đai': CONFIG.SAMPLE_DOMAIN_ID,
    'Đăng ký biện pháp bảo đảm': CONFIG.SAMPLE_DOMAIN_ID
  });

  console.log('Mapping valid rows:', mappingResult.summary.valid, '/', mappingResult.summary.total);
  console.log('Sample payload [0]:', JSON.stringify(mappingResult.records[0].payload, null, 2));

  // Critical assertion: check that every single payload has mucDoThuTuc === 3
  const allLevel3 = mappingResult.records.every(r => r.payload.mucDoThuTuc === 3);
  console.log('ASSERTION mucDoThuTuc === 3 for ALL records:', allLevel3 ? 'PASS ✅' : 'FAIL ❌');
  if (!allLevel3) {
    throw new Error('mucDoThuTuc check failed!');
  }
}
console.log('ALL TESTS PASSED!');
