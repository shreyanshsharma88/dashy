# dashy — v1 (personal release)

> **First release. Built for personal use.** v2 will open this up so anyone can learn everything more efficiently.

## What it does

Point `dashy` at any folder of course PDFs (slides work too — `.ppt`/`.pptx` auto-convert to PDF first, and a lone course handout is enough to get going) and it builds a polished, offline-first **study dashboard** for that subject:

- **Lecture-wise study pages** — every topic explained beginner-first with formulas, worked numericals, and full-step traces
- **Self-check quizzes** (MCQ / short / numerical, auto-graded) + **flashcards**, per lecture and global
- **Cheat sheet** (print-ready) + **previous-year exam pattern** page with weightage and at-risk topics
- **161-class diagram pipeline** — PDF figures extracted, gap pages screenshotted, per-topic gallery
- **Verified YouTube embeds** per major topic (oEmbed-checked, skipped — never faked — when nothing good exists)
- **Reference-PDF mini window** that follows your scroll, topic by topic
- **Read-aloud voice mode** with find-and-speak search, word karaoke, and a spoken-word trail
- **Review queue, weak/strong tags, sticky notes, streaks, Pomodoro timer, 3 themes, focus mode**, full-text search with topic anchors

## Install

```bash
npm install -g dashy        # or: git clone <repo> && cd dashy && npm install
```

## First run — bootstrap

```bash
dashy bootstrap        # checks everything, installs what's missing (with your OK)
dashy bootstrap --yes  # non-interactive: auto-install opencode if absent
```

| Step | macOS | Windows |
|---|---|---|
| opencode binary | auto-installs via official script | manual install from opencode docs, then re-run (auto-detected) |
| auth + model | launches `opencode auth login` if needed; confirms muse-spark model | same CLI flow |
| Wispr Flow | detected in /Applications (dictation just works) | detected in install dirs; else link to download — read-aloud never needs it |

## How to use

```bash
mkdir my-subject && cd my-subject
cp /path/to/*.pdf .     # any number of PDFs, any names
                        # optional: course handout (.pdf/.docx/.txt/.md)
                        # optional: question papers (exam pattern comes from these)

dashy init              # wizard: scan PDFs → handout/papers → extra features → build
dashy serve             # http://localhost:8000 — open it (videos need http, not file://)
```

Stepwise, if you prefer:

```bash
dashy scan              # list PDFs + handout/paper candidates (read-only)
dashy build             # full pipeline S0–S10 (skips completed stages on re-run)
dashy build --fresh     # redo every stage from scratch
dashy build --model <id>  # override the opencode model for content stages
dashy rebuild           # deterministic S7+S8+S9 only — no LLM cost
dashy status            # stage ledger + artifacts
dashy ask "..."         # ask the local index, no LLM calls spent
dashy add-features "..."  # free-text spec patch, e.g. "light theme default"
```

Bare `dashy` (no args) opens the interactive menu — every action maps 1:1 to a command above, so scriptability is never lost.

### Filenames that matter

Files whose names contain `question`, `exam`, `paper`, `mid`, `final`, or `test` are
**suggested** as question papers in the wizard — but only files you confirm count as
papers. Confirmed papers feed exam analysis and are excluded from lecture pages, so
don't confirm a lecture PDF that merely matched the pattern (e.g. `latest.pdf`).

`handout`, `syllabus`, `outline`, `course` matches are suggested as the course handout
for extra context.

### Handout-only mode

A folder with zero PDFs but readable docs (`.docx`/`.txt`/`.md`) is valid: dashy builds
a single Course Overview lecture from the handout text instead of failing.

## How it works

```
dashy init     # wizard: scan PDFs → handout/papers → extra features → build
dashy build    # S0–S10 pipeline (local opencode subagents + deterministic stages)
dashy serve    # http://localhost:8000 (videos need http, everything else is offline)
dashy ask      # ask the local TF-IDF index, no LLM needed
dashy status   # stage ledger + artifacts
```

