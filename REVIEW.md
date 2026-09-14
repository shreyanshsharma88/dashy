# dashy — Code Review (end to end)

Scope: `src/*.mjs` (14 modules), `golden/` template (`app.js`, `index.html`, `styles.css`),
`tools/*.py`, `bin/dashy`, `package.json`. No tests, CI, or lint exist in the repo.
Date: 2026-09-14. Severity: **P0** = wrong output / broken builds · **P1** = functional bug ·
**P2** = robustness/compat · **P3** = debt/nits.

> The reported TTS bug ("pause/stop don't stop it, must refresh") is **P1-1** below.
> It is diagnosed in §2 and **fixed in `golden/app.js`** (this review's companion change).

---

## 1. Bug list

### P0 — build correctness

- **P0-1 Fresh builds ship an empty Diagrams gallery.** `buildData` (`src/databuild.mjs:237-243`)
  reads the image list from `dist/assets/diagrams/`, but on a fresh build `dist/` has no
  images yet — `assemble()` (`src/cli.mjs:32-68`) copies them **after** S7 runs
  (`doBuild`, `src/cli.mjs:90-98`). So `media.js:newDiagrams` is `[]`, nav shows
  "Diagrams (0)", per-lecture "Diagrams (0)". Only a later `rebuild` (which reuses the
  previous `dist/`) populates it. Fix: build the gallery list from `.dashy/img/` in
  `buildData`, or run image-copy before S7. (Related: `mediaFiles` only matches `.png`,
  `databuild.mjs:238`, while `assemble` also ships `.jpg`.)
- **P0-2 Lecture PDFs misclassified as question papers are silently dropped.**
  S4/S5 merge *unconfirmed* filename guesses into the paper set
  (`src/stages.mjs:148`: `[...spec.papers, ...manifest.paperCandidates]`; S5 excludes
  them at `stages.mjs:177`). `QP_RX` (`src/scan.mjs:18`) matches any filename containing
  `test` (`latest.pdf`, `contest.pdf`, `attested.pdf`…). A lecture PDF with such a name
  never gets an `Lx.md`/lecture page and is instead fed to exam analysis. Fix: only
  treat user-confirmed `spec.papers` as papers; keep candidates as suggestions.
- **P0-3 PPTX-fallback images are written where the pipeline never looks.**
  The python-pptx fallback passes `path.join(out, stem)` as the image prefix
  (`src/extract.mjs:147-148`), so `*-imgN.*` land in `.dashy/txt/`, but S6/assemble
  only scan `.dashy/img/`. On LibreOffice-less machines PPTX figures are extracted and
  then ignored (and `report.images` undercounts). Fix: prefix with `path.join(img, stem)`.
- **P0-4 `verify()` fails builds that honestly have zero videos.**
  `src/verify.mjs:35-37` requires `ids.length > 0`. The S6 contract says
  "skip rather than fill mediocrity", so a subject with no good videos can never pass
  S9 and burns 5 fixing-agent rounds for nothing. Demote to advisory.
- **P0-5 Golden template ships hardcoded ACI-subject content for every subject.**
  `renderHome` hardcodes the at-risk line-up (`golden/app.js:455`: "4 AI perspectives ·
  risks · agent types · BFS/DFS/IDS · … CS#8 … PSO (external)"), the file:// banner
  hardcodes `/Users/s4dge/Downloads/study/S2/ACI` + `http://localhost:8000/dashboard/`
  (`app.js:771-778`), brand/title are `ZG557` (`index.html:6,12`, `app.js:867,873,876`),
  copy says "all 7 lectures" (`app.js:397`), search even splits on `ρ`
  (`app.js:797`). Every non-ACI build shows wrong subject facts on Home. Fix: parameterize
  at S8 assemble time (subject id, home stats, banner paths) or drop the hardcoded bits.

### P1 — functional bugs

- **P1-1 TTS pause/stop can't stop playback on some pages (reported).** See §2. Fixed.
- **P1-2 "Diagrams (N)" lecture button does nothing.** The button (`app.js:760`) and the
  `<details>` (`app.js:346`, via `diagBlock`) share `id="lec-diags"`. `getElementById`
  returns the button, so the handler toggles `.open` on a `<button>` (noop) instead of
  the details element. Fix: distinct ids.
- **P1-3 S0 forgets the resolved opencode binary.** `preflight` returns `{model, bin}`
  but `markStage(root,"S0","done",{model})` (`stages.mjs:120`) drops `bin`, so
  `auditLoop` falls back to bare `"opencode"` (`cli.mjs:93,138`). If opencode was found
  via full path (`~/.opencode/bin/opencode`, not on PATH), every S9 fixing-agent call
  fails. Fix: persist `bin`.
- **P1-4 MCQ options are usually empty.** The S5 prompt never specifies an option format
  (`stages.mjs:219-221`) and `parseQuizzes` only accepts `- `/`* ` bullet options
  (`databuild.mjs:128-129`). Agents emitting `A. …` / `(a) …` / inline options produce
  MCQs with zero radio buttons. Verify counts questions, not options, so it passes.
  Fix: specify the option format in the prompt AND widen the parser (plus a verify check).
- **P1-5 Wizard rejects handout-only folders that the pipeline supports.**
  `wizard` (`src/tui.mjs:30`) errors on zero PDFs, but S1/S5 explicitly support
  docs-only subjects (`stages.mjs:129-133,178-199`). Fix: allow docs-only in the wizard.
- **P1-6 PDF-window page sync misreads image-sequence numbers as page numbers.**
  `topicPdfPage` (`app.js:478-485`) treats any `-NNN.png` suffix as a PDF page, but
  `pdfimages` files (`L1-img-001.png`) carry sequence counters, not pages — the mini
  window jumps to the wrong page. Only `*-gap-NN.png` renders are real pages.

### P2 — robustness / compat

- **P2-1 `serve` path traversal + malformed-URL crash** (`src/serve.mjs:12-17`).
  `fp.startsWith(base)` without a trailing separator lets `/../dist-evil/…` escape to a
  sibling directory, and `decodeURIComponent` on a malformed URL (`/%E0%A4%A`) throws
  inside the handler and kills the server. Localhost-only, but both are one-line fixes
  (`base + path.sep` check; try/catch around decode).
- **P2-2 `ensurePy` never finds system pythons** (`src/extract.mjs:35-36`,
  same pattern `src/preflight.mjs:52`). Bare `"python3"`/`"python"` fail the
  `fs.existsSync` probe, so a machine that already has python3+python-pptx still pays
  for a venv bootstrap (needs network) or wrongly reports pptx missing. Probe bare names
  via PATH/`--version` instead.
- **P2-3 Keyword highlighter can break lecture pages on older Safari.**
  The lookbehind regex (`app.js:273`) throws on Safari <16.4, and the call sits
  unguarded at the end of `structureLecture` (`app.js:238`) — the throw skips TOC,
  quiz, and flashcard wiring. Wrap in try/catch (or drop the lookbehind).
- **P2-4 Sources-details swallows later sections** (`app.js:214-221`). After wrapping a
  Sources `<h2>`, the loop keeps appending every following non-H2 node — including nodes
  *after* subsequent H2s — into the collapsed Sources block. Break on the next H2.
- **P2-5 Raw Self-check hidden with no widget to replace it** (`app.js:204`).
  The condition hides raw Q&A when *either* quizzes or flashcards exist; a lecture with
  flashcards but zero parsed quizzes loses its questions entirely.
- **P2-6 Crash on missing extraction output.** If `pdftotext` fails, S5 still
  `readFileSync`s the expected `.txt` (`stages.mjs:205`) and the whole build throws.
  Skip failed files with a clear error instead.
- **P2-7 Gap renderer only understands `12-15` page ranges** (`stages.mjs:96`).
  Single pages, arrays, or `p.12`-style values from the agent are silently skipped;
  slide gaps should resolve `.pptx → pdf/<stem>.pdf` inside `renderGaps` instead of
  trusting the agent to cite converted paths. Fix: normalize + log skips.
- **P2-8 `build --port` is accepted and ignored** (`cli.mjs:112`); the smoke-test
  serve in PLAN B6 never happens. Either wire it or remove the flag.
- **P2-9 Quiz grading false-positives.** `gradeShort` (`app.js:97-99`) is substring
  matching, so "inadmissible" satisfies keyword "admissible". Use word boundaries.
- **P2-10 Streak uses UTC day boundaries** (`touchStreak`, `app.js:82-88`); use local
  date. Minor.
- **P2-11 `esc()` doesn't escape `"`** (`app.js:22`, `databuild.mjs:6-8`) but is used
  inside attributes: quiz `value="…"` (`app.js:106`), video `title="…"` (`app.js:334`).
  Content is locally generated (low risk), but quote-containing options/titles break
  markup. Escape `"`.
- **P2-12 State file has no locking** (`src/state.mjs`); two concurrent `dashy` runs
  clobber `.dashy/state.json`. Fine today (single TUI loop), note for later.

### P3 — debt / nits

- PLAN-vs-code drift: no persisted S3 index (in-memory BM25 only; `rag.mjs` never writes
  `rag.db`), S5 is sequential not parallel (`stages.mjs:202-229`), S9 is 10 shallow file
  checks (`verify.mjs`) — no coverage/formula/media-match/quiz-quality auditors, no
  file+line defect pointers, S8/S10 never marked in the ledger, `dashy.status.json`
  never written. Either implement or reword PLAN.md.
- Dead code: `resolveTools`/`dashyPython` (`extract.mjs:17-28`), duplicate `mkdirSync`
  (`extract.mjs:88-89`), redundant slides check (`scan.mjs:26`), redundant dynamic
  `import("./extract.mjs")` (`stages.mjs:236`), unused `manifest`/`spec` params in
  `buildData` (`databuild.mjs:179`), `void manifest` (`verify.mjs:71`),
  `slashPalette` imported/re-exported but never surfaced (`cli.mjs:19,201`,
  `tui.mjs:20` — PLAN B2.5 promises a slash palette that doesn't exist).
- Fragile dedupe/caps: image dedupe key `size + stem` drops distinct same-size images
  and the alphabetical 150-cap can starve later lectures (`cli.mjs:57-65`).
- `scan` is top-level only (subfolders ignored), `statSync` throws on broken symlinks
  (`scan.mjs:20-29`); `HANDOUT_RX`/`QP_RX` match filenames only.
- `auth` check is a heuristic (`opencode models` non-empty ⇒ authed,
  `bootstrap.mjs:68-69`); model fallback picks the first line containing "/" and "free"
  (`preflight.mjs:43`) regardless of output format.
- Opencode lock can be silently bypassed after 600 contended seconds and PIDs can be
  recycled (`opencode.mjs:20-32`); `out` over 4MB kills the child mid-stream.
- `render(route)` on weak/strong tagging and flashcard prev/next kills narration and
  destroys the TTS bar mid-listen (related UX wart, see §2).
- Duplicate CSS rule `#view span.w-done` (`styles.css:118-119`); `tm-count` unused;
  brand strings in timer titles (see P0-5).
- `smoke` script only `--check`s 2 of 15+ JS files (`package.json:7`); golden `app.js`
  isn't syntax-checked anywhere.

---

## 2. TTS "won't stop" — diagnosis and fix

**Symptom.** On some lecture pages, pressing ⏸ Pause or ■ Stop doesn't stop speech;
only a refresh recovers.

**Root causes** (all in `golden/app.js`, read-aloud section, ~lines 536-736):

1. **Uncapped utterance length wedges Chromium.** Each block speaks a whole `<p>`/`<li>`
   as one utterance (`ttsSpeak`). Chrome stalls utterances longer than ~15s and then
   ignores `cancel()` until the page reloads. Long-paragraph pages ("some pages") hit
   this; short pages don't. This matches the report exactly.
2. **No fencing between utterance generations.** Pause, stop, re-Listen, find-and-speak
   jumps, and rate/voice changes all do `cancel()` immediately followed by `speak()`.
   `cancel()` is asynchronous, so the old utterance's `onend`/`onerror` can fire *after*
   the new chain started — the stale handler (guarded only by the `ttsPlaying` flag,
   which is `true` again) spawns an extra chain. Two live chains + one overwritten
   `ttsTimer` = overlapping audio and a Stop button that appears dead.
3. **Pause leaked its highlight timer.** The toggle's pause path called
   `speechSynthesis.cancel()` without clearing `ttsTimer` (only `ttsStop` cleared it),
   leaving a stray 110ms interval painting karaoke forever.
4. **No unwedge step.** Halt paths never called `resume()` first, so an engine stuck in
   a paused/wedged state stayed there.

**Fix applied to `golden/app.js`** (presentation-only, no data-format changes):

- `ttsHalt()` — single halt primitive: `resume()` (unwedge) → `cancel()` → clear timer
  → bump a generation counter `ttsGen`. Pause, stop, start, jump, rate/voice, and route
  changes all go through it.
- Generation fencing — every `ttsSpeak`/chunk callback captures its generation and
  no-ops when stale, so overlapping chains are impossible by construction.
- Utterance chunking — blocks are split into ≤220-char sentence-boundary chunks
  (`ttsChunks`); karaoke word indexes carry a per-chunk offset so highlighting stays
  accurate. Short utterances can't wedge the engine, and stop takes effect at the next
  chunk boundary at the latest.
- `cancel()`→`speak()` now goes through `ttsPlayAt`, which re-arms playback after a
  short drain delay with a generation guard (Safari/Chrome both drop or double-play
  immediate re-speak).
- Pause path clears its timer (leak closed); `ttsFinish` invalidates generations.

**Manual verification** (no browser harness in repo): `node --check golden/app.js`;
then serve a build, open a long lecture page, Play → Stop/Pause mid-paragraph, rapid
Play→find-and-speak jumps, rate change mid-speech, and lecture switching — audio must
stop within a fraction of a second every time with no orphan highlight timer.

---

## 3. Improvements (beyond bugs)

1. **Tests.** Nothing exists. Highest value per line: `node:test` (no new deps) for
   `rag.mjs` (tokenizer, BM25 ranking incl. the `test`-substring case), `databuild.mjs`
   (needs `parseQuizzes`/`parseFlashcards`/`parseFormulas` exported first), `serve.mjs`
   (traversal/malformed-URL cases against a tmp `dist/`), `scan.mjs` (fixture dir),
   `verify.mjs` (fixture dist). Browser TTS logic stays manual-tested (§2).
2. **CI + lint + checks.** GitHub workflow running the expanded `smoke` (node --check
   over `src/`, `golden/app.js`, `bin/`), the `node:test` suite, and a fixture
   `buildData` golden test. `smoke` today covers 2 files.
3. **Per-subject templating at S8.** Replace ZG557/ACI strings, home stats, banner
   paths/titles with build-time values (P0-5 is the highest-visibility fix after TTS).
4. **Verify that verifies.** Add: MCQ options non-empty, media heading-match rate with
   topic names in defect output, quiz-type mix, duplicate topic ids, `index.html`/CSS
   non-empty, JSON schema parse of `Lx.json`. Demote zero-video to advisory (P0-4).
5. **S7/S8 ordering** (P0-1) + copy `jpg` consistently + smarter image cap (per-lecture
   quota instead of global alphabetical 150).
6. **Paper confirmation** (P0-2): only `spec.papers` count; show auto-candidates in the
   wizard for one-click confirm.
7. **Small UX:** keep TTS alive across weak/strong tagging (re-render preserves bar);
   Play-after-Done restarts from block 1 instead of replaying the last block; local-day
   streak; word-boundary grading.

Suggested order: TTS fix (done) → P0-5 templating → P0-1 ordering → P0-2 papers →
P1-2 duplicate id → P1-4 MCQ options → tests/CI → P2 hardening.
