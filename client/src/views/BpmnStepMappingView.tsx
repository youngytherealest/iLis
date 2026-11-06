import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, RefreshCw, Send, ShieldAlert, XCircle } from 'lucide-react';
import { api } from '../services/api';
import { BpmnStepMappingCheckResponse, BpmnStepMappingProcess, TokenStatus } from '../types';

interface BpmnStepMappingViewProps {
  tokenStatus: TokenStatus | null;
  onOpenTokenModal: () => void;
}

function statusText(item: BpmnStepMappingProcess) {
  if (!item.isActive) return 'Không hoạt động';
  if (item.fileStatus !== 'VALID') return item.validationMessage || item.fileStatus;
  if (item.dvcStatus !== 'FOUND') return 'Chưa có đối chiếu DVC';
  return 'Sẵn sàng';
}

function resultClass(status?: string) {
  if (!status) return 'text-slate-400';
  if (['UPDATED', 'CREATED', 'DRY_RUN_OK'].includes(status)) return 'text-emerald-300';
  if (status.startsWith('SKIPPED')) return 'text-amber-300';
  return 'text-red-300';
}

export const BpmnStepMappingView: React.FC<BpmnStepMappingViewProps> = ({ tokenStatus, onOpenTokenModal }) => {
  const [checkResult, setCheckResult] = useState<BpmnStepMappingCheckResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isMapping, setIsMapping] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const visibleProcesses = useMemo(() => {
    const value = search.trim().toLocaleLowerCase('vi-VN');
    if (!value) return checkResult?.processes || [];
    return (checkResult?.processes || []).filter(item => `${item.maQuyTrinh} ${item.tenQuyTrinh} ${item.id}`.toLocaleLowerCase('vi-VN').includes(value));
  }, [checkResult, search]);

  const eligibleIds = useMemo(() => (checkResult?.processes || []).filter(item => item.eligible).map(item => item.id), [checkResult]);

  async function handleCheck() {
    setIsChecking(true);
    setError('');
    setNotice('');
    try {
      const result = await api.checkBpmnStepMappings();
      setCheckResult(result);
      setSelectedIds(result.processes.filter(item => item.eligible).map(item => item.id));
      setNotice(`Đã kiểm tra ${result.summary.total} quy trình; ${result.summary.eligible} quy trình đủ điều kiện.`);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Không kiểm tra được danh sách quy trình.');
    } finally {
      setIsChecking(false);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  }

  async function handleMap() {
    if (!checkResult || selectedIds.length === 0) return;
    setIsMapping(true);
    setError('');
    setNotice('');
    let success = 0;
    let failed = 0;
    const results = new Map<string, BpmnStepMappingProcess['result']>();
    for (const processId of selectedIds) {
      const result = await api.mapOneBpmnProcess(checkResult.runId, processId, dryRun);
      results.set(processId, result);
      if (['UPDATED', 'CREATED', 'DRY_RUN_OK'].includes(result.status)) success += 1;
      else failed += 1;
    }
    setCheckResult(current => current ? {
      ...current,
      processes: current.processes.map(item => results.has(item.id) ? { ...item, mapStatus: results.get(item.id)?.status || 'ERROR', result: results.get(item.id) } : item)
    } : current);
    setNotice(`${dryRun ? 'Dry-run' : 'Mapping'} hoàn tất: ${success} thành công, ${failed} lỗi/bỏ qua. Các quy trình lỗi được giữ lại để kiểm tra riêng.`);
    setIsMapping(false);
  }

  return (
    <div className="min-h-full space-y-6 p-6 text-slate-100">
      <section className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/40 to-slate-900/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs text-violet-200"><FileSpreadsheet className="h-4 w-4" /> Tích hợp tool map bước</div>
            <h1 className="text-2xl font-bold text-white">Mapping bước BPMN hàng loạt</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Kiểm tra file BPMN, lấy các userTask có mã Activity_*, đối chiếu tên bước với catalog Excel và lưu vào MapDanhMucDvc theo từng quy trình.</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className={`rounded-full border px-3 py-2 ${tokenStatus?.hasToken ? 'border-emerald-500/30 text-emerald-300' : 'border-amber-500/30 text-amber-300'}`}>
              {tokenStatus?.hasToken ? 'Đã có Bearer Token' : 'Chưa có Bearer Token'}
            </span>
            {!tokenStatus?.hasToken && <button onClick={onOpenTokenModal} className="rounded-lg border border-amber-500/40 px-3 py-2 text-amber-200 hover:bg-amber-500/10">Cập nhật token</button>}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button onClick={handleCheck} disabled={isChecking} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50">
            {isChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Kiểm tra lại quy trình
          </button>
          <label className="inline-flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={dryRun} onChange={event => setDryRun(event.target.checked)} /> Chỉ dry-run, không ghi API</label>
          <button onClick={handleMap} disabled={!checkResult || selectedIds.length === 0 || isMapping} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
            {isMapping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {dryRun ? 'Dry-run bước đã chọn' : 'Map bước đã chọn'} ({selectedIds.length})
          </button>
        </div>
      </section>

      {error && <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" /> {error}</div>}
      {notice && <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> {notice}</div>}

      {checkResult && <>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {[
            ['Tổng quy trình', checkResult.summary.total, 'text-white'],
            ['Đang hoạt động', checkResult.summary.active, 'text-blue-300'],
            ['Đủ điều kiện', checkResult.summary.eligible, 'text-emerald-300'],
            ['BPMN hợp lệ', checkResult.summary.validBpmn, 'text-cyan-300'],
            ['Có đối chiếu DVC', checkResult.summary.dvcMatched, 'text-violet-300'],
            ['Catalog / bổ sung', `${checkResult.summary.catalogCount} / ${checkResult.summary.overrideCount}`, 'text-amber-300']
          ].map(([label, value, color]) => <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"><div className="text-xs text-slate-500">{label}</div><div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div></div>)}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-5">
            <div><h2 className="font-semibold text-white">Danh sách quy trình BPMN</h2><p className="mt-1 text-xs text-slate-500">File cấu hình: {checkResult.summary.configFile}. Quy trình lỗi được xử lý độc lập, không làm dừng các quy trình còn lại.</p></div>
            <div className="flex items-center gap-2"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm mã, tên, id..." className="w-64 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-violet-500" /><button onClick={() => setSelectedIds(selectedIds.length === eligibleIds.length ? [] : eligibleIds)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800">{selectedIds.length === eligibleIds.length ? 'Bỏ chọn đủ điều kiện' : 'Chọn đủ điều kiện'}</button></div>
          </div>
          <div className="max-h-[640px] overflow-auto">
            <table className="w-full min-w-[1100px] text-left text-xs">
              <thead className="sticky top-0 bg-slate-950 text-slate-400"><tr><th className="px-4 py-3">Chọn</th><th className="px-4 py-3">Mã quy trình</th><th className="px-4 py-3">Tên / id LPM</th><th className="px-4 py-3">BPMN</th><th className="px-4 py-3">DVC đối chiếu</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Kết quả</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {visibleProcesses.map(item => <tr key={item.id} className={item.eligible ? 'bg-slate-950/20' : 'bg-red-500/[0.025]'}>
                  <td className="px-4 py-3"><input type="checkbox" checked={selectedIds.includes(item.id)} disabled={!item.eligible || isMapping} onChange={() => toggleSelected(item.id)} /></td>
                  <td className="px-4 py-3 font-mono text-blue-300">{item.maQuyTrinh}</td>
                  <td className="max-w-[360px] px-4 py-3"><div className="truncate text-slate-200" title={item.tenQuyTrinh}>{item.tenQuyTrinh || '—'}</div><div className="mt-1 font-mono text-[10px] text-slate-500">{item.id}</div></td>
                  <td className="px-4 py-3"><span className={item.fileStatus === 'VALID' ? 'text-emerald-300' : 'text-red-300'}>{item.fileStatus}</span><span className="ml-2 text-slate-500">{item.taskCount} bước</span></td>
                  <td className="px-4 py-3 font-mono text-[10px] text-slate-400">{item.dvcStatus === 'FOUND' ? `${item.idQuyTrinhDvc} / ${item.idThuTucDvc}` : '—'}</td>
                  <td className="px-4 py-3">{item.eligible ? <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="h-4 w-4" /> {statusText(item)}</span> : <span className="inline-flex items-center gap-1 text-amber-300"><AlertCircle className="h-4 w-4" /> {statusText(item)}</span>}</td>
                  <td className={`max-w-[300px] px-4 py-3 ${resultClass(item.result?.status)}`}><div>{item.result?.status || 'Chưa chạy'}</div><div className="truncate text-[10px]" title={item.result?.message}>{item.result?.message || ''}</div></td>
                </tr>)}
              </tbody>
            </table>
            {visibleProcesses.length === 0 && <div className="p-10 text-center text-sm text-slate-500"><XCircle className="mx-auto mb-2 h-6 w-6" />Không có quy trình phù hợp.</div>}
          </div>
        </section>
      </>}
      {!checkResult && <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 p-14 text-center text-sm text-slate-500">Bấm “Kiểm tra lại quy trình” để tải danh sách BPMN và đối chiếu bước với Excel.</div>}
    </div>
  );
};
