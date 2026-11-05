import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

// In-memory token storage (NEVER written to disk or logs)
let inMemoryToken = '';

// Default persistent data
const defaultData = {
  settings: {
    gatewayUrl: CONFIG.ILIS_GATEWAY_URL,
    endpointPath: CONFIG.ILIS_ADD_PROCEDURE_PATH,
    delayMs: CONFIG.DEFAULT_DELAY_MS,
    laThuTucCapXa: true,
    thoiHanTraThongBaoThue: '2',
    trangThai: 1,
    mockMode: true // Defaults to mock mode for safe initial operation until user connects live
  },
  domainMappings: {
    'Đất đai': CONFIG.SAMPLE_DOMAIN_ID,
    'Đăng ký biện pháp bảo đảm': CONFIG.SAMPLE_DOMAIN_ID
  },
  mappingProfiles: {},
  procedureLevels: null,
  sessions: []
};

let storeCache = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadStore() {
  if (storeCache) return storeCache;
  ensureDataDir();
  if (!fs.existsSync(STORE_FILE)) {
    storeCache = JSON.parse(JSON.stringify(defaultData));
    saveStore();
    return storeCache;
  }
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf-8');
    storeCache = { ...defaultData, ...JSON.parse(raw) };
  } catch (err) {
    console.error('Error reading store.json, using defaults:', err);
    storeCache = JSON.parse(JSON.stringify(defaultData));
  }
  return storeCache;
}

export function saveStore() {
  ensureDataDir();
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(storeCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving store.json:', err);
  }
}

export function getSettings() {
  const store = loadStore();
  return store.settings;
}

export function updateSettings(newSettings) {
  const store = loadStore();
  store.settings = { ...store.settings, ...newSettings };
  saveStore();
  return store.settings;
}

export function getDomainMappings() {
  const store = loadStore();
  return store.domainMappings || {};
}

export function updateDomainMappings(mappings) {
  const store = loadStore();
  store.domainMappings = { ...store.domainMappings, ...mappings };
  saveStore();
  return store.domainMappings;
}

export function getProcedureLevels() {
  const store = loadStore();
  return store.procedureLevels || null;
}

export function setProcedureLevels(source) {
  const store = loadStore();
  store.procedureLevels = source;
  saveStore();
  return store.procedureLevels;
}

export function saveSession(session) {
  const store = loadStore();
  if (!store.sessions) store.sessions = [];
  // Ensure no sensitive data
  const safeSession = {
    id: session.id,
    fileName: session.fileName,
    startTime: session.startTime,
    endTime: session.endTime,
    total: session.total,
    success: session.success,
    failed: session.failed,
    skipped: session.skipped,
    status: session.status,
    records: (session.records || []).map(r => ({
      index: r.index,
      maThuTuc: r.maThuTuc,
      tenThuTuc: r.tenThuTuc,
      status: r.status,
      httpStatus: r.httpStatus,
      message: r.message,
      executedAt: r.executedAt
    }))
  };
  // Prepend new session
  store.sessions.unshift(safeSession);
  // Keep last 50 sessions
  if (store.sessions.length > 50) {
    store.sessions = store.sessions.slice(0, 50);
  }
  saveStore();
  return safeSession;
}

export function getSessions() {
  const store = loadStore();
  return (store.sessions || []).map(s => ({
    id: s.id,
    fileName: s.fileName,
    startTime: s.startTime,
    endTime: s.endTime,
    total: s.total,
    success: s.success,
    failed: s.failed,
    skipped: s.skipped,
    status: s.status
  }));
}

export function getSessionById(id) {
  const store = loadStore();
  return (store.sessions || []).find(s => s.id === id);
}

// In-Memory Token Management
export function setToken(token) {
  let cleaned = (token || '').trim();
  if (cleaned.toLowerCase().startsWith('bearer ')) {
    cleaned = cleaned.substring(7).trim();
  }
  inMemoryToken = cleaned;
}

export function getToken() {
  return inMemoryToken;
}

export function clearToken() {
  inMemoryToken = '';
}

export function getTokenStatus() {
  if (!inMemoryToken) {
    return {
      hasToken: false,
      preview: '',
      length: 0,
      isExpired: false
    };
  }

  // Attempt JWT expiration inspection if it's a JWT
  let isExpired = false;
  let expTime = null;
  try {
    const parts = inMemoryToken.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
      if (payload.exp) {
        expTime = new Date(payload.exp * 1000).toISOString();
        if (Date.now() >= payload.exp * 1000) {
          isExpired = true;
        }
      }
    }
  } catch {
    // not a standard JWT or payload not base64 json
  }

  const preview = inMemoryToken.length > 12 
    ? `${inMemoryToken.substring(0, 6)}...${inMemoryToken.substring(inMemoryToken.length - 4)}`
    : '******';

  return {
    hasToken: true,
    preview,
    length: inMemoryToken.length,
    isExpired,
    expTime
  };
}
