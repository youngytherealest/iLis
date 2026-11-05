import XLSX from 'xlsx';

/**
 * Generates an Excel buffer from import results.
 * @param {Array} records - Array of processed records { index, maThuTuc, tenThuTuc, status, httpStatus, message, executedAt }
 * @param {Object} options - { onlyFailed: boolean, title: string }
 */
export function generateExportExcel(records = [], options = {}) {
  const { onlyFailed = false, title = 'Báo cáo kết quả Import TTHC ILIS' } = options;

  let exportData = records;
  if (onlyFailed) {
    exportData = records.filter(r => r.status === 'THẤT BẠI' || r.status === 'BỎ QUA');
  }

  const rows = [
    [title],
    [`Thời gian xuất: ${new Date().toLocaleString('vi-VN')}`],
    [`Tổng số bản ghi: ${exportData.length}`],
    [], // Blank line
    [
      'STT',
      'MÃ THỦ TỤC',
      'TÊN THỦ TỤC',
      'TRẠNG THÁI',
      'MÃ HTTP',
      'THÔNG BÁO TỪ HỆ THỐNG / API',
      'THỜI GIAN THỰC HIỆN'
    ]
  ];

  exportData.forEach((rec, idx) => {
    rows.push([
      idx + 1,
      String(rec.maThuTuc || ''),
      String(rec.tenThuTuc || ''),
      String(rec.status || ''),
      rec.httpStatus !== undefined && rec.httpStatus !== null ? Number(rec.httpStatus) : '',
      String(rec.message || ''),
      rec.executedAt ? new Date(rec.executedAt).toLocaleString('vi-VN') : ''
    ]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 8 },  // STT
    { wch: 20 }, // Mã thủ tục
    { wch: 60 }, // Tên thủ tục
    { wch: 16 }, // Trạng thái
    { wch: 12 }, // HTTP
    { wch: 45 }, // Thông báo
    { wch: 22 }  // Thời gian
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, onlyFailed ? 'Dòng lỗi cần xử lý' : 'Kết quả Import');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
}
