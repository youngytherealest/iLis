import React, { useState } from 'react';
import {
  Settings,
  Server,
  ShieldCheck,
  Save,
  RotateCcw,
  KeyRound,
  CheckCircle2,
  Lock,
  Globe
} from 'lucide-react';
import { SystemSettings, TokenStatus } from '../types';

interface SettingsViewProps {
  settings: SystemSettings | null;
  tokenStatus: TokenStatus | null;
  onSaveSettings: (settings: Partial<SystemSettings>) => Promise<void>;
  onOpenTokenModal: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  tokenStatus,
  onSaveSettings,
  onOpenTokenModal
}) => {
  const [gatewayUrl, setGatewayUrl] = useState(settings?.gatewayUrl || 'https://ilis-gateway-c4.vnpt.vn');
  const [endpointPath, setEndpointPath] = useState(settings?.endpointPath || '/lpm/api/ThuTucManage/Add');
  const [delayMs, setDelayMs] = useState(settings?.delayMs || 500);
  const [mockMode, setMockMode] = useState(settings?.mockMode ?? true);
  const [laThuTucCapXa, setLaThuTucCapXa] = useState(settings?.laThuTucCapXa ?? true);
  const [thoiHanTraThongBaoThue, setThoiHanTraThongBaoThue] = useState(settings?.thoiHanTraThongBaoThue || '2');
  const [trangThai, setTrangThai] = useState(settings?.trangThai || 1);

  const [isSaved, setIsSaved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings({
      gatewayUrl,
      endpointPath,
      delayMs,
      mockMode,
      laThuTucCapXa,
      thoiHanTraThongBaoThue,
      trangThai
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleResetDefaults = () => {
    setGatewayUrl('https://ilis-gateway-c4.vnpt.vn');
    setEndpointPath('/lpm/api/ThuTucManage/Add');
    setDelayMs(500);
    setMockMode(true);
    setLaThuTucCapXa(true);
    setThoiHanTraThongBaoThue('2');
    setTrangThai(1);
  };

  return (
    <div className="p-8 space-y-8 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-blue-400" />
            Cấu hình Hệ thống & Kết nối API ILIS
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Thiết lập đường dẫn Gateway VNPT, chế độ Mock an toàn, tham số mặc định và chính sách bảo mật.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: API Endpoint Config */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-400" />
            1. Cổng Kết nối API Gateway (VNPT C4)
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                API Gateway URL
              </label>
              <input
                type="text"
                value={gatewayUrl}
                onChange={(e) => setGatewayUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-hidden focus:border-blue-500"
                placeholder="https://ilis-gateway-c4.vnpt.vn"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Endpoint tạo mới Thủ tục Hành chính (POST)
              </label>
              <input
                type="text"
                value={endpointPath}
                onChange={(e) => setEndpointPath(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono focus:outline-hidden focus:border-blue-500"
                placeholder="/lpm/api/ThuTucManage/Add"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Mock Mode & Concurrency Delay */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Server className="w-4 h-4 text-purple-400" />
            2. Chế độ Hoạt động & Giới hạn Tần suất (Rate Limiting)
          </h3>

          {/* Mock Mode Switch */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                Chế độ Mô phỏng (Mock API Simulation)
                <span className={`px-2 py-0.5 rounded text-[10px] ${
                  mockMode ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  {mockMode ? 'ĐANG BẬT' : 'TẮT'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Cho phép chạy thử nghiệm kiểm thử toàn bộ giao diện, Dry Run, và Import giả lập với phản hồi 200/400 giống hệt API thật mà không cần tài khoản VNPT hay Token thực tế.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
              <input
                type="checkbox"
                checked={mockMode}
                onChange={(e) => setMockMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          {/* Delay */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Khoảng cách nghỉ giữa 2 request (Delay ms)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={100}
                  max={5000}
                  step={50}
                  value={delayMs}
                  onChange={(e) => setDelayMs(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 font-mono"
                />
                <span className="text-xs text-slate-400">ms</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Mặc định: 500ms (Tránh quá tải và lỗi 429 Too Many Requests)</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Số luồng gửi đồng thời (Concurrency)
              </label>
              <input
                type="text"
                disabled
                value="1 (Tuần tự - Cố định an toàn)"
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-400 font-mono cursor-not-allowed"
              />
              <p className="text-[11px] text-slate-500 mt-1">Gửi tuần tự từng bản ghi để kiểm soát lỗi chính xác</p>
            </div>
          </div>
        </div>

        {/* Card 3: Security & Token summary */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            3. Xác thực Bearer Token & Cơ chế An toàn
          </h3>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-slate-200">
                Trạng thái Token: {tokenStatus?.hasToken ? <span className="text-emerald-400">Đã nạp ({tokenStatus.preview})</span> : <span className="text-slate-400">Chưa nạp</span>}
              </div>
              <div className="text-[11px] text-slate-400">
                Token chỉ lưu trong RAM backend trong phiên, không ghi đĩa hay xuất file.
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenTokenModal}
              className="px-4 py-1.5 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 border border-blue-500/30 rounded-xl text-xs font-medium transition flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Cập nhật Token
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-xl transition flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Khôi phục mặc định
          </button>

          <button
            type="submit"
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/20 transition flex items-center gap-2"
          >
            {isSaved ? <CheckCircle2 className="w-4 h-4 text-white" /> : <Save className="w-4 h-4" />}
            {isSaved ? 'Đã lưu cài đặt!' : 'Lưu Cài đặt'}
          </button>
        </div>
      </form>
    </div>
  );
};
