import fs from "node:fs";
import path from "node:path";
import { runOpencode } from "../src/opencode.mjs";

const root = "data";
const model = "opencode/muse-spark-1.2-contributor-free";
const stems = process.argv.slice(2).length ? process.argv.slice(2) : ["L1", "L2", "L3"];

const SHAPE = `Use EXACTLY this markdown shape:
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
MCQ format (mandatory for every [MCQ]): put each option on its own line as "- A. <text>" / "- B. <text>" / "- C. <text>" / "- D. <text>", then "*Answer:* <exact option text>".
## Flashcards
Lines shaped "- <front>? >> <back>" (4-6 cards: term/formula front, definition+one-line usage back).`;

for (const stem of stems) {
  const dump = fs.readFileSync(path.join(root, ".dashy", "txt", stem + ".txt"), "utf8");
  const prompt = `Write a study file for lecture ${stem} (source: ${stem}.pdf, ${dump.length} chars of slide text below).
If the slides contain no formulas/numericals, leave those parts out (do not invent).
${SHAPE}
IMPORTANT: write the FULL markdown file as your reply (start with "# "). Do NOT reply with a 3-line summary — the file content IS the reply.
SLIDE TEXT:\n${dump.slice(0, 14000)}`;
  console.log(`--- ${stem}: calling ${model} ---`);
  const r = await runOpencode("opencode", { model, dir: root, prompt, timeoutMs: 420000 });
  if (!r.ok) { console.error(`${stem} FAILED:`, r.error.slice(0, 300)); continue; }
  console.log(`${stem}: got ${r.out.length} chars`);
  const md = r.out.includes("# ") ? r.out.slice(r.out.indexOf("# ")) : r.out;
  if (md.split("\n").length < 20 || !md.includes("## Topics")) {
    console.error(`${stem} output looks like a summary, NOT a study file. First 400 chars:\n` + md.slice(0, 400));
    continue;
  }
  fs.writeFileSync(path.join(root, ".dashy", "content", stem + ".md"), md);
  fs.writeFileSync(path.join(root, stem + ".md"), md);
  console.log(`${stem}: wrote ${md.split("\n").length} lines`);
}
