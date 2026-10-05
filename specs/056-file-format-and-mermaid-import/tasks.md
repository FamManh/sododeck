# Tasks: File format and Mermaid import (056)

**Inputs**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md) (R1–R8), [data-model.md](data-model.md), [contracts/file-naming.md](contracts/file-naming.md), [contracts/mermaid-mapping.md](contracts/mermaid-mapping.md), [quickstart.md](quickstart.md), ADR `docs/decisions/0038-sododeck-extension.md`.

**Precedents to copy**: `apps/app/src/storage/library-ops.ts` + `library.worker.ts` + `library-client.ts` (a worker op end to end), `apps/app/src/layout/` (ELK request, client, pure `computeLayout`), `apps/app/src/editor/tidy-layout.ts` (`laidOutFrames`, request building), `apps/app/src/library/use-import-files.ts` (import hook, toast text), an existing dialog in `apps/app/src/library/` (e.g. `new-folder-dialog.tsx`).

**Tests**: required (constitution VI). Write each group's tests first and watch them fail. No new e2e; the smoke suite must stay green (AGENTS.md).

**Organization**: one phase per user story. Spec numbering: US1 extension (P1), US2 flowchart (P1), US3 sequence (P1), US4 report (P2), US5 errors and safety (P2). US1 is independent of the Mermaid work and can ship alone (MVP). US2 to US5 build on Phase 2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1 to US5 from spec.md.

## Path Conventions

- App: `apps/app/src/` (library UI in `library/`, storage and workers in `storage/`, layout in `layout/`, new pure folder `import-mermaid/`).
- Docs: `docs/`, `specs/056-file-format-and-mermaid-import/`.
- Test fixtures: small Mermaid strings inline in tests or in `apps/app/src/import-mermaid/fixtures.ts`; no large files committed (the 500-node case is generated in the test).

---

## Phase 1: Setup

- [ ] T001 Confirm branch `056-file-format-and-mermaid-import` and a green baseline: `pnpm install && pnpm lint && pnpm typecheck && pnpm test`. Record the result in the final report.
- [ ] T002 Commit the spec folder (spec, plan, research, data-model, contracts, quickstart, tasks, checklists), `docs/decisions/0038-sododeck-extension.md` (status Proposed) and the `docs/backlog.md` change as `docs: file format and Mermaid import spec, plan and tasks (056)`. No AI attribution lines (AGENTS.md).

---

## Phase 2: Foundational (shared Mermaid plumbing, no UI)

**Purpose**: the pure building blocks every Mermaid story uses. Nothing here is visible to users and none of it touches the file-extension work.

- [ ] T003 [P] Write `apps/app/src/import-mermaid/import-report.ts`: types `SkippedLine`, `ImportReport`, `MermaidImportError` (codes `empty`, `unsupported-type`, `nothing-readable`, `too-large`, each with the detail the message needs) and the limits constants (512 KB, 2,000 nodes, 4,000 links/messages) exactly as in data-model.md and contracts/mermaid-mapping.md. Test `import-report.test.ts`: error codes carry their detail.
- [ ] T004 [P] Write `apps/app/src/import-mermaid/detect.ts`: `prepare(text)` strips BOM, normalises line endings, removes a Markdown fence (first supported diagram wins; others reported `extra-diagram`), removes front matter (keeps `title:`) and `%%` comments while keeping the original 1-based line numbers; `diagramType(lines)` returns `flowchart | sequence | { unsupported: keyword } | none`. `graph` is a `flowchart`. Test `detect.test.ts`: plain text, fenced, front matter, comments, `graph TD`, `erDiagram`, empty, several fenced diagrams, line numbers survive stripping.
- [ ] T005 [P] Write `apps/app/src/import-mermaid/clean-text.ts`: `cleanLabel(raw)` turns `<br/>`/`<br>` into a newline, strips other tags, decodes the common HTML entities (`&amp; &lt; &gt; &quot; &#NN;`), removes surrounding quotes, trims; never produces markup (FR-019). Test `clean-text.test.ts`: tags, entities, quotes, emoji, `<script>` stays plain text with tags removed, long titles kept whole.
- [ ] T006 [P] Write `apps/app/src/import-mermaid/shape-map.ts`: the table from contracts/mermaid-mapping.md (`MermaidShape` → type id; `defaultSize` taken from the card-type registry in `@sododeck/model`, never copied). Test `shape-map.test.ts`: every row of the table, and a test that every produced type id exists in `CARD_TYPES`.
- [ ] T007 Write `apps/app/src/import-mermaid/new-ids.ts`: a small id source built on `makeIdAllocator` / `defaultNewId` from `@sododeck/model` (read `packages/model/src/ids.ts` first) so builders get fresh, title-independent ids for nodes, groups, edges, flows and steps. Test `new-ids.test.ts`: unique, stable format, no id equals any Mermaid key or title.

