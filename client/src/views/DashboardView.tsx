import React from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Play,
  KeyRound,
  ShieldCheck,
  Server,
  ArrowRight,
  Clock,
  Layers
} from 'lucide-react';
import { TabId } from '../components/Sidebar';
import { TokenStatus, SystemSettings, ExcelParsedData, MappingSummary, ImportSession } from '../types';

interface DashboardViewProps {
  excelData: ExcelParsedData | null;
  mappingSummary: MappingSummary | null;
  tokenStatus: TokenStatus | null;
  settings: SystemSettings | null;
  sessions: ImportSession[];
  onNavigate: (tab: TabId) => void;
  onOpenTokenModal: () => void;
  onLoadSample: (fileName: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  excelData,
  mappingSummary,
  tokenStatus,
  settings,
  sessions,
  onNavigate,
  onOpenTokenModal,
  onLoadSample
}) => {
  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Banner */}
      <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900/40 border border-blue-800/40 p-6 rounded-2xl relative overflow-hidden shadow-xl">
        <div className="relative z-10 max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-medium text-blue-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            Hệ thống Quản lý Thủ tục Hành chính ILIS LPM
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Công cụ Nhập Hàng loạt Thủ tục Hành chính (Excel Bulk Import)
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Hỗ trợ đọc file danh sách TTHC (.xls, .xlsx), tự động nhận diện cấu trúc, ánh xạ trường, thiết lập mã Lĩnh vực và gửi dữ liệu chuẩn hóa trực tiếp vào VNPT Gateway qua endpoint <code className="text-blue-300 bg-slate-950/60 px-1.5 py-0.5 rounded font-mono text-xs">/lpm/api/ThuTucManage/Add</code>.
          </p>
        </div>
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: File Excel */}
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">File Excel hiện tại</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold text-slate-100 truncate">
              {excelData ? excelData.fileName : 'Chưa tải file'}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {excelData ? `${excelData.totalRows} thủ tục • Sheet: ${excelData.selectedSheetName}` : 'Hỗ trợ định dạng XLS & XLSX'}
            </div>
          </div>
        </div>

        {/* Card 2: Mapping Status */}
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Dữ liệu sẵn sàng</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold text-slate-100">
              {mappingSummary ? `${mappingSummary.valid} / ${mappingSummary.total}` : '0 / 0'}
            </div>
            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
              {mappingSummary?.invalid ? (
                <span className="text-amber-400 font-medium">⚠️ {mappingSummary.invalid} dòng cần sửa</span>
              ) : (
                <span className="text-emerald-400">100% bản ghi hợp lệ</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Token Status */}
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Xác thực Bearer Token</span>
            <div className={`p-2 rounded-xl border ${
              tokenStatus?.hasToken && !tokenStatus.isExpired
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}>
              <KeyRound className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-xl font-bold text-slate-100 flex items-center gap-2">
              {tokenStatus?.hasToken ? (
                tokenStatus.isExpired ? (
                  <span className="text-amber-400 text-base">Đã hết hạn</span>
                ) : (
                  <span className="text-emerald-400 text-base">Đã kết nối</span>
                )
              ) : (
                <span className="text-slate-400 text-base">Chưa nhập</span>
              )}
            </div>
            <button
              onClick={onOpenTokenModal}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium mt-1 inline-flex items-center gap-1"
            >
              Cập nhật Token &rarr;
            </button>
          </div>
        </div>

        {/* Card 4: Gateway & Mode */}
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Cổng tiếp nhận API</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Server className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className="text-base font-bold text-slate-100 truncate">
              {settings?.mockMode ? 'Chế độ Mock (An toàn)' : 'VNPT C4 Gateway'}
            </div>
            <div className="text-xs text-slate-400 mt-0.5 truncate font-mono">
              {settings?.mockMode ? 'Mô phỏng phản hồi 200/400' : 'ilis-gateway-c4.vnpt.vn'}
            </div>
          </div>
        </div>
      </div>

      {/* Step-by-Step Workflow Guide */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
          Quy trình Thực hiện Nhập dữ liệu
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Step 1 */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
              <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center text-xs font-bold">
                1
              </div>
              <h4 className="text-sm font-semibold text-slate-200">Chọn file Excel</h4>
              <p className="text-xs text-slate-400">
                Tải lên file XLS/XLSX hoặc chọn file mẫu có sẵn trong thư mục làm việc.
              </p>
            </div>
            <button
              onClick={() => onNavigate('excel')}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1 pt-2"
            >
              Mở Import Excel &rarr;
            </button>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center text-xs font-bold">
                2
              </div>
              <h4 className="text-sm font-semibold text-slate-200">Khớp trường & Lĩnh vực</h4>
              <p className="text-xs text-slate-400">
                Kiểm tra ánh xạ cột Excel với trường API ILIS và gán GUID cho các Lĩnh vực.
              </p>
            </div>
            <button
              onClick={() => onNavigate('mapping')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1 pt-2"
            >
              Cấu hình Mapping &rarr;
            </button>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
              <div className="w-7 h-7 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center text-xs font-bold">
                3
              </div>
              <h4 className="text-sm font-semibold text-slate-200">Dry Run & Test 1 dòng</h4>
              <p className="text-xs text-slate-400">
                Chạy thử nghiệm không gửi dữ liệu hoặc gửi thử 1 bản ghi với hộp thoại xác nhận.
              </p>
            </div>
            <button
              onClick={() => onNavigate('execution')}
              className="text-xs text-purple-400 hover:text-purple-300 font-medium inline-flex items-center gap-1 pt-2"
            >
              Kiểm tra & Dry Run &rarr;
            </button>
          </div>

          {/* Step 4 */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xs font-bold">
                4
              </div>
              <h4 className="text-sm font-semibold text-slate-200">Import & Xuất báo cáo</h4>
              <p className="text-xs text-slate-400">
                Theo dõi tiến trình realtime, xử lý lỗi tự động và tải file báo cáo Excel kết quả.
              </p>
            </div>
            <button
              onClick={() => onNavigate('history')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1 pt-2"
            >
              Xem báo cáo &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Quick sample files in workspace */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-slate-200">File Excel thực tế có sẵn trong thư mục</h3>
            <p className="text-xs text-slate-400">Bấm để tải nhanh và kiểm thử ngay lập tức</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-8 h-8 text-emerald-400" />
              <div>
                <div className="text-sm font-semibold text-slate-200">30_10_danhsachthutuc.xls</div>
                <div className="text-xs text-slate-400">35 thủ tục • Lĩnh vực: Đất đai (Sở Nông nghiệp & Môi trường)</div>
              </div>
            </div>
            <button
              onClick={() => onLoadSample('30_10_danhsachthutuc.xls')}
              className="px-3.5 py-1.5 text-xs font-medium bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border border-blue-500/30 rounded-xl transition"
            >
              Tải file này
            </button>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-8 h-8 text-emerald-400" />
              <div>
                <div className="text-sm font-semibold text-slate-200">30_10_danhsachthutuc (1).xls</div>
                <div className="text-xs text-slate-400">5 thủ tục • Lĩnh vực: Đăng ký biện pháp bảo đảm</div>
              </div>
            </div>
            <button
              onClick={() => onLoadSample('30_10_danhsachthutuc (1).xls')}
              className="px-3.5 py-1.5 text-xs font-medium bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border border-blue-500/30 rounded-xl transition"
            >
              Tải file này
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
