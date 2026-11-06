import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
  UploadCloud,
  XCircle
} from 'lucide-react';
import { api } from '../services/api';
import {
  ProcedureCatalogItem,
  ProcedureStep,
  ProcedureStepUpdateResult,
  ProcedureTimingParseResponse,
  ProcedureTimingRow,
  ProcedureTimingSheet,
  ProcedureStatusOption,
  TokenStatus
} from '../types';

type TimingSectionState = {
  key: string;
  title: string;
  timingRows: ProcedureTimingRow[];
  candidates: ProcedureCatalogItem[];
  selectedProcedureIds: string[];
};

type SheetState = ProcedureTimingSheet & {
  sections: TimingSectionState[];
};

type MappingStatus = 'matched' | 'ambiguous' | 'unmatched';

type StepLoadIssue = {
  index: number;
  total: number;
  procedureId: string;
  message: string;
  httpStatus: number;
};

type PendingUpdate = {
  payloadByProcedure: Map<string, ProcedureStep[]>;
  payloadStepCount: number;
  skippedDuplicateCount: number;
  skippedIncompleteProcedures: string[];
};

interface TimingMappingRow {
  key: string;
  sheetName: string;
  sectionTitle: string;
  procedureCode: string;
  procedureId: string;
  procedureLabel: string;
  excelRow: ProcedureTimingRow;
  candidates: ProcedureStep[];
  selectedStepId: string;
  status: MappingStatus;
}

interface ProcedureTimingViewProps {
  tokenStatus: TokenStatus | null;
  onOpenTokenModal: () => void;
}

function normalizeCode(value: string) {
  return String(value || '').trim().replace(/\s+/g, '').replace(/_/g, '.').toUpperCase();
}

function extractApiStepNumbers(step: ProcedureStep) {
  const values: number[] = [];
  const nameMatch = String(step.tenBuoc || '').match(/^(\d+(?:\.\d+)?)/);
  const codeMatch = String(step.maBuoc || '').match(/(?:task_act_|^)(\d+)/i);
  if (nameMatch) values.push(Number(nameMatch[1]));
  if (codeMatch) values.push(Number(codeMatch[1]));
  return [...new Set(values.filter(Number.isFinite))];
}

function extractSectionVariant(title: string) {
  const match = String(title || '').trim().match(/^(\d+)\.(\d+)(?:[.\s:()\-]|$)/);
  if (!match) return null;
  return { major: Number(match[1]), variant: Number(match[2]) };
}

function extractProcedureVariant(code: string) {
  const match = String(code || '').trim().match(/_(\d+)$/);
  return match ? Number(match[1]) : null;
}

function resolveSectionSelections(sections: Array<{ title: string }>, candidates: ProcedureCatalogItem[]) {
  if (candidates.length === 1) return sections.map(() => [candidates[0].id]);
  if (sections.length !== candidates.length || candidates.length === 0) {
    return sections.map(() => [] as string[]);
  }

  const sectionVariants = sections.map(section => extractSectionVariant(section.title));
  const majorNumbers = new Set(sectionVariants.filter(Boolean).map(item => item!.major));
  const variantNumbers = sectionVariants.map(item => item?.variant ?? null);
  const procedureVariants = candidates.map(item => extractProcedureVariant(item.maQuyTrinh));
  const uniqueProcedureVariants = new Set(procedureVariants.filter(value => value !== null));

  const canMapByVariant = sectionVariants.every(Boolean)
    && majorNumbers.size === 1
    && variantNumbers.every(value => value !== null)
    && new Set(variantNumbers).size === sections.length
    && procedureVariants.every(value => value !== null)
    && uniqueProcedureVariants.size === candidates.length
    && variantNumbers.every(value => uniqueProcedureVariants.has(value));

  if (!canMapByVariant) return sections.map(() => [] as string[]);

  return variantNumbers.map(variant => [
    candidates.find(item => extractProcedureVariant(item.maQuyTrinh) === variant)?.id || ''
  ].filter(Boolean));
}

