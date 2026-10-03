# Tasks: Typed Fields

**Input**: design documents in `specs/032-typed-fields/`:

- [plan.md](plan.md) and [spec.md](spec.md), with the clarify answers (on-card per type; built-ins in the list; default fields per type from frame 120; any kind change keeps what converts; person suggestions without bulk rename).
- [research.md](research.md) (R1–R10: three field sources and materialisation, file format, Yjs layout, ops, card display, conversions, person suggestions, drawer editor, search / export / problems, bench) and [data-model.md](data-model.md).
- [contracts/fields-api.md](contracts/fields-api.md) (pure helpers, `DeckEditor` ops and their rules) and [contracts/fields-ui.md](contracts/fields-ui.md) (roles, names, keys).
- [quickstart.md](quickstart.md). Visual reference: `docs/design/screens/124-deck-typed-fields-*.png`, `120-deck-sample-set-*.png`; `DESIGN.md` "Card system (Deck)" item 4 wins where they differ.

**Tests are required.** Constitution VI asks for:

- Unit tests (Vitest) for every pure module and model op; a round-trip case for every model change; Ajv / Zod parity for the schema change.
- Component tests (Testing Library) by role and name, as listed in the UI contract.

Write each new test first and watch it fail. Do not add Playwright tests. The smoke suite must keep passing.

**Scope guards**:

- **Nothing written early**: a deck gains `fields` / `fieldDefaults` only on a field definition change, and `values` only when a value is set. Older decks stay byte-identical.
- **Built-ins keep their storage**: Tech / Host / Owner values stay on `node.tech` / `host` / `owner`; `values` never holds them (S13); they cannot be renamed, deleted or change kind.
- **On card is per type** (one switch per field definition), never per card or per view.
- **Dangling values are valid**: kept, not drawn, reported.
- **Links are never fetched**; no network.
- **Out of scope**: formulas, relations, rollups, per-view or per-card visibility, fields on connections / groups / flows / stickies, filtering or sorting by values, bulk rename of people, fields drawn on shapes (031 keeps them in the drawer), new e2e tests.
- Do not name other diagram or database tools anywhere (docs, code, comments, UI copy).

**Approvals**: no new runtime dependency.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US5 from spec.md.

## Path Conventions

- **Schema**: `packages/schema/…`; read `packages/schema/CLAUDE.md` first.
- **Model**: `packages/model/src/…`, tests in `packages/model/test/`; read `packages/model/CLAUDE.md`.
- **App**: `apps/app/src/…`, tests next to the code; read `apps/app/CLAUDE.md`; use the `react-flow` skill for card changes (`deck-node.tsx`, `deck-to-flow.ts`, `card-layout.ts`).
- **Commits**: small Conventional Commits (`feat(schema): …`, `feat(model): …`, `feat(app): …`, `docs: …`). No AI attribution lines.

---

## Phase 1: Setup

- [x] T001 Work on branch (or worktree) `032-typed-fields` from the latest `main` (030 at or after `884586b`). Run `pnpm install && pnpm lint && pnpm typecheck && pnpm test`. Confirm the lucide names in plan.md exist (`Type`, `Hash`, `CircleChevronDown`, `CircleDot`, `User`, `Calendar`, `CalendarRange`, `Link`, `Gauge`, `Circle`, `CircleDashed`, `CircleCheck`, `Eye`, `DoorOpen`, `GripVertical`); substitute and note any missing one.
- [x] T002 Take the bench baseline on unchanged code: `pnpm bench`, `BENCH_TYPES=1 pnpm bench`, `pnpm --filter @sododeck/app test scene.perf`; save in `specs/032-typed-fields/bench-before.md`.

---

## Phase 2: Foundational (format, field sources, ops)

**Purpose**: the file format, the merged field list per type, every op and the value rules. Test-first; nothing visible changes yet.

### Schema

