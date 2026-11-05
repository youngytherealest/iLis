import { CONFIG } from './config.js';
import { normalizeProcedureCode } from './excelParser.js';

/**
 * Validates a GUID (e.g. 161A6A0F284D403C9EF8E1F612CCE8B5 or with dashes).
 */
export function isValidGuid(str) {
  if (!str || typeof str !== 'string') return false;
  const clean = str.replace(/[{}\-]/g, '').trim();
  return /^[0-9a-fA-F]{32}$/.test(clean);
}

/**
 * Generates an abbreviation if tenVietTat is empty.
 */
export function generateAbbreviation(name) {
  if (!name) return '';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return name.substring(0, 10).toUpperCase();
  return words.slice(0, 6).map(w => w[0].toUpperCase()).join('');
}

/**
 * Applies column mapping rules to raw Excel rows and constructs API payloads.
 * @param {Object|null} levelMap - TEN_TAT -> MA_CAP_THU_TUC; when set it decides laThuTucCapXa per row
 */
export function applyMapping(rows, mappingConfig = {}, domainMappings = {}, levelMap = null) {
  const {
    maThuTucCol = 'B',
    tenThuTucCol = 'D',
    tenVietTatCol = 'C',
    linhVucCol = 'E',
    moTaCol = '',
    defaults = {}
  } = mappingConfig;

  const defaultLaThuTucCapXa = defaults.laThuTucCapXa !== undefined ? Boolean(defaults.laThuTucCapXa) : true;
  const defaultIdLinhVuc = defaults.idLinhVuc || '';
  const defaultMoTa = defaults.moTa || '';
  const thoiHanTraThongBaoThue = String(defaults.thoiHanTraThongBaoThue !== undefined ? defaults.thoiHanTraThongBaoThue : '2');
  const trangThai = defaults.trangThai !== undefined ? Number(defaults.trangThai) : 1;

  // Track duplicate codes within Excel file
  const codeCounts = new Map();
  rows.forEach(r => {
    const code = String(r[maThuTucCol] || '').trim();
    if (code) {
      codeCounts.set(code, (codeCounts.get(code) || 0) + 1);
    }
  });

  const results = [];
  const globalSummary = {
    total: rows.length,
    valid: 0,
    invalid: 0,
    duplicates: 0,
    unmappedDomains: new Set(),
    missingFieldsReport: {
      maThuTucMissing: 0,
      tenThuTucMissing: 0,
      idLinhVucMissing: 0,
      tenVietTatGenerated: 0
    },
    levelReport: levelMap ? { province: 0, commune: 0, unmapped: 0 } : null
  };

  rows.forEach((row, idx) => {
    const rowIndex = row._rowIndex || idx + 1;
    const errors = [];
    const warnings = [];

    // 1. Mã thủ tục (preserve leading zeros as string)
    let maThuTuc = String(row[maThuTucCol] || '').trim();
    if (!maThuTuc) {
      errors.push(`Thiếu Mã thủ tục tại cột [${maThuTucCol}]`);
      globalSummary.missingFieldsReport.maThuTucMissing++;
    } else if (codeCounts.get(maThuTuc) > 1) {
      errors.push(`Mã thủ tục "${maThuTuc}" bị trùng lặp ${codeCounts.get(maThuTuc)} lần trong file Excel`);
      globalSummary.duplicates++;
    }

    // 2. Tên thủ tục
    let tenThuTuc = String(row[tenThuTucCol] || '').trim();
    if (!tenThuTuc) {
      errors.push(`Thiếu Tên thủ tục tại cột [${tenThuTucCol}]`);
      globalSummary.missingFieldsReport.tenThuTucMissing++;
    }

    // 3. Tên viết tắt
    let tenVietTat = tenVietTatCol ? String(row[tenVietTatCol] || '').trim() : '';
    if (!tenVietTat) {
      // Fallback: use maThuTuc or generated abbreviation
      tenVietTat = maThuTuc || generateAbbreviation(tenThuTuc);
      warnings.push(`Tên viết tắt trống, tự động gán: "${tenVietTat}"`);
      globalSummary.missingFieldsReport.tenVietTatGenerated++;
    }

    // 4. Lĩnh vực và ID Lĩnh vực
    let linhVucName = linhVucCol ? String(row[linhVucCol] || '').trim() : '';
    let idLinhVuc = '';

    if (linhVucName && domainMappings[linhVucName]) {
      idLinhVuc = domainMappings[linhVucName];
    } else if (defaultIdLinhVuc) {
      idLinhVuc = defaultIdLinhVuc;
      if (linhVucName) {
        warnings.push(`Lĩnh vực "${linhVucName}" chưa có mapping riêng, dùng ID mặc định`);
      }
    }

    if (!idLinhVuc) {
      errors.push(`Chưa xác định ID lĩnh vực (Lĩnh vực trong Excel: "${linhVucName || 'Trống'}"). Cần cấu hình ID.`);
      if (linhVucName) globalSummary.unmappedDomains.add(linhVucName);
      globalSummary.missingFieldsReport.idLinhVucMissing++;
    }

    // 5. Mức độ thủ tục (BẮT BUỘC: ALWAYS 3)
    const mucDoThuTuc = CONFIG.MANDATORY_MUC_DO_THU_TUC; // Always 3

    // 6. Mô tả
    let moTa = moTaCol ? String(row[moTaCol] || '').trim() : defaultMoTa;

    // 7. Cấp thủ tục: MA_CAP_THU_TUC = 3 là cấp tỉnh, còn lại (1 hoặc không map được) là cấp xã
    let laThuTucCapXa = defaultLaThuTucCapXa;
    if (levelMap) {
      const maCap = levelMap[normalizeProcedureCode(tenVietTat)] ?? levelMap[normalizeProcedureCode(maThuTuc)];
      laThuTucCapXa = maCap !== 3;
      if (maCap === undefined) {
        warnings.push(`Không tìm thấy "${tenVietTat}" trong file Tổng hợp quy trình thủ tục, tính là cấp xã`);
        globalSummary.levelReport.unmapped++;
      } else if (laThuTucCapXa) {
        globalSummary.levelReport.commune++;
      } else {
        globalSummary.levelReport.province++;
      }
    }

    // Build the official ILIS LPM API Payload
    const payload = {
      laThuTucCapXa,
      idLinhVuc,
      maThuTuc,
      tenThuTuc,
      tenVietTat,
      mucDoThuTuc, // 3
      moTa,
      thoiHanTraThongBaoThue,
      trangThai,
      thuTucLoaiGiayTos: []
    };

    const isValid = errors.length === 0;
    if (isValid) {
      globalSummary.valid++;
    } else {
      globalSummary.invalid++;
    }

    results.push({
      index: idx + 1,
      rowIndex,
      maThuTuc,
      tenThuTuc,
      tenVietTat,
      linhVucName,
      idLinhVuc,
      mucDoThuTuc,
      laThuTucCapXa,
      moTa,
      thoiHanTraThongBaoThue,
      trangThai,
      thuTucLoaiGiayTos: [],
      payload,
      isValid,
      errors,
      warnings,
      rawRow: row
    });
  });

  return {
    records: results,
    summary: {
      ...globalSummary,
      unmappedDomains: Array.from(globalSummary.unmappedDomains)
    }
  };
}
