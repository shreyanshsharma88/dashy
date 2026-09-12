// S2 extract: pdftotext -layout dumps + pdfimages + selective pdftoppm renders.
// Writes only under <root>/.dashy/.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
import { whichBin, venvPython, venvPip, dashyVenvDir, WIN_PROGRAMS, pythonLauncher, installHint } from "./platform.mjs";
// Resolved external tools (bare names = PATH lookup, identical to old behavior on POSIX).
const TOOLS = {};
async function tool(name, winPaths) {
  if (!TOOLS[name]) TOOLS[name] = (await whichBin(name, winPaths)) || name;
  return TOOLS[name];
}
async function resolveTools() {
  await Promise.all([
    tool("pdftotext"), tool("pdfimages"), tool("pdftoppm"), tool("pdfinfo"),
    tool("soffice", WIN_PROGRAMS),
  ]);
}
function dashyPython() {
  if (process.env.DASHY_PY && fs.existsSync(process.env.DASHY_PY)) return process.env.DASHY_PY;
  const v = venvPython(dashyVenvDir());
  if (fs.existsSync(v)) return v;
  return "python3";
}
let _pptxPy = null; // cached resolved python with pptx (or "" if unavailable)
// Honest bootstrap: create ~/.dashy-tools venv + pip install on first real need.
const PY_IMPORTS = { "python-pptx": "pptx", pillow: "PIL", "python-docx": "docx" };
async function ensurePy(pkgs, onEvent = () => {}) {
  const mods = pkgs.map((p) => PY_IMPORTS[p] || p);
  const cands = [process.env.DASHY_PY, venvPython(dashyVenvDir()), "python3", "python"].filter(Boolean);
  for (const b of cands) {
    if (!b || !fs.existsSync(b)) continue;
    const r = await run(b, ["-c", mods.map((m) => "import " + m).join("; ")]);
    if (r.ok) return b;
  }
  onEvent("py-bootstrap", "creating venv + installing " + pkgs.join(" ") + " (one-time)");
  const launcher = await pythonLauncher();
  if (!launcher) return null;
  const venv = dashyVenvDir();
  let r = await run(launcher[0], [...launcher.slice(1), "-m", "venv", venv], 120000);
  if (!r.ok) return null;
  r = await run(venvPip(venv), ["install", "--quiet", ...pkgs], 300000);
  const py = venvPython(venv);
  const vok = pkgs.map((p) => PY_IMPORTS[p] || p);
  const ok = r.ok && fs.existsSync(py) && (await run(py, ["-c", vok.map((m) => "import " + m).join("; ")])).ok;
  onEvent("py-bootstrap", ok ? "ready: " + py : "failed — set DASHY_PY to a python with " + pkgs.join(" "));
  return ok ? py : null;
}
async function ensurePptx(onEvent = () => {}) {
  if (_pptxPy !== null) return _pptxPy || null;
  _pptxPy = (await ensurePy(["python-pptx", "pillow"], onEvent)) || "";
  return _pptxPy || null;
}

