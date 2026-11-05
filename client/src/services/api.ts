import axios from 'axios';
import {
  ExcelParsedData,
  MappingConfig,
  MappedRecord,
  MappingSummary,
  ProcedureLevelSource,
  TokenStatus,
  SystemSettings,
  ImportStatus,
  ImportSession,
  ProcedurePayload,
  ProcessedRecord,
  ProcedureCatalogResponse,
  ProcedureFileUpdateResult,
  ProcedureDeployResult,
  ProcedureTimingParseResponse,
  ProcedureStepSearchResult,
  ProcedureStepUpdateResult,
  DvcMappingApiResult
} from '../types';

const client = axios.create({
  baseURL: '/api',
  timeout: 45000
});

export const api = {
  // Health
  async getHealth() {
    const res = await client.get('/health');
    return res.data;
  },

  // Auth / Token
  async getTokenStatus(): Promise<TokenStatus> {
    const res = await client.get('/auth/token');
    return res.data;
  },

  async setToken(token: string) {
    const res = await client.post('/auth/token', { token });
    return res.data;
  },

  async clearToken() {
    const res = await client.delete('/auth/token');
    return res.data;
  },

  // Settings & Domains
  async getSettings(): Promise<{ settings: SystemSettings; domainMappings: Record<string, string>; procedureLevels: ProcedureLevelSource | null; tokenStatus: TokenStatus }> {
    const res = await client.get('/settings');
    return res.data;
  },

  async saveSettings(data: { settings?: Partial<SystemSettings>; domainMappings?: Record<string, string> }) {
    const res = await client.post('/settings', data);
    return res.data;
  },

  // Excel
  async uploadExcel(file: File, sheetName?: string, headerRowIndex?: number): Promise<ExcelParsedData> {
    const formData = new FormData();
    formData.append('file', file);
    if (sheetName) formData.append('sheetName', sheetName);
    if (headerRowIndex !== undefined) formData.append('headerRowIndex', String(headerRowIndex));

    const res = await client.post('/excel/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  async parseLocalExcel(fileName: string, sheetName?: string, headerRowIndex?: number): Promise<ExcelParsedData> {
    const res = await client.post('/excel/parse-local', {
      fileName,
      sheetName,
      headerRowIndex
    });
    return res.data;
  },

  async uploadProcedureLevels(file: File): Promise<ProcedureLevelSource> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await client.post('/excel/procedure-levels', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data.source;
  },

  async clearProcedureLevels() {
    const res = await client.delete('/excel/procedure-levels');
    return res.data;
  },

  async getSampleFiles(): Promise<Array<{ name: string; size: number; modifiedAt: string }>> {
    const res = await client.get('/excel/samples');
    return res.data;
  },

  // Procedure BPMN file update
  async getProcedureCatalog(): Promise<ProcedureCatalogResponse> {
    const res = await client.get('/procedures/catalog');
    return res.data;
  },

  async updateProcedureFile(file: File, idQuyTrinh: string): Promise<ProcedureFileUpdateResult> {
    const formData = new FormData();
    formData.append('idQuyTrinh', idQuyTrinh);
    formData.append('fileQuyTrinh', file, file.name);

    const res = await client.post('/procedures/update-file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 75000
    });
    return res.data;
  },

  async deployProcedure(idQuyTrinh: string): Promise<ProcedureDeployResult> {
    try {
      const res = await client.post('/procedures/deploy', { idQuyTrinh }, {
        timeout: 75000
      });
      return { ...res.data, idQuyTrinh: res.data?.idQuyTrinh || idQuyTrinh };
    } catch (err: any) {
      const responseData = err?.response?.data;
      return {
        success: false,
        httpStatus: responseData?.httpStatus || err?.response?.status || 0,
        type: responseData?.type || 'API_ERROR',
        message: responseData?.message || responseData?.error || err?.message || 'Không áp dụng được quy trình.',
        idQuyTrinh,
        data: responseData?.data ?? responseData ?? null
      };
    }
  },

  // Procedure timing bulk update
  async parseProcedureTimings(file: File): Promise<ProcedureTimingParseResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await client.post('/procedure-timings/parse', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 75000
    });
    return res.data;
  },

  async searchProcedureSteps(idQuyTrinh: string): Promise<ProcedureStepSearchResult> {
    try {
      const res = await client.post('/procedure-timings/search', { idQuyTrinh }, {
        timeout: 75000
      });
      return res.data;
    } catch (err: any) {
      const responseData = err?.response?.data;
      return {
        success: false,
        httpStatus: responseData?.httpStatus || err?.response?.status || 0,
        type: responseData?.type || 'API_ERROR',
        message: responseData?.message || responseData?.error || err?.message || 'Không tải được danh sách bước.',
        data: responseData?.data ?? responseData ?? null,
        items: [],
        pagination: responseData?.pagination
      };
    }
  },

  async updateProcedureSteps(idQuyTrinh: string, steps: any[]): Promise<ProcedureStepUpdateResult> {
    try {
      const res = await client.post('/procedure-timings/update', { idQuyTrinh, steps }, {
        timeout: 75000
      });
      return res.data;
    } catch (err: any) {
      const responseData = err?.response?.data;
      return {
        success: false,
        httpStatus: responseData?.httpStatus || err?.response?.status || 0,
        type: responseData?.type || 'API_ERROR',
        message: responseData?.message || responseData?.error || err?.message || 'Không cập nhật được thời gian bước.',
        data: responseData?.data ?? responseData ?? null
      };
    }
  },

  // DVC <-> LPM procedure mapping
  async getDvcMappingDataTypes(): Promise<DvcMappingApiResult> {
    try {
      const res = await client.get('/dvc-mapping/data-types', { timeout: 75000 });
      return res.data;
    } catch (err: any) {
      const responseData = err?.response?.data;
      return {
        success: false,
        httpStatus: responseData?.httpStatus || err?.response?.status || 0,
        type: responseData?.type || 'API_ERROR',
        message: responseData?.message || responseData?.error || err?.message || 'Không tải được loại dữ liệu ánh xạ.',
        data: responseData?.data ?? responseData ?? null,
        items: []
      };
    }
  },

  async getDvcDepartments(): Promise<DvcMappingApiResult> {
    try {
      const res = await client.get('/dvc-mapping/departments', { timeout: 75000 });
      return res.data;
    } catch (err: any) {
      const responseData = err?.response?.data;
      return {
        success: false,
        httpStatus: responseData?.httpStatus || err?.response?.status || 0,
        type: responseData?.type || 'API_ERROR',
        message: responseData?.message || responseData?.error || err?.message || 'Không tải được danh sách phòng ban.',
        data: responseData?.data ?? responseData ?? null,
        items: []
      };
    }
  },

  async getMappedDvcDomains(): Promise<DvcMappingApiResult> {
    try {
      const res = await client.get('/dvc-mapping/mapped-domains', { timeout: 75000 });
      return res.data;
    } catch (err: any) {
      const responseData = err?.response?.data;
      return {
        success: false,
        httpStatus: responseData?.httpStatus || err?.response?.status || 0,
        type: responseData?.type || 'API_ERROR',
        message: responseData?.message || responseData?.error || err?.message || 'Không tải được lĩnh vực DVC đã ánh xạ.',
        data: responseData?.data ?? responseData ?? null,
        items: []
      };
    }
  },

  async getLpmUsers(): Promise<DvcMappingApiResult> {
    try {
      const res = await client.get('/dvc-mapping/lpm-users', { timeout: 75000 });
      return res.data;
    } catch (err: any) {
      const responseData = err?.response?.data;
      return {
        success: false,
        httpStatus: responseData?.httpStatus || err?.response?.status || 0,
        type: responseData?.type || 'API_ERROR',
        message: responseData?.message || responseData?.error || err?.message || 'Không tải được người dùng LPM.',
        data: responseData?.data ?? responseData ?? null,
        items: []
      };
    }
  },

  async getExistingDvcMapping(loaiDanhMuc: string, thamChieuLpm = ''): Promise<DvcMappingApiResult> {
    try {
      const res = await client.get('/dvc-mapping/existing', { params: { loai: loaiDanhMuc, thamChieuLpm }, timeout: 75000 });
      return res.data;
    } catch (err: any) {
      const responseData = err?.response?.data;
      return {
        success: false,
        httpStatus: responseData?.httpStatus || err?.response?.status || 0,
        type: responseData?.type || 'API_ERROR',
        message: responseData?.message || responseData?.error || err?.message || 'Không tải được mapping đã lưu.',
        data: responseData?.data ?? responseData ?? null,
        items: []
      };
    }
  },

  async getDvcUsersByDepartment(phongBanId: string, keywordSearch = ''): Promise<DvcMappingApiResult> {
    try {
      const res = await client.get('/dvc-mapping/dvc-users', { params: { phongBanId, keywordSearch }, timeout: 75000 });
      return res.data;
    } catch (err: any) {
      const responseData = err?.response?.data;
      return {
        success: false,
        httpStatus: responseData?.httpStatus || err?.response?.status || 0,
        type: responseData?.type || 'API_ERROR',
        message: responseData?.message || responseData?.error || err?.message || 'Không tải được người xử lý DVC.',
        data: responseData?.data ?? responseData ?? null,
        items: []
      };
    }
  },

  async getLpmProceduresForDvcMapping(linhVucId: string): Promise<DvcMappingApiResult> {
    try {
      const res = await client.get('/dvc-mapping/lpm-procedures', { params: { linhVucId }, timeout: 75000 });
      return res.data;
    } catch (err: any) {
      const responseData = err?.response?.data;
      return {
        success: false,
        httpStatus: responseData?.httpStatus || err?.response?.status || 0,
        type: responseData?.type || 'API_ERROR',
        message: responseData?.message || responseData?.error || err?.message || 'Không tải được danh sách thủ tục LPM.',
        data: responseData?.data ?? responseData ?? null,
        items: []
      };
    }
  },

  async getDvcProceduresForMapping(linhVucDvcId: string, keywordSearch = ''): Promise<DvcMappingApiResult> {
    try {
      const res = await client.get('/dvc-mapping/dvc-procedures', {
        params: { linhVucDvcId, keywordSearch },
        timeout: 75000
      });
      return res.data;
    } catch (err: any) {
      const responseData = err?.response?.data;
      return {
        success: false,
        httpStatus: responseData?.httpStatus || err?.response?.status || 0,
        type: responseData?.type || 'API_ERROR',
        message: responseData?.message || responseData?.error || err?.message || 'Không tải được danh sách thủ tục DVC.',
        data: responseData?.data ?? responseData ?? null,
        items: []
      };
    }
  },

  async getLpmProcessesForDvcMapping(thuTucLpmId: string): Promise<DvcMappingApiResult> {
    try {
      const res = await client.get('/dvc-mapping/lpm-processes', { params: { thuTucLpmId }, timeout: 75000 });
      return res.data;
    } catch (err: any) {
      const responseData = err?.response?.data;
      return {
        success: false,
        httpStatus: responseData?.httpStatus || err?.response?.status || 0,
        type: responseData?.type || 'API_ERROR',
        message: responseData?.message || responseData?.error || err?.message || 'Không tải được quy trình LPM.',
        data: responseData?.data ?? responseData ?? null,
        items: []
      };
    }
  },

  async getDvcProcessesForDvcMapping(thuTucDvcId: string): Promise<DvcMappingApiResult> {
    try {
      const res = await client.get('/dvc-mapping/dvc-processes', { params: { thuTucDvcId }, timeout: 75000 });
      return res.data;
    } catch (err: any) {
      const responseData = err?.response?.data;
      return {
        success: false,
        httpStatus: responseData?.httpStatus || err?.response?.status || 0,
        type: responseData?.type || 'API_ERROR',
        message: responseData?.message || responseData?.error || err?.message || 'Không tải được quy trình DVC.',
        data: responseData?.data ?? responseData ?? null,
        items: []
      };
    }
  },

  async getDvhcTreeForDvcMapping(): Promise<DvcMappingApiResult> {
    try {
      const res = await client.get('/dvc-mapping/dvhc', { timeout: 75000 });
      return res.data;
    } catch (err: any) {
      const responseData = err?.response?.data;
      return {
        success: false,
        httpStatus: responseData?.httpStatus || err?.response?.status || 0,
        type: responseData?.type || 'API_ERROR',
        message: responseData?.message || responseData?.error || err?.message || 'Không tải được đơn vị hành chính.',
        data: responseData?.data ?? responseData ?? null,
        items: []
      };
    }
  },

  async addDvcProcessMapping(payload: {
    mapGiaTri: any[];
    thamChieuLpm: string;
    apiDvc?: string;
    moTa?: string;
  }) {
    try {
      const res = await client.post('/dvc-mapping/process-add', payload, { timeout: 75000 });
      return res.data;
    } catch (err: any) {
      const responseData = err?.response?.data;
      return {
        success: false,
        httpStatus: responseData?.httpStatus || err?.response?.status || 0,
        type: responseData?.type || 'API_ERROR',
        message: responseData?.message || responseData?.error || err?.message || 'Không lưu được ánh xạ quy trình.',
        data: responseData?.data ?? responseData ?? null
      };
    }
  },

  async editDvcProcedureMapping(payload: {
    id: number;
    loaiDanhMuc: string;
    mapGiaTri: any[] | string;
    apiDvc?: string;
    thamChieuLpm?: string;
    moTa?: string;
  }) {
    try {
      const res = await client.post('/dvc-mapping/edit', payload, { timeout: 75000 });
      return res.data;
    } catch (err: any) {
      const responseData = err?.response?.data;
      return {
        success: false,
        httpStatus: responseData?.httpStatus || err?.response?.status || 0,
        type: responseData?.type || 'API_ERROR',
        message: responseData?.message || responseData?.error || err?.message || 'Không lưu được mapping thủ tục DVC - LPM.',
        data: responseData?.data ?? responseData ?? null
      };
    }
  },

  // Mapping & Validation
  async previewMapping(
    rows: any[],
    mappingConfig: MappingConfig,
    domainMappings: Record<string, string>
  ): Promise<{ records: MappedRecord[]; summary: MappingSummary }> {
    const res = await client.post('/mapping/preview', {
      rows,
      mappingConfig,
      domainMappings
    });
    return res.data;
  },

  // Dry Run
  async dryRun(
    rows: any[],
    mappingConfig: MappingConfig,
    domainMappings: Record<string, string>
  ): Promise<{ success: boolean; message: string; summary: MappingSummary; payloads: any[] }> {
    const res = await client.post('/import/dry-run', {
      rows,
      mappingConfig,
      domainMappings
    });
    return res.data;
  },

  // Single Test Import
  async testSingle(payload: ProcedurePayload, confirmed: boolean, mockMode?: boolean) {
    const res = await client.post('/import/test-single', {
      payload,
      confirmed,
      mockMode
    });
    return res.data;
  },

  // Bulk Import
  async startImport(
    records: MappedRecord[],
    fileName: string,
    delayMs: number,
    mockMode: boolean,
    confirmed: boolean
  ) {
    const res = await client.post('/import/start', {
      records,
      fileName,
      delayMs,
      mockMode,
      confirmed
    });
    return res.data;
  },

  async pauseImport() {
    const res = await client.post('/import/pause');
    return res.data;
  },

  async resumeImport() {
    const res = await client.post('/import/resume');
    return res.data;
  },

  async stopImport() {
    const res = await client.post('/import/stop');
    return res.data;
  },

  async getImportStatus(): Promise<ImportStatus> {
    const res = await client.get('/import/status');
    return res.data;
  },

  // Export
  async exportExcel(records: ProcessedRecord[], onlyFailed: boolean, title?: string) {
    const res = await client.post('/export/excel', { records, onlyFailed, title }, {
      responseType: 'blob'
    });

    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', onlyFailed ? `DanhSach_Loi_ILIS_${Date.now()}.xlsx` : `KetQua_Import_ILIS_${Date.now()}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // History
  async getHistory(): Promise<ImportSession[]> {
    const res = await client.get('/history');
    return res.data;
  },

  async getSessionDetails(id: string): Promise<ImportSession> {
    const res = await client.get(`/history/${id}`);
    return res.data;
  }
};
