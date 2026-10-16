// Shrinks the logbook template by removing Adobe Illustrator's private
// editing data (/PieceInfo) from every page. It is never drawn, but each page
// carries a copy of the whole artwork, which made the file ~55 MB.
//
//   node scripts/slim-template.mjs [in.pdf] [out.pdf]
import fs from "node:fs";
import { PDFDocument, PDFName } from "pdf-lib";

const input = process.argv[2] || "public/templates/OJT_Logbook.pdf";
const output = process.argv[3] || input;

const inputBytes = fs.readFileSync(input);
const src = await PDFDocument.load(inputBytes);
for (const page of src.getPages()) {
  for (const key of ["PieceInfo", "Metadata", "LastModified"]) page.node.delete(PDFName.of(key));
}
// Copying into a fresh document leaves the unreferenced data behind.
const out = await PDFDocument.create();
for (const page of await out.copyPages(src, src.getPageIndices())) out.addPage(page);
const bytes = await out.save();
fs.writeFileSync(output, bytes);
console.log(`${input}: ${(inputBytes.length / 1048576).toFixed(1)} MB -> ${output}: ${(bytes.length / 1048576).toFixed(1)} MB, ${out.getPageCount()} pages`);
