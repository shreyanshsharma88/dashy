// dashy state ledger — per-stage progress in <subject>/.dashy/state.json
import fs from "node:fs";
import path from "node:path";

export function statePath(root) { return path.join(root, ".dashy", "state.json"); }
export function loadState(root) {
  try { return JSON.parse(fs.readFileSync(statePath(root), "utf8")); }
  catch { return { subject: path.basename(root), stages: {}, spec: {}, created: Date.now() }; }
}
export function saveState(root, st) {
  fs.mkdirSync(path.join(root, ".dashy"), { recursive: true });
  st.updated = Date.now();
  fs.writeFileSync(statePath(root), JSON.stringify(st, null, 2));
}
export function markStage(root, name, status, detail = {}) {
  const st = loadState(root);
  st.stages[name] = { status, at: Date.now(), ...detail };
  saveState(root, st);
  return st;
}
export function isDone(root, name) { return loadState(root).stages?.[name]?.status === "done"; }
