// Headless opencode runner: stateless calls (context assembled by caller —
// short history + retrieved chunks), so no session-expiry failure mode.
import { execFile } from "node:child_process";

export function runOpencode(bin, { model, dir, prompt, timeoutMs = 180000, format = "default" }) {
  return new Promise((resolve) => {
    const args = ["run", "-m", model, "--dir", dir, "--format", format, prompt];
    execFile(bin, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] },
      (err, stdout, stderr) => {
        if (err) return resolve({ ok: false, error: (String(stderr || err.message)).slice(0, 800), code: err.code });
        resolve({ ok: true, out: String(stdout || "") });
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
