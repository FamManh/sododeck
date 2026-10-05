# Tasks: Sticky notes and connector multi-select (053)

**Inputs**:

- [plan.md](plan.md), [spec.md](spec.md). Clarify answers (2026-10-05): keep the five sticky colours; sticky tags share the deck's tag list (same colours, picker, rename, delete); reference screenshots stay local in `reference/` (git-ignored, never pushed).
- [research.md](research.md) (R1–R13), [data-model.md](data-model.md), [contracts/file-format.md](contracts/file-format.md), [contracts/ui.md](contracts/ui.md), [quickstart.md](quickstart.md).
- Precedents to copy: ADR 0031 / spec 050 (a widened connector end), 043 `Node.locked` (a lock field), 033 (tags).

**Tests**: required (constitution VI). Write each story's tests first and watch them fail. No new e2e; the smoke suite must stay green.

**Organization**: one phase per user story in spec priority order (US1, US2 are P1; US3, US4 are P2). All stories build on Phase 2 and are otherwise independent. US4 can ship separately from US1 to US3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1 to US4 from spec.md.

## Path Conventions

- App: `apps/app/src/` (editor in `apps/app/src/editor/`, UI store `apps/app/src/state/ui-store.ts`)
- Model: `packages/model/src/`, tests in `packages/model/test/`
- Schema: `packages/schema/schema/v1.json`, tests in `packages/schema/test/`
- Never commit or attach anything from `specs/053-sticky-notes-and-connectors/reference/`.

---

## Phase 1: Setup

- [ ] T001 Confirm branch `053-sticky-notes-and-connectors` and a green baseline: `pnpm install && pnpm lint && pnpm typecheck && pnpm test`. Run `pnpm bench` and save the output as `specs/053-sticky-notes-and-connectors/bench-before.md` (500 nodes / 1,000 edges numbers).
- [ ] T002 Commit the spec folder (spec, plan, research, data-model, contracts, quickstart, tasks, checklists; not `reference/`) plus the `docs/backlog.md` and `.gitignore` changes as `docs: sticky notes and connector multi-select spec, plan and tasks (053)`. Check `git status` shows no file under `reference/`.

---

## Phase 2: Foundational (format, model, pure helpers)

**Purpose**: the additive file format fields, sticky as a connector end in the model, lock and tags in the model, the sticky box and the fit function. Every story needs these.

### Format

- [x] T003 [P] Add fixtures to `packages/schema/test/fixtures.ts`: valid sticky with `size`, `fontSize`, `align`, `tags`, `locked`; valid edge with `locked` and with a sticky id as `from`; invalid `fontSize: 13`, `fontSize: "16"`, `align: "justify"`, `locked: false`, `size: {w: 0, h: 10}`, sticky `tags: "a"`, edge `locked: "yes"`. Watch the invalid ones fail to be refused.
- [x] T004 Edit `packages/schema/schema/v1.json` per contracts/file-format.md: Sticky gets `size` (`$defs/Size`), `fontSize` (integer enum 12, 14, 16, 20, 24, 32), `align` (left, center, right), `tags` (`$defs/Tags`), `locked` (`const: true`), appended after `showInFlows` in that order; Edge gets `locked` (`const: true`); `Edge.from` / `to` descriptions say "node, group or sticky". Every property keeps a `description`. Run `pnpm schema:generate`.
- [x] T005 Update `packages/schema/examples/full.sododeck.json` so a sticky uses every new field and an edge uses `locked` and a sticky end (the coverage test requires it). Update the S-rule wording in `packages/schema/src/semantic-rules.ts` for edge ends (nodes | groups | stickies) and add the id-collision rule (a node, group and sticky sharing an id when an edge end names it). Update `packages/schema/CLAUDE.md` (status paragraph and the sticky key-order note). Run `pnpm --filter @sododeck/schema test`.

### Model: sticky ends, cascade, geometry

