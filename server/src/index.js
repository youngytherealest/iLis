import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { CONFIG } from './config.js';
import {
  getSettings,
  updateSettings,
  getDomainMappings,
  updateDomainMappings,
  getProcedureLevels,
  setProcedureLevels,
  setToken,
  clearToken,
  getTokenStatus,
  getSessions,
  getSessionById
} from './db.js';
import { parseExcel, parseProcedureLevels } from './excelParser.js';
import { parseProcedureTimingWorkbook } from './procedureTimingParser.js';
import { applyMapping } from './mappingEngine.js';
import {
  sendProcedureToIlis,
  updateProcedureFile,
  deployProcedure,
  searchProcedureSteps,
  configureProcedureSteps,
  getAllLpmProcedures,
  getAllDvcProcedures,
  getDvcMappingDataTypes,
  getMappedDvcDomains,
  getDvcDepartments,
  getLpmUsers,
  getDvcMappingByType,
  getDvcUsersByDepartment,
  getLpmProcessesByProcedureId,
  getDvhcTree,
  getDvcProcessesByProcedureId,
  addDvcProcessMapping,
  editDvcProcedureMapping
} from './apiClient.js';
import { importEngine } from './importEngine.js';
import { generateExportExcel } from './exportService.js';
import { checkBpmnStepMappings, mapOneBpmnProcess } from './bpmnStepMapper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.join(__dirname, '..', '..');
const PROCEDURE_CATALOG_FILE = path.join(__dirname, 'procedureCatalog.json');
const procedureCatalog = JSON.parse(fs.readFileSync(PROCEDURE_CATALOG_FILE, 'utf-8'));

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Enforce strict local binding & security
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5000',
    'http://127.0.0.1:5000'
  ],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// --- AUTH / TOKEN ENDPOINTS (In-memory only) ---
app.get('/api/auth/token', (req, res) => {
  res.json(getTokenStatus());
});

app.post('/api/auth/token', (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Token không được để trống.' });
  }
  setToken(token);
  res.json({
    success: true,
    message: 'Đã lưu Bearer Token vào bộ nhớ tạm (Session Memory).',
    status: getTokenStatus()
  });
});

app.delete('/api/auth/token', (req, res) => {
  clearToken();
  res.json({
    success: true,
    message: 'Đã xóa Bearer Token khỏi bộ nhớ tạm.',
    status: getTokenStatus()
  });
});

// --- SETTINGS & DOMAIN MAPPINGS ---
app.get('/api/settings', (req, res) => {
  res.json({
    settings: getSettings(),
    domainMappings: getDomainMappings(),
    procedureLevels: getProcedureLevels(),
    tokenStatus: getTokenStatus()
  });
});

app.post('/api/settings', (req, res) => {
  const { settings, domainMappings } = req.body;
  let updatedSettings = null;
  let updatedDomains = null;

  if (settings && typeof settings === 'object') {
    updatedSettings = updateSettings(settings);
  }
  if (domainMappings && typeof domainMappings === 'object') {
    updatedDomains = updateDomainMappings(domainMappings);
  }

  res.json({
    success: true,
    settings: updatedSettings || getSettings(),
    domainMappings: updatedDomains || getDomainMappings()
  });
});

// --- EXCEL PARSER ENDPOINTS ---
// Upload via multipart form
app.post('/api/excel/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng chọn file Excel để tải lên.' });
    }

    const { sheetName, headerRowIndex } = req.body;
    const parsed = parseExcel(req.file.buffer, {
      sheetName,
      headerRowIndex: headerRowIndex !== undefined ? Number(headerRowIndex) : undefined
    });

    res.json({
      success: true,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      ...parsed
    });
  } catch (err) {
    console.error('Error parsing uploaded Excel:', err);
    res.status(500).json({ error: `Lỗi đọc file Excel: ${err.message}` });
  }
});

// "Tổng hợp quy trình thủ tục": TEN_TAT -> MA_CAP_THU_TUC source for laThuTucCapXa
app.post('/api/excel/procedure-levels', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng chọn file Tổng hợp quy trình thủ tục.' });
    }

    const parsed = parseProcedureLevels(req.file.buffer);
    const source = setProcedureLevels({
      fileName: req.file.originalname,
      loadedAt: new Date().toISOString(),
      ...parsed
    });

    res.json({ success: true, source });
  } catch (err) {
    console.error('Error parsing procedure levels file:', err);
    res.status(400).json({ error: `Lỗi đọc file Tổng hợp quy trình thủ tục: ${err.message}` });
  }
});

