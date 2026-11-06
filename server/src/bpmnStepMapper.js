import axios from 'axios';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import XLSX from 'xlsx';
import { fileURLToPath } from 'node:url';
import { getToken } from './db.js';
import { CONFIG } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');
const workbookPath = path.join(serverRoot, 'data', 'Cau_hinh_map_buoc_iLIS.xlsx');
const dvcWorkflowPath = path.join(serverRoot, 'data', 'dvc-workflows.json');
const runs = new Map();
const RUN_TTL_MS = 30 * 60 * 1000;
const collectionFields = [
  'ketQuaBuocs', 'fileDinhKems', 'tienTrinhXuLys', 'cauHinhPhanCongCTs',
  'cauHinhPhanCongTuDongCTs', 'phanCongs', 'buocXuLys', 'cauHinhBuocs',
  'cauHinhMails', 'fileDinhKemHistories', 'tienTrinhXuLyHistories',
  'phanCongHistories', 'buocXuLyHistories'
];

function decodeEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(value ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const codePoint = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

export function normalizeStepName(value) {
  return decodeEntities(value).normalize('NFC').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('vi-VN');
}

function strictBase64(value) {
  const compact = String(value ?? '').replace(/\s+/g, '');
  if (!compact || compact.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(compact)) {
    throw new Error('Base64 rỗng hoặc sai định dạng');
  }
  return Buffer.from(compact, 'base64');
}

function parseAttributes(text) {
  const attrs = {};
  for (const match of String(text).matchAll(/([:\w.-]+)\s*=\s*(["'])(.*?)\2/gs)) attrs[match[1]] = decodeEntities(match[3]);
  return attrs;
}

function extractUserTasks(xml) {
  const tasks = [];
  for (const match of String(xml).matchAll(/<(?:[A-Za-z_][\w.-]*:)?userTask\b([^>]*)>/gi)) {
    const attrs = parseAttributes(match[1]);
    tasks.push({ id: String(attrs.id ?? '').trim(), name: String(attrs.name ?? '').trim() });
  }
  return tasks;
}

function validateBpmn(fileQuyTrinh) {
  if (!fileQuyTrinh || !String(fileQuyTrinh).trim()) return { status: 'NO_FILE', message: 'Quy trình chưa có file BPMN.', tasks: [] };
  let xml;
  try {
    xml = strictBase64(fileQuyTrinh).toString('utf8');
  } catch (error) {
    return { status: 'INVALID_BASE64', message: error.message, tasks: [] };
  }
  if (!/<(?:[A-Za-z_][\w.-]*:)?definitions\b/i.test(xml) || !/BPMN/i.test(xml)) {
    return { status: 'INVALID_BPMN', message: 'Không tìm thấy definitions BPMN.', tasks: [] };
  }
  const tasks = extractUserTasks(xml);
  if (!tasks.length) return { status: 'NO_USER_TASK', message: 'BPMN không có userTask.', tasks: [] };
  const invalid = tasks.filter(task => !task.id || !task.id.startsWith('Activity_'));
  if (invalid.length) return { status: 'INVALID_ACTIVITY_ID', message: 'Có userTask thiếu id hoặc id không bắt đầu bằng Activity_.', tasks };
  return { status: 'VALID', message: `${tasks.length} bước Activity_*`, tasks };
}

function cellText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value).trim();
  if (Array.isArray(value.richText)) return value.richText.map(item => item.text).join('').trim();
  if (value.text !== undefined) return String(value.text).trim();
  if (value.result !== undefined) return String(value.result).trim();
  return String(value).trim();
}

function readRows(sheet) {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
}

function loadWorkbookConfig() {
  if (!fs.existsSync(workbookPath)) throw new Error(`Không tìm thấy file cấu hình ${path.basename(workbookPath)}.`);
  const workbook = XLSX.readFile(workbookPath);
  const catalogRows = readRows(workbook.Sheets.Danh_muc_buoc);
  const overrideRows = readRows(workbook.Sheets.Mapping_bo_sung);
  if (!catalogRows || !overrideRows) throw new Error('File Excel thiếu sheet Danh_muc_buoc hoặc Mapping_bo_sung.');

  const catalog = [];
  const catalogCodes = new Set();
  for (let index = 4; index < catalogRows.length; index += 1) {
    const row = catalogRows[index];
    const id = cellText(row[0]);
    const ma = cellText(row[1]);
    const ten = cellText(row[2]);
    const active = normalizeStepName(row[4]) === normalizeStepName('Có');
    if (!id && !ma && !ten) continue;
    if (!active) continue;
    if (!id || !ma || !ten) throw new Error(`Danh_muc_buoc dòng ${index + 1} thiếu id, mã hoặc tên.`);
    const code = normalizeStepName(ma);
    if (catalogCodes.has(code)) throw new Error(`Danh_muc_buoc trùng mã ${ma}.`);
    catalogCodes.add(code);
    catalog.push({ id, ma, ten });
  }
  if (!catalog.length) throw new Error('Danh_muc_buoc không có dòng kích hoạt.');

  const overrides = [];
  for (let index = 4; index < overrideRows.length; index += 1) {
    const row = overrideRows[index];
    const tenBuocBpmn = cellText(row[0]);
    const maDanhMucDvc = cellText(row[1]);
    const active = normalizeStepName(row[2]) === normalizeStepName('Có');
    if (!active) continue;
    if (!tenBuocBpmn || !maDanhMucDvc) throw new Error(`Mapping_bo_sung dòng ${index + 1} thiếu tên hoặc mã.`);
    if (!catalogCodes.has(normalizeStepName(maDanhMucDvc))) throw new Error(`Mapping bổ sung dùng mã chưa có trong catalog: ${maDanhMucDvc}.`);
    overrides.push({ tenBuocBpmn, maDanhMucDvc });
  }
  return { catalog, overrides, fileName: path.basename(workbookPath), catalogCount: catalog.length, overrideCount: overrides.length };
}

function loadDvcWorkflows() {
  if (!fs.existsSync(dvcWorkflowPath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(dvcWorkflowPath, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function buildMappings(tasks, catalog, overrides, processId, dvcMetadata) {
  const byName = new Map();
  const byCode = new Map();
  catalog.forEach(item => {
    const nameKey = normalizeStepName(item.ten);
    if (!byName.has(nameKey)) byName.set(nameKey, []);
    byName.get(nameKey).push(item);
    byCode.set(normalizeStepName(item.id), item);
    byCode.set(normalizeStepName(item.ma), item);
  });
  const overrideByName = new Map();
  overrides.forEach(item => {
    const catalogItem = byCode.get(normalizeStepName(item.maDanhMucDvc));
    if (!catalogItem) return;
    const key = normalizeStepName(item.tenBuocBpmn);
    if (!overrideByName.has(key)) overrideByName.set(key, []);
    if (!overrideByName.get(key).some(candidate => candidate.id === catalogItem.id)) overrideByName.get(key).push(catalogItem);
  });

  const mappings = [];
  const unmatched = [];
  const ambiguous = [];
  const usedOverrides = [];
  tasks.forEach(task => {
    const key = normalizeStepName(task.name);
    let candidates = byName.get(key) || [];
    let usedOverride = false;
    if (!candidates.length) {
      candidates = overrideByName.get(key) || [];
      usedOverride = candidates.length > 0;
    }
    if (!candidates.length) return unmatched.push({ idLpm: task.id, ten: task.name });
    if (candidates.length > 1) return ambiguous.push({ idLpm: task.id, ten: task.name, candidates: candidates.map(item => item.id) });
    const item = candidates[0];
    if (usedOverride) usedOverrides.push({ idLpm: task.id, ten: task.name, maDanhMucDvc: item.ma });
    mappings.push({
      id: item.id,
      ma: item.ma,
      ten: decodeEntities(item.ten),
      idLpm: task.id,
      idQuyTrinhLpm: processId,
      ...(dvcMetadata?.idThuTucDvc ? { idThuTucDvc: String(dvcMetadata.idThuTucDvc) } : {}),
      ...(dvcMetadata?.idQuyTrinhDvc ? { idQuyTrinhDvc: String(dvcMetadata.idQuyTrinhDvc) } : {})
    });
  });
  return { mappings, unmatched, ambiguous, usedOverrides };
}

function cleanToken(value) { return String(value ?? '').trim().replace(/^Bearer\s+/i, ''); }

async function request(endpoint, { token, method = 'GET', body, params } = {}) {
  const url = `${CONFIG.ILIS_GATEWAY_URL}${endpoint}`;
  const response = await axios({
    url,
    method,
    params,
    data: body,
    headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${cleanToken(token)}` },
    timeout: 75000,
    validateStatus: () => true
  });
  const payload = response.data;
  const success = response.status >= 200 && response.status < 300 && payload?.isError !== true;
  if (!success) {
    const error = new Error(payload?.message || `ILIS trả HTTP ${response.status}.`);
    error.status = response.status;
    error.data = payload;
    throw error;
  }
  return payload;
}

async function searchProcesses(token) {
  const items = [];
  let pageNumber = 1;
  let totalPages = 1;
  do {
    const response = await request('/lpm/api/QuyTrinhManage/Search', {
      token,
      method: 'POST',
      body: { idThuTuc: '', idLinhVuc: '', fullTextSearch: '', pageSize: '100', pageNumber }
    });
    const page = response?.data;
    if (!page || !Array.isArray(page.items)) throw new Error('QuyTrinhManage/Search không trả data.items.');
    items.push(...page.items);
    totalPages = Math.max(1, Number(page.totalPages || 1));
    pageNumber += 1;
  } while (pageNumber <= totalPages && pageNumber <= 1000);
  return items;
}

function findDvcMetadata(item, dvcWorkflows) {
  const code = String(item.maQuyTrinh ?? '').trim().toUpperCase();
  return dvcWorkflows.find(row => String(row.maQtttIg ?? '').trim().toUpperCase() === code)
    || dvcWorkflows.find(row => String(row.maQuyTrinh ?? '').trim().toUpperCase() === code)
    || null;
}

function mapRecordData(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

function readMappingEntries(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try { return JSON.parse(value); } catch { return []; }
}

async function getMapRecord(token, processId) {
  const response = await request('/lpm/api/MapDanhMucDvc/GetByLoaiDanhMuc', {
    token,
    params: { loai: 'BuocQuyTrinh', thamChieuLpm: processId }
  });
  return mapRecordData(response.data);
}

function publicProcess(item, validation, dvcMetadata) {
  const dvcMatched = Boolean(dvcMetadata?.idThuTucDvc && dvcMetadata?.idQuyTrinhDvc);
  return {
    id: String(item.id || ''),
    maQuyTrinh: String(item.maQuyTrinh || ''),
    tenQuyTrinh: String(item.tenQuyTrinh || ''),
    tenTrangThai: String(item.tenTrangThai || ''),
    isActive: normalizeStepName(item.tenTrangThai) === normalizeStepName('Hoạt động'),
    fileStatus: validation.status,
    validationMessage: validation.message,
    taskCount: validation.tasks.length,
    dvcStatus: dvcMatched ? 'FOUND' : 'NOT_FOUND',
    idQuyTrinhDvc: dvcMetadata?.idQuyTrinhDvc || '',
    idThuTucDvc: dvcMetadata?.idThuTucDvc || '',
    eligible: normalizeStepName(item.tenTrangThai) === normalizeStepName('Hoạt động') && validation.status === 'VALID' && dvcMatched,
    mapStatus: 'NOT_RUN'
  };
}

function describeFailures(unmatched, ambiguous) {
  const parts = [];
  if (unmatched.length) parts.push(`Chưa có catalog/mapping bổ sung: ${unmatched.map(item => `${item.ten} (${item.idLpm})`).join('; ')}`);
  if (ambiguous.length) parts.push(`Khớp nhiều danh mục: ${ambiguous.map(item => `${item.ten} → ${item.candidates.join(', ')}`).join('; ')}`);
  return parts.join(' | ');
}

export async function checkBpmnStepMappings() {
  const token = getToken();
  if (!token) throw Object.assign(new Error('Chưa nhập Bearer Token.'), { status: 401 });
  const config = loadWorkbookConfig();
  const [items, dvcWorkflows] = await Promise.all([searchProcesses(token), Promise.resolve(loadDvcWorkflows())]);
  const processCache = new Map();
  const processes = items.map(item => {
    const validation = validateBpmn(item.fileQuyTrinh);
    const dvcMetadata = findDvcMetadata(item, dvcWorkflows);
    processCache.set(String(item.id), { item, validation, dvcMetadata });
    return publicProcess(item, validation, dvcMetadata);
  });
  const runId = crypto.randomUUID();
  runs.set(runId, { createdAt: Date.now(), processCache, catalog: config.catalog, overrides: config.overrides });
  return {
    runId,
    processes,
    summary: {
      total: processes.length,
      active: processes.filter(item => item.isActive).length,
      eligible: processes.filter(item => item.eligible).length,
      validBpmn: processes.filter(item => item.fileStatus === 'VALID').length,
      dvcMatched: processes.filter(item => item.dvcStatus === 'FOUND').length,
      noFile: processes.filter(item => item.fileStatus === 'NO_FILE').length,
      catalogCount: config.catalogCount,
      overrideCount: config.overrideCount,
      configFile: config.fileName
    }
  };
}

export async function mapOneBpmnProcess({ runId, processId, dryRun = false }) {
  const token = getToken();
  if (!token) throw Object.assign(new Error('Chưa nhập Bearer Token.'), { status: 401 });
  const run = runs.get(String(runId));
  if (!run || Date.now() - run.createdAt > RUN_TTL_MS) throw new Error('Phiên kiểm tra đã hết hạn; hãy kiểm tra lại.');
  const cached = run.processCache.get(String(processId));
  if (!cached) throw new Error('Không tìm thấy quy trình trong phiên kiểm tra.');
  if (normalizeStepName(cached.item.tenTrangThai) !== normalizeStepName('Hoạt động')) return { status: 'SKIPPED_INACTIVE', message: 'Bỏ qua vì quy trình không Hoạt động.' };
  if (cached.validation.status !== 'VALID') return { status: 'SKIPPED_INVALID_BPMN', message: cached.validation.message };
  if (!cached.dvcMetadata) return { status: 'DVC_WORKFLOW_NOT_FOUND', message: `Không tìm thấy mã DVC cho ${cached.item.maQuyTrinh}.` };

  const matched = buildMappings(cached.validation.tasks, run.catalog, run.overrides, cached.item.id, cached.dvcMetadata);
  if (matched.unmatched.length || matched.ambiguous.length) {
    return { status: 'NAME_MATCH_FAILED', message: describeFailures(matched.unmatched, matched.ambiguous), unmatched: matched.unmatched, ambiguous: matched.ambiguous };
  }
  if (dryRun) return { status: 'DRY_RUN_OK', message: `Đối chiếu thành công ${matched.mappings.length} bước.`, mappingCount: matched.mappings.length };

  const record = await getMapRecord(token, cached.item.id);
  const payload = {
    id: record?.id ?? 0,
    loaiDanhMuc: record?.loaiDanhMuc || 'BuocQuyTrinh',
    mapGiaTri: JSON.stringify(matched.mappings),
    apiDvc: record?.apiDvc || '',
    thamChieuLpm: cached.item.id,
    moTa: record?.moTa || ''
  };
  const endpoint = record ? '/lpm/api/MapDanhMucDvc/Edit' : '/lpm/api/MapDanhMucDvc/Add';
  const method = record ? 'PUT' : 'POST';
  if (record && method === 'PUT') {
    const backupDir = path.join(serverRoot, 'data', 'bpmn-mapping-backups');
    await fsPromises.mkdir(backupDir, { recursive: true });
    const backupName = `${new Date().toISOString().replace(/[:.]/g, '-')}_${cached.item.id}.json`;
    await fsPromises.writeFile(path.join(backupDir, backupName), JSON.stringify(record, null, 2), 'utf8');
  }
  await request(endpoint, { token, method, body: payload });
  const verified = await getMapRecord(token, cached.item.id);
  const actualIds = readMappingEntries(verified?.mapGiaTri).map(item => item.idLpm).sort();
  const expectedIds = matched.mappings.map(item => item.idLpm).sort();
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) return { status: 'VERIFY_FAILED', message: `${method} thành công nhưng dữ liệu đọc lại không khớp.` };
  return { status: record ? 'UPDATED' : 'CREATED', message: `Đã ${record ? 'cập nhật' : 'tạo'} mapping ${matched.mappings.length} bước và xác minh thành công.`, mappingCount: matched.mappings.length };
}

setInterval(() => {
  const now = Date.now();
  for (const [runId, run] of runs) if (now - run.createdAt > RUN_TTL_MS) runs.delete(runId);
}, 60_000).unref();
