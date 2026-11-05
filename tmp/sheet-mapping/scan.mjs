import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const configPath = "D:/Zalo Received Files/Cấu hình quy trình iLis.xlsx";
const sourcePath = "D:/Zalo Received Files/ds_thutuc_vlg_30102026.xlsx";
const normalize = value => String(value ?? '').trim().replace(/\s+/g, '').replace(/_/g, '.').toUpperCase();

const configWb = await SpreadsheetFile.importXlsx(await FileBlob.load(configPath));
const configSheet = configWb.worksheets.getItem('DS Thủ tục');
const configValues = configSheet.getUsedRange(true).values;
const configCodes = [...new Set(configValues.slice(1).map(row => row[1]).filter(value => /^\d+\.\d+/.test(String(value ?? ''))).map(normalize))];

const sourceWb = await SpreadsheetFile.importXlsx(await FileBlob.load(sourcePath));
const sourceSheet = sourceWb.worksheets.getItem('Sheet1');
const sourceValues = sourceSheet.getUsedRange(true).values;
const headers = sourceValues[0].map(value => String(value ?? ''));
const counts = headers.map((header, col) => ({
  header,
  col,
  matches: sourceValues.slice(1).filter(row => configCodes.includes(normalize(row[col]))).length,
  examples: [...new Set(sourceValues.slice(1).map(row => normalize(row[col])).filter(value => configCodes.includes(value)))].slice(0, 5)
})).filter(item => item.matches > 0);

console.log(JSON.stringify({ configCodeCount: configCodes.length, configCodes, sourceRows: sourceValues.length - 1, matchingColumns: counts }, null, 2));
