# Feature Specification: Scale Bench

**Feature Branch**: `037-scale-bench`

**Created**: 2026-10-03

**Status**: Draft

**Input**: User description: "037-scale-bench — Know where Sododeck slows down as decks grow, before deciding on 023 (hybrid canvas renderer). Stabilise the flaky flow-highlight scenario (warm-up, median of more runs), then measure at 500 / 2,000 / 5,000 / 10,000 components (connections ×2) with off-screen culling on and off: load, snapshot update per change, derivation, autosave and compaction, update-log size, multi-tab convergence after a large paste, JSON panel, export, auto-layout and memory. Record the baseline and a target per row in `docs/performance.md`. No fixes; each miss becomes its own item. No CI budget."

**Sources**: `docs/backlog.md` §037, `docs/performance.md` §1–§2, `specs/036-collab-ready-document/bench-before.md` and `bench-after.md` (the numbers this feature extends), `apps/app/bench/perf.bench.ts` (today's canvas bench), AGENTS.md ("Performance-sensitive changes to the canvas: run `pnpm bench`").

**Dependency note**: depends on 036 (merged: the stored deck layout the bench must measure). 029 (card look) lands after this feature; this run is its "before" baseline.

## Why

Today's bench answers one question: does the canvas hold 60 fps at 500 components / 1,000 connections. It does not say what happens at 2,000, 5,000 or 10,000, and it measures only drawing. A dense deck (a logistics network, a large landscape) can be slow in opening, saving, syncing, searching, exporting or laying out long before drawing is the problem. Backlog 023 proposes an 8-day renderer rewrite; whether it is worth building depends on numbers nobody has yet. Two known misses are also unresolved: the flow-highlight scenario swings between 101 and 274 ms across two runs six seconds apart, and the canvas frame-rate table came back empty in the same reports.

This feature produces those numbers, so that the founder can decide on 023 (and on each fix) from data.

## Scope

**In scope**

- **A stable flow-highlight measurement** (warm-up, median of several runs) and a canvas frame-rate table that is never empty.
- **A size ladder**: the bench can generate and run decks of 500 / 2,000 / 5,000 / 10,000 components, with twice as many connections, with off-screen culling on and off.
- **The ten areas of `docs/performance.md` §2**, each measured at every size: load, snapshot update per change, derivation, autosave and compaction, update-log size, multi-tab convergence, JSON panel, export, auto-layout, memory.
- **A recorded baseline and a target per row** in `docs/performance.md` §2, with the machine and settings of the run.
- **One command** (`pnpm bench`) that anyone can repeat to reproduce the table.

**Out of scope**

- Fixing anything the numbers show (each miss becomes its own backlog item).
- A performance budget in CI (§3 of the plan, later).
- Deciding on 023. This feature supplies the evidence; the decision is the founder's.
- New user interface, or any change to what users see.
- Real user content: bench decks are generated, never taken from a user's deck.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - The flow-highlight number can be trusted (Priority: P1)

The founder or an agent runs the bench twice in a row and gets flow-highlight results that agree, and a frame-rate table with a number in every row.

**Why this priority**: Every later comparison (before and after a fix, before and after 029) rests on this. A measurement that swings 2.7× between runs cannot tell a regression from noise.

**Independent Test**: Run the bench five times on the same machine and compare the reported flow-highlight times and the frame-rate rows.

**Acceptance Scenarios**:

1. **Given** the 500 / 1,000 deck, **When** the flow-highlight scenario runs five times, **Then** the reported value is the median of several measured runs after a warm-up, and the five reported values lie within 25 % of each other.
2. **Given** a bench run, **When** it finishes, **Then** the frame-rate table has a row for every scenario that ran, with no empty cells.
3. **Given** the report, **When** a reader looks at the flow-highlight row, **Then** it states how many runs, the spread (min / median / max) and the target (100 ms).

---

### User Story 2 - A table of numbers at four deck sizes (Priority: P2)

The founder opens `docs/performance.md` §2 and sees, for each of the ten areas, a measured value at 500, 2,000, 5,000 and 10,000 components, with culling on and off where culling applies, and a target next to each row.

**Why this priority**: This is the deliverable: the evidence for 023 and for every later fix.

**Independent Test**: Check that the table has no empty cell, then re-run the bench and compare a sample of rows with the recorded ones.

**Acceptance Scenarios**:

1. **Given** the generated deck of each size, **When** its connection count is checked, **Then** it is twice its component count and the deck is valid (no problems reported).
2. **Given** each size, **When** the bench measures **load**, **Then** it reports the time from opening a stored deck to the first painted canvas.
3. **Given** each size, **When** the bench measures **snapshot update**, **Then** it reports the cost of one change during a drag frame and during a large paste.
4. **Given** each size, **When** the bench measures **derivation**, **Then** it reports the time to turn the deck into what the canvas draws, for one render.
5. **Given** each size, **When** the bench measures **autosave**, **Then** it reports flush time and compaction time (on open and when the log reaches its row limit).
6. **Given** each size, **When** the bench measures **update log**, **Then** it reports stored bytes after a fixed editing session and after compaction.
7. **Given** each size, **When** the bench measures **multi-tab**, **Then** it reports the time for a second tab to show a large paste made in the first.
8. **Given** each size, **When** the bench measures **JSON panel**, **Then** it reports the time to serialise and show the whole deck.
9. **Given** each size, **When** the bench measures **export**, **Then** it reports time for the scene, the SVG and the PNG, and the memory peak.
10. **Given** each size, **When** the bench measures **auto-layout**, **Then** it reports the layout time and whether the page stayed responsive during it.
11. **Given** each size, **When** the bench measures **memory**, **Then** it reports the JS heap after load and after five minutes of editing.
12. **Given** the canvas rows, **When** they are measured with culling on and with culling off, **Then** both values appear for every size.
13. **Given** a size the machine cannot finish (out of memory, timeout), **When** the run ends, **Then** the cell says so explicitly rather than staying empty, and the rest of the table is still produced.

---

### User Story 3 - A target per row and a clear verdict (Priority: P3)

Each row has a target and the table says which rows meet it. The founder reads the verdict per size and sees which areas, if any, miss at the sizes users need.

**Why this priority**: Numbers without targets do not support a decision. It is lower than the numbers themselves because targets can be set after the first run.

**Independent Test**: Read §2: every row has a target and a met / missed mark at every size.

**Acceptance Scenarios**:

1. **Given** the recorded baseline, **When** a row is read, **Then** it shows the target, the measured value at each size and whether the target is met.
2. **Given** a row that misses its target at some size, **When** the doc is read, **Then** it points to a new backlog entry for the fix (not fixed here).
3. **Given** the finished table, **When** the founder asks whether 023 is needed, **Then** the document states, per area, whether the current renderer with culling meets the targets at the sizes users need, so the answer can be read off it.

---

### User Story 4 - Anyone can repeat it (Priority: P4)

A teammate or agent on another machine runs `pnpm bench` (with the size and options documented) and gets a report in the same shape, and can tell how their machine and settings differ from the recorded run.

**Why this priority**: Later features (029 and after) re-run it to show before / after numbers, as AGENTS.md requires for canvas changes.

**Independent Test**: Follow the documented command on a clean checkout and compare the report's structure with the recorded one.

**Acceptance Scenarios**:

1. **Given** a clean checkout, **When** `pnpm bench` is run as documented, **Then** it produces a report file in `apps/app/bench/results/` covering the whole table.
2. **Given** a report, **When** it is read, **Then** it states the machine, browser version, CPU throttle, deck sizes and the date.
3. **Given** the bench decks, **When** they are inspected, **Then** they are generated from a fixed seed, so two runs measure the same deck, and contain no real user content.
4. **Given** the existing quick runs (default 500 / 1,000), **When** `pnpm bench` runs without the new options, **Then** it stays about as fast as today; the large sizes run only when asked for.

---

### Edge Cases

- **10,000 components may not finish** on a small machine. The run records a clear "did not finish" with the reason for that cell and continues.
- **Headless noise.** Headless Chromium numbers are indicative; the report says so and gives spread, not a single sample, for noisy rows.
- **A deck larger than the browser's storage quota.** The 10,000-component deck must fit; if it does not, the cell says so.
- **Culling off at 10,000** may freeze the page. The scenario has a time limit and records a timeout instead of hanging the run.
- **Re-running overwrites nothing.** Each run writes a new report; the recorded baseline in `docs/performance.md` changes only by a deliberate edit.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The bench MUST report the flow-highlight time as a median of several measured runs after a warm-up, with the number of runs and the min / median / max.
- **FR-002**: The canvas frame-rate table MUST contain a value for every scenario that ran.
- **FR-003**: The bench MUST be able to generate valid decks of 500, 2,000, 5,000 and 10,000 components with twice as many connections, from a fixed seed, containing no real user content.
- **FR-004**: The bench MUST measure each area listed in `docs/performance.md` §2 (load, snapshot, derivation, autosave, update log, multi-tab, JSON panel, export, auto-layout, memory) at every size.
- **FR-005**: Canvas-related measurements MUST be taken with off-screen culling on and off at every size.
- **FR-006**: A measurement that cannot finish MUST be recorded as such, with the reason, and MUST NOT stop the rest of the run.
- **FR-007**: Each report MUST state the machine, browser version, CPU throttle, sizes, run counts and date.
- **FR-008**: `docs/performance.md` §2 MUST hold the baseline at every size and a target per row, with a met / missed mark.
- **FR-009**: Each missed target MUST link to a new backlog entry; this feature MUST NOT fix it.
- **FR-010**: `pnpm bench` without new options MUST keep running the existing 500 / 1,000 scenarios in about the time it takes today; the larger sizes MUST be opt-in.
- **FR-011**: The bench MUST NOT send deck content over the network and MUST NOT change what the app does for users (constitution V).
- **FR-012**: The stored baseline MUST be reproducible: the documented command, options and fixed deck seed MUST give numbers in the same shape on another machine.

### Key Entities

- **Bench deck**: a generated deck of a given size (components, connections, optionally flows, groups, stickies), identical for the same size and seed.
- **Measurement row**: one area at one size and one setting (culling on / off), with a value, its spread, a target and a met / missed mark.
- **Bench report**: the file one run writes, holding all rows plus the machine and settings.
- **Baseline**: the report quoted in `docs/performance.md` §2 that later features compare against.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Five consecutive runs of the flow-highlight scenario on the same machine agree within 25 % of each other.
- **SC-002**: The `docs/performance.md` §2 table has a value (or an explicit "did not finish" with a reason) for every area at every one of the four sizes: 100 % of cells filled.
- **SC-003**: Every row has a target and a met / missed mark; every missed row links to a backlog entry.
- **SC-004**: A second person re-running the documented command reproduces the table's structure, and the default quick run takes no more than 20 % longer than today.
- **SC-005**: The founder can state, from the document alone and within five minutes, which areas miss their targets at which size, and whether 023 is justified.
- **SC-006**: No product behaviour changes: the full existing unit, component and smoke test suites pass unchanged.

## Assumptions

- Targets are proposed from today's definition of done (60 fps pan / zoom and drag at 500 / 1,000, flow highlight under 100 ms) and from ordinary expectations (opening a deck feels instant, saving never blocks typing); the founder confirms them when reading the first numbers.
- "Sizes users need" is taken as up to 2,000 components until the founder says otherwise; 5,000 and 10,000 show the headroom.
- The bench runs in headless Chromium on the founder's machine; absolute numbers differ elsewhere, so comparisons are made on one machine.
- Measurements may use test-only hooks or page queries, as the current bench does, provided they add nothing to the shipped app's behaviour.
- The deck's stored form is the one from 036 (merged); results before 036 are not compared except where `bench-before.md` already did.
- A CI performance budget, fixes and the decision on 023 are separate steps after this one.
