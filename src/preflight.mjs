// S0 preflight: node, poppler, opencode binary + auth + model, disk. Never throws — returns report.
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function sh(bin, args, timeout = 15000) {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout, stdio: ["ignore", "pipe", "pipe"] }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: String(stdout || "").slice(0, 2000), err: String(stderr || "").slice(0, 500) });
    });
  });
}
async function opencodeBin() {
  const direct = await sh("opencode", ["--version"]);
  if (direct.ok) return "opencode";
  const home = path.join(os.homedir(), ".opencode", "bin", "opencode");
  if (fs.existsSync(home)) { const r = await sh(home, ["--version"]); if (r.ok) return home; }
  return null;
}
export async function preflight(wantModel) {
  const report = { ok: true, checks: [] };
  const put = (name, ok, detail = "") => { report.checks.push({ name, ok, detail }); if (!ok) report.ok = false; };
  put("node >= 20", Number(process.versions.node.split(".")[0]) >= 20, process.versions.node);
  for (const t of ["pdftotext", "pdfimages", "pdftoppm", "pdfinfo"]) {
    const r = await sh("which", [t]);
    put("poppler:" + t, r.ok, r.ok ? "" : "install: brew install poppler / apt install poppler-utils");
  }
  {
    const r = await sh("which", ["soffice"]);
    put("libreoffice (pptx→pdf into pdf/)", true,
      r.ok ? "soffice found" : "advisory: only needed for slide decks — install via brew install --cask libreoffice (python-pptx fallback otherwise)");
  }
  const bin = await opencodeBin();
  put("opencode binary", !!bin, bin || "install: curl -fsSL https://opencode.ai/install | bash");
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
  const pyBins = [process.env.DASHY_PY, os.homedir() + "/.dashy-tools/bin/python", "python3"].filter(Boolean);
  let pptx = "";
  for (const b of pyBins) {
    const r = await sh(b, ["-c", "import pptx"]);
    if (r.ok) { pptx = b; break; }
  }
  report.checks.push({ name: "pptx support (python-pptx)", ok: true,
    detail: pptx ? "via " + pptx : "advisory: .pptx needs it — dashy bootstraps ~/.dashy-tools venv on first use (or set DASHY_PY). LibreOffice (soffice) optional for best fidelity." });
  return report;
}
