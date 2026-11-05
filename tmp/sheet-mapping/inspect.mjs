import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const configPath = "D:/Zalo Received Files/Cấu hình quy trình iLis.xlsx";
const sourcePath = "D:/Zalo Received Files/ds_thutuc_vlg_30102026.xlsx";

for (const [label, filePath] of [["source", sourcePath]]) {
  console.log(`loading ${filePath}`);
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(filePath));
  const sheets = await workbook.inspect({ kind: "sheet", include: "id,name", maxChars: 12000 });
  console.log(`=== ${label} SHEETS ===`);
  console.log(sheets.ndjson);
  for (const sheetName of workbook.worksheets.items.map(sheet => sheet.name)) {
    const sheet = workbook.worksheets.getItem(sheetName);
    const used = sheet.getUsedRange(true);
    console.log(`=== ${label}:${sheetName} ===`);
    console.log(JSON.stringify({ rows: used.rowCount, cols: used.columnCount, values: used.values.slice(0, 8) }, null, 2));
  }
}