function findStepCandidates(row: ProcedureTimingRow, steps: ProcedureStep[], fallbackStep?: ProcedureStep) {
  if (steps.length === 0) return [];

  const apiHasStepNumbers = steps.some(step => extractApiStepNumbers(step).length > 0);
  if (!apiHasStepNumbers) {
    // Some ILIS workflows return IDs such as Activity_1b2y8rm and names
    // without a numeric prefix. In that case use the Excel step number as
    // a 1-based position only when it is within the API list.
    if (row.stepNumbers.length === 1) {
      const position = row.stepNumbers[0];
      if (Number.isInteger(position) && position >= 1 && position <= steps.length) {
        return [steps[position - 1]];
      }
    }

    // When there is no reliable position mapping, keep every API step as a
    // manual candidate instead of returning an empty dropdown.
    return fallbackStep ? [fallbackStep] : steps;
  }

  if (row.stepNumbers.length === 0) return steps;
  const exact = steps.filter(step => {
    const apiNumbers = extractApiStepNumbers(step);
    return row.stepNumbers.some(number => apiNumbers.includes(number));
  });
  if (exact.length > 0) return exact;

  const baseMatches = steps.filter(step => {
    const apiNumbers = extractApiStepNumbers(step);
    return row.stepNumbers.some(number => apiNumbers.some(apiNumber => Math.floor(apiNumber) === number));
  });
  return baseMatches.length > 0 ? baseMatches : fallbackStep ? [fallbackStep] : steps;
}

function getWorkflowStepNumbers(step: ProcedureStep) {
  const match = String(step.tenBuoc || '').trim().match(/^(\d+(?:\.\d+)*)/);
  if (!match) return null;
  return match[1].split('.').map(Number);
}

