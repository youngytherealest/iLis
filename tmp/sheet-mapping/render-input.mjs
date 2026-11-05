import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load("D:/Zalo Received Files/ds_thutuc_vlg_30102026.xlsx"));
const preview = await workbook.render({ sheetName: "Sheet1", range: "A1:K12", scale: 1, format: "png" });
await fs.writeFile("D:/VNPT/iLis tool/tmp/sheet-mapping/source-preview.png", new Uint8Array(await preview.arrayBuffer()));
console.log("rendered source preview");
