# Tasks: Card Types and Packs

**Input**: design documents in `specs/030-card-types-and-packs/`:

- [plan.md](plan.md) and [spec.md](spec.md), with the three founder decisions (Basic shapes with 031; every 030 pack on in new decks; "Kind" → "Type" everywhere).
- [research.md](research.md) (inventory of hard-coded kinds, R1–R8) and [data-model.md](data-model.md) (`TypeId`, `PackId`, `packs`, `meta.packs`, problems).
- [contracts/registry-api.md](contracts/registry-api.md) (registry, pack helpers, `setPackOn`, `TYPE_STYLE`, guarantees) and [contracts/type-ui.md](contracts/type-ui.md) (roles, names, keys).
- [quickstart.md](quickstart.md). Visual reference: `docs/design/screens/127-deck-type-palette-*.png` and `120-deck-sample-set-*.png`; `DESIGN.md` wins where they differ.

**Tests are required.** Constitution VI asks for:

- Unit tests (Vitest) for every pure module and model op; a round-trip case for every model change; Ajv / Zod parity for the schema change.
- Component tests (Testing Library) by role and name, as listed in the UI contract.

Write each new test first and watch it fail. Do not add Playwright tests. The smoke suite must keep passing (update it only if a "Kind" label it asserts changes).

**Scope guards**:

- **Older decks byte-identical**: a file without `packs` reads as Architecture only and is written without `packs` until the user changes packs. Today's six ids, icons, tile tones and names ("Gateway" included) do not change.
- **Unknown ids are valid**: an unknown type or pack id loads, is kept on save and export, and is reported; it never blocks loading.
- **Registry split**: data in `packages/model/src/card-types.ts`, icons and tones in `packages/ui/src/lib/icons.ts`; `ui` never imports `model`, `model` never imports React or icons.
- **No UI copy says "Kind"** after this feature (clarify Q1). Internal identifiers are renamed only where touched.
- **Out of scope**: Basic shapes pack and Shapes tab (031), start / end and actor (031), default fields per type (032), user-defined types, more packs, connection rules per type, new e2e tests.
- Do not name other diagram or database tools anywhere (docs, code, comments, UI copy).

**Approvals**: no new runtime dependency.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US5 from spec.md.

## Path Conventions

- **Schema**: `packages/schema/…`; read `packages/schema/CLAUDE.md` ("Editing v1.json") first.
- **Model**: `packages/model/src/…`, tests in `packages/model/test/`; read `packages/model/CLAUDE.md`.
- **UI**: `packages/ui/src/…`, tests in `packages/ui/test/`; read `packages/ui/CLAUDE.md`.
- **App**: `apps/app/src/…`, tests next to the code; read `apps/app/CLAUDE.md`; use the `react-flow` skill for canvas changes (`deck-node.tsx`, `collapsed-group-node.tsx`, `outside-proxy-node.tsx`).
- **Commits**: small Conventional Commits (`feat(schema): …`, `feat(model): …`, `feat(ui): …`, `feat(app): …`, `docs: …`). No AI attribution lines.

---

## Phase 1: Setup

- [x] T001 Work on branch (or worktree) `030-card-types-and-packs` from the latest `main`. Run `pnpm install && pnpm lint && pnpm typecheck && pnpm test` for a green start. Confirm `Puzzle`, `SquareCheck`, `Diamond`, `FileText`, `Warehouse`, `Truck`, `Ticket` and `Shapes` exist in the installed `lucide-react`.
- [x] T002 Take the bench baseline on unchanged code: `pnpm bench` and `pnpm --filter @sododeck/app test scene.perf`; save the tables in `specs/030-card-types-and-packs/bench-before.md`.

---

## Phase 2: Foundational (format, registry, packs)

**Purpose**: the open type ids, the registry, pack storage and the icon table every story reads. Test-first; the app still shows six types at the end of this phase.

### Schema

