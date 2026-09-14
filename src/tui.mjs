// dashy interactive TUI — Claude-Code-style: no memorization.
// Bare `dashy` lands here: arrow-key menu, slash-command palette, streaming logs.
import * as p from "@clack/prompts";
import { scan } from "./scan.mjs";
import { preflight } from "./preflight.mjs";
import { loadState, saveState } from "./state.mjs";

export const SLASH = [
  { v: "/init", h: "guided setup wizard for this folder" },
  { v: "/bootstrap", h: "auto-install opencode + Wispr check" },
  { v: "/scan", h: "list PDFs, handout + paper candidates" },
  { v: "/build", h: "full pipeline S0–S10" },
  { v: "/serve", h: "serve the built dashboard over http" },
  { v: "/status", h: "stage ledger + artifact counts" },
  { v: "/add-features", h: "append free-text extra features to the spec" },
  { v: "/resume", h: "resume an interrupted build" },
  { v: "/ask", h: "ask the local RAG index a question (no LLM)" },
  { v: "/help", h: "show everything this tool can do" },
];
export async function slashPalette() {
  const pick = await p.select({
    message: "dashy — pick a command (everything is also typed as /…)",
    options: SLASH.map((s) => ({ value: s.v, label: s.v, hint: s.h })),
  });
  return pick;
}
export async function wizard(root) {
  p.intro("dashy init — study dashboard builder");
  const man = await scan(root);
  man.docs = (man.otherDocs || []).filter((f) => /\.(docx?|txt|md)$/i.test(f));
  if (!man.pdfs.length && !man.docs.length) { p.log.error("No PDFs, slides, or readable docs in " + root); return null; }
  if (man.pdfs.length) p.log.success(man.pdfs.map((x) => `${x.file} (${x.pages ?? "?"}p)`).join("\n"));
  else p.log.warn("No PDFs — handout-only mode: a single Course Overview lecture will be built from the docs below.");
  if (man.paperCandidates.length && !man.pdfs.some((x) => man.paperCandidates.includes(x.file))) {
    p.log.info("Filename-guessed question papers (unconfirmed): " + man.paperCandidates.join(", "));
  }
  const handout = man.handoutCandidates.length
    ? await p.multiselect({ message: "Course handout for context (optional)", options: man.handoutCandidates.map((f) => ({ value: f, label: f })) })
    : [];
  const papers = man.paperCandidates.length
    ? await p.multiselect({ message: "Question papers — confirm which are real papers (Enter to skip, candidates are filename guesses only)", options: man.paperCandidates.map((f) => ({ value: f, label: f })) })
    : [];
  const extra = await p.text({ message: "Additional features you want (free text, Enter to skip)", placeholder: "e.g. light theme default, harder quizzes, no videos" });
  const pre = await preflight();
  const modelLine = "model: " + pre.model + (pre.ok ? "" : "  ← FIX NEEDED");
  p.log.info(modelLine);
  const go = await p.confirm({ message: "Build the dashboard now?", initialValue: true });
  if (!go || p.isCancel(go)) { p.outro("Saved. Run `dashy` again anytime."); return null; }
  const st = loadState(root);
  st.spec = { handout, papers, extra: extra || "" };
  saveState(root, st);
  return { handout, papers, extra };
}
export async function mainMenu() {
  return p.select({
    message: "dashy — what next?",
    options: [
      { value: "build", label: "Build dashboard", hint: "full S0–S10 pipeline" },
      { value: "bootstrap", label: "Bootstrap", hint: "install opencode + Wispr check" },
      { value: "serve", label: "Serve dashboard", hint: "http://localhost for videos" },
      { value: "status", label: "Status", hint: "ledger + artifacts" },
      { value: "add", label: "Add features", hint: "free-text spec patch" },
      { value: "exit", label: "Exit" },
    ],
  });
}
