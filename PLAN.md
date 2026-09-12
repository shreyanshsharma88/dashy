# dashy — PLAN.md
> Goal: a CLI tool that reproduces the ACI study dashboard (see Part A audit) for ANY subject folder, with identical features, driven by locally-running opencode (muse spark 1.3 free) + parallel subagents.
> Status: v0.1.0 SCAFFOLD BUILT (2026-09-12) — CLI + TUI menu + S0–S4/S7–S10 deterministic stages + opencode runner + TF-IDF RAG + golden template, smoke-tested (scan/extract/ask green on fixture). S5/S6 LLM stages + S9 fixing-agent loop are implemented but not yet run end-to-end (needs quota + time).

---

# PART A — Audit trail: what was actually built (ACI dashboard)

## A0. Session chronology (every user ask → what shipped)
1. "See what the previous session was doing?" → inspected `dashboard/PLAN.md` (exam analysis Q1–Q4 + L1–L7 audit + JSON data model + 10 dashboard requirements + build order).
2. "Continue where the last session went off (lecture-wise MDs + PLAN refs)" → authored `content/L1.md`–`L7.md` (2,424 lines, PDF + YT-query + exam refs, no invented URLs/numbers) via 7 parallel agents; updated `PLAN.md` to reference them.
3. "Go ahead, build this now" → generated `content/*.json` + `app-data.js` (build script), then `index.html` + `styles.css` + `app.js` (sidebar, studied persistence, search, quizzes, flashcards, cheat sheet, pattern page).
4. "Did you integrate everything from plan.md? Verify + how to run" → honest gap report (0 PNGs, slim JSONs, no numerical types, L7 no MCQ) with evidence.
5. "Close the remaining gaps; cover EVERY minor topic; fill + verify" → 3-agent PDF-vs-MD audit found 8 gaps (L1 andragogy, L3 traversal-vs-strategy, L4 pattern-DB/reference-paper/local-search bridge, L5 feasible-neighbour-optimal triad, L6 tournament/rank+spin & TSP framing, L7 Module-A/B mapping) — all filled; 81 PNGs extracted; full JSON schema; numerical quiz types + L7 MCQ.
6. "UI/UX OVERHAUL, presentation-layer only, L1 first" → rewrote shell/styles/app (details below); data files byte-identical (md5-verified).
7. "Change font families + keyword color/underline/bold for all lectures" → bundled Source Serif 4 + JetBrains Mono locally; keyword highlighter (33–49 terms/lecture).
8. "No images/iframes visible — fix; 2 agents (images + YouTube)" → image agent mapped PNGs + flagged 40 gap topics; video agent found 20 videos (all oEmbed-verified); rendered 80 more screenshots (161 total); inline figures + embeds per topic.
9. "Fix YT error (Error 153 screenshot) + bottom-right reference-PDF window synced to scroll" → diagnosed file:// origin; nocookie host + localhost guidance banner; 300px resizable PDF window with scrollspy page-sync.
10. "YT still errors — try running on http" → started persistent `python3 -m http.server 8000` on ACI dir; probed embed pages; updated banner to point at live `http://localhost:8000/dashboard/`.
11. "Resize drag on top-left, not just bottom-right" → custom top-left grip added (native handle kept).
12. "Voice mode? Have Wispr Flow — integrate?" → corrected scope (Wispr = STT, works in all text fields with zero code); built offline Web Speech API read-aloud with voices/rate/follow-highlight.
13. "Autocomplete search on voice mode + highlight spoken text" → find-and-speak box + word karaoke.
14. "Spoken highlight not working + keep spoken words highlighted" → timer-fallback highlight (boundary-independent) + persistent spoken trail + ttsFinish (keeps trail at Done).

