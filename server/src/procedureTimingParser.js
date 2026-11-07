import XLSX from 'xlsx';

function text(value) {
  return String(value ?? '').replace(/\u00a0/g, ' ').trim();
}

function normalizeText(value) {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function extractStepNumbers(value) {
  const match = text(value).match(/b\u01b0\u1edbc\s*([\d]+(?:[.,]\d+)?(?:\s*-\s*[\d]+(?:[.,]\d+)?)?)/i);
  if (!match) return [];
  return match[1]
    .split('-')
    .map(part => Number(part.trim().replace(',', '.')))
    .filter(Number.isFinite);
}

function parseDuration(value) {
  const source = text(value);
  const normalized = normalizeText(source);

  if (!source) return { status: 'empty', days: null, hours: null, reason: 'Thiếu thời gian.' };
  if (normalized.includes('tong thoi gian')) {
    return { status: 'total', days: null, hours: null, reason: 'Dòng tổng thời gian, không phải bước.' };
  }
  if (normalized.includes('khong tinh') || normalized.includes('khong quy dinh')) {
    // A non-counted duration is still a configured value. Never leave null
    // duration fields in the payload sent to CauHinhBuocThuocQuyTrinh.
    return { status: 'valid', inputDays: 0, days: 0, hours: 0, reason: 'Không tính thời gian: 0 ngày + 0 giờ.' };
  }

  const matches = [...source.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:ngày|day)/gi)]
    .map(match => Number(match[1].replace(',', '.')))
    .filter(Number.isFinite);

  if (matches.length === 0) {
    return { status: 'invalid', days: null, hours: null, reason: 'Không đọc được số ngày.' };
  }
  if (matches.length > 1) {
    return { status: 'ambiguous', days: null, hours: null, reason: 'Một ô chứa nhiều khoảng thời gian.' };
  }

  const totalHours = Math.round(matches[0] * 8 * 100) / 100;
  let days = Math.floor(totalHours / 8);
  let hours = Math.round(totalHours - days * 8);
  if (hours >= 8) {
    days += 1;
    hours = 0;
  }

  return {
    status: 'valid',
    inputDays: matches[0],
    days,
    hours,
    reason: null
  };
}

function isHeaderRow(row) {
  const first = normalizeText(row[0]);
  const second = normalizeText(row[1]);
  const fourth = normalizeText(row[3]);
  return first.includes('thu tu') && second.includes('noi dung') && fourth.includes('thoi gian');
}

function findHeaderIndexes(row) {
  const indexes = {};
  row.forEach((value, index) => {
    const key = normalizeText(value);
    if (key.includes('ma so do')) indexes.fileCode = index;
    if (key.includes('ten nhiem vu')) indexes.taskName = index;
    if (key.includes('thoi gian')) indexes.time = index;
    if (key.includes('stt nhiem vu')) indexes.sequence = index;
    if (key.includes('stt buoc')) indexes.stepLabel = index;
    if (key.includes('ma quy trinh ilis')) indexes.lpmCode = index;
    if (key.includes('noi dung cong viec')) indexes.content = index;
    if (key.includes('trach nhiem xu ly')) indexes.responsibility = index;
  });
  return indexes;
}

function isFlatProcedureTable(rows) {
  return rows.some(row => {
    const indexes = findHeaderIndexes(row);
    return Number.isInteger(indexes.fileCode)
      && Number.isInteger(indexes.taskName)
      && Number.isInteger(indexes.time)
      && Number.isInteger(indexes.lpmCode);
  });
}

