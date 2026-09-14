import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

test("rag: tokenizer drops stopwords and short tokens", async () => {
  const { toks } = await import("../src/rag.mjs");
  assert.deepEqual(toks("The cat sat on the mat"), ["cat", "sat", "mat"]);
  assert.deepEqual(toks("a an of to"), []);
});

test("rag: search ranks the overlapping doc first", async () => {
  const { buildIndex, search } = await import("../src/rag.mjs");
  const idx = buildIndex([
    { id: "a", lecture: "L1", title: "photosynthesis", text: "chlorophyll absorbs sunlight in leaves" },
    { id: "b", lecture: "L1", title: "respiration", text: "mitochondria release energy from glucose" },
  ]);
  const hits = search(idx, "chlorophyll sunlight leaves");
  assert.equal(hits[0].doc.id, "a");
  assert.equal(search(idx, "the and of").length, 0);
});

test("databuild: parseQuizzes accepts bullet, lettered, and paren options", async () => {
  const { parseQuizzes } = await import("../src/databuild.mjs");
  const md = `## Self-check
1. [MCQ] Bullet style?
- A. alpha
- B. beta
*Answer:* beta
2. [MCQ] Lettered style?
A. gamma
B. delta
*Answer:* delta
3. [MCQ] Paren style?
- (a) one
- (b) two
*Answer:* two
4. [Short] Keyword style?
*Answer:* full answer here
*Keywords:* full, answer
`;
  const qs = parseQuizzes(md);
  assert.equal(qs.length, 4);
  assert.deepEqual(qs[0].options, ["alpha", "beta"]);
  assert.deepEqual(qs[1].options, ["gamma", "delta"]);
  assert.deepEqual(qs[2].options, ["one", "two"]);
  assert.deepEqual(qs[3].keywords, ["full", "answer"]);
});