## A1. Final product inventory (exact)
```
dashboard/
  index.html        3.0K  shell: topbar, search, sidebar, TOC, dots, timer, pdfwin, keys popover
  styles.css         17K  3 themes, serif/mono fonts, cards, TOC, gallery, print, responsive
  app.js             51K  70+ functions, all features below, no framework, no fetch/CDN
  media.js           14K  per-topic image map (90 assignments) + 20 verified videos + 80 gallery entries
  app-data.js       473K  7 lectures: 109 topics, 43 quizzes, 39 flashcards (generated, file://-safe)
  content/          L1.md–L7.md (2,433 lines) + L1.json–L7.json (full schema) + exam-pattern.json + cheat-sheet.json
  assets/diagrams/  161 PNGs (32 cited page-renders + 49 embedded figs + 80 gap screenshots)
  assets/fonts/     6 woff2 (Source Serif 4 400/600/700/italic + JetBrains Mono 400/700), ~470KB
  PLAN.md           40K   original subject plan
```
- Content stats: 7 lectures · 109 structured topics · 43 self-check Qs (mcq/short/numerical) · 39 flashcards · 20 YouTube embeds · 161 diagrams · 2,433 MD lines.
- Quiz split has ≥1 numerical where PDFs/paper compute (UCS trace, Y/N check, H1/H2, GA fitness, TSP probs, BLEU); theory-only lectures (L1) left as-is per user rule.
- Diagrams: page-renders captioned with exact PDF pages; embedded figs captioned "verify against PDF".
- Videos: every ID live-verified via YouTube oEmbed (existence + title match); 5 topics honestly skipped, no mediocre fills.

## A2. Feature spec (nothing omitted)
**Reading layout:** centered 700px column (900px for wide pages); 18px Source Serif 4, 1.7–1.8 line-height, 24–32px block gaps, 48–64px section gaps; off-white `#e8e8e6` on `#1a1a1a`; Focus Mode (⛶/F, hides sidebar, persists `zg557.focus.v1`); long bullet lists auto-softened to prose spacing (DOM-level, data untouched).
**Navigation:** sticky right-edge TOC with scrollspy; top scroll-progress bar; corner dots + breadcrumb (always visible incl. Focus); keys ←/→ lectures, F focus, / search, ? hint popover, Esc closes.
**Content hierarchy:** formula boxes (accent-edged monospace cards), worked-example cards (amber tint), centered figures with italic captions, per-topic collapsible sections (expanded default, state in `zg557.collapsed.v1`), Sources tucked in collapsed `<details>`.
**Learn:** session home (Resume via `zg557.last.v1` + weak-due count + quiet streak `zg557.streak.v1`); Review Queue page (Weak first, Strong collapsed); per-lecture + global flashcards (lecture/Weak-only filters, shuffle); inline sticky notes per topic (`zg557.notes.v1`); reading-time mins (`words/200`) in sidebar; Pomodoro 25/5–50/10 widget pinned top-right; smart search (highlighted snippets → topic anchors); A−/A+/LH controls (`zg557.type.v1`); dark/sepia/light themes (`zg557.theme.v1`); studied checkboxes + progress (`zg557.studied.v1`, scores `zg557.scores.v1`, marks `zg557.marks.v1`).
**Media:** per-topic inline PDF figures; 20 YouTube iframes (nocookie host, lazy, title/channel/watch-link); file:// Error-153 banner with localhost command; Diagrams gallery (161, filters); reference-PDF mini-window (300px, resizable incl. custom top-left grip, scrollspy page-sync via image filenames → text citations → hold, size/open persisted `zg557.pdfwin.v1`, `../Lx.pdf#page=N` so file:// AND localhost both work).
**Voice:** offline read-aloud (play/pause/stop, rate, voice picker persisted `zg557.tts.v1`, Safari+Enhanced-voice tip); find-and-speak autocomplete (↑/↓/Enter/Esc); word karaoke (boundary events + 160wpm timer fallback); spoken-word trail kept to Done; markup restored on stop/route change. Wispr Flow: zero integration needed — dictates into search/quiz/notes natively.
**Hygiene:** print CSS, ≤800px/≤1000px breakpoints, `?` shortcuts, zero `fetch`/CDN (fully offline except YouTube iframes), no invented links/numbers (TODO-verify pattern), graceful fallbacks (PDF open-direct link, video watch links, empty states).

---

# PART B — Multistep plan to build the dashy CLI

## B0. Vision & non-negotiables
- `dashy` runs in any folder of PDFs → emits an identical-feature dashboard (all of Part A) named after the subject.
- Local-first: RAG DB on disk (SQLite), no cloud except YouTube embeds + model calls through local opencode.
- Every stage idempotent, verified by gates; any failure auto-resumes (see B5).

