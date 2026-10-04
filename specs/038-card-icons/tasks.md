# Tasks: Card Icons

**Input**: design documents in `specs/038-card-icons/`:

- [plan.md](plan.md) and [spec.md](spec.md), with the clarify answers (2026-10-03: curated set of about 300 lucide icons; 2026-10-04: unreadable `icon` text stays valid and is kept; no icon on nodes drawn as shapes; in-app licence placement deferred).
- [research.md](research.md) (R1–R12: generated geometry, catalog, resolver, format, model op, surfaces, placement, picker, unknowns, bundle / bench, solid test set, notices) and [data-model.md](data-model.md).
- [contracts/icons-api.md](contracts/icons-api.md) (resolver, search, `IconGlyph`, `setNodeIcon`, `iconUsage`, export, generator) and [contracts/icons-ui.md](contracts/icons-ui.md) (entry points, picker roles and keys, surfaces).
- [quickstart.md](quickstart.md). There is **no design frame** for the picker: follow the 020 colour popover (frames 91, 105–107) and the Add palette grid, with `DESIGN.md` tokens.

**Tests are required.** Constitution VI asks for:

- Unit tests (Vitest) for every pure module and model op; a round-trip case for every model change; Ajv / Zod parity stays green.
- Component tests (Testing Library) by role and name, as listed in the UI contract.

Write each new test first and watch it fail. Do not add Playwright tests. The smoke suite must keep passing.

**Scope guards**:

- **Stored values are never rewritten**: `icon` is written only by a pick (`lucide:<name>`, lowercase) or removed by Reset. Load, save, copy / paste and round-trip keep `Server`, `simple:kafka`, `mdi:database` as written.
- **No schema shape change**: `node.icon` stays non-empty `Text`; only its description changes. No version bump, no new problem kind.
- **Cards only**: nodes whose `effectiveFamily` is `'shape'` draw no icon and are not changed by the picker; their stored icon is kept.
- **The type name stays** next to the icon everywhere it shows today; the tile tone stays the type's.
- **One resolver**: every surface calls `nodeIcon`; no surface re-implements the precedence.
- **No network**: all icon data bundled; no `lucide-react/dynamic`.
- **Out of scope**: other icon sets (only a test-only fixture), lucide icons outside the catalog, uploaded icons, icon colour or size options, icons on groups / stickies / connectors / flows, the Add palette's type icons, an in-app licences page, new e2e tests.
- Do not name other diagram or database tools anywhere (docs, code, comments, UI copy).