test("databuild: buildData gallery reads .dashy/img (not dist/) incl. jpg", async () => {
  const { buildData } = await import("../src/databuild.mjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dashy-test-"));
  fs.mkdirSync(path.join(dir, ".dashy", "content"), { recursive: true });
  fs.mkdirSync(path.join(dir, ".dashy", "img"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".dashy", "content", "L1.md"),
    "# L1 — T\n## Topics\n### T1 — A\npara\n## Self-check\n1. [Short] Q?\n*Answer:* A\n*Keywords:* a\n## Flashcards\n- f? >> b\n");
  fs.writeFileSync(path.join(dir, ".dashy", "img", "L1-img-001.png"), "x");
  fs.writeFileSync(path.join(dir, ".dashy", "img", "L1-img-002.jpg"), "x");
  const r = await buildData(dir, { root: dir, pdfs: [] }, {});
  assert.equal(r.lectures, 1);
  const media = fs.readFileSync(path.join(dir, "dist", "media.js"), "utf8");
  assert.match(media, /L1-img-001\.png/);
  assert.match(media, /L1-img-002\.jpg/);
  const data = fs.readFileSync(path.join(dir, "dist", "app-data.js"), "utf8");
  assert.match(data, /"subject"/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("serve: traversal and malformed URLs are contained", async () => {
  const { serve } = await import("../src/serve.mjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dashy-serve-"));
  fs.mkdirSync(path.join(dir, "dist"), { recursive: true });
  fs.writeFileSync(path.join(dir, "dist", "index.html"), "hi");
  fs.writeFileSync(path.join(dir, "secret.txt"), "nope");
  const { server, port } = await serve(dir, 18923);
  try {
    const get = (p) => new Promise((resolve) => {
      import("node:http").then(({ default: http }) =>
        http.get({ host: "127.0.0.1", port, path: p }, (res) => {
          let b = "";
          res.on("data", (c) => (b += c));
          res.on("end", () => resolve({ status: res.statusCode, body: b }));
        }).on("error", (e) => resolve({ status: 0, body: String(e) })));
    });
    assert.equal((await get("/")).status, 200);
    const trav = await get("/../secret.txt");
    assert.ok(trav.status !== 200 || !trav.body.includes("nope"), "traversal must not serve sibling files");
    const bad = await get("/%E0%A4%A");
    assert.ok([400, 404].includes(bad.status), "malformed URL must not crash (got " + bad.status + ")");
    const again = await get("/");
    assert.equal(again.status, 200);
  } finally {
    server.close();
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test("scan: lecture pdf named *test* is not auto-excluded from lectures", async () => {
  const { scan } = await import("../src/scan.mjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dashy-scan-"));
  fs.writeFileSync(path.join(dir, "latest.pdf"), "%PDF-1.4 fake");
  fs.writeFileSync(path.join(dir, "midterm.pdf"), "%PDF-1.4 fake");
  const man = await scan(dir);
  assert.ok(man.pdfs.some((p) => p.file === "latest.pdf"));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("verify: zero videos passes, malformed IDs and option-less MCQs fail", async () => {
  const { verify } = await import("../src/verify.mjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dashy-verify-"));
  fs.mkdirSync(path.join(dir, "dist", "assets", "diagrams"), { recursive: true });
  fs.mkdirSync(path.join(dir, ".dashy", "content"), { recursive: true });
  fs.writeFileSync(path.join(dir, "dist", "index.html"), "x");
  fs.writeFileSync(path.join(dir, "dist", "styles.css"), "x");
  fs.writeFileSync(path.join(dir, "dist", "app.js"), "console.log(1)");
  fs.writeFileSync(path.join(dir, "dist", "app-data.js"), "window.ACI_DATA=" + "x".repeat(2000));
  fs.writeFileSync(path.join(dir, "dist", "assets", "diagrams", "L1-img-a.png"), "x");
  fs.writeFileSync(path.join(dir, "dist", "media.js"),
    'window.ACI_MEDIA={"images":{"T":[{"f":"L1-img-a.png","c":"cap"}]},"videos":{},"newDiagrams":[]}');
  fs.writeFileSync(path.join(dir, ".dashy", "content", "L1.json"), JSON.stringify({
    self_check: [
      { q: "q1", type: "short", answer: "a" }, { q: "q2", type: "short", answer: "a" },
      { q: "q3", type: "short", answer: "a" }, { q: "q4", type: "short", answer: "a" },
      { q: "q5", type: "short", answer: "a" },
    ],
  }));
  fs.writeFileSync(path.join(dir, ".dashy", "state.json"), JSON.stringify({ manifest: { pdfs: [] } }));
  const v = await verify(dir, { pdfs: [] });
  const vids = v.checks.find((c) => c.name.startsWith("video IDs"));
  assert.ok(vids.ok, "zero videos must pass: " + vids.detail);
  const mcq = v.checks.find((c) => c.name.startsWith("MCQs have options"));
  assert.ok(mcq.ok);
  fs.writeFileSync(path.join(dir, "dist", "media.js"),
    'window.ACI_MEDIA={"images":{"T":[{"f":"L1-img-a.png","c":"cap"}]},"videos":{"T":{"id":"bad id!!","t":"t"}},"newDiagrams":[]}');
  const v2 = await verify(dir, { pdfs: [] });
  assert.ok(!v2.checks.find((c) => c.name.startsWith("video IDs")).ok);
  fs.writeFileSync(path.join(dir, ".dashy", "content", "L1.json"), JSON.stringify({
    self_check: [{ q: "q1", type: "mcq", answer: "a", options: [] }],
  }));
  const v3 = await verify(dir, { pdfs: [] });
  assert.ok(!v3.checks.find((c) => c.name.startsWith("MCQs have options")).ok);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("golden template: no hardcoded subject strings remain", () => {
  const app = fs.readFileSync(path.join(ROOT, "golden", "app.js"), "utf8");
  const html = fs.readFileSync(path.join(ROOT, "golden", "index.html"), "utf8");
  for (const s of ["ZG557", "s4dge", "8000/dashboard", "NEAT/CoDeepNEAT", "all 7 lectures",
    "admissible"]) {
    assert.ok(!app.includes(s) && !html.includes(s), "hardcoded subject string remains: " + s);
  }
  assert.ok(!/id="lec-diags"[ >]/.test(app) || app.includes('id="lec-diags-panel"'));
});
