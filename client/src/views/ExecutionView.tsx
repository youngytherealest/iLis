import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Square,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Terminal,
  Activity,
  ShieldCheck,
  RotateCw,
  Search,
  Filter,
  FileCheck2,
  Send,
  Zap
} from 'lucide-react';
import {
  MappedRecord,
  ImportStatus,
  LogEntry,
  ProcessedRecord,
  TokenStatus,
  SystemSettings
} from '../types';

interface ExecutionViewProps {
  mappedRecords: MappedRecord[];
  fileName: string;
  tokenStatus: TokenStatus | null;
  settings: SystemSettings | null;
  importStatus: ImportStatus | null;
  onRunDryRun: () => Promise<void>;
  onRequestTestSingle: (record: MappedRecord) => void;
  onRequestBulkImport: (delayMs: number) => void;
  onPauseImport: () => Promise<void>;
  onResumeImport: () => Promise<void>;
  onStopImport: () => Promise<void>;
  onOpenTokenModal: () => void;
  dryRunResult: { success: boolean; message: string; summary: any } | null;
  isProcessing: boolean;
}

export const ExecutionView: React.FC<ExecutionViewProps> = ({
  mappedRecords,
  fileName,
  tokenStatus,
  settings,
  importStatus,
  onRunDryRun,
  onRequestTestSingle,
  onRequestBulkImport,
  onPauseImport,
  onResumeImport,
  onStopImport,
  onOpenTokenModal,
  dryRunResult,
  isProcessing
}) => {
  const [delayMs, setDelayMs] = useState(settings?.delayMs || 500);
  const [activeLogTab, setActiveLogTab] = useState<'stream' | 'table'>('table');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [testRecordIndex, setTestRecordIndex] = useState(0);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll terminal logs
  useEffect(() => {
    if (activeLogTab === 'stream') {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [importStatus?.logs, activeLogTab]);

  const isRunning = importStatus?.status === 'running';
  const isPaused = importStatus?.status === 'paused';
  const hasFinished = importStatus?.status === 'completed' || importStatus?.status === 'stopped';

  // Format elapsed time (ms -> mm:ss)
  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const results = importStatus?.results || [];
  const filteredResults = results.filter(r => {
    if (filterStatus === 'SUCCESS' && r.status !== 'THÀNH CÔNG') return false;
    if (filterStatus === 'FAILED' && r.status !== 'THẤT BẠI') return false;
    if (filterStatus === 'SKIPPED' && r.status !== 'BỎ QUA') return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      return (
        r.maThuTuc.toLowerCase().includes(term) ||
        r.tenThuTuc.toLowerCase().includes(term) ||
        r.message.toLowerCase().includes(term)
      );
    }
    return true;
  });

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Execution Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-blue-400" />
            Điều khiển & Tiến trình Thực thi Import
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Gửi tuần tự từng bản ghi (Concurrency: 1) với cơ chế bảo vệ, tạm dừng khi gặp HTTP 401 và giám sát realtime.
          </p>
        </div>

        {/* Delay configuration widget */}
        <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-800 p-2 rounded-xl text-xs">
          <span className="text-slate-400 font-medium pl-2">Delay giữa các request:</span>
          <input
            type="number"
            min={100}
            max={5000}
            step={100}
            value={delayMs}
            disabled={isRunning}
            onChange={(e) => setDelayMs(Math.max(100, Number(e.target.value)))}
            className="w-20 bg-slate-950 border border-slate-700/80 rounded-lg px-2 py-1 text-slate-200 font-mono text-center focus:outline-hidden"
          />
          <span className="text-slate-500 pr-2">ms</span>
        </div>
      </div>

      {/* Action Control Panel */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Button 1: Dry Run */}
            <button
              onClick={onRunDryRun}
              disabled={isRunning || mappedRecords.length === 0}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-2"
              title="Kiểm tra và giả lập tạo payload, tuyệt đối KHÔNG gửi request lên mạng"
            >
              <FileCheck2 className="w-4 h-4 text-purple-400" />
              Chạy Dry Run (Thử nghiệm)
            </button>

            {/* Button 2: Test Single */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl p-1">
              <select
                value={testRecordIndex}
                disabled={isRunning}
                onChange={(e) => setTestRecordIndex(Number(e.target.value))}
                className="bg-transparent text-xs text-slate-300 px-2 py-1 focus:outline-hidden max-w-[160px] truncate"
              >
                {mappedRecords.map((r, i) => (
                  <option key={i} value={i}>
                    Dòng {i + 1}: {r.maThuTuc}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (mappedRecords[testRecordIndex]) {
                    onRequestTestSingle(mappedRecords[testRecordIndex]);
                  }
                }}
                disabled={isRunning || mappedRecords.length === 0}
                className="px-3 py-1 bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
                title="Gửi thử đúng 1 bản ghi có kèm hộp thoại xác nhận"
              >
                <Send className="w-3.5 h-3.5" />
                Test 1 dòng
              </button>
            </div>
          </div>

          {/* Right Execution Buttons: Start / Pause / Resume / Stop */}
          <div className="flex items-center gap-3">
            {!isRunning && !isPaused ? (
              <button
                onClick={() => onRequestBulkImport(delayMs)}
                disabled={mappedRecords.length === 0 || isProcessing}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 transition flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Bắt đầu Import Hàng loạt ({mappedRecords.length} thủ tục)
              </button>
            ) : isPaused ? (
              <>
                <button
                  onClick={onResumeImport}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-lg shadow-blue-600/20"
                >
                  <Play className="w-4 h-4" />
                  Tiếp tục Import
                </button>
                <button
                  onClick={onStopImport}
                  className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <Square className="w-4 h-4" />
                  Dừng hẳn
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onPauseImport}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-lg shadow-amber-600/20"
                >
                  <Pause className="w-4 h-4" />
                  Tạm dừng
                </button>
                <button
                  onClick={onStopImport}
                  className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <Square className="w-4 h-4" />
                  Dừng hẳn
                </button>
              </>
            )}
          </div>
        </div>

        {/* Dry run feedback if available */}
        {dryRunResult && (
          <div className="p-3 bg-purple-950/20 border border-purple-800/40 rounded-xl text-xs text-purple-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-purple-400" />
              <span>{dryRunResult.message} ({dryRunResult.summary?.valid}/{dryRunResult.summary?.total} payload hợp lệ).</span>
            </div>
            <span className="font-mono text-[11px] text-purple-400">Không có dữ liệu gửi ra ngoài</span>
          </div>
        )}
      </div>

      {/* Progress & Live Statistics */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
        {/* Progress Bar & Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">
              Tiến độ hoàn thành: <strong className="text-slate-200">{importStatus?.percent || 0}%</strong> ({importStatus?.processed || 0}/{importStatus?.total || mappedRecords.length})
            </span>
            <span className="font-mono text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              Thời gian chạy: {formatTime(importStatus?.elapsedMs || 0)}
            </span>
          </div>

          <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                isRunning
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500 animate-pulse'
                  : isPaused
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${importStatus?.percent || 0}%` }}
            />
          </div>
        </div>

        {/* Currently processing item */}
        {isRunning && importStatus?.currentProcedure && (
          <div className="p-3 bg-blue-950/30 border border-blue-800/50 rounded-xl flex items-center justify-between text-xs text-blue-300 animate-pulse">
            <div className="flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-blue-400 animate-spin" />
              <span>
                Đang gửi [#{importStatus.currentProcedure.index}]: <strong>{importStatus.currentProcedure.maThuTuc}</strong> - {importStatus.currentProcedure.tenThuTuc}
              </span>
            </div>
            <span className="font-mono text-[11px]">mucDoThuTuc: 3</span>
          </div>
        )}

        {/* 4 Counter Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <div className="text-xs text-slate-400">Tổng số thủ tục</div>
            <div className="text-xl font-bold text-slate-100">{importStatus?.total || mappedRecords.length}</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <div className="text-xs text-emerald-400">Thành công</div>
            <div className="text-xl font-bold text-emerald-400">{importStatus?.success || 0}</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <div className="text-xs text-red-400">Thất bại</div>
            <div className="text-xl font-bold text-red-400">{importStatus?.failed || 0}</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
            <div className="text-xs text-amber-400">Bỏ qua</div>
            <div className="text-xl font-bold text-amber-400">{importStatus?.skipped || 0}</div>
          </div>
        </div>
      </div>

      {/* Realtime Logs & Results Section */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden space-y-4">
        {/* Tab & Filter Bar */}
        <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveLogTab('table')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeLogTab === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Bảng kết quả chi tiết ({results.length})
            </button>
            <button
              onClick={() => setActiveLogTab('stream')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                activeLogTab === 'stream'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              Terminal Stream Realtime
            </button>
          </div>

          {/* Filters for Table */}
          {activeLogTab === 'table' && (
            <div className="flex items-center gap-3">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-hidden"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="SUCCESS">Chỉ thành công</option>
                <option value="FAILED">Chỉ thất bại</option>
                <option value="SKIPPED">Chỉ bỏ qua</option>
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Lọc mã hoặc nội dung..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-hidden w-48"
                />
              </div>
            </div>
          )}
        </div>

        {/* Content: Terminal Stream */}
        {activeLogTab === 'stream' && (
          <div className="p-4 bg-slate-950 font-mono text-xs text-slate-300 max-h-96 overflow-y-auto space-y-1.5">
            {importStatus?.logs && importStatus.logs.length > 0 ? (
              importStatus.logs.map((log) => {
                const colorMap: Record<string, string> = {
                  SUCCESS: 'text-emerald-400',
                  ERROR: 'text-red-400',
                  WARNING: 'text-amber-400',
                  ALERT: 'text-rose-400 bg-rose-950/40 p-1 rounded font-bold',
                  SKIP: 'text-slate-500',
                  INFO: 'text-blue-300'
                };
                return (
                  <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-slate-600 shrink-0">[{log.time}]</span>
                    <span className={`shrink-0 font-bold ${colorMap[log.type] || 'text-slate-300'}`}>
                      [{log.type}]
                    </span>
                    <span className={colorMap[log.type] || 'text-slate-300'}>{log.message}</span>
                  </div>
                );
              })
            ) : (
              <div className="text-slate-600 text-center py-8">Chưa có log thực thi nào.</div>
            )}
            <div ref={logsEndRef} />
          </div>
        )}

        {/* Content: Results Table */}
        {activeLogTab === 'table' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-medium">
                  <th className="py-2.5 px-3 w-14 text-center">STT</th>
                  <th className="py-2.5 px-3 w-32">Mã thủ tục</th>
                  <th className="py-2.5 px-3">Tên thủ tục</th>
                  <th className="py-2.5 px-3 w-28 text-center">Trạng thái</th>
                  <th className="py-2.5 px-3 w-20 text-center">Mã HTTP</th>
                  <th className="py-2.5 px-3 max-w-xs">Thông báo phản hồi</th>
                  <th className="py-2.5 px-3 w-24 text-right">Thời gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredResults.length > 0 ? (
                  filteredResults.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition">
                      <td className="py-2 px-3 text-center text-slate-500 font-mono text-[11px]">
                        {r.index}
                      </td>
                      <td className="py-2 px-3 font-mono font-medium text-blue-400">
                        {r.maThuTuc}
                      </td>
                      <td className="py-2 px-3 text-slate-200 max-w-sm truncate" title={r.tenThuTuc}>
                        {r.tenThuTuc}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          r.status === 'THÀNH CÔNG'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : r.status === 'THẤT BẠI'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-400">
                        {r.httpStatus ? r.httpStatus : '--'}
                      </td>
                      <td className="py-2 px-3 text-slate-300 max-w-xs truncate" title={r.message}>
                        {r.message}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-[11px] text-slate-500">
                        {r.executedAt ? new Date(r.executedAt).toLocaleTimeString('vi-VN') : '--'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                      Chưa có bản ghi nào được xử lý hoặc không có dữ liệu khớp bộ lọc.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
