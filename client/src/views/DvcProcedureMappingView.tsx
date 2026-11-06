import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Download, FileSpreadsheet, Loader2, RefreshCw, Save, Search, ShieldAlert, X, XCircle } from 'lucide-react';
import { api } from '../services/api';
import { DvcDepartmentItem, DvcLpmDomainItem, DvcMappingDataTypeOption, DvcMappingValue, DvcProcessItem, DvcProcedureItem, DvhcScopeItem, LpmProcessItem, LpmProcedureItem, TokenStatus } from '../types';
import { DVC_PROCEDURE_REFERENCES } from '../dvcProcedureReference';
import mappingWorkbookUrl from '../assets/mapping_thu_tuc_quy_trinh.xlsx?url';

interface DvcProcedureMappingViewProps {
  tokenStatus: TokenStatus | null;
  onOpenTokenModal: () => void;
}

interface MappingRow {
  dvc: DvcProcedureItem;
  candidates: LpmProcedureItem[];
  selectedLpmId: string;
  status: 'matched' | 'suggested' | 'unmatched';
}

interface ProcessMappingRow {
  dvc: DvcProcessItem;
  candidates: LpmProcessItem[];
  selectedLpmId: string;
  selectedScopeId: string;
  status: 'matched' | 'suggested' | 'unmatched';
}

interface ProcessOverviewRow extends ProcessMappingRow {
  procedure: MappingRow;
}

interface LpmProcedurePickerProps {
  value: string;
  items: LpmProcedureItem[];
  onChange: (value: string) => void;
}

const DEFAULT_DVHC_CODE = '286';
const DEFAULT_DVHC_NAME = 'tinh vinh long';

const LpmProcedurePicker: React.FC<LpmProcedurePickerProps> = ({ value, items, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = items.find(item => item.id === value);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const label = selected ? `${selected.maThuTuc || selected.id} - ${selected.tenThuTuc || 'Chưa có tên'}` : '-- Chọn --';
  const normalizedSearch = normalizeText(search);
  const filteredItems = items.filter(item => !normalizedSearch || normalizeText(`${item.maThuTuc} ${item.tenThuTuc}`).includes(normalizedSearch));

  return (
    <div ref={containerRef} className="relative w-full min-w-[520px]">
      <button
        type="button"
        onClick={() => { setOpen(current => !current); setSearch(''); }}
        className="flex min-h-[42px] w-full items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-left text-xs text-slate-200 outline-none hover:border-slate-500 focus:border-blue-500"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="min-w-0 line-clamp-2 break-words">{label}</span>
        <span className="shrink-0 text-slate-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-slate-600 bg-slate-950 p-1 shadow-2xl" role="listbox">
          <div className="sticky top-0 z-10 bg-slate-950 p-1">
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              onClick={event => event.stopPropagation()}
              onKeyDown={event => event.stopPropagation()}
              className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none placeholder:text-slate-500 focus:border-blue-500"
              placeholder="Tìm theo mã hoặc tên thủ tục..."
              autoFocus
            />
          </div>
          <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="w-full rounded px-3 py-2 text-left text-xs text-slate-400 hover:bg-blue-600 hover:text-white">-- Chọn --</button>
          {filteredItems.map(item => {
            const isSelected = item.id === value;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => { onChange(item.id); setOpen(false); }}
                className={`w-full rounded px-3 py-2 text-left text-xs ${isSelected ? 'bg-blue-600 text-white' : 'text-slate-200 hover:bg-slate-800'}`}
              >
                <span className="block font-mono text-[11px] text-cyan-300">{item.maThuTuc || item.id}</span>
                <span className="mt-0.5 block whitespace-normal break-words leading-5">{item.tenThuTuc || 'Chưa có tên'}</span>
              </button>
            );
          })}
          {filteredItems.length === 0 && <div className="px-3 py-4 text-center text-xs text-slate-500">Không tìm thấy thủ tục phù hợp.</div>}
        </div>
      )}
    </div>
  );
};

type MappingDataType = string;

const DEFAULT_LPM_DOMAIN_ID = 'A2C100D20CBD48F39C92313351086855';
const DEFAULT_DVC_DOMAIN_ID = 'DD';
const FALLBACK_DATA_TYPES: DvcMappingDataTypeOption[] = [
  { value: 'LinhVuc', label: 'Lĩnh vực' },
  { value: 'ThuTuc', label: 'Thủ tục' },
  { value: 'NhanVien', label: 'Nhân viên xử lý' }
];

function isProcedureDataType(value: string) {
  return normalizeText(value).replace(/\s/g, '') === 'thutuc' || normalizeText(value).replace(/\s/g, '').includes('thutuc');
}

function isEmployeeDataType(value: string) {
  const normalized = normalizeText(value).replace(/\s/g, '');
  return normalized.includes('nhanvien') || normalized.includes('nguoi xuly'.replace(/\s/g, ''));
}

function isSupportedMappingType(value: string) {
  return isProcedureDataType(value) || isEmployeeDataType(value);
}

function normalizeDataType(item: any): DvcMappingDataTypeOption {
  const value = textValue(item, ['loaiDanhMuc', 'loai', 'loaiDuLieu', 'type', 'maLoaiDuLieu', 'ma', 'code', 'value', 'id']);
  const label = textValue(item, ['tenLoaiDuLieu', 'tenLoaiDanhMuc', 'tenLoai', 'ten', 'name', 'label', 'moTa']) || value;
  return { ...item, value, label };
}

function textValue(item: any, keys: string[]) {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return '';
}