app.delete('/api/excel/procedure-levels', (req, res) => {
  setProcedureLevels(null);
  res.json({ success: true });
});

// Re-parse or parse local workspace sample files directly
app.post('/api/excel/parse-local', (req, res) => {
  try {
    const { fileName, sheetName, headerRowIndex } = req.body;
    if (!fileName) {
      return res.status(400).json({ error: 'Tên file không được để trống.' });
    }

    // Safety: only allow files inside workspace root
    const safePath = path.join(WORKSPACE_ROOT, path.basename(fileName));
    if (!fs.existsSync(safePath)) {
      return res.status(404).json({ error: `Không tìm thấy file: ${fileName}` });
    }

    const parsed = parseExcel(safePath, {
      sheetName,
      headerRowIndex: headerRowIndex !== undefined ? Number(headerRowIndex) : undefined
    });

    res.json({
      success: true,
      fileName: path.basename(safePath),
      ...parsed
    });
  } catch (err) {
    console.error('Error parsing local Excel file:', err);
    res.status(500).json({ error: `Lỗi đọc file Excel: ${err.message}` });
  }
});

// Get sample files in workspace
app.get('/api/excel/samples', (req, res) => {
  try {
    const files = fs.readdirSync(WORKSPACE_ROOT)
      .filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'))
      .map(f => {
        const stats = fs.statSync(path.join(WORKSPACE_ROOT, f));
        return {
          name: f,
          size: stats.size,
          modifiedAt: stats.mtime
        };
      });
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- PROCEDURE FILE UPDATE ---
app.get('/api/procedures/catalog', (req, res) => {
  res.json(procedureCatalog);
});

app.post('/api/procedures/update-file', upload.single('fileQuyTrinh'), async (req, res) => {
  try {
    const { idQuyTrinh } = req.body;
    if (!idQuyTrinh || typeof idQuyTrinh !== 'string') {
      return res.status(400).json({ error: 'Thiếu idQuyTrinh.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng chọn file quy trình.' });
    }

    const settings = getSettings();
    const result = await updateProcedureFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      idQuyTrinh,
      {
        gatewayUrl: settings.gatewayUrl,
        endpointPath: CONFIG.ILIS_UPDATE_PROCEDURE_FILE_PATH
      }
    );

    const responseStatus = result.httpStatus > 0
      ? result.httpStatus
      : result.success ? 200 : 502;
    res.status(responseStatus).json(result);
  } catch (err) {
    console.error('Error updating procedure file:', err);
    res.status(500).json({ error: `Lỗi cập nhật file quy trình: ${err.message}` });
  }
});

// --- PROCEDURE TIMING UPDATE ---
app.post('/api/procedure-timings/parse', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng chọn file Excel thời gian quy trình.' });
    }
    res.json({
      fileName: req.file.originalname,
      ...parseProcedureTimingWorkbook(req.file.buffer)
    });
  } catch (err) {
    console.error('Error parsing procedure timing workbook:', err);
    res.status(500).json({ error: `Lỗi đọc file thời gian quy trình: ${err.message}` });
  }
});

app.post('/api/procedure-timings/search', async (req, res) => {
  try {
    const { idQuyTrinh } = req.body;
    if (!idQuyTrinh || typeof idQuyTrinh !== 'string') {
      return res.status(400).json({ error: 'Thiếu idQuyTrinh.' });
    }
    const settings = getSettings();
    const result = await searchProcedureSteps(idQuyTrinh, {
      gatewayUrl: settings.gatewayUrl,
      endpointPath: CONFIG.ILIS_SEARCH_PROCEDURE_STEPS_PATH
    });
    const responseStatus = result.httpStatus > 0 ? result.httpStatus : result.success ? 200 : 502;
    res.status(responseStatus).json(result);
  } catch (err) {
    console.error('Error searching procedure steps:', err);
    res.status(500).json({ error: `Lỗi tải bước quy trình: ${err.message}` });
  }
});