- [x] T006 [P] Write model tests in `packages/model/test/stickies.test.ts`, `integrity.test.ts`, `cascade.test.ts`: an edge with a sticky end passes `validate` and `checkIntegrity`; a missing sticky end is `missing-reference`; a node and a sticky sharing an id that an edge names is `duplicate-id`; deleting a sticky removes its connectors in one undo step and `previewRemoval` lists them; deleting a node still frees pinned stickies; `endpointOf` and `endpointTitle` resolve a sticky (title is the sticky label).
- [x] T007 Implement sticky ends in `packages/model/src/ops/refs.ts` (`edges.from` / `to` target `nodes|groups|stickies`), `packages/model/src/ops/integrity.ts` (ends include stickies, collision check), `packages/model/src/endpoint.ts` (a third collection, keep the `WeakMap` cache), `packages/model/src/ops/cascade.ts` (call `removeEdgesAt` for the `stickies` case). T006 is green.
- [x] T008 [P] Write `packages/model/test/geometry.test.ts` cases for `STICKY_DEFAULT_SIZE` (200 × 200), `STICKY_MIN_SIZE` (96 × 96), `stickyBox(sticky, position)` (default size, stored size, collapsed one-line height 40) and size clamping.
- [x] T009 Implement `STICKY_DEFAULT_SIZE`, `STICKY_MIN_SIZE`, `stickyBox` and `clampStickySize` in `packages/model/src/geometry.ts`; export from `packages/model/src/index.ts`. T008 is green.

### Model: sticky fields, lock, tags

- [x] T010 [P] Write model tests: `packages/model/test/round-trip.test.ts` (each new field round-trips; a deck without them is unchanged after an unrelated edit; unknown optional data is kept), `packages/model/test/stickies.test.ts` (`setStickySize` clamps and is one undo step, `setStickyFont` / `setStickyAlign` set and clear), `packages/model/test/node-lock.test.ts` (lock on nodes, stickies and edges; locked objects refuse move, resize, delete, reconnect, reshape; unlock allowed; one undo step).
- [x] T011 Implement in `packages/model/src/ops/stickies.ts` the setters `setStickySize`, `setStickyFont`, `setStickyAlign`, `setStickyColour` (batch over ids, one step); generalise `setLocked(ctx, collection, ids, locked)` in `packages/model/src/ops/node-lock.ts` for `nodes | stickies | edges` (it hard-codes `nodes` today) and make move, resize, delete and edge-shape ops refuse locked targets; expose through `packages/model/src/editor.ts` and `index.ts`. T010 is green except tags.
- [x] T012 [P] Write model tests in `packages/model/test/tags.test.ts` and `search.test.ts`: `setStickyTags` keeps case, de-duplicates ignoring case, caps at 10; rename, recolour and delete of a tag reach stickies in the same undo step; `tagUsage` reports a `notes` count; sticky tags are found by search.
- [x] T013 Implement sticky tags: `setStickyTags` in `packages/model/src/ops/stickies.ts`, sticky handling in the deck-wide tag ops in `packages/model/src/ops/tags.ts` (rename, delete, colour), the `notes` count in the tag usage type, and tags in the sticky search entry in `packages/model/src/search/`. T012 is green.

### App: pure helpers

- [x] T014 [P] Write `apps/app/src/editor/stickies/fit-font-size.test.ts`: with an injected measurer, short text picks 32; longer text steps down 28, 24, … ; text that fits nowhere returns the minimum 9 with `clipped: true`; a fixed font size bypasses fitting; tag rows reduce the available height; results are cached per (text, width, height, tag rows, align) and recomputed when any changes.
- [x] T015 Implement `apps/app/src/editor/stickies/fit-font-size.ts`: `FIT_STEPS`, `FIXED_FONT_SIZES`, pure `fitFontSize(measure, box, tagRows)` and a `domMeasurer` that renders the note's markdown into one hidden measuring element (same width and typography) and reads `scrollHeight`; module-level cache. T014 is green.
- [x] T016 [P] Add `lastStickyColour` (UI-only, default amber) with a setter to `apps/app/src/state/ui-store.ts`, with a test in `apps/app/src/state/ui-store.test.ts`.

**Checkpoint**: `pnpm --filter @sododeck/schema test && pnpm --filter @sododeck/model test && pnpm --filter @sododeck/app test` are green.