function normalizeText(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeProcedureReferenceCode(value: string) {
  const normalized = String(value || '').trim().toLowerCase().replace(/_(?:t|x)$/i, '');
  const parts = normalized.split('.');
  if (parts.length !== 2) return normalized;
  return `${parts[0]}.${parts[1].replace(/0+$/, '') || '0'}`;
}

const dvcToLpmReference = new Map(
  DVC_PROCEDURE_REFERENCES.map(item => [normalizeText(item.maDvc), normalizeProcedureReferenceCode(item.maLpm)])
);

function normalizeLpmItem(item: any): LpmProcedureItem {
  const nested = item?.thuTuc || item?.procedure || {};
  return {
    ...item,
    id: textValue(item, ['id', 'idThuTuc', 'idLpm', 'idNguoiDung', 'idUser', 'userId', 'idTaiKhoan']) || textValue(nested, ['id', 'idThuTuc', 'idNguoiDung', 'idUser', 'userId']),
    maThuTuc: textValue(item, ['maThuTuc', 'ma', 'maTTHC', 'maNguoiDung', 'maNhanVien', 'username', 'userName', 'code']) || textValue(nested, ['maThuTuc', 'ma', 'username', 'userName', 'code']),
    tenThuTuc: textValue(item, ['tenThuTuc', 'ten', 'tenTTHC', 'tenNguoiDung', 'hoTen', 'fullName', 'name', 'userName']) || textValue(nested, ['tenThuTuc', 'ten', 'hoTen', 'fullName', 'name', 'userName'])
  };
}

function normalizeDvcItem(item: any): DvcProcedureItem {
  const nested = item?.thuTuc || item?.procedure || {};
  return {
    ...item,
    id: textValue(item, ['id', 'idDvc', 'idNguoiXuLy', 'idNguoi', 'ma']) || textValue(nested, ['id', 'idDvc', 'idNguoiXuLy', 'idNguoi', 'ma']),
    ma: textValue(item, ['ma', 'maThuTuc', 'maNguoiXuLy', 'username', 'userName', 'code']) || textValue(nested, ['ma', 'maThuTuc', 'maNguoiXuLy', 'username', 'userName', 'code']),
    ten: textValue(item, ['ten', 'tenThuTuc', 'tenNguoiXuLy', 'hoTen', 'fullName', 'name', 'userName']) || textValue(nested, ['ten', 'tenThuTuc', 'tenNguoiXuLy', 'hoTen', 'fullName', 'name', 'userName']),
    idLpm: textValue(item, ['idLpm', 'idLPM', 'idThuTucLpm']),
    maLPM: textValue(item, ['maLPM', 'maLpm']),
    tenLPM: textValue(item, ['tenLPM', 'tenLpm'])
  };
}

function deduplicateDvcProcedures(items: DvcProcedureItem[]) {
  const seen = new Set<string>();
  const duplicateCodes = new Set<string>();
  const uniqueItems = items.filter(item => {
    const key = normalizeText(item.ma) || `id:${item.id}`;
    if (!key || !seen.has(key)) {
      if (key) seen.add(key);
      return true;
    }
    duplicateCodes.add(item.ma || item.id);
    return false;
  });

  return { items: uniqueItems, duplicateCodes: [...duplicateCodes] };
}

function normalizeLpmProcess(item: any): LpmProcessItem {
  return {
    ...item,
    id: textValue(item, ['id', 'idQuyTrinh']),
    maQuyTrinh: textValue(item, ['maQuyTrinh', 'ma', 'code']),
    tenQuyTrinh: textValue(item, ['tenQuyTrinh', 'ten', 'name'])
  };
}

function normalizeDvcProcess(item: any): DvcProcessItem {
  return {
    ...item,
    id: textValue(item, ['idQuyTrinhDVC', 'idQuyTrinhDvc', 'ma', 'id']),
    ma: textValue(item, ['ma', 'idQuyTrinhDVC', 'idQuyTrinhDvc', 'code']),
    ten: textValue(item, ['ten', 'tenQuyTrinh', 'name'])
  };
}

function normalizeDvhcScope(item: any): DvhcScopeItem {
  return {
    ...item,
    scopeId: textValue(item, ['scopeId', 'id', 'idDvhc']),
    scopeCode: textValue(item, ['scopeCode', 'code', 'ma']),
    scopeName: textValue(item, ['scopeName', 'name', 'ten']),
    scopeLevel: Number(item?.scopeLevel || 0),
    parentScopeId: textValue(item, ['parentScopeId', 'parentId', 'idCha'])
  };
}

function getDefaultDvhcScopeId(scopes: DvhcScopeItem[]) {
  return scopes.find(scope =>
    scope.scopeCode === DEFAULT_DVHC_CODE || normalizeText(scope.scopeName) === DEFAULT_DVHC_NAME
  )?.scopeId || '';
}

function flattenDvhcScopes(items: any[]): DvhcScopeItem[] {
  const result: DvhcScopeItem[] = [];
  const visit = (nodes: any[], depth = 0) => {
    nodes.forEach(node => {
      const scope = normalizeDvhcScope(node);
      if (scope.scopeId) result.push({ ...scope, scopeLevel: scope.scopeLevel || depth + 1 });
      if (Array.isArray(node?.childScopes)) visit(node.childScopes, depth + 1);
      else if (Array.isArray(node?.children)) visit(node.children, depth + 1);
    });
  };
  visit(items);
  return [...new Map(result.map(item => [item.scopeId, item])).values()];
}

function processBaseCode(value: string) {
  return String(value || '').trim().replace(/_(?:T|X)$/i, '').trim().toLowerCase();
}

function extractProcessMappings(data: any): any[] {
  const values: any[] = [];
  const visit = (value: any) => {
    if (value === null || value === undefined) return;
    if (typeof value === 'string') {
      try { visit(JSON.parse(value)); } catch { /* Ignore non-JSON strings. */ }
      return;
    }
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (typeof value !== 'object') return;
    const hasProcessKeys = value.idQuyTrinhDVC || value.idQuyTrinhDvc || value.idQuyTrinhLpm || value.idLpm || value.maQuyTrinhDVC;
    if (hasProcessKeys) values.push(value);
    ['mapGiaTri', 'items', 'data', 'result'].forEach(key => visit(value[key]));
  };
  visit(data);
  return values;
}

function extractMappingConfigRecord(data: any): any | null {
  if (!data) return null;
  if (Array.isArray(data)) return data.find(item => item?.mapGiaTri !== undefined || item?.loaiDanhMuc) || null;
  if (data?.mapGiaTri !== undefined || data?.loaiDanhMuc) return data;
  if (data?.data) return extractMappingConfigRecord(data.data);
  if (data?.result) return extractMappingConfigRecord(data.result);
  return null;
}

function extractMappingConfigId(data: any) {
  return textValue(extractMappingConfigRecord(data), ['id']);
}

function extractMappingConfigReference(data: any) {
  return textValue(extractMappingConfigRecord(data), ['thamChieuLpm', 'thamChieuLPM']);
}

function processMappingKey(value: any) {
  return `${textValue(value, ['idThuTucDvc', 'idThuTucDVC'])}|${textValue(value, ['id', 'idQuyTrinhDVC', 'idQuyTrinhDvc', 'ma', 'maQuyTrinhDVC'])}`;
}

function isCompleteProcessMapping(value: any) {
  return Boolean(
    textValue(value, ['id', 'idQuyTrinhDVC', 'idQuyTrinhDvc', 'ma', 'maQuyTrinhDVC']) &&
    textValue(value, ['idThuTucDvc', 'idThuTucDVC']) &&
    textValue(value, ['idLpm', 'idQuyTrinhLpm', 'idQuyTrinhLPM']) &&
    textValue(value, ['idDvhcLPM', 'idDvhcLpm', 'idDvhc'])
  );
}

function mergeProcessMappings(existing: any[], updates: any[]) {
  const merged = existing.filter(isCompleteProcessMapping);
  const indexByKey = new Map(merged.map((item, index) => [processMappingKey(item), index]));
  updates.filter(isCompleteProcessMapping).forEach(update => {
    const key = processMappingKey(update);
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, merged.length);
      merged.push(update);
    } else {
      merged[existingIndex] = update;
    }
  });
  return merged;
}

function buildProcessMappingRows(dvcItems: DvcProcessItem[], lpmItems: LpmProcessItem[], scopes: DvhcScopeItem[], mappingData: any) {
  const mappings = extractProcessMappings(mappingData);
  const defaultScopeId = getDefaultDvhcScopeId(scopes);
  return dvcItems.map(dvc => {
    const existing = mappings.find(mapping => {
      const mappingDvcId = textValue(mapping, ['idQuyTrinhDVC', 'idQuyTrinhDvc', 'idDvc', 'id']);
      const mappingDvcCode = textValue(mapping, ['maQuyTrinhDVC', 'maQuyTrinhDvc', 'maDvc', 'ma']);
      return (mappingDvcId && mappingDvcId === dvc.id) || (mappingDvcCode && mappingDvcCode === dvc.ma);
    });
    const existingLpmId = textValue(existing, ['idQuyTrinhLpm', 'idQuyTrinhLPM', 'idLpm', 'idLPM']);
    const existingScopeId = textValue(existing, ['scopeId', 'idDvhcLPM', 'idDvhcLpm', 'idDvhc', 'idDonViHanhChinh', 'donViHanhChinhId']);
    const selectedScopeId = scopes.some(scope => scope.scopeId === existingScopeId) ? existingScopeId : defaultScopeId;
    const existingLpm = existingLpmId ? lpmItems.find(item => item.id === existingLpmId) : undefined;
    if (existingLpm) {
      return { dvc, candidates: [existingLpm], selectedLpmId: existingLpm.id, selectedScopeId, status: 'matched' as const };
    }
    const candidates = lpmItems.filter(item => processBaseCode(item.maQuyTrinh) === processBaseCode(dvc.ma));
    return {
      dvc,
      candidates,
      selectedLpmId: candidates.length === 1 ? candidates[0].id : '',
      selectedScopeId,
      status: candidates.length === 1 ? 'matched' as const : candidates.length > 1 ? 'suggested' as const : 'unmatched' as const
    };
  });
}

function normalizeDepartment(item: any): DvcDepartmentItem {
  return {
    ...item,
    id: textValue(item, ['id', 'phongBanId', 'ma', 'code']),
    label: textValue(item, ['ten', 'tenPhongBan', 'name', 'label', 'ma'])
  };
}

function normalizeMappedDomain(item: any): DvcLpmDomainItem {
  const lpm = item?.lpm || item?.linhVucLpm || {};
  const dvc = item?.dvc || item?.linhVucDvc || {};
  return {
    ...item,
    idDvc: textValue(item, ['idDvc', 'idLinhVucDvc', 'linhVucDvcId', 'id', 'ma']) || textValue(dvc, ['id', 'ma']),
    maDvc: textValue(item, ['maDvc', 'maLinhVucDvc', 'maLinhVucDVC', 'ma']) || textValue(dvc, ['ma', 'code']),
    tenDvc: textValue(item, ['tenDvc', 'tenLinhVucDvc', 'tenLinhVucDVC', 'ten', 'name']) || textValue(dvc, ['ten', 'name']),
    idLpm: textValue(item, ['idLpm', 'idLPM', 'idLinhVucLpm', 'idLinhVucLPM']) || textValue(lpm, ['id', 'idLpm']),
    maLpm: textValue(item, ['maLpm', 'maLPM', 'maLinhVucLpm', 'maLinhVucLPM']) || textValue(lpm, ['ma', 'code']),
    tenLpm: textValue(item, ['tenLpm', 'tenLPM', 'tenLinhVucLpm', 'tenLinhVucLPM']) || textValue(lpm, ['ten', 'name'])
  };
}

function flattenDepartments(items: any[]): DvcDepartmentItem[] {
  const result: DvcDepartmentItem[] = [];
  const visit = (nodes: any[]) => {
    nodes.forEach(node => {
      const department = normalizeDepartment(node);
      if (department.id) result.push(department);
      const children = [node?.children, node?.items, node?.subItems, node?.donViCon, node?.data]
        .find(value => Array.isArray(value));
      if (children) visit(children);
    });
  };
  visit(items);
  return [...new Map(result.map(item => [item.id, item])).values()];
}

function extractExistingMappingValues(data: any): any[] {
  const values: any[] = [];
  const visit = (value: any) => {
    if (value === null || value === undefined) return;
    if (typeof value === 'string') {
      try { visit(JSON.parse(value)); } catch { /* Ignore non-JSON strings. */ }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== 'object') return;
    if (value.idLpm || value.idLPM || value.idThuTucLpm) {
      values.push(value);
      return;
    }
    ['mapGiaTri', 'items', 'data', 'result'].forEach(key => visit(value[key]));
  };
  visit(data);
  return values;
}

