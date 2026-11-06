import axios from 'axios';
import { getToken } from './db.js';
import { CONFIG } from './config.js';

/**
 * Sends a procedure payload to ILIS LPM API or simulated Mock API.
 * @param {Object} payload - The procedure payload
 * @param {Object} options - { gatewayUrl, endpointPath, mockMode }
 */
export async function sendProcedureToIlis(payload, options = {}) {
  const {
    gatewayUrl = CONFIG.ILIS_GATEWAY_URL,
    endpointPath = CONFIG.ILIS_ADD_PROCEDURE_PATH,
    mockMode = false
  } = options;

  const token = getToken();

  // If in Mock Mode, simulate realistic response
  if (mockMode) {
    await new Promise(res => setTimeout(res, 120));

    // Validate payload structure
    if (!payload.maThuTuc || !payload.tenThuTuc) {
      return {
        success: false,
        httpStatus: 400,
        type: 'CLIENT_ERROR',
        message: 'Dữ liệu không hợp lệ: Thiếu mã hoặc tên thủ tục.',
        data: null
      };
    }

    if (!payload.idLinhVuc) {
      return {
        success: false,
        httpStatus: 400,
        type: 'CLIENT_ERROR',
        message: 'Dữ liệu không hợp lệ: Thiếu idLinhVuc.',
        data: null
      };
    }

    if (payload.mucDoThuTuc !== 3) {
      return {
        success: false,
        httpStatus: 400,
        type: 'CLIENT_ERROR',
        message: 'mucDoThuTuc phải luôn bằng 3 (Dịch vụ công trực tuyến một phần).',
        data: null
      };
    }

    // Simulate mock duplicate check
    if (payload.maThuTuc === 'DUPLICATE_TEST') {
      return {
        success: false,
        httpStatus: 409,
        type: 'CONFLICT_ERROR',
        message: `Mã thủ tục ${payload.maThuTuc} đã tồn tại trong hệ thống ILIS.`,
        data: null
      };
    }

    return {
      success: true,
      httpStatus: 200,
      type: 'SUCCESS',
      message: `[MOCK] Thêm mới thủ tục "${payload.maThuTuc}" thành công.`,
      data: {
        id: 'MOCK_' + Math.random().toString(36).substring(2, 10).toUpperCase(),
        maThuTuc: payload.maThuTuc,
        tenThuTuc: payload.tenThuTuc,
        mucDoThuTuc: 3
      }
    };
  }

  // Live Mode: Requires Bearer Token
  if (!token) {
    return {
      success: false,
      httpStatus: 401,
      type: 'AUTH_ERROR',
      message: 'Chưa nhập Bearer Token hoặc Token đã bị xóa. Vui lòng cập nhật Token.',
      data: null
    };
  }

  const targetUrl = `${gatewayUrl.replace(/\/$/, '')}/${endpointPath.replace(/^\//, '')}`;

  try {
    const response = await axios.post(targetUrl, payload, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      timeout: 30000,
      validateStatus: () => true // Allow handling all status codes manually
    });

    const status = response.status;
    const body = response.data;

    if (status >= 200 && status < 300) {
      // Check business-level status in response body
      if (body && typeof body === 'object') {
        if (body.isSuccess === false || body.success === false) {
          return {
            success: false,
            httpStatus: status,
            type: 'BUSINESS_ERROR',
            message: body.message || body.errorMessage || 'Hệ thống ILIS báo lỗi nghiệp vụ.',
            data: body
          };
        }
      }

      return {
        success: true,
        httpStatus: status,
        type: 'SUCCESS',
        message: (body && body.message) ? body.message : 'Tạo mới thủ tục thành công.',
        data: body
      };
    }

    // HTTP 400 Bad Request
    if (status === 400) {
      const msg = (body && (body.message || body.title || JSON.stringify(body.errors))) || 'Dữ liệu gửi lên không hợp lệ.';
      return {
        success: false,
        httpStatus: 400,
        type: 'CLIENT_ERROR',
        message: `HTTP 400 - Dữ liệu không hợp lệ: ${msg}`,
        data: body
      };
    }

    // HTTP 401 Unauthorized
    if (status === 401) {
      return {
        success: false,
        httpStatus: 401,
        type: 'AUTH_ERROR',
        message: 'HTTP 401 - Token hết hạn hoặc không hợp lệ. Vui lòng lấy token mới từ DevTools.',
        data: body
      };
    }

    // HTTP 403 Forbidden
    if (status === 403) {
      return {
        success: false,
        httpStatus: 403,
        type: 'FORBIDDEN_ERROR',
        message: 'HTTP 403 - Tài khoản không đủ quyền thực hiện thao tác này.',
        data: body
      };
    }

    // HTTP 409 Conflict
    if (status === 409) {
      return {
        success: false,
        httpStatus: 409,
        type: 'CONFLICT_ERROR',
        message: `HTTP 409 - Mã thủ tục "${payload.maThuTuc}" đã tồn tại trên ILIS.`,
        data: body
      };
    }

    // HTTP 429 Rate Limit
    if (status === 429) {
      return {
        success: false,
        httpStatus: 429,
        type: 'RATE_LIMIT_ERROR',
        message: 'HTTP 429 - Hệ thống đang giới hạn tần suất request. Vui lòng tăng delay hoặc tạm dừng.',
        data: body
      };
    }

    // HTTP 500/502/503/504
    if (status >= 500) {
      return {
        success: false,
        httpStatus: status,
        type: 'SERVER_ERROR',
        message: `HTTP ${status} - Máy chủ ILIS gặp sự cố. (${(body && body.message) || 'Lỗi server'})`,
        data: body
      };
    }

    return {
      success: false,
      httpStatus: status,
      type: 'UNKNOWN_ERROR',
      message: `HTTP ${status} - ${(body && body.message) || 'Phản hồi không xác định.'}`,
      data: body
    };

  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      return {
        success: false,
        httpStatus: 0,
        type: 'TIMEOUT_ERROR',
        message: 'Quá thời gian kết nối tới API ILIS (Timeout 30s).',
        data: null
      };
    }

    return {
      success: false,
      httpStatus: 0,
      type: 'NETWORK_ERROR',
      message: `Không thể kết nối tới ILIS Gateway: ${err.message}`,
      data: null
    };
  }
}