**Checkpoint**: `pnpm --filter @sododeck/app test import-mermaid` green; no UI or worker changes yet.

---

## Phase 3: User Story 1 - `.sododeck` extension (Priority: P1) 🎯 MVP

**Goal**: saves are named `<name>.sododeck`; `.sododeck`, `.sododeck.json` and `.json` (and renamed files) all open; labels and docs follow.

**Independent Test**: export a deck, check the name, import it back unchanged; import an old `.sododeck.json` and a `.json`; import a non-deck file and get the message.

### Tests first (write, watch fail)

- [ ] T008 [P] [US1] Extend `apps/app/src/storage/download.test.ts`: `deckFileName('Payments')` is `Payments.sododeck`; unsafe characters still become `-`; empty name is `Untitled deck.sododeck`; a name already ending `.sododeck` or `.sododeck.json` is not extended twice; `DECK_EXTENSION` is `.sododeck`.
- [ ] T009 [P] [US1] Extend `apps/app/src/library/library-actions.test.ts`: `exportDeckFile` downloads a file named `<name>.sododeck` whose text equals the model export (byte-for-byte the previous content); importing that text gives a deck with the same summary (FR-002, FR-006).
- [ ] T010 [P] [US1] Extend `apps/app/src/library/import-button.test.tsx`: the file input's `accept` is `.sododeck,.json,application/json`; the button's accessible name mentions `.sododeck`; files named `a.sododeck`, `a.sododeck.json`, `a.json` and a nameless valid deck all import with the same result; a non-deck file shows the updated message and adds nothing (FR-003, FR-004).
- [ ] T011 [P] [US1] Extend `apps/app/src/library/library-error-message.test.ts` and `apps/app/src/editor/routes` tests that name the old extension (find them with `grep -rn "sododeck.json" apps/app/src --include='*.test.ts*'`): expected strings now use `.sododeck`, and the hint "Older .sododeck.json files also open." appears where specified.

### Implementation