function compareStepOrder(left: ProcedureStep, right: ProcedureStep) {
  const leftNumbers = getWorkflowStepNumbers(left);
  const rightNumbers = getWorkflowStepNumbers(right);
  if (!leftNumbers || !rightNumbers) return 0;
  const length = Math.max(leftNumbers.length, rightNumbers.length);
  for (let index = 0; index < length; index++) {
    const difference = (leftNumbers[index] || 0) - (rightNumbers[index] || 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function findStatusId(statuses: ProcedureStatusOption[], code: string, fallback: number) {
  const normalizedCode = code.toLocaleUpperCase('vi-VN');
  const status = statuses.find(item => String(item.maTrangThaiHoSo || '').toLocaleUpperCase('vi-VN') === normalizedCode);
  return status?.id || fallback;
}

function applyWorkflowStatuses(steps: ProcedureStep[], statuses: ProcedureStatusOption[]) {
  const orderedIndexes = steps
    .map((step, index) => ({ step, index }))
    .sort((left, right) => compareStepOrder(left.step, right.step) || left.index - right.index)
    .map(item => item.index);
  const statusByIndex = new Map<number, number>();

  orderedIndexes.forEach((originalIndex, orderedIndex) => {
    const statusId = steps.length === 1
      ? findStatusId(statuses, 'TIEP_NHAN_HO_SO', 1)
      : orderedIndex === 0
        ? findStatusId(statuses, 'TIEP_NHAN_HO_SO', 1)
        : orderedIndex === orderedIndexes.length - 1
          ? findStatusId(statuses, 'TRA_KET_QUA', 4)
          : findStatusId(statuses, 'XU_LY', 3);
    statusByIndex.set(originalIndex, statusId);
  });

  return steps.map((step, index) => ({
    ...step,
    idTrangThaiHoSo: statusByIndex.get(index) || 3
  }));
}

function getWorkflowStatusId(steps: ProcedureStep[], stepId: string, statuses: ProcedureStatusOption[]) {
  return applyWorkflowStatuses(steps, statuses).find(step => step.id === stepId)?.idTrangThaiHoSo || null;
}

function getWorkflowStatusLabel(statusId: number | null, statuses: ProcedureStatusOption[]) {
  const status = statuses.find(item => item.id === statusId);
  if (status) return status.tenTrangThaiHoSo;
  if (statusId === 1) return 'Tiếp nhận hồ sơ';
  if (statusId === 4) return 'Trả kết quả';
  if (statusId === 3) return 'Xử lý hồ sơ';
  return 'Chưa xác định';
}

function buildSheetStates(parsedSheets: ProcedureTimingSheet[], catalog: ProcedureCatalogItem[]): SheetState[] {
  return parsedSheets.map(sheet => {
    const candidates = catalog.filter(item => normalizeCode(item.maThuTuc || '') === normalizeCode(sheet.procedureCode));
    const groupedSections = new Map<string, ProcedureTimingRow[]>();
    sheet.timingRows.forEach(row => {
      const title = row.sectionTitle || sheet.title || sheet.sheetName;
      if (!groupedSections.has(title)) groupedSections.set(title, []);
      groupedSections.get(title)?.push(row);
    });
    const sectionEntries = [...groupedSections.entries()];
    const selectedBySection = resolveSectionSelections(sectionEntries.map(([title]) => ({ title })), candidates);
    const sections = sectionEntries.map(([title, timingRows], index) => ({
      key: `${sheet.sheetName}:${index}:${title}`,
      title,
      timingRows,
      candidates,
      selectedProcedureIds: selectedBySection[index]
    }));
    return {
      ...sheet,
      sections
    };
  });
}

function buildMappingRows(sheets: SheetState[], stepsByProcedureId: Record<string, ProcedureStep[]>): TimingMappingRow[] {
  const rows: TimingMappingRow[] = [];
  sheets.forEach(sheet => {
    sheet.sections.forEach(section => section.selectedProcedureIds.forEach(procedureId => {
      const procedure = section.candidates.find(item => item.id === procedureId);
      const steps = stepsByProcedureId[procedureId] || [];
      const validTimingRows = section.timingRows.filter(row => row.duration.status === 'valid');
      const canUseSequentialFallback = validTimingRows.length === steps.length && steps.length > 0;
      validTimingRows.forEach((excelRow, rowIndex) => {
          const fallbackStep = canUseSequentialFallback ? steps[rowIndex] : undefined;
          const candidates = findStepCandidates(excelRow, steps, fallbackStep);
          rows.push({
            key: `${section.key}:${procedureId}:${excelRow.rowNumber}`,
            sheetName: sheet.sheetName,
            sectionTitle: section.title,
            procedureCode: sheet.procedureCode,
            procedureId,
            procedureLabel: procedure?.maQuyTrinh || procedureId,
            excelRow,
            candidates,
            selectedStepId: candidates.length === 1 ? candidates[0].id : '',
            status: candidates.length === 1 ? 'matched' : candidates.length > 1 ? 'ambiguous' : 'unmatched'
          });
        });
    }));
  });
  return rows;
}

export const ProcedureTimingView: React.FC<ProcedureTimingViewProps> = ({
  tokenStatus,
  onOpenTokenModal
}) => {
  const [catalog, setCatalog] = useState<ProcedureCatalogItem[]>([]);
  const [sheets, setSheets] = useState<SheetState[]>([]);
  const [fileName, setFileName] = useState('');
  const [stepsByProcedureId, setStepsByProcedureId] = useState<Record<string, ProcedureStep[]>>({});
  const [mappingRows, setMappingRows] = useState<TimingMappingRow[]>([]);
  const [updateResults, setUpdateResults] = useState<Record<string, ProcedureStepUpdateResult>>({});
  const [isParsing, setIsParsing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [stepLoadIssue, setStepLoadIssue] = useState<StepLoadIssue | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdate | null>(null);
  const [workflowStatuses, setWorkflowStatuses] = useState<ProcedureStatusOption[]>([]);

  useEffect(() => {
    api.getProcedureCatalog()
      .then(response => setCatalog(response.items || []))
      .catch(err => setError(err?.response?.data?.error || err?.message || 'Không tải được danh sách quy trình.'));
  }, []);

  useEffect(() => {
    if (!tokenStatus?.hasToken) return;
    api.getProcedureStatuses()
      .then(response => {
        if (response.success) setWorkflowStatuses(response.items || []);
        else setError(response.message || 'Khong tai duoc danh sach trang thai ho so.');
      });
  }, [tokenStatus?.hasToken]);

  useEffect(() => {
    if (catalog.length === 0 || sheets.length === 0) return;
    setSheets(previous => previous.map(sheet => {
      const candidates = catalog.filter(item => normalizeCode(item.maThuTuc || '') === normalizeCode(sheet.procedureCode));
      const autoSelectedBySection = resolveSectionSelections(sheet.sections, candidates);
      return {
        ...sheet,
        sections: sheet.sections.map((section, index) => {
          const validSelected = section.selectedProcedureIds.filter(id => candidates.some(item => item.id === id));
          return {
            ...section,
            candidates,
            selectedProcedureIds: validSelected.length > 0 ? validSelected : autoSelectedBySection[index]
          };
        })
      };
    }));
  }, [catalog]);

  const selectedProcedureIds = useMemo(
    () => new Set(sheets.flatMap(sheet => sheet.sections.flatMap(section => section.selectedProcedureIds))),
    [sheets]
  );
  const availableProcedureIds = useMemo(
    () => new Set(sheets.flatMap(sheet => sheet.sections.flatMap(section => section.candidates.map(item => item.id)))),
    [sheets]
  );
  const selectedProcedureCount = selectedProcedureIds.size;
  const selectionOccurrenceCount = useMemo(
    () => sheets.reduce((total, sheet) => total + sheet.sections.reduce((sectionTotal, section) => sectionTotal + section.selectedProcedureIds.length, 0), 0),
    [sheets]
  );
  const unselectedProcedures = useMemo(
    () => catalog.filter(item => availableProcedureIds.has(item.id) && !selectedProcedureIds.has(item.id)),
    [catalog, availableProcedureIds, selectedProcedureIds]
  );
  const proceduresWithoutSheet = useMemo(
    () => catalog.filter(item => !availableProcedureIds.has(item.id)),
    [catalog, availableProcedureIds]
  );
  const readyCount = useMemo(
    () => mappingRows.filter(row => row.selectedStepId && row.excelRow.duration.status === 'valid').length,
    [mappingRows]
  );
  const ambiguousCount = useMemo(
    () => mappingRows.filter(row => row.status !== 'matched' || !row.selectedStepId).length,
    [mappingRows]
  );
  const validSheetCount = useMemo(
    () => sheets.filter(sheet => sheet.sections.some(section => section.candidates.length > 0)).length,
    [sheets]
  );

  const handleFile = async (file?: File) => {
    if (!file) return;
    setIsParsing(true);
    setError('');
    setProgress('Đang đọc các sheet và cột thời gian...');
    try {
      const parsed: ProcedureTimingParseResponse = await api.parseProcedureTimings(file);
      setFileName(parsed.fileName || file.name);
      setSheets(buildSheetStates(parsed.sheets || [], catalog));
      setStepsByProcedureId({});
      setMappingRows([]);
      setUpdateResults({});
      setStepLoadIssue(null);
      setPendingUpdate(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Không đọc được file Excel thời gian.');
    } finally {
      setProgress('');
      setIsParsing(false);
    }
  };

  const updateSectionSelection = (sheetName: string, sectionKey: string, selectedProcedureIds: string[]) => {
    setSheets(previous => previous.map(sheet => sheet.sheetName === sheetName
      ? {
          ...sheet,
          sections: sheet.sections.map(section => section.key === sectionKey
            ? { ...section, selectedProcedureIds }
            : section)
        }
      : sheet));
    setMappingRows([]);
    setStepsByProcedureId({});
    setUpdateResults({});
    setStepLoadIssue(null);
    setPendingUpdate(null);
  };

  const loadSteps = async () => {
    if (selectedProcedureCount === 0) {
      setError('Hãy chọn ít nhất một idQuyTrinh cho các sheet trước khi tải bước.');
      return;
    }
    if (!tokenStatus?.hasToken) {
      setError('Cần nhập Bearer Token trước khi tải bước từ ILIS.');
      onOpenTokenModal();
      return;
    }

    const ids = [...new Set(sheets.flatMap(sheet => sheet.sections.flatMap(section => section.selectedProcedureIds)))];
    const nextSteps: Record<string, ProcedureStep[]> = {};
    setIsSearching(true);
    setError('');
    setStepLoadIssue(null);
    setPendingUpdate(null);
    try {
      for (let index = 0; index < ids.length; index++) {
        const id = ids[index];
        setProgress(`Đang tải bước ${index + 1}/${ids.length}...`);
        const result = await api.searchProcedureSteps(id);
        if (!result.success) {
          setStepLoadIssue({
            index: index + 1,
            total: ids.length,
            procedureId: id,
            message: result.message,
            httpStatus: result.httpStatus
          });
          setProgress('');
          throw new Error(`Táº£i bÆ°á»›c tháº¥t báº¡i táº¡i ${index + 1}/${ids.length}, idQuyTrinh ${id}: ${result.message} (HTTP ${result.httpStatus})`);
        }
        nextSteps[id] = result.items || [];
      }
      setStepsByProcedureId(nextSteps);
      setMappingRows(buildMappingRows(sheets, nextSteps));
      setUpdateResults({});
      setProgress(`Đã tải bước cho ${ids.length} quy trình.`);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Không tải được bước quy trình.');
    } finally {
      setIsSearching(false);
    }
  };

  const updateMappingStep = (key: string, selectedStepId: string) => {
    setMappingRows(previous => previous.map(row => row.key === key
      ? {
          ...row,
          selectedStepId,
          status: selectedStepId ? 'matched' : row.candidates.length > 1 ? 'ambiguous' : 'unmatched'
        }
      : row));
  };

  const updateAll = async () => {
    if (mappingRows.length === 0) {
      setError('Chưa tải bước hoặc chưa có dòng thời gian hợp lệ để cập nhật.');
      return;
    }
    const selectedRows = mappingRows.filter(row => row.selectedStepId && row.excelRow.duration.status === 'valid');
    if (selectedRows.length === 0) {
      setError('Chưa có bước nào được mapping.');
      return;
    }
    if (!tokenStatus?.hasToken) {
      setError('Cần nhập Bearer Token trước khi cập nhật thời gian.');
      onOpenTokenModal();
      return;
    }

    if (workflowStatuses.length === 0) {
      setError('Chua tai duoc danh sach trang thai ho so tu TrangThaiHoSo/GetAllActive.');
      return;
    }
    const payloadByProcedure = new Map<string, ProcedureStep[]>();
    const assignmentKeys = new Set<string>();
    const statusStepsByProcedure = new Map<string, ProcedureStep[]>();
    let skippedDuplicateCount = 0;
    for (const row of selectedRows) {
      const steps = stepsByProcedureId[row.procedureId];
      if (!steps) continue;
      const step = steps.find(item => item.id === row.selectedStepId);
      const duration = row.excelRow.duration;
      if (!step || duration.days === null || duration.hours === null) continue;

      const assignmentKey = `${row.procedureId}:${row.selectedStepId}`;
      if (assignmentKeys.has(assignmentKey)) {
        skippedDuplicateCount += 1;
        continue;
      }
      assignmentKeys.add(assignmentKey);

      const statusSteps = statusStepsByProcedure.get(row.procedureId) || applyWorkflowStatuses(steps, workflowStatuses);
      statusStepsByProcedure.set(row.procedureId, statusSteps);
      const sourceStep = statusSteps.find(item => item.id === row.selectedStepId);
      if (!sourceStep) continue;

      const current = payloadByProcedure.get(row.procedureId) || [];
      current.push({
        ...sourceStep,
        thoiGianThucHien: duration.days,
        thoiGianThucHienTime: duration.hours
      });
      payloadByProcedure.set(row.procedureId, current);
    }

    const skippedIncompleteProcedures: string[] = [];
    for (const [procedureId, selectedPayload] of payloadByProcedure.entries()) {
      const allSteps = statusStepsByProcedure.get(procedureId) || [];
      const selectedByStepId = new Map(selectedPayload.map(step => [step.id, step]));
      const fullPayload = allSteps.map(step => selectedByStepId.get(step.id) || { ...step });
      const missingDurationSteps = fullPayload.filter(step =>
        (step.thoiGianThucHien === null || step.thoiGianThucHien === undefined)
        && (step.thoiGianThucHienTime === null || step.thoiGianThucHienTime === undefined)
      );

      if (missingDurationSteps.length > 0) {
        skippedIncompleteProcedures.push(`${procedureId} thiếu ${missingDurationSteps.length} bước`);
        payloadByProcedure.delete(procedureId);
        continue;
      }

      payloadByProcedure.set(procedureId, fullPayload);
    }

    if (payloadByProcedure.size === 0) {
      setError(`Không có quy trình đủ thông tin thời gian để cập nhật. ${skippedIncompleteProcedures.join('; ')}`);
      return;
    }
    setPendingUpdate({
      payloadByProcedure,
      payloadStepCount: [...payloadByProcedure.values()].reduce((total, steps) => total + steps.length, 0),
      skippedDuplicateCount,
      skippedIncompleteProcedures
    });
    return;
  };

  const executePendingUpdate = async () => {
    if (!pendingUpdate) return;
    setIsUpdating(true);
    setError('');
    setUpdateResults({});
    setPendingUpdate(null);
    const results: Record<string, ProcedureStepUpdateResult> = {};
    try {
      const entries = [...pendingUpdate.payloadByProcedure.entries()];
      for (let index = 0; index < entries.length; index++) {
        const [procedureId, payload] = entries[index];
        setProgress(`Đang cập nhật ${index + 1}/${entries.length} quy trình...`);
        const result = await api.updateProcedureSteps(procedureId, payload);
        results[procedureId] = result;
        setUpdateResults({ ...results });
        if (!result.success) {
          setError(`Quy trình ${procedureId}: ${result.message} (HTTP ${result.httpStatus})`);
        }
        if (!result.success && result.httpStatus === 401) {
          setError('Token không hợp lệ hoặc đã hết hạn. Tiến trình đã dừng.');
          break;
        }
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Lỗi cập nhật thời gian bước.');
    } finally {
      setIsUpdating(false);
      setProgress('');
    }
  };

  return (
    <div className="mx-auto max-w-[1700px] space-y-6 p-6 lg:p-8">
      <section className="rounded-2xl border border-amber-900/70 bg-gradient-to-br from-amber-950/50 to-slate-950 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
              <Clock3 className="h-4 w-4" />
              ILIS LPM • Cấu hình thời gian bước
            </div>
            <h1 className="mt-4 text-2xl font-bold text-white">Cập nhật thời gian các bước hàng loạt</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-300">
              Đọc từng sheet thủ tục, quy đổi ngày làm việc thành ngày + giờ theo quy ước 8 giờ/ngày, sau đó cập nhật danh sách bước trên ILIS.
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            <div className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4" /> Gửi API thật</div>
            <div className="mt-1 text-amber-100/70">Chỉ gửi sau khi bấm xác nhận cập nhật.</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-6">
        {[
          ['Sheet', String(sheets.length), 'text-slate-100'],
          ['Có mã quy trình', `${validSheetCount}/${sheets.length || 0}`, 'text-blue-300'],
          ['Quy trình đã chọn', String(selectedProcedureCount), 'text-amber-300'],
          ['Lượt gán theo khối', String(selectionOccurrenceCount), 'text-slate-300'],
          ['Bước đã mapping', String(readyCount), 'text-emerald-300'],
          ['Cần kiểm tra', String(ambiguousCount), 'text-red-300']
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-xs text-slate-400">{label}</div>
            <div className={`mt-2 text-2xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </section>

      {catalog.length > 0 && sheets.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Đối soát danh sách quy trình</h2>
              <p className="mt-1 text-xs text-slate-500">
                Chỉ số “Quy trình đã chọn” là số `idQuyTrinh` duy nhất; “Lượt gán theo khối” có thể lớn hơn do một quy trình xuất hiện ở nhiều khối.
              </p>
            </div>
            <div className="text-xs text-slate-400">Catalog: {catalog.length} ID</div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-amber-200">Chưa chọn trong các sheet</h3>
                <span className="rounded-full bg-amber-500/20 px-2 py-1 font-mono text-xs text-amber-300">{unselectedProcedures.length}</span>
              </div>
              {unselectedProcedures.length === 0 ? (
                <div className="mt-3 text-xs text-emerald-300">Đã chọn đủ các ID có trong các sheet.</div>
              ) : (
                <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-auto">
                  {unselectedProcedures.map(item => (
                    <span key={item.id} title={item.id} className="rounded-md border border-amber-500/20 bg-slate-950 px-2 py-1 font-mono text-[10px] text-amber-200">
                      {item.maQuyTrinh}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-200">Catalog chưa có sheet</h3>
                <span className="rounded-full bg-slate-700 px-2 py-1 font-mono text-xs text-slate-300">{proceduresWithoutSheet.length}</span>
              </div>
              {proceduresWithoutSheet.length === 0 ? (
                <div className="mt-3 text-xs text-emerald-300">Tất cả ID trong catalog đều có mã sheet tương ứng.</div>
              ) : (
                <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-auto">
                  {proceduresWithoutSheet.map(item => (
                    <span key={item.id} title={item.id} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[10px] text-slate-300">
                      {item.maQuyTrinh}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {progress && <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-sm text-blue-200">{progress}</div>}
      {pendingUpdate && !isUpdating && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          <div>
            <div className="font-semibold">Đã chuẩn bị payload cập nhật</div>
            <div className="mt-1 text-xs text-amber-100/80">
              {pendingUpdate.payloadStepCount} bước thuộc {pendingUpdate.payloadByProcedure.size} quy trình sẽ được gửi lên ILIS.
              {pendingUpdate.skippedDuplicateCount > 0 && ` Đã bỏ qua ${pendingUpdate.skippedDuplicateCount} dòng Excel bị mapping trùng bước.`}
            </div>
            {pendingUpdate.skippedIncompleteProcedures.length > 0 && (
              <div className="mt-2 text-xs text-red-200">
                Bỏ qua quy trình chưa đủ thời gian: {pendingUpdate.skippedIncompleteProcedures.join('; ')}.
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPendingUpdate(null)}
              className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={executePendingUpdate}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              Xác nhận cập nhật
            </button>
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-white">1. Chọn file Excel thời gian</h2>
            <p className="mt-1 text-xs text-slate-500">Hỗ trợ `.xlsx`, `.xls`; mỗi sheet được xem là một mã thủ tục gốc.</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500">
            {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Chọn file Excel
            <input type="file" accept=".xlsx,.xls" className="hidden" disabled={isParsing} onChange={event => handleFile(event.target.files?.[0])} />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-300">
          <FileSpreadsheet className="h-6 w-6 text-emerald-400" />
          <span>{fileName || 'Chưa chọn file'}</span>
          {fileName && <span className="text-xs text-slate-500">{sheets.length} sheet</span>}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-white">2. Mapping sheet với quy trình</h2>
            <p className="mt-1 text-xs text-slate-500">Giữ Ctrl/Cmd để chọn nhiều `idQuyTrinh` cho một sheet khi mã thủ tục có nhiều quy trình.</p>
          </div>
          <button
            onClick={loadSteps}
            disabled={isSearching || selectedProcedureCount === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Tải bước từ ILIS
          </button>
        </div>

        {sheets.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-8 text-center text-sm text-slate-500">Chưa có sheet để mapping.</div>
        ) : (
          <div className="mt-4 max-h-[520px] overflow-auto rounded-xl border border-slate-800">
            {stepLoadIssue && (
              <div className="m-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                <div>
                  <div className="font-semibold">Khối xử lý tải bước bị lỗi</div>
                  <div className="mt-1 text-xs text-red-200/80">
                    Request {stepLoadIssue.index}/{stepLoadIssue.total} • idQuyTrinh: <span className="font-mono">{stepLoadIssue.procedureId}</span> • HTTP {stepLoadIssue.httpStatus}
                  </div>
                  <div className="mt-1 text-xs text-red-200/70">{stepLoadIssue.message}</div>
                </div>
                <button
                  onClick={loadSteps}
                  disabled={isSearching}
                  className="rounded-lg border border-red-400/40 px-3 py-2 text-xs font-semibold text-red-100 hover:bg-red-500/20 disabled:opacity-50"
                >
                  Thử tải lại
                </button>
              </div>
            )}
            <table className="w-full min-w-[1000px] text-left text-xs">
              <thead className="sticky top-0 bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Sheet</th>
                  <th className="px-4 py-3">Mã thủ tục</th>
                  <th className="px-4 py-3">Quy trình / idQuyTrinh</th>
                  <th className="px-4 py-3">Dòng thời gian</th>
                  <th className="px-4 py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sheets.flatMap(sheet => sheet.sections.map(section => ({ sheet, section }))).map(({ sheet, section }) => (
                  <tr key={section.key} className={section.candidates.length === 0 ? 'bg-red-500/[0.04]' : 'bg-slate-950/20'}>
                    <td className="px-4 py-3 font-mono text-blue-300">
                      <div>{sheet.sheetName}</div>
                      <div className="mt-1 max-w-[260px] truncate text-[10px] text-amber-300/80" title={section.title}>{section.title}</div>
                    </td>
                    <td className="max-w-[420px] px-4 py-3">
                      <div className="font-mono text-slate-200">{sheet.procedureCode}</div>
                      <div className="mt-1 max-w-[420px] truncate text-[10px] text-slate-500" title={sheet.title}>{sheet.title}</div>
                    </td>
                    <td className="px-4 py-3">
                      {section.candidates.length > 0 ? (
                        <select
                          multiple
                          size={Math.min(Math.max(section.candidates.length, 2), 5)}
                          value={section.selectedProcedureIds}
                          onChange={event => updateSectionSelection(sheet.sheetName, section.key, Array.from(event.target.selectedOptions, option => option.value))}
                          className="w-72 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-[10px] text-slate-200 outline-none focus:border-blue-500"
                        >
                          {section.candidates.map(item => <option key={item.id} value={item.id}>{item.maQuyTrinh} • {item.id}</option>)}
                        </select>
                      ) : <span className="text-red-300">Không có trong catalog 68 ID</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{section.timingRows.filter(row => row.duration.status === 'valid').length}</td>
                    <td className="px-4 py-3">
                      {section.candidates.length === 0 && <span className="inline-flex items-center gap-1 text-red-300"><XCircle className="h-4 w-4" /> Không khớp</span>}
                      {section.candidates.length > 0 && section.selectedProcedureIds.length === 0 && <span className="inline-flex items-center gap-1 text-amber-300"><AlertCircle className="h-4 w-4" /> Chọn quy trình</span>}
                      {section.selectedProcedureIds.length > 0 && <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Đã chọn</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-white">3. Kiểm tra bước và thời gian</h2>
            <p className="mt-1 text-xs text-slate-500">Các dòng màu vàng cần chọn lại bước API; thời gian được quy đổi theo 8 giờ làm việc/ngày.</p>
          </div>
          <button
            onClick={updateAll}
            disabled={isUpdating || readyCount === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Cập nhật {selectedProcedureCount} quy trình
          </button>
        </div>

        {mappingRows.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/50 p-8 text-center text-sm text-slate-500">Hãy chọn quy trình và bấm “Tải bước từ ILIS”.</div>
        ) : (
          <div className="mt-4 max-h-[650px] overflow-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[1450px] text-left text-xs">
              <thead className="sticky top-0 bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Quy trình</th>
                  <th className="px-4 py-3">Excel</th>
                  <th className="px-4 py-3">Thời gian</th>
                  <th className="px-4 py-3">Bước API</th>
                  <th className="px-4 py-3">Giá trị cập nhật</th>
                  <th className="px-4 py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {mappingRows.map(row => {
                  const selectedStep = row.candidates.find(step => step.id === row.selectedStepId);
                  const selectedStepStatusId = selectedStep
                    ? getWorkflowStatusId(stepsByProcedureId[row.procedureId] || [], selectedStep.id, workflowStatuses)
                    : null;
                  const result = updateResults[row.procedureId];
                  return (
                    <tr key={row.key} className={row.status === 'matched' ? 'bg-emerald-500/[0.03]' : 'bg-amber-500/[0.04]'}>
                      <td className="px-4 py-3">
                        <div className="font-mono text-blue-300">{row.procedureLabel}</div>
                        <div className="mt-1 text-[10px] text-slate-500">{row.sheetName}</div>
                      </td>
                      <td className="max-w-[360px] px-4 py-3">
                        <div className="font-medium text-slate-200">{row.excelRow.stepLabel || 'Bước tiếp nối'}</div>
                        <div className="mt-1 max-w-[360px] truncate text-[10px] text-slate-500" title={row.excelRow.content}>{row.excelRow.content}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-amber-300">
                        <div>{row.excelRow.timeText}</div>
                        <div className="mt-1 text-[10px] text-slate-500">Dòng {row.excelRow.rowNumber}</div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={row.selectedStepId}
                          onChange={event => updateMappingStep(row.key, event.target.value)}
                          className="w-96 rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 font-mono text-[10px] text-slate-200 outline-none focus:border-blue-500"
                        >
                          <option value="">-- Chọn bước API --</option>
                          {row.candidates.map(step => <option key={step.id} value={step.id}>{step.tenBuoc || step.maBuoc} • {step.maBuoc}</option>)}
                        </select>
                        {selectedStepStatusId !== null && (
                          <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-200">
                            <span className="font-semibold">idTrangThaiHoSo = {selectedStepStatusId}</span>
                            <span>• {getWorkflowStatusLabel(selectedStepStatusId, workflowStatuses)}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-emerald-300">
                        {selectedStep && row.excelRow.duration.days !== null && row.excelRow.duration.hours !== null
                          ? `${row.excelRow.duration.days} ngày + ${row.excelRow.duration.hours} giờ`
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {result && <span className={result.success ? 'text-emerald-300' : 'text-red-300'}>{result.success ? 'Đã cập nhật' : `Lỗi ${result.httpStatus}: ${result.message}`}</span>}
                        {!result && row.status === 'matched' && <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Sẵn sàng</span>}
                        {!result && row.status !== 'matched' && <span className="inline-flex items-center gap-1 text-amber-300"><AlertCircle className="h-4 w-4" /> Cần chọn</span>}
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