---

## Phase 3: User Story 1 - Comment on a card with a sticky and a connector (Priority: P1)

**Goal**: a connector can start or end on a sticky; moving, deleting, saving and reloading behave like any connector.

**Independent test**: add a sticky, drag from its handle onto a card; the connector follows card moves, ⌘Z removes only the connector, deleting the sticky lists and removes it, reload restores it.

### Tests (write first)

- [x] T017 [P] [US1] `apps/app/src/editor/connection-rules.test.ts`: `connectionCheck` accepts sticky ↔ card, sticky ↔ group, sticky ↔ sticky; refuses sticky → itself (`self`) and a duplicate; `connectTargets` lists stickies for the keyboard connect popover.
- [x] T018 [P] [US1] `apps/app/src/editor/routing/endpoint-target.test.ts`: `targetScene` has a `'sticky'` target; `hitTarget` returns a sticky under the pointer (cards first, then stickies, then the innermost group); `connectTarget` returns it; a sticky is never chosen as the pointer's own end.
- [x] T019 [P] [US1] `apps/app/src/editor/deck-to-flow.test.ts`: an edge with a sticky end gets a box from `stickyBox` (default and stored size, collapsed height), is drawn, follows when the sticky moves, is dropped when stickies are hidden or the sticky is anchored to a hidden node, and the sticky RF node cache equality includes the new fields.
- [x] T020 [P] [US1] `apps/app/src/editor/stickies/sticky-node.test.tsx` (extend): a sticky shows four connection handles when selected or hovered; Enter on a focused sticky opens the connect popover; a locked sticky shows no handles for reconnecting but can still be a target.
- [x] T021 [P] [US1] `apps/app/src/editor/describe-removal.test.ts` and `confirm-delete-dialog.test.tsx`: deleting a sticky with connectors lists them; one undo restores all. `apps/app/src/editor/flows/*.test.ts`: a connector with a sticky end is never offered as a flow step and is dimmed in flow mode.

### Implementation

- [x] T022 [US1] Teach the visible graph about stickies: representative map in `apps/app/src/editor/visible-graph.ts`, `view-filter.ts`, `focus-set.ts`; hidden stickies hide their connectors.
- [x] T023 [US1] In `apps/app/src/editor/deck-to-flow.ts`: add `size`, `tags`, `locked`, `fontSize`, `align` to `StickyNodeData` and to the field-by-field cache equality; `boxFor` and `endGeometry` get a sticky branch using `stickyBox`; the RF node uses the stored size instead of `width: 180`; the sticky node is `connectable: true`.
- [x] T024 [US1] `apps/app/src/editor/connection-rules.ts`: the `Ends` type and `connectTargets` include stickies.
- [x] T025 [US1] `apps/app/src/editor/routing/endpoint-target.ts`: add the `'sticky'` case to `targetScene` and `EndpointTarget.kind`; `apps/app/src/editor/use-canvas-handlers.ts`: `endpointIdOf` handles the `sticky:` prefix; `onConnectEnd` and the end-drag in `editing/endpoint-drag.ts` accept a sticky target.
- [x] T026 [US1] Add four side-named `FlowHandle`s to `apps/app/src/editor/stickies/sticky-node.tsx` (copy the pattern in `group-boundary-node.tsx`: visible on hover or selected, `isConnectable={editable}`, Enter opens the connect popover).
- [x] T027 [P] [US1] Update `describe-removal.ts` if the sticky delete path needs the connector count; check flow code (`flows/session-path.ts`, step pickers) so sticky-ended connectors are skipped. T017 to T021 are green.

**Checkpoint**: quickstart scenario 1 passes by hand.

---

## Phase 4: User Story 2 - A sticky looks like a sticky, resizes and fits its text (Priority: P1)

**Goal**: paper look, stored size with resize, Auto text fit with fixed-size override, tags row, lock glyph.

**Independent test**: a sticky beside a card is clearly different in both themes; resize by a corner and the size survives reload; short text is large, long text shrinks and nothing is cut; a fixed size stops changing.

