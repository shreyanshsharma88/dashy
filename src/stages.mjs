// dashy pipeline S0–S10. Deterministic stages run in-process; content stages
// (S4/S5/S6) delegate to headless opencode with strict output contracts.
// Every stage writes the ledger; reruns skip completed stages unless --fresh.
import fs from "node:fs";
import path from "node:path";
import { preflight } from "./preflight.mjs";
import { scan } from "./scan.mjs";
import { extract, renderPages } from "./extract.mjs";
import { runOpencode, ledgerAppend } from "./opencode.mjs";
import { markStage, loadState, saveState } from "./state.mjs";
import { verify } from "./verify.mjs";
import { buildData } from "./databuild.mjs";

const JSON_MARK = (s) => {
  const raw = String(s || "");
  const m = raw.match(/===JSON-BEGIN===([\s\S]*?)===JSON-END===/);
  if (m) return JSON.parse(m[1].trim());
  // fallback: largest balanced {...} block (agents sometimes drop the markers)
  let best = null;
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== "{") continue;
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < raw.length; j++) {
      const c = raw[j];
      if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; }
      else if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}") { depth--; if (depth === 0) { const cand = raw.slice(i, j + 1); if (!best || cand.length > best.length) best = cand; break; } }
    }
  }
  if (best) return JSON.parse(best);
  throw new Error("no parseable JSON (preview: " + raw.slice(0, 120).replace(/\n/g, " ") + ")");
};
// run agent call, parse JSON, one repair round if the output wasn't parseable
async function jsonCall(oc, root, stage, prompt, timeoutMs = 420000) {
  const out1 = await agent(oc, root, stage, prompt, timeoutMs);
  try { return { data: JSON_MARK(out1), repaired: false }; }
  catch (e) {
    const out2 = await agent(oc, root, stage + "-repair",
      "Your last reply was NOT parseable JSON (" + String(e.message).slice(0, 150) + "). " +
      "Re-emit ONLY the JSON document between ===JSON-BEGIN=== and ===JSON-END=== markers — no prose before, inside, or after. " +
      "Your previous reply for reference:\n" + String(out1).slice(0, 6000), timeoutMs);
    return { data: JSON_MARK(out2), repaired: true };
  }
}
async function agent(oc, root, stage, prompt, timeoutMs = 300000, retries = 3) {
  await ledgerAppend(root, { stage, prompt: prompt.slice(0, 500) });
  let last = null;
  for (let a = 1; a <= retries; a++) {
    const r = await runOpencode(oc.bin, { model: oc.model, dir: root, prompt, timeoutMs });
    await ledgerAppend(root, { stage, attempt: a, ok: r.ok, outLen: (r.out || "").length });
    if (r.ok) return r.out;
    last = r.error || "unknown";
    if (/auth|login|unauthorized|forbidden/i.test(last))
      throw new Error(stage + " needs auth: run `opencode auth login`. Detail: " + last.slice(0, 200));
    onEventLog(root, stage, a, last);
    if (a < retries) await new Promise((res) => setTimeout(res, [0, 10000, 30000, 60000][a] || 60000));
  }
  throw new Error(stage + " opencode call failed after " + retries + " attempts: " + String(last).slice(0, 300));
}
function onEventLog(root, stage, attempt, err) {
  try {
    fs.appendFileSync(path.join(root, ".dashy", "build-events.log"),
      new Date().toISOString() + ` [${stage}] attempt ${attempt} failed: ${String(err).slice(0, 200)}\n`);
  } catch {}
}
function formulaDensity(text) {
  const eq = (text.match(/=|≤|≥|→|⇒|∑|∫/g) || []).length;
  return eq / Math.max(1, text.length / 1000); // symbols per 1k chars
}
// spec.handout holds FILENAMES from the wizard — resolve to actual text.
function resolveHandout(root, manifest, spec) {
  const names = Array.isArray(spec.handout) ? spec.handout
    : spec.handout ? [spec.handout] : [...(manifest.handoutCandidates || [])];
  const parts = [];
  for (const n of names.slice(0, 3)) {
    const base = String(n).split("/").pop();
    const stem = base.replace(/\.(docx?|txt|md|pdf|pptx?)$/i, "");
    // extracted text FIRST; raw root file only if it is itself text (never binary .docx/.pdf/.pptx)
    const cand = [
      path.join(root, ".dashy", "txt", "doc-" + stem + ".txt"),
      path.join(root, ".dashy", "txt", stem + ".txt"),
      ...(/\.(txt|md)$/i.test(base) ? [path.join(root, base)] : []),
    ];
    for (const f of cand) {
      try { const t = fs.readFileSync(f, "utf8"); if (t.trim().length > 50) { parts.push(t.slice(0, 6000)); break; } } catch {}
    }
  }
  return parts.join("\n\n---\n\n").slice(0, 12000);
}

