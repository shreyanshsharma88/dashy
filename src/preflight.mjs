// S0 preflight: node, poppler, opencode binary + auth + model, disk. Never throws — returns report.
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { whichBin, opencodeCandidates, installHint, WIN_PROGRAMS } from "./platform.mjs";

function sh(bin, args, timeout = 15000) {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout, stdio: ["ignore", "pipe", "pipe"] }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: String(stdout || "").slice(0, 2000), err: String(stderr || "").slice(0, 500) });
    });
  });
}
async function opencodeBin() {
  for (const c of opencodeCandidates()) {
    const r = await sh(c, ["--version"]);
    if (r.ok) return c;
  }
  return null;
}
export async function preflight(wantModel) {
  const report = { ok: true, checks: [] };
  const put = (name, ok, detail = "") => { report.checks.push({ name, ok, detail }); if (!ok) report.ok = false; };
  put("node >= 20", Number(process.versions.node.split(".")[0]) >= 20, process.versions.node);
  for (const t of ["pdftotext", "pdfimages", "pdftoppm", "pdfinfo"]) {
    const found = await whichBin(t);
    put("poppler:" + t, !!found, found || ("install: " + installHint("poppler")));
  }
  {
    const found = await whichBin("soffice", WIN_PROGRAMS);
    put("libreoffice (pptx→pdf into pdf/)", true,
      found ? "soffice found" : "advisory: only needed for slide decks — " + installHint("libreoffice") + " (python-pptx fallback otherwise)");
  }
  const bin = await opencodeBin();
  put("opencode binary", !!bin, bin || ("install: " + installHint("opencode")));
  let model = wantModel || "opencode/muse-spark-1.3-contributor-free", modelOk = false, modelsOut = "";
  if (bin) {
    const r = await sh(bin, ["models"]);
    modelsOut = r.out;
    modelOk = r.ok && r.out.includes(model);
    if (!modelOk && r.ok) {
      const m = r.out.split("\n").map((s) => s.trim()).filter((s) => s.includes("/") && s.includes("free"))[0];
      if (m) { model = m; modelOk = true; }
    }
  }
  put("model " + model, modelOk, modelOk ? "" : "run `opencode auth login`, then re-check. Raw list:\n" + modelsOut.slice(0, 400));
  report.model = model; report.bin = bin;
  // advisory only: needed iff the folder contains .pptx
  const pyBins = [process.env.DASHY_PY, os.homedir() + "/.dashy-tools/bin/python"].filter(Boolean);
  let pptx = "";
  for (const b of pyBins) {
    if (!fs.existsSync(b)) continue;
    const r = await sh(b, ["-c", "import pptx"]);
    if (r.ok) { pptx = b; break; }
  }
  if (!pptx) {
    for (const b of ["python3", "python"]) {
      const r = await sh(b, ["-c", "import pptx"]);
      if (r.ok) { pptx = b; break; }
    }
  }
  report.checks.push({ name: "pptx support (python-pptx)", ok: true,
    detail: pptx ? "via " + pptx : "advisory: .pptx needs it — dashy bootstraps ~/.dashy-tools venv on first use (or set DASHY_PY). LibreOffice (soffice) optional for best fidelity." });
  return report;
}
