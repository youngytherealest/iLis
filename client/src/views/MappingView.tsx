import React, { useState } from 'react';
import {
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Code2,
  Copy,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  Layers,
  ArrowRight
} from 'lucide-react';
import {
  ExcelParsedData,
  MappingConfig,
  MappedRecord,
  MappingSummary
} from '../types';

interface MappingViewProps {
  excelData: ExcelParsedData | null;
  mappingConfig: MappingConfig;
  onUpdateMappingConfig: (newConfig: MappingConfig) => void;
  domainMappings: Record<string, string>;
  onUpdateDomainMappings: (mappings: Record<string, string>) => void;
  mappedRecords: MappedRecord[];
  mappingSummary: MappingSummary | null;
  hasProcedureLevels: boolean;
  onNavigateToExecution: () => void;
}

export const MappingView: React.FC<MappingViewProps> = ({
  excelData,
  mappingConfig,
  onUpdateMappingConfig,
  domainMappings,
  onUpdateDomainMappings,
  mappedRecords,
  mappingSummary,
  hasProcedureLevels,
  onNavigateToExecution
}) => {
  const [selectedRecordIndex, setSelectedRecordIndex] = useState(0);
  const [copiedJson, setCopiedJson] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [newDomainGuid, setNewDomainGuid] = useState('');

  if (!excelData) {
    return (
      <div className="p-12 text-center text-slate-400 space-y-3">
        <SlidersHorizontal className="w-12 h-12 mx-auto text-slate-600" />
        <div className="text-base font-semibold text-slate-300">Chưa có dữ liệu Excel</div>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">
          Vui lòng tải lên file Excel hoặc chọn file mẫu ở tab "Import Excel" trước khi tiến hành ánh xạ trường.
        </p>
      </div>
    );
  }

  const columns = excelData.columns || [];

  const handleFieldChange = (field: keyof MappingConfig, value: string) => {
    onUpdateMappingConfig({
      ...mappingConfig,
      [field]: value
    });
  };

  const handleDefaultChange = (field: string, value: any) => {
    onUpdateMappingConfig({
      ...mappingConfig,
      defaults: {
        ...mappingConfig.defaults,
        [field]: value
      }
    });
  };

  const handleDomainGuidChange = (domain: string, guid: string) => {
    onUpdateDomainMappings({
      ...domainMappings,
      [domain]: guid.trim()
    });
  };

  const handleAddDomain = () => {
    if (!newDomainName.trim() || !newDomainGuid.trim()) return;
    onUpdateDomainMappings({
      ...domainMappings,
      [newDomainName.trim()]: newDomainGuid.trim()
    });
    setNewDomainName('');
    setNewDomainGuid('');
  };

  const handleDeleteDomain = (domain: string) => {
    const updated = { ...domainMappings };
    delete updated[domain];
    onUpdateDomainMappings(updated);
  };

  const currentRecord = mappedRecords[selectedRecordIndex] || mappedRecords[0];

  const handleCopyJson = () => {
    if (currentRecord?.payload) {
      navigator.clipboard.writeText(JSON.stringify(currentRecord.payload, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
            Cấu hình Ánh xạ Dữ liệu (Excel &rarr; ILIS LPM API)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Khớp các cột từ file Excel với cấu trúc JSON chuẩn của API <code className="text-blue-300 font-mono">/lpm/api/ThuTucManage/Add</code>.
          </p>
        </div>

        <button
          onClick={onNavigateToExecution}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/20 transition flex items-center gap-2 self-start md:self-auto"
        >
          Tiến hành Dry Run & Import &rarr;
        </button>
      </div>

      {/* Validation Summary Cards */}
      {mappingSummary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-100">{mappingSummary.valid}</div>
              <div className="text-xs text-slate-400">Bản ghi hợp lệ</div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
            <div className={`p-2.5 rounded-lg border ${
              mappingSummary.invalid > 0
                ? 'bg-red-500/10 text-red-400 border-red-500/20'
                : 'bg-slate-800 text-slate-500 border-slate-700'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-100">{mappingSummary.invalid}</div>
              <div className="text-xs text-slate-400">Bản ghi có lỗi</div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
            <div className={`p-2.5 rounded-lg border ${
              mappingSummary.duplicates > 0
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-slate-800 text-slate-500 border-slate-700'
            }`}>
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-100">{mappingSummary.duplicates}</div>
              <div className="text-xs text-slate-400">Trùng mã thủ tục</div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
            <div className={`p-2.5 rounded-lg border ${
              mappingSummary.unmappedDomains.length > 0
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}>
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-100">{mappingSummary.unmappedDomains.length}</div>
              <div className="text-xs text-slate-400">Lĩnh vực thiếu GUID</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Left = Field Mapping Form, Right = JSON Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Mapping Settings (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card: Column Field Mapping */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-blue-400" />
              1. Ánh xạ các Cột từ Excel sang Trường API
            </h3>

            <div className="space-y-4">
              {/* Field 1: maThuTuc */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                <div className="text-xs font-medium text-slate-300">
                  Mã thủ tục <code className="text-blue-400 font-mono">(maThuTuc)</code>
                  <span className="text-red-400 ml-1">*</span>
                </div>
                <div className="md:col-span-2">
                  <select
                    value={mappingConfig.maThuTucCol}
                    onChange={(e) => handleFieldChange('maThuTucCol', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  >
                    {columns.map(col => (
                      <option key={col.letter} value={col.letter}>
                        {col.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Field 2: tenThuTuc */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                <div className="text-xs font-medium text-slate-300">
                  Tên thủ tục <code className="text-blue-400 font-mono">(tenThuTuc)</code>
                  <span className="text-red-400 ml-1">*</span>
                </div>
                <div className="md:col-span-2">
                  <select
                    value={mappingConfig.tenThuTucCol}
                    onChange={(e) => handleFieldChange('tenThuTucCol', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  >
                    {columns.map(col => (
                      <option key={col.letter} value={col.letter}>
                        {col.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Field 3: tenVietTat */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                <div className="text-xs font-medium text-slate-300">
                  Tên viết tắt <code className="text-blue-400 font-mono">(tenVietTat)</code>
                </div>
                <div className="md:col-span-2">
                  <select
                    value={mappingConfig.tenVietTatCol}
                    onChange={(e) => handleFieldChange('tenVietTatCol', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">(Tự sinh hoặc dùng mã thủ tục)</option>
                    {columns.map(col => (
                      <option key={col.letter} value={col.letter}>
                        {col.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Field 4: linhVucCol */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                <div className="text-xs font-medium text-slate-300">
                  Cột Lĩnh vực trong Excel
                </div>
                <div className="md:col-span-2">
                  <select
                    value={mappingConfig.linhVucCol}
                    onChange={(e) => handleFieldChange('linhVucCol', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  >
                    {columns.map(col => (
                      <option key={col.letter} value={col.letter}>
                        {col.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Field 5: moTaCol */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                <div className="text-xs font-medium text-slate-300">
                  Cột Mô tả <code className="text-blue-400 font-mono">(moTa)</code>
                </div>
                <div className="md:col-span-2">
                  <select
                    value={mappingConfig.moTaCol}
                    onChange={(e) => handleFieldChange('moTaCol', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">(Không có cột mô tả - để trống)</option>
                    {columns.map(col => (
                      <option key={col.letter} value={col.letter}>
                        {col.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Domain GUID Mapping Manager */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                2. Bảng Ánh xạ Lĩnh vực (Tên Lĩnh Vực &rarr; GUID ID)
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Excel chỉ chứa Tên lĩnh vực (chuỗi ký tự). API ILIS yêu cầu GUID <code className="text-purple-300 font-mono">idLinhVuc</code>. Cấu hình ID cho từng lĩnh vực dưới đây:
            </p>

            <div className="space-y-3">
              {Object.entries(domainMappings).map(([domain, guid]) => (
                <div key={domain} className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-[180px]">
                    <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                    <span className="text-xs font-semibold text-slate-200">{domain}</span>
                  </div>

                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={guid}
                      onChange={(e) => handleDomainGuidChange(domain, e.target.value)}
                      placeholder="Nhập 32 ký tự GUID (ví dụ: 161A6A0F284D403C9EF8E1F612CCE8B5)"
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs font-mono text-purple-300 focus:outline-hidden focus:border-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteDomain(domain)}
                      className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-900 transition"
                      title="Xóa mapping này"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Add New Domain row */}
              <div className="p-3 bg-slate-950/40 border border-dashed border-slate-800 rounded-xl flex flex-col md:flex-row items-center gap-2">
                <input
                  type="text"
                  placeholder="Tên lĩnh vực mới (ví dụ: Đất đai)"
                  value={newDomainName}
                  onChange={(e) => setNewDomainName(e.target.value)}
                  className="w-full md:w-1/3 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
                />
                <input
                  type="text"
                  placeholder="GUID ID lĩnh vực (32 ký tự)"
                  value={newDomainGuid}
                  onChange={(e) => setNewDomainGuid(e.target.value)}
                  className="w-full md:flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-purple-300"
                />
                <button
                  type="button"
                  onClick={handleAddDomain}
                  disabled={!newDomainName.trim() || !newDomainGuid.trim()}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm
                </button>
              </div>
            </div>
          </div>

          {/* Card: Default Parameters & Locked Business Rules */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              3. Quy định Bắt buộc & Tham số Mặc định
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Mandatory mucDoThuTuc */}
              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/40 space-y-1 md:col-span-2">
                <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" /> Mức độ thủ tục (mucDoThuTuc)
                  </span>
                  <span className="bg-amber-500/20 px-2 py-0.5 rounded text-amber-200 font-mono">
                    Cố định = 3
                  </span>
                </div>
                <p className="text-[11px] text-amber-400/90 leading-relaxed">
                  Bắt buộc theo yêu cầu: Tất cả thủ tục import đều là <strong>Dịch vụ công trực tuyến một phần</strong> (Mức độ 3). Hệ thống khóa cố định giá trị này trong 100% request payload.
                </p>
              </div>

              {/* laThuTucCapXa */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-slate-200">Thủ tục Cấp xã (laThuTucCapXa)</div>
                  <div className="text-[11px] text-slate-400">
                    {hasProcedureLevels ? 'Đang lấy theo file Tổng hợp quy trình thủ tục' : 'Mặc định: true'}
                  </div>
                </div>
                <label className={`relative inline-flex items-center ${hasProcedureLevels ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={mappingConfig.defaults.laThuTucCapXa}
                    disabled={hasProcedureLevels}
                    onChange={(e) => handleDefaultChange('laThuTucCapXa', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* thoiHanTraThongBaoThue */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                <div className="text-xs font-medium text-slate-200">Thời hạn trả TB thuế</div>
                <input
                  type="text"
                  value={mappingConfig.defaults.thoiHanTraThongBaoThue}
                  onChange={(e) => handleDefaultChange('thoiHanTraThongBaoThue', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-mono"
                  placeholder="2"
                />
              </div>

              {/* trangThai */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                <div className="text-xs font-medium text-slate-200">Trạng thái (trangThai)</div>
                <input
                  type="number"
                  value={mappingConfig.defaults.trangThai}
                  onChange={(e) => handleDefaultChange('trangThai', Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-mono"
                  placeholder="1"
                />
              </div>

              {/* thuTucLoaiGiayTos */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl space-y-1">
                <div className="text-xs font-medium text-slate-200">Loại giấy tờ kèm theo</div>
                <div className="text-xs font-mono text-slate-400 py-1">[] (Mảng rỗng theo yêu cầu)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live JSON Payload Preview & Row Selector (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4 sticky top-20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-200">Xem trước JSON Payload</h3>
              </div>

              <button
                onClick={handleCopyJson}
                className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
                title="Sao chép JSON"
              >
                {copiedJson ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Đã sao chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy JSON</span>
                  </>
                )}
              </button>
            </div>

            {/* Row Selector Slider / Dropdown */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Chọn dòng thủ tục để xem ({mappedRecords.length} dòng):
              </label>
              <select
                value={selectedRecordIndex}
                onChange={(e) => setSelectedRecordIndex(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-hidden"
              >
                {mappedRecords.map((r, i) => (
                  <option key={i} value={i}>
                    Dòng {r.rowIndex}: [{r.maThuTuc || 'Trống'}] {r.tenThuTuc.substring(0, 35)}...
                  </option>
                ))}
              </select>
            </div>

            {/* Status of selected record */}
            {currentRecord && (
              <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                currentRecord.isValid
                  ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                  : 'bg-red-950/20 border-red-800/40 text-red-300'
              }`}>
                <div className="font-semibold flex items-center gap-1.5">
                  {currentRecord.isValid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  )}
                  {currentRecord.isValid ? 'Dòng hợp lệ, sẵn sàng gửi API' : 'Dòng này có lỗi cần khắc phục:'}
                </div>
                {currentRecord.errors?.length > 0 && (
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-red-300">
                    {currentRecord.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
                {currentRecord.warnings?.length > 0 && (
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-300">
                    {currentRecord.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* JSON Code Box */}
            <div className="relative">
              <pre className="bg-slate-950 border border-slate-800/90 rounded-xl p-3.5 text-xs font-mono text-blue-300 overflow-x-auto max-h-[380px] leading-relaxed">
                {currentRecord?.payload
                  ? JSON.stringify(currentRecord.payload, null, 2)
                  : '// Chưa có dữ liệu'}
              </pre>
            </div>

            <div className="text-[11px] text-slate-500">
              * Đây là payload chính xác 100% sẽ gửi đến ILIS LPM khi thực hiện Import.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
