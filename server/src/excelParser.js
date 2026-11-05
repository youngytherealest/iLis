import XLSX from 'xlsx';

/**
 * Detects the most likely header row index (0-based) in a 2D array of rows.
 */
export function detectHeaderRow(rows) {
  const headerKeywords = [
    'MÃ THỦ TỤC', 'MA THU TUC', 'MÃ TTHC', 'TÊN THỦ TỤC', 'TEN THU TUC',
    'TÊN TẮT', 'LĨNH VỰC', 'LINH VUC', 'STT'
  ];

  for (let r = 0; r < Math.min(rows.length, 25); r++) {
    const row = rows[r] || [];
    const rowText = row.map(c => String(c || '').trim().toUpperCase()).join(' ');
    
    let matchCount = 0;
    for (const kw of headerKeywords) {
      if (rowText.includes(kw)) {
        matchCount++;
      }
    }

    if (matchCount >= 2) {
      return r;
    }
  }

  // Fallback: look for the first row with at least 4 non-empty string cells
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r] || [];
    const filledCells = row.filter(c => String(c || '').trim().length > 0);
    if (filledCells.length >= 4) {
      return r;
    }
  }

  return 0;
}

/**
 * Normalizes a procedure code so the whole code can be matched exactly.
 * Only repairs codes Excel stored as numbers: "1,11618" becomes "1.116180".
 * Suffixes are kept, so "1.013949" and "1.013949.H61" stay different codes.
 */
export function normalizeProcedureCode(value) {
  const code = String(value ?? '').trim().replace(/\s+/g, '').replace(/,/g, '.');
  const match = code.match(/^(\d)\.(\d{1,6})$/);
  return match ? `${match[1]}.${match[2].padEnd(6, '0')}` : code.toUpperCase();
}

/**
 * Parses the "Tổng hợp quy trình thủ tục" file into a TEN_TAT -> MA_CAP_THU_TUC map.
 * Codes carrying both level 1 and 3 are reported as conflicts and left out of the map.
 * @param {Buffer|string} input - Buffer or file path
 */
export function parseProcedureLevels(input) {
  const workbook = typeof input === 'string'
    ? XLSX.readFile(input)
    : XLSX.read(input, { type: 'buffer' });

  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: '' });
    const headerIndex = rows.slice(0, 25).findIndex(row => {
      const cells = row.map(c => String(c).trim().toUpperCase());
      return cells.includes('TEN_TAT') && cells.includes('MA_CAP_THU_TUC');
    });
    if (headerIndex === -1) continue;

    const headerCells = rows[headerIndex].map(c => String(c).trim().toUpperCase());
    const tenTatIdx = headerCells.indexOf('TEN_TAT');
    const maCapIdx = headerCells.indexOf('MA_CAP_THU_TUC');

    const levelsByCode = new Map();
    let totalRows = 0;
    for (const row of rows.slice(headerIndex + 1)) {
      const code = normalizeProcedureCode(row[tenTatIdx]);
      const level = Number(row[maCapIdx]);
      if (!code || (level !== 1 && level !== 3)) continue;
      totalRows++;
      if (!levelsByCode.has(code)) levelsByCode.set(code, new Set());
      levelsByCode.get(code).add(level);
    }

    const levelMap = {};
    const conflicts = [];
    for (const [code, levels] of levelsByCode) {
      if (levels.size > 1) {
        conflicts.push(code);
      } else {
        levelMap[code] = [...levels][0];
      }
    }

    const levels = Object.values(levelMap);
    return {
      sheetName,
      totalRows,
      totalCodes: levels.length,
      provinceCount: levels.filter(l => l === 3).length,
      communeCount: levels.filter(l => l === 1).length,
      conflicts,
      levelMap
    };
  }

  throw new Error('Không tìm thấy cột TEN_TAT và MA_CAP_THU_TUC trong file.');
}

/**
 * Parses an Excel buffer or file path.
 * @param {Buffer|string} input - Buffer or file path
 * @param {Object} options - Options { sheetName, headerRowIndex }
 */
