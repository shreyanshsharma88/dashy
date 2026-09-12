// S9 checks: deterministic, no LLM. Returns {pass, checks[]}.
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";

function sh(bin, args, timeout = 20000) {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout, stdio: ["ignore", "pipe", "pipe"] }, (err, out) =>
      resolve({ ok: !err, out: String(out || "") }));
  });
}
export async function verify(root, manifest) {
  const checks = [];
  const put = (name, ok, detail = "") => checks.push({ name, ok, detail });
  const dist = path.join(root, "dist");
  for (const f of ["index.html", "styles.css", "app.js", "app-data.js", "media.js"]) {
    put("dist/" + f + " exists", fs.existsSync(path.join(dist, f)));
  }
  if (fs.existsSync(path.join(dist, "app.js"))) {
    const r = await sh("node", ["--check", path.join(dist, "app.js")]);
    put("app.js syntax", r.ok, r.ok ? "" : "node --check failed");
  }
  try {
    const data = fs.readFileSync(path.join(dist, "app-data.js"), "utf8").split("=", 1)[1] || "";
    put("app-data.js non-empty", data.trim().length > 1000);
  } catch { put("app-data.js non-empty", false); }
  // media assets referenced exist
  try {
    const media = fs.readFileSync(path.join(dist, "media.js"), "utf8");
    const files = [...new Set([...media.matchAll(/f:"([^"]+)"/g)].map((m) => m[1]))];
    const missing = files.filter((f) => !fs.existsSync(path.join(dist, "assets", "diagrams", f)));
    put("diagram assets resolve (" + files.length + ")", missing.length === 0, missing.slice(0, 5).join(", "));
    const ids = [...media.matchAll(/\{id:"([^"]+)"/g)].map((m) => m[1]);
    put("video IDs well-formed (" + ids.length + ")", ids.every((i) => /^[A-Za-z0-9_-]{11}$/.test(i)));
  } catch (e) { put("media.js audit", false, String(e).slice(0, 120)); }
  // no invented-link patterns: every http URL must be youtube/watch, youtu-nocookie, gstatic fonts, or localhost text
  try {
    const all = fs.readFileSync(path.join(dist, "app.js"), "utf8") + fs.readFileSync(path.join(dist, "media.js"), "utf8");
    const urls = [...all.matchAll(/https?:\/\/[^\s"'<>]+/g)].map((m) => m[0]);
    const bad = urls.filter((u) => !/youtube\.com|youtu\.be|youtube-nocookie|gstatic\.com|localhost|127\.0\.0\.1|w3\.org|schema\.org/.test(u));
    put("no stray external URLs (" + urls.length + " checked)", bad.length === 0, bad.slice(0, 3).join(", "));
  } catch (e) { put("URL audit", false, String(e).slice(0, 120)); }
  // quiz minimums from content JSONs
  try {
    const cj = fs.readdirSync(path.join(root, ".dashy", "content")).filter((f) => /^L\d+\.json$/.test(f));
    let qmin = Infinity;
    cj.forEach((f) => {
      const j = JSON.parse(fs.readFileSync(path.join(root, ".dashy", "content", f), "utf8"));
      qmin = Math.min(qmin, (j.self_check || []).length);
    });
    put("≥5 self-check Qs/lecture", qmin >= 5, "min=" + qmin);
  } catch (e) { put("quiz minimums", false, "content JSONs missing"); }
  void manifest;
  const pass = checks.every((c) => c.ok);
  return { pass, checks };
}
