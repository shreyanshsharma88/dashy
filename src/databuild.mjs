// S7 deterministic data build: MDs -> app-data.js + media.js + exam/cheat HTML -> dist/.
// No LLM. Parses the S5 output contract; degrades gracefully (missing parts -> empty).
import fs from "node:fs";
import path from "node:path";

function escH(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
function inlineMd(s) {
  s = escH(s);
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/`([^`]+?)`/g, "<code>$1</code>");
  return s;
}
export function mdToHtml(md) {
  const lines = String(md || "").split("\n"), out = [];
  let i = 0, inCode = false, codeBuf = [];
  const stack = [];
  const close = () => { while (stack.length) out.push("</" + stack.pop() + ">"); };
  while (i < lines.length) {
    const ln = lines[i], st = ln.trim();
    if (st.startsWith("```")) {
      if (!inCode) { close(); inCode = true; codeBuf = []; }
      else { inCode = false; out.push("<pre><code>" + escH(codeBuf.join("\n")) + "</code></pre>"); }
      i++; continue;
    }
    if (inCode) { codeBuf.push(ln); i++; continue; }
    if (/^\s*---+\s*$/.test(ln)) { close(); out.push("<hr>"); i++; continue; }
    let m = st.match(/^(#{1,4})\s+(.*)/);
    if (m) { close(); out.push(`<h${m[1].length}>${inlineMd(m[2])}</h${m[1].length}>`); i++; continue; }
    if (ln.includes("|") && i + 1 < lines.length && /^\s*\|?[\s:|.-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes("|")) {
      close();
      const hdr = ln.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      i += 2; const rows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim())); i++;
      }
      out.push('<div class="tbl-wrap"><table><thead><tr>' + hdr.map((c) => `<th>${inlineMd(c)}</th>`).join("") +
        "</tr></thead><tbody>" + rows.map((r) => "<tr>" + r.map((c) => `<td>${inlineMd(c)}</td>`).join("") + "</tr>").join("") + "</tbody></table></div>");
      continue;
    }
    m = ln.match(/^\s*>\s?(.*)/);
    if (m) {
      close(); const qs = [];
      while (i < lines.length) { const q = lines[i].match(/^\s*>\s?(.*)/); if (!q) break; qs.push(q[1]); i++; }
      out.push('<aside class="formula">' + qs.map(inlineMd).join("<br>") + "</aside>");
      continue;
    }
    m = ln.match(/^\s*[-*]\s+(.*)/);
    if (m) { if (stack[stack.length - 1] !== "ul") { close(); out.push("<ul>"); stack.push("ul"); } out.push("<li>" + inlineMd(m[1]) + "</li>"); i++; continue; }
    m = ln.match(/^\s*\d+[.)]\s+(.*)/);
    if (m) { if (stack[stack.length - 1] !== "ol") { close(); out.push("<ol>"); stack.push("ol"); } out.push("<li>" + inlineMd(m[1]) + "</li>"); i++; continue; }
    if (!st) { close(); i++; continue; }
    close();
    const para = [st]; i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\s*>\s|\s*[-*]\s|\s*\d+[.)]\s|\s*---+\s*)/.test(lines[i]) && !lines[i].includes("|")) { para.push(lines[i].trim()); i++; }
    out.push("<p>" + inlineMd(para.join(" ")) + "</p>");
  }
  close();
  return out.join("\n");
}
const slug = (lid, name) => (lid + "-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60));
function plainText(md) {
  return String(md || "").replace(/```[\s\S]*?```/g, " ").replace(/[#>*`|_-]/g, " ").replace(/\s+/g, " ").trim();
}
function sections(md) {
  const parts = String(md || "").split(/^(#{2,3})\s+(.+)$/m);
  const secs = [];
  for (let j = 1; j < parts.length; j += 3) secs.push({ lvl: parts[j].length, title: parts[j + 1].trim(), body: parts[j + 2] });
  return secs;
}
function topicFields(body) {
  const f = { plain: "", formula_box: "", worked_example: "", diagram_asset: "", video: "", exam_note: "", confidence: "" };
  const lines = body.split("\n");
  let para = [];
  for (const ln of lines) { if (ln.trim()) para.push(ln.trim()); else if (para.length) break; }
  f.plain = para.join(" ").replace(/^\**Plain explanation\.?\**\s*:?\s*/i, "").replace(/^Beginner-first:\s*/, "").slice(0, 600);
  for (const ln of lines) {
    const m = ln.trim().match(/^-\s*\**([^:*]+?)\**\s*:\s*(.+)$/);
    if (!m) continue;
    const k = m[1].trim().toLowerCase(), v = m[2].trim();
    if (k.includes("formula")) f.formula_box = v.slice(0, 400);
    else if (k.includes("work")) f.worked_example = v.slice(0, 600);
    else if (k.includes("diagram")) f.diagram_asset = v.slice(0, 300);
    else if (k.includes("video")) f.video = v.slice(0, 200);
    else if (k.includes("exam")) f.exam_note = v.slice(0, 300);
    else if (k.includes("confidence")) f.confidence = v.slice(0, 200);
  }
  if (!f.video) { const m = body.match(/TODO:\s*search\s+"([^"]+)"/); if (m) f.video = `TODO: search "${m[1]}"`; }
  return f;
}
function secBody(md, title) {
  // section body without regex end-anchor pitfalls (JS has no \Z)
  const lines = String(md || "").split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      if (start >= 0) return lines.slice(start, i).join("\n");
      if (lines[i].replace(/^##\s+/, "").trim().toLowerCase().startsWith(title.toLowerCase())) start = i + 1;
    }
  }
  return start >= 0 ? lines.slice(start).join("\n") : "";
}
function parseQuizzes(md) {
  const body = secBody(md, "self-check");
  if (!body) return [];
  const out = [];
  const lines = body.split("\n");
  let cur = null;
  const push = () => { if (cur && cur.q) out.push(cur); cur = null; };
  for (const ln0 of lines) {
    const ln = ln0.trim();
    let qm = ln.match(/^\d+[.)]\s*(?:\[(MCQ|Short|Numerical)\]\s*)?(.+)$/i);
    if (qm && ln.length > 8 && !/^\*/.test(ln)) {
      // avoid treating "*Answer:" lines (they start with *)
      push();
      const t = (qm[1] || "short").toLowerCase();
      cur = { q: qm[2].trim(), type: t === "mcq" ? "mcq" : t === "numerical" ? "numerical" : "short", options: [], answer: "", keywords: [], explanation: "" };
      continue;
    }
    if (!cur) continue;
    let am = ln.match(/^\*?Answer:\*?\s*(.+)$/i);
    if (am) { cur.answer = am[1].trim(); continue; }
    let km = ln.match(/^\*?Keywords:\*?\s*(.+)$/i);
    if (km) { cur.keywords = km[1].split(",").map((s) => s.trim()).filter(Boolean); continue; }
    let em = ln.match(/^\*?(Explanation|Grading):\*?\s*(.+)$/i);
    if (em) { cur.explanation = em[2].trim(); continue; }
    let om = ln.match(/^[-*]\s*(?:[A-D][).]\s*)?(.+)$/);
    if (om && cur.type === "mcq" && cur.options.length < 5 && !cur.answer) cur.options.push(om[1].trim());
  }
  push();
  return out.filter((q) => q.q && q.answer).map((q) => ({
    ...q,
    grading: q.type === "mcq" ? "exact match on option" : `keyword coverage: all ${q.keywords.length} keywords required (case-insensitive)`,
  }));
}
function parseFlashcards(md) {
  const body = secBody(md, "flashcards");
  if (!body) return [];
  return body.split("\n").map((l) => l.trim().match(/^-\s*(.+?)\s*>>\s*(.+)$/))
    .filter(Boolean).map((x) => ({ front: x[1].trim(), back: x[2].trim() })).slice(0, 8);
}
function parseFormulas(md) {
  const fbody = secBody(md, "formulas");
  if (!fbody) return { formulas: [], algos: [] };
  const formulas = [], algos = [];
  let inAlgos = false;
  for (const ln0 of fbody.split("\n")) {
    const ln = ln0.trim();
    if (/^\**Algorithms/i.test(ln)) { inAlgos = true; continue; }
    if (/^\**Formulas/i.test(ln)) { inAlgos = false; continue; }
    const it = ln.match(/^(?:[A-Za-z]?\d+[.)]|\(\d+\)|[-*])\s+(.+)$/);
    if (!it) continue;
    const s = it[1].replace(/\*+/g, "").trim();
    if (s.length < 8) continue;
    if (inAlgos) algos.push(s.slice(0, 250));
    else if (/=|≤|≥|→|\+|O\(|`/.test(ln)) formulas.push(s.slice(0, 250));
    else algos.push(s.slice(0, 250));
  }
  return { formulas, algos };
}
function examHtml(ep) {
  const qs = (ep.questions || []).map((q) =>
    `<tr><td>${escH(q.q || "")}</td><td>${escH(String(q.marks ?? ""))}</td><td>${escH(q.topic || "")}</td><td>${escH(q.style || "")}</td></tr>`).join("");
  const w = (ep.weightage || []).map((x) => `<tr><td>${escH(x.topic || "")}</td><td>${escH(String(x.marks ?? "") + (x.pct ? " (" + x.pct + ")" : ""))}</td></tr>`).join("");
  const t = (ep.takeaways || []).map((x) => `<li>${escH(x)}</li>`).join("");
  const r = (ep.at_risk || []).map(escH).join(", ");
  return `<h2>Previous-Year Pattern (${escH(ep.paper || "exam")})</h2>` +
    `<div class="tbl-wrap"><table><thead><tr><th>Q</th><th>Marks</th><th>Topic</th><th>Style</th></tr></thead><tbody>${qs}</tbody></table></div>` +
    (w ? `<h3>Weightage</h3><div class="tbl-wrap"><table><thead><tr><th>Topic</th><th>Marks</th></tr></thead><tbody>${w}</tbody></table></div>` : "") +
    (t ? `<h3>Pattern takeaways</h3><ol>${t}</ol>` : "") +
    (r ? `<h3>At-risk</h3><p>${r}</p>` : "");
}
function cheatHtml(groups) {
  return `<h2>Cheat Sheet (print me — Ctrl/Cmd+P)</h2>` + groups.map((g) =>
    `<h3>${escH(g.lecture)}</h3><ul>${(g.items || []).map((i) => `<li>${escH(i)}</li>`).join("")}</ul>`).join("") +
    `<p class="no-print"><button class="btn" onclick="window.print()">Print cheat sheet</button></p>`;
}
export async function buildData(root, manifest, spec) {
  const cdir = path.join(root, ".dashy", "content");
  const mds = fs.readdirSync(cdir).filter((f) => /^L\d+.*\.md$/i.test(f) && !/^exam-/i.test(f)).sort();
  const lectures = [];
  const cheatGroups = [];
  for (const [li, f] of mds.entries()) {
    const lid = f.replace(".md", "");
    const md = fs.readFileSync(path.join(cdir, f), "utf8");
    const titleLn = (md.match(/^#\s+(.+)$/m) || ["", lid])[1].trim();
    const topics = [];
    for (const s of sections(md)) {
      if (s.lvl !== 3 || /^Q[1-4][a-d]?\b/i.test(s.title)) continue;
      topics.push({ id: slug(lid, s.title), name: s.title, ...topicFields(s.body) });
    }
    const { formulas, algos } = parseFormulas(md);
    const quizzes = parseQuizzes(md);
    const flashcards = parseFlashcards(md);
    // prereqs: first bullets/table rows of Prerequisites section
    const prereqs = [];
    const pbody = secBody(md, "prerequisites");
    if (pbody) for (const ln of pbody.split("\n")) {
      const s = ln.trim();
      const b = s.match(/^[-*]\s+(.+)$/) || s.match(/^\d+[.)]\s+(.+)$/);
      if (b) prereqs.push({ concept: b[1].slice(0, 80), refresher: b[1].slice(0, 300) });
      else if (s.startsWith("|") && !s.includes("---") && s.split("|").length >= 3) {
        const c = s.split("|").map((x) => x.trim()).filter(Boolean);
        if (c.length >= 2 && !/^concept/i.test(c[0])) prereqs.push({ concept: c[0].slice(0, 80), refresher: (c[1] || "").slice(0, 300) });
      }
      if (prereqs.length >= 5) break;
    }
    const lj = { lecture: lid, title: titleLn, prerequisites: prereqs, topics, formulas, algorithms: algos,
      self_check: quizzes.map((q) => ({ q: q.q, type: q.type, answer: q.answer, grading: q.grading,
        ...(q.type === "mcq" ? { options: q.options } : {}), ...(q.keywords?.length ? { keywords: q.keywords } : {}) })),
      source: `${lid}.pdf + content/${lid}.md` };
    fs.writeFileSync(path.join(cdir, `${lid}.json`), JSON.stringify(lj, null, 2));
    cheatGroups.push({ lecture: lid, items: [...formulas, ...algos].slice(0, 12) });
    lectures.push({ id: lid, title: titleLn, html: mdToHtml(md), text: plainText(md),
      topics: topics.map((t) => ({ id: t.id, name: t.name })), quizzes, flashcards });
  }
  let ep = { questions: [], weightage: [], takeaways: [], at_risk: [] };
  try { ep = JSON.parse(fs.readFileSync(path.join(cdir, "exam-pattern.json"), "utf8")); } catch {}
  // media.js from media-map.json + diagram files
  let mm = { images: {}, videos: {} };
  try { mm = JSON.parse(fs.readFileSync(path.join(root, ".dashy", "media-map.json"), "utf8")); } catch {}
  // normalize to golden short keys: images {f, c}, videos {id, t, ch} (originals kept)
  const normImages = {};
  for (const [k, arr] of Object.entries(mm.images || {})) {
    normImages[k] = (arr || []).map((x) => ({ f: x.file || x.f, c: x.caption || x.c, ...x }));
  }
  const normVideos = {};
  // agent emits videos as an ARRAY with .topic fields (ACI hand format was a map — accept both)
  const vlist = Array.isArray(mm.videos) ? mm.videos
    : Object.entries(mm.videos || {}).map(([k, v]) => ({ ...(v || {}), _k: k }));
  for (const v of vlist) {
    const key = v.topic || v._k;
    if (!key || !(v.videoId || v.id)) continue;
    normVideos[key] = { id: v.videoId || v.id, t: v.title || v.t, ch: v.channel || v.ch, ...v };
  }
  const dimg = path.join(root, "dist", "assets", "diagrams");
  const mediaFiles = fs.existsSync(dimg) ? fs.readdirSync(dimg).filter((f) => f.endsWith(".png")).sort() : [];
  const newDiagrams = mediaFiles.map((f) => {
    const m = f.match(/^(L\d+)-.*?(\d{2,3})\.png$/);
    return { file: f, lecture: m ? m[1] : "UNK", kind: "page-render",
      caption: m ? `${m[1]} p.${+m[2]} (PDF screenshot)` : f };
  });
  const mediaJs = "window.ACI_MEDIA = " + JSON.stringify({ images: normImages, videos: normVideos, newDiagrams }, null, 0) + ";";
  const dataJs = "window.ACI_DATA = " + JSON.stringify({ lectures,
    examPatternHtml: examHtml(ep), cheatSheetHtml: cheatHtml(cheatGroups) }, null, 0) + ";";
  const dist = path.join(root, "dist");
  fs.mkdirSync(dist, { recursive: true });
  fs.mkdirSync(path.join(dist, "assets", "diagrams"), { recursive: true });
  fs.writeFileSync(path.join(dist, "app-data.js"), dataJs);
  fs.writeFileSync(path.join(dist, "media.js"), mediaJs);
  return { lectures: lectures.length, quizzes: lectures.reduce((a, l) => a + l.quizzes.length, 0) };
}