- [x] T003 [P] Write failing schema tests in `packages/schema/test/fixtures.ts`, `schema.test.ts` (Ajv / Zod parity), `semantic-rules.test.ts`, `coverage.test.ts`, `key-order.test.ts`: valid `fields` with every kind, units, select / status options with colours and status icons, `types` lists, built-in entries `tech` / `host` / `owner` with their fixed kinds; `fieldDefaults`; `node.values` of every value shape; dangling values (unknown field id, unknown option id, wrong shape) valid. Invalid: duplicate field ids, `owner` with kind `text` (S12), `unit` on a select, `options` on a number, duplicate option ids, `icon` on a select option, `values.tech` (S13), empty field name, unknown kind. `fields` and `fieldDefaults` declared after `packs`; `values` after `host`.
- [x] T004 Edit `packages/schema/schema/v1.json` per [data-model.md](data-model.md) (`$defs/FieldDef`, `FieldOption`, `FieldKind`, `StatusIcon`, `FieldValue` as `anyOf` of the shapes; root `fields`, `fieldDefaults`; `Node.values`) with descriptions saying what absent means. `pnpm schema:generate`; add a materialised Warehouse field set and values to `examples/full.sododeck.json`.
- [x] T005 Add **S12** and **S13** to `packages/schema/src/semantic-rules.ts` (header comment explains why Zod cannot). Make T003 pass.

### Field sources and values (pure, model)

- [x] T006 [P] Write failing tests `packages/model/test/fields.test.ts`: `BUILT_IN_FIELDS` (Tech / Host for Architecture types, Owner for every type; Tech / Host also listed for any card already holding a value); every type's `defaultFields` exactly as the spec's founder table (ids, names, kinds, units, on-card, Status options To do / In progress / Done with colours and icons, Region with no options); `fieldsOfType` merge order (built-ins, then code defaults unless the type is in `fieldDefaults`, then deck fields in deck order; deck entries with a built-in or default id override the code entry); `fieldUsage`; `personSuggestions` (owners and person values, case-insensitive unique, first spelling); `canonicalPerson`.
- [x] T007 [P] Write failing tests `packages/model/test/field-values.test.ts`: `validateValue` for every kind (numbers, progress 0–100, `YYYY-MM-DD` dates, `to ≥ from`, http / https / mailto links, non-empty text, option ids that exist); `convertValue` for every row of the clarify Q2 table and a cleared case for each other pair; `clearedByKindChange` counts.
- [x] T008 Add `defaultFields` to `CardType` and the founder table to `packages/model/src/card-types.ts`; create `packages/model/src/fields.ts` (`BUILT_IN_FIELDS`, `fieldsOfType` memoised per snapshot and type, `fieldUsage`, `personSuggestions`, `canonicalPerson`) and `packages/model/src/field-values.ts` (`validateValue`, `convertValue`, `clearedByKindChange`); export from `src/index.ts`. Make T006 and T007 pass.

### Storage and ops (model)

