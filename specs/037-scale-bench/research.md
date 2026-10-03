# Research: Scale Bench

Decisions taken before design. Sources: `apps/app/bench/perf.bench.ts`, `apps/app/src/routes/bench-page.tsx`, `apps/app/src/bench/generate-deck.ts`, `apps/app/src/storage/*`, `docs/performance.md`, `specs/036-collab-ready-document/bench-*.md`.

## R1 — Where the new measurements live

- **Decision**: a new `bench/scale.bench.ts` next to `perf.bench.ts`, sharing small helpers in `bench/lib/`. It runs only with `BENCH_SCALE=1` (script `bench:scale`).
- **Rationale**: `perf.bench.ts` is already 1,000 lines with module-level result arrays; adding 10 areas × 4 sizes there would slow the default run (SC-004) and tangle two report shapes.
- **Alternatives**: extend `perf.bench.ts` (rejected: size and default-run time); a separate Node script without a browser (rejected: load, paint, export and layout need the real page).

## R2 — How to measure real code paths

- **Decision**: typed hooks on the `/bench` page (`window.__sododeckScaleBench`), enabled with `&scale=1`, as every existing scenario does. They import and call the real functions (`createDeckSnapshot`, `visibleGraph`, `toFlowNodes/Edges`, `attachDeckPersistence`, export scene / SVG / PNG, `toJSON`) and time them with `performance.now()`; paint-bound rows wait two animation frames.
- **Rationale**: same pattern as `__sododeckFlowBench` etc.; the hooks add nothing to the shipped route behaviour (`/bench` is unlinked).
- **Alternatives**: DevTools tracing for every row (rejected: heavy, hard to repeat, kept only for long tasks and heap).

## R3 — Stable flow-highlight (spec US1)

- **Decision**: in the flow scenarios, discard 3 warm-up runs, then take **11** measured runs and report **median** with min / max; wait for an idle frame between runs; keep the 100 ms target. The FPS table: fix the cause of the empty table (the report writer runs only when results exist, and the flow-only run leaves `results` empty) by always running one `default` canvas scenario in any bench run that writes a report, so the table has at least that row.
- **Rationale**: the two reports 6 s apart (101 vs 274 ms) are most likely JIT / GC and a cold first run, not real variance; median of many runs after warm-up is the standard cure.
- **Alternatives**: trimmed mean (rejected: median is enough and matches the existing style); fixing the cost itself (out of scope: it becomes its own backlog item if the stable number still misses).

## R4 — Size ladder and deck generation

- **Decision**: reuse `generateBenchDeck(n, 2n, seed=42)` for 500 / 2,000 / 5,000 / 10,000, with `flows`, `groups` and `stickies` options kept as they are. A unit test asserts each size is valid (`checkIntegrity` clean), has exactly 2n connections, and is deterministic for a fixed seed. Sizes come from `BENCH_SIZES` (default `500,2000,5000,10000` in scale mode).
- **Rationale**: generator already exists, seeded, grid-based with nearby edges.
- **Alternatives**: random real-like decks (rejected: not repeatable; real content is forbidden).

## R5 — Culling on / off

- **Decision**: the existing `&visibleOnly=1` switch (`onlyRenderVisibleElements`) is used for the canvas-bound rows (load → first paint, derivation per render, pan / zoom FPS, JS heap). Rows that do not depend on the renderer (autosave, update log, JSON, export, layout) are measured once and marked "n/a (renderer-independent)" for the culling column.
- **Rationale**: avoids doubling cells that cannot differ and keeps ~50 real cells.

## R6 — Load (IndexedDB → Yjs → first paint) and multi-tab

- **Decision**: add `&stored=<id>` mode to `/bench`: the Playwright test first seeds a deck into a throwaway IndexedDB through a hook (`seedStoredDeck(size)`, using `insertDeck` and the real `LibraryDb`), then opens the page in stored mode, which loads through `attachDeckPersistence` and reports `readAt` marks (log read, Yjs applied, first paint). For multi-tab, two pages in one browser context open the same stored deck; tab A pastes N components through the editor; the test times until tab B's snapshot contains them (poll in page via the channel's own update, not a sleep).
- **Rationale**: `BroadcastChannel` and IndexedDB only behave realistically across real pages of one context.
- **Alternatives**: two `Y.Doc`s in one page (rejected: skips the channel and structured clone cost).

## R7 — Autosave, compaction, update-log bytes