app.post('/api/procedures/deploy', async (req, res) => {
  try {
    const { idQuyTrinh } = req.body;
    if (!idQuyTrinh || typeof idQuyTrinh !== 'string') {
      return res.status(400).json({ error: 'Thiáº¿u idQuyTrinh.' });
    }

    const settings = getSettings();
    const result = await deployProcedure(idQuyTrinh, {
      gatewayUrl: settings.gatewayUrl,
      endpointPath: CONFIG.ILIS_DEPLOY_PROCESS_PATH
    });
    const responseStatus = result.httpStatus > 0 ? result.httpStatus : result.success ? 200 : 502;
    res.status(responseStatus).json(result);
  } catch (err) {
    console.error('Error deploying procedure:', err);
    res.status(500).json({ error: `Lá»—i áp dá»¥ng quy trÃ¬nh: ${err.message}` });
  }
});

app.post('/api/procedure-timings/update', async (req, res) => {
  try {
    const { idQuyTrinh, steps } = req.body;
    if (!idQuyTrinh || typeof idQuyTrinh !== 'string') {
      return res.status(400).json({ error: 'Thiếu idQuyTrinh.' });
    }
    if (!Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({ error: 'Danh sách bước cập nhật không hợp lệ.' });
    }

    const settings = getSettings();
    const result = await configureProcedureSteps(idQuyTrinh, steps, {
      gatewayUrl: settings.gatewayUrl,
      endpointPath: CONFIG.ILIS_CONFIGURE_PROCEDURE_STEPS_PATH
    });
    const responseStatus = result.httpStatus > 0 ? result.httpStatus : result.success ? 200 : 502;
    res.status(responseStatus).json(result);
  } catch (err) {
    console.error('Error updating procedure step timing:', err);
    res.status(500).json({ error: `Lỗi cập nhật thời gian bước: ${err.message}` });
  }
});

// --- BPMN STEP MAPPING (integrated from the standalone map-bước tool) ---
app.post('/api/bpmn-step-mapping/check', async (req, res) => {
  try {
    const result = await checkBpmnStepMappings();
    res.json(result);
  } catch (err) {
    console.error('Error checking BPMN step mappings:', err);
    const status = err.status === 401 || err.status === 403 ? err.status : 500;
    res.status(status).json({ error: `Lỗi kiểm tra mapping bước BPMN: ${err.message}` });
  }
});

app.post('/api/bpmn-step-mapping/map-one', async (req, res) => {
  try {
    const { runId, processId, dryRun } = req.body;
    if (!runId || !processId) return res.status(400).json({ error: 'Thiếu runId hoặc processId.' });
    const result = await mapOneBpmnProcess({ runId, processId, dryRun: Boolean(dryRun) });
    res.json(result);
  } catch (err) {
    console.error('Error mapping BPMN steps:', err);
    const status = err.status === 401 || err.status === 403 ? err.status : 500;
    res.status(status).json({ error: `Lỗi mapping bước BPMN: ${err.message}`, message: err.message });
  }
});

// --- DVC <-> LPM PROCEDURE MAPPING ---
app.get('/api/dvc-mapping/data-types', async (req, res) => {
  try {
    const settings = getSettings();
    const result = await getDvcMappingDataTypes({
      gatewayUrl: settings.gatewayUrl,
      endpointPath: CONFIG.ILIS_GET_MAPPING_DATA_TYPES_PATH
    });
    const responseStatus = result.httpStatus > 0 ? result.httpStatus : result.success ? 200 : 502;
    res.status(responseStatus).json(result);
  } catch (err) {
    console.error('Error loading DVC mapping data types:', err);
    res.status(500).json({ error: `Lỗi tải loại dữ liệu ánh xạ: ${err.message}` });
  }
});

app.get('/api/dvc-mapping/mapped-domains', async (req, res) => {
  try {
    const settings = getSettings();
    const result = await getMappedDvcDomains({
      gatewayUrl: settings.gatewayUrl,
      endpointPath: CONFIG.ILIS_GET_MAPPED_DVC_DOMAINS_PATH
    });
    const responseStatus = result.httpStatus > 0 ? result.httpStatus : result.success ? 200 : 502;
    res.status(responseStatus).json(result);
  } catch (err) {
    console.error('Error loading mapped DVC domains:', err);
    res.status(500).json({ error: `Lỗi tải lĩnh vực DVC đã ánh xạ: ${err.message}` });
  }
});