- [x] T009 [P] Write failing tests `packages/model/test/fields-ops.test.ts` for every rule in [contracts/fields-api.md](contracts/fields-api.md): `addField`, `updateField`, `moveField`, `deleteField` (removes values; undo restores both), option ops (`deleteOption` clears values using it), `changeFieldKind` (converts, clears the rest, one step), `setValues` (validates; person spelling; built-ins write `node.tech` / `host` / `owner`; `null` clears; `values` map removed when empty); materialisation (first change to any default of a type writes all of that type's defaults and the `fieldDefaults` entry in the same step; `setValues` never materialises; a deleted default stays deleted); duplicate names within a type refused; built-in rename / delete / kind change refused, reorder and on-card allowed.
- [x] T010 [P] Extend `packages/model/test/round-trip.test.ts` and `concurrency.test.ts`: a deck saved before 032 round-trips byte-identical; a deck with only values (no definitions changed) holds no `fields`; materialised types, every kind's value and dangling values round-trip unchanged; two docs setting different fields of one card both survive; two docs editing different options of one field both survive.
- [x] T011 Add storage in `packages/model/src/layout.ts`, `read.ts`, `deck.ts` (layout-2 `fields` list with `options` child lists, `fieldDefaults` map, `node.values` nested map, emit order per research R3) and the ops in new `packages/model/src/ops/fields.ts`, wired in `src/editor.ts` / `src/index.ts`. Make T009 and T010 pass.
- [x] T012 [P] Write failing tests in `packages/model/test/problems.test.ts`: `field-value-dangling` for a value whose field is missing, whose option is missing, or whose shape is wrong (progress 140, date "14/10"); one problem per card and field, with a "Remove value" fix id.
- [x] T013 Add `field-value-dangling` to `packages/model/src/problems.ts` (`ProblemKind`, `PROBLEM_KINDS`). Make T012 pass.

**Checkpoint**: format, field sources, values, ops and problems are done; the app is unchanged.

---

## Phase 3: User Story 1 - Add a field and fill it in (Priority: P1) 🎯 MVP

**Goal**: the drawer's "Fields" list with value controls for every kind and the add-field form; defaults appear on new cards of their type.

**Independent Test**: quickstart steps 1–3.

### Tests for User Story 1 (write first)

- [x] T014 [P] [US1] `apps/app/src/editor/fields/typed-fields-section.test.tsx`: a Task's drawer lists Status, Assignee, Due date and Owner in order (empty) with the names, roles and switches of [contracts/fields-ui.md](contracts/fields-ui.md); a Service lists Tech, Host, Owner; a field for Warehouse only does not show on a Service; setting a value calls `setValues` once; clearing removes it; invalid input shows the message under the control and writes nothing.
- [x] T015 [P] [US1] `apps/app/src/editor/fields/value-controls/*.test.tsx`: one test per kind for the control's role, keyboard entry and commit (text, number with unit, select / status with search and colour, person with deck suggestions and canonical spelling, date, date range From / To, link URL + Label, progress slider and number).
- [x] T016 [P] [US1] `apps/app/src/editor/fields/add-field-form.test.tsx`: "Add field" opens name, "Kind: Text" menu in frame-124 order, "+ Option" row for select / status (status prefilled To do / In progress / Done), "Show on card"; ⏎ calls `addField` with `types: [the card's type]` and announces; Esc cancels; empty or duplicate name refused.

### Implementation for User Story 1

- [x] T017 [US1] Create `apps/app/src/editor/fields/value-controls/` (one file per kind, reusing `combo-field.tsx`, `pick-field.tsx`, `SwatchGrid` and 033's `chipColours` for option dots) and generalise `fields/owner-field.tsx` into the person control using `personSuggestions` / `canonicalPerson`. Make T015 pass.
- [x] T018 [US1] Create `apps/app/src/editor/fields/typed-fields-section.tsx` and replace the Owner / Tech / Host rows in `apps/app/src/editor/inspector/node-inspector.tsx` with it (writes via `oneStep`). Make T014 pass.
- [x] T019 [US1] Create `apps/app/src/editor/fields/add-field-form.tsx` and mount it at the end of the section. Make T016 pass.

---

## Phase 4: User Story 2 - Show chosen fields on the card (Priority: P1)

**Goal**: the card's fields block (header status, chip shelf, rows, "+N fields"), per-type "On card", layout and zoom, export.

**Independent Test**: quickstart step 4 and the export part of step 7.

### Tests for User Story 2 (write first)

- [x] T020 [P] [US2] `apps/app/src/editor/card-fields.test.ts`: from a node and its type's fields, the header status (first on-card status with a value), chips (select, status, person, date, dateRange in field order), rows (text, number with unit, link, progress), hidden count (values in fields not on the card), empty values skipped, dangling values skipped; date formatting ("14 Oct", year when not current, "6–17 Oct", one date when equal).
- [x] T021 [P] [US2] Extend `apps/app/src/editor/card-layout.test.ts`: the fields block height (chip shelf wrap like tags, 19 px rows, 20 px "+N" pill, 8 px gaps); minimum height includes it; a stored height below the minimum is raised; a card with no fields keeps today's height exactly.
- [x] T022 [P] [US2] Extend `apps/app/src/editor/deck-node.test.tsx` and `deck-to-flow.test.ts`: the block renders per the UI contract (names "<field>: <value>", header status icon-only under 150 px, "N more fields" button opens the drawer at Fields); System shows named dots and no rows; Landscape none; toggling "On card" re-renders that type's cards (cache keys include the field list and `values`).
- [x] T023 [P] [US2] Extend `apps/app/src/editor/export/scene.test.ts` and `render-svg.test.ts`: the fields block is drawn like the canvas (light theme); a deck without fields exports unchanged (snapshot).
- [x] T024 [P] [US2] Extend the chip contrast test (033's `tags/tag-colours.test.ts` or `packages/ui/test/contrast.test.ts`): option chips in the 13 colours, slate and sample deck colours reach ≥ 4.5:1 in both themes.

### Implementation for User Story 2

- [x] T025 [US2] Create `apps/app/src/editor/card-fields.ts`. Make T020 pass.
- [x] T026 [US2] Add the fields block to `apps/app/src/editor/card-layout.ts` (height and minimum). Make T021 pass.
- [x] T027 [US2] Render the block in `apps/app/src/editor/deck-node.tsx` (between description and tags; header status slot; "+N" pill; System dots) and pass the field view from `deck-to-flow.ts`. Wire the "On card" switch in `typed-fields-section.tsx` to `updateField(id, { onCard })` with the "Applies to every <type>" description. Make T022 pass.
- [x] T028 [US2] Export the block in `apps/app/src/editor/export/scene.ts` and `render-svg.ts`. Make T023 and T024 pass.
- [x] T029 [US2] Screenshot frame-124 / 120 cards (Task, Warehouse, Issue, "+3 fields") light and dark into `specs/032-typed-fields/screens/`; compare and fix spacing.

**Checkpoint**: US1 + US2 are the P1 scope.

---

## Phase 5: User Story 3 - Manage field definitions (Priority: P2)

**Goal**: rename, reorder, options, "Also use for…", kind change with confirmation, delete with usage count.

**Independent Test**: quickstart step 5.

### Tests for User Story 3 (write first)

- [x] T030 [P] [US3] Extend `typed-fields-section.test.tsx`: row menu items per the contract; Rename (empty / duplicate refused); drag and ⌥↑ / ⌥↓ reorder call `moveField` once; Edit options (add, rename, recolour, reorder, delete with "used on N cards"); "Also use for…" adds / removes types; Delete field shows "Delete field · used on N cards"; Change kind shows "N values will be cleared" only when N > 0 and calls `changeFieldKind` once; the first change to a default field shows no extra UI (materialisation is invisible).

### Implementation for User Story 3

- [x] T031 [US3] Add the row menu, options editor, types picker and the two `alertdialog` confirmations to `apps/app/src/editor/fields/typed-fields-section.tsx` (split into `field-row-menu.tsx` and `field-options-editor.tsx` if the file grows). Make T030 pass.

---

## Phase 6: User Story 4 - Built-in fields join the list (Priority: P2)

**Goal**: Tech / Host / Owner in the list with reorder and "On card"; Owner as a person chip.

**Independent Test**: quickstart step 6.

- [x] T032 [P] [US4] Extend `typed-fields-section.test.tsx` and `deck-node.test.tsx`: built-in rows offer only reorder and the switch; turning Owner on for services draws person chips on every service and stores only an `owner` entry in `fields` (order / on-card), never in `values`; a deck saved before 032 shows the same values with "On card" off.
- [x] T033 [US4] Fix anything T032 exposes in `typed-fields-section.tsx`, `card-fields.ts` or `ops/fields.ts`.

---

## Phase 7: User Story 5 - Fields everywhere else keep working (Priority: P3)

**Goal**: bulk editing, search, clipboard, problems in the panel.

**Independent Test**: quickstart step 7 and 8.

### Tests for User Story 5 (write first)

- [x] T034 [P] [US5] Extend `apps/app/src/editor/inspector/bulk-inspector.test.tsx`: three warehouses show their fields with "Mixed" where values differ; setting writes all three in one step; a mixed-type selection shows only shared fields.
- [x] T035 [P] [US5] Extend `packages/model/test/search*.test.ts`: `'field'` search finds text, person, number, option labels and link labels; snippets name the field.
- [x] T036 [P] [US5] Extend clipboard tests (`packages/model/test/fragment*.test.ts` / paste tests): values travel with copied cards; pasting into a deck without the field keeps them and Problems reports them; no definition is invented.
- [x] T037 [P] [US5] Problems panel test: `field-value-dangling` rows show "Remove value", which clears it in one step.

### Implementation for User Story 5

- [x] T038 [US5] Bulk fields in `apps/app/src/editor/inspector/bulk-inspector.tsx` (+ `derive.ts` shared / mixed values). Make T034 pass.
- [x] T039 [US5] Search over values in `packages/model/src/search/index.ts` / `search.ts`. Make T035 pass.
- [x] T040 [US5] Fix clipboard and Problems panel paths T036 / T037 expose.

---

## Phase 8: Polish and cross-cutting

- [x] T041 [P] Docs: new `docs/decisions/0027-typed-fields.md` (three sources and materialisation R1, format and S12 / S13 R2, layout R3, per-type on-card, conversions R6, dangling values, person spelling); `docs/decisions/0022-schema-roadmap.md` typed-fields rows marked built and refined (`unit`, `icon`, `fieldDefaults`, built-in entries); `DESIGN.md` (fields block details, field editor, Add field); `packages/schema/CLAUDE.md` (S12 / S13), `packages/model/CLAUDE.md` (`fields.ts`, `field-values.ts`, `ops/fields.ts`, storage lines), `apps/app/CLAUDE.md` (`card-fields.ts`, `fields/typed-fields-section.tsx`, value controls); `docs/backlog.md` §032 status. Do not name other diagram or database tools anywhere.
- [x] T042 Accessibility pass: keyboard-only quickstart step 9; visible focus on every row, control, switch and menu; names per [contracts/fields-ui.md](contracts/fields-ui.md); announcements; a greyscale screenshot of field chips still readable by text.
- [x] T043 Run the quickstart walk 1–9 light and dark; screenshots in `specs/032-typed-fields/screens/`, results in `quickstart-results.md`.
- [x] T044 Performance: add `BENCH_FIELDS=1` to `apps/app/bench/perf.bench.ts` and `apps/app/src/bench/generate-deck.ts` (500 Task / Warehouse / Issue cards with four on-card values); run it, `pnpm bench` and `BENCH_TYPES=1` → `bench-after.md` vs `bench-before.md`; re-run `scene.perf`.
- [x] T045 Definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all pass, no skipped or `.only` tests, smoke suite green. Final report: what changed, what was skipped, what is uncertain, bench numbers, next step. Stop; do not start the next feature.

---

## Dependencies and order

- **Phase 1 → Phase 2 → stories → Phase 8.** Phase 2 blocks everything.
- **Inside Phase 2**: T003 → T004 → T005 (schema); T006 / T007 → T008 (needs T004 types); T009 / T010 → T011 (needs T008); T012 → T013.
- **US1** first (drawer list and controls). **US2** needs US1's section for the "On card" switch but its pure parts (T020–T026) can start right after Phase 2. **US3** extends US1's section. **US4** needs US1 + US2. **US5** needs US1–US2.
- **Priorities**: P1 = US1, US2; P2 = US3, US4; P3 = US5.

## Parallel examples

- Phase 2: T003, T006, T007, T009, T010, T012 are test-writing in different files and start together (model tests after T004).
- US1: T014, T015, T016 in parallel; T017 → T018 → T019.
- US2 alongside US1: T020, T021, T023, T024 in parallel; T025 / T026 after Phase 2; T027 after T018.
- With two agents: one takes the drawer (US1, US3, US4); the other the card and export (US2) and search / bulk (US5).

## Implementation strategy

1. **MVP = Phase 1 + Phase 2 + US1 + US2.** Users fill typed fields (with type defaults) in the drawer and see the chosen ones on cards and in exports. Check frames 124 / 120 (T029).
2. Add **US3** (manage definitions, kind change) and **US4** (built-ins in the list).
3. Add **US5** (bulk, search, clipboard, problems), then Phase 8.
4. Keep commits small: one per task or tight group. Run `pnpm lint && pnpm typecheck && pnpm test` after each phase.