**Approvals**: no new runtime dependency. `tsx` becomes a devDependency of `packages/ui` (already used by `packages/schema`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US5 from spec.md.

## Path Conventions

- **UI package**: `packages/ui/src/…`, tests in `packages/ui/test/`; read `packages/ui/CLAUDE.md` first.
- **Schema**: `packages/schema/…`; read `packages/schema/CLAUDE.md`.
- **Model**: `packages/model/src/…`, tests in `packages/model/test/`; read `packages/model/CLAUDE.md`.
- **App**: `apps/app/src/…`, tests next to the code; read `apps/app/CLAUDE.md`; use the `react-flow` skill for card, group and proxy changes (`deck-node.tsx`, `deck-to-flow.ts`, `collapsed-group-node.tsx`, `outside-proxy-node.tsx`).
- **Commits**: small Conventional Commits (`feat(ui): …`, `feat(schema): …`, `feat(model): …`, `feat(app): …`, `docs: …`). No AI attribution lines.

---

## Phase 1: Setup

- [ ] T001 Work on branch (or worktree) `038-card-icons` from the latest `main` (at or after `9e7f779`). Run `pnpm install && pnpm lint && pnpm typecheck && pnpm test`. Re-check the names listed under **Dependency** in plan.md still exist; note any rename in plan.md before continuing.
- [ ] T002 Take baselines on unchanged code: `pnpm bench` and `BENCH_TYPES=1 pnpm bench` → `specs/038-card-icons/bench-before.md`; `pnpm --filter @sododeck/app build` and record the gzip size of the editor route chunk and the entry chunk → `specs/038-card-icons/bundle-size.md` (before column).

---

## Phase 2: Foundational (icon data, resolver, format, model op)

**Purpose**: the icon set data, the one resolver, the glyph renderer, the schema description and the model op. Test-first; nothing visible changes yet.

### Icon set data (packages/ui)

- [ ] T003 [P] Create `packages/ui/src/icon-sets/types.ts` with `IconNode` (moved unchanged from `apps/app/src/editor/export/icon-paths.ts`), `IconSet`, `IconEntry`, `IconCategory`, `ResolvedIcon`, `NodeIconResult` exactly as in [data-model.md](data-model.md). Do not delete `icon-paths.ts` yet (T034); re-export `IconNode` from it so the app still compiles.
- [ ] T004 [P] Write `packages/ui/src/icon-sets/lucide-catalog.ts`: the 12 categories in research R2 order (Compute, Data, Network, Cloud, Security, People, Devices, Messaging, Files, Business, Logistics, Status & Shapes) and about 300 entries `{ name, label, category, keywords }` suited to architecture, process and logistics diagrams. Include every icon `TYPE_STYLE` uses (box, database, router, monitor-smartphone, arrow-left-right, cloud, puzzle, square-check, diamond, file-text, warehouse, truck, ticket) and `shapes` (fallback). Labels are short Title Case words; keywords are lowercase synonyms (e.g. Database: `db`, `sql`, `storage`, `table`; Search: `find`, `magnifier`, `lookup`). Names must exist in lucide-react 1.48.0 (`node_modules/lucide-react/dist/esm/icons/<name>.mjs`).
- [ ] T005 Add `tsx` as a devDependency of `packages/ui` and a `generate:icons` script; add root script `"icons:generate": "pnpm --filter @sododeck/ui generate:icons"` in `package.json`. Write `packages/ui/scripts/generate-icons.ts`: for each catalog name plus the chrome names (the lucide names behind today's non-type `ICON_PATHS` keys: rules, children, sticky, chevron, enter, the six status icons, date, date-range, link — read them off `apps/app/src/editor/export/icon-paths.test.tsx`), import `__iconData` from the installed `lucide-react/dist/esm/icons/<name>.mjs`, strip `key` attributes, and write `packages/ui/src/icon-sets/lucide.generated.ts` (sorted by name: `{ node, aliases }`, header naming the lucide-react version and "generated by pnpm icons:generate, do not edit") through Prettier. Also write `apps/app/public/third-party-notices.txt` (heading "lucide-react <version> (ISC)" then the package `LICENSE` text) with a `TODO(open-source): link from the app once the licence page is decided` comment in the script. Exit non-zero naming any missing icon.
- [ ] T006 [P] Write failing tests in `packages/ui/test/icon-sets/generated.test.ts`: re-run the generator's read in memory and compare with `lucide.generated.ts` (stale → fail with "run pnpm icons:generate"); `third-party-notices.txt` contains the installed `LICENSE` text; and in `packages/ui/test/icon-sets/catalog.test.ts`: names unique and `[a-z0-9-]+`, every category used and known, keywords lowercase, every entry has generated geometry, every `TYPE_STYLE` icon and `shapes` present, about 300 entries (250–350).
- [ ] T007 Run `pnpm icons:generate`; add `packages/ui/src/icon-sets/lucide.ts` (joins catalog + generated geometry + aliases into the `IconSet` with `id: 'lucide'`, `name: 'Lucide'`, `style: 'line'`, `licence: { spdx: 'ISC', … }`) and `packages/ui/src/icon-sets/index.ts` (`ICON_SETS = [lucide]` and the public exports). Expose it the way `@sododeck/ui/lib/icons` is exposed (check `packages/ui/package.json` exports; add `@sododeck/ui/icon-sets` if needed). T006 passes.
- [ ] T008 In `packages/ui/src/lib/icons.ts` add the lucide name to each `TypeStyle` (`iconName: 'box'`, …; `TYPE_FALLBACK.iconName = 'shapes'`), keeping the `icon` component for existing callers until they move.

### Resolver, search, glyph (packages/ui)

- [ ] T009 [P] Create the test-only solid set `packages/ui/test/fixtures/solid-test-set.ts` (`id: 'solid-test'`, `style: 'solid'`, three icons with simple filled paths, one alias).
- [ ] T010 [P] Write failing tests `packages/ui/test/icon-sets/resolve.test.ts` per [contracts/icons-api.md](contracts/icons-api.md): the `parseIconRef` table (`server`, `lucide:server`, `Lucide:Server`, `simple:kafka`, `a b`, `a:b:c`, `:x`, `x:`, `mdi_db`); `resolveIcon` known / unknown set / unknown name / alias / same object on repeat; `iconRef`; `nodeIcon` precedence (custom → type → fallback, `source`, `unavailable` true only when `icon` is set and unresolved, unknown type → fallback); every function with `[lucide, solidTestSet]` resolves `solid-test:…`.
- [ ] T011 Implement `packages/ui/src/icon-sets/resolve.ts` (`parseIconRef`, `resolveIcon` with a per-string `Map` cache keyed by set list, `iconRef`, `nodeIcon`, `chromeIcon(name)` for export chrome). T010 passes.
- [ ] T012 [P] Write failing tests `packages/ui/test/icon-sets/search.test.ts`: ranking exact → prefix → keyword prefix → substring, ties in catalog order; case-insensitive; empty query → `[]`; set filter; "db" ranks Database first and includes Server and Hard drive; 1,000 queries over the catalog finish in < 100 ms total.
- [ ] T013 Implement `packages/ui/src/icon-sets/search.ts` (`searchIcons`). T012 passes.
- [ ] T014 [P] Write failing tests `packages/ui/test/components/icon-glyph.test.tsx` and extend the `TypeTile` test: line icon → `svg` with `fill="none"`, `stroke="currentColor"`, given stroke width, round caps; solid fixture → `fill="currentColor"` and no stroke; `aria-hidden`; `TypeTile` with `icon` draws that icon's paths and keeps the type's tone class.
- [ ] T015 Implement `packages/ui/src/components/icon-glyph.tsx` (`IconGlyph`) and add the optional `icon?: ResolvedIcon` prop to `packages/ui/src/components/type-tile.tsx`. T014 passes.

### Format and model

- [ ] T016 [P] Update `node.icon`'s description in `packages/schema/schema/v1.json` to: "Icon reference `set:icon` (e.g. `lucide:server`); without a set it means lucide. A reference the app cannot show is kept and the node shows its type icon." Run `pnpm schema:generate`; add `"icon": "lucide:server"` to one node in `packages/schema/examples/full.sododeck.json`. Schema tests and parity stay green.
- [ ] T017 [P] Write failing model tests: `packages/model/test/node-icon.test.ts` (set one / many in one undo step; `null` deletes the key; skips nodes already at the value; no transaction when nothing changes; unknown id or `""` throws and writes nothing; any non-empty string accepted; syncs to a second doc), `packages/model/test/icons.test.ts` (`iconUsage`: most used first, ties by node order, refs as written, empty deck → `[]`), and add round-trip cases to `packages/model/test/round-trip.test.ts` for `lucide:server`, `server`, `Server`, `simple:kafka`, `lucide:no-such-icon`, `mdi:database`, `a b` (byte-identical).
- [ ] T018 Implement `packages/model/src/ops/node-icon.ts` (`setNodeIcon`, modelled on `ops/node-display.ts`), wire `editor.setNodeIcon` in `packages/model/src/editor.ts`, add `packages/model/src/icons.ts` (`iconUsage`), export both from `packages/model/src/index.ts`. T017 passes.

**Checkpoint**: `pnpm lint && pnpm typecheck && pnpm test` green; no visible change.

---

## Phase 3: User Story 1 - Pick an icon for a card (Priority: P1) 🎯 MVP

**Goal**: select one card, open the picker from the toolbar, the context menu or the drawer, search, pick; the tile shows it, the type name stays, JSON shows `lucide:<name>`, one ⌘Z undoes it; Reset brings back the type icon.

**Independent Test**: quickstart manual rows 1, 2, 9; the US1 component tests below.

### Tests for User Story 1 (write first)

- [ ] T019 [P] [US1] Write failing tests `apps/app/src/editor/icons/icon-picker.test.tsx` per [contracts/icons-ui.md](contracts/icons-ui.md): `dialog` "Choose icon"; `searchbox` "Search icons" focused on open; typing "search" lists a `gridcell` button "Search" first; "zzzz" shows "No icons match" and `button` "Clear search" restores the sections; one `grid` per category named by its label; the current icon has `aria-selected="true"` and a check mark; every icon button has its label as name and tooltip; footer shows the focused icon's label; arrows move 2-D within a grid and across sections; Tab order search → grids → Reset; Enter applies; Esc closes and returns focus to the opener; no set filter with one set, a `radiogroup` "Icon set" with the solid fixture added.
- [ ] T020 [P] [US1] Write failing tests `apps/app/src/editor/icons/apply-icon.test.ts`: `applyIcon(editor, selection, ref | null)` calls `setNodeIcon` once with only the ids whose `effectiveFamily` is `'card'`; nothing to change → no call; one ⌘Z restores.
- [ ] T021 [P] [US1] Write failing tests for the card: `apps/app/src/editor/deck-to-flow.test.ts` (node data carries `icon`; changing only `icon` produces a new node object; unchanged icon keeps the cached object) and `apps/app/src/editor/deck-node.test.tsx` (tile draws the custom icon's paths and still shows the type name; Landscape plate draws it; no `icon` → the type icon as today; coloured card keeps the same tone / ink classes on the icon).
- [ ] T022 [P] [US1] Write failing tests for the entry points: `apps/app/src/editor/actions/style-actions.test.ts` (`style.icon` offered in toolbar and menu for one component; not for a sticky, connector or group alone; not when every selected node is a shape; not in flow mode or recording), `apps/app/src/editor/quick-edit/selection-toolbar.test.tsx` (`button` "Icon" opens the picker popover), `apps/app/src/editor/inspector/node-inspector.test.tsx` (the header tile is a `button` "Change icon" with tooltip = current label or "Type icon"; click or Enter opens the same picker anchored to the tile; a pick updates the tile and the card; Esc returns focus to the tile; a node drawn as a shape has a plain tile, not a button).

### Implementation for User Story 1

- [ ] T023 [US1] Move `neighbour()` from `apps/app/src/editor/palette.tsx` to `apps/app/src/editor/grid-nav.ts` (same behaviour; palette tests unchanged).
- [ ] T024 [US1] Implement `apps/app/src/editor/icons/apply-icon.ts` (targets via `effectiveFamily` from `@sododeck/model`, one `editor.setNodeIcon` call). T020 passes.
- [ ] T025 [US1] Implement `apps/app/src/editor/icons/icon-picker.tsx` (props: `current: string | null | 'mixed'`, `cardCount`, `usage`, `sets`, `onPick(ref)`, `onReset()`, `onClose()`): `SearchField`, sections from the catalog, results grid while searching via `searchIcons`, `IconGlyph` cells at stroke 1.5, ring + check on current, "Reset to type icon", footer, `grid-nav` keys, printable keys forwarded to the search field, reduced-motion safe. Tokens only. T019 passes.
- [ ] T026 [US1] Add `'icon'` to `ToolbarFieldId` in `apps/app/src/state/ui-store.ts` and its name in `apps/app/src/editor/quick-edit/field-popover.tsx`; add `apps/app/src/editor/icons/icon-field.tsx` (toolbar popover content: reads the selection's icons from the document, renders `IconPicker`, calls `applyIcon`); add the `style.icon` action next to `style.colour` in `apps/app/src/editor/actions/style-actions.ts` (label "Icon", `field: 'icon'`, `where.toolbar` / `where.menu` for `component`, `components`, `mixed`, default `modes`, `applies` = at least one selected node drawn as a card); the toolbar button shows the current icon (or a mixed glyph).
- [ ] T027 [US1] Add `icon` to node data in `apps/app/src/editor/deck-to-flow.ts` (`toFlowNode` and its cache compare); in `apps/app/src/editor/deck-node.tsx` draw `nodeIcon({ icon: data.icon, type: data.kind }).icon` with `IconGlyph` in the header tile (14 px, stroke 2) and on the Landscape plate (30 px, stroke 2). T021 passes.
- [ ] T028 [US1] Make the node inspector's header tile clickable: in `apps/app/src/editor/inspector/node-inspector.tsx` (and `inspector-frame.tsx` if its `icon` slot needs a button variant) render the tile from `nodeIcon` inside a `button` "Change icon" with a pencil badge on hover / focus (tokens, `focusRing`), opening `IconPicker` in a popover anchored to the tile and writing through `applyIcon`. No Icon row in `appearance-section.tsx` (founder, 2026-10-04). Shapes keep the plain tile. T022 passes.

**Checkpoint**: quickstart rows 1, 2, 9 work; JSON panel shows `"icon": "lucide:search"`.

---

## Phase 4: User Story 2 - Set the icon of several cards at once (Priority: P1)

**Goal**: one pick or Reset changes every selected card in one undo step; Mixed when icons differ; non-card items untouched and counted.

**Independent Test**: quickstart rows 3, 4, 5.

### Tests for User Story 2 (write first)

- [ ] T029 [P] [US2] Extend `apps/app/src/editor/icons/icon-field.test.tsx` (new): five cards with different icons → header "Mixed", no `aria-selected` cell; pick "Zap" → all five, one ⌘Z restores each previous value (custom or none); cards + sticky + connector + a node drawn as a shape → "Changes N cards" with N = card count, only cards written, the shape's stored icon unchanged; Reset disabled when no selected card has an icon.
- [ ] T030 [P] [US2] Extend `apps/app/src/editor/inspector/bulk-inspector.test.tsx`: the bulk drawer has no icon entry (multi-select changes go through the toolbar and menu); the toolbar picker with the drawer open on a bulk selection still applies to every selected card in one step.

### Implementation for User Story 2

- [ ] T031 [US2] In `apps/app/src/editor/icons/icon-field.tsx` compute `current` (`'mixed'` when card icons differ, `null` when none set) and `cardCount`; show the scope line "Changes N cards" when the selection has non-card items or more than one card. T029 passes.
- [ ] T032 [US2] Confirm the toolbar / menu path with the bulk drawer open (no bulk drawer changes needed); adjust `icon-field.tsx` if focus or popover stacking conflicts with the drawer. T030 passes.

**Checkpoint**: US1 and US2 both work; one undo step per pick everywhere.

---

## Phase 5: User Story 3 - Icons stay right everywhere (Priority: P1)

**Goal**: every surface that draws a node's type icon draws the resolved icon; export draws from the same geometry; both themes readable.

**Independent Test**: quickstart rows 6, 7, 10; the tests below.

### Tests for User Story 3 (write first)

- [ ] T033 [P] [US3] Write failing export tests in `apps/app/src/editor/export/scene.test.ts` and `render-svg.test.ts`: a card with `icon: 'lucide:search'` → `SceneCard.icon.name === 'search'` and the SVG contains its paths in the header tile; collapsed-group members and ports carry their own icons; a card with `simple:kafka` exports its type icon; with the solid fixture set the SVG icon group uses `fill` and no stroke; existing export snapshots for decks without `icon` stay byte-identical.
- [ ] T034 [US3] Switch export to the shared table: `apps/app/src/editor/export/scene.ts` stores `ResolvedIcon` (from `nodeIcon`) on cards, members and ports instead of `IconKey`; `render-svg.ts` `icon()` draws `ResolvedIcon.node` by its `style` with today's sizes and stroke widths; chrome icons via `chromeIcon(name)`. Delete `apps/app/src/editor/export/icon-paths.ts` and `icon-paths.test.tsx` (freshness is now T006). T033 passes.
- [ ] T035 [P] [US3] Add the optional `icon` prop to `apps/app/src/editor/shapes/type-glyph.tsx` and `shape-tile.tsx` (`NodeTypeTile`); shape types ignore it (they draw their outline). Test in `shape-tile.test.tsx`.
- [ ] T036 [P] [US3] Collapsed groups: `apps/app/src/editor/visible-graph.ts` builds `members: { kind, icon? }[]` instead of `memberKinds`; update the compare and copy in `deck-to-flow.ts` and the tiles in `collapsed-group-node.tsx`. Tests in `visible-graph.test.ts` and `collapsed-group-node.test.tsx` (each member's own icon; changing one member's icon re-renders the group).
- [ ] T037 [P] [US3] Drill-in proxies (034): carry `icon` next to `kind` in `apps/app/src/editor/proxy-layout.ts`, `deck-to-flow.ts` (`exportPortRects`, `portNodes` and their cache compare) and draw it in `outside-proxy-node.tsx`. Tests in `proxy-layout.test.ts` and `outside-proxy-node.test.tsx`.
- [ ] T038 [P] [US3] Outline: add `icon` to the node item in `apps/app/src/editor/outline.ts` and pass it to `NodeTypeTile` in `outline-tree.tsx`; the type name stays. Tests in `outline.test.ts` / `outline-tree.test.tsx`.
- [ ] T039 [P] [US3] Other node-icon spots: `apps/app/src/editor/flows/inspector-step.tsx` (`kindOf` → kind + icon), `rules/used-in.tsx`, `connect-popover.tsx` with `connection-rules.ts` (option carries `icon`). One test each asserting the custom icon is drawn.
- [ ] T040 [P] [US3] Command palette: fill `CommandDialogItem.icon` for node results in `apps/app/src/editor/command-palette/palette-results.ts` with an `IconGlyph` of `nodeIcon(node)`; test in `palette-results.test.ts` (node result has an icon; other result kinds unchanged).

**Checkpoint**: every surface in research R6 shows the custom icon; export identical for decks without icons.

---

## Phase 6: User Story 4 - Files from newer versions and other sets stay safe (Priority: P2)

**Goal**: unknown sets, unknown names and unreadable text show the type icon, are kept byte-identical, and the drawer says so; a reference without a set means lucide.

**Independent Test**: quickstart row 8; round-trip cases from T017.

- [ ] T041 [P] [US4] Write failing tests: `apps/app/src/editor/inspector/node-inspector.test.tsx` (card with `simple:kafka` → header tile shows the type icon with a warning badge; tooltip and picker header show `simple:kafka` in mono and "Icon not available in this version"; picking replaces it; Reset removes it); `deck-node.test.tsx` (`simple:kafka`, `lucide:no-such-icon`, `mdi:database` → type icon; `server` and `Server` → lucide server); `apps/app/src/editor/problems` test (no problem reported for these refs); an import → export test in `apps/app/src/storage` or the existing file round-trip test (values byte-identical).
- [ ] T042 [US4] Implement the unavailable state from `nodeIcon(...).unavailable`: warning badge and tooltip on the drawer tile in `apps/app/src/editor/inspector/node-inspector.tsx`, the stored value + note in the picker header (`icon-picker.tsx`), and the toolbar button's tooltip. T041 passes.

---

## Phase 7: User Story 5 - Find the icons the deck already uses (Priority: P3)

**Goal**: "Used in this deck" lists the deck's custom icons, most used first, per deck.

**Independent Test**: quickstart row 3 with icons already used; tests below.

- [ ] T043 [P] [US5] Write failing tests in `apps/app/src/editor/icons/icon-picker.test.tsx` and `icon-field.test.tsx`: section `grid` "Used in this deck" first, most used first; `server` and `lucide:server` merged into one cell; unresolvable refs not shown; hidden when no card has an icon and while searching; a second deck lists only its own icons.
- [ ] T044 [US5] Feed `iconUsage(snapshot)` (memoised per document snapshot) from `icon-field.tsx` and the drawer tile into `IconPicker`; resolve and merge rows that resolve to the same icon, keeping the first-seen order for ties. T043 passes.

---

## Phase 8: Polish and cross-cutting

- [ ] T045 [P] Docs: new `docs/decisions/0028-icon-references-and-icon-sets.md` (R1 generated geometry, R2 catalog, R3 resolver and precedence, R4 permissive `icon` and the "icon set" term vs 030's "pack", R11 extensibility, R12 notices deferred); `docs/decisions/0022-schema-roadmap.md` row for `node.icon` (refined by 038); `docs/decisions/0016-export-rendering.md` point 5 marked superseded by 0028; `DESIGN.md` (icon picker: popover size, grid cell size, ring + check, footer); `packages/ui/CLAUDE.md` (`icon-sets/`, `IconGlyph`, `pnpm icons:generate`), `packages/model/CLAUDE.md` (`setNodeIcon`, `iconUsage`), `apps/app/CLAUDE.md` (`editor/icons/`, `grid-nav.ts`, export icons); `README.md` commands table (`pnpm icons:generate`); `docs/backlog.md` §038 status. Do not name other diagram or database tools anywhere.
- [ ] T046 Performance: add `BENCH_ICONS=1` to `apps/app/bench/perf.bench.ts` and `apps/app/src/bench/generate-deck.ts` (every card gets a catalog icon, round-robin); run it, `pnpm bench` and `BENCH_TYPES=1 pnpm bench` → `specs/038-card-icons/bench-after.md` vs `bench-before.md` (SC-005: within 5 %); rebuild and fill the after column of `bundle-size.md` (budget: editor chunk + ≤ 25 KB gzip).
- [ ] T047 Accessibility pass: quickstart row 9 keyboard-only; visible focus on every cell, Reset and the toolbar button; names per [contracts/icons-ui.md](contracts/icons-ui.md); selected icon distinguishable in a greyscale screenshot (ring + check).
- [ ] T048 Run the quickstart manual walk 1–13 in light and dark; screenshots in `specs/038-card-icons/screens/`, results in `specs/038-card-icons/quickstart-results.md`.
- [ ] T049 Definition of done: `pnpm icons:generate` leaves git clean; `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all pass, no skipped or `.only` tests, smoke suite green (incl. no third-party requests). Final report: what changed, what was skipped, what is uncertain, bench and bundle numbers, next step. Stop; do not start the next feature.

---

## Dependencies and order

- **Phase 1 → Phase 2 → stories → Phase 8.** Phase 2 blocks everything.
- **Inside Phase 2**: T003 / T004 → T005 → T006 → T007 → T008; T009 / T010 → T011 (needs T007); T012 → T013; T014 → T015 (needs T011); T016 and T017 → T018 are independent of the UI package tasks.
- **US1** needs Phase 2. **US2** extends US1's `icon-field.tsx`. **US3** needs only Phase 2 (T034 also needs T011's `chromeIcon`); T035 before T038 / T039. **US4** needs US1's drawer tile (T028) and picker (T025). **US5** needs US1's picker (T025).
- **Priorities**: P1 = US1, US2, US3; P2 = US4; P3 = US5.

## Parallel examples

- Phase 2: T003, T004, T009, T016, T017 start together; then T010, T012, T014 in parallel once T007 lands.
- US1: T019, T020, T021, T022 (tests) in parallel; then T023 → T024 → T025 → T026, with T027 and T028 alongside.
- US3 alongside US1: T033 → T034 (export) by one agent; T035 then T036, T037, T038, T039, T040 in parallel by another.
- With two agents: one takes the picker (US1, US2, US4, US5); the other the surfaces and export (US3).

## Implementation strategy

1. **MVP = Phase 1 + Phase 2 + US1.** A user can give one card an icon, see it on the card and in the drawer, and undo it.
2. Add **US2** (multi-select) and **US3** (every surface and export) — together they complete the P1 promise.
3. Add **US4** (unknown references) and **US5** (Used in this deck), then Phase 8.
4. Keep commits small: one per task or tight group. Run `pnpm lint && pnpm typecheck && pnpm test` after each phase.