app.get('/api/dvc-mapping/departments', async (req, res) => {
  try {
    const settings = getSettings();
    const result = await getDvcDepartments({
      gatewayUrl: settings.gatewayUrl,
      endpointPath: CONFIG.ILIS_GET_DVC_DEPARTMENTS_PATH
    });
    const responseStatus = result.httpStatus > 0 ? result.httpStatus : result.success ? 200 : 502;
    res.status(responseStatus).json(result);
  } catch (err) {
    console.error('Error loading DVC departments:', err);
    res.status(500).json({ error: `Lỗi tải danh sách phòng ban DVC: ${err.message}` });
  }
});

app.get('/api/dvc-mapping/lpm-users', async (req, res) => {
  try {
    const settings = getSettings();
    const result = await getLpmUsers({
      gatewayUrl: settings.gatewayUrl,
      endpointPath: CONFIG.ILIS_GET_LPM_USERS_PATH
    });
    const responseStatus = result.httpStatus > 0 ? result.httpStatus : result.success ? 200 : 502;
    res.status(responseStatus).json(result);
  } catch (err) {
    console.error('Error loading LPM users:', err);
    res.status(500).json({ error: `Lỗi tải danh sách người dùng LPM: ${err.message}` });
  }
});

app.get('/api/dvc-mapping/existing', async (req, res) => {
  try {
    const loaiDanhMuc = String(req.query.loai || '').trim();
    const thamChieuLpm = String(req.query.thamChieuLpm || '');
    if (!loaiDanhMuc) {
      return res.status(400).json({ error: 'Thiếu loại danh mục mapping.' });
    }
    const settings = getSettings();
    const result = await getDvcMappingByType(loaiDanhMuc, thamChieuLpm, {
      gatewayUrl: settings.gatewayUrl,
      endpointPath: CONFIG.ILIS_GET_DVC_MAPPING_BY_TYPE_PATH
    });
    const responseStatus = result.httpStatus > 0 ? result.httpStatus : result.success ? 200 : 502;
    res.status(responseStatus).json({ ...result, loaiDanhMuc, thamChieuLpm });
  } catch (err) {
    console.error('Error loading existing DVC mapping:', err);
    res.status(500).json({ error: `Lỗi tải mapping đã lưu: ${err.message}` });
  }
});

app.get('/api/dvc-mapping/dvc-users', async (req, res) => {
  try {
    const phongBanId = String(req.query.phongBanId || '').trim();
    const keywordSearch = String(req.query.keywordSearch || '');
    if (!phongBanId) {
      return res.status(400).json({ error: 'Thiếu phongBanId.' });
    }
    const settings = getSettings();
    const result = await getDvcUsersByDepartment(phongBanId, keywordSearch, {
      gatewayUrl: settings.gatewayUrl,
      endpointPath: CONFIG.ILIS_GET_DVC_USERS_BY_DEPARTMENT_PATH
    });
    const responseStatus = result.httpStatus > 0 ? result.httpStatus : result.success ? 200 : 502;
    res.status(responseStatus).json({ ...result, phongBanId, keywordSearch });
  } catch (err) {
    console.error('Error loading DVC users by department:', err);
    res.status(500).json({ error: `Lỗi tải người xử lý DVC: ${err.message}` });
  }
});

app.get('/api/dvc-mapping/lpm-procedures', async (req, res) => {
  try {
    const linhVucId = String(req.query.linhVucId || '').trim();
    if (!linhVucId) {
      return res.status(400).json({ error: 'Thiếu linhVucId của LPM.' });
    }
    const settings = getSettings();
    const result = await getAllLpmProcedures(linhVucId, {
      gatewayUrl: settings.gatewayUrl,
      endpointPath: CONFIG.ILIS_GET_ALL_PROCEDURES_BY_DOMAIN_PATH
    });
    const responseStatus = result.httpStatus > 0 ? result.httpStatus : result.success ? 200 : 502;
    res.status(responseStatus).json({ ...result, linhVucId });
  } catch (err) {
    console.error('Error loading LPM procedures for DVC mapping:', err);
    res.status(500).json({ error: `Lỗi tải danh sách thủ tục LPM: ${err.message}` });
  }
});

