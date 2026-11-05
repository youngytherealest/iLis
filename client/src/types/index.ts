export interface ExcelColumn {
  index: number;
  letter: string;
  label: string;
  name: string;
}

export interface ExcelRow {
  _rowIndex: number;
  _raw: any[];
  [key: string]: any;
}

export interface ExcelParsedData {
  success: boolean;
  fileName: string;
  fileSize?: number;
  sheetNames: string[];
  selectedSheetName: string;
  headerRowIndex: number;
  detectedHeaderIndex: number;
  columns: ExcelColumn[];
  rows: ExcelRow[];
  totalRows: number;
  mergesCount: number;
  domains: string[];
  domainColumnLetter: string | null;
}

export interface MappingConfig {
  maThuTucCol: string;
  tenThuTucCol: string;
  tenVietTatCol: string;
  linhVucCol: string;
  moTaCol: string;
  defaults: {
    laThuTucCapXa: boolean;
    idLinhVuc: string;
    thoiHanTraThongBaoThue: string;
    trangThai: number;
    moTa: string;
  };
}

export interface ProcedurePayload {
  laThuTucCapXa: boolean;
  idLinhVuc: string;
  maThuTuc: string;
  tenThuTuc: string;
  tenVietTat: string;
  mucDoThuTuc: number; // ALWAYS 3
  moTa: string;
  thoiHanTraThongBaoThue: string;
  trangThai: number;
  thuTucLoaiGiayTos: any[];
}

export interface MappedRecord {
  index: number;
  rowIndex: number;
  maThuTuc: string;
  tenThuTuc: string;
  tenVietTat: string;
  linhVucName: string;
  idLinhVuc: string;
  mucDoThuTuc: number;
  laThuTucCapXa: boolean;
  moTa: string;
  thoiHanTraThongBaoThue: string;
  trangThai: number;
  thuTucLoaiGiayTos: any[];
  payload: ProcedurePayload;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  rawRow: any;
}

export interface MappingSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  unmappedDomains: string[];
  missingFieldsReport: {
    maThuTucMissing: number;
    tenThuTucMissing: number;
    idLinhVucMissing: number;
    tenVietTatGenerated: number;
  };
  levelReport: {
    province: number;
    commune: number;
    unmapped: number;
  } | null;
}

export interface ProcedureLevelSource {
  fileName: string;
  loadedAt: string;
  sheetName: string;
  totalRows: number;
  totalCodes: number;
  provinceCount: number;
  communeCount: number;
  conflicts: string[];
  levelMap: Record<string, number>;
}

export interface ProcedureCatalogItem {
  id: string;
  maQuyTrinh: string;
  maThuTuc: string | null;
  idThuTuc: string | null;
}