### Tests (write first)

- [x] T028 [P] [US2] `apps/app/src/editor/stickies/sticky-paper.test.tsx`: renders for all five colours in both themes with accessible text, no header, icon or lip, and reuses tokens only (no hard-coded colour).
- [x] T029 [P] [US2] `apps/app/src/editor/stickies/sticky-node.test.tsx` (extend): default size 200 × 200; stored size applied; Auto text uses the fitted size and updates when text is added or removed; a fixed `fontSize` is used as is; tags render as chips along the bottom and collapse to "+N"; clipped text shows the cue and the full text is still in the document; collapsed shows the one-line form and no resize handles; locked shows the lock glyph and no resize handles.
- [x] T030 [P] [US2] `apps/app/src/editor/stickies/sticky-resize.test.tsx`: corner and side handles resize live, stop at 96 × 96, snap like cards (⌘ turns it off), write `size` once on release in one undo step, Esc cancels, resizing one sticky in a multi-selection resizes only that sticky.
- [x] T031 [P] [US2] `apps/app/src/editor/inspector/sticky-inspector.test.tsx` (extend): rows for size, text size (Auto / fixed), alignment and lock; each is one undo step.

### Implementation

- [x] T032 [US2] Create `apps/app/src/editor/stickies/sticky-paper.tsx` (soft shadow, light gradient, lifted corner; colours from `sticky-tint.ts`; add two neutral shadow tokens to `packages/ui` if none fit) and rebuild `apps/app/src/editor/stickies/sticky-node.tsx` on it: no header, no icon, markdown body with `fitFontSize`, alignment, tags row (reuse `tagChips` and `tagBlockHeight` from `apps/app/src/editor/card-tags.ts`, with a "+N" collapse), lock glyph, clipped-text cue.
- [x] T033 [US2] Add resize to the sticky node (corner and side handles, minimum `STICKY_MIN_SIZE`, snapping and guides as cards in `017-resize-edge-routing`, disabled when collapsed or locked), writing through `setStickySize` once on release.
- [x] T034 [US2] Replace hard-coded widths with `STICKY_DEFAULT_SIZE`: `apps/app/src/editor/export/scene.ts` (`STICKY_SIZE`), `apps/app/src/db/import/place-import.ts` (note width and step), `apps/app/src/bench/generate-deck.ts`; fix tests that assert 180.
- [x] T035 [US2] Extend `apps/app/src/editor/inspector/sticky-inspector.tsx` with size, text size, alignment, tags and lock rows. T028 to T031 are green.

**Checkpoint**: quickstart scenario 2 passes by hand, light and dark.

---

## Phase 5: User Story 3 - Sticky toolbar and pad tile (Priority: P2)

**Goal**: a floating toolbar for stickies (text size, bold, align, link, colour, tags, expand/collapse, pin, lock, delete) and a Sticky tile in the Add flyout drawn as a pad of notes.

**Independent test**: select a sticky, change colour, tag it, lock it; multi-select stickies and change colour once; drag a note from the pad onto a card: the note is free and in edit mode.

### Tests (write first)

- [ ] T036 [P] [US3] `apps/app/src/editor/quick-edit/toolbar-variant.test.ts`: `sticky` and `stickies` variants exist for sticky-only selections; mixed selections keep `mixed`.
- [ ] T037 [P] [US3] `apps/app/src/editor/stickies/sticky-toolbar.test.tsx`: controls by role and name; colour shows the five swatches with the current one ticked; text size lists Auto, 12, 14, 16, 20, 24, 32; align cycles; bold and link wrap the textarea selection while editing and the whole text otherwise; tags button opens the shared picker; expand, pin, lock, delete behave like the inspector; every action over several stickies is one undo step; keyboard reachable; flips inside the viewport; hidden while dragging, panning and in flow mode.
- [ ] T038 [P] [US3] `apps/app/src/editor/tags/tag-picker.test.tsx` and `deck-tags.test.ts` (extend): the picker works for sticky targets (search, create, remove, ten-tag cap); `deckTags` and `tagUsage` count stickies; renaming or deleting a tag updates sticky chips.
- [ ] T039 [P] [US3] `apps/app/src/editor/palette.test.tsx` (extend): the Sticky tile draws a pad in `lastStickyColour`; click places a note at the view centre; drag sets the note payload; dropping over a card creates a free note (never pinned) in edit mode; one undo step; the Sticky tool click on a card still pins.

