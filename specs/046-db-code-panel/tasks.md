# Tasks: Schema Code Panel (DBML)

**Input**: design documents in `specs/046-db-code-panel/`:

- [plan.md](plan.md) and [spec.md](spec.md), with clarify answers (2026-10-04: no dependency on 026, the JSON tab stays read-only; consecutive applies merge into one undo step until ~2 s without typing or editor blur; DBML and SQL tabs in every deck; an apply that removes tables shows "Removed … · Undo" and a table added back with the same name while the panel is open is restored).
- [research.md](research.md) (R1–R15), [data-model.md](data-model.md), [contracts/schema-sync.md](contracts/schema-sync.md), [contracts/code-panel-ui.md](contracts/code-panel-ui.md), [quickstart.md](quickstart.md). Design frames 137 and 166 (code panel part only, §g-91) in `docs/design/screens/`.

**Depends on** 040–045 (merged). 047 (lint) is not built and is not needed.

**Tests are required.** Constitution VI: unit tests for every pure stage in `db/sync/` and the model merge key; a round-trip test over the 044 DBML corpus and "Shop" (SC-004); a perf test (150 tables); component tests by role and name from contracts/code-panel-ui.md, with Monaco mocked as in `editor/json-viewer.test.tsx`. Write each test first and watch it fail. No new Playwright tests; the smoke suite (incl. no-third-party-requests) must pass.

**Scope guards**:

- **Pure stages** (`apps/app/src/db/sync/*` except `apply-schema-plan.ts`) import no React, DOM, Yjs or `editor/`; input is a `SododeckFile` snapshot + `RawSchema` + `SyncContext`, output is plain data.
- **Writes only through `DeckEditor`** (`apply-schema-plan.ts`), in one `editor.batch(fn, { merge })`.
- **Never write invalid text**: any error-severity problem ⇒ empty plan ⇒ nothing written.
- **Never touch what DBML does not express** (position, size, colour, tags, owner, links, lock, group, fields, `expanded`, `detail`, enum colour).
- **Parser only in the worker**, loaded on first DBML tab open; JSON tab behaviour unchanged.
- **Model**: only the `batch` merge option; no change in `packages/schema`.
- Tokens only; lucide icons; English copy exactly as in contracts/code-panel-ui.md.
- Do not name other diagram or database tools anywhere (code, comments, copy, ADR, fixtures).

**Approvals**: none needed (no new runtime dependency).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US5 from spec.md.

## Path Conventions

- **App**: `apps/app/src/…`, tests next to code (`*.test.ts(x)`); read `apps/app/CLAUDE.md` first.
- **Model**: `packages/model/src/…`, tests in `packages/model/test/`; read `packages/model/CLAUDE.md` first.
- **Commits**: `feat(model): …`, `feat(app): …`, `test(app): …`, `docs: …`. No AI attribution lines.

---

## Phase 1: Setup

**Purpose**: ADR, folders, fixtures.

- [x] T001 Write ADR `docs/decisions/0034-editable-dbml-tab.md`: apply on a 500 ms pause (no Apply button except "remove every table"), undo bursts via `batch` merge key (2 s idle / blur / undo / other local write ends a burst), matching rules (research R5), what DBML does not express is never patched, JSON tab stays read-only (026 later), alternatives from research R1, R2, R4
- [x] T002 [P] Create `apps/app/src/db/sync/` and `apps/app/src/editor/code/` with `types.ts` in `apps/app/src/db/sync/types.ts` holding `TextProblem`, `ProblemCode`, `SyncContext`, `SchemaPlan`, `SessionMemory` exactly as data-model.md
- [x] T003 [P] Add sync fixtures in `apps/app/src/db/fixtures/sync/`: `shop-edits.ts` (Shop DBML text plus edited variants: added column, renamed table, renamed column, removed table, new table + ref, enum rename, two-tables-replaced, locked table edit, TableGroup line, all-removed) and reuse `fixtures/import/large.ts` for 150 tables

---

## Phase 2: Foundational (blocks all stories)

**Purpose**: model merge key, worker read request, prefs, normalisation.