function run(bin, args, timeout = 120000, errHint = "") {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout, maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] },
      (err, stdout, stderr) => resolve({ ok: !err, out: String(stdout || ""),
        err: (String(stderr || "").slice(0, 300) || errHint) }));
  });
}
// Convert slide decks to PDF under <root>/pdf/ (idempotent: skips existing).
// Returns { "<file>": "pdf/<stem>.pdf" | null }. Self-healing: any stage can
// call this to restore converted PDFs (e.g. user deleted pdf/).
export async function convertSlides(root, slides, onEvent = () => {}) {
  const pdfDir = path.join(root, "pdf");
  fs.mkdirSync(pdfDir, { recursive: true });
  const map = {};
  for (const p of slides) {
    const stem = String(p.file).replace(/\.(pdf|pptx?)$/i, "");
    const converted = path.join(pdfDir, stem + ".pdf");
    if (fs.existsSync(converted)) { map[p.file] = path.join("pdf", stem + ".pdf"); onEvent("converted-cached", p.file); continue; }
    const conv = await run(await tool("soffice", WIN_PROGRAMS), ["--headless", "--convert-to", "pdf", "--outdir", pdfDir, path.join(root, p.file)]);
    if (conv.ok && fs.existsSync(converted)) { map[p.file] = path.join("pdf", stem + ".pdf"); onEvent("converted", p.file); }
    else { map[p.file] = null; onEvent("convert-failed", p.file, conv.err); }
  }
  return map;
}
export async function extract(root, manifest, onEvent = () => {}) {
  const out = path.join(root, ".dashy", "txt");
  const img = path.join(root, ".dashy", "img");
  fs.mkdirSync(out, { recursive: true });
  fs.mkdirSync(img, { recursive: true });
  fs.mkdirSync(out, { recursive: true });
  fs.mkdirSync(img, { recursive: true });
  const report = { texts: [], images: 0 };
  const stemOf = (f) => f.replace(/\.(pdf|pptx?)$/i, "");
  for (const p of manifest.pdfs) {
    if (p.skipped) { report.texts.push({ file: p.file, lines: 0, ok: false, skipped: p.skipped }); continue; }
    const stem = stemOf(p.file);
    if (p.kind === "slides") {
      const stem = stemOf(p.file);
      const convMap = await convertSlides(root, [p], onEvent);
      const rel = convMap[p.file];
      if (!rel) {
        report.texts.push({ file: p.file, lines: 0, ok: false, fallback: "python-pptx",
          error: "soffice convert failed (install LibreOffice)" });
        onEvent("text", p.file, 0);
        if (!/\.pptx$/i.test(p.file)) continue; // legacy .ppt has no python fallback
        // fall through to the python-pptx path below
      } else {
      const converted = path.join(root, rel);
      onEvent("converted", p.file, rel);
      const txt = path.join(out, stem + ".txt");
      const r = await run(await tool("pdftotext"), ["-layout", converted, txt]);
      let notes = "";
      const npy = await ensurePptx(onEvent);
      if (npy) {
        const nr = await run(npy, [path.join(HERE, "..", "tools", "pptx_extract.py"),
          path.join(root, p.file), "--notes-only"]);
        if (nr.ok && nr.out.trim() && !nr.out.includes("(no speaker notes)")) notes = nr.out.trim();
      } else onEvent("notes", p.file, "skipped (no python-pptx)");
      let lines = 0;
      try {
        let t = fs.readFileSync(txt, "utf8").replace(/\0/g, "");
        fs.writeFileSync(txt, t);
        if (notes) { t += "\n\n--- SPEAKER NOTES ---\n" + notes + "\n"; fs.writeFileSync(txt, t); }
        lines = t.split("\n").length;
      } catch {}
      const info = { file: p.file, converted: "pdf/" + stem + ".pdf", lines, slides: null, ok: r.ok && lines > 5 };
      try {
        const pg = await run(await tool("pdfinfo"), [converted]);
        const m = pg.out.match(/Pages:\s+(\d+)/);
        if (m) info.slides = info.pages = Number(m[1]);
      } catch {}
      report.texts.push(info);
      onEvent("text", p.file, lines);
      await run(await tool("pdfimages"), ["-png", converted, path.join(img, stem + "-img")]);
      try { report.images += fs.readdirSync(img).filter((f) => f.startsWith(stem + "-img")).length; } catch {}
      onEvent("images", p.file, report.images);
      continue;
      }
    }
    if (/\.pptx$/i.test(p.file)) {
      // PPTX fallback when LibreOffice is absent: slide text + notes + images (no page renders)
      const fpy = await ensurePptx(onEvent);
      if (!fpy) {
        report.texts.push({ file: p.file, lines: 0, ok: false,
          error: "no soffice and no python-pptx — " + installHint("libreoffice") + ", or set DASHY_PY" });
        onEvent("text", p.file, 0);
        continue;
      }
      const r = await run(fpy, [path.join(HERE, "..", "tools", "pptx_extract.py"),
        path.join(root, p.file), path.join(out, stem)]);
      let info = {};
      try { info = JSON.parse(r.out); } catch {}
      const ok = r.ok && info.slides > 0;
      report.texts.push({ file: p.file, lines: info.lines || 0, slides: info.slides || 0, ok,
        ...(ok ? {} : { error: (info.error || r.err || "pptx extract failed").slice(0, 200) }) });
      onEvent("text", p.file, info.lines || 0);
      try { report.images += fs.readdirSync(img).filter((f) => f.startsWith(stem + "-img")).length; } catch {}
      onEvent("images", p.file, report.images);
      continue;
    }
    const txt = path.join(out, stem + ".txt");
    const r = await run(await tool("pdftotext"), ["-layout", path.join(root, p.file), txt]);
    let lines = 0;
    try {
      const cleaned = fs.readFileSync(txt, "utf8").replace(/\0/g, "");
      fs.writeFileSync(txt, cleaned);
      lines = cleaned.split("\n").length;
    } catch {}
    report.texts.push({ file: p.file, lines, ok: r.ok });
    onEvent("text", p.file, lines);
    const im = await run(await tool("pdfimages"), ["-png", path.join(root, p.file), path.join(img, stem + "-img")]);
    if (im.ok) { try { report.images += fs.readdirSync(img).filter((f) => f.startsWith(stem + "-img")).length; } catch {} }
    onEvent("images", p.file, report.images);
  }
  // Handout/docs loop (.docx via python-docx, .doc via soffice, .txt/.md copied).
  // Output: .dashy/txt/doc-<stem>.txt — feeds S4/S5/RAG when no lecture PDFs exist.
  const docs = manifest.docs || [];
  const dpy = docs.length ? await ensurePy(["python-docx"], onEvent) : null;
  for (const d of docs) {
    const stem = d.file.replace(/\.(docx?|txt|md)$/i, "");
    const txt = path.join(out, "doc-" + stem + ".txt");
    let ok = false, lines = 0;
    try {
      if (/\.docx$/i.test(d.file) && dpy) {
        const r = await run(dpy, [path.join(HERE, "..", "tools", "docx_extract.py"), path.join(root, d.file), txt]);
        ok = r.ok && fs.existsSync(txt);
      } else if (/\.doc$/i.test(d.file)) {
        const r = await run(await tool("soffice", WIN_PROGRAMS), ["--headless", "--convert-to", "txt:Text", "--outdir", out, path.join(root, d.file)]);
        ok = r.ok;
        try { fs.renameSync(path.join(out, stem + ".txt"), txt); } catch {}
      } else {
        fs.copyFileSync(path.join(root, d.file), txt);
        ok = true;
      }
      if (ok) lines = fs.readFileSync(txt, "utf8").split("\n").length;
    } catch (e) { ok = false; }
    report.texts.push({ file: d.file, doc: "doc-" + stem + ".txt", lines, ok,
      ...(ok ? {} : { error: "unreadable — install python-docx/LibreOffice or use .txt/.md" }) });
    onEvent("doc", d.file, lines);
  }
  return report;
}
// Render exact PDF pages to PNG (gap-fill screenshots, citing pages).
export async function renderPages(root, pdfFile, pages, prefix, dpi = 90) {
  const img = path.join(root, ".dashy", "img");
  fs.mkdirSync(img, { recursive: true });
  const groups = [];
  const sorted = [...pages].sort((a, b) => a - b);
  let s = sorted[0], prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    if (sorted[i] === prev + 1) { prev = sorted[i]; continue; }
    groups.push([s, prev]); s = sorted[i]; prev = sorted[i];
  }
  const made = [];
  for (const [f, l] of groups) {
    const r = await run(await tool("pdftoppm"), ["-png", "-r", String(dpi), "-f", String(f), "-l", String(l),
      path.join(root, pdfFile), path.join(img, prefix)]);
    if (r.ok) {
      try {
        fs.readdirSync(img).filter((x) => x.startsWith(prefix + "-") && x.endsWith(".png"))
          .forEach((x) => made.push(x));
      } catch {}
    }
  }
  return [...new Set(made)];
}
