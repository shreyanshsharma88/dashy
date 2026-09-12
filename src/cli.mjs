// dashy CLI entry. Bare `dashy` -> interactive TUI (no memorization);
// every TUI action maps 1:1 to a command below.
import { Command } from "commander";
import * as p from "@clack/prompts";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { preflight } from "./preflight.mjs";
import { scan } from "./scan.mjs";
import { build, renderGaps } from "./stages.mjs";
import { convertSlides } from "./extract.mjs";
import { bootstrap } from "./bootstrap.mjs";
import { buildData } from "./databuild.mjs";
import { verify } from "./verify.mjs";
import { serve } from "./serve.mjs";
import { runOpencode } from "./opencode.mjs";
import { indexFromDashy, search } from "./rag.mjs";
import { loadState, saveState, markStage } from "./state.mjs";
import { mainMenu, wizard, slashPalette } from "./tui.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GOLDEN = path.join(HERE, "..", "golden");
const rootOf = (o) => path.resolve(o.root || process.cwd());

function cpTree(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.isDirectory()) cpTree(path.join(src, e.name), path.join(dst, e.name));
    else fs.copyFileSync(path.join(src, e.name), path.join(dst, e.name));
  }
}
async function assemble(root) {
  // S8: golden shell + fonts + curated diagrams into dist/
  const dist = path.join(root, "dist");
  fs.mkdirSync(path.join(dist, "assets", "diagrams"), { recursive: true });
  for (const f of ["index.html", "styles.css", "app.js"])
    fs.copyFileSync(path.join(GOLDEN, f), path.join(dist, f));
  cpTree(path.join(GOLDEN, "assets", "fonts"), path.join(dist, "assets", "fonts"));
  // ship readable PDFs alongside (PDF window src = pdf/<stem>.pdf, works over http AND file://)
  const pdfDst = path.join(dist, "pdf");
  fs.mkdirSync(pdfDst, { recursive: true });
  try {
    const st2 = loadState(root);
    const listed = ((st2.manifest || {}).pdfs || []).map((p) => p.file.replace(/\.(pdf|pptx?)$/i, "") + ".pdf");
    const names = new Set([...listed, ...fs.readdirSync(path.join(root, "pdf")).filter((f) => f.endsWith(".pdf"))]);
    names.forEach((n) => {
      const src = fs.existsSync(path.join(root, "pdf", n)) ? path.join(root, "pdf", n) : path.join(root, n);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(pdfDst, n));
    });
  } catch {}
  const imgSrc = path.join(root, ".dashy", "img");
  const imgDst = path.join(dist, "assets", "diagrams");
  fs.mkdirSync(imgDst, { recursive: true });
  let n = 0;
  if (fs.existsSync(imgSrc)) {
    const seen = new Set();
    for (const f of fs.readdirSync(imgSrc).filter((x) => /\.(png|jpg|jpeg)$/i.test(x)).sort()) {
      const st = fs.statSync(path.join(imgSrc, f));
      if (st.size < 8000) continue; // icons/logos
      const key = st.size + ":" + f.split("-")[0];
      if (seen.has(key)) continue;
      seen.add(key);
      fs.copyFileSync(path.join(imgSrc, f), path.join(imgDst, f));
      if (++n >= 150) break;
    }
  }
  return { diagrams: n };
}
async function auditLoop(root, manifest, oc, maxRounds = 5) {
  // S9: verify -> fixing agent -> rebuild -> re-verify until all PASS
  for (let r = 1; r <= maxRounds; r++) {
    const v = await verify(root, manifest);
    const bad = v.checks.filter((c) => !c.ok);
    if (!bad.length) { markStage(root, "S9", "done", { rounds: r }); return { pass: true, rounds: r }; }
    p.log.warn(`S9 round ${r}: ${bad.length} defect(s) — spinning fixing agent`);
    const prompt = `Fix these dashboard defects by editing files under dist/ and .dashy/content/ (subject root ${root}). ` +
      `Rebuild-affecting content fixes go in .dashy/content/*.md (same schema). Defects:\n` +
      bad.map((d) => `- ${d.name}: ${d.detail}`).join("\n") +
      `\nReply with a 3-line summary of files changed. No invented URLs/numbers.`;
    const res = await runOpencode(oc.bin, { model: oc.model, dir: root, prompt, timeoutMs: 420000 });
    if (!res.ok) { markStage(root, "S9", "blocked", { round: r, error: res.error }); return { pass: false, rounds: r, blocked: res.error }; }
    await buildData(root, manifest, loadState(root).spec || {});
  }
  const v = await verify(root, manifest);
  const bad = v.checks.filter((c) => !c.ok);
  if (!bad.length) { markStage(root, "S9", "done", { rounds: maxRounds }); return { pass: true, rounds: maxRounds }; }
  markStage(root, "S9", "blocked", { residual: bad.map((d) => d.name) });
  return { pass: false, rounds: maxRounds, residual: bad };
}
async function doBuild(root, opts, fresh) {
  const st = await build(root, { ...opts, fresh }, (stage, msg) => p.log.info(`[${stage}] ${msg}`));
  await assemble(root);
  const oc = { bin: st.stages.S0?.bin || "opencode", model: st.stages.S0?.model };
  const v = await auditLoop(root, st.manifest, oc);
  if (!v.pass) p.log.error("S9 blocked: " + JSON.stringify(v.residual || v.blocked || v).slice(0, 400));
  else p.log.success(`Dashboard built in ${root}/dist (S9 clean after ${v.rounds} round(s)). Run \`dashy serve\`.`);
  return v;
}