export function parseExcel(input, options = {}) {
  const workbook = typeof input === 'string'
    ? XLSX.readFile(input, { raw: false, cellDates: true })
    : XLSX.read(input, { type: 'buffer', raw: false, cellDates: true });

  const sheetNames = workbook.SheetNames;
  if (!sheetNames || sheetNames.length === 0) {
    throw new Error('File Excel không có sheet nào.');
  }

  const selectedSheetName = options.sheetName && sheetNames.includes(options.sheetName)
    ? options.sheetName
    : sheetNames[0];

  const worksheet = workbook.Sheets[selectedSheetName];
  if (!worksheet) {
    throw new Error(`Không tìm thấy sheet: ${selectedSheetName}`);
  }

  // Merged cells
  const merges = (worksheet['!merges'] || []).map(m => ({
    start: { col: m.s.c, row: m.s.r },
    end: { col: m.e.c, row: m.e.r }
  }));

  // Parse to 2D array, preserving string values and formatting
  const rawRows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: ''
  });

  if (rawRows.length === 0) {
    return {
      sheetNames,
      selectedSheetName,
      headerRowIndex: 0,
      columns: [],
      rows: [],
      totalRows: 0,
      merges: [],
      domains: []
    };
  }

  // Determine header row index
  const detectedHeaderIndex = detectHeaderRow(rawRows);
  const headerRowIndex = (options.headerRowIndex !== undefined && options.headerRowIndex !== null)
    ? Number(options.headerRowIndex)
    : detectedHeaderIndex;

  const rawHeader = rawRows[headerRowIndex] || [];
  // Build columns list with column letters (A, B, C...) and header names
  const columns = [];
  const maxCols = Math.max(...rawRows.slice(0, 30).map(r => r.length), rawHeader.length);

  for (let c = 0; c < maxCols; c++) {
    const colLetter = XLSX.utils.encode_col(c);
    const colName = String(rawHeader[c] || '').trim();
    columns.push({
      index: c,
      letter: colLetter,
      label: colName ? `${colLetter} - ${colName}` : `${colLetter} (Cột ${c + 1})`,
      name: colName || `Cột ${c + 1}`
    });
  }

  // Filter and build clean data rows
  const dataRows = [];
  const domainsSet = new Set();
  const footerKeywords = ['người lập báo cáo', 'nguoi lap bao cao', 'tổng số', 'tong so', 'trang '];

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r] || [];
    const rowJoined = row.map(v => String(v || '').trim().toLowerCase()).join(' ');

    // Skip empty rows
    const hasValues = row.some(v => String(v || '').trim().length > 0);
    if (!hasValues) continue;

    // Skip footer rows (e.g. signature, author)
    const isFooter = footerKeywords.some(kw => rowJoined.includes(kw));
    if (isFooter) continue;

    // Build row object mapping column letters and names
    const rowObj = {
      _rowIndex: r + 1, // 1-indexed Excel row number
      _raw: row
    };

    columns.forEach((col, idx) => {
      const val = row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : '';
      rowObj[col.letter] = val;
      if (col.name) {
        rowObj[col.name] = val;
      }
    });

    dataRows.push(rowObj);
  }

  // Find domain column to extract unique domains
  const domainCol = columns.find(c => 
    c.name.toUpperCase().includes('LĨNH VỰC') || 
    c.name.toUpperCase().includes('LINH VUC')
  );

  if (domainCol) {
    dataRows.forEach(r => {
      const d = r[domainCol.letter] || r[domainCol.name];
      if (d && String(d).trim()) {
        domainsSet.add(String(d).trim());
      }
    });
  }

  return {
    sheetNames,
    selectedSheetName,
    headerRowIndex,
    detectedHeaderIndex,
    columns,
    rows: dataRows,
    totalRows: dataRows.length,
    mergesCount: merges.length,
    domains: Array.from(domainsSet),
    domainColumnLetter: domainCol ? domainCol.letter : null
  };
}
