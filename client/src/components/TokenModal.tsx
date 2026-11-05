import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, ShieldCheck, AlertCircle, X, CheckCircle2, Trash2 } from 'lucide-react';
import { TokenStatus } from '../types';

interface TokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenStatus: TokenStatus | null;
  onSaveToken: (token: string) => Promise<void>;
  onClearToken: () => Promise<void>;
}

export const TokenModal: React.FC<TokenModalProps> = ({
  isOpen,
  onClose,
  tokenStatus,
  onSaveToken,
  onClearToken
}) => {
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setError('Vui lòng nhập chuỗi Bearer Token.');
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await onSaveToken(tokenInput.trim());
      setSuccessMsg('Đã lưu token thành công vào bộ nhớ phiên!');
      setTokenInput('');
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Lỗi khi lưu token.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    if (confirm('Bạn có chắc chắn muốn xóa Token khỏi bộ nhớ tạm?')) {
      await onClearToken();
      setTokenInput('');
      setSuccessMsg('Đã xóa token.');
      setTimeout(() => setSuccessMsg(null), 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-slate-100">Xác thực Bearer Token (ILIS LPM)</h3>
              <p className="text-xs text-slate-400">Quản lý phiên xác thực kết nối VNPT API Gateway</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Status Banner */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border bg-slate-950/50 border-slate-800">
            <div className="flex items-center gap-3">
              {tokenStatus?.hasToken ? (
                tokenStatus.isExpired ? (
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                )
              ) : (
                <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
                  <AlertCircle className="w-5 h-5" />
                </div>
              )}
              <div>
                <div className="text-sm font-medium text-slate-200">
                  {tokenStatus?.hasToken
                    ? tokenStatus.isExpired
                      ? 'Token đã hết hạn!'
                      : 'Đã có Token hợp lệ trong RAM'
                    : 'Chưa có Token xác thực'}
                </div>
                <div className="text-xs text-slate-400">
                  {tokenStatus?.hasToken ? (
                    <>
                      Xem trước: <code className="text-blue-400">{tokenStatus.preview}</code> ({tokenStatus.length} ký tự)
                      {tokenStatus.expTime && ` • Hạn: ${new Date(tokenStatus.expTime).toLocaleTimeString('vi-VN')}`}
                    </>
                  ) : (
                    'Cần nhập Token từ phiên đăng nhập trình duyệt để gửi API thật.'
                  )}
                </div>
              </div>
            </div>

            {tokenStatus?.hasToken && (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 px-2.5 py-1.5 rounded-lg border border-red-500/20 flex items-center gap-1.5 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Xóa
              </button>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Nhập Bearer Token ( DevTools -&gt; Network -&gt; Authorization: Bearer ... )
              </label>
              <div className="relative">
                <textarea
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Dán chuỗi token bắt đầu bằng eyJ... hoặc Bearer eyJ..."
                  rows={4}
                  className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 ${
                    !showToken ? 'font-mono' : ''
                  }`}
                  style={{
                    ['WebkitTextSecurity' as any]: showToken ? 'none' : 'disc'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 p-1 rounded-md bg-slate-900 border border-slate-700/60"
                  title={showToken ? 'Ẩn token' : 'Hiện token'}
                >
                  {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Instruction Callout */}
            <div className="p-3.5 bg-blue-950/30 border border-blue-800/40 rounded-xl text-xs space-y-1.5 text-blue-300">
              <div className="font-semibold flex items-center gap-1.5 text-blue-200">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                Chính sách an toàn & Bảo mật:
              </div>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-300 text-[11px]">
                <li>Token chỉ lưu trong bộ nhớ RAM của tiến trình backend và tự xóa khi tắt tool.</li>
                <li>Tuyệt đối KHÔNG lưu vào ổ cứng, file cấu hình, Git hay file Excel kết quả.</li>
                <li>Chỉ được sử dụng gửi tới API ILIS Gateway đã cấu hình.</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded-xl transition"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={isSaving || !tokenInput.trim()}
                className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl shadow-lg shadow-blue-600/20 transition flex items-center gap-1.5"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu Token vào phiên'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