- [x] T003 [P] Write failing schema tests in `packages/schema/test/fixtures.ts`, `schema.test.ts` (Ajv / Zod parity), `coverage.test.ts`, `key-order.test.ts`: valid decks with each of the 13 type ids, `"type": "robot"` (unknown, valid), `packs` with one and four ids and an unknown pack id, views whose `excludeKinds` / `dimKinds` hold new ids; invalid `packs: []`, duplicate pack ids, `type: "Service"`, `type: ""`, `type: "a b"`, a 49-character id. `packs` is declared right after `tagColors`.
- [x] T004 Edit `packages/schema/schema/v1.json` per [data-model.md](data-model.md): remove `$defs/NodeKind`, add `$defs/TypeId` and `$defs/PackId` (pattern `^[a-z][a-z0-9-]{0,47}$`, descriptions listing the built-in ids and saying unknown ids are allowed), point `Node.type`, `View.excludeKinds`, `View.dimKinds` at `TypeId`, add root `packs` (`uniqueItems`, `minItems: 1`, description "absent = architecture only"). Run `pnpm schema:generate`, commit `src/generated/*`, add `packs` and a new-type node to `examples/full.sododeck.json`. Fix compile errors from the removed `NodeKind` type by importing the new generated `TypeId` (no behaviour change yet). Make T003 pass.

### Model registry and packs

- [x] T005 [P] Write failing tests `packages/model/test/card-types.test.ts` for every guarantee in [contracts/registry-api.md](contracts/registry-api.md): 13 types in registry order with packs and categories per research R3; ids match the pattern; the six legacy ids are in `architecture`; `typeName` returns the id for unknown types; `deckPacks` (absent → `['architecture']`, explicit → registry order, unknown ids after, sorted); `typesOfPacks(LEGACY_PACKS)` has 7 types; `packTypeCount`.
- [x] T006 [P] Write failing tests `packages/model/test/packs.test.ts`: `setPackOn` materialises `['architecture']` before the first change; turns a pack on and off in one undo step each; refuses (throws, writes nothing) to turn off the last pack on and an invalid id; two docs toggling different packs concurrently both survive (`concurrency.test.ts`); `createDeck()` holds the four 030 packs; `fromJSON` of a file without `packs` and `toJSON` round-trip byte-identical (`round-trip.test.ts`); explicit `packs` and unknown type / pack ids round-trip unchanged.
- [x] T007 [P] Write failing tests in `packages/model/test/problems.test.ts`: `unknown-card-type` (one problem per unknown id, listing its cards, message "Unknown card type <id>") and `unknown-pack` ("Unknown pack <id>"); known ids produce none.
- [x] T008 Create `packages/model/src/card-types.ts` (registry and helpers per the API contract) and export it from `src/index.ts`. Make T005 pass.
- [x] T009 Add `meta.packs` storage: lazy nested `Y.Map<true>` in `src/layout.ts`, read in `src/read.ts` (`readMeta` emits `packs` only when the map exists, in registry order then unknown ids sorted), carried by `fromJSON`; `createDeck()` in `src/deck.ts` stores `NEW_DECK_PACKS`; new `src/ops/packs.ts` `setPackOn`; wire `DeckEditor.setPackOn` in `src/editor.ts`. Update tests that assert the exact JSON of an empty `createDeck()` to include `packs`. Make T006 pass.
- [x] T010 Add `unknown-card-type` and `unknown-pack` to `ProblemKind` / `PROBLEM_KINDS` and their checks in `packages/model/src/problems.ts`. Make T007 pass.

### UI icon table

