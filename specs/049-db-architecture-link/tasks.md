# Tasks: Database Architecture Link

**Input**: design documents in `specs/049-db-architecture-link/`:

- [plan.md](plan.md) and [spec.md](spec.md), with clarify answers (2026-10-04: "Touches" section in the step inspector; "Move to database…" / "Remove from card" actions; unowned tables only named in the player; deleting a card keeps its tables as unowned; filtered-out tables are named "hidden in this view").
- [research.md](research.md) (R1–R8), [data-model.md](data-model.md), [contracts/file-format.md](contracts/file-format.md), [contracts/ui.md](contracts/ui.md), [quickstart.md](quickstart.md).

**Depends on** 034 (drill-in, ports), 040–046 (merged), 007 / 035 (playback). 048 is **not** merged on `main`: do not rely on its row limit or "Show all" button.

**Tests are required.** Constitution VI and AGENTS.md: every pure function gets a unit test, every model change a round-trip case, a bug starts with a failing test, component tests use roles and names. **No new e2e tests** (founder deferral); the smoke suite must stay green and under 30 s.

**Scope guards**:

- Persistent data changes only in `packages/schema` and `packages/model`; the single new field is `step.touches`. Ownership stays `node.parent`; no new owner field.
- Writes only through `DeckEditor`; each user action is one undo step.
- Lit tables, chips, markers and player notes are derived at render time; never stored in the deck or in Zustand.
- Which table rows draw lives only in `apps/app/src/editor/table-layout.ts` (the new `forcedColumnIds` input goes there).
- Flows are never drawn between tables (founder, 2026-10-03). A step only lists what it touches.
- Tokens only (no hard-coded colours), lucide icons, English copy as in `contracts/ui.md`. Read and write differ by letter and shape, not colour alone.
- Do not name other diagram or database tools anywhere (code, comments, copy, ADR, sample decks).
- Do not start 047, 048 or 013 work.

**Approvals**: none needed (no new runtime dependency). Ask before adding any.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US5 from spec.md.

## Path Conventions

- **App**: `apps/app/src/…` (`A` = `apps/app/src/editor`), tests next to code (`*.test.ts(x)`); read `apps/app/CLAUDE.md` first.
- **Model**: `packages/model/src/…`, tests in `packages/model/test/`; read `packages/model/CLAUDE.md` first.
- **Schema**: `packages/schema/…`; read `packages/schema/CLAUDE.md` first.
- **Commits**: `feat(app): …`, `feat(model): …`, `feat(schema): …`, `test(app): …`, `docs: …`. No AI attribution lines (project rule overrides the default trailer).

---

## Phase 1: Setup

**Purpose**: ADR and the "before" bench numbers (taken before any code change).

- [x] T001 Write ADR `docs/decisions/0035-step-touches.md` (Status, Date 2026-10-04, Feature 049, Builds on 0022 / 0029): optional `step.touches` as a flat `{ table, column?, access }` list, ownership stays `node.parent`, derived lighting, touched rows forced visible through `table-layout.ts`, no flows between tables
- [x] T002 Run the baseline **before any feature change** and save to `specs/049-db-architecture-link/bench-before.md` (machine, settings, the 500-card default and a 150-table scenario if the harness supports `BENCH_TABLES`): `pnpm bench`

---

## Phase 2: Foundational (blocks every story)

**Purpose**: the one format key, its model ops and cleanup, and the shared pure helpers.

