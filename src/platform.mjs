// Cross-platform helpers. POSIX behavior unchanged; Windows gets PATH +
// well-known install locations, correct venv layout, and winget/choco hints.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";

export const isWin = process.platform === "win32";
function sh(bin, args, timeout = 10000) {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout, stdio: ["ignore", "pipe", "pipe"] }, (err, stdout) =>
      resolve({ ok: !err, out: String(stdout || "").trim() }));
  });
}
// Resolve a tool binary: PATH first (where/which), then well-known locations.
// Returns absolute path or bare name (PATH lookup at spawn) or null.
export async function whichBin(name, winPaths = []) {
  const probe = isWin ? "where" : "which";
  const r = await sh(probe, [name]);
  if (r.ok && r.out) return r.out.split(/\r?\n/)[0].trim();
  if (isWin) {
    for (const p of winPaths) {
      const cands = [p, p + ".exe"];
      for (const c of cands) if (fs.existsSync(c)) return c;
    }
    // poppler via common package roots
    for (const root of ["C:\\poppler", "C:\\Program Files\\poppler", path.join(os.homedir(), "poppler")]) {
      for (const sub of ["bin", "Library\\bin"]) {
        const c = path.join(root, sub, name + ".exe");
        if (fs.existsSync(c)) return c;
      }
    }
  }
  return null;
}
export const WIN_PROGRAMS = [
  "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
  "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
];
export function venvPython(venvDir) {
  return isWin ? path.join(venvDir, "Scripts", "python.exe") : path.join(venvDir, "bin", "python");
}
export function venvPip(venvDir) {
  return isWin ? path.join(venvDir, "Scripts", "pip.exe") : path.join(venvDir, "bin", "pip");
}
export function dashyVenvDir() {
  return path.join(os.homedir(), ".dashy-tools");
}
export function installHint(pkg) {
  const table = {
    poppler: isWin ? "winget install poppler  (or: choco install poppler)" : "brew install poppler  (or: apt install poppler-utils)",
    libreoffice: isWin ? "winget install TheDocumentFoundation.LibreOffice" : "brew install --cask libreoffice",
    node: "install Node.js 20+ from https://nodejs.org",
    python: isWin ? "winget install Python.Python.3.12" : "install python3.10+ with pip",
    opencode: "curl -fsSL https://opencode.ai/install | bash   (Windows: see https://opencode.ai/docs)",
  };
  return table[pkg] || ("install " + pkg);
}
// Resolved external tools with per-process cache. Falls back to the bare name
// (PATH lookup at spawn — identical to historic behavior on POSIX).
const _cache = {};
export async function sysTool(name, winPaths) {
  if (!_cache[name]) _cache[name] = (await whichBin(name, winPaths)) || name;
  return _cache[name];
}
export async function pythonLauncher() {
  const cands = isWin ? [["py", "-3"], ["python"], ["python3"]] : [["python3"], ["python"]];
  for (const [b, ...rest] of cands) {
    const found = await whichBin(b);
    if (!found) continue;
    const r = await sh(found, [...rest, "--version"]);
    if (r.ok) return [found, ...rest];
  }
  return null;
}
export function opencodeCandidates() {  const list = ["opencode"];
  if (isWin) {
    list.push(path.join(os.homedir(), "AppData", "Local", "opencode", "bin", "opencode.exe"));
    list.push(path.join(os.homedir(), ".opencode", "bin", "opencode.exe"));
  } else {
    list.push(path.join(os.homedir(), ".opencode", "bin", "opencode"));
  }
  return list;
}
