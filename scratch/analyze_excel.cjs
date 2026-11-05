const XLSX = require('xlsx');
const path = require('path');

const files = [
  '30_10_danhsachthutuc (1).xls',
  '30_10_danhsachthutuc.xls'
];

for (const file of files) {
  console.log('==============================================');
  console.log('ANALYZING FILE:', file);
  console.log('==============================================');
  const filePath = path.join(__dirname, '..', file);
  const workbook = XLSX.readFile(filePath, { raw: false, cellDates: true });
  console.log('Sheet Names:', workbook.SheetNames);

  for (const sheetName of workbook.SheetNames) {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const worksheet = workbook.Sheets[sheetName];
    
    // Check range
    console.log('Range ref:', worksheet['!ref']);
    if (worksheet['!merges']) {
      console.log('Merges count:', worksheet['!merges'].length);
      console.log('First 5 merges:', worksheet['!merges'].slice(0, 5));
    }

    // Convert sheet to 2D array of rows
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
    console.log(`Total rows: ${rows.length}`);
    console.log('First 15 rows:');
    rows.slice(0, 15).forEach((row, idx) => {
      console.log(`Row ${idx + 1}:`, JSON.stringify(row));
    });

    if (rows.length > 15) {
      console.log('Sample data row (row 16):', JSON.stringify(rows[15]));
      console.log('Last row:', JSON.stringify(rows[rows.length - 1]));
    }
  }
}