function attachExistingMappings(dvcItems: DvcProcedureItem[], mappingData: any) {
  const mappings = extractExistingMappingValues(mappingData);
  return dvcItems.map(item => {
    const existing = mappings.find(mapping => {
      const mappingId = textValue(mapping, ['id', 'idDvc']);
      const mappingCode = textValue(mapping, ['ma', 'maDvc']);
      return (mappingId && mappingId === item.id) || (mappingCode && mappingCode === item.ma);
    });
    return existing ? {
      ...item,
      idLpm: textValue(existing, ['idLpm', 'idLPM', 'idThuTucLpm']),
      maLPM: textValue(existing, ['maLPM', 'maLpm']),
      tenLPM: textValue(existing, ['tenLPM', 'tenLpm'])
    } : item;
  });
}

function scoreMatch(dvc: DvcProcedureItem, lpm: LpmProcedureItem) {
  const dvcCode = normalizeText(dvc.ma);
  const lpmCode = normalizeText(lpm.maThuTuc);
  const dvcName = normalizeText(dvc.ten);
  const lpmName = normalizeText(lpm.tenThuTuc);
  if (dvcCode && lpmCode && dvcCode === lpmCode) return 100;
  if (dvcName && lpmName && dvcName === lpmName) return 95;
  if (dvcName && lpmName && (dvcName.includes(lpmName) || lpmName.includes(dvcName))) return 70;

  const dvcWords = new Set(dvcName.split(' ').filter(word => word.length > 2));
  const lpmWords = new Set(lpmName.split(' ').filter(word => word.length > 2));
  if (dvcWords.size === 0 || lpmWords.size === 0) return 0;
  const overlap = [...dvcWords].filter(word => lpmWords.has(word)).length;
  return Math.round((overlap / Math.max(dvcWords.size, lpmWords.size)) * 60);
}

function buildMappingRows(dvcItems: DvcProcedureItem[], lpmItems: LpmProcedureItem[], mappingData?: any) {
  const existingMappings = extractExistingMappingValues(mappingData);
  return dvcItems.map(dvc => {
    const referenceLpmCode = dvcToLpmReference.get(normalizeText(dvc.ma));
    const referenceCandidates = referenceLpmCode
      ? lpmItems.filter(item => normalizeProcedureReferenceCode(item.maThuTuc) === referenceLpmCode)
      : [];
    const existingMapping = existingMappings.find(mapping => {
      const mappingCode = textValue(mapping, ['ma', 'maDvc']);
      const mappingId = textValue(mapping, ['id', 'idDvc']);
      return (mappingCode && mappingCode === dvc.ma) || (mappingId && mappingId === dvc.ma);
    });
    const persistedLpmId = textValue(existingMapping, ['idLpm', 'idLPM', 'idThuTucLpm']) || dvc.idLpm || '';
    const persistedLpm = persistedLpmId ? lpmItems.find(item => item.id === persistedLpmId) : undefined;
    if (persistedLpm && (referenceCandidates.length === 0 || referenceCandidates.some(item => item.id === persistedLpm.id))) {
      return { dvc, candidates: [persistedLpm], selectedLpmId: persistedLpm.id, status: 'matched' as const };
    }
    if (referenceCandidates.length > 0) {
      return {
        dvc,
        candidates: referenceCandidates.slice(0, 8),
        selectedLpmId: referenceCandidates.length === 1 ? referenceCandidates[0].id : '',
        status: referenceCandidates.length === 1 ? 'matched' as const : 'suggested' as const
      };
    }

    // Không suy đoán theo tên hoặc mã gần đúng; chỉ dùng cặp quy đổi đã cung cấp.
    return {
      dvc,
      candidates: [],
      selectedLpmId: '',
      status: 'unmatched' as const
    };
  });
}

function autoMapRows(rows: MappingRow[], lpmItems: LpmProcedureItem[]) {
  return rows.map(row => {
    const referenceLpmCode = dvcToLpmReference.get(normalizeText(row.dvc.ma));
    const candidates = referenceLpmCode
      ? lpmItems.filter(item => normalizeProcedureReferenceCode(item.maThuTuc) === referenceLpmCode)
      : [];
    if (candidates.length === 1) {
      return { ...row, candidates, selectedLpmId: candidates[0].id, status: 'matched' as const };
    }
    return {
      ...row,
      candidates: candidates.slice(0, 8),
      selectedLpmId: '',
      status: candidates.length > 1 ? 'suggested' as const : 'unmatched' as const
    };
  });
}