export async function renderGaps(root, mm, onEvent = () => {}) {
  let budget = 60;
  for (const g of ((mm || {}).gaps || [])) {
    if (budget <= 0) break;
    const m = String(g.pages || "").match(/(\d+)\s*[-–]\s*(\d+)/);
    if (!m) continue;
    const base = String(g.pdf || "").split("/").pop().replace(/\.(pdf|pptx?)$/i, "");
    if (!base) continue;
    const pages = [];
    for (let p = +m[1]; p <= +m[2] && budget > 0; p++, budget--) pages.push(p);
    if (!pages.length) continue;
    try {
      const made = await renderPages(root, g.pdf, pages, base + "-gap");
      onEvent(`gap ${base} p${pages[0]}-${pages[pages.length - 1]}: ${made.length} renders`);
    } catch (e) { onEvent(`gap render failed for ${base}: ${String(e.message || e).slice(0, 120)}`); }
  }
}
export async function build(root, opts = {}, onEvent = () => {}) {
  const st = loadState(root);
  const spec = { ...(st.spec || {}), ...(opts.spec || {}) };
  st.spec = spec; saveState(root, st);
  const fresh = !!opts.fresh;
  const done = (s) => !fresh && st.stages?.[s]?.status === "done";

  // S0 preflight
  if (!done("S0")) {
    const rep = await preflight(opts.model);
    if (!rep.ok) throw new Error("Preflight failed:\n" + rep.checks.filter((c) => !c.ok).map((c) => "- " + c.name + ": " + c.detail).join("\n"));
    markStage(root, "S0", "done", { model: rep.model });
  }
  const oc = { bin: loadState(root).stages.S0?.bin || "opencode", model: loadState(root).stages.S0?.model || opts.model };
  onEvent("S0", "preflight ok (" + oc.model + ")");

  // S1 scan (handout-only folders are valid: docs become the single lecture)
  let manifest = st.manifest;
  if (!done("S1") || !manifest) {
    manifest = await scan(root);
    manifest.docs = (manifest.otherDocs || []).filter((f) => /\.(docx?|txt|md)$/i.test(f)).map((f) => ({ file: f }));
    if (!manifest.pdfs.length && !manifest.docs.length) throw new Error("No PDFs, slides, or readable docs in " + root);
    st.manifest = manifest; saveState(root, st);
    markStage(root, "S1", "done", { pdfs: manifest.pdfs.length, docs: manifest.docs.length });
  }
  onEvent("S1", manifest.pdfs.length + " PDFs, " + (manifest.docs || []).length + " docs");

  // S2 extract
  if (!done("S2")) {
    const rep = await extract(root, manifest, (k, f, n) => onEvent("S2", k + " " + f));
    const dens = {};
    for (const t of rep.texts) {
      try { dens[t.file] = +formulaDensity(fs.readFileSync(path.join(root, ".dashy", "txt", t.file.replace(/\.(pdf|pptx?)$/i, "") + ".txt"), "utf8")).toFixed(2); } catch { dens[t.file] = 0; }
    }
    markStage(root, "S2", "done", { ...rep, formulaDensity: dens });
  }
  onEvent("S2", "extracted");

  // S4 exam analysis (needs papers or handout; else syllabus-inferred, flagged)
  const papers = [...(spec.papers || []), ...(manifest.paperCandidates || [])].filter((v, i, a) => a.indexOf(v) === i);
  if (!done("S4")) {
    let paperText = "";
    for (const p of papers.slice(0, 3)) {
      const f = path.join(root, p);
      if (fs.existsSync(f) && !/\.(pdf|pptx?)$/i.test(p)) paperText += "\n\n" + fs.readFileSync(f, "utf8").slice(0, 6000);
      else if (/\.(pdf|pptx?)$/i.test(p)) {
        const t = path.join(root, ".dashy", "txt", p.replace(/\.(pdf|pptx?)$/i, "") + ".txt");
        if (fs.existsSync(t)) paperText += "\n\n" + fs.readFileSync(t, "utf8").slice(0, 6000);
      }
    }
    const prompt = `Analyze this exam material (may be EMPTY — then infer a plausible pattern from the syllabus topics and set "inferred": true).
${paperText ? "MATERIAL:\n" + paperText.slice(0, 9000) : "(no question papers supplied — infer from syllabus, inferred:true)"}
${resolveHandout(root, manifest, spec) ? "HANDOUT CONTEXT:\n" + resolveHandout(root, manifest, spec).slice(0, 3000) : ""}
${spec.extra ? "USER EXTRA REQUESTS:\n" + String(spec.extra).slice(0, 2000) : ""}
Return ONLY JSON between ===JSON-BEGIN=== and ===JSON-END=== with keys: paper, meta{nature,weightage,duration,date}, questions[{q,marks,topic,style}], weightage[{topic,marks,pct}], takeaways[5], at_risk[].
No invented URLs. Be concise.`;
    const { data: ep } = await jsonCall(oc, root, "S4", prompt);
    fs.mkdirSync(path.join(root, ".dashy", "content"), { recursive: true });
    fs.writeFileSync(path.join(root, ".dashy", "content", "exam-pattern.json"), JSON.stringify(ep, null, 2));
    markStage(root, "S4", "done", { questions: (ep.questions || []).length });
  }
  onEvent("S4", "exam pattern");

  // S5 lecture MDs (sequential; one opencode call per PDF) + S5b formula rule.
  // Handout-only mode: no lecture PDFs -> single overview lecture MD from handout text.
  const densMap = loadState(root).stages.S2?.formulaDensity || {};
  const handoutText = resolveHandout(root, manifest, spec);
  if (!done("S5")) {
    const pdfs = manifest.pdfs.filter((p) => !(papers.includes(p.file)));
    if (!pdfs.length) {
      const out = await agent(oc, root, "S5-L1-handout",
        `Write ONE overview study file from this COURSE HANDOUT (no lecture PDFs were supplied — distill syllabus topics, outcomes, schedule, assessment into lecture-style topics).
Use EXACTLY this markdown shape:
# L1 — Course Overview
## Prerequisites
- Concept lines as "- **Concept.** refresher sentences"
## Topics
### <T-code> — <name>
Beginner-first paragraph, then bullets starting with one of: - formula_box: ... | - worked steps: ... | - diagram_asset: ... | - video: TODO: search "..." | - exam_note: ... | - confidence: sourced|reworded|original-example|TODO-verify
Cover EVERY handout item however minor; mark inference as original-example, never invent.
## Formulas & Algorithms
Numbered/bulleted formula lines if the handout names any, else the single line "None named in handout."
## Self-check
5-8 numbered questions tagged [MCQ]/[Short]/[Numerical], each with "*Answer:* ..." and "*Keywords:* a, b" lines.
## Flashcards
Lines shaped "- <front>? >> <back>" (4-6 cards).
HANDOUT:\n${handoutText.slice(0, 12000) || "(handout unreadable — build from filenames + general course shape, confidence original-example)"}`,
        420000);
      const md = out.includes("# ") ? out.slice(out.indexOf("# ")) : out;
      fs.writeFileSync(path.join(root, ".dashy", "content", "L1.md"), md);
      onEvent("S5", "L1.md (handout-only)");
    }
    let li = 0;
    for (const p of pdfs) {
      li++;
      const stem = p.file.replace(/\.(pdf|pptx?)$/i, "");
      const dump = fs.readFileSync(path.join(root, ".dashy", "txt", stem + ".txt"), "utf8");
      const dense = (densMap[p.file] || 0) > 1.5;
      const prompt = `Write a study file for lecture ${stem} (source: ${p.file}, ${dump.length} chars of slide text below).
${dense ? "FORMULA RULE (this subject is formula-dense): every formula-bearing topic MUST have a formula_box plus a fully worked numerical example (every intermediate step), quizzes MUST include numerical-type Qs wherever the slides compute anything, and theory-only topics must say so explicitly. Never invent numbers." : "If the slides contain no formulas/numericals, leave those parts out (do not invent)."}
Use EXACTLY this markdown shape:
# <id> — <title>
## Prerequisites
- Concept lines as "- **Concept.** refresher sentences"
## Topics
### <T-code> — <name>
Beginner-first paragraph, then bullet lines, each starting with one of these keys:
- formula_box: ... | - worked steps: ... | - diagram_asset: ... | - video: TODO: search "..." | - exam_note: ... | - confidence: sourced|reworded|original-example|TODO-verify
Cover EVERY slide item however minor (visual-only slides get confidence TODO-verify, no invented numbers).
## Formulas & Algorithms
Numbered/bulleted formula lines, then a bold "**Algorithms**" line followed by pseudocode bullets.
## Self-check
Numbered questions, each tagged [MCQ] or [Short] or [Numerical], each followed by an "*Answer:* ..." line and (for Short/Numerical) a "*Keywords:* a, b, c" line. 5-8 questions.
## Flashcards
Lines shaped "- <front>? >> <back>" (4-6 cards: term/formula front, definition+one-line usage back).
SLIDE TEXT:\n${dump.slice(0, 14000)}`;
      const out = await agent(oc, root, "S5-" + stem, prompt, 420000);
      const md = out.includes("# ") ? out.slice(out.indexOf("# ")) : out;
      fs.writeFileSync(path.join(root, ".dashy", "content", stem + ".md"), md);
      onEvent("S5", stem + ".md");
    }
    markStage(root, "S5", "done", { lectures: pdfs.length });
  }

  // S6 media: image-map JSON + video JSON (verified by the agent via webfetch/oembed).
  // Self-healing first: reconvert any missing pdf/<stem>.pdf (user may have deleted pdf/).
  if (!done("S6")) {
    const { convertSlides } = await import("./extract.mjs");
    const slides = (manifest.pdfs || []).filter((p) => p.kind === "slides");
    if (slides.length) await convertSlides(root, slides, (k, f) => onEvent("S6", k + " " + f));
    const stems = manifest.pdfs.map((p) => p.file.replace(/\.(pdf|pptx?)$/i, ""));
    // curated image list: prefer larger files, spread across stems, cap 40 (agents drown past that)
    const imgList = [];
    try {
      const byStem = {};
      fs.readdirSync(path.join(root, ".dashy", "img")).filter((f) => /\.(png|jpe?g)$/i.test(f)).forEach((f) => {
        try {
          const sz = fs.statSync(path.join(root, ".dashy", "img", f)).size;
          if (sz < 8000) return;
          const stem = stems.find((s) => f.startsWith(s + "-img")) || "misc";
          (byStem[stem] = byStem[stem] || []).push({ f, sz });
        } catch {}
      });
      Object.values(byStem).forEach((arr) => arr.sort((a, b) => b.sz - a.sz).slice(0, 6).forEach((x) => imgList.push(x.f)));
      imgList.sort();
      while (imgList.length > 40) imgList.pop();
    } catch {}
    const prompt = `Two mapping jobs for lectures [${stems.join(", ")}]. Available extracted images:\n${imgList.join("\n") || "(none)"}\n` +
      `NOTE: slide decks (.ppt/.pptx) were converted to PDF at pdf/<STEM>.pdf — cite those converted paths (never the .pptx) for gap screenshots.\n` +
      `Extra features requested: ${String(spec.extra || "none").slice(0, 1000)}\n` +
      `JOB 1 (images): for every ### topic in .dashy/content/*.md assign 0-3 existing PNGs (JSON {"<exact heading>": [{"file":..,"caption":"<=12 words"}]}). List topics with zero suitable images as gaps with exact PDF+pages to screenshot.\n` +
      `JOB 2 (videos): websearch ~3 major topics per lecture for the best YouTube explainers; verify each watch URL exists (fetch it); return {"videos": [{"lecture","topic":"exact ### heading","videoId":"11 chars","title","channel","why":"<=10 words"}], "skipped":[...]}. NEVER invent IDs; skip rather than fill mediocrity.\n` +
      `Return ONLY JSON between ===JSON-BEGIN=== and ===JSON-END===: {"images": {...}, "gaps": [...], "videos": [...], "skipped": [...]}`;
    const { data: mm } = await jsonCall(oc, root, "S6", prompt, 420000);
    mm.images = mm.images && typeof mm.images === "object" ? mm.images : {};
    mm.gaps = Array.isArray(mm.gaps) ? mm.gaps : [];
    mm.videos = Array.isArray(mm.videos) ? mm.videos : [];
    mm.skipped = Array.isArray(mm.skipped) ? mm.skipped : [];
    fs.writeFileSync(path.join(root, ".dashy", "media-map.json"), JSON.stringify(mm, null, 2));
    // render gap pages the agent requested (bounded: first 60 pages total)
    await renderGaps(root, mm, (msg) => onEvent("S6", msg));
    markStage(root, "S6", "done", { videos: (mm.videos || []).length });
  }
  onEvent("S6", "media map");

  // S7 data build (deterministic) + S8 assemble golden template
  if (!done("S7")) {
    await buildData(root, manifest, spec);
    markStage(root, "S7", "done");
  }
  onEvent("S7", "data built");
  return loadState(root);
}