/**
 * Uploads a BPMN file to an existing ILIS procedure.
 * The ILIS endpoint expects JSON with the exact fields idQuyTrinh and
 * fileQuyTrinh. fileQuyTrinh is the Base64 content of the BPMN XML file.
 */
export async function updateProcedureFile(fileBuffer, fileName, mimeType, idQuyTrinh, options = {}) {
  const {
    gatewayUrl = CONFIG.ILIS_GATEWAY_URL,
    endpointPath = CONFIG.ILIS_UPDATE_PROCEDURE_FILE_PATH
  } = options;

  const token = getToken();
  if (!token) {
    return {
      success: false,
      httpStatus: 401,
      type: 'AUTH_ERROR',
      message: 'Chưa nhập Bearer Token hoặc Token đã bị xóa. Vui lòng cập nhật Token.',
      data: null
    };
  }

  const targetUrl = `${gatewayUrl.replace(/\/$/, '')}/${endpointPath.replace(/^\//, '')}`;
  const payload = {
    idQuyTrinh: String(idQuyTrinh),
    fileQuyTrinh: Buffer.from(fileBuffer).toString('base64')
  };

  try {
    const response = await axios.post(targetUrl, payload, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      timeout: 60000,
      validateStatus: () => true
    });

    const body = response.data;
    const bodyError = body && typeof body === 'object'
      ? body.isError === true || body.isSuccess === false || body.success === false
      : false;
    const success = response.status >= 200 && response.status < 300 && !bodyError;
    const bodyMessage = body && typeof body === 'object'
      ? body.message || body.error || body.errorMessage || (body.errors ? JSON.stringify(body.errors) : '')
      : '';

    return {
      success,
      httpStatus: response.status,
      type: success ? 'SUCCESS' : response.status === 401 ? 'AUTH_ERROR' : 'API_ERROR',
      message: bodyMessage || (success ? 'Cập nhật file quy trình thành công.' : `ILIS trả về HTTP ${response.status}.`),
      data: body
    };
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      return {
        success: false,
        httpStatus: 0,
        type: 'TIMEOUT_ERROR',
        message: 'Quá thời gian kết nối tới API cập nhật file quy trình (60s).',
        data: null
      };
    }

    return {
      success: false,
      httpStatus: 0,
      type: 'NETWORK_ERROR',
      message: `Không thể kết nối tới ILIS Gateway: ${err.message}`,
      data: null
    };
  }
}