### Implementation

- [ ] T040 [US3] Generalise `apps/app/src/editor/tags/tag-picker.tsx` to take targets `{ nodeIds, stickyIds }`, update `tags/deck-tags.ts` (`deckTags`, `tagUsage`), `fields/write-nodes.ts` callers, and tag usage text in the tag editor ("used on N cards and M notes").
- [ ] T041 [US3] Add the `sticky` / `stickies` variants in `apps/app/src/editor/quick-edit/toolbar-variant.ts`; create `apps/app/src/editor/actions/sticky-actions.ts` (text size, bold, align, link, colour, tags, expand/collapse, pin, lock, delete, `surface: 'toolbar'`) and `apps/app/src/editor/stickies/sticky-toolbar.tsx` with the popovers (text size, colour, tags); render it from `quick-edit/selection-toolbar.tsx` using the existing placement and hide rules. Colour changes also set `lastStickyColour`.
- [ ] T042 [US3] `apps/app/src/editor/stickies/sticky-actions.ts`: `addNoteAt(editor, point, { pin, colour })`; drop from the pad uses `pin: false` and `lastStickyColour`; update the drop handler in `apps/app/src/editor/use-canvas-handlers.ts`.
- [ ] T043 [US3] `apps/app/src/editor/palette.tsx`: replace the Sticky tile and the bottom "Note" card hint with the pad drawing (reuse `StickyPaper` small, three offset sheets). T036 to T039 are green.

**Checkpoint**: quickstart scenario 3 passes by hand.

---

## Phase 6: User Story 4 - Select several connectors and restyle them (Priority: P2)

**Goal**: a floating toolbar for several selected connectors (arrow ends, line type, colour, weight, lock, more), all one undo step; edges can be locked.

**Independent test**: shift-click three connectors, change colour, weight and an arrow end; one ⌘Z reverts all; lock them and a bend drag is refused.

### Tests (write first)

- [x] T044 [P] [US4] `apps/app/src/editor/actions/connection-actions.test.ts`: for the `connections` target, direction, weight and colour have toolbar surface (today menu-only or single-connector); each applies to all selected ids in one undo step; "mixed" is shown when values differ and nothing changes until a value is picked; mixed selections of connectors and other objects apply only what each type supports.
- [x] T045 [P] [US4] `apps/app/src/editor/quick-edit/selection-toolbar.test.tsx` (extend): the `connections` toolbar order (arrow ends, line type, colour, weight, lock, more), placed above the group of connectors, hidden while dragging, inside the viewport; per-connector bend and anchor handles are not shown for two or more connectors.
- [x] T046 [P] [US4] `apps/app/src/editor/lock.test.tsx` (extend): locked connectors refuse reshape, reconnect and delete; style stays editable only after unlock; lock and unlock over several connectors are one undo step.

### Implementation

- [x] T047 [US4] Edit `apps/app/src/editor/actions/connection-actions.ts`: make `connection.direction`, `connection.weight` and `connection.colour` toolbar actions for `connections` (reuse the `LineStyleControls` popovers in `apps/app/src/editor/line-style/`), and show "mixed" through `lineStyleView`.
- [x] T048 [US4] `apps/app/src/editor/lock.ts`: lock helpers for stickies and edges (`isEdgeLocked`, `isStickyLocked`, `withoutLocked` per collection); wire the lock action in `apps/app/src/editor/actions/common-actions.ts` for `connections`; refuse in `routing/route-handles.tsx`, `editing/endpoint-drag.ts` and delete. T044 to T046 are green.

**Checkpoint**: quickstart scenario 4 passes by hand.

---

## Phase 7: Polish and cross-cutting