- [x] T004 Write failing tests `packages/model/test/batch-merge.test.ts`: two `batch(fn, { merge: 'k' })` 3 s apart undo in one step; a plain `batch`, an `update` with another key, `undo`, `redo` or `stopCapturing` between them splits the step; redo after undo of a merged step restores all of it; untracked (remote) transactions between them do not split it
- [x] T005 Implement the merge option in `packages/model/src/editor.ts` and `packages/model/src/ops/context.ts` (`transact` keeps the key; when the key repeats and the run is open, merge into the last undo item regardless of `captureTimeout`, e.g. by raising it for that transaction only); export the option type from `packages/model/src/index.ts`; note it in `packages/model/CLAUDE.md` under "Added by 046"
- [x] T006 [P] Write failing tests then extend `apps/app/src/db/import/read-dbml.ts` (+ `read-dbml.test.ts`): return every compiler diagnostic as `TextProblem` with start and end line/column; record lines of `TableGroup`, sticky `Note`, `headercolor`, `Project`, ref colour and `records` in `RawSchema` (new optional `inputs` field in `apps/app/src/db/import/types.ts`); keep 044's `preview.error` = first problem so the import dialog is unchanged
- [x] T007 Add `{ kind: 'read-dbml', text }` to `apps/app/src/db/import/import.worker.ts`, `pipeline.ts` and `import-client.ts` (`readDbml(text)` with a sequence number; stale replies dropped; only `@dbml/parse` loaded); tests in `import-client.test.ts` with the inline client
- [x] T008 [P] Write failing tests then extend `apps/app/src/state/json-panel-prefs.ts` (+ test): `format`, `schemaScope`, `sqlPreviewDialect` with defaults and field-by-field fallback; store actions `setCodeFormat`, `setSchemaScope`, `setSqlPreviewDialect` in `apps/app/src/state/ui-store.ts`
- [x] T009 [P] Write failing tests then implement `apps/app/src/db/sync/normalise.ts` (`normaliseRawTable`, `normaliseDeckTable`: extra column checks → table checks, quoted default vs expression, `increment` with `pk`, trimmed notes) and move `dbml-round-trip.test.ts`'s ad-hoc normalisation onto it

**Checkpoint**: model merge works; the worker reads DBML with all problems; prefs know the new tabs.

---

## Phase 3: User Story 1 — Edit the schema as text and see the canvas follow (P1) 🎯 MVP

**Goal**: in Whole schema, typing DBML applies after a pause, keeping ids; each typing burst is one ⌘Z; removals show an Undo toast; cut + paste restores the same table.

**Independent test**: quickstart scenarios 1, 2, 4, 5, 6 on "Shop".