- [x] T003 Write failing tests then edit `packages/schema/schema/v1.json`: add `$defs/Touch` (`table` Id, `column` Id optional, `access` enum `read`|`write`; `additionalProperties: false`; every property with a `description`) and `Step.touches` (array of `Touch`, declared after `ruleInputs`); run `pnpm schema:generate`; add valid and invalid fixtures (duplicate pair, bad `access`, missing `table`) in `packages/schema/test/fixtures.ts`; extend `packages/schema/examples/full.sododeck.json`; Ajv / Zod parity stays green
- [x] T004 Add rule S15 (no two touches in one step share the same `(table, column)` pair) in `packages/schema/src/semantic-rules.ts` with a test in `packages/schema/test/` (generators drop this check, so it must be a semantic rule)
- [x] T005 [P] Write failing tests `packages/model/test/touches.test.ts` then implement `packages/model/src/ops/touches.ts` (`addTouch`, `setTouchAccess`, `removeTouch`; rejects a duplicate pair, a table without `columns`, and a column not in that table) and expose them on `DeckEditor` in `packages/model/src/editor.ts`; follow the style of `ops/rule-links.ts`
- [x] T006 [P] Write failing tests `packages/model/test/db-owner.test.ts` then implement `packages/model/src/ops/db-owner.ts` (`setTableOwner(tableId, cardId | null)`: requires a `database` node or null, one transaction, keeps columns, edges and touches) and `DeckEditor.setTableOwner`
- [x] T007 Extend `packages/model/src/ops/cascade.ts`: `removeNode(table)` removes every touch with that `table`; `removeColumn` removes touches with that `column`; steps are kept and not reported as `broken`; tests in `packages/model/test/db-cascade.test.ts` (rename keeps touches, delete table, delete column, undo restores)
- [x] T008 [P] Extend `packages/model/src/integrity.ts` to report a touch whose table is missing or has no `columns`, or whose column is not a column of its table; tests in `packages/model/test/integrity.test.ts`
- [x] T009 [P] Round-trip cases in `packages/model/test/round-trip.test.ts` (touches with table-only and column entries, read and write; deck with a card owner)
- [x] T010 [P] Cover `previewRemoval` for a database card in `packages/model/test/preview.test.ts`: the result reports its tables as kept (children un-parented), not removed
- [x] T011 [P] Write failing tests then implement pure helpers in `apps/app/src/db/owner.ts` (`tablesOf(deck, cardId)`, `ownerOf(deck, tableId)`, `databaseCards(deck)`, count text "n tables inside" / "1 table inside" / "No tables yet") and `apps/app/src/db/touches.ts` (`touchedTables(step)` with write beating read, `touchedColumns(step)`, `cardChip(deck, cardId, step)` → text like "writes orders +1", `playerNotes(deck, step, scope, view)` → unowned / other card / hidden in this view lines)

**Checkpoint**: file format, model ops and pure logic exist and are tested; no UI yet.

---

## Phase 3: User Story 1 — Open a database card and work on its tables (P1)

**Goal**: a database card shows its table count and the dialect chip, opens to "Inside <card>", owns the tables created inside, and tables move between cards.

**Independent test**: drill into a card, add a table, leave; count +1. Move it to another card; counts change; undo returns it. Change the deck dialect; every chip updates.

- [x] T012 [P] [US1] Write failing component tests then render the database card face in `apps/app/src/editor/deck-node.tsx` (+ `deck-node.test.tsx`): body line from `owner.ts`, a dialect chip using the deck dialect (`deckDialect`), only for `type: 'database'` nodes, tokens only; check count, singular, empty and dialect change
- [x] T013 [US1] Set `parent` to the drilled-in card when a table is created while drilled in: find the add-table path (start in `apps/app/src/editor/palette.tsx` and the canvas add-node handlers in `apps/app/src/editor/use-canvas-handlers.ts`), read `drill` through `scopeOf`, pass `parent` to the create call; test that a table created inside gets `parent` and one created at the top level does not
- [x] T014 [P] [US1] Write failing tests then add `apps/app/src/editor/actions/db-actions.ts` (+ `db-actions.test.ts`): action `table.moveToDatabase` ("Move to database…", opens a list of `databaseCards(deck)`, calls `setTableOwner`; disabled with reason when the deck has no database card or the table is locked) and `table.removeFromCard` ("Remove from card", shown only with an owner); register in `apps/app/src/editor/actions/index.ts` for the table context menu
- [x] T015 [US1] Add a "Database" field to the table inspector in `apps/app/src/editor/inspector/node-inspector.tsx` (+ test): shows the owner card, offers Move to database… and Remove from card through the same actions
- [x] T016 [US1] Place un-parented tables in free space on the level above: when `setTableOwner(…, null)` or a card delete un-parents tables, give them a free position (reuse the existing free-position helper if one exists, otherwise an offset grid in `apps/app/src/db/owner.ts`); test no overlap with existing nodes
- [x] T017 [US1] Delete-card confirmation: extend `apps/app/src/editor/confirm-delete-dialog.tsx` and `apps/app/src/editor/describe-removal.ts` (+ tests) so deleting a database card that owns tables says "N tables are kept and become unowned" from `previewRemoval`; undo restores the card and ownership in one step (assert in the test)
- [x] T018 [US1] Cross-database proxies: add tests in `apps/app/src/editor/visible-graph.test.ts` that a foreign key between tables of different cards (and owner vs no owner) yields one outside proxy per outside table in both directions, and that moving a table with `setTableOwner` turns the connector into a proxy and back; fix `apps/app/src/editor/visible-graph.ts` only if a test fails (the code already handles `parent` scoping)

