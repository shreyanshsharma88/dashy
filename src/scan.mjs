// S1 scan: inventory PDFs (+page counts), handout + question-paper candidates. Read-only.
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";

function pdfPages(f) {
  return new Promise((resolve) => {
    execFile("pdfinfo", [f], { timeout: 15000, stdio: ["ignore", "pipe", "pipe"] }, (err, out) => {
      const m = String(out || "").match(/Pages:\s+(\d+)/);
      resolve(m ? Number(m[1]) : null);
    });
  });
}
const HANDOUT_RX = /handout|syllabus|outline|course/i;
const QP_RX = /question|exam|paper|mid|final|test|QP/i;
export async function scan(root) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const pdfs = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!/\.(pdf|pptx?)$/i.test(e.name)) continue;
    const full = path.join(root, e.name);
    const slides = /\.(pptx?)$/i.test(e.name) && !/\.pdf$/i.test(e.name);
    pdfs.push({ file: e.name, kind: slides ? "slides" : "pdf",
      bytes: fs.statSync(full).size, pages: slides ? null : await pdfPages(full) });
  }
  pdfs.sort((a, b) => a.file.localeCompare(b.file));
  const others = entries.filter((e) => e.isFile() && /\.(doc|docx|txt|md)$/i.test(e.name)).map((e) => e.name);
  return {
    root, at: Date.now(),
    pdfs,
    handoutCandidates: others.filter((f) => HANDOUT_RX.test(f)),
    paperCandidates: [...pdfs.map((p) => p.file).filter((f) => QP_RX.test(f)), ...others.filter((f) => QP_RX.test(f))],
    otherDocs: others,
  };
}