export interface ProcedureCatalogResponse {
  source: {
    pageIndex: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  items: ProcedureCatalogItem[];
}

export interface ProcedureFileUpdateResult {
  success: boolean;
  httpStatus: number;
  type: string;
  message: string;
  data?: any;
}

export interface ProcedureDeployResult {
  success: boolean;
  httpStatus: number;
  type: string;
  message: string;
  idQuyTrinh: string;
  data?: any;
}

export interface ProcedureTimingDuration {
  status: 'valid' | 'empty' | 'total' | 'excluded' | 'invalid' | 'ambiguous';
  inputDays?: number | null;
  days: number | null;
  hours: number | null;
  reason?: string | null;
}

export interface ProcedureTimingRow {
  rowNumber: number;
  stepLabel: string;
  stepNumbers: number[];
  content: string;
  responsibility: string;
  timeText: string;
  sectionTitle: string;
  duration: ProcedureTimingDuration;
}

export interface ProcedureTimingSheet {
  sheetName: string;
  procedureCode: string;
  title: string;
  headerIndex: number;
  rowCount: number;
  mergesCount: number;
  timingRows: ProcedureTimingRow[];
}

export interface ProcedureTimingParseResponse {
  success: boolean;
  fileName: string;
  sheetNames: string[];
  sheetCount: number;
  sheets: ProcedureTimingSheet[];
}

export interface ProcedureStep {
  id: string;
  idQuyTrinh: string;
  maBuoc: string;
  tenBuoc: string;
  maForm?: string | null;
  idTrangThaiHoSo?: number | null;
  thoiGianThucHien?: number | null;
  thoiGianThucHienTime?: number | null;
  [key: string]: any;
}

export interface ProcedureStepSearchResult {
  success: boolean;
  httpStatus: number;
  type: string;
  message: string;
  data?: any;
  items: ProcedureStep[];
  pagination?: {
    pageIndex: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
  };
}

export interface ProcedureStepUpdateResult {
  success: boolean;
  httpStatus: number;
  type: string;
  message: string;
  data?: any;
}

export interface LpmProcedureItem {
  id: string;
  maThuTuc: string;
  tenThuTuc: string;
  [key: string]: any;
}

export interface DvcProcedureItem {
  id: string;
  ma: string;
  ten: string;
  idLpm?: string;
  maLPM?: string;
  tenLPM?: string;
  [key: string]: any;
}

export interface DvcMappingValue {
  id: string;
  ma: string;
  ten: string;
  idLpm: string;
  maLPM: string;
  tenLPM: string;
}

export interface DvcMappingApiResult {
  success: boolean;
  httpStatus: number;
  type: string;
  message: string;
  data?: any;
  items: any[];
}

export interface DvcMappingDataTypeOption {
  value: string;
  label: string;
  [key: string]: any;
}

export interface DvcDepartmentItem {
  id: string;
  label: string;
  [key: string]: any;
}

export interface DvcLpmDomainItem {
  idDvc: string;
  maDvc: string;
  tenDvc: string;
  idLpm: string;
  maLpm: string;
  tenLpm: string;
  [key: string]: any;
}

export interface LpmProcessItem {
  id: string;
  maQuyTrinh: string;
  tenQuyTrinh: string;
  [key: string]: any;
}

export interface DvcProcessItem {
  id: string;
  ma: string;
  ten: string;
  [key: string]: any;
}

export interface DvhcScopeItem {
  scopeId: string;
  scopeCode: string;
  scopeName: string;
  scopeLevel?: number;
  parentScopeId?: string;
  [key: string]: any;
}

export interface TokenStatus {
  hasToken: boolean;
  preview: string;
  length: number;
  isExpired: boolean;
  expTime?: string | null;
}

export interface SystemSettings {
  gatewayUrl: string;
  endpointPath: string;
  delayMs: number;
  laThuTucCapXa: boolean;
  thoiHanTraThongBaoThue: string;
  trangThai: number;
  mockMode: boolean;
}

export interface LogEntry {
  id: string;
  time: string;
  timestamp: string;
  type: 'INFO' | 'SUCCESS' | 'ERROR' | 'WARNING' | 'ALERT' | 'SKIP';
  maThuTuc?: string;
  httpStatus?: number;
  message: string;
}

export interface ProcessedRecord {
  index: number;
  maThuTuc: string;
  tenThuTuc: string;
  status: 'THÀNH CÔNG' | 'THẤT BẠI' | 'BỎ QUA';
  httpStatus: number;
  message: string;
  executedAt: string;
}

export interface ImportStatus {
  sessionId: string | null;
  fileName: string;
  status: 'idle' | 'running' | 'paused' | 'stopped' | 'completed';
  total: number;
  processed: number;
  percent: number;
  success: number;
  failed: number;
  skipped: number;
  currentProcedure: { index: number; maThuTuc: string; tenThuTuc: string } | null;
  startTime: string | null;
  endTime: string | null;
  elapsedMs: number;
  delayMs: number;
  mockMode: boolean;
  logs: LogEntry[];
  results: ProcessedRecord[];
}

export interface ImportSession {
  id: string;
  fileName: string;
  startTime: string;
  endTime: string;
  total: number;
  success: number;
  failed: number;
  skipped: number;
  status: string;
  records?: ProcessedRecord[];
}
