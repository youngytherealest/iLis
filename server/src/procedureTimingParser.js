import XLSX from 'xlsx';

function text(value) {
  return String(value ?? '').replace(/\u00a0/g, ' ').trim();
}

function normalizeText(value) {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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
    return { status: 'excluded', days: null, hours: null, reason: 'Thời gian không tính hoặc không quy định.' };
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

  const sheets = workbook.SheetNames.map(sheetName => parseSheet(sheetName, workbook.Sheets[sheetName]));
  return {
    success: true,
    sheetNames: workbook.SheetNames,
    sheetCount: sheets.length,
    sheets
  };
}