app.get('/api/dvc-mapping/dvc-procedures', async (req, res) => {
  try {
    const linhVucDvcId = String(req.query.linhVucDvcId || '').trim();
    const keywordSearch = String(req.query.keywordSearch || '');
    if (!linhVucDvcId) {
      return res.status(400).json({ error: 'Thiếu linhVucDvcId của DVC.' });
    }
    const settings = getSettings();
    const result = await getAllDvcProcedures(linhVucDvcId, keywordSearch, {
      gatewayUrl: settings.gatewayUrl,
      endpointPath: CONFIG.ILIS_GET_DVC_PROCEDURES_PATH
    });
    const responseStatus = result.httpStatus > 0 ? result.httpStatus : result.success ? 200 : 502;
    res.status(responseStatus).json({ ...result, linhVucDvcId, keywordSearch });
  } catch (err) {
    console.error('Error loading DVC procedures for mapping:', err);
    res.status(500).json({ error: `Lỗi tải danh sách thủ tục DVC: ${err.message}` });
  }
});

app.get('/api/dvc-mapping/lpm-processes', async (req, res) => {
  try {
    const thuTucLpmId = String(req.query.thuTucLpmId || '').trim();
    if (!thuTucLpmId) return res.status(400).json({ error: 'Thiếu thuTucLpmId.' });
    const settings = getSettings();
    const result = await getLpmProcessesByProcedureId(thuTucLpmId, {
      gatewayUrl: settings.gatewayUrl,
      endpointPath: CONFIG.ILIS_GET_LPM_PROCESSES_BY_PROCEDURE_PATH
    });
    const responseStatus = result.httpStatus > 0 ? result.httpStatus : result.success ? 200 : 502;
    res.status(responseStatus).json({ ...result, thuTucLpmId });
  } catch (err) {
    console.error('Error loading LPM processes for DVC mapping:', err);
    res.status(500).json({ error: `Lỗi tải quy trình LPM: ${err.message}` });
  }
});

app.get('/api/dvc-mapping/dvhc', async (req, res) => {
  try {
    const settings = getSettings();
    const result = await getDvhcTree({
      gatewayUrl: settings.gatewayUrl,
      endpointPath: CONFIG.ILIS_GET_DVHC_TREE_PATH
    });
    const responseStatus = result.httpStatus > 0 ? result.httpStatus : result.success ? 200 : 502;
    res.status(responseStatus).json(result);
  } catch (err) {
    console.error('Error loading DVHC tree:', err);
    res.status(500).json({ error: `Lỗi tải cây đơn vị hành chính: ${err.message}` });
  }
});

app.get('/api/dvc-mapping/dvc-processes', async (req, res) => {
  try {
    const thuTucDvcId = String(req.query.thuTucDvcId || '').trim();
    if (!thuTucDvcId) return res.status(400).json({ error: 'Thiếu thuTucDvcId.' });
    const settings = getSettings();
    const result = await getDvcProcessesByProcedureId(thuTucDvcId, {
      gatewayUrl: settings.gatewayUrl,
      endpointPath: CONFIG.ILIS_GET_DVC_PROCESSES_BY_PROCEDURE_PATH
    });
    const responseStatus = result.httpStatus > 0 ? result.httpStatus : result.success ? 200 : 502;
    res.status(responseStatus).json({ ...result, thuTucDvcId });
  } catch (err) {
    console.error('Error loading DVC processes for mapping:', err);
    res.status(500).json({ error: `Lỗi tải quy trình DVC: ${err.message}` });
  }
});

app.post('/api/dvc-mapping/process-add', async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.thamChieuLpm) return res.status(400).json({ error: 'Thiếu thamChieuLpm.' });
    if (!Array.isArray(payload.mapGiaTri) && typeof payload.mapGiaTri !== 'string') {
      return res.status(400).json({ error: 'Thiếu mapGiaTri ánh xạ quy trình.' });
    }
    const settings = getSettings();
    const result = await addDvcProcessMapping(payload, {
      gatewayUrl: settings.gatewayUrl,
      endpointPath: CONFIG.ILIS_ADD_DVC_MAPPING_PATH
    });
    const responseStatus = result.httpStatus > 0 ? result.httpStatus : result.success ? 200 : 502;
    res.status(responseStatus).json(result);
  } catch (err) {
    console.error('Error adding DVC-LPM process mapping:', err);
    res.status(500).json({ error: `Lỗi lưu ánh xạ quy trình: ${err.message}` });
  }
});