**Checkpoint**: US1 works alone: ownership, count, chip, move, delete, proxies.

---

## Phase 4: User Story 3 — Play a flow and watch it touch the database (P1)

**Goal**: author "Touches" on a step, see a chip on the card at architecture level, and lit tables and R / W rows when drilled in, with the player staying on screen.

(US2 needs no extra code beyond T018; it is covered by that test and the quickstart.)

**Independent test**: add touches to a step, play it at architecture level and drilled in, and press Next while drilled in.

- [x] T019 [P] [US3] Write failing component tests then add `apps/app/src/editor/flows/step-touches.tsx` (+ `step-touches.test.tsx`): rows with a Read / Write toggle (accessible name "Access for orders: write"), remove button, "Add table or column…" combobox filtering tables by name and columns by "table.column" with the owner card as context, duplicate pair focuses the existing row, empty state "This step touches no tables.", full keyboard path; writes through `addTouch` / `setTouchAccess` / `removeTouch`
- [x] T020 [US3] Mount a "Touches" `PanelSection` in `apps/app/src/editor/flows/inspector-step.tsx` (+ extend `inspector-step.test.tsx`)
- [x] T021 [P] [US3] Extend `apps/app/src/editor/flows/step-marks.ts` (+ test) so the tables from `touchedTables(step)` get a `current` mark (state of the current step) in addition to edge ends; tables of other levels are not added to the visible set
- [x] T022 [US3] Extend `apps/app/src/editor/flows/flow-overlay.ts` (+ `flow-overlay.test.ts`) to produce the card chip data: `cardChip` per database card at architecture level, and a merged chip on the stacked card of a collapsed group (use the group's visible collapsed node id from `visible-graph.ts`)
- [x] T023 [US3] Draw the card chip in `apps/app/src/editor/deck-node.tsx` and the collapsed-group card `apps/app/src/editor/collapsed-group-node.tsx` (+ tests): text includes the verb ("writes orders +1", "reads orders"), tokens only, hidden when the step has no touches
- [x] T024 [US3] Add `forcedColumnIds` to the row selection in `apps/app/src/editor/table-layout.ts` (+ `table-layout.test.ts`): forced rows are kept even when Auto detail would fold them, hidden count and height follow, connectors and hit areas follow; pass the touched column ids for the current step from the canvas (compute through `touchedColumns` once per deck version and step)
- [x] T025 [US3] Draw an **R** / **W** marker on touched rows in `apps/app/src/editor/table/table-body.tsx` (+ test): letter plus distinct shape, token colours, accessible name "writes" / "reads"; lit table announces "current step, writes" in its accessible name
- [x] T026 [US3] Step player notes in `apps/app/src/editor/flows/step-player.tsx` (+ test): lines from `playerNotes` ("also touches: Customers DB · invoices", "… (hidden in this view)", unowned tables named); confirm the player and flow chip remain mounted while drilled in and Next / Previous update the lit tables
- [x] T027 [US3] Compute the touched sets once per (deck version, step id) with a small cache in `apps/app/src/db/touches.ts` (like `visibleGraph`'s cache) and test the cache returns the same object for the same inputs

**Checkpoint**: US3 works alone: author, chip, lit tables, markers, player.

---

## Phase 5: User Story 4 — Export one database as SQL (P2)

**Goal**: "Export SQL" on a database card writes only its tables in the deck's dialect.

**Independent test**: export from a card in a Postgres deck and in a Generic deck.

- [ ] T028 [P] [US4] Write failing tests then add the action `database.exportSql` in `apps/app/src/editor/actions/db-actions.ts` (+ test): label "Export this database as SQL", shown for `database` cards in the card context menu and inspector, disabled with reason "This database has no tables" when empty, runs `openExport(null, { format: 'sql', scope: 'database' })` after selecting the card
- [ ] T029 [P] [US4] Tests in `apps/app/src/db/export/schema-export.test.ts` (extend): output has exactly the card's tables and none of another card's; a foreign key to another card's table is written as a comment; a Generic deck with no picked dialect returns `null` from `sqlDialectOf` so the dialog asks first; cancelling writes nothing. Fix `apps/app/src/db/export/` only if a test fails

---

## Phase 6: User Story 5 — Start from Shop, SaaS auth or Blog (P3)

**Goal**: three bundled sample decks.

**Independent test**: `samples.test.ts` validates all of them; their flows play.

- [ ] T030 [P] [US5] Author `apps/app/src/samples/shop.sododeck.json` from `apps/app/src/db/fixtures/shop.ts` plus an architecture board (Storefront, Orders service, Orders DB, Customers DB), tables with `parent` set to their card, at least one cross-database foreign key, and a "Checkout" flow whose "Create order" step has `touches` (writes `orders` and `order_items`, reads `customers.email`)
- [ ] T031 [P] [US5] Author `apps/app/src/samples/saas-auth.sododeck.json` (one database card, about 5 tables: users, sessions, orgs, memberships, invites; a sign-up flow whose steps carry `touches`)
- [ ] T032 [P] [US5] Author `apps/app/src/samples/blog.sododeck.json` (one database card, about 5 tables: authors, posts, comments, tags, post_tags)
- [ ] T033 [US5] Extend `apps/app/src/samples/samples.test.ts` (it globs the folder): each of the three loads, passes `checkIntegrity` and `checkDeck`, round-trips losslessly, has database cards with owned tables, Shop has the cross-database foreign key and a touching step, and no sample text names another diagram or database product

---

## Phase 7: Polish & cross-cutting

- [ ] T034 [P] Accessibility pass: `apps/app/src/editor/flows/a11y.test.tsx` (extend) for the Touches section, the card face and the R / W markers; check in greyscale that read and write differ
- [ ] T035 [P] Check light and dark themes and tokens: no hard-coded colours in the new files (`pnpm lint`)
- [ ] T036 [P] Docs: update `packages/schema/CLAUDE.md`, `packages/model/CLAUDE.md` and `apps/app/CLAUDE.md` if boundaries or APIs changed; mark 049 done in `docs/backlog-database.md`; no mention of other tools
- [ ] T037 Run the "after" bench and save to `specs/049-db-architecture-link/bench-after.md` next to the before numbers; the 500-card target must hold
- [ ] T038 Run `pnpm schema:generate` clean, then `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`; walk `quickstart.md` steps 1–11 and note any gap in the final report (what changed, what was skipped, what is uncertain)

---

## Dependencies and order

- Phase 1 → Phase 2 (T003–T004 before T005–T010; T011 can run any time in Phase 2).
- Phase 2 blocks all stories.
- **US1** (Phase 3) and **US3** (Phase 4) are both P1 and independent after Phase 2; US3's chip (T022–T023) reuses the card face from T012, so start US3 UI after T012.
- **US4** (Phase 5) needs only Phase 2 and T014's file (`db-actions.ts`); **US5** (Phase 6) needs T003 (schema) and T005 (ops) but no UI.
- Phase 7 last.

## Parallel examples

- After T004: T005, T006, T008, T009, T010, T011 together (different files).
- US1: T012, T014 together; then T013, T015–T018.
- US3: T019, T021 together; T024 and T025 after T021.
- US5: T030, T031, T032 together.

## Implementation strategy

- **MVP**: Phases 1–3 (ownership, card face, move, delete, proxies). It delivers the "schema and architecture are one model" promise on its own.
- **Next**: Phase 4 (flow touches), the headline use case.
- **Then**: Phase 5 (export entry point; mostly tests), Phase 6 (samples), Phase 7.
- Commit after each task group with a Conventional Commit.