Content stages run through **locally-running opencode** with parallel subagents (exam analyst, lecture authors, coverage auditor, image/video mappers) plus a blocking **audit → fixing-agent loop** that repeats until all checks pass. Extraction is poppler (or PyMuPDF fallback — see below) + LibreOffice + python; retrieval is local TF-IDF (vector upgrade later).

### Pipeline stages

| Stage | What happens | Needs LLM? |
|---|---|---|
| S0 preflight | node, poppler/PyMuPDF, opencode+auth+model, disk | no |
| S1 scan | inventory PDFs, handout + paper candidates → manifest | no |
| S2 extract | text dumps, images, slide→PDF conversion | no |
| S4 exam analysis | question papers → pattern, weightage, at-risk topics | yes |
| S5 lecture MDs | one study file per PDF (+ formula rule for dense subjects) | yes |
| S6 media | image→topic mapping, verified YouTube embeds, gap renders | yes |
| S7 data build | MDs → `app-data.js` + `media.js` + JSONs (deterministic) | no |
| S8 assemble | golden template + fonts + diagrams + PDFs → `dist/` | no |
| S9 audit loop | verify → fixing agent → rebuild, until all checks pass | on defects |
| S10 serve + handoff | print URL + status ledger | no |

Reruns skip completed stages (ledger in `.dashy/state.json`); `--fresh` redoes all.
`rebuild` re-runs S7+S8+S9 only — use it after hand-editing `.dashy/content/*.md`.

## Requirements

macOS/Linux or **Windows 10/11 64-bit** · Node.js 20+ · Python 3.10+ · poppler · LibreOffice (slides only) · local `opencode` with a free model.

Pure JavaScript throughout (no native modules), so anything Node 20+ runs on — x64 Windows included, ARM64 by the same token. 32-bit Windows is out (modern Node itself requires 64-bit).

| Tool | macOS | Windows |
|---|---|---|
| poppler | `brew install poppler` | `winget install poppler` |
| LibreOffice | `brew install --cask libreoffice` | `winget install TheDocumentFoundation.LibreOffice` |
| Python | `brew install python` | `winget install Python.Python.3.12` |

`dashy init` preflights all of this per-OS and tells you exactly what's missing. Python helpers auto-install into `~/.dashy-tools` on first use (override with `DASHY_PY`).

> **No poppler?** If Python has PyMuPDF (`pip install pymupdf`), dashy uses it for text +
> images automatically and S0 passes without poppler. Gap page screenshots still need
> poppler (`pdftoppm`) — without it they render 0 images and S9 reports it.

## Troubleshooting

| Symptom | Cause → fix |
|---|---|
| `Preflight failed: poppler:*` | No poppler and no PyMuPDF → `brew install poppler` or `pip install pymupdf` |
| `S4/S5 opencode call failed: ... auth ...` | Not logged in → `opencode auth login`, then re-run (completed stages are skipped) |
| `Unexpected server error` from a model | That free model is down → `dashy build --model <other-id>` (see `opencode models`) |
| Lecture page is empty (0 topics) | Agent returned a summary, not a study file → re-run `dashy build` (S5 retries) or check `.dashy/content/Lx.md` |
| `S9 blocked` / verify FAILs | Read the defect lines (`diagram assets resolve`, `≥5 self-check Qs/lecture`, …) — most are fixed by `dashy rebuild`; content defects need a `build` re-run |
| Videos show Error 153 | Page opened as `file://` → use `dashy serve` (YouTube embeds need http) |
| TTS won't pause/stop | Fixed in this release (chunked utterances + halt fencing); if it recurs, note the page + browser and refresh |
| `dist/pdf/` is empty | PDFs live outside the scanned root → keep PDFs inside the subject folder and `rebuild` |
| Build killed midway | Just re-run `dashy build` — the ledger resumes after the last completed stage |

## Developing

```bash
npm run smoke   # syntax-checks every src file + golden/app.js, then runs the test suite
npm test        # node:test suite only (test/*.test.mjs, no new deps)
```

See [REVIEW.md](./REVIEW.md) for the end-to-end code review (bugs, fixes, and suggested order).

## Status

v1 = personal usecase, single-subject builds verified end-to-end on fixtures. v2 = public release for learning anything efficiently.
