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

## How it works

```
dashy init     # wizard: scan PDFs → handout/papers → extra features → build
dashy build    # S0–S10 pipeline (local opencode subagents + deterministic stages)
dashy serve    # http://localhost:8000 (videos need http, everything else is offline)
dashy ask      # ask the local TF-IDF index, no LLM needed
dashy status   # stage ledger + artifacts
```

Content stages run through **locally-running opencode** (`opencode/muse-spark-1.3-contributor-free`) with parallel subagents (exam analyst, lecture authors, coverage auditor, image/video mappers) plus a blocking **audit → fixing-agent loop** that repeats until all checks pass. Extraction is poppler + LibreOffice + python; retrieval is local TF-IDF (vector upgrade later).

## Status

v1 = personal usecase, single-subject builds verified end-to-end on fixtures. v2 = public release for learning anything efficiently.
