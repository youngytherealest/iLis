import React, { useState } from 'react';
import {
  History,
  Download,
  AlertOctagon,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck,
  Calendar
} from 'lucide-react';
import { ImportSession, ProcessedRecord } from '../types';

interface HistoryViewProps {
  sessions: ImportSession[];
  currentResults: ProcessedRecord[];
  onExportExcel: (records: ProcessedRecord[], onlyFailed: boolean) => Promise<void>;
  onSelectSession: (session: ImportSession) => Promise<void>;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  sessions,
  currentResults,
  onExportExcel,
  onSelectSession
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const hasCurrentResults = currentResults.length > 0;
  const currentFailedCount = currentResults.filter(r => r.status === 'THẤT BẠI' || r.status === 'BỎ QUA').length;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <History className="w-5 h-5 text-emerald-400" />
            Lịch sử & Xuất Báo cáo Kết quả (Excel .xlsx)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Tải về báo cáo hoàn chỉnh với đầy đủ Mã thủ tục, Tên, Trạng thái, HTTP Status và phản hồi từ hệ thống ILIS.
          </p>
        </div>

        {/* Quick Export Current Session */}
        {hasCurrentResults && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => onExportExcel(currentResults, false)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-600/20 transition flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Xuất kết quả hiện tại ({currentResults.length})
            </button>

            {currentFailedCount > 0 && (
              <button
                onClick={() => onExportExcel(currentResults, true)}
                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 rounded-xl text-xs font-semibold transition flex items-center gap-2"
                title="Chỉ xuất các dòng thất bại hoặc bỏ qua để sửa lại và nạp lại"
              >
                <AlertOctagon className="w-4 h-4" />
                Xuất riêng {currentFailedCount} dòng lỗi
              </button>
            )}
          </div>
        )}
      </div>

      {/* Current Session Summary Box */}
      {hasCurrentResults && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              Phiên Import Vừa Thực hiện
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Tổng: {currentResults.length} bản ghi
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
              <span className="text-xs text-slate-400">Thành công</span>
              <div className="text-lg font-bold text-emerald-400">
                {currentResults.filter(r => r.status === 'THÀNH CÔNG').length}
              </div>
            </div>
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
              <span className="text-xs text-slate-400">Thất bại</span>
              <div className="text-lg font-bold text-red-400">
                {currentResults.filter(r => r.status === 'THẤT BẠI').length}
              </div>
            </div>
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
              <span className="text-xs text-slate-400">Bỏ qua</span>
              <div className="text-lg font-bold text-amber-400">
                {currentResults.filter(r => r.status === 'BỎ QUA').length}
              </div>
            </div>
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
              <span className="text-xs text-slate-400">Tỷ lệ thành công</span>
              <div className="text-lg font-bold text-blue-400">
                {Math.round((currentResults.filter(r => r.status === 'THÀNH CÔNG').length / currentResults.length) * 100)}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Historical Sessions List */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden space-y-4">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-semibold text-slate-200">
              Danh sách các Phiên Import trước đây ({sessions.length})
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-medium">
                <th className="py-2.5 px-4 w-44">Thời gian</th>
                <th className="py-2.5 px-4">Tên file nguồn</th>
                <th className="py-2.5 px-4 text-center w-28">Tổng số</th>
                <th className="py-2.5 px-4 text-center w-28">Thành công</th>
                <th className="py-2.5 px-4 text-center w-28">Thất bại</th>
                <th className="py-2.5 px-4 text-center w-28">Trạng thái</th>
                <th className="py-2.5 px-4 text-right w-36">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sessions.length > 0 ? (
                sessions.map((ses) => (
                  <tr key={ses.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {new Date(ses.startTime).toLocaleString('vi-VN')}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-200 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      {ses.fileName}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-slate-200">
                      {ses.total}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-400">
                      {ses.success}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-red-400">
                      {ses.failed}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        ses.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {ses.status === 'completed' ? 'Hoàn tất' : ses.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onSelectSession(ses)}
                        className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-blue-300 rounded-lg border border-slate-700 transition"
                      >
                        Chi tiết & Xuất
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                    Chưa có lịch sử phiên import nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
