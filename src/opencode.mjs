// Headless opencode runner: stateless calls (context assembled by caller —
// short history + retrieved chunks), so no session-expiry failure mode.
// Hardened for machine-global reliability:
//  - cross-process lock (one opencode run at a time; stray servers jam siblings)
//  - detached process group + SIGKILL of the whole group on timeout (no orphans)
//  - real diagnostics (elapsed + stderr tail) instead of truncated guesses
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const LOCKDIR = path.join(os.tmpdir(), "dashy-opencode.lock");
function lockHeld() {
  try {
    const pid = Number(fs.readFileSync(path.join(LOCKDIR, "pid"), "utf8"));
    if (pid > 0) { try { process.kill(pid, 0); return true; } catch { /* stale */ } }
  } catch {}
  return false;
}
async function takeLock(selfPid) {
  for (let i = 0; i < 600; i++) { // wait up to ~10 min for a sibling run
    try { fs.mkdirSync(LOCKDIR); break; }
    catch {
      if (!lockHeld()) { try { fs.rmSync(LOCKDIR, { recursive: true, force: true }); } catch {} continue; }
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }
  }
  try { fs.writeFileSync(path.join(LOCKDIR, "pid"), String(selfPid)); } catch {}
}
function dropLock() { try { fs.rmSync(LOCKDIR, { recursive: true, force: true }); } catch {} }

export function runOpencode(bin, { model, dir, prompt, timeoutMs = 180000, format = "default" }) {
  return new Promise((resolve) => {
    // execFile rejects args with null bytes (common in pdftotext output) — strip them centrally
    const clean = String(prompt || "").replace(/\0/g, "");
    const args = ["run", "-m", model, "--dir", dir, "--format", format, clean];
    const t0 = Date.now();
    takeLock(process.pid).then(() => {
      let child;
      try {
        child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" });
      } catch (e) { dropLock(); return resolve({ ok: false, error: "spawn failed: " + String(e.message || e).slice(0, 300) }); }
      let out = "", err = "", done = false;
      const finish = (ok, error) => {
        if (done) return; done = true;
        clearTimeout(timer);
        dropLock();
        resolve(ok ? { ok: true, out } : { ok: false, error, code: "SPAWN" });
      };
      const timer = setTimeout(() => {
        try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch {} }
        finish(false, `timed out after ${Date.now() - t0}ms; stderr tail: ${(err.slice(-600) || "(empty)")}`);
      }, timeoutMs);
      child.stdout.on("data", (c) => { out += c; if (out.length > 4 * 1024 * 1024) { try { child.kill("SIGKILL"); } catch {} } });
      child.stderr.on("data", (c) => { err += c; });
      child.on("error", (e) => finish(false, "spawn error: " + String(e.message || e).slice(0, 300)));
      child.on("close", (code) => {
        if (code === 0) finish(true);
        else finish(false, `exit ${code} after ${Date.now() - t0}ms; stderr tail: ${(err.slice(-600) || "(empty)")}`);
      });
    });
  });
}
// Persisted ledger of prompts (debugging + resume); never stores secrets.
export function ledgerAppend(root, entry) {
  return import("node:fs").then((fs) => import("node:path").then((path) => {
    const f = path.join(root, ".dashy", "opencode-ledger.jsonl");
    fs.mkdirSync(path.join(root, ".dashy"), { recursive: true });
    fs.appendFileSync(f, JSON.stringify({ at: Date.now(), ...entry }).slice(0, 4000) + "\n");
  }));
}