## B1. Tech stack (recommended)
| Layer | Choice | Why (+ fallback) |
|---|---|---|
| Runtime | **Node.js 20+** | Same runtime as opencode; single toolchain. Fallback: system node via `fnm` auto-install |
| Platform | **macOS/Linux + Windows** (`src/platform.mjs`) | All external tools resolved per-OS (PATH + well-known install dirs); `Scripts\` vs `bin/` venv layout; `py -3` launcher; winget/choco hints; POSIX paths byte-identical |
| CLI framework | **Ink (React-for-CLI) full-screen TUI** + `commander` + `@clack/prompts` | Claude-Code-like interactive UI (B2.5); slash commands mean zero memorization. Fallback: @clack wizard without Ink |
| Local agent engine | **`opencode run` (headless)**, model `opencode/muse-spark-1.3-contributor-free` | Exact engine requested. Preflight: `opencode --version`; if missing → install (`curl -fsSL https://opencode.ai/install \| bash`, verify, fallback: npm `opencode-ai`), then `opencode auth login` check with guided setup |
| PDF extraction | `pdftotext -layout` / `pdfimages` / `pdftoppm` (poppler) | Byte-faithful, same as ACI build. Fallback: `pdfjs` node lib; if poppler missing → `brew/apt install poppler` prompt |
| Embeddings/RAG | `sqlite-vec` + `@xenova/transformers` (all-MiniLM-L6-v2, local) | Zero-server vector search on disk. Fallback: TF-IDF/keyword index if model download fails (offline) |
| Dashboard output | **Golden template** snapshotted from ACI `index.html/styles.css/app.js` with content-agnostic renderer (`app-data.js` + `media.js` generated per subject) | Guarantees feature parity by construction |
| Fonts/diagrams | Reuse ACI `assets/fonts`; per-subject `assets/diagrams` via poppler | No refetching |
| Serve | `python3 -m http.server` or `npx serve` (dashboard needs http for YouTube) | Same fix as A0-10 |
| Web search | opencode websearch + YouTube oEmbed verify + image downloader (license-filtered) | S6b enrichment; no invented URLs, no hotlinking |

## B2. CLI UX + user journey
Commands: `dashy init` (wizard) · `dashy bootstrap [--yes]` (auto-install opencode, auth/model check, Wispr detection) · `dashy scan` · `dashy build [--resume]` · `dashy rebuild` (deterministic S7+S8+S9 only, no LLM redo) · `dashy serve [--port]` (auto-bumps if busy) · `dashy status` · `dashy add-features "..."` (free-text field appended to build spec).
First-run journey:
1. `$ dashy init` → banner → checks: node ✓, poppler ✗→install offer, opencode ✗→install+auth, Wispr ✗→"Install Wispr Flow first or voice-dictation fields won't have STT (read-aloud still works)" [warn, continue] .
2. Scan `./` for PDFs → list found → ask: course handout? (optional file; skip allowed → proceeds with reduced context, flagged `confidence: limited`) → question papers? (optional; skip allowed → exam-pattern page becomes "syllabus-inferred", quizzes still built from PDFs) → **free-text "additional features" field** (appended verbatim to build spec + parsed for known toggles) → confirm plan → build.
3. Build streams stage progress (spinners + per-agent status); failures show retry/resume options, never a dead end.
4. Done → `dashy serve` prints `http://localhost:<port>/<subject>/`; state saved for rebuilds.

## B2.5 Interactive TUI — Claude-Code-like, no memorization (REQUIRED)
- Bare `dashy` (no args) launches the full-screen interactive UI; classic commands still exist as **slash commands** (`/init /scan /build /serve /status /add-features /resume /ask /help`) with fuzzy autocomplete as you type — users discover everything, memorize nothing.
- Layout: header (subject + stage + model badge) · left conversation pane (streaming agent output, markdown-ish rendering) · right status rail (stage checklist S0–S10, subagent roster with live states, RAG stats, token/context meter) · bottom input box (multiline, history via ↑/↓).
- Natural-language routing: free text ("make quiz harder", "use light theme default", the B4 extra-features field) is classified into pipeline actions or spec patches, echoed back as a confirmable diff before applying.
- Attractive + cool: gradient header, spinners + progress bars per agent, success/failure glyphs, syntax-tinted code blocks, calm color scheme matching the dashboard themes; respects NO_COLOR + light terminals.
- Keyboard: Tab completes slash commands and `@file` mentions (attach PDFs/handout by picking, not typing paths), Esc cancels a running stage, Ctrl+C double-press exits; `?` overlay lists everything.
- Every TUI action maps 1:1 to a CLI command (shown faintly beside results) so scriptability is never lost.

