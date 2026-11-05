import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Table,
  Sliders,
  Layers,
  Trash2
} from 'lucide-react';
import { ExcelParsedData, MappingSummary, ProcedureLevelSource } from '../types';

interface ExcelImportViewProps {
  excelData: ExcelParsedData | null;
  onFileUpload: (file: File) => Promise<void>;
  onSelectSample: (fileName: string) => Promise<void>;
  onReparse: (sheetName?: string, headerRowIndex?: number) => Promise<void>;
  procedureLevels: ProcedureLevelSource | null;
  levelReport: MappingSummary['levelReport'];
  onUploadProcedureLevels: (file: File) => Promise<void>;
  onClearProcedureLevels: () => Promise<void>;
  isLoading: boolean;
  onNavigateToMapping: () => void;
}

export const ExcelImportView: React.FC<ExcelImportViewProps> = ({
  excelData,
  onFileUpload,
  onSelectSample,
  onReparse,
  procedureLevels,
  levelReport,
  onUploadProcedureLevels,
  onClearProcedureLevels,
  isLoading,
  onNavigateToMapping
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedSheet, setSelectedSheet] = useState(excelData?.selectedSheetName || '');
  const [headerRow, setHeaderRow] = useState(excelData?.headerRowIndex !== undefined ? excelData.headerRowIndex + 1 : 5);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const levelInputRef = useRef<HTMLInputElement>(null);

  // Sync state when excelData changes
  React.useEffect(() => {
    if (excelData) {
      setSelectedSheet(excelData.selectedSheetName);
      setHeaderRow(excelData.headerRowIndex + 1);
      setCurrentPage(1);
    }
  }, [excelData]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      await onFileUpload(file);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      await onFileUpload(file);
    }
  };

  const handleLevelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      await onUploadProcedureLevels(file);
    }
  };

  const handleSheetChange = async (newSheet: string) => {
    setSelectedSheet(newSheet);
    await onReparse(newSheet, headerRow - 1);
  };

  const handleHeaderRowChange = async (newRowStr: string) => {
    const r = parseInt(newRowStr, 10);
    if (!isNaN(r) && r >= 1) {
      setHeaderRow(r);
      await onReparse(selectedSheet, r - 1);
    }
  };

  // Filter rows by searchTerm
  const filteredRows = React.useMemo(() => {
    if (!excelData?.rows) return [];
    if (!searchTerm.trim()) return excelData.rows;
    const term = searchTerm.toLowerCase();
    return excelData.rows.filter(r => {
      return Object.values(r).some(val => 
        String(val || '').toLowerCase().includes(term)
      );
    });
  }, [excelData?.rows, searchTerm]);

  // Paginate
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            Tải lên & Khám phá Dữ liệu Excel (XLS / XLSX)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Hỗ trợ cấu trúc tiêu đề phức tạp, ô gộp, tự động lọc dòng trống và giữ nguyên số 0 ở đầu của mã thủ tục.
          </p>
        </div>

        {excelData && (
          <button
            onClick={onNavigateToMapping}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/20 transition flex items-center gap-2 self-start md:self-auto"
          >
            Tiếp tục sang Mapping &rarr;
          </button>
        )}
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
          isDragging
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 hover:bg-slate-900/60'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xls,.xlsx"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
          <UploadCloud className="w-6 h-6" />
        </div>

        <div className="space-y-1">
          <div className="text-sm font-semibold text-slate-200">
            Kéo thả file Excel vào đây hoặc <span className="text-blue-400 underline">bấm để chọn file</span>
          </div>
          <div className="text-xs text-slate-400">
            Chấp nhận định dạng Microsoft Excel 97-2003 (.xls) và Excel (.xlsx) lên tới 50MB
          </div>
        </div>
      </div>

      {/* Sample Files Quick Buttons */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <span className="text-xs font-medium text-slate-400">File mẫu trong thư mục:</span>
        <button
          onClick={() => onSelectSample('30_10_danhsachthutuc.xls')}
          className="px-3 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 rounded-xl transition flex items-center gap-1.5"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
          30_10_danhsachthutuc.xls (35 thủ tục)
        </button>
        <button
          onClick={() => onSelectSample('30_10_danhsachthutuc (1).xls')}
          className="px-3 py-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/80 rounded-xl transition flex items-center gap-1.5"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
          30_10_danhsachthutuc (1).xls (5 thủ tục)
        </button>
      </div>

      {/* Tổng hợp quy trình thủ tục: TEN_TAT -> MA_CAP_THU_TUC */}
      <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl space-y-3">
        <input
          ref={levelInputRef}
          type="file"
          accept=".xls,.xlsx"
          onChange={handleLevelFileChange}
          className="hidden"
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-400" />
              Tổng hợp quy trình thủ tục
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Map TEN_TAT và MA_CAP_THU_TUC: bằng 3 là cấp tỉnh, bằng 1 hoặc không map được là cấp xã.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => levelInputRef.current?.click()}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-xl transition flex items-center gap-1.5"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              {procedureLevels ? 'Chọn file khác' : 'Chọn file'}
            </button>
            {procedureLevels && (
              <button
                onClick={onClearProcedureLevels}
                disabled={isLoading}
                className="p-1.5 text-slate-400 hover:text-red-400 border border-slate-700/80 rounded-xl transition"
                title="Gỡ file này"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {procedureLevels ? (
          <div className="text-xs text-slate-300 space-y-1">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold">{procedureLevels.fileName}</span>
              <span className="text-slate-400">
                • {procedureLevels.totalCodes} mã ({procedureLevels.provinceCount} cấp tỉnh, {procedureLevels.communeCount} cấp xã)
              </span>
            </div>
            {levelReport && (
              <div className="text-slate-400">
                File danh sách đang chọn: <span className="text-blue-400 font-semibold">{levelReport.province}</span> cấp tỉnh,{' '}
                <span className="text-emerald-400 font-semibold">{levelReport.commune}</span> cấp xã,{' '}
                <span className="text-amber-400 font-semibold">{levelReport.unmapped}</span> không map được (tính là cấp xã)
              </div>
            )}
            {procedureLevels.conflicts.length > 0 && (
              <div className="flex items-start gap-1.5 text-amber-300">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  {procedureLevels.conflicts.length} mã vừa là cấp 1 vừa là cấp 3, được tính là không map được: {procedureLevels.conflicts.join(', ')}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-500">
            Chưa chọn file. Toàn bộ thủ tục sẽ dùng giá trị cấp xã chung ở bước Mapping.
          </div>
        )}
      </div>

      {/* Excel Configuration Toolbar (Sheet & Header row) */}
      {excelData && (
        <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Sheet picker */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Chọn Sheet làm việc ({excelData.sheetNames.length} sheet)
              </label>
              <select
                value={selectedSheet}
                onChange={(e) => handleSheetChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              >
                {excelData.sheetNames.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* Header row picker */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Dòng chứa tiêu đề cột (Header Row)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={headerRow}
                  onChange={(e) => handleHeaderRowChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-[11px] text-slate-500 shrink-0">
                  (Mặc định: Dòng 5)
                </span>
              </div>
            </div>

            {/* Merged cells & detection info */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Phân tích cấu trúc
              </label>
              <div className="text-xs text-slate-300 py-2">
                <span className="font-semibold text-emerald-400">{excelData.totalRows}</span> dòng dữ liệu hợp lệ
                {excelData.mergesCount > 0 && ` • ${excelData.mergesCount} ô gộp được bỏ qua`}
              </div>
            </div>

            {/* Lĩnh vực detected */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Lĩnh vực tìm thấy
              </label>
              <div className="text-xs text-blue-400 py-2 truncate font-medium">
                {excelData.domains.length > 0 ? excelData.domains.join(', ') : 'Chưa nhận diện'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Preview Table */}
      {excelData && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden space-y-4">
          {/* Table Toolbar */}
          <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Table className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-200">
                Xem trước bảng dữ liệu ({filteredRows.length} bản ghi)
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Tìm kiếm trong bảng..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-56"
                />
              </div>

              {/* Page size */}
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-hidden"
              >
                <option value={10}>10 dòng / trang</option>
                <option value={25}>25 dòng / trang</option>
                <option value={50}>50 dòng / trang</option>
                <option value={100}>100 dòng / trang</option>
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-medium">
                  <th className="py-2.5 px-3 w-16 text-center">Dòng</th>
                  {excelData.columns.slice(0, 10).map((col) => (
                    <th key={col.letter} className="py-2.5 px-3 min-w-[140px] truncate">
                      <div className="text-[10px] text-blue-400 font-mono">Cột {col.letter}</div>
                      <div className="text-slate-200 font-semibold">{col.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paginatedRows.length > 0 ? (
                  paginatedRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition">
                      <td className="py-2 px-3 text-center text-slate-500 font-mono text-[11px]">
                        {row._rowIndex}
                      </td>
                      {excelData.columns.slice(0, 10).map((col) => (
                        <td key={col.letter} className="py-2 px-3 text-slate-300 max-w-[280px] truncate">
                          {row[col.letter] || row[col.name] || (
                            <span className="text-slate-600 italic">--</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={excelData.columns.length + 1}
                      className="py-8 text-center text-slate-500 text-xs"
                    >
                      Không tìm thấy dữ liệu phù hợp với từ khóa tìm kiếm.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Trang <span className="text-slate-200 font-semibold">{currentPage}</span> / {totalPages}
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent text-slate-300 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-40 disabled:hover:bg-transparent text-slate-300 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