function normalizeApiResult(response, fallbackSuccessMessage, fallbackErrorMessage) {
  const body = response.data;
  const bodyError = body && typeof body === 'object'
    ? body.isError === true || body.isSuccess === false || body.success === false
    : false;
  const success = response.status >= 200 && response.status < 300 && !bodyError;
  const detail = body && typeof body === 'object' && body.chiTietLoi && typeof body.chiTietLoi === 'object'
    ? body.chiTietLoi
    : null;
  const detailMessage = detail?.message || detail?.maLoi || (detail ? JSON.stringify(detail) : '');
  const message = body && typeof body === 'object'
    ? body.message || body.error || body.errorMessage || (body.errors ? JSON.stringify(body.errors) : '') || detailMessage
    : '';
  const responseDetail = !success && body
    ? ` Chi tiết phản hồi: ${typeof body === 'string' ? body : JSON.stringify(body)}`
    : '';

  const resolvedMessage = message || (success ? fallbackSuccessMessage : `${fallbackErrorMessage} HTTP ${response.status}.`);
  return {
    success,
    httpStatus: response.status,
    type: success ? 'SUCCESS' : response.status === 401 ? 'AUTH_ERROR' : 'API_ERROR',
    message: success ? resolvedMessage : `${resolvedMessage}${responseDetail}`,
    data: body
  };
}

function getApiErrorResult(err, timeoutMessage) {
  if (err.code === 'ECONNABORTED') {
    return {
      success: false,
      httpStatus: 0,
      type: 'TIMEOUT_ERROR',
      message: timeoutMessage,
      data: null
    };
  }

  return {
    success: false,
    httpStatus: 0,
    type: 'NETWORK_ERROR',
    message: `Không thể kết nối tới ILIS Gateway: ${err.message}`,
    data: null
  };
}

// Buoc/Search returns the complete workflow-step object, but some collection
// properties are returned as null. CauHinhBuocThuocQuyTrinh processes those
// properties as collections and can throw a NullReferenceException when they
// remain null. Keep every field from Search and only normalize known list
// fields to the shape returned by the configuration endpoint.
const PROCEDURE_STEP_COLLECTION_FIELDS = [
  'ketQuaBuocs',
  'fileDinhKems',
  'tienTrinhXuLys',
  'cauHinhPhanCongCTs',
  'cauHinhPhanCongTuDongCTs',
  'phanCongs',
  'buocXuLys',
  'cauHinhBuocs',
  'cauHinhMails',
  'fileDinhKemHistories',
  'tienTrinhXuLyHistories',
  'phanCongHistories',
  'buocXuLyHistories'
];

function normalizeProcedureStepForConfigure(step) {
  const normalized = { ...step };
  PROCEDURE_STEP_COLLECTION_FIELDS.forEach(field => {
    if (normalized[field] === null || normalized[field] === undefined) {
      normalized[field] = [];
    }
  });
  return normalized;
}

/** Searches the workflow steps belonging to one procedure. */
export async function searchProcedureSteps(idQuyTrinh, options = {}) {
  const {
    gatewayUrl = CONFIG.ILIS_GATEWAY_URL,
    endpointPath = CONFIG.ILIS_SEARCH_PROCEDURE_STEPS_PATH,
    pageNumber = 1,
    pageSize = 20
  } = options;
  const token = getToken();

  if (!token) {
    return {
      success: false,
      httpStatus: 401,
      type: 'AUTH_ERROR',
      message: 'Chưa nhập Bearer Token hoặc Token đã bị xóa. Vui lòng cập nhật Token.',
      data: null,
      items: []
    };
  }

  const targetUrl = `${gatewayUrl.replace(/\/$/, '')}/${endpointPath.replace(/^\//, '')}`;
  try {
    const response = await axios.post(targetUrl, {
      idQuyTrinh: String(idQuyTrinh),
      isGetBuocTrongQuyTrinh: true,
      fullTextSearch: '',
      pageNumber,
      pageSize
    }, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      timeout: 60000,
      validateStatus: () => true
    });

    const result = normalizeApiResult(
      response,
      'Tải danh sách bước thành công.',
      'ILIS không trả về danh sách bước.'
    );
    const data = result.data?.data || {};
    return {
      ...result,
      items: Array.isArray(data.items) ? data.items : [],
      pagination: {
        pageIndex: data.pageIndex || pageNumber,
        pageSize: data.pageSize || pageSize,
        totalCount: data.totalCount || 0,
        totalPages: data.totalPages || 1,
        hasNextPage: Boolean(data.hasNextPage)
      }
    };
  } catch (err) {
    return { ...getApiErrorResult(err, 'Quá thời gian tải danh sách bước từ ILIS (60s).'), items: [] };
  }
}

