import React from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  SlidersHorizontal,
  PlaySquare,
  UploadCloud,
  Clock3,
  Rocket,
  History,
  Settings,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  GitCompareArrows
} from 'lucide-react';

export type TabId = 'dashboard' | 'excel' | 'procedure' | 'procedureTiming' | 'procedureDeploy' | 'dvcProcedureMapping' | 'mapping' | 'execution' | 'history' | 'settings';

interface SidebarProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  hasFile: boolean;
  totalRecords: number;
  mappingValidCount: number;
  isImportRunning: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  hasFile,
  totalRecords,
  mappingValidCount,
  isImportRunning
}) => {
  const navItems: Array<{
    id: TabId;
    label: string;
    sublabel: string;
    icon: React.ElementType;
    badge?: string | number | null;
    badgeColor?: string;
  }> = [
    {
      id: 'dashboard',
      label: 'Tổng quan',
      sublabel: 'Dashboard chỉ số',
      icon: LayoutDashboard
    },
    {
      id: 'excel',
      label: 'Import Excel',
      sublabel: 'Tải file & Xem trước',
      icon: FileSpreadsheet,
      badge: hasFile ? `${totalRecords} dòng` : null,
      badgeColor: 'bg-emerald-500/20 text-emerald-300'
    },
    {
      id: 'procedure',
      label: 'Cập nhật Quy trình',
      sublabel: 'Chọn folder & gửi file BPMN',
      icon: UploadCloud,
      badge: '68 ID',
      badgeColor: 'bg-violet-500/20 text-violet-300'
    },
    {
      id: 'procedureTiming',
      label: 'Cập nhật thời gian',
      sublabel: 'Excel & thời gian các bước',
      icon: Clock3,
      badge: '68 ID',
      badgeColor: 'bg-amber-500/20 text-amber-300'
    },
    {
      id: 'procedureDeploy',
      label: 'Áp dụng quy trình',
      sublabel: 'Deploy Activiti hàng loạt',
      icon: Rocket,
      badge: '68 ID',
      badgeColor: 'bg-cyan-500/20 text-cyan-300'
    },
    {
      id: 'dvcProcedureMapping',
      label: 'Mapping DVC - LPM',
      sublabel: 'Khớp danh sách thủ tục',
      icon: GitCompareArrows,
      badgeColor: 'bg-fuchsia-500/20 text-fuchsia-300'
    },
    {
      id: 'mapping',
      label: 'Mapping dữ liệu',
      sublabel: 'Khớp trường & Lĩnh vực',
      icon: SlidersHorizontal,
      badge: hasFile ? `${mappingValidCount}/${totalRecords}` : null,
      badgeColor: mappingValidCount === totalRecords && totalRecords > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
    },
    {
      id: 'execution',
      label: 'Tiến trình & Thực thi',
      sublabel: 'Dry Run, Test & Import',
      icon: PlaySquare,
      badge: isImportRunning ? 'Đang chạy' : null,
      badgeColor: 'bg-blue-500/30 text-blue-300 animate-pulse'
    },
    {
      id: 'history',
      label: 'Lịch sử & Báo cáo',
      sublabel: 'Xuất file kết quả Excel',
      icon: History
    },
    {
      id: 'settings',
      label: 'Cấu hình API',
      sublabel: 'Gateway & Lĩnh vực',
      icon: Settings
    }
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-950/70 flex flex-col justify-between shrink-0 select-none">
      <div className="p-4 space-y-6">
        {/* Navigation list */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-left transition ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-xs font-semibold leading-tight">{item.label}</div>
                    <div className="text-[10px] text-slate-500">{item.sublabel}</div>
                  </div>
                </div>

                {item.badge && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${item.badgeColor || 'bg-slate-800 text-slate-300'}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Mandatory Level 3 Notice Box */}
      <div className="p-4 border-t border-slate-800/80 space-y-3">
        <div className="p-3 bg-blue-950/30 border border-blue-900/50 rounded-xl space-y-1 text-xs text-blue-300">
          <div className="flex items-center gap-1.5 font-semibold text-blue-200 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            Quy định nghiệp vụ:
          </div>
          <div className="text-[11px] leading-relaxed text-slate-300">
            Tất cả TTHC import đều là <span className="font-semibold text-amber-300">Mức độ 3</span> (DVCTT một phần). Payload cố định <code className="bg-slate-900 px-1 py-0.5 rounded text-blue-300">mucDoThuTuc: 3</code>.
          </div>
        </div>

        <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
          <span>ILIS LPM v1.0.0</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> 127.0.0.1
          </span>
        </div>
      </div>
    </aside>
  );
};
