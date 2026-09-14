import fs from "node:fs";
import path from "node:path";
import { runOpencode } from "../src/opencode.mjs";

const root = process.argv[2] || "data";
const model = process.argv[3] || "opencode/muse-spark-1.2-contributor-free";

const stems = JSON.parse(fs.readFileSync(path.join(root, ".dashy", "content", "L1.json"), "utf8").lecture ? "[]" : "[]");
const lectures = fs.readdirSync(path.join(root, ".dashy", "content"))
  .filter((f) => /^L\d+.*\.md$/i.test(f)).map((f) => f.replace(/\.md$/, ""));
const headings = {};
for (const lid of lectures) {
  const md = fs.readFileSync(path.join(root, ".dashy", "content", lid + ".md"), "utf8");
  headings[lid] = [...md.matchAll(/^###\s+(.+)$/gm)].map((m) => m[1].trim());
}
const imgFiles = fs.readdirSync(path.join(root, ".dashy", "img"))
  .filter((f) => /\.(png|jpe?g)$/i.test(f));
const byStem = {};
for (const f of imgFiles) {
  const m = f.match(/^(L\d+)-img/);
  const stem = m ? m[1] : "misc";
  (byStem[stem] = byStem[stem] || []).push(f);
}
const imgList = [];
for (const [stem, arr] of Object.entries(byStem)) {
  const sized = arr.map((f) => ({ f, sz: fs.statSync(path.join(root, ".dashy", "img", f)).size }))
    .filter((x) => x.sz >= 8000).sort((a, b) => b.sz - a.sz).slice(0, 8).map((x) => x.f);
  imgList.push(...sized);
}
imgList.sort();
console.log("lectures:", lectures.join(","), "| images offered:", imgList.length);

const prompt = `Map extracted PDF figures to lecture topics for [${lectures.join(", ")}].
Available images:\n${imgList.join("\n")}\n
Lecture headings:\n${lectures.map((l) => l + ":\n" + headings[l].map((h) => "### " + h).join("\n")).join("\n")}\n
JOB: for every ### heading above assign 0-3 existing images whose filename stem matches the lecture (e.g. L1-imgN for L1 topics). JSON {"<exact heading>": [{"file":..,"caption":"<=12 words"}]}.
Return ONLY JSON between ===JSON-BEGIN=== and ===JSON-END===: {"images": {...}}`;

const r = await runOpencode("opencode", { model, dir: root, prompt, timeoutMs: 420000 });
if (!r.ok) { console.error("FAILED:", r.error.slice(0, 300)); process.exit(1); }
const m = r.out.match(/===JSON-BEGIN===([\s\S]*?)===JSON-END===/);
const data = JSON.parse((m ? m[1] : r.out).trim());
const mm = JSON.parse(fs.readFileSync(path.join(root, ".dashy", "media-map.json"), "utf8"));
let added = 0;
for (const [k, v] of Object.entries(data.images || {})) {
  if (!mm.images[k]) { mm.images[k] = v; added++; }
}
fs.writeFileSync(path.join(root, ".dashy", "media-map.json"), JSON.stringify(mm, null, 2));
console.log("added mappings for", added, "new topics; total:", Object.keys(mm.images).length);