- [x] T011 [P] Write failing tests in `packages/ui/test/icons.test.ts`: `TYPE_STYLE` has the 13 ids with the icons and tones of research R3 (the six legacy entries equal today's `KIND_STYLE` icon and tone); `typeStyle` is case-insensitive, keeps the `edge` → `gateway` and `data` → `database` aliases, and falls back to `TYPE_FALLBACK` (Shapes, neutral) for unknown ids.
- [x] T012 Replace `COMPONENT_KINDS` / `KIND_STYLE` / `KIND_FALLBACK` / `toComponentKind` in `packages/ui/src/lib/icons.ts` with `TYPE_STYLE`, `TYPE_FALLBACK`, `typeStyle` (labels move out of `ui`); update `packages/ui/src/components/kind-tile.tsx` to take a type id and an accessible label from the caller. Make T011 pass and fix callers to compile (use `typeName` from `@sododeck/model` for labels).
- [x] T013 [P] Add an app test `apps/app/src/editor/type-registry.test.ts`: every `CARD_TYPES` id has a `TYPE_STYLE` entry and an `ICON_PATHS` entry in `apps/app/src/editor/export/icon-paths.ts`. Add the seven new icon geometries to `icon-paths.ts` from the installed lucide version (the existing drift test must pass). Make the new test pass.

**Checkpoint**: format, registry, packs and icons are in place and tested; the app compiles and behaves as before.

---

## Phase 3: User Story 5 - Older and unknown types keep working (Priority: P1)

**Goal**: every place that draws a type reads the registry; unknown ids draw as a generic card with the raw id and are reported.

**Independent Test**: quickstart steps 6 and 7.

### Tests for User Story 5 (write first)

- [x] T014 [P] [US5] Extend `apps/app/src/editor/deck-to-flow.test.ts` / `deck-node.test.tsx`: a card of each new type shows its tile and name; `"robot"` shows the fallback tile and the name "robot"; the six legacy types render exactly as before (snapshot of header markup).
- [x] T015 [P] [US5] Extend `collapsed-group-node` and `outside-proxy-node` tests (create next to the components if missing): member tiles and proxy tiles use the type's icon; unknown → fallback.
- [x] T016 [P] [US5] Extend `apps/app/src/editor/export/scene.test.ts` and `render-svg.test.ts`: export draws each type's icon; unknown → fallback; a legacy deck's SVG is unchanged (snapshot).

### Implementation for User Story 5

- [x] T017 [US5] Replace `apps/app/src/editor/kind-label.ts` with `type-label.ts` (thin re-export of `typeName`) and update `deck-node.tsx`, `collapsed-group-node.tsx`, `outside-proxy-node.tsx` and `export/scene.ts` / `render-svg.ts` to use `typeStyle` and `typeName`. Make T014–T016 pass.
- [x] T018 [US5] Show the new problems in the Problems panel with a "Select cards" action for `unknown-card-type` (reuse the existing problem row pattern). Add a component test next to the Problems panel.

---

## Phase 4: User Story 1 - Add a card of any type from the Add flyout (Priority: P1) 🎯 MVP

**Goal**: frame-127 Add flyout with search, tabs, sections, tile grid and number keys, listing the types of packs that are on.

**Independent Test**: quickstart steps 1 and 2.

### Tests for User Story 1 (write first)

- [x] T019 [P] [US1] Rewrite `apps/app/src/editor/palette.test.tsx` per [contracts/type-ui.md](contracts/type-ui.md): new deck → tabs All · Architecture · Process · Logistics · Data, sections with counts 7 / 3 / 2 / 1, footer "Packs · 4 on"; legacy deck → only Architecture, "Packs · 1 on"; `/` focuses `searchbox` "Search types"; filtering by name hides empty sections, "No types match"; ⏎ adds the first match; tab selection filters; grid arrow keys move in 3 columns; ⏎ / Space / click / drag add with the title in edit; number badges on the first nine visible tiles; "<Name> added" announced.
- [x] T020 [P] [US1] Extend `apps/app/src/editor/shell/use-shell-shortcuts` tests: keys 1–9 add the n-th visible tile while the flyout is open (respecting tab and search); nothing happens beyond the visible count or when the flyout is closed.

### Implementation for User Story 1

- [x] T021 [US1] Add palette UI state to `apps/app/src/state/ui-store.ts`: search text, selected tab, `view: 'types' | 'packs'`, and the derived list of visible type ids (for the shortcuts). UI-only, never saved.
- [x] T022 [US1] Rewrite `apps/app/src/editor/palette.tsx` (inside the existing `Flyout` host from `shell/flyouts.tsx`): `SearchField`, `tablist`, sections, 3-column tile `grid` with roving focus and drag, number badges, footer button; types from `typesOfPacks(deckPacks(deck))`. Delete `palette-order.ts`. Make T019 pass.
- [x] T023 [US1] Update `apps/app/src/editor/shell/use-shell-shortcuts.ts` to `Digit1`–`Digit9` over the visible tile list from the store. Make T020 pass.
- [x] T024 [US1] Screenshot the flyout (All tab, a search, Process tab) light and dark into `specs/030-card-types-and-packs/screens/` and compare with `127-deck-type-palette-*.png`; fix spacing and sizes.

---

## Phase 5: User Story 2 - Turn packs on and off per deck (Priority: P1)

**Goal**: "Packs in this deck" view with switches; types leave Add when their pack is off; existing cards untouched.

**Independent Test**: quickstart step 3.

### Tests for User Story 2 (write first)

- [x] T025 [P] [US2] `apps/app/src/editor/packs-panel.test.tsx`: lists four packs with type counts and `switch` per pack; toggling calls `setPackOn` once (one undo step) and announces "<Pack> on / off"; the last pack on is disabled with "At least one pack stays on"; "Back to Add" and Esc return to the types view; the note text is shown.
- [x] T026 [P] [US2] Extend `palette.test.tsx`: turning Logistics off removes Warehouse and Truck route tiles at once and moves focus to the next tile; a warehouse card on the board stays rendered, selectable and editable (canvas test in `canvas.test.tsx` or `deck-node.test.tsx`).

### Implementation for User Story 2

- [x] T027 [US2] Create `apps/app/src/editor/packs-panel.tsx` and switch to it from the palette footer (`view: 'packs'`). Make T025 and T026 pass.
- [x] T028 [US2] Screenshot the packs view light and dark against frame 127.

**Checkpoint**: US5 + US1 + US2 are the P1 scope.

---

## Phase 6: User Story 3 - Change a card's type (Priority: P2)

**Goal**: grouped type picker in toolbar, drawer, bulk drawer and menu; packs-on types plus current type; "Kind" → "Type" copy everywhere.

**Independent Test**: quickstart steps 4 and 8.

### Tests for User Story 3 (write first)

- [x] T029 [P] [US3] Extend `apps/app/src/editor/inspector/node-inspector.test.tsx`, `bulk-inspector.test.tsx`, `quick-edit/selection-toolbar.test.tsx` and `actions/actions-for.test.ts`: the control is named "Type" / "Type: <Name>" / "Type: Mixed"; options are grouped by category, filterable ("Filter types"), list packs-on types plus each card's current type; picking writes every selected card in one undo step and keeps id, title, tags, colour, size, position and connections.
- [x] T030 [P] [US3] Add a copy test (e.g. `apps/app/src/editor/no-kind-copy.test.ts`) that renders the toolbar, drawer, bulk drawer, menu and view settings for a card and asserts no visible text or accessible name contains "Kind".

### Implementation for User Story 3

- [x] T031 [US3] Replace `KIND_OPTIONS` in `apps/app/src/editor/inspector/choices.ts` with `typeOptions(deck, currentIds)` (grouped); update `node-inspector.tsx`, `bulk-inspector.tsx`, `quick-edit/field-popover.tsx`, `quick-edit/choice-state.ts` and `actions/field-actions.ts` (label "Type: …"; rename the `'kind'` toolbar field id to `'type'` in `state/ui-store.ts`). Make T029 pass.
- [x] T032 [US3] Change every remaining "Kind" UI string to "Type" (view settings "Hide types" / "Dim types", announcements, tooltips, `apps/app/src/design-gallery/*`); update the smoke suite only if it asserts one of these strings. Make T030 pass.

---

## Phase 7: User Story 4 - Views, search, export and the library follow the types (Priority: P2)

**Goal**: view hide / dim lists, search, command palette, library thumbnail and bench know every type.

**Independent Test**: quickstart step 5.

### Tests for User Story 4 (write first)

- [x] T033 [P] [US4] Extend `apps/app/src/editor/view-filter.test.ts`, `views/view-settings-popover` tests and `packages/model/test/views.test.ts`: hide / dim lists offer types in use plus packs-on types, grouped by category; hiding Warehouse hides warehouse cards; a hidden type whose pack is off keeps applying.
- [x] T034 [P] [US4] Extend `packages/model/test/search*.test.ts` and `command-palette/palette-results` tests: searching "truck route" finds truck routes; results show the type name; unknown types show their id.
- [x] T035 [P] [US4] Extend `apps/app/src/library/deck-thumbnail` tests: a deck with new and unknown types renders without errors with the right or fallback marks.

### Implementation for User Story 4

- [x] T036 [US4] Update `apps/app/src/editor/views/view-settings-popover.tsx`, `view-filter.ts`, `packages/model/src/views.ts` and `ops/views.ts` to `TypeId` lists and grouped options. Make T033 pass.
- [x] T037 [US4] Update `packages/model/src/search/index.ts` and `apps/app/src/editor/command-palette/palette-results.ts` to `typeName`. Make T034 pass.
- [x] T038 [US4] Update `apps/app/src/library/deck-thumbnail.tsx` and `apps/app/src/storage/library-db.ts` to `TypeId` and `typeStyle`. Make T035 pass.
- [x] T039 [US4] Add `BENCH_TYPES=1` to `apps/app/bench/perf.bench.ts` (header doc next to `BENCH_TAGS`) and `apps/app/src/bench/generate-deck.ts` (13 types round-robin, all packs on); extend `generate-deck.test.ts`.

---

## Phase 8: Polish and cross-cutting

- [x] T040 [P] Docs: new `docs/decisions/0025-card-type-registry.md` (registry split R1, open `TypeId` and `packs` R2, legacy and new-deck packs R4, unknown ids R7, "Gateway" kept, "Kind" → "Type"); `docs/decisions/0022-schema-roadmap.md` 030 rows marked built and refined (pattern, `PackId`, problems); `DESIGN.md` (left rail Add flyout, packs view, type tile tones); `packages/schema/CLAUDE.md`, `packages/model/CLAUDE.md` (`card-types.ts`, `setPackOn`, `meta.packs`), `packages/ui/CLAUDE.md` (`TYPE_STYLE`), `apps/app/CLAUDE.md` (palette, packs panel, type labels); `docs/backlog.md` §030 status and §032 "unblocked, re-clarify against 030's type ids". Do not name other diagram or database tools anywhere.
- [ ] T041 (roles, names and keyboard paths are test-asserted; the greyscale screenshot and a screen-reader pass are not done) Accessibility pass: keyboard-only run of quickstart steps 1–4, visible focus on tabs, tiles, switches and options, roles and names per [contracts/type-ui.md](contracts/type-ui.md), every type distinguishable by icon in a greyscale screenshot.
- [x] T042 Run the quickstart manual walk 1–9 in light and dark; save screenshots in `specs/030-card-types-and-packs/screens/` and results in `quickstart-results.md`.
- [x] T043 Performance: `pnpm bench` and `BENCH_TYPES=1 pnpm bench` → `specs/030-card-types-and-packs/bench-after.md`, compared with `bench-before.md` (no regression beyond run-to-run variation); re-run `scene.perf`.
- [x] T044 Definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all pass, no skipped or `.only` tests, the smoke suite (incl. no third-party requests) green. Final report: what changed, what was skipped, what is uncertain, bench numbers, next step (032 re-clarify, then 031). Stop; do not start the next feature.

---

## Dependencies and order

- **Phase 1 → Phase 2 → stories → Phase 8.** Phase 2 blocks everything.
- **Inside Phase 2**: T003 → T004 (schema, regenerates types used everywhere); T005–T007 can start once T004 has landed; T008 → T009 → T010; T011 → T012 → T013 (ui and app icons) beside the model work.
- **US5** first among stories (every other story draws types through the paths it updates). **US1** needs US5's labels and icons. **US2** needs US1's flyout (the packs view lives in it). **US3** and **US4** need only Phase 2 and US5 and can run in parallel with US1 / US2 in another worktree.
- **Priorities**: P1 = US5, US1, US2; P2 = US3, US4.

## Parallel examples

- Phase 2: T003, T005, T006, T007, T011 are test-writing in different packages and start together (model tests after T004).
- US5: T014, T015, T016 in parallel; T017 then T018.
- After US5: one agent takes US1 + US2 (palette, packs panel, shortcuts); another takes US3 + US4 (pickers, copy, views, search, thumbnail, bench).

## Implementation strategy

1. **MVP = Phase 1 + Phase 2 + US5 + US1.** Users can add every new type from the new flyout, older decks look the same, unknown types are safe. Check frame 127 (T024).
2. Add **US2** (packs view) to complete the P1 scope.
3. Add **US3** (type picker, "Type" copy) and **US4** (views, search, thumbnail, bench), then Phase 8.
4. After merge, resume **032**: `/speckit-clarify` against 030's type ids (`.specify/feature.json` → `specs/032-typed-fields`).
5. Keep commits small: one per task or tight group. Run `pnpm lint && pnpm typecheck && pnpm test` after each phase.
