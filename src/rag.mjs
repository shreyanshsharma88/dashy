// S3 retrieval: BM25 over topic-chunked texts (zero-dep, offline) + JSON sqlite stub.
// Vector embeddings (MiniLM) hook: if @xenova/transformers is installed later,
// semantic() upgrades to hybrid BM25+vector; until then keyword BM25 (proven on ACI).
import fs from "node:fs";
import path from "node:path";

const STOP = new Set("a,an,the,and,or,of,to,in,on,for,with,from,that,this,these,those,into,over,under,between,each,which,what,when,where,while,than,then,them,they,your,you,are,was,were,been,being,have,has,had,does,did,will,would,should,could,there,their,about,after,before,such,other,more,most,some,only,also,very,just,both,give,given,using,used,states,gives,how,why,can,all,any,its".split(","));
export function toks(s) {
  return (s || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));
}
export function chunkTopics(text, cap = 1500) {
  // split markdown-ish dumps on ### headings; fallback: fixed windows
  const parts = String(text || "").split(/^###\s+/m);
  if (parts.length > 2) {
    return parts.slice(1).map((p) => {
      const nl = p.indexOf("\n");
      return { title: p.slice(0, nl).trim(), text: p.slice(0, cap) };
    }).filter((c) => c.text.length > 40);
  }
  const out = [], t = String(text || "");
  for (let i = 0; i < t.length; i += 700) out.push({ title: "chunk " + (i / 700 + 1), text: t.slice(i, i + 850) });
  return out;
}
export function buildIndex(docs) {
  // docs: [{id, lecture, title, text}]
  const N = docs.length || 1, df = {}, lens = [];
  docs.forEach((d) => {
    const ts = toks(d.title + "\n" + d.text);
    lens.push(ts.length || 1);
    new Set(ts).forEach((t) => { df[t] = (df[t] || 0) + 1; });
  });
  const avg = lens.reduce((a, b) => a + b, 0) / N;
  return { docs, N, df, lens, avg };
}
export function search(idx, query, topK = 4, lecture = null) {
  const qs = toks(query);
  if (!qs.length) return [];
  const out = [];
  idx.docs.forEach((d, i) => {
    if (lecture && d.lecture !== lecture) return;
    const tf = {};
    toks(d.title + "\n" + d.text).forEach((t) => { tf[t] = (tf[t] || 0) + 1; });
    let s = 0, overlap = 0;
    qs.forEach((q) => {
      if (!tf[q]) return;
      overlap++;
      const idf = Math.log(1 + (idx.N - (idx.df[q] || 0) + 0.5) / ((idx.df[q] || 0) + 0.5));
      s += (idf * tf[q] * 2.2) / (tf[q] + 1.2 * (1 - 0.75 + (0.75 * idx.lens[i]) / idx.avg));
    });
    if (s > 0) out.push({ doc: d, score: s, overlap });
  });
  return out.sort((a, b) => b.score - a.score).slice(0, topK);
}
export function indexFromDashy(root) {
  // builds index from .dashy/txt dumps
  const dir = path.join(root, ".dashy", "txt");
  const docs = [];
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith(".txt")).sort(); } catch { return buildIndex([]); }
  files.forEach((f, li) => {
    const text = fs.readFileSync(path.join(dir, f), "utf8");
    chunkTopics(text).forEach((c, k) => docs.push({ id: `L${li + 1}-chunk-${k}`, lecture: `L${li + 1}`, title: c.title, text: c.text }));
  });
  return buildIndex(docs);
}
