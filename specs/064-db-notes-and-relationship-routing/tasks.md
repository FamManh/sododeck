# Tasks: Database notes on hover and relationship reshaping

**Input**: Design documents from `specs/064-db-notes-and-relationship-routing/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md) (4 clarifications), [research.md](research.md) (R1–R8), [data-model.md](data-model.md), [contracts/ui-contract.md](contracts/ui-contract.md), [quickstart.md](quickstart.md)

**Tests**: Required by the constitution (Principle VI): unit tests for pure functions and stores, component tests by role/label, a model round-trip case. No new e2e tests. A bug fix starts with a failing test.

**Paths**: `apps/app/src/…` for the app, `packages/model/…` for the model. Work in the worktree `../sododeck-064`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: US1 column popover, US2 table popover, US3 relationship reshaping

---

## Phase 1: Setup

- [ ] T001 In `../sododeck-064` (branch `064-db-notes-and-relationship-routing`), rebase on the latest `main`, run `pnpm install && pnpm lint && pnpm typecheck && pnpm test` for a green start.
- [ ] T002 Run `pnpm bench` and record the numbers in `specs/064-db-notes-and-relationship-routing/bench-before.md` (canvas change, constitution V).

---

## Phase 2: Foundational (blocks US1 and US2)

**Purpose**: Layout flags, table note removal (clarification 3), the shared popover state, hover timing and the note icon. US3 does not depend on this phase.

- [ ] T003 Write failing tests in `apps/app/src/editor/table-layout.test.ts`: (a) a table with `description` has the same `height` and `rowsTop` as without it (replace the assertions at ~:123-136 and ~:242-245 that expect `+ 8 + 17`); (b) `layout.noted` is true when `description.trim() !== ''`, `layout.hasNote` is true only when also `!display.hideNotes`; (c) `row.hasNote` follows the column `note` and `hideNotes`; (d) `row.hidden` is true for a note, `nameCut`, `typeCut`, a `default`, a `check`, or `increment`, and false for a short plain column (R1); (e) `nameMax` shrinks by 16 px when `row.hasNote`.
- [ ] T004 Update `apps/app/src/editor/table-layout.ts`: remove `noteLines`/`noteCut` and the note term from the height formula and `rowsTop` (~:368-401, doc comment ~:6-9, tokens `noteLineHeight`/`maxNoteLines`/`noteFont` if unused); add `TableLayout.noted`, `TableLayout.hasNote`, `TableRow.hasNote`, `TableRow.hidden`; reserve 16 px (12 icon + 4 gap) in `nameMax` when `row.hasNote`. Make T003 pass.
- [ ] T005 [P] Update `apps/app/src/editor/canvas-geometry.ts` (~:239): `descriptionLines` for tables becomes 0; fix any test relying on table note lines.
- [ ] T006 [P] Update the export: remove the table note lines in `apps/app/src/editor/export/scene.ts` (~:327-328) and `apps/app/src/editor/export/render-svg.ts` (~:597-611) so the table height matches the canvas; update `apps/app/src/editor/export/scene.test.ts` (~:919-921) and `render-svg.test.ts`.
- [ ] T007 Remove the `data-testid="table-note"` block in `apps/app/src/editor/deck-node.tsx` (~:336-348); update `apps/app/src/editor/deck-node.test.tsx` (~:989, ~:1022) to assert the note text is **not** rendered under the title.
- [ ] T008 [P] Rename the "Notes" switch to "Note icons" in `apps/app/src/editor/inspector/database/database-section.tsx` (~:27-32), with its description "Show a note icon on tables and columns that have a note"; update its test and `apps/app/src/editor/inspector/deck-inspector.test.tsx` (~:154) if it reads the label.
- [ ] T009 Write failing tests in `apps/app/src/state/ui-store.test.ts` for the `dbPopover` slice (data-model "UI state"): `openDbPopover` sets the target and closes `enumPopover`; `openEnumPopover` closes `dbPopover`; same target and source is a no-op; cleared on flow open and on reset.
- [ ] T010 Add the slice to `apps/app/src/state/ui-store.ts`: `interface DbPopover { kind: 'column' | 'table'; nodeId: Id; columnId?: Id; source: 'hover' | 'keyboard' | 'click' }`, `dbPopover: DbPopover | null`, `openDbPopover`, `closeDbPopover`; make `openEnumPopover` clear it; clear it where `enumPopover` is cleared (~:1235, ~:1461). Make T009 pass.
- [ ] T011 Export the row suspension predicate from `apps/app/src/editor/hover-focus/use-hover-focus.ts` (`rowsSuspendedBy`, ~:47-58, plus the connecting check ~:90-92) as a pure function `dbHoverSuspended(state, connecting): boolean` without changing row hover behavior; add a unit test for it in `use-hover-focus.test.ts`.
- [ ] T012 Write failing tests in `apps/app/src/editor/table/db-hover.test.ts` with fake timers: `enterTarget` opens after 300 ms rest; a second target of the **same table** while open switches at once (FR-006); `leaveTarget` closes after 150 ms unless `enterPopover` is called; touch pointers never open; nothing opens while `dbHoverSuspended` is true, and an open hover popover closes when suspension starts; `source: 'click'`/`'keyboard'` popovers are not closed by leave.
- [ ] T013 Create `apps/app/src/editor/table/db-hover.ts` modeled on `apps/app/src/editor/table/enum-hover.ts` (module-level `rest`/`grace` timers, `REST_MS = 300`, `GRACE_MS = 150`) exporting `enterTarget(target, pointerType)`, `leaveTarget()`, `enterPopover()`, `cancelDbHover()`, using `dbHoverSuspended` from T011 and `openDbPopover`/`closeDbPopover`. Make T012 pass.
- [ ] T014 Create `apps/app/src/editor/table/note-icon.tsx`: a `<button type="button">` with lucide `NotebookText` (size prop 12 or 14), `aria-label="Show note for {name}"`, `aria-haspopup="dialog"`, `aria-expanded`, classes `nodrag nopan`; `onPointerDown`/`onMouseDown` stop propagation (no select, no drag); click calls `cancelDbHover()` then toggles `openDbPopover({…, source: 'click'})` / `closeDbPopover()` (FR-009a, contracts "Note icon"). Tokens only, no hard-coded colours.
- [ ] T015 Add `apps/app/src/editor/table/note-icon.test.tsx`: clicking toggles the store popover; pointer down does not select the row or the table (use `renderWithEditor` from `apps/app/src/test/render-canvas`).

**Checkpoint**: tables no longer draw note text, layouts carry the flags, popover state and timing exist. `pnpm test` green.

---

## Phase 3: User Story 1 — Read a column's note and full details on hover (P1) 🎯 MVP

**Goal**: rows with hidden information open a column popover on hover rest, focus rest or note icon click; rows with a note show the icon.

**Independent test**: quickstart scenarios 1–5, 7–11.

- [ ] T016 [P] [US1] Write failing tests in `apps/app/src/editor/table/table-text.test.ts` for two new pure helpers in `table-text.ts`: `columnConstraints(column, deck)` returns the ordered labels `Primary key`, `Foreign key → {table}.{column}`, `Not null` (not for a pk), `Unique`, `Auto increment`, `Default {value}`, `Check {expr}` (only those set); `columnSummary(column, deck)` returns the announce text "{name}, {full type}, {constraints}, note: {note}".
- [ ] T017 [US1] Implement `columnConstraints` and `columnSummary` in `apps/app/src/editor/table/table-text.ts`, reusing `typeText` (`table-layout.ts:185`) and the enum name lookup used by `formatColumnLine` (`apps/app/src/db/column-line.ts:281-310`). Make T016 pass.
- [ ] T018 [US1] Write failing component tests in `apps/app/src/editor/table/db-popover.test.tsx` (column kind): with a hovered `email` row the dialog `Column email` shows `varchar(320)`, `Not null` and the note "Used for sign-in" as plain text (a note containing `<b>` renders literally, line breaks kept); a column without a note shows no `Note` label; "Open details" calls `openTableDrawer(tableId, { columnId })` and closes; Escape closes; renaming the column while open shows the new name; a deleted column closes the popover.
- [ ] T019 [US1] Create `apps/app/src/editor/table/db-popover.tsx` following `apps/app/src/editor/table/enum-popover.tsx`: Radix `Popover` from `@sododeck/ui/components/popover`, always open while `dbPopover` is set, `PopoverAnchor virtualRef` to the live element `[data-node-id="{nodeId}"] [data-column-id="{columnId}"]`, `side="right" align="start"`, `collisionPadding={8}`, `max-w-80`; `onOpenAutoFocus` prevented for `hover`/`keyboard`; `onPointerEnter` → `enterPopover()`, `onPointerLeave` → `leaveTarget()`. Column layout per contracts: header (column icon, name, type in code font and code colour token, `Open details` icon button), constraints line, hairline, `Note` label, note with `whitespace-pre-wrap` and `max-h-[200px] overflow-auto` (FR-002, FR-010, FR-012). Reads the column from the deck by id on render (no copied data). Make T018 pass.
- [ ] T020 [US1] Mount `<DbPopover deck={fullDeck} />` next to `<EnumPopover />` in `apps/app/src/editor/canvas.tsx` (~:940).
- [ ] T021 [US1] Wire row hover in `apps/app/src/editor/canvas.tsx` (~:717-730, the existing `[data-row]` delegation): on pointer over a row whose `TableRow.hidden` is true (read from the node's `layout.table.rows` by `data-column-id`), call `enterTarget({ kind: 'column', nodeId, columnId }, event.pointerType)`; on leaving the row call `leaveTarget()`. Rows that are not drawn have no element, so they never open (FR-008).
- [ ] T022 [US1] In `apps/app/src/editor/table/table-body.tsx`: render `<NoteIcon>` (12 px) right after the name span when `row.hasNote` (~:283-291); remove the native `title` on cut rows (~:219), keeping `aria-label`; when a row with `row.hidden` gets focus via the row-focus path (`onFocus`, ~:226-234) start the hover rest with `source: 'keyboard'` and, when it opens, `announce(columnSummary(...))` once; `onBlur` closes a keyboard popover (FR-009).
- [ ] T023 [US1] Make the enum chip respect FR-011 and suspension: in `apps/app/src/editor/table/enum-hover.ts`, `enterChip` calls `cancelDbHover()` first, so hovering a chip never shows both popovers; add a case to `apps/app/src/editor/table/enum-popover.test.tsx` that the column popover closes when the enum popover opens.
- [ ] T024 [US1] Component tests in `apps/app/src/editor/table/table-body.test.tsx`: the note icon appears only on noted rows and not when `hideNotes`; hovering a short plain row opens nothing; hovering a row with a `default` opens a popover without a `Note` label; a table drag (`canvasGesture` set) closes an open popover and blocks new ones; `pointerType: 'touch'` hover opens nothing but a tap on the icon opens it; keyboard ↓ to a noted row opens the popover and announces the summary.

**Checkpoint**: US1 works alone (quickstart 1–5, 7–11).

---

## Phase 4: User Story 2 — Read a table's note on hover (P1)

**Goal**: a table with a note shows a header icon after its name and opens a table popover on hover rest, focus rest or icon click.

**Independent test**: quickstart scenarios 1, 6, 7.

- [ ] T025 [US2] Extend `apps/app/src/editor/table/db-popover.test.tsx` (table kind): dialog `Table users` shows the full note; "Open details" calls `openTableDrawer(tableId)`; a table without a note never gets a table popover.
- [ ] T026 [US2] Add the `table` kind to `apps/app/src/editor/table/db-popover.tsx`: anchor `[data-node-id="{nodeId}"] [data-table-title]`, header (table icon, name, `Open details`), `Note` label and the note (same text rules). Make T025 pass.
- [ ] T027 [US2] In `apps/app/src/editor/deck-node.tsx` (title ~:326-334): wrap `titleText` in a flex row with `data-table-title`, add `<NoteIcon size={14}>` when `layout.table.hasNote`; on pointer enter/leave of the title row call `enterTarget({ kind: 'table', nodeId }, pointerType)` / `leaveTarget()` only when `layout.table.noted`; mention "has note" in the table `aria-label` (~:63-66).
- [ ] T028 [US2] Keyboard: when a table card with `layout.table.noted` gets keyboard focus (card focus path in `deck-node.tsx`), open the table popover with `source: 'keyboard'` after the rest delay and announce "{name}, note: {note}"; blur closes it.
- [ ] T029 [US2] Component tests in `apps/app/src/editor/deck-node.test.tsx`: header icon shown with a note and hidden with `hideNotes`; hovering the `users` title opens `Table users`; hovering the `audit` title opens nothing; moving from the title to a hidden row of the same table switches without delay.

**Checkpoint**: US1 + US2 complete (quickstart 1–12).

---

## Phase 5: User Story 3 — Reshape a relationship like a card connector (P2)

**Goal**: a selected relationship can change its line shape and be reshaped by bend and segment drags; ends stay on their rows.

**Independent test**: quickstart scenarios 13–17.

- [ ] T030 [P] [US3] Failing test first (bug fix) in `packages/model/test/edge-style.test.ts`: `setEdgeShape([relId], 'curved')` on a relationship (column ends, both ends `db-table`) stores `style.shape: 'curved'` and `edgeShape` returns `curved`; `'elbow'` on a relationship removes `style.shape`; card connector behaviour unchanged (curved without offset removed, with offset stored).
- [ ] T031 [US3] Fix `setEdgeStyle` in `packages/model/src/ops/edge-style.ts` (~:79-87): remove `shape` only when it equals the edge's default shape, `edgeShape({ ...current, style: { ...current.style, shape: undefined } })` (`packages/model/src/edge-shape.ts`). Make T030 pass.
- [ ] T032 [P] [US3] Add a round-trip case in `packages/model/test/round-trip.test.ts`: a relationship edge with `style.shape: 'curved'` and `route.waypoints` (fractional and `dx/dy` forms) survives JSON → Yjs → JSON unchanged (FR-015).
- [ ] T033 [P] [US3] Write failing unit tests in `apps/app/src/editor/editing/segment-drag.test.ts` for `relationshipSegmentVertices(start, end, stubFrom, stubTo, bends)`: vertices start and end at the stub tips (`REL_STUB` 24 px along the left/right side normal), dragging the middle segment of an elbow moves only its two inner vertices, the result is a waypoints-only patch (no `fromSide`/`toSide`/`fromAt`/`toAt`), self-reference returns null.
- [ ] T034 [US3] Implement `relationshipSegmentVertices` in `apps/app/src/editor/editing/segment-drag.ts` and let the segment drag take a `mode: 'connector' | 'relationship'` so relationship drags commit only `editor.setEdgeRoute(id, { waypoints })` via the existing `waypointsOf` encoding (`apps/app/src/editor/routing/connector-geometry.ts:79-110`). Make T033 pass.
- [ ] T035 [US3] In `apps/app/src/editor/routing/route-handles.tsx`, make `anchors` and `ends` optional so `RouteHandles` can render only bend and segment handles (no end anchors) for a relationship; keep `RelationshipEndHandles` unchanged.
- [ ] T036 [US3] In `apps/app/src/editor/deck-edge.tsx` (~:218-264, ~:656-700): when `rel?.rows === true` and the edge is selected and `routable`, render `RouteHandles` without anchors/ends, with a `BendContext` whose `start`/`end` are the relationship stub tips and `fromCentre`/`toCentre` the two table centres, `bendable = shape !== 'straight' && source !== target`, and a relationship segment context (T034). Remove `rel === undefined` from the gate only for this case. Below the row zoom (outline mode) show no reshape handles. Live bends come from `ui.bendPreview` as for connectors.
- [ ] T037 [US3] Component tests in `apps/app/src/editor/deck-edge.relationship.test.tsx`: a selected relationship in row mode shows bend/segment handles plus `relationship-end-from`/`-to`; dragging the middle segment commits waypoints only and keeps the end columns; a straight relationship shows no bend handles; a self-reference shows none; a composite end still refuses an end drag but the path handles work; undo restores the previous route in one step; moving a table keeps bends relative (decoded positions follow the centres).
- [ ] T038 [US3] In `apps/app/src/editor/inspector/relationship/relationship-inspector.tsx` (~:143-157): the "Line type" control shows `edgeShape(edge)` (elbow when unset) and writes through `applyLineType` (`apps/app/src/editor/fields/line-type.ts`); add a "Reset route" control (reuse `RouteFields` from `apps/app/src/editor/inspector/route-fields.tsx` or a button calling `editor.setEdgeRoute(id, null)` in one undo step), disabled when the route is empty; respects locks via `editableEdges`.
- [ ] T039 [US3] Component tests in `apps/app/src/editor/inspector/relationship/relationship-inspector.test.tsx`: an unset relationship shows Elbow selected; choosing Curved stores and redraws curved; Straight keeps waypoints in the deck but draws none, and Elbow shows them again (US3 scenario 9); Reset route clears `route`; the line type change does not touch columns, cardinality or label (FR-018); crow's-foot marks render on all three shapes.
- [ ] T040 [P] [US3] Check `apps/app/src/editor/actions/shape-actions.ts` (`edge.resetRoute`) and `apps/app/src/editor/export/edge-geometry.ts` (~:140-175) handle relationships with a stored shape and bends; add one export test in `apps/app/src/editor/export/scene.test.ts` for a curved relationship with a bend.

**Checkpoint**: US3 works alone (quickstart 13–17).

---

## Phase 6: Polish & cross-cutting

- [ ] T041 [P] Update `DESIGN.md` (Database / table card section): note icon (size, placement, hidden by "Note icons"), column and table popover anatomy (panel radius, surface, border, shadow, code colour for type), no note text under the title.
- [ ] T042 [P] Update `apps/app/CLAUDE.md` if new modules or store slices need listing (`db-hover.ts`, `db-popover.tsx`, `note-icon.tsx`, `dbPopover`), and `packages/model/CLAUDE.md` only if the `setEdgeStyle` contract text there mentions the curved rule.
- [ ] T043 Run `pnpm bench` and record `specs/064-db-notes-and-relationship-routing/bench-after.md` with the comparison to T002 (SC-005).
- [ ] T044 Run the full gate `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`; fix anything red, no skipped or `.only` tests.
- [ ] T045 Walk `quickstart.md` scenarios 1–17 in `pnpm dev`, light and dark theme; save screenshots in `specs/064-db-notes-and-relationship-routing/screenshots/` and results in `quickstart-results.md`.
- [ ] T046 Final report (Vietnamese chat, English files): what changed, the existing-deck height change (FR-005a), what was skipped or uncertain, bench numbers.

---

## Dependencies & execution order

- **Setup (T001–T002)** → **Foundational (T003–T015)** → **US1 (T016–T024)** → **US2 (T025–T029)** → **Polish (T041–T046)**.
- **US3 (T030–T040)** depends only on Setup; it can run in parallel with Foundational/US1/US2 (different files; only `deck-edge.tsx` and `segment-drag.ts`, untouched by US1/US2).
- US2 reuses `db-popover.tsx` and `note-icon.tsx` from US1/Foundational; T026 edits the file created in T019.
- Inside each phase: failing test → implementation → component test.

### Story dependencies

| Story | Depends on                        | Can run alongside      |
| ----- | --------------------------------- | ---------------------- |
| US1   | Foundational                      | US3                    |
| US2   | Foundational, T019 (popover file) | US3                    |
| US3   | Setup                             | Foundational, US1, US2 |

## Parallel examples

- Foundational: T005, T006, T008 together after T004; T009/T011/T012 tests can be written in parallel.
- US1: T016 (table-text) alongside T018 (popover tests).
- US3: T030, T032, T033 together (model test, round-trip test, segment test) — different packages/files.
- Two agents: one on Foundational → US1 → US2, one on US3 from the start.

## Implementation strategy

1. **MVP** = Setup + Foundational + US1: column notes readable on hover, note text removed under titles. Ship-able alone.
2. Add US2 (small, reuses everything).
3. Add US3 (riskiest: new segment geometry) — can land as its own commit series or PR.
4. Polish: DESIGN.md, bench, full gate, quickstart screenshots.

Small Conventional Commits, e.g. `fix(model): store curved shape on relationships`, `feat(app): column and table note popovers`, `feat(app): reshape relationships like connectors`.