function parseFlatProcedureTable(worksheet) {
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: ''
  });
  const headerIndex = rows.findIndex(row => {
    const indexes = findHeaderIndexes(row);
    return Number.isInteger(indexes.fileCode)
      && Number.isInteger(indexes.taskName)
      && Number.isInteger(indexes.time)
      && Number.isInteger(indexes.lpmCode);
  });
  if (headerIndex < 0) return [];

  const indexes = findHeaderIndexes(rows[headerIndex]);
  const grouped = new Map();
  rows.slice(headerIndex + 1).forEach((row, offset) => {
    const fileCode = text(row[indexes.fileCode]);
    const lpmCode = text(row[indexes.lpmCode]);
    const taskName = text(row[indexes.taskName]);
    if (!fileCode && !lpmCode && !taskName) return;
    if (!fileCode || !taskName) return;

    if (!grouped.has(fileCode)) grouped.set(fileCode, []);
    const stepLabel = text(row[indexes.stepLabel]);
    grouped.get(fileCode).push({
      rowNumber: headerIndex + offset + 2,
      stepLabel: taskName,
      stepNumbers: extractStepNumbers(stepLabel),
      content: text(row[indexes.content]),
      responsibility: text(row[indexes.responsibility]),
      timeText: text(row[indexes.time]),
      sectionTitle: text(row[1]) || fileCode,
      sourceFileCode: fileCode,
      sourceLpmCode: lpmCode,
      sequence: text(row[indexes.sequence]),
      duration: parseDuration(row[indexes.time])
    });
  });

  return [...grouped.entries()].map(([procedureCode, timingRows]) => ({
    sheetName: procedureCode,
    procedureCode,
    sourceProcedureCodes: [...new Set(timingRows.map(row => row.sourceLpmCode).filter(Boolean))],
    title: timingRows[0]?.sectionTitle || procedureCode,
    headerIndex,
    rowCount: rows.length,
    timingRows,
    mergesCount: (worksheet['!merges'] || []).length
  }));
}

function isTotalRow(row) {
  return normalizeText(row[0]).includes('tong thoi gian');
}

function extractSheetCode(sheetName) {
  return text(sheetName).replace(/_[TX]$/i, '');
}

function parseSheet(sheetName, worksheet) {
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: ''
  });

  let currentSectionTitle = text(rows[0]?.[0]);
  let headerIndex = -1;
  const timingRows = [];

  rows.forEach((row, index) => {
    if (isHeaderRow(row)) {
      headerIndex = index;
      return;
    }

    const first = text(row[0]);
    const content = text(row[1]);
    const responsibility = text(row[2]);
    const timeText = text(row[3]);
    if (!first && !content && !responsibility && !timeText) return;

    if (isTotalRow(row)) return;

    const stepNumbers = extractStepNumbers(first);
    if (first && stepNumbers.length === 0 && !timeText && !content) {
      currentSectionTitle = first;
      return;
    }

    const duration = parseDuration(timeText);
    if (!first && !content && !timeText) return;
    if (!first && !content && duration.status !== 'valid') return;

    timingRows.push({
      rowNumber: index + 1,
      stepLabel: first,
      stepNumbers,
      content,
      responsibility,
      timeText,
      sectionTitle: currentSectionTitle,
      duration
    });
  });

  return {
    sheetName,
    procedureCode: extractSheetCode(sheetName),
    title: text(rows[0]?.[0]),
    headerIndex,
    rowCount: rows.length,
    timingRows,
    mergesCount: (worksheet['!merges'] || []).length
  };
}

export function parseProcedureTimingWorkbook(input) {
  const workbook = typeof input === 'string'
    ? XLSX.readFile(input, { raw: false, cellDates: true })
    : XLSX.read(input, { type: 'buffer', raw: false, cellDates: true });

  const flatSheetName = workbook.SheetNames.find(sheetName => isFlatProcedureTable(
    XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, defval: '' })
  ));
  const sheets = flatSheetName
    ? parseFlatProcedureTable(workbook.Sheets[flatSheetName])
    : workbook.SheetNames.map(sheetName => parseSheet(sheetName, workbook.Sheets[sheetName]));
  return {
    success: true,
    sheetNames: workbook.SheetNames,
    sheetCount: sheets.length,
    sheets
  };
}

