import React from 'react';
import { KeyRound, ShieldAlert, ShieldCheck, Globe, Database, FileSpreadsheet } from 'lucide-react';
import { TokenStatus, SystemSettings } from '../types';

interface HeaderProps {
  tokenStatus: TokenStatus | null;
  settings: SystemSettings | null;
  loadedFileName?: string | null;
  totalRecords?: number;
  onOpenTokenModal: () => void;
  onToggleMockMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  tokenStatus,
  settings,
  loadedFileName,
  totalRecords,
  onOpenTokenModal,
  onToggleMockMode
}) => {
  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Left: App Title and Sub-info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 flex items-center gap-2">
              ILIS LPM <span className="text-xs px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">Bulk Import</span>
            </h1>
            <p className="text-[11px] text-slate-400">Công cụ nhập hàng loạt TTHC VNPT ILIS C4 Gateway</p>
          </div>
        </div>

        {loadedFileName && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span className="font-medium text-slate-200">{loadedFileName}</span>
            <span className="text-slate-400">({totalRecords || 0} bản ghi)</span>
          </div>
        )}
      </div>

      {/* Right: Badges & Token Button */}
      <div className="flex items-center gap-3">
        {/* Gateway Endpoint Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 font-mono">
          <Globe className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-slate-300 truncate max-w-[200px]">ilis-gateway-c4.vnpt.vn</span>
        </div>

        {/* Mock Mode Switch */}
        <button
          onClick={onToggleMockMode}
          className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition ${
            settings?.mockMode
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
          }`}
          title="Bấm để chuyển đổi giữa Mock API và Live ILIS Gateway"
        >
          <span className={`w-2 h-2 rounded-full ${settings?.mockMode ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
          {settings?.mockMode ? 'Chế độ Mock (An toàn)' : 'Live API (Hệ thống thật)'}
        </button>

        {/* Token Management Trigger */}
        <button
          onClick={onOpenTokenModal}
          className={`px-3.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition ${
            tokenStatus?.hasToken
              ? tokenStatus.isExpired
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                : 'bg-blue-600/20 border-blue-500/40 text-blue-300 hover:bg-blue-600/30'
              : 'bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20'
          }`}
        >
          {tokenStatus?.hasToken ? (
            tokenStatus.isExpired ? (
              <ShieldAlert className="w-4 h-4 text-amber-400" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            )
          ) : (
            <KeyRound className="w-4 h-4 text-red-400" />
          )}

          <span>
            {tokenStatus?.hasToken
              ? tokenStatus.isExpired
                ? 'Token hết hạn'
                : `Token: ${tokenStatus.preview}`
              : 'Chưa có Token'}
          </span>
        </button>
      </div>
    </header>
  );
};
