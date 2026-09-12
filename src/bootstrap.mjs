// dashy bootstrap: auto-install opencode (+ auth + model check) and Wispr guidance.
// Usage: programmatic bootstrap(opts, log) or CLI `dashy bootstrap [--yes]`.
import { spawn, execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { isWin, opencodeCandidates } from "./platform.mjs";

function sh(bin, args, timeout = 20000) {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout, stdio: ["ignore", "pipe", "pipe"] }, (err, stdout) =>
      resolve({ ok: !err, out: String(stdout || "") }));
  });
}
async function opencodeBin() {
  for (const c of opencodeCandidates()) {
    const r = await sh(c, ["--version"]);
    if (r.ok) return c;
  }
  return null;
}
function wisprStatus() {
  // returns {state: "found"|"missing"|"unknown", detail}
  try {
    if (process.platform === "darwin") {
      for (const p of ["/Applications/Wispr Flow.app", path.join(os.homedir(), "Applications", "Wispr Flow.app")]) {
        if (fs.existsSync(p)) return { state: "found", detail: p };
      }
      return { state: "missing", detail: "" };
    }
    if (process.platform === "win32") {
      const roots = [process.env.LOCALAPPDATA, process.env.PROGRAMFILES, "C:\\Program Files"].filter(Boolean);
      for (const r of roots) {
        for (const n of ["Wispr Flow", "Wispr"]) {
          const p = path.join(r, n);
          if (fs.existsSync(p)) return { state: "found", detail: p };
        }
      }
      return { state: "missing", detail: "" };
    }
    return { state: "unknown", detail: "Wispr Flow is macOS/Windows only" };
  } catch { return { state: "unknown", detail: "" }; }
}
export async function bootstrap(opts = {}, log = () => {}) {
  const yes = !!opts.yes;
  const report = { opencode: null, auth: null, model: null, wispr: null };
  // 1. opencode binary
  let bin = await opencodeBin();
  if (!bin) {
    if (isWin) {
      report.opencode = { ok: false,
        fix: "Install opencode for Windows from https://opencode.ai/docs, then re-run `dashy bootstrap`." };
    } else if (!yes && !opts.auto) {
      report.opencode = { ok: false, fix: "Re-run with --yes to auto-install, or: curl -fsSL https://opencode.ai/install | bash" };
    } else {
      log("Installing opencode (official script)…");
      await new Promise((resolve) => {
        const p = spawn("sh", ["-c", "curl -fsSL https://opencode.ai/install | bash"], { stdio: "inherit" });
        p.on("close", () => resolve());
        p.on("error", () => resolve());
      });
      bin = await opencodeBin();
      report.opencode = bin ? { ok: true, detail: bin } : { ok: false, fix: "Install failed — see https://opencode.ai/docs" };
    }
  } else report.opencode = { ok: true, detail: bin };
  // 2. auth (interactive; only with a TTY unless --yes forces attempt)
  if (bin) {
    const models = await sh(bin, ["models"]);
    const authed = models.ok && models.out.trim().length > 0;
    if (!authed && (yes || (process.stdin.isTTY && opts.login !== false))) {
      log("Launching `opencode auth login` (complete it in the terminal)…");
      await new Promise((resolve) => {
        const p = spawn(bin, ["auth", "login"], { stdio: "inherit" });
        p.on("close", () => resolve());
        p.on("error", () => resolve());
      });
    }
    const re = await sh(bin, ["models"]);
    report.auth = re.ok && re.out.trim() ? { ok: true } : { ok: false, fix: "Run `opencode auth login`, then `dashy bootstrap` again." };
    // 3. model
    const want = opts.model || "opencode/muse-spark-1.3-contributor-free";
    report.model = re.ok && re.out.includes(want)
      ? { ok: true, detail: want }
      : { ok: false, fix: `Model ${want} not listed. Pick one from \`opencode models\` and pass --model.` };
  }
  // 4. wispr (STT dictation; read-aloud works regardless — advisory, never blocking)
  const w = wisprStatus();
  report.wispr = { ok: true, installed: w.state === "found",
    detail: w.state === "found" ? ("Wispr Flow detected: " + w.detail + " — dictate into any dashy text field.")
      : "Wispr Flow gives mic→text dictation inside dashy fields (search, quizzes, notes). " +
        (w.state === "missing" ? "Not detected — install from https://wisprflow.ai to enable it. Voice read-aloud works without it."
          : w.detail) };
  return report;
}
