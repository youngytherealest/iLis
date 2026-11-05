import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  FileCode2,
  FolderOpen,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
  XCircle
} from 'lucide-react';
import { api } from '../services/api';
import { ProcedureCatalogItem, ProcedureFileUpdateResult, TokenStatus } from '../types';

type MatchStatus = 'matched' | 'ambiguous' | 'unmatched';

interface ProcedureFileRow {
  file: File;
  fileName: string;
  code: string;
  status: MatchStatus;
  candidates: ProcedureCatalogItem[];
  selectedProcedureIds: string[];
  results?: ProcedureFileUpdateResult[];
}

interface ProcedureUpdateViewProps {
  tokenStatus: TokenStatus | null;
  onOpenTokenModal: () => void;
}

function normalizeCode(value: string | null | undefined) {
  return String(value || '').trim().replace(/\s+/g, '').replace(/_/g, '.').toUpperCase();
}

function extractFileCode(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, '');
  return baseName.split(' - ')[0].trim();
}

function extractBaseProcedureCode(code: string) {
  const match = code.match(/^(\d+\.\d{6})/);
  return match ? match[1] : code;
}

function buildFileRow(file: File, catalog: ProcedureCatalogItem[]): ProcedureFileRow {
  const code = extractFileCode(file.name);
  const normalizedCode = normalizeCode(code);
  const exact = catalog.filter(item => normalizeCode(item.maQuyTrinh) === normalizedCode);

  if (exact.length === 1) {
    return {
      file,
      fileName: file.name,
      code,
      status: 'matched',
      candidates: exact,
      selectedProcedureIds: [exact[0].id]
    };
  }

  const baseCode = normalizeCode(extractBaseProcedureCode(code));
  const baseCandidates = catalog.filter(item => normalizeCode(item.maThuTuc) === baseCode);
  const suffix = code.match(/\.(\d+)$/)?.[1];
  const suffixCandidate = suffix
    ? baseCandidates.filter(item => normalizeCode(item.maQuyTrinh) === `${baseCode}.${suffix}`)
    : [];

  if (suffixCandidate.length === 1) {
    return {
      file,
      fileName: file.name,
      code,
      status: 'matched',
      candidates: suffixCandidate,
      selectedProcedureIds: [suffixCandidate[0].id]
    };
  }

  return {
    file,
    fileName: file.name,
    code,
    status: baseCandidates.length > 0 ? 'ambiguous' : 'unmatched',
    candidates: baseCandidates,
    selectedProcedureIds: []
  };
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export const ProcedureUpdateView: React.FC<ProcedureUpdateViewProps> = ({
  tokenStatus,
  onOpenTokenModal
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [catalog, setCatalog] = useState<ProcedureCatalogItem[]>([]);
  const [rows, setRows] = useState<ProcedureFileRow[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [openSelector, setOpenSelector] = useState<string | null>(null);

  const loadCatalog = async () => {
    setIsCatalogLoading(true);
    setError('');
    try {
      const response = await api.getProcedureCatalog();
      const nextCatalog = response.items || [];
      setCatalog(nextCatalog);
      setRows(previous => previous.length > 0
        ? previous.map(row => buildFileRow(row.file, nextCatalog))
        : previous);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Không tải được danh sách quy trình.');
    } finally {
      setIsCatalogLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const matchedCount = useMemo(
    () => rows.filter(row => row.selectedProcedureIds.length > 0).length,
    [rows]
  );
  const selectedRequestCount = useMemo(
    () => rows.reduce((total, row) => total + row.selectedProcedureIds.length, 0),
    [rows]
  );
  const ambiguousCount = useMemo(
    () => rows.filter(row => row.status === 'ambiguous' && row.selectedProcedureIds.length === 0).length,
    [rows]
  );
  const unmatchedCount = useMemo(
    () => rows.filter(row => row.status === 'unmatched').length,
    [rows]
  );
  const completedCount = useMemo(
    () => rows.filter(row => (row.results?.length || 0) > 0).length,
    [rows]
  );

  const addFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter(file => file.name.toLowerCase().endsWith('.bpmn'));
    if (files.length === 0) {
      setError('Không tìm thấy file .bpmn trong thư mục được chọn.');
      return;
    }
    setError('');
    setRows(files.map(file => buildFileRow(file, catalog)));
    setCurrentIndex(0);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const updateSelectedProcedures = (fileName: string, ids: string[]) => {
    setRows(previous => previous.map(row => row.fileName === fileName
      ? {
          ...row,
          selectedProcedureIds: ids,
          status: ids.length > 0 ? 'matched' : row.candidates.length > 0 ? 'ambiguous' : 'unmatched',
          results: undefined
        }
      : row));
  };

  const startUpload = async () => {
    const uploadRows = rows.flatMap(row => row.selectedProcedureIds.map(id => ({ row, id })));
    if (uploadRows.length === 0) {
      setError('Chưa có file nào được mapping với quy trình.');
      return;
    }
    if (!tokenStatus?.hasToken) {
      setError('Cần nhập Bearer Token trước khi cập nhật file quy trình.');
      onOpenTokenModal();
      return;
    }
    if (!window.confirm(`Sẽ gửi ${uploadRows.length} request cho ${matchedCount} file lên ILIS thật. Bạn có muốn tiếp tục?`)) return;

    setIsUploading(true);
    setError('');
    setCurrentIndex(0);
    setRows(previous => previous.map(row => ({ ...row, results: undefined })));

    for (let index = 0; index < uploadRows.length; index++) {
      const { row, id } = uploadRows[index];
      setCurrentIndex(index + 1);
      try {
        const result = await api.updateProcedureFile(row.file, id);
        setRows(previous => previous.map(item => item.fileName === row.fileName
          ? { ...item, results: [...(item.results || []), result] }
          : item));
        if (result.httpStatus === 401) {
          setError('Token không hợp lệ hoặc đã hết hạn. Tiến trình đã dừng.');
          break;
        }
      } catch (err: any) {
        const result: ProcedureFileUpdateResult = {
          success: false,
          httpStatus: err?.response?.status || 0,
          type: 'CLIENT_ERROR',
          message: err?.response?.data?.error || err?.message || 'Lỗi gửi file.'
        };
        setRows(previous => previous.map(item => item.fileName === row.fileName
          ? { ...item, results: [...(item.results || []), result] }
          : item));
      }
    }

    setIsUploading(false);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <section className="rounded-2xl border border-blue-900/70 bg-gradient-to-br from-blue-950/70 to-slate-950 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-300">
              <FileCode2 className="h-4 w-4" />
              Quy trình ILIS LPM
            </div>
            <h1 className="mt-4 text-2xl font-bold text-white">Cập nhật file quy trình</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Chọn thư mục chứa file BPMN, hệ thống sẽ đối chiếu mã file với danh sách 68 quy trình và gửi file tới endpoint UpdateFileQuyTrinh.
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            <div className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4" /> Gửi API thật</div>
            <div className="mt-1 text-amber-100/70">Mỗi file là một request riêng.</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ['Danh mục quy trình', isCatalogLoading ? '...' : `${catalog.length} / 68`, 'text-blue-300'],
          ['File BPMN', String(rows.length), 'text-slate-100'],
          ['Đã mapping', String(matchedCount), 'text-emerald-300'],
          ['Cần xử lý', String(ambiguousCount + unmatchedCount), 'text-amber-300']
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-xs text-slate-400">{label}</div>
            <div className={`mt-2 text-2xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </section>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-white">1. Chọn thư mục file BPMN</h2>
            <p className="mt-1 text-xs text-slate-500">Trình duyệt sẽ không hiển thị đường dẫn tuyệt đối; hãy chọn hoặc kéo folder vào vùng bên dưới.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={loadCatalog} disabled={isCatalogLoading} className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${isCatalogLoading ? 'animate-spin' : ''}`} /> Tải lại danh mục
            </button>
            <button onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500">
              <FolderOpen className="h-4 w-4" /> Chọn thư mục
            </button>
          </div>
        </div>

        <div
          onDragOver={event => { event.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`mt-4 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition ${isDragging ? 'border-blue-400 bg-blue-500/10' : 'border-slate-700 bg-slate-950/50 hover:border-blue-500/60'}`}
        >
          <CloudUpload className="h-8 w-8 text-blue-400" />
          <div className="mt-2 text-sm font-medium text-slate-200">Kéo thả folder `output_V2` vào đây</div>
          <div className="mt-1 text-xs text-slate-500">Chỉ nhận file `.bpmn`</div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".bpmn"
            onChange={handleInputChange}
            className="hidden"
            {...({ webkitdirectory: 'true', directory: 'true' } as any)}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-white">2. Kiểm tra mapping</h2>
            <p className="mt-1 text-xs text-slate-500">Các dòng màu vàng cần chọn thủ công khi một thủ tục có nhiều quy trình.</p>
          </div>
          <button
            onClick={startUpload}
            disabled={isUploading || selectedRequestCount === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isUploading ? `Đang gửi ${currentIndex}/${selectedRequestCount}` : `Cập nhật ${selectedRequestCount} request`}
          </button>
        </div>

        {rows.length === 0 ? (
          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/50 p-8 text-center text-sm text-slate-500">Chưa có file BPMN để mapping.</div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">Mã tách được</th>
                  <th className="px-4 py-3">Quy trình</th>
                  <th className="px-4 py-3">idQuyTrinh</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Kết quả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map(row => {
                  const selected = row.candidates.filter(item => row.selectedProcedureIds.includes(item.id));
                  const rowClass = row.status === 'matched' ? 'bg-emerald-500/[0.03]' : row.status === 'ambiguous' ? 'bg-amber-500/[0.05]' : 'bg-red-500/[0.04]';
                  return (
                    <tr key={row.fileName} className={rowClass}>
                      <td className="max-w-[300px] px-4 py-3 text-slate-200">
                        <div className="truncate font-medium" title={row.fileName}>{row.fileName}</div>
                        <div className="mt-1 text-[10px] text-slate-500">{formatSize(row.file.size)}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-blue-300">{row.code}</td>
                      <td className="px-4 py-3">
                        {row.candidates.length > 0 ? (
                          <select
                            multiple
                            value={row.selectedProcedureIds}
                            onChange={event => updateSelectedProcedures(
                              row.fileName,
                              Array.from(event.target.selectedOptions, option => option.value)
                            )}
                            size={Math.min(Math.max(row.candidates.length, 2), 5)}
                            className="w-64 rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 font-mono text-[11px] text-slate-200 outline-none focus:border-blue-500"
                          >
                            <option value="">-- Chọn quy trình --</option>
                            {row.candidates.map(item => <option key={item.id} value={item.id}>{item.maQuyTrinh}</option>)}
                          </select>
                        ) : <span className="text-red-300">Không tìm thấy</span>}
                      </td>
                      <td className="max-w-[260px] px-4 py-3 font-mono text-[10px] text-slate-400">
                        {selected.length > 0 ? selected.map(item => item.id).join(', ') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {row.status === 'matched' && <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Khớp</span>}
                        {row.status === 'ambiguous' && <span className="inline-flex items-center gap-1 text-amber-300"><AlertCircle className="h-4 w-4" /> Chọn thủ công</span>}
                        {row.status === 'unmatched' && <span className="inline-flex items-center gap-1 text-red-300"><XCircle className="h-4 w-4" /> Không khớp</span>}
                      </td>
                      <td className="px-4 py-3">
                        {row.results && row.results.length > 0 && (
                          <div>
                            <span className={row.results.every(item => item.success) ? 'text-emerald-300' : 'text-red-300'}>
                              {row.results.every(item => item.success)
                                ? `Thành công ${row.results.length}/${row.selectedProcedureIds.length}`
                                : `${row.results.filter(item => !item.success).length} request lỗi`}
                            </span>
                            {!row.results.every(item => item.success) && (
                              <div className="mt-1 max-w-[280px] truncate text-[10px] text-red-300/80" title={row.results.map(item => item.message || item.type).join(' | ')}>
                                {row.results.map(item => item.message || item.type).join(' | ')}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {completedCount > 0 && !isUploading && (
          <div className="mt-4 text-xs text-slate-400">Đã xử lý {completedCount}/{matchedCount} file. Kiểm tra cột Kết quả trước khi gửi lại.</div>
        )}
      </section>
    </div>
  );
};
