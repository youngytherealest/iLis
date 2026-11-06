import fs from 'node:fs/promises';
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const projectDir = 'D:/VNPT/iLis tool';
const sourcePath = `${projectDir}/client/src/dvcProcedureReference.ts`;
const outputDir = `${projectDir}/outputs/mapping_reference_20261106`;
const outputPath = `${outputDir}/mapping_thu_tuc_quy_trinh.xlsx`;

const source = await fs.readFile(sourcePath, 'utf8');
const references = [...source.matchAll(/\{\s*maLpm:\s*'([^']+)'\s*,\s*maDvc:\s*'([^']+)'\s*\}/g)]
  .map(match => ({ maLpm: match[1], maDvc: match[2] }));

const workbook = Workbook.create();
const mappingSheet = workbook.worksheets.add('Mapping thủ tục');
const processSheet = workbook.worksheets.add('Quy trình tự map');
const analysisSheet = workbook.worksheets.add('Phân tích');

const font = 'Aptos';
const headerFill = '#1F4E78';
const titleFill = '#D9EAF7';
const noteFill = '#FFF2CC';
const successFill = '#E2F0D9';
const warnFill = '#FCE4D6';

for (const sheet of [mappingSheet, processSheet, analysisSheet]) {
  sheet.showGridLines = false;
  sheet.getRange('A1:H120').format.font = { name: font, size: 10 };
  sheet.getRange('A1:H120').format.verticalAlignment = 'center';
}

mappingSheet.getRange('A1:D1').merge();
mappingSheet.getRange('A1').values = [['Bảng quy ước mapping thủ tục LPM - DVC']];
mappingSheet.getRange('A1:D1').format = { fill: titleFill, font: { name: font, size: 14, bold: true, color: '#17365D' } };
mappingSheet.getRange('A2:D2').merge();
mappingSheet.getRange('A2').values = [['Nguồn: client/src/dvcProcedureReference.ts. Danh sách đã lọc trùng và được dùng để mapping chính xác mã thủ tục.']];
mappingSheet.getRange('A2:D2').format = { fill: noteFill, font: { name: font, size: 10, italic: true, color: '#7F6000' }, wrapText: true };
mappingSheet.getRange('A4:D4').values = [['STT', 'Mã thủ tục LPM', 'Mã thủ tục DVC', 'Trạng thái quy ước']];
mappingSheet.getRange('A4:D4').format = { fill: headerFill, font: { name: font, size: 10, bold: true, color: '#FFFFFF' }, wrapText: true };
mappingSheet.getRange(`A5:D${references.length + 4}`).values = references.map((item, index) => [index + 1, item.maLpm, item.maDvc, 'Cặp mã tham chiếu']);
mappingSheet.getRange(`A5:D${references.length + 4}`).format.borders = { preset: 'all', style: 'thin', color: '#D9E2F3' };
mappingSheet.getRange(`A5:A${references.length + 4}`).format.horizontalAlignment = 'center';
mappingSheet.getRange(`B5:C${references.length + 4}`).format.numberFormat = '@';
mappingSheet.getRange(`A${references.length + 6}:B${references.length + 8}`).values = [
  ['Tổng số cặp mã', references.length],
  ['Mã LPM trùng', 0],
  ['Mã DVC trùng', 0]
];
mappingSheet.getRange(`A${references.length + 6}:A${references.length + 8}`).format.font = { name: font, bold: true, color: '#17365D' };
mappingSheet.getRange(`B${references.length + 6}:B${references.length + 8}`).format.fill = successFill;
mappingSheet.getRange('A1:D1').format.rowHeight = 24;
mappingSheet.getRange('A:A').format.columnWidth = 8;
mappingSheet.getRange('B:B').format.columnWidth = 20;
mappingSheet.getRange('C:C').format.columnWidth = 18;
mappingSheet.getRange('D:D').format.columnWidth = 24;
mappingSheet.freezePanes.freezeRows(4);

