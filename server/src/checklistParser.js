import fs from 'fs';
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

function parseIds(value) {
  return [...new Set(text(value)
    .split(';')
    .map(item => Number(String(item).trim()))
    .filter(Number.isInteger))];
}

function parseWorksheet(worksheet) {
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
  const catalog = [];
  const mappings = [];
  const catalogById = new Map();

  rows.slice(1).forEach(row => {
    const idCauHinh = Number(row[0]);
    const tenCauHinh = text(row[1]);
    const tenCauHinhNgan = text(row[2]);
    if (Number.isInteger(idCauHinh) && tenCauHinh) {
      const item = { idCauHinh, tenCauHinh, tenCauHinhNgan };
      if (!catalogById.has(idCauHinh)) {
        catalog.push(item);
        catalogById.set(idCauHinh, item);
      }
    }

    for (const [nameIndex, idsIndex] of [[4, 5], [6, 7]]) {
      const tenBuoc = text(row[nameIndex]);
      if (!tenBuoc) continue;
      mappings.push({
        tenBuoc,
        normalizedTenBuoc: normalizeText(tenBuoc),
        checklistIds: parseIds(row[idsIndex])
      });
    }
  });

  const uniqueMappings = new Map();
  mappings.forEach(item => {
    const current = uniqueMappings.get(item.normalizedTenBuoc);
    if (!current) {
      uniqueMappings.set(item.normalizedTenBuoc, item);
      return;
    }
    current.checklistIds = [...new Set([...current.checklistIds, ...item.checklistIds])];
  });

  return {
    catalog,
    mappings: [...uniqueMappings.values()]
  };
}

export function parseChecklistWorkbook(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('File Excel không có sheet.');
  return {
    fileName: sheetName,
    ...parseWorksheet(workbook.Sheets[sheetName])
  };
}

export function readChecklistWorkbook(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy file quy ước checklist: ${filePath}`);
  }
  return parseChecklistWorkbook(fs.readFileSync(filePath));
}