app.post('/api/dvc-mapping/edit', async (req, res) => {
  try {
    const payload = req.body || {};
    if (!Number.isFinite(Number(payload.id))) {
      return res.status(400).json({ error: 'Thiếu id cấu hình mapping MapDanhMucDvc.' });
    }
    if (!payload.loaiDanhMuc) {
      return res.status(400).json({ error: 'Thiếu loaiDanhMuc.' });
    }
    const settings = getSettings();
    const result = await editDvcProcedureMapping(payload, {
      gatewayUrl: settings.gatewayUrl,
      endpointPath: CONFIG.ILIS_EDIT_DVC_MAPPING_PATH
    });
    if (!result.success) {
      console.error('[DVC mapping edit] upstream rejection', {
        status: result.httpStatus,
        request: payload,
        response: result.data
      });
    }
    const responseStatus = result.httpStatus > 0 ? result.httpStatus : result.success ? 200 : 502;
    res.status(responseStatus).json(result);
  } catch (err) {
    console.error('Error saving DVC-LPM procedure mapping:', err);
    res.status(500).json({ error: `Lỗi lưu mapping thủ tục DVC - LPM: ${err.message}` });
  }
});

// --- MAPPING & VALIDATION ---
app.post('/api/mapping/preview', (req, res) => {
  try {
    const { rows = [], mappingConfig = {}, domainMappings } = req.body;
    const activeDomainMappings = domainMappings || getDomainMappings();
    const result = applyMapping(rows, mappingConfig, activeDomainMappings, getProcedureLevels()?.levelMap);
    res.json(result);
  } catch (err) {
    console.error('Error in mapping preview:', err);
    res.status(500).json({ error: `Lỗi kiểm tra mapping: ${err.message}` });
  }
});

// --- DRY RUN SIMULATION ---
app.post('/api/import/dry-run', (req, res) => {
  try {
    const { rows = [], mappingConfig = {}, domainMappings } = req.body;
    const activeDomainMappings = domainMappings || getDomainMappings();
    const result = applyMapping(rows, mappingConfig, activeDomainMappings, getProcedureLevels()?.levelMap);

    // Verify all generated payloads meet ILIS specifications
    const payloads = result.records.map(r => ({
      index: r.index,
      maThuTuc: r.maThuTuc,
      tenThuTuc: r.tenThuTuc,
      isValid: r.isValid,
      errors: r.errors,
      warnings: r.warnings,
      payload: r.payload
    }));

    res.json({
      success: true,
      message: 'Chạy thử nghiệm (Dry Run) hoàn tất. Không có dữ liệu thật nào được gửi đến ILIS.',
      summary: result.summary,
      payloads
    });
  } catch (err) {
    console.error('Error in dry run:', err);
    res.status(500).json({ error: `Lỗi chạy Dry Run: ${err.message}` });
  }
});

// --- TEST IMPORT SINGLE RECORD ---
app.post('/api/import/test-single', async (req, res) => {
  try {
    const { payload, confirmed, mockMode } = req.body;

    if (!confirmed) {
      return res.status(400).json({
        error: 'Cần xác nhận rõ ràng trước khi gửi request tạo thủ tục thật.'
      });
    }

    if (!payload || !payload.maThuTuc || !payload.tenThuTuc) {
      return res.status(400).json({ error: 'Payload không hợp lệ: thiếu mã hoặc tên thủ tục.' });
    }

    // Enforce mandatory mucDoThuTuc = 3
    payload.mucDoThuTuc = CONFIG.MANDATORY_MUC_DO_THU_TUC;

    const settings = getSettings();
    const isMock = mockMode !== undefined ? mockMode : settings.mockMode;

    const result = await sendProcedureToIlis(payload, {
      gatewayUrl: settings.gatewayUrl,
      endpointPath: settings.endpointPath,
      mockMode: isMock
    });

    res.json(result);
  } catch (err) {
    console.error('Error in test single import:', err);
    res.status(500).json({ error: `Lỗi gửi test: ${err.message}` });
  }
});

