import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Rocket, ShieldAlert, XCircle } from 'lucide-react';
import { api } from '../services/api';
import { ProcedureCatalogItem, ProcedureDeployResult, TokenStatus } from '../types';

interface ProcedureDeployViewProps {
  tokenStatus: TokenStatus | null;
  onOpenTokenModal: () => void;
}

function getConstraintDetail(result: ProcedureDeployResult) {
  const detail = result.data?.chiTietLoi;
  if (!detail) return null;
  return detail as {
    maLoi?: string;
    traceId?: string;
    loai?: string;
    viTri?: string;
  };
}

export const ProcedureDeployView: React.FC<ProcedureDeployViewProps> = ({
  tokenStatus,
  onOpenTokenModal
}) => {
  const [catalog, setCatalog] = useState<ProcedureCatalogItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [results, setResults] = useState<Record<string, ProcedureDeployResult>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDeploying, setIsDeploying] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.getProcedureCatalog()
      .then(response => {
        const items = response.items || [];
        setCatalog(items);
        setSelectedIds(items.map(item => item.id));
      })
      .catch(err => setError(err?.response?.data?.error || err?.message || 'Không tải được danh sách quy trình.'))
      .finally(() => setIsLoading(false));
  }, []);

  const selectedCount = selectedIds.length;
  const successCount = useMemo(
    () => Object.values(results).filter(result => result.success).length,
    [results]
  );
  const failedCount = useMemo(
    () => Object.values(results).filter(result => !result.success).length,
    [results]
  );

  const toggleSelected = (id: string) => {
    setSelectedIds(previous => previous.includes(id)
      ? previous.filter(item => item !== id)
      : [...previous, id]);
  };

  const toggleAll = () => {
    setSelectedIds(previous => previous.length === catalog.length ? [] : catalog.map(item => item.id));
  };

  const deploySelected = async () => {
    if (selectedIds.length === 0) {
      setError('Hãy chọn ít nhất một quy trình để áp dụng.');
      return;
    }
    if (!tokenStatus?.hasToken) {
      setError('Cần nhập Bearer Token trước khi áp dụng quy trình.');
      onOpenTokenModal();
      return;
    }
    if (!window.confirm(`Sẽ áp dụng ${selectedIds.length} quy trình lên ILIS. Tiếp tục?`)) return;

    setIsDeploying(true);
    setError('');
    setResults({});
    const nextResults: Record<string, ProcedureDeployResult> = {};
    try {
      for (let index = 0; index < selectedIds.length; index++) {
        const id = selectedIds[index];
        setProgress(`Đang áp dụng ${index + 1}/${selectedIds.length}...`);
        const result = await api.deployProcedure(id);
        nextResults[id] = result;
        setResults({ ...nextResults });
        if (result.httpStatus === 401) {
          setError('Token không hợp lệ hoặc đã hết hạn. Tiến trình đã dừng.');
          break;
        }
      }
      setProgress(`Đã xử lý ${Object.keys(nextResults).length}/${selectedIds.length} quy trình.`);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Lỗi áp dụng quy trình.');
      setProgress('');
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1700px] space-y-6 p-6 lg:p-8">
      <section className="rounded-2xl border border-cyan-900/70 bg-gradient-to-br from-cyan-950/50 to-slate-950 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-300">
              <Rocket className="h-4 w-4" />
              ILIS LPM • Activiti Deploy
            </div>
            <h1 className="mt-4 text-2xl font-bold text-white">Áp dụng quy trình hàng loạt</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
              Gửi lần lượt từng <code className="rounded bg-slate-900 px-1 text-cyan-300">idQuyTrinh</code> tới API DeployProcess và hiển thị chi tiết ràng buộc nếu iLis từ chối.
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            <div className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4" /> Gửi API thật</div>
            <div className="mt-1 text-amber-100/70">Mỗi quy trình có kết quả riêng.</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ['Tổng catalog', String(catalog.length), 'text-slate-100'],
          ['Đã chọn', String(selectedCount), 'text-cyan-300'],
          ['Thành công', String(successCount), 'text-emerald-300'],
          ['Bị từ chối / lỗi', String(failedCount), 'text-red-300']
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
      {progress && <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-200">{progress}</div>}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-white">Danh sách quy trình áp dụng</h2>
            <p className="mt-1 text-xs text-slate-500">Có thể chọn một, nhiều hoặc toàn bộ 68 quy trình.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={toggleAll}
              disabled={isLoading || isDeploying || catalog.length === 0}
              className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              {selectedIds.length === catalog.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
            <button
              onClick={deploySelected}
              disabled={isLoading || isDeploying || selectedCount === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              Áp dụng {selectedCount} quy trình
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-8 text-center text-sm text-slate-500">Đang tải catalog...</div>
        ) : (
          <div className="mt-4 max-h-[650px] overflow-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[1100px] text-left text-xs">
              <thead className="sticky top-0 bg-slate-950 text-slate-400">
                <tr>
                  <th className="w-12 px-4 py-3">
                    <input type="checkbox" checked={selectedIds.length === catalog.length && catalog.length > 0} onChange={toggleAll} />
                  </th>
                  <th className="px-4 py-3">Mã quy trình</th>
                  <th className="px-4 py-3">idQuyTrinh</th>
                  <th className="px-4 py-3">Trạng thái áp dụng</th>
                  <th className="px-4 py-3">Chi tiết ràng buộc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {catalog.map(item => {
                  const result = results[item.id];
                  const detail = result ? getConstraintDetail(result) : null;
                  return (
                    <tr key={item.id} className={result?.success ? 'bg-emerald-500/[0.03]' : result ? 'bg-red-500/[0.04]' : 'bg-slate-950/20'}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelected(item.id)} disabled={isDeploying} />
                      </td>
                      <td className="px-4 py-3 font-mono text-cyan-300">{item.maQuyTrinh}</td>
                      <td className="px-4 py-3 font-mono text-[10px] text-slate-300">{item.id}</td>
                      <td className="px-4 py-3">
                        {!result && <span className="text-slate-500">Chưa áp dụng</span>}
                        {result?.success && <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Thành công</span>}
                        {result && !result.success && <span className="inline-flex items-center gap-1 text-red-300"><XCircle className="h-4 w-4" /> Lỗi HTTP {result.httpStatus}</span>}
                      </td>
                      <td className="max-w-[560px] px-4 py-3">
                        {result && !result.success ? (
                          <div className="space-y-1 text-red-200">
                            <div className="font-medium">{result.message}</div>
                            {detail && (
                              <div className="space-y-0.5 text-[10px] text-red-200/75">
                                <div>Mã lỗi: {detail.maLoi || '—'} • Loại: {detail.loai || '—'}</div>
                                <div>TraceId: <span className="font-mono">{detail.traceId || '—'}</span></div>
                                <div>Vị trí: {detail.viTri || '—'}</div>
                              </div>
                            )}
                          </div>
                        ) : result?.success ? (
                          <span className="text-emerald-300/80">{result.message}</span>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