## B3. Pipeline stages (each = gated step)
- **S0 preflight:** versions, poppler, opencode+auth+model availability (`muse-spark-1.3-free` resolvable, else list models and pin user choice), Wispr advisory, disk space.
- **S1 scan:** inventory PDFs (pages via `pdfinfo`), handout (.pdf/.doc/.txt), question papers; write `dashy.manifest.json`.
- **S1 scan:** inventory PDFs (pages via `pdfinfo`), handout + question-paper candidates. Handout-only folders are VALID: `.docx` (python-docx), `.doc` (soffice→txt), `.txt`/`.md` (copied) become `manifest.docs`; build refuses only when zero PDFs/slides AND zero docs exist.
- **S2 extract:** `pdftotext -layout` dumps (+ `textutil` for .doc), `pdfimages` + `pdftoppm` renders; record line counts (audit parity with ACI: L1:482 etc. pattern). Slide decks (`.ppt`/`.pptx`, detected as `kind: "slides"`) are FIRST converted to PDF via `soffice --headless --convert-to pdf` into a separate `<root>/pdf/` folder, then flow through the identical PDF pipeline (speaker notes, lost in conversion, are appended from python-pptx; python path is the fallback if LibreOffice is missing). Verified end-to-end on a 2-slide fixture (convert → `pdf/bio.pdf` → text+notes+images → RAG ask green). python-pptx resolves via `DASHY_PY` → `~/.dashy-tools` venv (auto-bootstrapped with pip on first need) → system python. Docs loop emits `.dashy/txt/doc-<stem>.txt` (handout-only fixture: 6 lines incl. tables, RAG ask green).
- **S3 RAG index:** chunk (500–800 chars, 15% overlap, keep page numbers) → MiniLM embeddings → `rag.db` (sqlite-vec); TF-IDF fallback index; CLI `dashy ask "…"` for debugging.
- **S4 exam analysis (subagent: analyst):** parse question papers → `exam-pattern.json` (questions/marks/styles/weightage/takeaways/at-risk). Wizard handout filenames are resolved to extracted text (not used literally). If no papers: syllabus-inferred pattern, flagged.
- **S5 lecture MDs (N parallel subagents: authors, one per PDF):** same schema as ACI; handout-only mode (zero lecture PDFs) builds a single `L1.md` Course Overview from handout text instead of failing.
- **S5 lecture MDs (N parallel subagents: authors, one per PDF):** same schema as ACI (`###` topics, plain_explanation, formula_box, worked steps, diagram_asset, video TODO-query, exam_note, confidence); cross-lecture prereq pass; coverage audit agent diffs PDF dumps vs MDs (the 8-gap pattern) and loops until zero gaps.
- **S5b formula rule (mandatory when the subject has formulas):** S2 measures formula density (count `=`, `≤/≥/→`, numbered equations per PDF). If density is non-trivial: every formula-bearing topic MUST emit a `formula_box` + at least one worked numerical example with all intermediate steps, quizzes MUST include `numerical`-type Qs wherever the PDFs/papers compute anything, and `cheat-sheet.json` MUST carry a per-lecture formula sheet. Theory-only lectures are explicitly left without numericals (ACI L1 precedent) — but the author must state that, never fake them. No formula subject ships without its sheets + numericals.
- **S6 media agents (parallel):** image-mapper (view renders, map 0–3 PNGs/topic, gap pages → render more) + video-hunter (websearch, oEmbed-verify IDs, skip-don't-fill) → `media.js` inputs.
- **S6b web enrichment (parallel agents, PDFs stay the source of truth):** (i) context-enricher — websearch per major topic for clearer explanations/examples, merged into MDs ONLY as clearly-labeled `external` blocks (never mixed with sourced content, `confidence: external`); (ii) video-hunter scale-up — ≥1 oEmbed-verified YouTube embed per major topic (nocookie host, lazy, watch-link fallback); (iii) web-image curator — openly-licensed/diagram-type images (Wikimedia, official docs) that explain better than PDF shots; every image DOWNLOADED into `assets/diagrams/` (never hotlinked — offline guarantee), renamed per-topic, deduplicated, size-capped; license + source URL recorded in a manifest. Priority per topic: PDF figure first, then curated web image, then labeled gap. All external claims carry TODO-verify until the S9a media auditor passes them.
- **S7 data build (deterministic script, no LLM):** MDs → `app-data.js` + full-schema `Lx.json` + cheat/exam JSONs (port of `/tmp/build_dashboard.py`).
- **S8 UI assemble:** copy golden template (`index.html/styles.css/app.js/fonts`) + generated data + diagrams → `dist/`. PDFs (originals + converted) are copied to `dist/pdf/` — the PDF window loads `pdf/<stem>.pdf`, so it works over http AND file://. Raw Self-check/Flashcards MD sections are hidden in reading view when quiz/flashcard widgets exist (no raw `*Answer:*` walls).
- **S9 AUDIT LOOP (blocking — runs after every build, loops until clean):**
  - **S9a audit agents (parallel, read-only, each with a rubric):** (i) coverage auditor — every PDF line-item vs MDs, zero missing minor topics; (ii) formula auditor — S5b compliance (sheets + numericals where formulas exist, none faked where absent); (iii) media auditor — every topic has ≥1 figure or a recorded gap render, every video ID oEmbed-verified, no dead assets, media-heading match rate 100% (normalized matching tolerates punctuation); (iv) quiz auditor — 5–8 Qs/lecture, MCQ+short+numerical mix where applicable, answers + grading rules present; (v) integrity auditor — JS syntax, checksums vs sources, http smoke test (port + PDF 200s + diagram 200 + `dist/pdf/` shipped), no invented URLs/numbers. Each emits PASS or a defects list with file+line pointers.
  - **S9b fixing agents:** every defect spawns a scoped fixing agent (owns only its files, must re-verify its own fix). Fixes re-run the owning pipeline stage deterministically where possible (S7 rebuild, re-render).
  - **Loop:** S9a re-audits after every fix round; repeat until ALL auditors return PASS (max 5 rounds — then pause with the residual defects + exact resume command, never ship red). All rounds appended to the ledger.
- **S10 serve + handoff:** print URL + `dashy.status.json` (what/where/version for future sessions).

## B4. Extra-features text field
- Wizard prompt + `dashy add-features` merge wdyt into spec; known toggles auto-detected (e.g. "flashcards off", "light theme default"); unknown text passed verbatim into S5/S8 agent prompts; listed in final report as applied/unapplied with reasons.

## B5. Session/error fallbacks (required)
- **Ledger:** `.dashy/state.json` (stage, session IDs, artifact hashes) after every stage; reruns skip completed stages.
- **Heartbeat:** wrapper pings every 30s; 3 missed → stage marked interrupted → resume.
- **Error classes:** transient (retry ×3 backoff) · model/context-limit (compress: summarize MDs+ledger into `context-brief.md`, start NEW opencode session with brief + state, continue) · auth/missing-binary (pause with exact fix command) · verification-fail (route back to owning stage).
- **Context handoff:** `opencode run --session <id>` resume when supported; else fresh `opencode run` bootstrapped with `context-brief.md` + manifest + ledger (never raw-dump everything).
- **Deterministic stages (S2/S3/S7/S9) rerun without LLM** whenever possible.

## B6. Acceptance criteria (ship gate)
Parity matrix vs Part A — EVERY item below must work, verified by scripted checks + one fresh-subject run:
reading column (700px/serif/1.75) · Focus Mode · TOC+scrollspy · scroll progress · dots+breadcrumb · ←/→/F///? keys · formula/worked cards · prose lists · collapsible topics · search snippets→anchors · Weak/Strong + Review Queue · per-lecture + global flashcards (filters/shuffle) · notes · reading times · Pomodoro top-right · 3 themes · A−/A+/LH · bundled reading fonts (serif body + mono code, local woff2) · keyword color/underline/bold system · session home (resume/weak-due/streak) · auto-graded quizzes (MCQ/short/numerical + scores) · sidebar (studied + weak list) · metadata-free reading view (no TODO/provenance leakage, wrap guards) · studied progress (12 persisted keys total) · cheat sheet + print · pattern page · 161-class diagram pipeline + gallery + inline figures (PDF-first, curated web images downloaded locally second) · web-enriched topic explanations (labeled `external`, never mixed with sourced) · ≥1 oEmbed-verified video per major topic (or recorded skip) + nocookie + Error-153 banner + localhost serve · PDF window (resize grips, scrollsync) · TTS (voices/rate/find-and-speak/karaoke+trail) · responsive breakpoints · offline-except-iframes · S5b formula-sheet/numerical compliance · clean S9 audit loop (all 5 auditors PASS).
Plus: `dashy build` green on a fresh 3-PDF fixture + resume-from-kill test passes + TUI smoke test (slash palette, streaming, natural-language spec patch).

## B7. Risks
Model availability/quotas (pin + fallback model prompt) · poppler missing (guided install) · LibreOffice missing (python-pptx fallback, no page renders) · huge PDFs (page-cap + chunking) · YouTube embedding disabled (oEmbed+skip) · web-image licensing (Wikimedia/docs-first, local download, manifest) · file:// Error 153 (serve by default; banner kept) · Safari boundary gaps (timer fallback already in template).