// --- BULK IMPORT CONTROLS ---
app.post('/api/import/start', async (req, res) => {
  try {
    const { records = [], fileName, delayMs, mockMode, confirmed } = req.body;

    if (!confirmed) {
      return res.status(400).json({
        error: 'Cần xác nhận từ người dùng trước khi bắt đầu import hàng loạt.'
      });
    }

    if (records.length === 0) {
      return res.status(400).json({ error: 'Danh sách thủ tục import rỗng.' });
    }

    const settings = getSettings();
    const effectiveDelay = delayMs !== undefined ? delayMs : settings.delayMs;
    const effectiveMock = mockMode !== undefined ? mockMode : settings.mockMode;

    const initialStatus = await importEngine.startImport({
      records,
      fileName,
      delayMs: effectiveDelay,
      mockMode: effectiveMock
    });

    res.json({
      success: true,
      message: 'Tiến trình import đã được khởi chạy thành công.',
      status: initialStatus
    });
  } catch (err) {
    console.error('Error starting import:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/import/pause', (req, res) => {
  const ok = importEngine.pauseImport();
  res.json({ success: ok, status: importEngine.getStatus() });
});

app.post('/api/import/resume', (req, res) => {
  const ok = importEngine.resumeImport();
  res.json({ success: ok, status: importEngine.getStatus() });
});

app.post('/api/import/stop', (req, res) => {
  const ok = importEngine.stopImport();
  res.json({ success: ok, status: importEngine.getStatus() });
});

app.get('/api/import/status', (req, res) => {
  res.json(importEngine.getStatus());
});

// Server-Sent Events (SSE) for Realtime Logs & Progress
app.get('/api/import/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial status
  res.write(`data: ${JSON.stringify({ type: 'init', status: importEngine.getStatus() })}\n\n`);

  const unsubscribe = importEngine.subscribe(event => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  req.on('close', () => {
    unsubscribe();
  });
});

// --- EXPORT RESULTS TO EXCEL ---
app.post('/api/export/excel', (req, res) => {
  try {
    const { records = [], onlyFailed = false, title } = req.body;
    const buffer = generateExportExcel(records, { onlyFailed, title });

    const fileName = onlyFailed
      ? `DanhSach_Loi_ILIS_${Date.now()}.xlsx`
      : `BaoCao_KetQua_Import_ILIS_${Date.now()}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error('Error exporting Excel:', err);
    res.status(500).json({ error: `Lỗi xuất file Excel: ${err.message}` });
  }
});

// --- IMPORT SESSIONS HISTORY ---
app.get('/api/history', (req, res) => {
  res.json(getSessions());
});

app.get('/api/history/:id', (req, res) => {
  const session = getSessionById(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Không tìm thấy phiên import.' });
  }
  res.json(session);
});

// --- MOCK ILIS API ENDPOINT (for direct testing) ---
app.post('/lpm/api/ThuTucManage/Add', (req, res) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      statusCode: 401,
      isSuccess: false,
      message: 'Unauthorized: Bearer token is missing or invalid'
    });
  }

  const payload = req.body;
  if (!payload.maThuTuc || !payload.tenThuTuc || !payload.idLinhVuc) {
    return res.status(400).json({
      statusCode: 400,
      isSuccess: false,
      message: 'Dữ liệu không hợp lệ: Thiếu các trường bắt buộc'
    });
  }

  if (payload.mucDoThuTuc !== 3) {
    return res.status(400).json({
      statusCode: 400,
      isSuccess: false,
      message: 'mucDoThuTuc phải luôn là 3'
    });
  }

  res.status(200).json({
    statusCode: 200,
    isSuccess: true,
    message: `[LOCAL MOCK] Tạo mới thành công thủ tục ${payload.maThuTuc}`,
    data: {
      id: 'MOCK_ID_' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      maThuTuc: payload.maThuTuc,
      tenThuTuc: payload.tenThuTuc,
      mucDoThuTuc: 3
    }
  });
});

// Start listening strictly on 127.0.0.1
app.listen(CONFIG.PORT, CONFIG.HOST, () => {
  console.log(`=======================================================`);
  console.log(`🚀 ILIS LPM Backend Server running at http://${CONFIG.HOST}:${CONFIG.PORT}`);
  console.log(`🔒 Bound strictly to ${CONFIG.HOST} for security`);
  console.log(`📁 Target ILIS Gateway: ${CONFIG.ILIS_GATEWAY_URL}`);
  console.log(`=======================================================`);
});