- **Decision**: in the page, with the real `attachDeckPersistence`: time `flush()` after a drag-like batch (6 frames) and after a 200-component paste; time compaction on open (log with 2 rows) and the compaction forced when rows pass `compactAbove` (200); report stored bytes (`Σ row.byteLength`) after a scripted session (a fixed 1,000-edit mix, standing in for "1 h") and after compaction.
- **Rationale**: matches `deck-persistence.perf.test.ts` (500-node flush, 75 ms budget) extended to all sizes.
- **Alternatives**: wall-clock one-hour session (rejected: not repeatable, too slow).

## R8 — JSON panel, export, layout, memory

- **Decision**:
  - JSON panel: time from opening the Deck tab to Monaco showing the last line (existing `&json=deck`), plus `serializeDeck` time in the page.
  - Export: reuse `&export=1` (scene, SVG, PNG ×2, dialog), add memory peak via `performance.memory` sampled during the PNG step (Chromium only; flag `--enable-precise-memory-info`).
  - Layout: reuse the Tidy-layout hooks (`startTidy`, `layoutRunning`, `layoutFrames`); report worker time, and the longest frame during it as the responsiveness figure. Cap at 60 s per size; on cap record "did not finish".
  - Memory: `performance.memory.usedJSHeapSize` after load and after a 5-minute scripted edit loop (a shorter `BENCH_FAST=1` loop of 30 s exists for local checks and is labelled as such in the report).
- **Rationale**: all four already have hooks or pages; only the size loop and the readout are new.

## R9 — Proposed targets (founder confirms after the first run)

| Area                     | Target at 500 / 2,000                                     | Target at 5,000 / 10,000 (headroom) |
| ------------------------ | --------------------------------------------------------- | ----------------------------------- |
| Canvas pan / zoom, drag  | ≥ 57 fps avg, p95 ≤ 20 ms (today's definition)            | report only                         |
| Flow highlight           | < 100 ms                                                  | report only                         |
| Load → first paint       | < 1,000 ms                                                | < 3,000 ms                          |
| Snapshot per change      | < 4 ms (drag frame), < 100 ms (200-component paste)       | < 16 ms, < 500 ms                   |
| Derivation per render    | < 8 ms                                                    | < 40 ms                             |
| Autosave flush           | < 75 ms (existing budget)                                 | < 300 ms                            |
| Compaction               | < 300 ms                                                  | < 1,500 ms                          |
| Update log after session | ≤ 3× the compacted deck                                   | ≤ 3×                                |
| Multi-tab convergence    | < 500 ms                                                  | < 2,000 ms                          |
| JSON panel               | < 500 ms                                                  | < 3,000 ms                          |
| Export dialog / PNG      | existing `EXPORT_TARGETS`                                 | report only                         |
| Auto-layout              | < 2,000 ms (existing `TIDY_TARGET_MS`), no frame > 100 ms | < 30,000 ms, report only            |
| JS heap after load       | < 200 MB                                                  | < 800 MB                            |

- **Rationale**: 500 / 2,000 rows reuse the targets already in the repo or the 16 ms frame budget; the 5,000 / 10,000 columns are deliberately loose "headroom" targets so the verdict says _where it breaks_, not that everything fails.
- **Risk**: targets are guesses until the first run; the doc marks them "proposed" until confirmed.

## R10 — Report shape and reproducibility

- **Decision**: one shared `MeasurementRow` (`area`, `size`, `culling`, `unit`, `value`, `runs`, `min`, `max`, `target`, `status`) written to `report-<stamp>.json` plus a Markdown table; the report header records machine (CPU model, cores, RAM), Chromium version, CPU throttle, sizes, run counts, seed, date, git commit. `docs/performance.md` §2 is updated by hand from the report (a deliberate edit, FR-008), not by the bench.
- **Rationale**: matches the existing `report-*.{json,md}` convention and "Re-running overwrites nothing".
- **Alternatives**: the bench rewriting the doc automatically (rejected: noisy diffs, the baseline must be a conscious choice).

## R11 — Cells that cannot finish

- **Decision**: every scenario runs under a per-cell timeout (default 120 s, `BENCH_CELL_TIMEOUT_MS`); on timeout, crash or out-of-memory the row gets `status: "did-not-finish"` with a reason string, the page is recreated, and the run continues.
- **Rationale**: FR-006, and 10,000 with culling off may freeze the page.
