import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, FileSpreadsheet, Loader2, RefreshCw, Send, ShieldAlert, XCircle } from 'lucide-react';
import { api } from '../services/api';
import { BpmnStepMappingCheckResponse, BpmnStepMappingProcess, ChecklistStepMapping, ProcedureStatusOption, ProcedureStep, ProcedureStepUpdateResult, ProcedureTimingParseResponse, ProcedureTimingSheet, TokenStatus } from '../types';
import { PROCESS_CODE_REFERENCES } from '../processCodeReference';

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

type StepInspectionRow = {
  processId: string;
  maQuyTrinh: string;
  tenQuyTrinh: string;
  step: ProcedureStep;
  error?: string;
};

function normalizeCode(value: string) {
  return String(value || '').trim().replace(/\s+/g, '').toUpperCase();
}

function collectionCount(step: ProcedureStep, keys: string[]) {
  return keys.reduce((total, key) => {
    const value = step[key];
    if (Array.isArray(value)) return total + value.length;
    if (value && typeof value === 'object') return total + 1;
    return total;
  }, 0);
}

function normalizeStepName(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTimingStepName(value: string) {
  return normalizeStepName(value)
    .replace(/^\d+(?:\.\d+)*[.)]?\s*/, '')
    .trim();
}

function getLeadingStepNumber(value: string) {
  const match = String(value || '').trim().match(/^(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function findTimingRowsForProcess(process: BpmnStepMappingProcess, timingSheets: ProcedureTimingSheet[]) {
  const legacyCodes = PROCESS_CODE_REFERENCES
    .filter(item => normalizeCode(item.maQtttIg) === normalizeCode(process.maQuyTrinh))
    .map(item => normalizeCode(item.maQuyTrinh));
  const acceptedCodes = new Set([normalizeCode(process.maQuyTrinh), ...legacyCodes]);
  return timingSheets
    .filter(sheet => acceptedCodes.has(normalizeCode(sheet.procedureCode))
      || (sheet.sourceProcedureCodes || []).some(code => acceptedCodes.has(normalizeCode(code))))
    .flatMap(sheet => sheet.timingRows);
}

function findTimingForStep(step: ProcedureStep, process: BpmnStepMappingProcess, timingSheets: ProcedureTimingSheet[]) {
  const rows = findTimingRowsForProcess(process, timingSheets);
  if (rows.length === 0) return undefined;
  const stepName = normalizeTimingStepName(step.tenBuoc);
  const apiStepNumber = getLeadingStepNumber(step.tenBuoc);
  if (apiStepNumber !== null) {
    const byNumber = rows.filter(row => row.stepNumbers.some(number => number === apiStepNumber));
    if (byNumber.length === 1) return byNumber[0];
  }
  const exact = rows.filter(row => normalizeTimingStepName(row.stepLabel) === stepName);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return undefined;
  const contains = rows.filter(row => {
    const excelName = normalizeTimingStepName(row.stepLabel);
    return excelName && (stepName.includes(excelName) || excelName.includes(stepName));
  });
  return contains.length === 1 ? contains[0] : undefined;
}

function applyStepConventions(step: ProcedureStep, process: BpmnStepMappingProcess, timingSheets: ProcedureTimingSheet[]) {
  const timing = findTimingForStep(step, process, timingSheets);
  return {
    ...step,
    idTrangThaiHoSo: 3,
    ...(timing?.duration.status === 'valid'
      ? {
          thoiGianThucHien: timing.duration.days,
          thoiGianThucHienTime: timing.duration.hours
        }
      : {})
  };
}

function canUseStepConfigurationFallback(result: { message?: string; httpStatus?: number }) {
  const message = String(result.message || '').toLowerCase();
  return result.httpStatus === 500 && message.includes('nullable object must have a value');
}

function getStepConfigsFromResult(result: { data?: any; items?: any[] }, step: ProcedureStep) {
  if (Array.isArray(result.data?.data)) return result.data.data;
  if (Array.isArray(result.items)) return result.items;
  return Array.isArray(step.cauHinhBuocs) ? step.cauHinhBuocs : [];
}

function getChecklistMapping(step: ProcedureStep, mappings: ChecklistStepMapping[]) {
  const name = normalizeStepName(step.tenBuoc);
  return mappings.find(item => item.normalizedTenBuoc === name);
}

function applyChecklistMapping(step: ProcedureStep, mappings: ChecklistStepMapping[], sourceConfigs?: any[]) {
  const mapping = getChecklistMapping(step, mappings);
  if (!mapping) {
    return { step, mapping, checklistIds: [] };
  }

  const selectedIds = new Set(mapping.checklistIds);
  const baseConfigs = Array.isArray(sourceConfigs)
    ? sourceConfigs
    : Array.isArray(step.cauHinhBuocs) && step.cauHinhBuocs.length > 0
    ? step.cauHinhBuocs
    : [];

  if (baseConfigs.length === 0) {
    return { step, mapping, checklistIds: mapping.checklistIds };
  }

  return {
    mapping,
    checklistIds: mapping.checklistIds,
    step: {
      ...step,
      cauHinhBuocs: baseConfigs.map((item: any) => {
        const idCauHinh = Number(item?.idCauHinh);
        if (!Number.isInteger(idCauHinh)) return item;
        return { ...item, suDung: selectedIds.has(idCauHinh) ? 1 : 0 };
      })
    }
  };
}

function stepChecklistText(step: ProcedureStep, mappings: ChecklistStepMapping[]) {
  const mapping = getChecklistMapping(step, mappings);
  if (mapping) return `ID: ${mapping.checklistIds.join('; ')}`;
  const count = collectionCount(step, ['cauHinhBuocs', 'fileDinhKems', 'ketQuaBuocs']);
  return count > 0 ? `${count} mục/cấu hình` : 'Chưa có dữ liệu';
}

export const BpmnStepMappingView: React.FC<BpmnStepMappingViewProps> = ({ tokenStatus, onOpenTokenModal }) => {
  const [checkResult, setCheckResult] = useState<BpmnStepMappingCheckResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isMapping, setIsMapping] = useState(false);
  const [workflowStatuses, setWorkflowStatuses] = useState<ProcedureStatusOption[]>([]);
  const [activeTab, setActiveTab] = useState<'mapping' | 'steps'>('mapping');
  const [stepRows, setStepRows] = useState<StepInspectionRow[]>([]);
  const [isLoadingSteps, setIsLoadingSteps] = useState(false);
  const [isConfiguringSteps, setIsConfiguringSteps] = useState(false);
  const [isTestingStep, setIsTestingStep] = useState(false);
  const [checklistMappings, setChecklistMappings] = useState<ChecklistStepMapping[]>([]);
  const [checklistFileName, setChecklistFileName] = useState('');
  const [testUpdatePassed, setTestUpdatePassed] = useState(false);
  const [stepUpdateResults, setStepUpdateResults] = useState<Record<string, ProcedureStepUpdateResult>>({});
  const [timingSheets, setTimingSheets] = useState<ProcedureTimingSheet[]>([]);
  const [timingFileName, setTimingFileName] = useState('');
  const [isLoadingTiming, setIsLoadingTiming] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!tokenStatus?.hasToken) return;
    api.getProcedureStatuses().then(result => {
      if (result.success) setWorkflowStatuses(result.items || []);
    });
  }, [tokenStatus?.hasToken]);

  useEffect(() => {
    api.getProcedureChecklists().then(result => {
      if (result.success) {
        setChecklistMappings(result.mappings || []);
        setChecklistFileName(result.fileName || 'Excel quy uoc checklist');
      } else {
        setError(result.message || 'Khong tai duoc quy uoc checklist.');
      }
    });
  }, []);

  useEffect(() => {
    api.getDefaultProcedureTimings().then(parsed => {
      if (!parsed.success || !parsed.sheets?.length) return;
      setTimingSheets(parsed.sheets);
      setTimingFileName(parsed.fileName || 'danh_sach_so_do_moi.xlsx');
      setStepRows(current => current.map(row => {
        if (row.error) return row;
        const process = {
          id: row.processId,
          maQuyTrinh: row.maQuyTrinh,
          tenQuyTrinh: row.tenQuyTrinh
        } as BpmnStepMappingProcess;
        return { ...row, step: applyStepConventions(row.step, process, parsed.sheets) };
      }));
    });
  }, []);

  const visibleProcesses = useMemo(() => {
    const value = search.trim().toLocaleLowerCase('vi-VN');
    if (!value) return checkResult?.processes || [];
    return (checkResult?.processes || []).filter(item => `${item.maQuyTrinh} ${item.tenQuyTrinh} ${item.id}`.toLocaleLowerCase('vi-VN').includes(value));
  }, [checkResult, search]);

  const eligibleIds = useMemo(() => (checkResult?.processes || []).filter(item => item.eligible).map(item => item.id), [checkResult]);
  const loadedProcessIds = useMemo(() => [...new Set(stepRows.map(row => row.processId))], [stepRows]);

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

  async function handleTimingFile(file?: File) {
    if (!file) return;
    setIsLoadingTiming(true);
    setError('');
    try {
      const parsed: ProcedureTimingParseResponse = await api.parseProcedureTimings(file);
      if (!parsed.success || !parsed.sheets?.length) {
        throw new Error('File Excel không có dữ liệu thời gian hợp lệ.');
      }
      setTimingSheets(parsed.sheets);
      setTimingFileName(parsed.fileName || file.name);
      setStepRows(current => current.map(row => {
        if (row.error) return row;
        const process = {
          id: row.processId,
          maQuyTrinh: row.maQuyTrinh,
          tenQuyTrinh: row.tenQuyTrinh
        } as BpmnStepMappingProcess;
        return { ...row, step: applyStepConventions(row.step, process, parsed.sheets) };
      }));
      const timingRowCount = parsed.sheets.reduce((total, sheet) => total + sheet.timingRows.length, 0);
      setNotice(`Đã đọc ${timingRowCount} dòng thời gian; các bước khớp sẽ dùng khối xử lý 3 - Xử lý.`);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Không đọc được file Excel thời gian.');
    } finally {
      setIsLoadingTiming(false);
    }
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

  async function handleLoadSteps() {
    if (!checkResult) return;
    const processIds = selectedIds.length > 0 ? selectedIds : eligibleIds;
    if (processIds.length === 0) return;
    setActiveTab('steps');
    setIsLoadingSteps(true);
    setError('');
    setNotice('');
    const processById = new Map(checkResult.processes.map(item => [item.id, item]));
    const rows: StepInspectionRow[] = [];
    let cursor = 0;
    const worker = async () => {
      while (cursor < processIds.length) {
        const processId = processIds[cursor++];
        const process = processById.get(processId);
        if (!process) continue;
        const result = await api.searchProcedureSteps(processId);
        if (result.success) {
          result.items.forEach(step => rows.push({
            processId,
            maQuyTrinh: process.maQuyTrinh,
            tenQuyTrinh: process.tenQuyTrinh,
            step: applyStepConventions(step, process, timingSheets)
          }));
        } else {
          rows.push({ processId, maQuyTrinh: process.maQuyTrinh, tenQuyTrinh: process.tenQuyTrinh, step: { id: '', idQuyTrinh: processId, maBuoc: '', tenBuoc: '' }, error: result.message });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, processIds.length) }, () => worker()));
    setStepRows(rows);
    setStepUpdateResults({});
    setTestUpdatePassed(false);
    setNotice(`Đã tải ${rows.filter(row => !row.error).length} bước từ ${processIds.length} quy trình.`);
    setIsLoadingSteps(false);
  }

  function updateManualTime(row: StepInspectionRow, field: 'thoiGianThucHien' | 'thoiGianThucHienTime', value: string) {
    const parsed = value.trim() === '' ? null : Number(value);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed))) return;
    setStepRows(current => current.map(item => {
      if (item.processId !== row.processId || item.step.id !== row.step.id) return item;
      return { ...item, step: { ...item.step, [field]: parsed } };
    }));
    setTestUpdatePassed(false);
  }

  async function handleTestOneStep() {
    if (!tokenStatus?.hasToken) {
      setError('Can nhap Bearer Token truoc khi thu cap nhat buoc.');
      onOpenTokenModal();
      return;
    }

    const candidate = stepRows.find(row => {
      if (row.error || !row.step.id) return false;
      const mapped = getChecklistMapping(row.step, checklistMappings);
      const hasTime = row.step.thoiGianThucHien !== null && row.step.thoiGianThucHien !== undefined
        && row.step.thoiGianThucHienTime !== null && row.step.thoiGianThucHienTime !== undefined;
      return Boolean(mapped && mapped.checklistIds.length > 0 && hasTime);
    }) || stepRows.find(row => {
      if (row.error || !row.step.id) return false;
      return row.step.thoiGianThucHien !== null && row.step.thoiGianThucHien !== undefined
        && row.step.thoiGianThucHienTime !== null && row.step.thoiGianThucHienTime !== undefined;
    });
    if (!candidate) {
      setError('Chua tim thay buoc co du thoi gian de thu cap nhat.');
      return;
    }

    setIsTestingStep(true);
    setError('');
    setNotice(`Dang tai cau hinh buoc "${candidate.step.tenBuoc}"...`);
    try {
      const configResult = await api.getStepConfigurations(candidate.step.id);
      const useConfigFallback = !configResult.success && canUseStepConfigurationFallback(configResult);
      if (!configResult.success && !useConfigFallback) {
        setTestUpdatePassed(false);
        setError(`Khong tai duoc cauHinhBuocs cua buoc ${candidate.step.id}: ${configResult.message || 'response.data rong'} (HTTP ${configResult.httpStatus})`);
        return;
      }
      const sourceConfigs = getStepConfigsFromResult(configResult, candidate.step);
      const configured = applyChecklistMapping(candidate.step, checklistMappings, sourceConfigs);
      setNotice(`${useConfigFallback ? 'API cauHinhBuocs loi nullable; dung cauHinhBuocs tu Buoc/Search.' : 'Da tai cauHinhBuocs.'} Dang thu cap nhat buoc "${candidate.step.tenBuoc}" voi checklist ${configured.checklistIds.join('; ')}...`);
      const testPayload = {
        ...configured.step,
        thoiGianThucHien: candidate.step.thoiGianThucHien,
        thoiGianThucHienTime: candidate.step.thoiGianThucHienTime,
        idTrangThaiHoSo: 3
      };
      const result = await api.updateProcedureSteps(candidate.processId, [testPayload]);
      if (!result.success) {
        setTestUpdatePassed(false);
        setError(`Thu cap nhat buoc that bai: ${result.message} (HTTP ${result.httpStatus})`);
        return;
      }
      setTestUpdatePassed(true);
      setNotice(`Thu cap nhat thanh cong buoc "${candidate.step.tenBuoc}". Co the chay cap nhat hang loat.`);
    } catch (err: any) {
      setTestUpdatePassed(false);
      setError(err?.response?.data?.error || err?.message || 'Loi thu cap nhat buoc.');
    } finally {
      setIsTestingStep(false);
    }
  }

  async function handleConfigureSteps() {
    if (!testUpdatePassed) {
      setError('Hãy thử cập nhật thành công một bước trước khi chạy hàng loạt.');
      return;
    }
    if (!tokenStatus?.hasToken) {
      setError('Can nhap Bearer Token truoc khi cap nhat cau hinh buoc.');
      onOpenTokenModal();
      return;
    }

    const stepsByProcess = new Map<string, ProcedureStep[]>();
    stepRows.forEach(row => {
      if (row.error || !row.step.id) return;
      const current = stepsByProcess.get(row.processId) || [];
      current.push(row.step);
      stepsByProcess.set(row.processId, current);
    });

    const entries = [...stepsByProcess.entries()];
    if (entries.length === 0) {
      setError('Chua co danh sach buoc hop le de cap nhat.');
      return;
    }
    const missingTimes = [...stepsByProcess.values()].flat().filter(step =>
      step.thoiGianThucHien === null || step.thoiGianThucHien === undefined
      || step.thoiGianThucHienTime === null || step.thoiGianThucHienTime === undefined
    );
    if (missingTimes.length > 0) {
      setError(`Con ${missingTimes.length} buoc chua co du thoi gian. Hay chon Excel thoi gian va kiem tra ten buoc truoc khi cap nhat.`);
      return;
    }

    setIsConfiguringSteps(true);
    setError('');
    setNotice('');
    setStepUpdateResults({});
    const results: Record<string, ProcedureStepUpdateResult> = {};
    let success = 0;
    let failed = 0;

    try {
      for (let index = 0; index < entries.length; index++) {
        const [processId, steps] = entries[index];
        setNotice(`Dang cap nhat cau hinh ${index + 1}/${entries.length} quy trinh...`);
        // Gui nguyen payload day du tu Buoc/Search, bao gom cauHinhBuocs/suDung.
        const configuredSteps: ProcedureStep[] = [];
        for (const step of steps) {
          const configResult = await api.getStepConfigurations(step.id);
          const useConfigFallback = !configResult.success && canUseStepConfigurationFallback(configResult);
          if (!configResult.success && !useConfigFallback) {
            throw new Error(`Buoc ${step.id}: khong tai duoc cauHinhBuocs (${configResult.message || 'response.data rong'}).`);
          }
          const sourceConfigs = getStepConfigsFromResult(configResult, step);
          const configured = applyChecklistMapping(step, checklistMappings, sourceConfigs).step;
          configuredSteps.push({
            ...configured,
            thoiGianThucHien: step.thoiGianThucHien,
            thoiGianThucHienTime: step.thoiGianThucHienTime,
            idTrangThaiHoSo: 3
          });
        }
        const result = await api.updateProcedureSteps(processId, configuredSteps);
        results[processId] = result;
        setStepUpdateResults({ ...results });
        if (result.success) success += 1;
        else failed += 1;
      }
      setNotice(`Da cap nhat ${success}/${entries.length} quy trinh; ${failed} quy trinh loi. Quy trinh loi duoc ghi rieng de kiem tra.`);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Loi cap nhat cau hinh buoc.');
    } finally {
      setIsConfiguringSteps(false);
    }
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
        <div className="flex items-center gap-2 border-b border-slate-800">
          <button onClick={() => setActiveTab('mapping')} className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === 'mapping' ? 'border-violet-400 text-violet-300' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Mapping BPMN</button>
          <button onClick={handleLoadSteps} className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === 'steps' ? 'border-violet-400 text-violet-300' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Danh sách bước theo quy trình</button>
        </div>

        {activeTab === 'mapping' && <>
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

        {activeTab === 'steps' && <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
          <div className="flex flex-wrap items-center justify-end gap-2 border-b border-slate-800 px-5 pt-5">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-amber-500/40 px-4 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/10">
              {isLoadingTiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              {timingFileName ? 'Đổi Excel thời gian' : 'Chọn Excel thời gian'}
              <input type="file" accept=".xlsx,.xls" className="hidden" disabled={isLoadingTiming} onChange={event => handleTimingFile(event.target.files?.[0])} />
            </label>
            <button onClick={handleTestOneStep} disabled={isLoadingSteps || isTestingStep || stepRows.length === 0 || !tokenStatus?.hasToken} className="mr-2 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50">
              {isTestingStep ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Thu 1 buoc
            </button>
            <button onClick={handleConfigureSteps} disabled={!testUpdatePassed || isLoadingSteps || isConfiguringSteps || loadedProcessIds.length === 0 || !tokenStatus?.hasToken} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
              {isConfiguringSteps ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Cap nhat cau hinh ({loadedProcessIds.length})
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-5">
            <div><h2 className="font-semibold text-white">Danh sách bước và cấu hình</h2><p className="mt-1 text-xs text-slate-500">Dữ liệu lấy trực tiếp từ `Buoc/Search`; đang tải {selectedIds.length || eligibleIds.length} quy trình. {timingFileName ? `Excel thời gian: ${timingFileName}` : 'Chưa chọn Excel thời gian.'}</p></div>
            <button onClick={handleLoadSteps} disabled={isLoadingSteps} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50">{isLoadingSteps ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Tải lại bước</button>
          </div>
          {isLoadingSteps ? <div className="p-12 text-center text-sm text-slate-400"><Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />Đang tải danh sách bước...</div> : stepRows.length === 0 ? <div className="p-12 text-center text-sm text-slate-500">Chưa có dữ liệu bước. Hãy chọn quy trình rồi tải bước.</div> : <div className="max-h-[680px] overflow-auto">
            <table className="w-full min-w-[1350px] text-left text-xs">
              <thead className="sticky top-0 bg-slate-950 text-slate-400"><tr><th className="px-4 py-3">Quy trình</th><th className="px-4 py-3">Bước LPM</th><th className="px-4 py-3">Thời gian</th><th className="px-4 py-3">Khối xử lý</th><th className="px-4 py-3">Checklist / cấu hình</th><th className="px-4 py-3">Tình trạng</th></tr></thead>
              <tbody className="divide-y divide-slate-800">{stepRows.map((row, index) => {
                const step = row.step;
                const hasTime = step.thoiGianThucHien !== null && step.thoiGianThucHien !== undefined
                  && step.thoiGianThucHienTime !== null && step.thoiGianThucHienTime !== undefined;
                const hasStatus = step.idTrangThaiHoSo === 3;
                // Checklist is optional for steps that do not have one. The
                // required configuration for this tab is duration + block 3.
                const complete = hasTime && hasStatus;
                const status = workflowStatuses.find(item => item.id === step.idTrangThaiHoSo);
                return <tr key={`${row.processId}:${step.id || index}`} className={row.error ? 'bg-red-500/[0.05]' : complete ? 'bg-emerald-500/[0.03]' : 'bg-amber-500/[0.04]'}>
                  <td className="px-4 py-3"><div className="font-mono text-blue-300">{row.maQuyTrinh}</div><div className="mt-1 max-w-[240px] truncate text-[10px] text-slate-500" title={row.tenQuyTrinh}>{row.processId}</div></td>
                  <td className="px-4 py-3"><div className="font-medium text-slate-200">{step.tenBuoc || 'Không tải được bước'}</div><div className="mt-1 font-mono text-[10px] text-slate-500">{step.maBuoc} • {step.id}</div></td>
                  <td className="px-4 py-3 font-mono text-amber-300">
                    {hasTime ? <>{step.thoiGianThucHien} ngày + {step.thoiGianThucHienTime} giờ</> : <div className="min-w-[220px]">
                      <div className="mb-1 text-[10px] text-amber-200/80">Nhập thủ công</div>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={step.thoiGianThucHien ?? ''}
                          onChange={event => updateManualTime(row, 'thoiGianThucHien', event.target.value)}
                          placeholder="Ngày"
                          aria-label={`Số ngày bước ${step.tenBuoc}`}
                          className="w-20 rounded border border-amber-500/50 bg-slate-950 px-2 py-1 text-xs text-amber-200 outline-none focus:border-amber-300"
                        />
                        <span className="text-slate-500">ngày +</span>
                        <input
                          type="number"
                          min="0"
                          max="7"
                          step="1"
                          value={step.thoiGianThucHienTime ?? ''}
                          onChange={event => updateManualTime(row, 'thoiGianThucHienTime', event.target.value)}
                          placeholder="Giờ"
                          aria-label={`Số giờ bước ${step.tenBuoc}`}
                          className="w-20 rounded border border-amber-500/50 bg-slate-950 px-2 py-1 text-xs text-amber-200 outline-none focus:border-amber-300"
                        />
                        <span className="text-slate-500">giờ</span>
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">Giờ từ 0 đến 7; 8 giờ được quy đổi thành 1 ngày.</div>
                    </div>}
                  </td>
                  <td className="px-4 py-3 text-cyan-300">{step.idTrangThaiHoSo ?? '—'}{step.idTrangThaiHoSo !== null && step.idTrangThaiHoSo !== undefined ? <div className="mt-1 text-[10px] text-cyan-200/70">{status?.tenTrangThaiHoSo || (step.idTrangThaiHoSo === 3 ? 'Xử lý' : 'Chưa có tên trạng thái')}</div> : null}</td>
                  <td className="px-4 py-3 text-slate-300"><div>{stepChecklistText(step, checklistMappings)}</div>{getChecklistMapping(step, checklistMappings) && <div className="mt-1 text-[10px] text-cyan-200/70">{checklistFileName}</div>}</td>
                  <td className="px-4 py-3">{row.error ? <span className="text-red-300">{row.error}</span> : complete ? <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Đủ cấu hình</span> : <span className="inline-flex items-center gap-1 text-amber-300"><AlertCircle className="h-4 w-4" /> Thiếu cấu hình</span>}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>}
        </section>}
      </>}
      {!checkResult && <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 p-14 text-center text-sm text-slate-500">Bấm “Kiểm tra lại quy trình” để tải danh sách BPMN và đối chiếu bước với Excel.</div>}
    </div>
  );
};