/** Deploys/applies one workflow process in Activiti. */
export async function deployProcedure(idQuyTrinh, options = {}) {
  const {
    gatewayUrl = CONFIG.ILIS_GATEWAY_URL,
    endpointPath = CONFIG.ILIS_DEPLOY_PROCESS_PATH
  } = options;
  const token = getToken();

  if (!token) {
    return {
      success: false,
      httpStatus: 401,
      type: 'AUTH_ERROR',
      message: 'ChÆ°a nháº­p Bearer Token hoáº·c Token Ä‘Ã£ bá»‹ xÃ³a. Vui lÃ²ng cáº­p nháº­t Token.',
      data: null,
      idQuyTrinh: String(idQuyTrinh)
    };
  }

  const targetUrl = `${gatewayUrl.replace(/\/$/, '')}/${endpointPath.replace(/^\//, '')}`;
  try {
    const response = await axios.post(targetUrl, null, {
      params: { quytrinhId: String(idQuyTrinh) },
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`
      },
      timeout: 60000,
      validateStatus: () => true
    });

    return {
      ...normalizeApiResult(
        response,
        'Áp dụng quy trình thành công.',
        'ILIS từ chối áp dụng quy trình.'
      ),
      idQuyTrinh: String(idQuyTrinh)
    };
  } catch (err) {
    return {
      ...getApiErrorResult(err, 'Quá thời gian áp dụng quy trình (60s).'),
      idQuyTrinh: String(idQuyTrinh)
    };
  }
}

/** Updates the workflow-step configuration array returned by Buoc/Search. */
export async function configureProcedureSteps(idQuyTrinh, steps, options = {}) {
  const {
    gatewayUrl = CONFIG.ILIS_GATEWAY_URL,
    endpointPath = CONFIG.ILIS_CONFIGURE_PROCEDURE_STEPS_PATH
  } = options;
  const token = getToken();

  if (!token) {
    return {
      success: false,
      httpStatus: 401,
      type: 'AUTH_ERROR',
      message: 'Chưa nhập Bearer Token hoặc Token đã bị xóa. Vui lòng cập nhật Token.',
      data: null
    };
  }

  const targetUrl = `${gatewayUrl.replace(/\/$/, '')}/${endpointPath.replace(/^\//, '')}`;

  try {
    // ILIS expects the complete Buoc object returned by Search. The client
    // updates only idTrangThaiHoSo, thoiGianThucHien and
    // thoiGianThucHienTime before sending this array.
    const payload = Array.isArray(steps)
      ? steps.map(normalizeProcedureStepForConfigure)
      : [];
    const response = await axios.post(targetUrl, payload, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      timeout: 60000,
      validateStatus: () => true
    });

    if (response.status >= 400 || response.data?.isError === true) {
      console.error('[ILIS][CauHinhBuocThuocQuyTrinh]', {
        idQuyTrinh: String(idQuyTrinh),
        httpStatus: response.status,
        code: response.data?.code,
        message: response.data?.message,
        chiTietLoi: response.data?.chiTietLoi,
        steps: payload.map(step => ({
          id: step.id,
          maBuoc: step.maBuoc,
          nullFields: Object.entries(step)
            .filter(([, value]) => value === null || value === undefined)
            .map(([field]) => field)
        }))
      });
    }

    return normalizeApiResult(
      response,
      `Cập nhật thời gian bước cho quy trình ${idQuyTrinh} thành công.`,
      'ILIS từ chối cập nhật thời gian bước.'
    );
  } catch (err) {
    return getApiErrorResult(err, 'Quá thời gian cập nhật thời gian bước lên ILIS (60s).');
  }
}

function extractListFromApiBody(body) {
  const findArray = (value, depth = 0) => {
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object' || depth > 5) return null;

    const preferredKeys = ['data', 'items', 'result', 'list', 'rows', 'records', 'content'];
    for (const key of preferredKeys) {
      const found = findArray(value[key], depth + 1);
      if (found) return found;
    }
    for (const child of Object.values(value)) {
      const found = findArray(child, depth + 1);
      if (found) return found;
    }
    return null;
  };

  return findArray(body) || [];
}

async function getProcedureList(path, params, options = {}) {
  const {
    gatewayUrl = CONFIG.ILIS_GATEWAY_URL,
    endpointPath = path
  } = options;
  const token = getToken();

  if (!token) {
    return {
      success: false,
      httpStatus: 401,
      type: 'AUTH_ERROR',
      message: 'Chưa nhập Bearer Token hoặc Token đã bị xóa. Vui lòng cập nhật Token.',
      data: null,
      items: []
    };
  }

  const targetUrl = `${gatewayUrl.replace(/\/$/, '')}/${endpointPath.replace(/^\//, '')}`;
  try {
    const response = await axios.get(targetUrl, {
      params,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`
      },
      timeout: 60000,
      validateStatus: () => true
    });
    const result = normalizeApiResult(
      response,
      'Tải danh sách thủ tục thành công.',
      'ILIS không trả về danh sách thủ tục.'
    );
    return {
      ...result,
      items: extractListFromApiBody(response.data)
    };
  } catch (err) {
    return { ...getApiErrorResult(err, 'Quá thời gian tải danh sách thủ tục từ ILIS (60s).'), items: [] };
  }
}

/** Gets all LPM procedures in one LPM domain. */
export async function getAllLpmProcedures(linhVucId, options = {}) {
  return getProcedureList(
    CONFIG.ILIS_GET_ALL_PROCEDURES_BY_DOMAIN_PATH,
    { id: String(linhVucId || '') },
    options
  );
}

/** Gets all DVC procedures in one DVC domain. */
export async function getAllDvcProcedures(linhVucDvcId, keywordSearch = '', options = {}) {
  return getProcedureList(
    CONFIG.ILIS_GET_DVC_PROCEDURES_PATH,
    {
      linhVucDvcId: String(linhVucDvcId || ''),
      keywordSearch: String(keywordSearch || '')
    },
    options
  );
}

/** Gets the data types supported by the DVC/LPM mapping screen. */
export async function getDvcMappingDataTypes(options = {}) {
  return getProcedureList(
    CONFIG.ILIS_GET_MAPPING_DATA_TYPES_PATH,
    {},
    options
  );
}

/** Gets DVC domains that already have an LPM domain mapping. */
export async function getMappedDvcDomains(options = {}) {
  return getProcedureList(
    CONFIG.ILIS_GET_MAPPED_DVC_DOMAINS_PATH,
    {},
    options
  );
}

/** Gets the DVC department hierarchy for employee mapping. */
export async function getDvcDepartments(options = {}) {
  return getProcedureList(
    CONFIG.ILIS_GET_DVC_DEPARTMENTS_PATH,
    {},
    options
  );
}

/** Gets LPM users that can be selected as the mapping target. */
export async function getLpmUsers(options = {}) {
  return getProcedureList(
    CONFIG.ILIS_GET_LPM_USERS_PATH,
    {},
    options
  );
}

/** Gets the mapping already saved for a data type. */
export async function getDvcMappingByType(loaiDanhMuc, thamChieuLpm = '', options = {}) {
  return getProcedureList(
    CONFIG.ILIS_GET_DVC_MAPPING_BY_TYPE_PATH,
    {
      loai: String(loaiDanhMuc || ''),
      thamChieuLpm: String(thamChieuLpm || '')
    },
    options
  );
}

/** Gets DVC users belonging to one selected department. */
export async function getDvcUsersByDepartment(phongBanId, keywordSearch = '', options = {}) {
  return getProcedureList(
    CONFIG.ILIS_GET_DVC_USERS_BY_DEPARTMENT_PATH,
    {
      phongBanId: String(phongBanId || ''),
      keywordSearch: String(keywordSearch || '')
    },
    options
  );
}

/** Gets active LPM processes belonging to one LPM procedure. */
export async function getLpmProcessesByProcedureId(thuTucLpmId, options = {}) {
  return getProcedureList(
    CONFIG.ILIS_GET_LPM_PROCESSES_BY_PROCEDURE_PATH,
    { id: String(thuTucLpmId || '') },
    options
  );
}

/** Gets the administrative-unit tree available to the current user. */
export async function getDvhcTree(options = {}) {
  const {
    gatewayUrl = CONFIG.ILIS_GATEWAY_URL,
    endpointPath = CONFIG.ILIS_GET_DVHC_TREE_PATH
  } = options;
  const token = getToken();

  if (!token) {
    return {
      success: false,
      httpStatus: 401,
      type: 'AUTH_ERROR',
      message: 'Chưa nhập Bearer Token hoặc Token đã bị xóa. Vui lòng cập nhật Token.',
      data: null,
      items: []
    };
  }

  const targetUrl = `${gatewayUrl.replace(/\/$/, '')}/${endpointPath.replace(/^\//, '')}`;
  try {
    const response = await axios.post(targetUrl, {}, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      timeout: 60000,
      validateStatus: () => true
    });
    const result = normalizeApiResult(
      response,
      'Tải cây đơn vị hành chính thành công.',
      'ILIS không trả về cây đơn vị hành chính.'
    );
    return {
      ...result,
      items: extractListFromApiBody(response.data)
    };
  } catch (err) {
    return { ...getApiErrorResult(err, 'Quá thời gian tải cây đơn vị hành chính từ ILIS (60s).'), items: [] };
  }
}

/** Gets DVC processes belonging to one DVC procedure. */
export async function getDvcProcessesByProcedureId(thuTucDvcId, options = {}) {
  return getProcedureList(
    CONFIG.ILIS_GET_DVC_PROCESSES_BY_PROCEDURE_PATH,
    { thuTucDvcId: String(thuTucDvcId || '') },
    options
  );
}

/** Adds a DVC/LPM process mapping configuration. */
export async function addDvcProcessMapping(payload, options = {}) {
  const {
    gatewayUrl = CONFIG.ILIS_GATEWAY_URL,
    endpointPath = CONFIG.ILIS_ADD_DVC_MAPPING_PATH
  } = options;
  const token = getToken();

  if (!token) {
    return {
      success: false,
      httpStatus: 401,
      type: 'AUTH_ERROR',
      message: 'Chưa nhập Bearer Token hoặc Token đã bị xóa. Vui lòng cập nhật Token.',
      data: null
    };
  }

  const targetUrl = `${gatewayUrl.replace(/\/$/, '')}/${endpointPath.replace(/^\//, '')}`;
  const requestBody = {
    id: 0,
    loaiDanhMuc: 'QuyTrinh',
    mapGiaTri: Array.isArray(payload?.mapGiaTri)
      ? JSON.stringify(payload.mapGiaTri)
      : String(payload?.mapGiaTri || '[]'),
    apiDvc: String(payload?.apiDvc || ''),
    thamChieuLpm: String(payload?.thamChieuLpm || ''),
    moTa: String(payload?.moTa || '')
  };

  try {
    const response = await axios.post(targetUrl, requestBody, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      timeout: 60000,
      validateStatus: () => true
    });
    return normalizeApiResult(
      response,
      'Lưu ánh xạ quy trình thành công.',
      'ILIS từ chối lưu ánh xạ quy trình.'
    );
  } catch (err) {
    return getApiErrorResult(err, 'Quá thời gian lưu ánh xạ quy trình lên ILIS (60s).');
  }
}

/** Saves the complete DVC-to-LPM procedure mapping list. */
export async function editDvcProcedureMapping(payload, options = {}) {
  const {
    gatewayUrl = CONFIG.ILIS_GATEWAY_URL,
    endpointPath = CONFIG.ILIS_EDIT_DVC_MAPPING_PATH
  } = options;
  const token = getToken();

  if (!token) {
    return {
      success: false,
      httpStatus: 401,
      type: 'AUTH_ERROR',
      message: 'Chưa nhập Bearer Token hoặc Token đã bị xóa. Vui lòng cập nhật Token.',
      data: null
    };
  }

  const targetUrl = `${gatewayUrl.replace(/\/$/, '')}/${endpointPath.replace(/^\//, '')}`;
  const requestBody = {
    id: Number(payload?.id),
    loaiDanhMuc: String(payload?.loaiDanhMuc || 'ThuTuc'),
    mapGiaTri: Array.isArray(payload?.mapGiaTri)
      ? JSON.stringify(payload.mapGiaTri)
      : String(payload?.mapGiaTri || '[]'),
    apiDvc: String(payload?.apiDvc || ''),
    thamChieuLpm: String(payload?.thamChieuLpm || ''),
    moTa: String(payload?.moTa || '')
  };

  try {
    const response = await axios.put(targetUrl, requestBody, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      timeout: 60000,
      validateStatus: () => true
    });
    return normalizeApiResult(
      response,
      'Lưu mapping thủ tục DVC - LPM thành công.',
      'ILIS từ chối lưu mapping thủ tục DVC - LPM.'
    );
  } catch (err) {
    return getApiErrorResult(err, 'Quá thời gian lưu mapping thủ tục DVC - LPM (60s).');
  }
}
