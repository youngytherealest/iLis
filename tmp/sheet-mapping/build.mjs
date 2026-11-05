import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const configPath = "D:/Zalo Received Files/Cấu hình quy trình iLis.xlsx";
const sourcePath = "D:/Zalo Received Files/ds_thutuc_vlg_30102026.xlsx";
const outputDir = "D:/VNPT/iLis tool/outputs/thutuc_mapping_20261103";
const outputPath = `${outputDir}/mapping_thu_tuc_vlg_30102026.xlsx`;

const normalize = (value) => String(value ?? "")
  .trim()
  .replace(/\s+/g, "")
  .replace(/_/g, ".")
  .toUpperCase();

const normalizeHeader = (value) => String(value ?? "")
  .trim()
  .replace(/\s+/g, "")
  .toUpperCase();

function columnLetter(index) {
  let n = index + 1;
  let result = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

function uniqueHeaders(headers) {
  const seen = new Map();
  return headers.map((header) => {
    const base = header || "Column";
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base}_${count}`;
  });
}

function styleHeader(range) {
  range.format = {
    fill: "#1F4E78",
    font: { name: "Arial", size: 10, bold: true, color: "#FFFFFF" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
  };
  range.format.rowHeight = 32;
}

const configWb = await SpreadsheetFile.importXlsx(await FileBlob.load(configPath));
const configSheet = configWb.worksheets.getItem("DS Thủ tục");
const configValues = configSheet.getUsedRange(true).values;

const configRows = [];
const configMap = new Map();
for (const row of configValues.slice(1)) {
  const rawCode = String(row[1] ?? "").trim();
  if (!/^\d+\.\d+/.test(rawCode)) continue;
  const code = normalize(rawCode);
  if (configMap.has(code)) continue;
  const item = {
    code,
    displayCode: rawCode,
    name: String(row[2] ?? "").trim(),
  };
  configMap.set(code, item);
  configRows.push(item);
}

const sourceWb = await SpreadsheetFile.importXlsx(await FileBlob.load(sourcePath));
const sourceSheet = sourceWb.worksheets.getItem("Sheet1");
const sourceValues = sourceSheet.getUsedRange(true).values;
const sourceHeaders = sourceValues[0].map((value) => String(value ?? ""));
const sourceHeadersUnique = uniqueHeaders(sourceHeaders);
const tenTatIndex = sourceHeaders.findIndex((header) => normalizeHeader(header) === "TEN_TAT");
if (tenTatIndex < 0) throw new Error("Không tìm thấy cột TEN_TAT trong Sheet1.");

const counts = new Map(configRows.map((item) => [item.code, 0]));
const matchedRows = [];
for (const row of sourceValues.slice(1)) {
  const code = normalize(row[tenTatIndex]);
  const config = configMap.get(code);
  if (!config) continue;
  counts.set(code, (counts.get(code) ?? 0) + 1);
  matchedRows.push([
    ...row,
    config.displayCode,
    config.name,
    "Khớp",
  ]);
}

await fs.mkdir(outputDir, { recursive: true });
const workbook = await Workbook.create();
const mappingSheet = workbook.worksheets.add("Mapping lọc");
const auditSheet = workbook.worksheets.add("Mã cấu hình");

mappingSheet.showGridLines = false;
auditSheet.showGridLines = false;

const mappingHeaders = [
  ...sourceHeadersUnique,
  "MA_THU_TUC_CAU_HINH",
  "TEN_THU_TUC_CAU_HINH",
  "TRANG_THAI_MAPPING",
];
const mappingMatrix = [mappingHeaders, ...matchedRows];
const mappingLastCol = columnLetter(mappingHeaders.length - 1);
const mappingLastRow = mappingMatrix.length;
const mappingRange = mappingSheet.getRangeByIndexes(0, 0, mappingMatrix.length, mappingHeaders.length);
mappingRange.values = mappingMatrix;
styleHeader(mappingSheet.getRange(`A1:${mappingLastCol}1`));
mappingSheet.freezePanes.freezeRows(1);

const auditHeaders = [
  "STT",
  "Mã thủ tục hành chính",
  "Tên thủ tục hành chính",
  "Số dòng nguồn",
  "Trạng thái lọc",
];
const auditRows = configRows.map((item, index) => {
  const count = counts.get(item.code) ?? 0;
  return [index + 1, item.displayCode, item.name, count, count > 0 ? "Khớp" : "Không có dữ liệu"];
});
const auditMatrix = [auditHeaders, ...auditRows];
const auditLastRow = auditMatrix.length;
const auditRange = auditSheet.getRangeByIndexes(0, 0, auditMatrix.length, auditHeaders.length);
auditRange.values = auditMatrix;
styleHeader(auditSheet.getRange("A1:E1"));
auditSheet.getRange(`C2:C${auditLastRow}`).format.wrapText = true;
auditSheet.freezePanes.freezeRows(1);

mappingSheet.getRange("A1").format.columnWidth = 18;
mappingSheet.getRange("B1").format.columnWidth = 24;
mappingSheet.getRange("E1").format.columnWidth = 16;
mappingSheet.getRange("F1").format.columnWidth = 16;
mappingSheet.getRange("Q1").format.columnWidth = 30;
mappingSheet.getRange("AI1").format.columnWidth = 22;
mappingSheet.getRange("AJ1").format.columnWidth = 42;
mappingSheet.getRange("AK1").format.columnWidth = 18;
auditSheet.getRange("A1").format.columnWidth = 8;
auditSheet.getRange("B1").format.columnWidth = 24;
auditSheet.getRange("C1").format.columnWidth = 80;
auditSheet.getRange("D1").format.columnWidth = 15;
auditSheet.getRange("E1").format.columnWidth = 18;

workbook.recalculate();

const auditCheck = await workbook.inspect({
  kind: "table",
  sheetId: "Mã cấu hình",
  range: "A1:E12",
  include: "values,formulas",
  tableMaxRows: 12,
  tableMaxCols: 5,
  maxChars: 6000,
});
console.log(JSON.stringify({
  configCodeCount: configRows.length,
  sourceRowCount: sourceValues.length - 1,
  matchedRowCount: matchedRows.length,
  unmatchedConfigCodes: configRows.filter((item) => (counts.get(item.code) ?? 0) === 0).map((item) => item.displayCode),
  auditCheck,
}, null, 2));

const preview = await workbook.render({ sheetName: "Mã cấu hình", range: "A1:E20", scale: 1, format: "png" });
await fs.writeFile("D:/VNPT/iLis tool/tmp/sheet-mapping/output-preview.png", new Uint8Array(await preview.arrayBuffer()));

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);
console.log(JSON.stringify({ outputPath }));
