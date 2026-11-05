import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, CheckCircle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  type: 'single' | 'bulk';
  targetInfo: {
    totalRecords?: number;
    procedureCode?: string;
    procedureName?: string;
    gatewayUrl?: string;
    isMock?: boolean;
    delayMs?: number;
  };
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  type,
  targetInfo
}) => {
  const [agreed, setAgreed] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!agreed && !targetInfo.isMock) return;
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${
              targetInfo.isMock ? 'bg-blue-500/10 text-blue-400' : 'bg-amber-500/10 text-amber-400'
            }`}>
              {targetInfo.isMock ? <CheckCircle className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-base">{title}</h3>
              <p className="text-xs text-slate-400">
                {targetInfo.isMock ? 'Chế độ mô phỏng an toàn (MOCK API)' : 'Hệ thống thật ILIS LPM Gateway'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300">
            {type === 'single' ? (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-400">Mã thủ tục:</span>
                  <span className="font-mono font-medium text-blue-400">{targetInfo.procedureCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tên thủ tục:</span>
                  <span className="font-medium text-slate-200 text-right max-w-[280px] truncate">{targetInfo.procedureName}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-400">Số lượng thủ tục sẽ import:</span>
                  <span className="font-semibold text-emerald-400 text-sm">{targetInfo.totalRecords} thủ tục</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Khoảng nghỉ giữa các request:</span>
                  <span className="font-mono text-slate-200">{targetInfo.delayMs || 500} ms</span>
                </div>
              </>
            )}

            <div className="flex justify-between border-t border-slate-800/80 pt-2">
              <span className="text-slate-400">Cổng tiếp nhận:</span>
              <span className="font-mono text-xs text-slate-400 truncate max-w-[280px]">
                {targetInfo.isMock ? 'Local Mock Simulator' : targetInfo.gatewayUrl}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Quy định mức độ:</span>
              <span className="font-semibold text-amber-400">Mức độ 3 (Cố định 100%)</span>
            </div>
          </div>

          {!targetInfo.isMock ? (
            <div className="p-3.5 bg-red-950/20 border border-red-800/40 rounded-xl flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs text-red-300 space-y-1">
                <div className="font-semibold text-red-200">Cảnh báo ghi dữ liệu thực tế!</div>
                <div>
                  Hành động này sẽ gửi HTTP POST trực tiếp tới cổng ILIS VNPT. Dữ liệu sẽ được ghi trực tiếp vào cơ sở dữ liệu hệ thống.
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-blue-950/20 border border-blue-800/40 rounded-xl text-xs text-blue-300">
              Đang ở chế độ <strong className="text-blue-200">Mô phỏng (Mock Mode)</strong>. Yêu cầu này sẽ được kiểm tra cấu trúc và phản hồi mô phỏng, không làm thay đổi dữ liệu thật trên ILIS.
            </div>
          )}

          {!targetInfo.isMock && (
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-slate-900 border-slate-700"
              />
              <span className="text-xs text-slate-200 font-medium select-none">
                Tôi đã kiểm tra kỹ thông tin và xác nhận gửi dữ liệu lên hệ thống ILIS.
              </span>
            </label>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded-xl transition"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              disabled={!targetInfo.isMock && !agreed}
              onClick={handleConfirm}
              className={`px-5 py-2 text-xs font-semibold rounded-xl shadow-lg transition flex items-center gap-1.5 ${
                targetInfo.isMock
                  ? 'bg-blue-600 hover:bg-blue-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white shadow-emerald-600/20'
              }`}
            >
              {type === 'single' ? 'Xác nhận gửi 1 bản ghi' : 'Xác nhận Bắt đầu Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