- [x] T010 [P] [US1] Write failing tests `apps/app/src/db/sync/match.test.ts` for research R5: tables by `schema.name`, case-insensitive, session memory, one-to-one likely rename (≥ half the columns shared), ≥ 2 unmatched each → remove + add with `replaced` warning; columns by name, case, position + type, single pair; enums and values; indexes (name, then column list); checks (name, then expression); relationships by ends then name
- [x] T011 [US1] Implement `apps/app/src/db/sync/match.ts` to pass T010
- [x] T012 [P] [US1] Write failing tests then implement `apps/app/src/db/sync/place-new-tables.ts` (research R12: right of the scope's bounding box, 160 px gap, heights from 041 `tableLayout`, no overlap with any card; viewport centre in an empty deck)
- [x] T013 [P] [US1] Write failing tests then implement `apps/app/src/db/sync/session-memory.ts` (capture node + edges JSON before removal keyed by lower-cased `schema.name`; take on re-add; clear)
- [x] T014 [US1] Write failing tests `apps/app/src/db/sync/plan-schema-sync.test.ts`: each Shop edit fixture → expected plan (added column, renamed table keeps id, renamed column keeps index and relationship, new table + ref, removed table, restore from memory keeps old ids and position, enum rename updates columns); patches never contain non-DBML fields; no-op patches dropped
- [x] T015 [US1] Implement `apps/app/src/db/sync/plan-schema-sync.ts` (match → plan in the apply order from data-model.md; `removesAll` in Whole schema) to pass T014
- [x] T016 [US1] Write the SC-004 round-trip test `apps/app/src/db/sync/round-trip.test.ts`: for Shop (each dialect) and every `DBML_CORPUS` fixture imported into a deck, `planSchemaSync(deck, read(writeDbml(deck)))` is empty
- [x] T017 [US1] Write failing tests then implement `apps/app/src/db/sync/apply-schema-plan.ts` (+ test on a real `createEditor` doc): one `batch(fn, { merge })`; ids kept; added tables placed; removals last; returns `addedTableIds` and `removedTables`; two applies with the same key undo in one ⌘Z
- [x] T018 [P] [US1] Add `apps/app/src/editor/code/dbml-language.ts` (Monarch tokenizer: `Table`, `Ref`, `Enum`, `indexes`, `checks`, `Note`, `Project`, `TableGroup`, settings in `[...]`, strings, backtick expressions, `//` and `/* */` comments) and register it plus DBML model paths in `apps/app/src/editor/monaco-setup.ts`; token rules in `apps/app/src/editor/monaco-theme.ts` (+ `monaco-theme.test.ts`)
- [x] T019 [US1] Write failing tests then implement `apps/app/src/editor/code/use-schema-text.ts`: writer output (`schemaExport`) for `{ format, scope, dialect }` from `useDeckSnapshot`, throttled 250 ms like `use-throttled-deck-text.ts`, plus the table ids it contains
- [x] T020 [US1] Write failing tests then implement `apps/app/src/editor/code/use-dbml-session.ts` (state machine research R8 for Whole schema: `synced → dirty → applied | invalid | confirm`; 500 ms pause; latest-wins read; plan; apply with key `dbml:<sessionId>:<burst>`; burst +1 after 2 s idle, blur, undo / redo, or a local write from elsewhere (observe `observeDeck` origin); removal toast via `showUndoToast` "Removed shipments" / "Removed n tables"; session memory; `confirm` + `applyConfirmed()`); fake timers, inline import client
- [x] T021 [US1] Implement `apps/app/src/editor/code/dbml-editor.tsx` (lazy Monaco, editable, accessible name "DBML schema", minimal line edits like `json-viewer.tsx`, `setModelMarkers(model, 'dbml', …)`, ⌘Z / ⇧⌘Z / ⌘Y → deck undo / redo) and `apps/app/src/editor/code/dbml-tab.tsx` (editor + footer pill, helper text, Apply in `confirm`, Copy; announce pill changes)
- [x] T022 [US1] Write failing tests then implement `apps/app/src/editor/code/code-format-tabs.tsx` (`tablist` "Code format": JSON, DBML, SQL) and wire it into `apps/app/src/editor/json-panel-header.tsx` and `apps/app/src/editor/json-panel.tsx` (scope switch "Selection / Deck" for JSON, "Selection / Whole schema" for DBML and SQL; JSON path unchanged; lazy DBML tab so the parser loads on first open); update `json-panel.test.tsx`
- [x] T023 [US1] Component tests `apps/app/src/editor/code/dbml-tab.test.tsx` (Monaco mocked): type → pause → "Applied" and the deck has the column; rename keeps id; removal toast with Undo; one ⌘Z after a burst; cut + paste restores

**Checkpoint**: MVP: DBML editing in Whole schema works end to end.

---

## Phase 4: User Story 2 — Errors never break the canvas (P1)

**Goal**: syntax and semantic errors are shown inline; nothing is applied until the text is clean.

**Independent test**: quickstart scenarios 3, 10, 11.

- [x] T024 [P] [US2] Write failing tests then implement `apps/app/src/db/sync/suggest-setting.ts` (edit distance ≤ 2 against the DBML setting list → "did you mean not null?") and use it in `read-dbml.ts` problems for unknown settings
- [x] T025 [US2] Write failing tests `apps/app/src/db/sync/validate.test.ts` for every rule in data-model.md "Validation rules" (duplicate table / column / enum / index, missing ref table / column, enum default, enum in use incl. columns outside the scope, locked table changed or removed, `not-an-input` warnings), each with the right line
- [x] T026 [US2] Implement `apps/app/src/db/sync/validate.ts` and call it first in `plan-schema-sync.ts` (any error ⇒ empty plan)
- [x] T027 [US2] Extend `use-dbml-session.ts` and `dbml-tab.tsx`: `invalid` state, markers for errors and warnings, pill "Can't apply: fix n error(s)" + "Canvas keeps the last valid schema", warnings count with "Applied", unapplied text discarded on blur / tab switch / close (FR-020)
- [x] T028 [US2] Component tests in `dbml-tab.test.tsx`: `not nul` → error marker, suggestion, status text, deck unchanged (snapshot equal); fix → applies; TableGroup line → warning and the rest applies; select-all delete → "This removes all n tables" + Apply, nothing removed before Apply

**Checkpoint**: US1 + US2 complete the P1 promise.

---

## Phase 5: User Story 3 — Edit only the selected tables (P2)

**Goal**: Selection scope edits only the tables in the text.

**Independent test**: quickstart scenario 7.

- [x] T029 [US3] Write failing tests in `plan-schema-sync.test.ts` for `selection` scope: baseline bounds removals; tables outside never patched or removed; refs to tables outside the selection but in the deck are valid; new tables allowed
- [x] T030 [US3] Implement the selection scope in `plan-schema-sync.ts` and `validate.ts` (missing-ref check against text + deck)
- [x] T031 [US3] Extend `use-dbml-session.ts` and `use-schema-text.ts` for Selection: text from `selection.nodes` filtered to `db-table`; baseline captured with the text; new tables added to the UI selection after apply; selection change switches text only when not `dirty` / `invalid` / `confirm`; empty-selection hint text from the contract
- [x] T032 [US3] Component tests in `dbml-tab.test.tsx`: Selection text holds only the selected tables; deleting a block removes only that table; hint with no selection

---

## Phase 6: User Story 4 — The text follows changes made elsewhere (P2)

**Goal**: canvas, drawer, undo and other-tab changes show in the text without clobbering typing.

**Independent test**: quickstart scenarios 8, 9.

- [x] T033 [US4] Write failing tests in `use-dbml-session.test.ts`: `synced` + deck change → text updated by minimal edits; `dirty` + deck change → text kept, next apply plans against the new snapshot; `applied` + focus → text kept until blur then rewritten (FR-019); plan built on an older snapshot than the deck at apply time → re-read and re-plan instead of applying (contracts/schema-sync.md)
- [x] T034 [US4] Implement those rules in `use-dbml-session.ts` and `dbml-editor.tsx` (cursor and scroll preserved via `line-diff.ts`; snapshot version check before apply)
- [x] T035 [US4] Test two editors on one doc pair synced through updates (`Y.applyUpdate` with a remote origin) in `apply-schema-plan.test.ts`: an apply in one shows in the other and does not end the other's burst

---

## Phase 7: User Story 5 — Read the schema as SQL (P3)

**Goal**: read-only SQL preview in the deck's dialect.

**Independent test**: quickstart scenario 12.

- [x] T036 [US5] Register Monaco's bundled SQL basic language (deep import, as JSON) and the SQL model path in `apps/app/src/editor/monaco-setup.ts`
- [x] T037 [US5] Write failing tests then implement `apps/app/src/editor/code/sql-tab.tsx` (+ `sql-tab.test.tsx`): read-only editor "SQL schema" from `use-schema-text` with `format: 'sql'`; read-only attempt announces "SQL is read-only here; edit DBML or the canvas" (3 s cooldown); Generic deck → "Preview dialect" select bound to `sqlPreviewDialect`; writer notes list (reuse the export dialog's notes component); Copy

---

## Phase 8: Polish & Cross-Cutting

- [x] T038 [P] Perf test `apps/app/src/db/sync/plan-schema-sync.perf.test.ts`: 150 tables / 1,800 columns / 250 relationships, median plan ≤ 30 ms; report read time in the worker from `import.perf.test.ts` style measurement
- [x] T039 [P] Measure bundle: editor first-load chunk unchanged; parser chunk only on DBML open; Monaco chunk delta from the SQL language and DBML tokenizer; record numbers in `specs/046-db-code-panel/quickstart-results.md`
- [x] T040 [P] Docs: `apps/app/CLAUDE.md` (`db/sync/` boundary, `editor/code/`), `packages/model/CLAUDE.md` (merge key), `docs/backlog-database.md` (046 status: built), `docs/design/design-analysis.md` row for frames 137 / 166 if a deviation was taken
- [x] T041 Run the manual quickstart scenarios 1–13 in the dev build; screenshots of 1, 3, 5, 10, 12 in light and dark into `specs/046-db-code-panel/quickstart-results.md`
- [x] T042 Full definition-of-done run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` (smoke incl. no-third-party-requests) green; final report lists what was skipped or uncertain

---

## Dependencies

- Phase 1 → Phase 2 → stories.
- Within Phase 2: T004 → T005; T006 → T007; T008 and T009 independent.
- **US1** needs T005, T007, T008, T009. Inside US1: T010 → T011; T011, T012, T013 → T014 → T015 → T016; T015 → T017; T018, T019 → T020 → T021 → T022 → T023.
- **US2** needs US1's planner and session (T015, T020). T024 independent; T025 → T026 → T027 → T028.
- **US3** needs US1 + T026 (validation of refs). **US4** needs US1. US3 and US4 can run in parallel (different concerns in the same files: coordinate on `use-dbml-session.ts`).
- **US5** needs only Phase 2 (T008) and T022 (tabs); can run in parallel with US1 after T022.
- Polish after the stories it measures.

## Parallel Examples

- Setup: T002 and T003 together after T001.
- Foundational: T004, T006, T008, T009 together; then T005 and T007.
- US1: T010, T012, T013, T018 together; T019 alongside the planner tasks.
- US2: T024 alongside T025.
- Polish: T038, T039, T040 together.

## Implementation Strategy

1. **MVP = US1 + US2** (both P1): edit the whole schema as DBML safely, with one ⌘Z per burst. Ship-ready on its own.
2. **+ US3**: Selection scope for large schemas.
3. **+ US4**: robust two-way sync with outside changes and other tabs.
4. **+ US5**: SQL preview.
5. Each step: small conventional commits, full DoD command set green, report what was skipped.