- [ ] T049 [P] Export: `apps/app/src/editor/export/scene.ts` and `render-svg.ts` draw stickies at their stored size with wrapped plain text (markdown stripped) at the fitted size via a plain-text measurer, tags chips, lock not drawn, and connectors whose end is a sticky (add sticky rects to the `rects` map); tests in `export/scene.test.ts` and `render-svg.test.ts`, plus `scene.perf.test.ts` still within budget.
- [ ] T050 [P] Outline, search and command palette show sticky connectors with both ends labelled (`apps/app/src/editor/outline.ts`, `command-palette/palette-results.ts`) and sticky tags in search results; JSON panel view in `json-panel-view.ts` shows new fields; tests next to each.
- [ ] T051 [P] Minimap and hover focus: check `canvas.tsx` minimap colour fallback and `hover-focus/use-hover-focus.ts` for sticky connectors; add a test if behaviour changes.
- [ ] T052 [P] Bench: extend `addBenchStickies` in `apps/app/src/bench/generate-deck.ts` with stickies that have connectors; `generate-deck.test.ts` updated. Run `pnpm bench` and save `specs/053-sticky-notes-and-connectors/bench-after.md` next to `bench-before.md`; compare (constitution V).
- [ ] T053 [P] Accessibility pass: keyboard path for resize (arrow keys with a modifier), toolbar, pad tile, connect popover; lock and selection not conveyed by colour alone; names and tooltips with shortcuts.
- [ ] T054 Docs: `DESIGN.md` (Sticky paper look, sticky toolbar, pad tile, connections toolbar), `docs/backlog.md` (053 status and PR), `packages/schema/CLAUDE.md`, `packages/model/CLAUDE.md`, `apps/app/CLAUDE.md` if boundaries changed; write `docs/decisions/0036-sticky-notes-v2.md` (check `ls docs/decisions` first, duplicate 0031 and 0034 exist): additive fields, sticky as a connector end, shared tags, display-only auto-fit, no version bump. Nothing in docs, code or UI copy names another tool.
- [ ] T055 Screenshots (light and dark) of the paper look, toolbar, pad tile and connections toolbar into `specs/053-sticky-notes-and-connectors/screenshots/` (our own app only; never the reference images). Run through `quickstart.md` fully and record results in `quickstart-results.md`.
- [ ] T056 Full gate: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`. Confirm no skipped or `.only` tests, the smoke suite and the no-third-party-requests check pass, and `git status` shows nothing from `reference/`. Open the PR with conventional commits and no AI attribution lines beyond the repo's rules; final report: what changed, skipped, uncertain.

---

## Dependencies and order

- Phase 1 → Phase 2 → stories. Phase 2 blocks everything.
- US1 and US2 touch the same node component (`sticky-node.tsx`): do US1 handles (T026) before US2's rebuild (T032), or merge T026 into T032 if done together.
- US3 depends on US2 (paper component, fit, tags row) and on T013 (tags model). US4 depends only on Phase 2 (lock model T011) and can run in parallel with US2 and US3 by another agent.
- Polish needs all stories.

## Parallel examples

- Phase 2: T003, T006, T008, T010, T012, T014, T016 (tests and pure helpers, different files).
- US1 tests T017 to T021 together; US2 tests T028 to T031 together; US3 tests T036 to T039 together.
- After Phase 2: US4 (T044 to T048) in parallel with US1 and US2.

## Implementation strategy

- **MVP**: Phase 1, Phase 2, US1 (T017 to T027). A sticky can then comment on a card.
- **Increment 1**: US2 (look, resize, fit): the founder's most visible complaint.
- **Increment 2**: US3 (toolbar, tags, pad tile).
- **Increment 3**: US4 (connections toolbar, edge lock), shippable independently.
- Small conventional commits per task group (`feat(model): …`, `feat(app): …`, `docs: …`); do not start 054 to 056.

## Notes

- Counts: 56 tasks. Phase 1: 2; Phase 2: 14 (T003 to T016); US1: 11 (T017 to T027); US2: 8 (T028 to T035); US3: 8 (T036 to T043); US4: 5 (T044 to T048); Polish: 8 (T049 to T056).