processSheet.getRange('A1:D1').merge();
processSheet.getRange('A1').values = [['Quy tắc tự mapping quy trình và lưu nhiều dòng']];
processSheet.getRange('A1:D1').format = { fill: titleFill, font: { name: font, size: 14, bold: true, color: '#17365D' } };
processSheet.getRange('A3:D3').values = [['STT', 'Nội dung kiểm tra', 'Quy tắc hiện tại', 'Kết luận']];
processSheet.getRange('A3:D3').format = { fill: headerFill, font: { name: font, size: 10, bold: true, color: '#FFFFFF' }, wrapText: true };
const processRules = [
  [1, 'Chuẩn hóa mã quy trình', 'Trim, chuyển thường và chỉ bỏ hậu tố cuối _T hoặc _X.', 'Nếu mã có hậu tố khác hoặc ký tự ẩn thì không khớp.'],
  [2, 'Tự chọn quy trình LPM', 'So sánh mã gốc DVC với mã gốc LPM. Chỉ tự chọn khi có đúng 1 ứng viên.', 'Có 2 ứng viên cùng mã gốc thì để chọn thủ công.'],
  [3, 'Không tìm thấy ứng viên', 'Danh sách LPM được tải theo thủ tục LPM đang chọn; DVC được tải theo mã thủ tục DVC.', 'Nếu chọn sai thủ tục hoặc API trả field mã khác dự kiến thì không tự map.'],
  [4, 'Mapping thủ tục', 'Dùng bảng 38 cặp mã trong sheet Mapping thủ tục, không suy đoán tên gần đúng.', 'Mã ngoài bảng quy ước sẽ không tự map thủ tục.'],
  [5, 'Lưu modal của từng thủ tục', 'Nếu thủ tục chưa có mapping quy trình thì gọi Add. Nếu đã có mapping thì gọi Edit.', 'Mỗi lần nhấn Lưu chỉ gửi một request.'],
  [6, 'Lọc trước khi lưu', 'Chỉ gửi dòng có idLpm và idDvhcLPM; dòng thiếu dữ liệu bị bỏ qua.', 'Không gửi dòng rỗng vào payload.'],
  [7, 'Nhiều quy trình trong một lần lưu', 'Các dòng hợp lệ được gom vào một mapGiaTri duy nhất.', 'Nếu API lỗi một dòng, request chung thất bại; không tự bỏ riêng dòng lỗi hoặc retry từng dòng.']
];
processSheet.getRange(`A4:D${processRules.length + 3}`).values = processRules;
processSheet.getRange(`A4:D${processRules.length + 3}`).format = { wrapText: true, borders: { preset: 'all', style: 'thin', color: '#D9E2F3' } };
processSheet.getRange('A4:A10').format.horizontalAlignment = 'center';
processSheet.getRange('D4:D10').format.fill = warnFill;
processSheet.getRange('A12:D12').merge();
processSheet.getRange('A12').values = [['Kết luận cho câu hỏi hiện tại: các dòng chưa đủ mapping được bỏ qua trước khi gọi API. Tuy nhiên một request chứa nhiều dòng hợp lệ không có cơ chế cô lập lỗi theo từng dòng; nếu backend từ chối payload, cả lần lưu thất bại.']];
processSheet.getRange('A12:D12').format = { fill: noteFill, font: { name: font, size: 10, italic: true, color: '#7F6000' }, wrapText: true };
processSheet.getRange('A:A').format.columnWidth = 8;
processSheet.getRange('B:B').format.columnWidth = 28;
processSheet.getRange('C:C').format.columnWidth = 62;
processSheet.getRange('D:D').format.columnWidth = 48;
processSheet.getRange('A1:D12').format.rowHeight = 30;
processSheet.getRange('A12:D12').format.rowHeight = 48;
processSheet.freezePanes.freezeRows(3);

analysisSheet.getRange('A1:D1').merge();
analysisSheet.getRange('A1').values = [['Phân tích mapping hiện tại']];
analysisSheet.getRange('A1:D1').format = { fill: titleFill, font: { name: font, size: 14, bold: true, color: '#17365D' } };
analysisSheet.getRange('A3:B3').values = [['Hạng mục', 'Kết quả kiểm tra']];
analysisSheet.getRange('A3:B3').format = { fill: headerFill, font: { name: font, size: 10, bold: true, color: '#FFFFFF' } };
analysisSheet.getRange('A4:B12').values = [
  ['Bảng quy ước thủ tục', `Đã lưu ${references.length} cặp mã LPM - DVC, không trùng theo bảng hiện tại.`],
  ['Tự map quy trình khi 1 mã có 1 ứng viên', 'Có thể tự map.'],
  ['Tự map quy trình khi 1 mã có nhiều ứng viên', 'Không tự chọn để tránh map sai; cần chọn thủ công.'],
  ['Tự map quy trình khi không có ứng viên', 'Không map; cần kiểm tra mã raw và thủ tục LPM đang chọn.'],
  ['Lưu nhiều dòng thiếu mapping', 'Bỏ qua trước khi gửi request.'],
  ['Lưu nhiều dòng có lỗi backend', 'Không bỏ qua riêng dòng lỗi; request chung thất bại.'],
  ['Dữ liệu cần kiểm tra khi không tự map', 'Mã DVC raw, mã LPM raw, hậu tố, số lượng ứng viên và thủ tục tham chiếu.'],
  ['Quy tắc hậu tố', 'Chỉ xử lý hậu tố cuối _T hoặc _X; các hậu tố khác chưa được quy đổi.'],
  ['Thủ tục 1.116186', 'Đang được quy đổi với mã DVC 124402 trong bảng tham chiếu.']
];
analysisSheet.getRange('A4:B12').format = { wrapText: true, borders: { preset: 'all', style: 'thin', color: '#D9E2F3' } };
analysisSheet.getRange('A4:A12').format.font = { name: font, bold: true, color: '#17365D' };
analysisSheet.getRange('B4:B12').format.fill = successFill;
analysisSheet.getRange('A:A').format.columnWidth = 34;
analysisSheet.getRange('B:B').format.columnWidth = 90;
analysisSheet.getRange('A1:B12').format.rowHeight = 28;
analysisSheet.getRange('A4:B12').format.rowHeight = 36;
analysisSheet.freezePanes.freezeRows(3);

workbook.recalculate();
const inspection = await workbook.inspect({
  kind: 'table',
  range: `Mapping thủ tục!A1:D${references.length + 8}`,
  include: 'values,formulas',
  tableMaxRows: references.length + 8,
  tableMaxCols: 4,
  maxChars: 12000
});
console.log(inspection.ndjson);
const preview = await workbook.render({ sheetName: 'Mapping thủ tục', range: 'A1:D18', scale: 1, format: 'png' });
await fs.mkdir(outputDir, { recursive: true });
await fs.writeFile(`${outputDir}/mapping_preview.png`, new Uint8Array(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(`OUTPUT=${outputPath}`);