- [ ] T012 [US1] In `apps/app/src/storage/download.ts` add `DECK_EXTENSION = '.sododeck'` and `deckFileName(name)` per contracts/file-naming.md; update the doc comment of `safeFileName` ("The caller adds `.sododeck`").
- [ ] T013 [US1] Use `deckFileName` in `apps/app/src/library/library-actions.ts` (`exportDeckFile`, update its comment) and `apps/app/src/editor/use-export-deck.ts` (update its comment).
- [ ] T014 [P] [US1] Update the file-input `accept` and labels in `apps/app/src/library/import-button.tsx` and `apps/app/src/editor/shell/deck-menu.tsx` (accept `.sododeck,.json,application/json`; aria-label "Import deck file (.sododeck)").
- [ ] T015 [P] [US1] Update visible text: `apps/app/src/library/deck-menu.tsx`, `apps/app/src/editor/deck-inspector-storage.tsx`, `apps/app/src/editor/save-status.tsx` ("Export .sododeck"), `apps/app/src/editor/export/formats.ts` (subtitle `.sododeck · re-importable`), `apps/app/src/storage/library-ops-messages.ts` (the old-build message), `apps/app/src/design-gallery/overlays-section.tsx` if it shows the name.
- [ ] T016 [US1] In `apps/app/src/library/use-import-files.ts` change the failure message to "That file is not a valid .sododeck file. Older .sododeck.json files also open." and update the doc comment; keep `unsupported-version` as is. The same text for the editor-shell import in `apps/app/src/editor/shell/deck-menu.tsx`.
- [ ] T017 [US1] Run the T008–T011 tests green. Run `grep -rn "sododeck\.json" apps docs README.md AGENTS.md --include='*.ts' --include='*.tsx' --include='*.md' --include='*.mdx'` and review each remaining hit: keep only the intentionally unchanged ones from contracts/file-naming.md ("Not changed": Monaco model path and fileMatch, sample file names, historical docs/ADRs/specs) and the "older files also open" hints.
- [ ] T018 [P] [US1] Docs: `docs/spec.md` (storage format example and §5 file naming → `.sododeck`, with a note that older `.sododeck.json` files open), `README.md` and `docs/deploy.md` if they name the extension, `apps/app/CLAUDE.md` (import/export wording). Do not edit past ADRs except to add nothing; ADR 0038 covers the change.
- [ ] T019 [US1] Run `pnpm e2e`; if the smoke suite asserts the old export name or import accept list, update only those lines (AGENTS.md). Do not add tests.

**Checkpoint**: US1 complete and shippable alone. Quickstart "file extension" section passes by hand.

---

## Phase 4: User Story 2 - Import a Mermaid flowchart (Priority: P1)

**Goal**: pasted or chosen flowchart text becomes a new, laid-out deck with components, connections and groups.

**Independent Test**: the quickstart flowchart, and a generated 30-node/2-subgraph flowchart: 30 components, 2 groups, all links, no overlaps, under 3 s.

### Tests first

- [ ] T020 [P] [US2] `apps/app/src/import-mermaid/parse-flowchart.test.ts` (table-driven, one row per contract entry): direction keywords (`TD` → `TB`, default `TB`); every node shape row; bare ids; quoted and `<br/>` labels; node redeclared (first label wins); link-only nodes; every link form and label form; chains; `&` groups; self-link; `graph` keyword; nested and sibling subgraphs with title/id forms; a node first seen outside then inside a subgraph; link to a subgraph id; skipped lines with reasons (`style`, `classDef`, `class`, `linkStyle`, `click`, `:::`, `@{ }`, `~~~`, unknown line); line numbers; duplicate ids; Windows line endings.
- [ ] T021 [P] [US2] `apps/app/src/import-mermaid/flowchart-to-deck.test.ts`: the quickstart flowchart gives 4 nodes with the right type ids, 4 edges with labels, 1 group with 2 members, `direction` and `style` fields per the contract, deck name rule, ids generated (none equals a Mermaid key or title), same text twice gives the same structure and titles, `fromJSON(file)` does not throw and `toJSON(fromJSON(file))` round-trips, report counts.
- [ ] T022 [P] [US2] `apps/app/src/import-mermaid/layout-input.test.ts` with the real `computeLayout` and Node's ELK as `elk-layout.test.ts` does: request from a built file (sizes from the registry, groups as compounds, edges), direction option reaches ELK for the 4 directions (positions advance along the right axis), positions are applied to nodes, group frames are the member bounding box plus padding, a nested group frame encloses its child, no two cards overlap for a generated 30-node/2-subgraph graph.
- [ ] T023 [P] [US2] Extend `apps/app/src/layout/elk-layout.test.ts`: `direction` is optional and defaults to `RIGHT` (existing expectations unchanged); `DOWN`, `UP`, `LEFT` are passed through.

### Implementation