const program = new Command();
program.name("dashy").description("Build ACI-style study dashboards from a folder of PDFs").version("0.1.0");
program.option("--root <dir>", "subject folder", process.cwd());

program.command("init").description("guided setup wizard").action(async (o, c) => {
  const root = rootOf(c.parent.opts());
  await wizard(root);
});
program.command("scan").description("list PDFs + handout/paper candidates").action(async (o, c) => {
  const man = await scan(rootOf(c.parent.opts()));
  p.log.info(JSON.stringify(man, null, 1).slice(0, 2000));
});
program.command("build").description("full pipeline S0–S10").option("--fresh", "redo all stages").option("--port <n>", "serve port for smoke test", "").action(async (o, c) => {
  const root = rootOf(c.parent.opts());
  const s = p.spinner(); s.start("dashy build");
  try { await doBuild(root, {}, !!o.fresh); s.stop("done"); }
  catch (e) { s.stop("failed"); p.log.error(String(e.message || e).slice(0, 600)); }
});
program.command("bootstrap").description("auto-install opencode (+auth/model check) and Wispr guidance").option("--yes", "non-interactive: allow installs").option("--model <id>", "required model").action(async (o) => {
  const rep = await bootstrap({ yes: !!o.yes, model: o.model },
    (m) => p.log.info(m));
  const show = (k, v) => p.log[v.ok ? "success" : "error"](`${k}: ${v.ok ? "OK" : "ACTION NEEDED"}${v.detail ? " — " + v.detail : ""}${v.fix ? " — " + v.fix : ""}`);
  show("opencode", rep.opencode); show("auth", rep.auth || { ok: false }); show("model", rep.model || { ok: false }); show("wispr", rep.wispr);
});
program.command("rebuild").description("deterministic rebuild: restore pdf/, re-render gaps, S7+S8+S9 (no LLM content redo)").action(async (o, c) => {
  const root = rootOf(c.parent.opts());
  const st = loadState(root);
  if (!st.manifest) { p.log.error("No manifest — run `dashy build` first."); return; }
  const s = p.spinner(); s.start("dashy rebuild");
  try {
    const slides = (st.manifest.pdfs || []).filter((x) => x.kind === "slides");
    if (slides.length) await convertSlides(root, slides, (k, f) => p.log.info(`[pdf] ${k} ${f}`));
    let mm = {};
    try { mm = JSON.parse(fs.readFileSync(path.join(root, ".dashy", "media-map.json"), "utf8")); } catch {}
    await renderGaps(root, mm, (m) => p.log.info("[gaps] " + m));
    const r = await buildData(root, st.manifest, st.spec || {});
    p.log.info(`S7: ${r.lectures} lectures, ${r.quizzes} quizzes`);
    await assemble(root);
    const oc = { bin: st.stages.S0?.bin || "opencode", model: st.stages.S0?.model };
    const v = await auditLoop(root, st.manifest, oc);
    s.stop(v.pass ? "rebuild clean" : "rebuild blocked — see defects above");
  } catch (e) { s.stop("failed"); p.log.error(String(e.message || e).slice(0, 500)); }
});
program.command("serve").description("serve dist/ over http (auto-bumps port if busy)").option("--port <n>", "port", "8000").action(async (o, c) => {
  const root = rootOf(c.parent.opts());
  const { url, port } = await serve(root, Number(o.port));
  if (Number(o.port) !== port) p.log.warn(`Port ${o.port} was busy — serving on ${port} instead.`);
  p.log.success(url);
  p.log.info("Ctrl+C to stop. Videos need http (not file://).");
});
program.command("status").description("ledger + artifacts").action(async (o, c) => {
  const root = rootOf(c.parent.opts());
  const st = loadState(root);
  p.log.info(JSON.stringify({ stages: st.stages, spec: st.spec }, null, 1).slice(0, 2000));
});
program.command("add-features").argument("<text>").description("append free-text features to spec").action(async (t, o, c) => {
  const root = rootOf(c.parent.opts());
  const st = loadState(root);
  st.spec = { ...(st.spec || {}), extra: ((st.spec || {}).extra || "") + "\n" + t };
  saveState(root, st);
  p.log.success("Spec updated. Re-run `dashy build` (completed stages are skipped).");
});
program.command("ask").argument("<q>").description("ask the local TF-IDF index (no LLM)").action(async (q, o, c) => {
  const idx = indexFromDashy(rootOf(c.parent.opts()));
  const hits = search(idx, q, 3);
  if (!hits.length) { p.log.warn("Nothing in the extracted texts matches."); return; }
  hits.forEach((h) => p.log.info(`[${h.doc.lecture} — ${h.doc.title}]\n${h.doc.text.slice(0, 400)}\n`));
});
program.action(async () => {
  // bare `dashy` -> interactive menu loop
  p.intro("dashy — study dashboard builder (arrows + Enter, nothing to memorize)");
  for (;;) {
    const m = await mainMenu();
    if (p.isCancel(m) || m === "exit") { p.outro("bye"); process.exit(0); }
    const root = process.cwd();
    try {
      if (m === "build") {
        const w = await wizard(root);
        if (w) await doBuild(root, {}, false);
      } else if (m === "bootstrap") {
        const rep = await bootstrap({ yes: false }, (x) => p.log.info(x));
        const show = (k, v) => p.log[v.ok ? "success" : "error"](`${k}: ${v.ok ? "OK" : "ACTION NEEDED"}${v.detail ? " — " + v.detail : ""}${v.fix ? " — " + v.fix : ""}`);
        show("opencode", rep.opencode); show("auth", rep.auth || { ok: false }); show("model", rep.model || { ok: false }); show("wispr", rep.wispr);
      } else if (m === "serve") {
        const { url } = await serve(root, 8000);
        p.log.success(url + " (Ctrl+C to stop)");
      } else if (m === "status") {
        p.log.info(JSON.stringify(loadState(root).stages, null, 1).slice(0, 1500));
      } else if (m === "add") {
        const t = await p.text({ message: "Extra features (free text)" });
        if (!p.isCancel(t) && t) {
          const st = loadState(root);
          st.spec = { ...(st.spec || {}), extra: ((st.spec || {}).extra || "") + "\n" + t };
          saveState(root, st);
          p.log.success("Saved to spec.");
        }
      }
    } catch (e) { p.log.error(String(e.message || e).slice(0, 500)); }
  }
});
program.parseAsync(process.argv);
export { slashPalette };