export const DvcProcedureMappingView: React.FC<DvcProcedureMappingViewProps> = ({
  tokenStatus,
  onOpenTokenModal
}) => {
  const [dataType, setDataType] = useState<MappingDataType>('LinhVuc');
  const [dataTypeOptions, setDataTypeOptions] = useState<DvcMappingDataTypeOption[]>(FALLBACK_DATA_TYPES);
  const [lpmDomainId, setLpmDomainId] = useState(DEFAULT_LPM_DOMAIN_ID);
  const [dvcDomainId, setDvcDomainId] = useState(DEFAULT_DVC_DOMAIN_ID);
  const [mappingId, setMappingId] = useState('22');
  const [keywordSearch, setKeywordSearch] = useState('');
  const [lpmItems, setLpmItems] = useState<LpmProcedureItem[]>([]);
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [dvcDuplicateCodes, setDvcDuplicateCodes] = useState<string[]>([]);
  const [existingProcedureMappingCount, setExistingProcedureMappingCount] = useState(0);
  const [mappedDomains, setMappedDomains] = useState<DvcLpmDomainItem[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [departments, setDepartments] = useState<DvcDepartmentItem[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showUnmappedOnly, setShowUnmappedOnly] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [processModalRow, setProcessModalRow] = useState<MappingRow | null>(null);
  const [processRows, setProcessRows] = useState<ProcessMappingRow[]>([]);
  const [processLpmItems, setProcessLpmItems] = useState<LpmProcessItem[]>([]);
  const [processScopes, setProcessScopes] = useState<DvhcScopeItem[]>([]);
  const [processLoading, setProcessLoading] = useState(false);
  const [processError, setProcessError] = useState('');
  const [activeMappingTab, setActiveMappingTab] = useState<'procedures' | 'processes'>('procedures');
  const [processOverviewRows, setProcessOverviewRows] = useState<ProcessOverviewRow[]>([]);
  const [processOverviewLoading, setProcessOverviewLoading] = useState(false);
  const [processOverviewError, setProcessOverviewError] = useState('');
  const [processSaving, setProcessSaving] = useState(false);
  const [processSaveMessage, setProcessSaveMessage] = useState('');
  const [processMappingConfigId, setProcessMappingConfigId] = useState('');
  const [processMappingExistingValues, setProcessMappingExistingValues] = useState<any[]>([]);
  const [processMappingReference, setProcessMappingReference] = useState('');
  const [processHasExistingSelection, setProcessHasExistingSelection] = useState(false);
  const [processOverviewSaving, setProcessOverviewSaving] = useState(false);
  const [processOverviewSaveMessage, setProcessOverviewSaveMessage] = useState('');

  const matchedCount = useMemo(() => rows.filter(row => row.selectedLpmId).length, [rows]);
  const unmatchedCount = rows.length - matchedCount;
  const selectedDataType = useMemo(
    () => dataTypeOptions.find(option => option.value === dataType),
    [dataTypeOptions, dataType]
  );
  const visibleRows = useMemo(() => {
    if (!showUnmappedOnly) return rows;
    return rows.filter(row => !row.selectedLpmId);
  }, [rows, showUnmappedOnly]);
  const processOverviewUnreadyCount = useMemo(
    () => processOverviewRows.filter(row => !row.selectedLpmId || !row.selectedScopeId || !row.candidates.some(item => item.id === row.selectedLpmId)).length,
    [processOverviewRows]
  );
  const processOverviewMappedCount = processOverviewRows.length - processOverviewUnreadyCount;
  const processOverviewLpmCount = useMemo(
    () => new Set(processOverviewRows.map(row => row.selectedLpmId).filter(Boolean)).size,
    [processOverviewRows]
  );

  useEffect(() => {
    if (!tokenStatus?.hasToken) return;
    api.getDvcMappingDataTypes().then(result => {
      if (!result.success || result.items.length === 0) return;
      const options = result.items.map(normalizeDataType).filter(item => item.value);
      if (options.length === 0) return;
      setDataTypeOptions(options);
      setDataType(current => {
        const next = options.some(item => item.value === current) ? current : options[0].value;
        const option = options.find(item => item.value === next);
        if (option?.id !== undefined && option?.id !== null && String(option.id).trim()) {
          setMappingId(String(option.id));
        }
        return next;
      });
    });
  }, [tokenStatus?.hasToken]);

  const handleDataTypeChange = (nextType: MappingDataType) => {
    setDataType(nextType);
    const nextOption = dataTypeOptions.find(option => option.value === nextType);
    if (nextOption?.id !== undefined && nextOption?.id !== null && String(nextOption.id).trim()) {
      setMappingId(String(nextOption.id));
    }
    setRows([]);
    setDvcDuplicateCodes([]);
    setLpmItems([]);
    setSelectedDomainId('');
    setMappedDomains([]);
    setSelectedDepartmentId('');
    setError('');
    setMessage('');
    if (isEmployeeDataType(nextType)) {
      void loadDepartments();
      return;
    }
    if (isProcedureDataType(nextType)) {
      void loadMappedDomains();
      return;
    }
    if (!isProcedureDataType(nextType)) {
      setMessage('Loại dữ liệu này đã có trên giao diện, nhưng request đồng bộ cần được bổ sung theo API tương ứng.');
      return;
    }
    void loadLists();
  };

  const loadLists = async (nextLpmDomainId = lpmDomainId, nextDvcDomainId = dvcDomainId) => {
    if (!tokenStatus?.hasToken) {
      setError('Cần nhập Bearer Token trước khi tải danh sách thủ tục.');
      onOpenTokenModal();
      return;
    }
    if (!nextLpmDomainId.trim() || !nextDvcDomainId.trim()) {
      setError('Cần nhập ID lĩnh vực LPM và mã lĩnh vực DVC.');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');
    setDvcDuplicateCodes([]);
    try {
      const [lpmResult, dvcResult, existingResult] = await Promise.all([
        api.getLpmProceduresForDvcMapping(nextLpmDomainId.trim()),
        api.getDvcProceduresForMapping(nextDvcDomainId.trim(), keywordSearch),
        api.getExistingDvcMapping('ThuTuc', '')
      ]);
      if (!lpmResult.success) throw new Error(`LPM: ${lpmResult.message} (HTTP ${lpmResult.httpStatus})`);
      if (!dvcResult.success) throw new Error(`DVC: ${dvcResult.message} (HTTP ${dvcResult.httpStatus})`);

      const nextLpmItems = lpmResult.items.map(normalizeLpmItem).filter(item => item.id);
      const normalizedDvcItems = dvcResult.items.map(normalizeDvcItem).filter(item => item.id || item.ma);
      const deduplicatedDvc = deduplicateDvcProcedures(normalizedDvcItems);
      const nextDvcItems = deduplicatedDvc.items.filter(item => dvcToLpmReference.has(normalizeText(item.ma)));
      const referenceLpmCodes = [...new Set(DVC_PROCEDURE_REFERENCES.map(item => normalizeProcedureReferenceCode(item.maLpm)))];
      const loadedLpmCodes = new Set(nextLpmItems.map(item => normalizeProcedureReferenceCode(item.maThuTuc)));
      const missingLpmCodes = referenceLpmCodes.filter(code => !loadedLpmCodes.has(code));
      const loadedDvcCodes = new Set(deduplicatedDvc.items.map(item => normalizeText(item.ma)));
      const missingDvcCodes = DVC_PROCEDURE_REFERENCES
        .map(item => item.maDvc)
        .filter(code => !loadedDvcCodes.has(normalizeText(code)));
      const existingMappings = existingResult.success
        ? extractExistingMappingValues(existingResult.data || existingResult.items)
        : [];
      const currentDvcCodes = new Set(nextDvcItems.map(item => normalizeText(item.ma)));
      const existingCurrentCount = existingMappings.filter(mapping => {
        const code = textValue(mapping, ['ma', 'id', 'maDvc']);
        return currentDvcCodes.has(normalizeText(code));
      }).length;
      setLpmItems(nextLpmItems);
      setRows(buildMappingRows(nextDvcItems, nextLpmItems, existingResult.success ? existingResult.data : null));
      setDvcDuplicateCodes(deduplicatedDvc.duplicateCodes);
      setExistingProcedureMappingCount(existingCurrentCount);
      const messageParts = [
        `Đã tải ${nextLpmItems.length} thủ tục LPM và ${nextDvcItems.length} thủ tục DVC thuộc danh sách quy đổi (${DVC_PROCEDURE_REFERENCES.length} cặp duy nhất).`
      ];
      if (deduplicatedDvc.duplicateCodes.length > 0) {
        messageParts.push(`Đã loại ${deduplicatedDvc.duplicateCodes.length} bản ghi DVC trùng mã: ${deduplicatedDvc.duplicateCodes.join(', ')}.`);
      } else {
        messageParts.push('Không phát hiện mã thủ tục DVC bị trùng.');
      }
      if (missingLpmCodes.length > 0) {
        messageParts.push(`LPM chưa trả về ${missingLpmCodes.length} mã trong quy đổi: ${missingLpmCodes.join(', ')}.`);
      }
      if (missingDvcCodes.length > 0) {
        messageParts.push(`DVC chưa trả về ${missingDvcCodes.length} mã trong quy đổi: ${missingDvcCodes.join(', ')}.`);
      }
      if (existingResult.success) {
        messageParts.push(`Đã tải ${existingCurrentCount} mapping thủ tục đã lưu từ LPM.`);
      } else {
        messageParts.push(`Chưa tải được mapping thủ tục đã lưu: ${existingResult.message} (HTTP ${existingResult.httpStatus}).`);
      }
      setMessage(messageParts.join(' '));
    } catch (err: any) {
      setError(err?.message || 'Không tải được danh sách thủ tục.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMappedDomains = async () => {
    if (!tokenStatus?.hasToken) {
      setError('Cần nhập Bearer Token trước khi tải danh sách lĩnh vực.');
      onOpenTokenModal();
      return;
    }
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
      const result = await api.getMappedDvcDomains();
      if (!result.success) throw new Error(`${result.message} (HTTP ${result.httpStatus})`);
      const nextDomains = result.items.map(normalizeMappedDomain).filter(item => item.idDvc);
      setMappedDomains(nextDomains);
      setMessage(`Đã tải ${nextDomains.length} lĩnh vực DVC đã ánh xạ LPM.`);
    } catch (err: any) {
      setError(err?.message || 'Không tải được danh sách lĩnh vực đã ánh xạ.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDomainChange = (domainId: string) => {
    const selected = mappedDomains.find(item => item.idDvc === domainId);
    setSelectedDomainId(domainId);
    setRows([]);
    setLpmItems([]);
    if (!selected) return;
    const dvcRequestId = selected.maDvc || selected.idDvc;
    setLpmDomainId(selected.idLpm);
    setDvcDomainId(dvcRequestId);
    void loadLists(selected.idLpm, dvcRequestId);
  };

  const loadDepartments = async () => {
    if (!tokenStatus?.hasToken) {
      setError('Cần nhập Bearer Token trước khi tải danh sách phòng ban.');
      onOpenTokenModal();
      return;
    }
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
      const result = await api.getDvcDepartments();
      if (!result.success) throw new Error(`${result.message} (HTTP ${result.httpStatus})`);
      const nextDepartments = flattenDepartments(result.items);
      setDepartments(nextDepartments);
      setMessage(`Đã tải ${nextDepartments.length} phòng ban. Hãy chọn phòng ban để tải người xử lý.`);
    } catch (err: any) {
      setError(err?.message || 'Không tải được danh sách phòng ban.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadEmployeeMappings = async (phongBanId: string) => {
    if (!phongBanId) return;
    if (!tokenStatus?.hasToken) {
      setError('Cần nhập Bearer Token trước khi tải danh sách người xử lý.');
      onOpenTokenModal();
      return;
    }
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
      const mappingType = textValue(selectedDataType, ['loaiDanhMuc', 'maLoaiDuLieu', 'code', 'value']) || dataType;
      const thamChieuLpm = textValue(selectedDataType, ['thamChieuLpm', 'thamChieuLPM']);
      const [lpmUsersResult, existingResult, dvcUsersResult] = await Promise.all([
        api.getLpmUsers(),
        api.getExistingDvcMapping(mappingType, thamChieuLpm),
        api.getDvcUsersByDepartment(phongBanId, keywordSearch)
      ]);
      if (!lpmUsersResult.success) throw new Error(`LPM: ${lpmUsersResult.message} (HTTP ${lpmUsersResult.httpStatus})`);
      if (!existingResult.success) throw new Error(`Mapping: ${existingResult.message} (HTTP ${existingResult.httpStatus})`);
      if (!dvcUsersResult.success) throw new Error(`DVC: ${dvcUsersResult.message} (HTTP ${dvcUsersResult.httpStatus})`);

      const nextLpmUsers = lpmUsersResult.items.map(normalizeLpmItem).filter(item => item.id);
      const nextDvcUsers = dvcUsersResult.items.map(normalizeDvcItem).filter(item => item.id || item.ma);
      const mappedDvcUsers = attachExistingMappings(nextDvcUsers, existingResult.data || existingResult.items);
      setLpmItems(nextLpmUsers);
      setRows(buildMappingRows(mappedDvcUsers, nextLpmUsers));
      setMessage(`Đã tải ${nextDvcUsers.length} người DVC, ${nextLpmUsers.length} người LPM và mapping đã lưu.`);
    } catch (err: any) {
      setError(err?.message || 'Không tải được danh sách người xử lý.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSelected = () => {
    if (isEmployeeDataType(dataType)) {
      if (selectedDepartmentId) void loadEmployeeMappings(selectedDepartmentId);
      else void loadDepartments();
      return;
    }
    if (isProcedureDataType(dataType)) {
      if (selectedDomainId) void loadLists();
      else void loadMappedDomains();
    }
  };

  const handleDepartmentChange = (departmentId: string) => {
    setSelectedDepartmentId(departmentId);
    setRows([]);
    setLpmItems([]);
    if (departmentId) void loadEmployeeMappings(departmentId);
  };

  const updateRow = (index: number, selectedLpmId: string) => {
    setRows(previous => previous.map((row, rowIndex) => rowIndex === index
      ? { ...row, selectedLpmId, status: selectedLpmId ? 'matched' : 'unmatched' }
      : row));
  };

  const openProcessMapping = async (row: MappingRow) => {
    const lpmProcedure = lpmItems.find(item => item.id === row.selectedLpmId);
    if (!lpmProcedure) {
      setError('Hãy mapping thủ tục LPM trước khi mapping quy trình.');
      return;
    }
    if (!tokenStatus?.hasToken) {
      setError('Cần nhập Bearer Token trước khi tải quy trình mapping.');
      onOpenTokenModal();
      return;
    }

    setProcessModalRow(row);
    setProcessRows([]);
    setProcessLpmItems([]);
    setProcessScopes([]);
    setProcessHasExistingSelection(false);
    setProcessMappingConfigId('');
    setProcessMappingExistingValues([]);
    setProcessMappingReference('');
    setProcessError('');
    setProcessSaveMessage('');
    setProcessLoading(true);
    try {
      const [lpmResult, dvhcResult, existingResult, dvcResult] = await Promise.all([
        api.getLpmProcessesForDvcMapping(lpmProcedure.id),
        api.getDvhcTreeForDvcMapping(),
        // QuyTrinh được lưu chung theo tỉnh, không lọc theo từng thủ tục LPM.
        api.getExistingDvcMapping('QuyTrinh', ''),
        api.getDvcProcessesForDvcMapping(row.dvc.ma || row.dvc.id)
      ]);
      if (!lpmResult.success) throw new Error(`LPM: ${lpmResult.message} (HTTP ${lpmResult.httpStatus})`);
      if (!existingResult.success) throw new Error(`Mapping cũ: ${existingResult.message} (HTTP ${existingResult.httpStatus})`);
      if (!dvcResult.success) throw new Error(`DVC: ${dvcResult.message} (HTTP ${dvcResult.httpStatus})`);

      const nextLpmProcesses = lpmResult.items.map(normalizeLpmProcess).filter(item => item.id && item.maQuyTrinh);
      const nextDvcProcesses = dvcResult.items.map(normalizeDvcProcess).filter(item => item.id || item.ma);
      const nextScopes = dvhcResult.success ? flattenDvhcScopes(dvhcResult.items) : [];
      const existingMappingData = existingResult.data || existingResult.items;
      const existingValues = extractProcessMappings(existingMappingData);
      const procedureDvcCode = row.dvc.ma || row.dvc.id;
      const nextRows = buildProcessMappingRows(nextDvcProcesses, nextLpmProcesses, nextScopes, existingMappingData);
      setProcessLpmItems(nextLpmProcesses);
      setProcessScopes(nextScopes);
      setProcessRows(nextRows);
      setProcessMappingConfigId(extractMappingConfigId(existingMappingData));
      setProcessMappingExistingValues(existingValues);
      setProcessMappingReference(extractMappingConfigReference(existingMappingData));
      setProcessHasExistingSelection(existingValues.some(item =>
        textValue(item, ['idThuTucDvc', 'idThuTucDVC']) === procedureDvcCode &&
        nextRows.some(processRow => processRow.selectedLpmId && processRow.dvc.id === textValue(item, ['idQuyTrinhDVC', 'idQuyTrinhDvc', 'id', 'ma']))
      ));
      if (!dvhcResult.success) {
        setProcessError(`Không tải được đơn vị hành chính: ${dvhcResult.message} (HTTP ${dvhcResult.httpStatus}). Bạn vẫn có thể kiểm tra mapping quy trình.`);
      }
    } catch (err: any) {
      setProcessError(err?.message || 'Không tải được dữ liệu mapping quy trình.');
    } finally {
      setProcessLoading(false);
    }
  };

  const saveProcessMapping = async () => {
    if (!processModalRow) return;
    const lpmProcedure = lpmItems.find(item => item.id === processModalRow.selectedLpmId);
    if (!lpmProcedure) {
      setProcessError('Thiếu thủ tục LPM tham chiếu để lưu ánh xạ quy trình.');
      return;
    }
    if (processRows.length === 0) {
      setProcessError('Chưa có quy trình DVC để lưu.');
      return;
    }
    if (!tokenStatus?.hasToken) {
      setProcessError('Cần nhập Bearer Token trước khi lưu ánh xạ quy trình.');
      onOpenTokenModal();
      return;
    }

    const mappedProcessRows = processRows.filter(row => row.selectedLpmId && row.selectedScopeId);
    if (mappedProcessRows.length === 0) {
      setProcessError('Chưa có quy trình nào đủ mapping và đơn vị hành chính để lưu.');
      return;
    }

    const lpmById = new Map(processLpmItems.map(item => [item.id, item]));
    const mapGiaTri = mappedProcessRows.map(row => {
      const lpm = lpmById.get(row.selectedLpmId);
      return {
        id: row.dvc.id || row.dvc.ma,
        ma: row.dvc.ma || row.dvc.id,
        ten: row.dvc.ten || '',
        idLpm: lpm?.id || '',
        maLPM: '',
        tenLPM: '',
        idThuTucDvc: processModalRow.dvc.ma || processModalRow.dvc.id,
        idDvhcLPM: row.selectedScopeId || '',
        idQuyTrinhLpm: lpm?.id || ''
      };
    });

    setProcessSaving(true);
    setProcessError('');
    setProcessSaveMessage('');
    try {
      const mappingConfigId = Number(processMappingConfigId);
      const currentProcedureId = processModalRow.dvc.ma || processModalRow.dvc.id;
      const existingValuesForProcedure = processMappingExistingValues.filter(item =>
        textValue(item, ['idThuTucDvc', 'idThuTucDVC']) === currentProcedureId
      );
      const result = processHasExistingSelection
        ? !Number.isFinite(mappingConfigId) || mappingConfigId <= 0
          ? { success: false, message: 'Không tìm thấy id cấu hình ánh xạ quy trình hiện có để gọi Edit. Hãy tải lại dữ liệu mapping trước.', httpStatus: 0 }
          : await api.editDvcProcedureMapping({
            id: mappingConfigId,
            loaiDanhMuc: 'QuyTrinh',
            mapGiaTri: mergeProcessMappings(existingValuesForProcedure, mapGiaTri),
            thamChieuLpm: processMappingReference || lpmProcedure.id,
            apiDvc: '',
            moTa: ''
          })
        : await api.addDvcProcessMapping({
          mapGiaTri,
          thamChieuLpm: lpmProcedure.id,
          apiDvc: '',
          moTa: ''
        });
      if (!result.success) {
        setProcessError(`${result.message} (HTTP ${result.httpStatus})`);
        return;
      }
      const skippedCount = processRows.length - mappedProcessRows.length;
      setProcessSaveMessage(`Đã lưu ánh xạ ${mapGiaTri.length} quy trình${skippedCount > 0 ? `, bỏ qua ${skippedCount} dòng chưa đủ mapping.` : '.'}`);
    } catch (err: any) {
      setProcessError(err?.message || 'Không lưu được ánh xạ quy trình.');
    } finally {
      setProcessSaving(false);
    }
  };

  const updateProcessRow = (index: number, field: 'lpm' | 'scope', value: string) => {
    setProcessRows(previous => previous.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      if (field === 'scope') return { ...row, selectedScopeId: value };
      return { ...row, selectedLpmId: value, status: value ? 'matched' : 'unmatched' };
    }));
  };

  const autoMapProcessRows = () => {
    setProcessRows(previous => previous.map(row => {
      const candidates = processLpmItems.filter(item => processBaseCode(item.maQuyTrinh) === processBaseCode(row.dvc.ma));
      return {
        ...row,
        candidates,
        selectedLpmId: candidates.length === 1 ? candidates[0].id : row.selectedLpmId,
        status: candidates.length === 1 ? 'matched' as const : candidates.length > 1 ? 'suggested' as const : row.selectedLpmId ? 'matched' as const : 'unmatched' as const
      };
    }));
  };

  const loadProcessOverview = async () => {
    if (!tokenStatus?.hasToken) {
      setProcessOverviewError('Cần nhập Bearer Token trước khi tải danh sách quy trình.');
      onOpenTokenModal();
      return;
    }
    const mappedProcedures = rows.filter(row =>
      row.selectedLpmId && dvcToLpmReference.has(normalizeText(row.dvc.ma))
    );
    if (mappedProcedures.length === 0) {
      setProcessOverviewRows([]);
      setProcessOverviewError('Chưa có thủ tục nào được mapping sang LPM.');
      return;
    }

    setProcessOverviewLoading(true);
    setProcessOverviewError('');
    setProcessOverviewSaveMessage('');
    setProcessOverviewRows([]);
    try {
      const [dvhcResult, existingResult] = await Promise.all([
        api.getDvhcTreeForDvcMapping(),
        // QuyTrinh được lưu chung theo tỉnh, không lọc theo từng thủ tục LPM.
        api.getExistingDvcMapping('QuyTrinh', '')
      ]);
      const scopes = dvhcResult.success ? flattenDvhcScopes(dvhcResult.items) : [];
      setProcessScopes(scopes);
      const existingMappingData = existingResult.success ? (existingResult.data || existingResult.items) : null;
      setProcessMappingConfigId(extractMappingConfigId(existingMappingData));
      setProcessMappingExistingValues(extractProcessMappings(existingMappingData));
      setProcessMappingReference(extractMappingConfigReference(existingMappingData));
      const overview: ProcessOverviewRow[] = [];

      for (const procedure of mappedProcedures) {
        const lpmProcedure = lpmItems.find(item => item.id === procedure.selectedLpmId);
        if (!lpmProcedure) continue;
        const [lpmResult, dvcResult] = await Promise.all([
          api.getLpmProcessesForDvcMapping(lpmProcedure.id),
          api.getDvcProcessesForDvcMapping(procedure.dvc.ma || procedure.dvc.id)
        ]);
        if (!lpmResult.success || !dvcResult.success) continue;
        const lpmProcesses = lpmResult.items.map(normalizeLpmProcess).filter(item => item.id && item.maQuyTrinh);
        const dvcProcesses = dvcResult.items.map(normalizeDvcProcess).filter(item => item.id || item.ma);
        const processRowsForProcedure = buildProcessMappingRows(dvcProcesses, lpmProcesses, scopes, existingMappingData);
        processRowsForProcedure.forEach(processRow => overview.push({ ...processRow, procedure }));
      }

      setProcessOverviewRows(overview);
      if (!dvhcResult.success) setProcessOverviewError(`Đã tải quy trình nhưng chưa tải được đơn vị hành chính (HTTP ${dvhcResult.httpStatus}).`);
    } catch (err: any) {
      setProcessOverviewError(err?.message || 'Không tải được danh sách quy trình.');
    } finally {
      setProcessOverviewLoading(false);
    }
  };

  const saveProcessOverview = async () => {
    if (!tokenStatus?.hasToken) {
      setProcessOverviewError('Cần nhập Bearer Token trước khi lưu ánh xạ quy trình.');
      onOpenTokenModal();
      return;
    }
    if (processOverviewRows.length === 0) {
      setProcessOverviewError('Chưa có danh sách quy trình để lưu. Hãy tải lại quy trình trước.');
      return;
    }
    const savableRows = processOverviewRows.filter(row =>
      row.selectedLpmId && row.selectedScopeId && row.candidates.some(item => item.id === row.selectedLpmId)
    );
    if (savableRows.length === 0) {
      setProcessOverviewError('Chưa có quy trình nào đủ mapping và đơn vị hành chính để lưu.');
      return;
    }
    const skippedCount = processOverviewRows.length - savableRows.length;

    setProcessOverviewSaving(true);
    setProcessOverviewError('');
    setProcessOverviewSaveMessage('');
    try {
      const mapGiaTri = savableRows.map(row => {
          const lpm = row.candidates.find(item => item.id === row.selectedLpmId);
          return {
            id: row.dvc.id || row.dvc.ma,
            ma: row.dvc.ma || row.dvc.id,
            ten: row.dvc.ten || '',
            idLpm: lpm?.id || '',
            maLPM: '',
            tenLPM: '',
            idThuTucDvc: row.procedure.dvc.ma || row.procedure.dvc.id,
            idDvhcLPM: row.selectedScopeId,
            idQuyTrinhLpm: lpm?.id || ''
          };
        });
      const mappingConfigId = Number(processMappingConfigId);
      const result = Number.isFinite(mappingConfigId) && mappingConfigId > 0
        ? await api.editDvcProcedureMapping({
          id: mappingConfigId,
          loaiDanhMuc: 'QuyTrinh',
          mapGiaTri: mergeProcessMappings(processMappingExistingValues, mapGiaTri),
          thamChieuLpm: processMappingReference || savableRows[0].procedure.selectedLpmId,
          apiDvc: '',
          moTa: ''
        })
        : await api.addDvcProcessMapping({
          mapGiaTri,
          thamChieuLpm: savableRows[0].procedure.selectedLpmId,
          apiDvc: '',
          moTa: ''
        });
      if (!result.success) throw new Error(`${result.message} (HTTP ${result.httpStatus})`);
      const savedCount = mapGiaTri.length;
      setProcessOverviewSaveMessage(`Đã lưu riêng ${savedCount} ánh xạ quy trình${skippedCount > 0 ? `, bỏ qua ${skippedCount} dòng chưa đủ mapping.` : '.'}`);
    } catch (err: any) {
      setProcessOverviewError(err?.message || 'Không lưu được ánh xạ quy trình.');
    } finally {
      setProcessOverviewSaving(false);
    }
  };

  const handleAutoMap = () => {
    if (!isSupportedMappingType(dataType) || rows.length === 0) return;
    setRows(previous => autoMapRows(previous, lpmItems));
    setMessage('Đã tự mapping các dòng có mã hoặc tên khớp chính xác. Các dòng gợi ý cần kiểm tra lại.');
    setError('');
  };

  const saveMapping = async () => {
    const isProcedureMapping = isProcedureDataType(dataType);

    if (!tokenStatus?.hasToken) {
      setError('Cần nhập Bearer Token trước khi lưu mapping.');
      onOpenTokenModal();
      return;
    }
    if (rows.length === 0) {
      setError('Chưa có dữ liệu mapping để lưu.');
      return;
    }
    if (!Number.isFinite(Number(mappingId))) {
      setError('ID cấu hình MapDanhMucDvc không hợp lệ.');
      return;
    }
    if (unmatchedCount > 0) {
      setError(`Còn ${unmatchedCount} thủ tục DVC chưa mapping. Hãy chọn thủ tục LPM trước khi lưu.`);
      return;
    }

    const lpmById = new Map(lpmItems.map(item => [item.id, item]));
    const mapGiaTri: DvcMappingValue[] = rows.map(row => {
      const lpm = lpmById.get(row.selectedLpmId);
      return {
        id: employeeMode ? row.dvc.id : row.dvc.ma || row.dvc.id,
        ma: row.dvc.ma || row.dvc.id,
        ten: row.dvc.ten,
        idLpm: lpm?.id || row.dvc.idLpm || '',
        maLPM: employeeMode ? (lpm?.maThuTuc || row.dvc.maLPM || '') : '',
        tenLPM: employeeMode ? (lpm?.tenThuTuc || row.dvc.tenLPM || '') : ''
      };
    });

    setIsSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await api.editDvcProcedureMapping({
        // Lưu thủ tục dùng endpoint Edit và payload riêng của loại ThuTuc.
        // Không dùng id/loaiDanhMuc của luồng lưu quy trình ở đây.
        id: isProcedureMapping ? 22 : Number(mappingId),
        loaiDanhMuc: isProcedureMapping
          ? 'ThuTuc'
          : textValue(selectedDataType, ['loaiDanhMuc', 'maLoaiDuLieu', 'code', 'value']) || dataType,
        mapGiaTri,
        apiDvc: isProcedureMapping ? '' : textValue(selectedDataType, ['apiDvc', 'apiDVC']),
        thamChieuLpm: isProcedureMapping ? '' : textValue(selectedDataType, ['thamChieuLpm', 'thamChieuLPM']),
        moTa: isProcedureMapping ? '' : textValue(selectedDataType, ['moTa', 'description'])
      });
      if (!result.success) {
        const permissionError = /user grant|chức năng này chưa được đăng ký|permission|quyền/i.test(result.message || '');
        if (permissionError) {
          setError(`${result.message} (HTTP ${result.httpStatus}). Lưu từng dòng cũng sẽ bị từ chối nếu token chưa có quyền.`);
          return;
        }

        setMessage(`Lưu hàng loạt thất bại (HTTP ${result.httpStatus}), đang thử lưu tuần tự từng thủ tục...`);
        for (let index = 0; index < mapGiaTri.length; index += 1) {
          const sequentialResult = await api.editDvcProcedureMapping({
            id: isProcedureMapping ? 22 : Number(mappingId),
            loaiDanhMuc: isProcedureMapping
              ? 'ThuTuc'
              : textValue(selectedDataType, ['loaiDanhMuc', 'maLoaiDuLieu', 'code', 'value']) || dataType,
            mapGiaTri: mapGiaTri.slice(0, index + 1),
            apiDvc: isProcedureMapping ? '' : textValue(selectedDataType, ['apiDvc', 'apiDVC']),
            thamChieuLpm: isProcedureMapping ? '' : textValue(selectedDataType, ['thamChieuLpm', 'thamChieuLPM']),
            moTa: isProcedureMapping ? '' : textValue(selectedDataType, ['moTa', 'description'])
          });
          if (!sequentialResult.success) {
            throw new Error(`Lỗi tại thủ tục ${mapGiaTri[index].ma}: ${sequentialResult.message} (HTTP ${sequentialResult.httpStatus}). Lỗi hàng loạt ban đầu: ${result.message}`);
          }
          setMessage(`Đang lưu tuần tự ${index + 1}/${mapGiaTri.length} thủ tục...`);
        }
        setMessage(`Đã lưu tuần tự ${mapGiaTri.length} mapping thủ tục DVC - LPM.`);
        return;
      }
      setMessage(`Đã lưu ${mapGiaTri.length} mapping thủ tục DVC - LPM.`);
    } catch (err: any) {
      setError(err?.message || 'Không lưu được mapping.');
    } finally {
      setIsSaving(false);
    }
  };

  const employeeMode = isEmployeeDataType(dataType);
  const sourceColumnLabel = employeeMode ? 'Tài khoản DVC' : 'Mã / Tên thủ tục DVC';
  const targetColumnLabel = employeeMode ? 'Ánh xạ đến tài khoản LPM' : 'Ánh xạ đến thủ tục LPM';

  return (
    <div className="p-6 space-y-5">
      <section className="rounded-2xl border border-blue-900/70 bg-gradient-to-br from-blue-950/70 to-slate-950 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-blue-300">Danh mục dữ liệu</div>
            <h1 className="mt-2 text-2xl font-bold text-white">Ánh xạ dữ liệu</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">Chọn loại dữ liệu để tải request tương ứng, tự động mapping hoặc chọn thủ công rồi lưu.</p>
          </div>
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-xs text-cyan-200">Thủ tục: DVC → LPM</div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="mb-4 border-b border-blue-500/60 pb-3 text-sm font-semibold text-white">Bộ lọc</div>
        <div className="grid gap-4 lg:grid-cols-[260px_1fr_auto] lg:items-end">
          <label className="text-xs text-slate-400">Chọn loại dữ liệu
            <select value={dataType} onChange={event => handleDataTypeChange(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500">
              {dataTypeOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400">Từ khóa
            <input value={keywordSearch} onChange={event => setKeywordSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && isSupportedMappingType(dataType)) handleLoadSelected(); }} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500" placeholder="Nhập từ khóa tìm kiếm" />
          </label>
          <button onClick={handleLoadSelected} disabled={isLoading || !isSupportedMappingType(dataType)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Tìm kiếm
          </button>
        </div>
        {employeeMode && <label className="mt-4 block max-w-[620px] text-xs text-slate-400">Phòng ban
          <select value={selectedDepartmentId} onChange={event => handleDepartmentChange(event.target.value)} disabled={isLoading || departments.length === 0} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500">
            <option value="">-- Chọn phòng ban --</option>
            {departments.map(department => <option key={department.id} value={department.id}>{department.label}</option>)}
          </select>
        </label>}
        {isProcedureDataType(dataType) && <label className="mt-4 block max-w-[620px] text-xs text-slate-400">Lĩnh vực
          <select value={selectedDomainId} onChange={event => handleDomainChange(event.target.value)} disabled={isLoading || mappedDomains.length === 0} className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500">
            <option value="">-- Toàn bộ --</option>
            {mappedDomains.map(domain => <option key={domain.idDvc} value={domain.idDvc}>{domain.tenDvc || domain.maDvc} {domain.maDvc ? `(${domain.maDvc})` : ''}{domain.tenLpm ? ` → ${domain.tenLpm}` : ''}</option>)}
          </select>
        </label>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={showUnmappedOnly} onChange={event => setShowUnmappedOnly(event.target.checked)} className="h-4 w-4 accent-blue-500" />Hiển thị dữ liệu chưa ánh xạ</label>
          <div className="flex flex-wrap gap-2">
            <input value={lpmDomainId} onChange={event => setLpmDomainId(event.target.value)} className="w-64 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-[10px] text-slate-400" title="ID lĩnh vực LPM" />
            <input value={dvcDomainId} onChange={event => setDvcDomainId(event.target.value)} className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-[10px] text-slate-400" title="Mã lĩnh vực DVC" />
            <input value={mappingId} onChange={event => setMappingId(event.target.value)} className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-[10px] text-slate-400" title="ID cấu hình mapping" />
          </div>
        </div>
      </section>

      {error && <div className="rounded-xl border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200"><ShieldAlert className="mr-2 inline h-4 w-4" />{error}</div>}
      {message && <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200"><CheckCircle2 className="mr-2 inline h-4 w-4" />{message}</div>}

      {isProcedureDataType(dataType) && <section className="overflow-hidden rounded-2xl border border-cyan-900/70 bg-slate-900/60">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-3"><FileSpreadsheet className="h-5 w-5 text-emerald-300" /><div><h2 className="font-semibold text-white">Bảng quy ước mã mapping thủ tục</h2><p className="mt-1 text-xs text-slate-500">{DVC_PROCEDURE_REFERENCES.length} cặp mã LPM - DVC được dùng để tự mapping thủ tục.</p></div></div>
          <a href={mappingWorkbookUrl} download="mapping_thu_tuc_quy_trinh.xlsx" className="inline-flex items-center gap-2 rounded-lg border border-cyan-700 bg-cyan-950/40 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-900/60"><Download className="h-4 w-4" />Tải file Excel mapping</a>
        </div>
        <div className="max-h-64 overflow-auto">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="sticky top-0 bg-slate-950 text-slate-400"><tr><th className="w-16 px-5 py-3">#</th><th className="px-5 py-3">Mã thủ tục LPM</th><th className="px-5 py-3">Mã thủ tục DVC</th><th className="px-5 py-3">Quy ước</th></tr></thead>
            <tbody className="divide-y divide-slate-800">{DVC_PROCEDURE_REFERENCES.map((item, index) => <tr key={`${item.maLpm}-${item.maDvc}`}><td className="px-5 py-2 text-slate-500">{index + 1}</td><td className="px-5 py-2 font-mono text-blue-300">{item.maLpm}</td><td className="px-5 py-2 font-mono text-cyan-300">{item.maDvc}</td><td className="px-5 py-2 text-slate-400">Mã tham chiếu</td></tr>)}</tbody>
          </table>
        </div>
      </section>}

      <div className="flex gap-2 border-b border-slate-800">
        <button type="button" onClick={() => setActiveMappingTab('procedures')} className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeMappingTab === 'procedures' ? 'border-blue-400 text-blue-300' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Danh sách thủ tục</button>
        <button type="button" onClick={() => { setActiveMappingTab('processes'); void loadProcessOverview(); }} className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeMappingTab === 'processes' ? 'border-violet-400 text-violet-300' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Danh sách quy trình</button>
      </div>

      <section className={`${activeMappingTab === 'procedures' ? '' : 'hidden'} overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div><h2 className="font-semibold text-white">Danh sách ánh xạ</h2><p className="mt-1 text-xs text-slate-500">Dữ liệu màu vàng là gợi ý, cần kiểm tra trước khi lưu.</p></div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleAutoMap} disabled={!isSupportedMappingType(dataType) || rows.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"><RefreshCw className="h-4 w-4" />Tự động mapping</button>
            <button onClick={handleLoadSelected} disabled={isLoading || !isSupportedMappingType(dataType)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"><RefreshCw className="h-4 w-4" />Đồng bộ dữ liệu</button>
            <button onClick={saveMapping} disabled={isSaving || rows.length === 0 || unmatchedCount > 0} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"><Save className="h-4 w-4" />Lưu</button>
          </div>
        </div>
        <div className="grid gap-3 border-b border-slate-800 bg-slate-950/40 px-5 py-3 text-xs sm:grid-cols-4"><div><span className="text-slate-500">LPM: </span><span className="font-semibold text-blue-300">{lpmItems.length}</span></div><div><span className="text-slate-500">DVC: </span><span className="font-semibold text-cyan-300">{rows.length}</span></div><div><span className="text-slate-500">Đã ánh xạ: </span><span className="font-semibold text-emerald-300">{matchedCount}</span></div><div><span className="text-slate-500">Chưa ánh xạ: </span><span className="font-semibold text-amber-300">{unmatchedCount}</span></div></div>
        {rows.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">Chọn loại dữ liệu và nhấn Tìm kiếm để tải dữ liệu.</div> : <div className="max-h-[650px] overflow-auto"><table className="w-full min-w-[1180px] text-left text-xs"><thead className="sticky top-0 bg-slate-950 text-slate-400"><tr><th className="w-12 px-4 py-3">#</th><th className="w-[330px] px-4 py-3">{sourceColumnLabel}</th><th className="px-4 py-3">{targetColumnLabel}</th><th className="w-[280px] px-4 py-3">ID LPM</th><th className="w-48 px-4 py-3">Trạng thái</th></tr></thead><tbody className="divide-y divide-slate-800">{visibleRows.map((row, index) => { const selected = lpmItems.find(item => item.id === row.selectedLpmId); return <tr key={`${row.dvc.id}-${index}`} className={row.status === 'suggested' ? 'bg-amber-500/[0.04]' : ''}><td className="px-4 py-3 text-slate-500">{index + 1}</td><td className="px-4 py-3"><div className="font-mono text-cyan-300">Mã: {row.dvc.ma || row.dvc.id}</div><div className="mt-1 line-clamp-2 break-words text-slate-200" title={row.dvc.ten}>Tên: {row.dvc.ten || '—'}</div><div className="mt-1 font-mono text-[10px] text-slate-500">ID DVC: {row.dvc.id}</div></td><td className="px-4 py-3"><LpmProcedurePicker value={row.selectedLpmId} items={lpmItems} onChange={value => updateRow(rows.indexOf(row), value)} />{row.selectedLpmId && <button type="button" onClick={() => void openProcessMapping(row)} className="mt-2 text-xs font-medium text-blue-300 hover:text-blue-200 hover:underline">Ánh xạ quy trình</button>}</td><td className="px-4 py-3 font-mono text-[10px] text-blue-300">{selected?.id || '—'}</td><td className="px-4 py-3">{row.selectedLpmId ? <span className="inline-flex items-center gap-1 text-emerald-300"><CheckCircle2 className="h-4 w-4" />{row.status === 'suggested' ? 'Gợi ý, kiểm tra' : 'Đã khớp'}</span> : <span className="inline-flex items-center gap-1 text-amber-300"><XCircle className="h-4 w-4" />Chưa khớp</span>}</td></tr>; })}</tbody></table></div>}
      </section>

      <section className={`${activeMappingTab === 'processes' ? '' : 'hidden'} overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div><h2 className="font-semibold text-white">Danh sách quy trình</h2><p className="mt-1 text-xs text-slate-500">Các thủ tục đã mapping LPM sẽ được tải quy trình và đối chiếu mã tự động.</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void loadProcessOverview()} disabled={processOverviewLoading || processOverviewSaving || rows.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${processOverviewLoading ? 'animate-spin' : ''}`} />Tải lại quy trình</button>
            <button type="button" onClick={() => void saveProcessOverview()} disabled={processOverviewSaving || processOverviewLoading || processOverviewMappedCount === 0} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">{processOverviewSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Lưu ánh xạ quy trình</button>
          </div>
        </div>
        {processOverviewError && <div className="mx-5 mt-4 rounded-lg border border-amber-500/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-200"><ShieldAlert className="mr-2 inline h-4 w-4" />{processOverviewError}</div>}
        {processOverviewSaveMessage && <div className="mx-5 mt-4 rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200"><CheckCircle2 className="mr-2 inline h-4 w-4" />{processOverviewSaveMessage}</div>}
        <div className="grid gap-3 border-b border-slate-800 bg-slate-950/40 px-5 py-3 text-xs sm:grid-cols-4"><div><span className="text-slate-500">Quy trình LPM: </span><span className="font-semibold text-blue-300">{processOverviewLpmCount}</span></div><div><span className="text-slate-500">Quy trình DVC: </span><span className="font-semibold text-cyan-300">{processOverviewRows.length}</span></div><div><span className="text-slate-500">Đã ánh xạ: </span><span className="font-semibold text-emerald-300">{processOverviewMappedCount}</span></div><div><span className="text-slate-500">Chưa ánh xạ: </span><span className="font-semibold text-amber-300">{processOverviewUnreadyCount}</span></div></div>
        {processOverviewLoading ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-400"><Loader2 className="h-5 w-5 animate-spin" />Đang tải danh sách quy trình...</div> : processOverviewRows.length === 0 ? <div className="p-12 text-center text-sm text-slate-500">Chưa có dữ liệu quy trình. Hãy mapping thủ tục trước rồi tải lại.</div> : <div className="max-h-[650px] overflow-auto"><table className="w-full min-w-[1180px] text-left text-xs"><thead className="sticky top-0 bg-slate-950 text-slate-400"><tr><th className="w-12 px-4 py-3">#</th><th className="w-[280px] px-4 py-3">Thủ tục DVC</th><th className="w-[360px] px-4 py-3">Quy trình DVC</th><th className="w-[360px] px-4 py-3">Quy trình LPM</th><th className="w-[260px] px-4 py-3">Đơn vị hành chính</th><th className="w-48 px-4 py-3">Trạng thái</th></tr></thead><tbody className="divide-y divide-slate-800">{processOverviewRows.map((row, index) => { const lpm = row.candidates.find(item => item.id === row.selectedLpmId); const scope = processScopes.find(item => item.scopeId === row.selectedScopeId); const status = row.selectedLpmId && row.selectedScopeId ? 'Sẵn sàng lưu' : row.selectedLpmId ? 'Thiếu đơn vị' : row.status === 'suggested' ? 'Cần chọn' : 'Chưa khớp'; return <tr key={`${row.procedure.dvc.id}-${row.dvc.id}-${index}`} className={row.status === 'suggested' ? 'bg-amber-500/[0.04]' : ''}><td className="px-4 py-3 text-slate-500">{index + 1}</td><td className="px-4 py-3"><div className="font-mono text-cyan-300">{row.procedure.dvc.ma || row.procedure.dvc.id}</div><div className="mt-1 line-clamp-2 text-slate-300">{row.procedure.dvc.ten}</div></td><td className="px-4 py-3"><div className="font-mono text-cyan-300">{row.dvc.ma || row.dvc.id}</div><div className="mt-1 line-clamp-2 text-slate-300">{row.dvc.ten}</div></td><td className="px-4 py-3">{lpm ? <><div className="font-mono text-blue-300">{lpm.maQuyTrinh}</div><div className="mt-1 line-clamp-2 text-slate-300">{lpm.tenQuyTrinh}</div></> : <span className="text-slate-500">—</span>}</td><td className="px-4 py-3 text-slate-300">{scope ? `${scope.scopeName} (${scope.scopeCode})` : '—'}</td><td className="px-4 py-3">{status === 'Sẵn sàng lưu' ? <span className="text-emerald-300">● {status}</span> : status === 'Cần chọn' || status === 'Thiếu đơn vị' ? <span className="text-amber-300">● {status}</span> : <span className="text-slate-400">● {status}</span>}</td></tr>; })}</tbody></table></div>}
      </section>

      {processModalRow && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true">
        <div className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-slate-700 px-5 py-4">
            <div className="min-w-0"><h2 className="text-lg font-semibold text-white">Ánh xạ quy trình thuộc thủ tục {processModalRow.dvc.ten || processModalRow.dvc.ma}</h2><p className="mt-1 text-xs text-slate-400">Đối chiếu mã quy trình DVC với mã quy trình LPM và chọn đơn vị hành chính áp dụng.</p></div>
            <button type="button" onClick={() => setProcessModalRow(null)} className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Đóng"><X className="h-5 w-5" /></button>
          </div>
          <div className="flex items-center justify-between gap-3 border-b border-slate-700 bg-slate-950/50 px-5 py-3 text-xs">
            <span className="text-slate-400">Quy trình DVC: <b className="font-mono text-cyan-300">{processRows.length}</b> • Quy trình LPM: <b className="font-mono text-blue-300">{processLpmItems.length}</b></span>
            <button type="button" onClick={autoMapProcessRows} disabled={processLoading || processRows.length === 0} className="rounded-lg bg-violet-600 px-3 py-2 font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50">Tự động mapping theo mã</button>
          </div>
          {processError && <div className="mx-5 mt-4 rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-3 text-sm text-red-200"><ShieldAlert className="mr-2 inline h-4 w-4" />{processError}</div>}
          {processSaveMessage && <div className="mx-5 mt-4 rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200"><CheckCircle2 className="mr-2 inline h-4 w-4" />{processSaveMessage}</div>}
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {processLoading ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-slate-400"><Loader2 className="h-5 w-5 animate-spin" />Đang tải dữ liệu mapping quy trình...</div> : processRows.length === 0 ? <div className="p-12 text-center text-sm text-slate-500">Không có quy trình DVC cho thủ tục này.</div> : <table className="w-full min-w-[980px] text-left text-xs"><thead className="sticky top-0 bg-slate-950 text-slate-400"><tr><th className="w-12 px-3 py-3">#</th><th className="w-[360px] px-3 py-3">Quy trình DVC</th><th className="w-[390px] px-3 py-3">Ánh xạ đến quy trình LPM</th><th className="w-[300px] px-3 py-3">Đơn vị hành chính áp dụng</th></tr></thead><tbody className="divide-y divide-slate-800">{processRows.map((row, index) => { const selected = processLpmItems.find(item => item.id === row.selectedLpmId); return <tr key={`${row.dvc.id}-${index}`} className={row.status === 'suggested' ? 'bg-amber-500/[0.04]' : ''}><td className="px-3 py-4 text-slate-500">{index + 1}</td><td className="px-3 py-4"><div className="font-mono text-cyan-300">Mã: {row.dvc.ma || row.dvc.id}</div><div className="mt-1 break-words leading-5 text-slate-200">Tên: {row.dvc.ten || '—'}</div></td><td className="px-3 py-4"><select value={row.selectedLpmId} onChange={event => updateProcessRow(index, 'lpm', event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-blue-500"><option value="">-- Chọn quy trình LPM --</option>{(row.candidates.length > 0 ? row.candidates : processLpmItems).map(item => <option key={item.id} value={item.id}>{item.maQuyTrinh} - {item.tenQuyTrinh}</option>)}</select>{row.status === 'suggested' && <div className="mt-2 text-amber-300">Có nhiều quy trình cùng mã gốc, cần chọn thủ công.</div>}{selected && <div className="mt-2 font-mono text-[10px] text-blue-300">id: {selected.id}</div>}</td><td className="px-3 py-4"><select value={row.selectedScopeId} onChange={event => updateProcessRow(index, 'scope', event.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-slate-200 outline-none focus:border-blue-500"><option value="">-- Chọn đơn vị --</option>{processScopes.map(scope => <option key={scope.scopeId} value={scope.scopeId}>{'  '.repeat(Math.max(0, (scope.scopeLevel || 1) - 1))}{scope.scopeName} ({scope.scopeCode})</option>)}</select></td></tr>; })}</tbody></table>}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-700 px-5 py-3 text-xs text-slate-400"><span>Đã mapping {processRows.filter(row => row.selectedLpmId).length}/{processRows.length} quy trình LPM.</span><div className="flex gap-2"><button type="button" onClick={() => setProcessModalRow(null)} className="rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white hover:bg-slate-600">Đóng</button><button type="button" onClick={() => void saveProcessMapping()} disabled={processSaving || processLoading || processRows.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">{processSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Lưu ánh xạ quy trình</button></div></div>
        </div>
      </div>}
    </div>
  );
};