- [ ] T024 [US2] `apps/app/src/import-mermaid/parse-flowchart.ts`: line-oriented parser per contracts/mermaid-mapping.md using `prepare`, `cleanLabel` and `shape-map`; returns the `ParsedFlowchart` of data-model.md including `skipped`; enforces the node and link limits by throwing `too-large`; never throws on unreadable lines (adds `skipped`).
- [ ] T025 [US2] `apps/app/src/import-mermaid/flowchart-to-deck.ts`: `ParsedFlowchart` → `{ file: SododeckFile (no positions), report }` using `new-ids.ts`, the shape registry for types and sizes, groups with `parent`, nodes with `group`, edges with `label`, `direction`, `style` per the contract; name = title or `Imported diagram`; packs = `NEW_DECK_PACKS` (the shapes pack is on by default; assert it in the test).
- [ ] T026 [US2] `apps/app/src/layout/elk-layout.ts`: add optional `direction?: 'RIGHT' | 'DOWN' | 'LEFT' | 'UP'` to `LayoutRequest`, used for `elk.direction` (default `'RIGHT'`, so Tidy is unchanged). No other change.
- [ ] T027 [US2] `apps/app/src/import-mermaid/layout-input.ts`: `toLayoutRequest(file, direction)` and `applyLayout(file, result)` (positions into nodes; group frames from member boxes plus the same padding as `laidOutFrames` in `tidy-layout.ts`; reuse its constants or extract the pure part without changing its behaviour; run its tests).
- [ ] T028 [US2] Worker op: add `importMermaid(text)` to `apps/app/src/storage/library-ops.ts` (returns `{ file, report, direction }` or throws `MermaidImportError`; the flowchart branch for now), wire `'importMermaid'` through `library-worker-protocol.ts`, `library.worker.ts` and `library-client.ts` (also its fake in tests). Extend `library-ops.test.ts` for the op.
- [ ] T029 [US2] `apps/app/src/library/library-actions.ts`: `importMermaidDeck(ctx, text, folderId)`: worker parse → layout client (shared client like `tidy-layout.ts`, `layout()` with the request) → `applyLayout` → existing `importFile(JSON.stringify(file))` path → `insertDeck`; returns `{ deckId, name, report }`. Layout failure or cancel creates nothing (FR-022). Test in `library-actions.test.ts` with a fake layout client (inject it as `layout-client.test.ts` does).
- [ ] T030 [US2] `apps/app/src/library/import-mermaid-dialog.tsx` + `import-mermaid-button.tsx`: a button "Import Mermaid" next to Import (in `library/` where `ImportButton` is rendered; find its parent with grep) opening a dialog with a labelled textarea, a "Choose file" button (`accept=".mmd,.mermaid,.md,.txt,text/plain"`), and an Import button; on success switch to the result step with an "Open deck" button (navigate as the library does when opening a deck). UI tokens only; Escape closes; focus returns to the trigger. Test `import-mermaid-dialog.test.tsx` by roles and labels: paste → import → "Open deck" visible; the choose-file path reads the file text; the dialog is disabled while running.
- [ ] T031 [US2] `apps/app/src/library/use-import-files.ts`: content-based routing per contracts/file-naming.md (text starts with `{` → deck file; otherwise Mermaid detection → open the Mermaid dialog's result flow). Extend the hook test: `.mmd` file with a flowchart imports as Mermaid; a deck JSON named `.mmd` still imports as a deck; plain garbage shows the message.

**Checkpoint**: quickstart flowchart section passes; 30-node case < 3 s.

---

## Phase 5: User Story 3 - Import a sequence diagram as a flow (Priority: P1)

**Goal**: sequence text becomes components in a row, connections, and one flow whose steps follow the messages.

**Independent Test**: 4 participants and 10 messages → 4 components, one flow with 10 steps in order, no broken reference; the player runs it.

### Tests first

- [ ] T032 [P] [US3] `apps/app/src/import-mermaid/parse-sequence.test.ts`: `participant`, `participant A as Alias`, `actor`, undeclared participants in order of first use, every arrow form (`->>`, `-->>`, `->`, `-->`, `-)`, `--)`, `-x`, `--x`), `+`/`-` markers, missing label, `title`, `autonumber`/`activate`/`deactivate`/`Note`/`box`/`create`/`destroy` skipped with reasons, blocks `alt/else/opt/loop/par/and/critical/option/break/rect … end` flattened with the `block` label on the first covered message only, nested blocks, self-message, line numbers, limit `too-large`.
- [ ] T033 [P] [US3] `apps/app/src/import-mermaid/sequence-to-deck.test.ts`: 4-participant/10-message fixture → 4 nodes (`actor` vs `component`), one edge per ordered pair (reused for repeated pairs), every step's `edge` exists, step order equals message order, step `title` is the message label (fallback `<from> → <to>`), edge `label` only when all its messages share it, dashed edge only when all its messages are dashed, `notes` carries `alt: <label>` on the first covered step, flow title from `title` else `Imported sequence`, row positions in order of appearance with an 80 px gap, `fromJSON` round-trip, report counts including steps and the flattened note.

### Implementation

- [ ] T034 [US3] `apps/app/src/import-mermaid/parse-sequence.ts` per the contract and data-model (`ParsedSequence`).
- [ ] T035 [US3] `apps/app/src/import-mermaid/sequence-to-deck.ts`: `ParsedSequence` → `{ file, report }`; positions set here (row), so no layout call; one flow with steps.
- [ ] T036 [US3] Route by type in `importMermaid` (`library-ops.ts`) and in `importMermaidDeck` (`library-actions.ts`): the sequence result skips the layout client. Extend their tests.
- [ ] T037 [US3] Confirm the produced flow opens in the editor and plays (step player): add a test in `apps/app/src/import-mermaid/sequence-to-deck.test.ts` that runs the model's flow-path/integrity checks (`packages/model/src/flow-paths.ts`, `integrity.ts`) over the produced deck and expects no problems.

**Checkpoint**: quickstart sequence section passes.

---

## Phase 6: User Story 4 - Import report (Priority: P2)

**Goal**: the dialog shows what was mapped and what was skipped, with line numbers and reasons.

**Independent Test**: import a flowchart with `style`, `classDef`, `click` and one unreadable line; the report counts match and every skipped line is listed with its reason.

- [ ] T038 [P] [US4] `apps/app/src/import-mermaid/import-report.test.ts`: `describeReason(reason)` gives a plain sentence for each reason; `summaryText(report)` ("12 components, 14 connections, 2 groups" / "…, 1 flow with 10 steps"); notes shown; no cap on skipped entries.
- [ ] T039 [US4] `apps/app/src/import-mermaid/import-report.ts`: add `describeReason` and `summaryText`.
- [ ] T040 [US4] Report view in `apps/app/src/library/import-mermaid-dialog.tsx` (a `ImportReportView` in its own file `import-report-view.tsx`): counts as text, notes, and a scrollable labelled list of skipped lines (`line`, excerpt, reason); empty-skipped case says nothing was skipped. Test `import-report-view.test.tsx` by roles/labels: counts, a skipped list with N items, the empty case; state is never colour-only.
- [ ] T041 [US4] Extend the dialog test: importing text with skipped lines shows the list; clean text shows "Nothing was skipped".

---

## Phase 7: User Story 5 - Errors and safe import (Priority: P2)

**Goal**: bad input gives a clear message, creates nothing, never freezes the app, never uses the network.

**Independent Test**: empty text, `erDiagram`, unreadable text, an oversized input, a 500-node flowchart.

- [ ] T042 [P] [US5] `apps/app/src/import-mermaid/errors.test.ts` (through `importMermaid` in `library-ops`): empty and whitespace → `empty`; `erDiagram`/`classDiagram` → `unsupported-type` with the keyword; text with a flowchart keyword but no readable node → `nothing-readable` with the first problem line; > 512 KB, > 2,000 nodes, > 4,000 links, > 4,000 messages → `too-large`; no deck is created in any case (the library actions test checks `insertDeck` is not called).
- [ ] T043 [P] [US5] `apps/app/src/library/library-error-message.ts` + its test: user-facing messages — "Nothing to import.", "ER diagrams are not supported yet. Supported: flowchart, sequence diagram." (keyword filled in), "Nothing could be read. First problem: line N: …", "That diagram is too large (limit: …)."; used by the dialog inline (text kept so the user can fix it) and the hook toast.
- [ ] T044 [US5] Show those errors inline in `import-mermaid-dialog.tsx` (role `alert`), keep the pasted text, no deck added. Extend the dialog test for each error.
- [ ] T045 [US5] Responsiveness: a test with a generated 500-node/600-link flowchart in `apps/app/src/import-mermaid/scale.test.ts` that asserts parse + build finish under 1 s in Node and the result has 500 components; confirm by reading `library-actions.ts` that parse runs through the worker client and layout through the layout client (no heavy work in the dialog). Record the measured time in the final report.
- [ ] T046 [US5] No network: add to the dialog/actions tests a `fetch`/`XMLHttpRequest` spy asserting zero calls during import (FR-020, SC-007); the existing smoke no-third-party check must stay green.
- [ ] T047 [US5] Safety test in `flowchart-to-deck.test.ts`/`parse-flowchart.test.ts`: titles containing `<img onerror=…>` or `<script>` end up as plain text without tags; the dialog renders titles from the report as text (no `dangerouslySetInnerHTML` anywhere: assert with a grep in the test of the dialog file or an ESLint rule check, whichever the repo already uses).

---

## Phase 8: Polish and cross-cutting

- [ ] T048 [P] Docs: `apps/app/CLAUDE.md` (new `import-mermaid/` folder, its boundary: pure, no React/Dexie), `docs/backlog.md` §056 status → implemented with the spec path, `docs/spec.md` (importers line: Mermaid flowchart and sequence), and a short user-facing note in `docs/` or the site docs only if a docs page for import already exists (grep first; do not create new pages).
- [ ] T049 Accessibility pass on the dialog: focus order, labels, Escape, focus return, report list reachable by keyboard; screenshots of the dialog (input, report, error) and of an imported flowchart and sequence deck in `specs/056-file-format-and-mermaid-import/screenshots/` (no DESIGN.md frame exists: flag it in the report).
- [ ] T050 Run quickstart.md by hand end to end in `pnpm dev`; note anything that differs.
- [ ] T051 Full gate: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`. `pnpm bench` is not required (no canvas change); say so in the report.
- [ ] T052 Final report: what changed, what was skipped (ER import, `alt/else` → branches, samples renamed, Monaco path), what is uncertain (dialog design, ADR 0038 approval), and a proposal for the next step. Stop; do not start 055 or 057.

---

## Dependencies and order

- Phase 1 → Phase 2 → Phases 3–7. **US1 (Phase 3) does not depend on Phase 2** and can run first or alone.
- US2 needs Phase 2. US3 needs Phase 2 and T028/T029/T030 (worker op, action, dialog) from US2. US4 needs the dialog (T030). US5 needs the op and dialog (T028–T030) and both parsers.
- Within a phase: tests first, then parsers, builders, worker op, actions, UI.

## Parallel opportunities

- Phase 2: T003–T006 in parallel; T007 after.
- US1: T008–T011 in parallel; T014/T015/T018 in parallel after T012.
- US2: T020–T023 in parallel; T024 and T026 in parallel; T025 after T024.
- US3: T032/T033 in parallel; US2's UI tasks and US3 parser can run side by side by different agents.
- US4/US5: T038/T042/T043 in parallel.

## Implementation strategy

1. **MVP**: Phase 1 + Phase 3 (US1). Shippable alone, small and low risk.
2. **Increment 2**: Phase 2 + Phase 4 (flowchart import with dialog).
3. **Increment 3**: Phase 5 (sequence), then Phases 6–7 (report polish, errors), then Phase 8.
4. Small conventional commits per group (`feat(app): …`, `docs: …`); no Co-Authored-By or AI attribution lines in commits or PR text (AGENTS.md).
