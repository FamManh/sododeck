# Tasks: Deck Tag Colours

**Input**: design documents in `specs/033-deck-tag-colours/`:

- [plan.md](plan.md) and [spec.md](spec.md), with the three Clarifications and the three plan refinements (rename and delete reach every carrier; pills follow the tag colour; picker lists card tags).
- [research.md](research.md) (R1–R12) and [data-model.md](data-model.md) (`tagColors`, derived `DeckTag`, `TagUsage`, `TagColours`).
- [contracts/tag-editor-api.md](contracts/tag-editor-api.md) (model ops and pure helpers) and [contracts/tag-ui.md](contracts/tag-ui.md) (roles, names and keys the tests assert).
- [quickstart.md](quickstart.md). Visual reference: `DESIGN.md` "Card system (Deck)" and `docs/design/screens/125-deck-tags-light.png` / `…-dark.png`.

**Tests are required.** Constitution VI asks for:

- Unit tests (Vitest) for every pure module and model op; a round-trip case for every model change; Ajv / Zod parity for the schema change.
- Component tests (Testing Library) by role and name, as listed in the UI contract.

Write each new test first and watch it fail. Do not add Playwright tests. The smoke suite must keep passing.

**Scope guards**:

- **The only file-format change is the optional root `tagColors`** (ADR 0022). No version bump, no layout change, no migration. A file with `tagColors` is rejected by earlier app versions (root `additionalProperties: false`); that is accepted, compatibility is 025's.
- **Card size never depends on a tag's colour** (§g-58). `card-tags.ts` and `card-layout.ts` do not change.
- **No colour-only meaning** (constitution VII): the tag text is always shown; System dots carry an accessible name.
- **Tokens only**: pills use the existing `--color-card-<name>-chip|ink|dot` and slate tokens, or the user's own hex; no hard-coded colours.
- **Export stays light-only** (ADR 0016).
- **Out of scope**: colour on connection, flow and step tags; typed fields (032); relationship colours (022); tag hierarchies; new e2e tests.

**Approvals**: no new runtime dependency.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US5 from spec.md.

## Path Conventions

- **Schema**: `packages/schema/…`, read `packages/schema/CLAUDE.md` ("Editing v1.json") first.
- **Model**: `packages/model/src/…`, tests in `packages/model/test/`; read `packages/model/CLAUDE.md`: validate before writing, ops in `src/ops/`, no React / DOM imports.
- **UI**: `packages/ui/src/…`, tests in `packages/ui/test/`; read `packages/ui/CLAUDE.md`.
- **App**: `apps/app/src/…`, tests next to the code; read `apps/app/CLAUDE.md`, and use the `react-flow` skill for canvas changes (`deck-node.tsx`, `deck-to-flow.ts`).
- **Commits**: small Conventional Commits (`feat(schema): …`, `feat(model): …`, `feat(ui): …`, `feat(app): …`, `test(app): …`, `docs: …`). No AI attribution lines.

---

## Phase 1: Setup

- [x] T001 Work in a git worktree or branch `033-deck-tag-colours` from the latest `main` (at or after `2e85e4a`). Run `pnpm install && pnpm lint && pnpm typecheck && pnpm test` to confirm a green start. Confirm the lucide names `Pencil`, `Plus`, `Trash2`, `Check`, `ArrowLeft` exist in the installed version.
- [x] T002 Add a `BENCH_TAGS` option to `apps/app/bench/perf.bench.ts` (read its header for the existing `BENCH_*` options): every card gets 3 to 10 tags from a pool of 24 (mixed case, e.g. "PCI", "pci", "Lan"). Then run `pnpm bench` and `BENCH_TAGS=1 pnpm bench` on the unchanged rendering and save both tables in `specs/033-deck-tag-colours/bench-before.md`. Also record `pnpm --filter @sododeck/app test scene.perf`.

---

## Phase 2: Foundational (format, storage and pure building blocks)

**Purpose**: the file format, the stored map, and the pure modules every story reads. Each is test-first and leaves the suite green; nothing visible changes yet.

### Schema

- [x] T003 [P] Write failing schema tests: in `packages/schema/test/fixtures.ts` add valid decks (`tagColors` with a named colour, a hex, mixed-case keys that differ in more than case) and invalid ones (empty key, key of spaces only, two keys equal ignoring case, value not a `ColorRef`, value not a string, `tagColors` as an array); extend `packages/schema/test/schema.test.ts` (Ajv / Zod parity), `semantic-rules.test.ts` (S8 messages with the path `tagColors.<key>`), `coverage.test.ts` and `key-order.test.ts` (`tagColors` declared right after `swatches`).
- [x] T004 Edit `packages/schema/schema/v1.json`: add root `tagColors` after `swatches` (`type: object`, `additionalProperties: { $ref: ColorRef }`, description per data-model.md). Run `pnpm schema:generate` and commit the regenerated `src/generated/*`. Add a `tagColors` entry (one named, one hex) to `packages/schema/examples/full.sododeck.json` so coverage sees it.
- [x] T005 Add semantic rule **S8** to `packages/schema/src/semantic-rules.ts`: every `tagColors` key is non-empty after trimming, and no two keys are equal after trim, space-collapse and `toLowerCase()` (inline the rule; schema must not import model or ui). Update the file header comment (S8). Make T003's tests pass.

### Model storage and the key rule

- [x] T006 [P] Write failing tests: `packages/model/test/tags.test.ts` for `tagKey` / `sameTag` (trim, collapse spaces, case, accents unchanged, empty); in `round-trip.test.ts` cases for `tagColors` (named, hex, mixed-case keys, order kept, empty map not emitted, absent stays absent); in `layout.test.ts` / `legacy-layout.test.ts` a stored document without `meta.tagColors` attaches the map on first write and reads as absent before.
- [x] T007 Add `packages/model/src/tags.ts` (`tagKey`, `sameTag`) and export from `src/index.ts`.
- [x] T008 Store the map: `tagColorsMap(doc)` in `packages/model/src/layout.ts` (mirror `swatchesArray`: stored map, else a detached one); `meta.set('tagColors', toY(file.tagColors ?? {}))` in `fromJSON` (`src/deck.ts`, plus the layout comment block); `readMeta` in `src/read.ts` emits `tagColors` only when non-empty; add `tagColors: true` to the `meta` pick in `src/validate.ts`. Check `src/ops/meta.ts`, `fragment.ts`, `snapshot.ts`, `preview.ts`, `repair.ts` and `integrity.ts` for any list of meta keys and extend it. Make T006's tests pass.

### UI key rule

- [x] T009 [P] Add `tagKey(text)` to `packages/ui/src/lib/tags.ts` (same rule as the model; no behaviour change to `normalizeTag`, `addTag`, `removeTag` yet) with a case in `packages/ui/test/tags.test.ts`. Add `apps/app/src/editor/tags/tag-key-parity.test.ts`: `@sododeck/model` `tagKey` and `@sododeck/ui` `tagKey` agree on a table of 30 samples (spaces, mixed case, tabs, accents, one-letter, long).

### App pure modules

- [x] T010 [P] Write failing tests `apps/app/src/editor/tags/deck-tags.test.ts` per [contracts/tag-editor-api.md](contracts/tag-editor-api.md): `deckTags` (counts cards only, merges spellings by key, display spelling = colour key else first seen in nodes → edges → flows → steps → deck tags, sorted by count then name ignoring case, a coloured tag with no cards listed with 0); `tagUsage` (cards, connections, flows, steps, deck tag); `canonicalTag` (existing key returns display spelling, new text trimmed and single-spaced, empty gives `null`, colour key wins over card spelling).
- [x] T011 Implement `apps/app/src/editor/tags/deck-tags.ts` (pure, no React; `DeckTag`, `TagUsage`, `deckTags`, `tagUsage`, `canonicalTag`).
- [x] T012 [P] Write failing tests `apps/app/src/editor/tags/tag-colours.test.ts`: named colour gives `var(--color-card-<name>-chip|ink|dot)`; hex gives chip and dot as the hex and ink `var(--color-card-text-dark|light)` from `readableText`; `undefined` gives the slate tokens (`--color-card-slate-*`).
- [x] T013 Implement `apps/app/src/editor/tags/tag-colours.ts` (`tagColours(color)`), and factor the chip mapping in `apps/app/src/editor/style/card-style.ts` `resolveLook` onto it so cards and tags share one mapping. Keep `card-style` tests green.

**Checkpoint**: `pnpm lint && pnpm typecheck && pnpm test` green; schema and model carry `tagColors` but nothing writes it yet.

---

## Phase 3: User Story 1 - Colour a tag once and see it everywhere (Priority: P1) 🎯 MVP

**Goal**: pick a colour for a tag in the editor; every card, the drawer, the export and the JSON panel show it; one undo reverses it.

**Independent Test**: in a deck with a tag on six cards, open a card's drawer, open the picker, edit the tag, choose violet; all six pills turn violet, reload keeps it, one ⌘Z restores slate.

### Tests for User Story 1 (write first, watch them fail)

- [ ] T014 [P] [US1] `packages/model/test/tags.test.ts` (extend): `setTagColor` sets a named colour and a hex; keeps the existing spelling of the key (`setTagColor('pic', …)` with key "PIC" edits "PIC"); `null` removes and is a no-op when absent (no change event); invalid colour throws `DeckEditError('invalid')`; one undo step restores; `concurrency.test.ts` two docs colouring different tags merge without loss; round-trip through `toJSON` / `fromJSON`.
- [ ] T015 [P] [US1] `packages/ui/test/components.test.tsx` (or a new `tag-chip.test.tsx`): `TagChip` with `colour` sets chip and ink, with `size="deck"` is 21 tall, a coloured chip is not the neutral surface; and in `packages/ui/test/contrast.test.ts` ink on chip ≥ 4.5:1 for slate and for 24 sample hex values through `readableText` (primaries, near-white, near-black, mid-greys).
- [ ] T016 [P] [US1] `apps/app/src/editor/deck-to-flow.test.ts`: node data carries `tagLooks` (first ten, with chip, ink, dot from `tagColours`); an uncoloured tag is slate even on a coloured card; changing `tagColors` invalidates the cached node data. `apps/app/src/editor/deck-node.test.tsx`: the "Tags" list shows each tag's text, each pill carries the tag's colour variables, System level shows named dots (`listitem` with the tag name).
- [ ] T017 [P] [US1] `apps/app/src/editor/export/scene.test.ts` and `render-svg.test.ts`: scene tags carry colour; the SVG pill fill is the palette chip of the tag's colour (hex gets a readable text colour); an uncoloured tag uses slate.
- [ ] T018 [P] [US1] Component tests per the UI contract: `apps/app/src/editor/tags/tag-picker.test.tsx` (dialog "Tags", search "Filter tags", listbox "Deck tags" rows with name, colour and count, "Edit tag <tag>" button), `tag-editor.test.tsx` (radiogroup "Tag colour" with the 13 names, the deck's colours and "No colour"; choosing one calls `setTagColor` once; Back and Esc return to the list), `card-tags-field.test.tsx` (row `list` "Tags" with 21px coloured pills and "Add tag" opening the picker).

### Implementation for User Story 1

- [ ] T019 [US1] `packages/model/src/ops/tags.ts` `setTagColor` (validate, one `ctx.transact`, existing-spelling rule via `tagKey`); add to `DeckEditor` in `src/editor.ts` (doc comment per the contract) and export types from `src/index.ts`. Make T014 pass.
- [ ] T020 [US1] `packages/ui/src/components/tag-chip.tsx`: optional `colour` ({ chip, ink }, set as CSS variables) and `size` (`default` | `deck`, 21 tall with the 10.5 / 500 text). Keep today's look when neither is given. Make T015 pass.
- [ ] T021 [US1] `apps/app/src/editor/deck-to-flow.ts`: add `tagLooks` to node data from `tagColours(deck.tagColors[…])` (lookup by `tagKey`), and include the `tagColors` identity in the cache check. `apps/app/src/editor/deck-node.tsx`: style each tag `<li>` and System dot from its look (inline `--tag-chip|ink|dot`), replacing `--card-chip|--card-ink|--card-dot` for tags only; header tile and field chips keep following the card colour. Update `data-*` and tests. Make T016 pass.
- [ ] T022 [US1] Export: `apps/app/src/editor/export/scene.ts` (`SceneCard.tags` entries carry the colour), `render-svg.ts` (pill fill and text from `export-palette.ts` for a named colour, `readableText` for a hex, slate when none). Make T017 pass.
- [ ] T023 [US1] `apps/app/src/editor/tags/tag-picker.tsx` (list mode: search, `listbox`, rows with colour dot, name, card count, pencil; rows are inert until US2) and `apps/app/src/editor/tags/tag-editor.tsx` (colour mode: `SwatchGrid` with the 13 colours, the deck's `swatches` and "No colour"; selection calls `editor.setTagColor`; back button and Esc). Host both in one `Popover` from `packages/ui`. Read frame 125 (`docs/design/screens/125-deck-tags-light.png`, `…-dark.png`) first and match it pixel-close; DESIGN.md wins on conflict. Make the picker and editor tests of T018 pass.
- [ ] T024 [US1] `apps/app/src/editor/tags/card-tags-field.tsx`: the drawer row for cards: `TagChip size="deck"` pills with the tag colour and ×, then an "Add tag" button that opens the picker. Use it in `apps/app/src/editor/inspector/node-inspector.tsx` in place of `TagsField` (keep `max={MAX_CARD_TAGS}` and `writeOnce`). Make the field test of T018 pass.
- [ ] T025 [US1] Add a visual check: screenshot the picker, editor and a deck with coloured tags in light and dark into `specs/033-deck-tag-colours/screens/` and note differences from frame 125 in `visual-check.md`.

**Checkpoint**: US1 works end to end through the editor; `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green.

---

## Phase 4: User Story 2 - Add and pick tags with a picker (Priority: P1)

**Goal**: the picker adds, creates and removes tags on one or several cards, from the drawer, the bulk drawer and the selection toolbar, with the ten-tag limit.

**Independent Test**: with a deck of 12 tags, use only the keyboard to open the picker, search, pick one, create a new one, and remove one from the card.

### Tests for User Story 2 (write first)

- [ ] T026 [P] [US2] `apps/app/src/editor/tags/tag-picker.test.tsx` (extend): typing filters by `tagKey`; "Create tag “text”" row appears only when nothing matches and ⏎ adds the canonical spelling with no colour; ⏎ on a row toggles it on the selection; on-all rows are checked, on-some rows show "n of N"; ↑ ↓ move; at ten tags the row is refused with "10 tags max" and nothing is written; Esc returns focus to the opener.
- [ ] T027 [P] [US2] `card-tags-field.test.tsx` (extend): ⌫ and Delete on a focused "Remove tag <tag>" remove from this card only and move focus to the next pill, else "Add tag"; ⏎ and Space on "Add tag" open the picker; announcements "<tag> added" and "<tag> removed"; at ten tags "Add tag" gives way to the "10 tags max" note.
- [ ] T028 [P] [US2] `apps/app/src/editor/inspector/bulk-inspector.test.tsx`, `quick-edit/field-popover.test.tsx` (create if absent) and `quick-edit/selection-toolbar.test.tsx`: bulk tags show solid / dashed "k/n" pills in the tag colours; "Add <tag> to all" and "Remove <tag> from all" keep their names; the toolbar's Tags button opens the same picker; one undo step per toggle across the selection; full cards are skipped with the existing announcement.

### Implementation for User Story 2

- [ ] T029 [US2] `tag-picker.tsx`: search, create row, selection-aware rows (state from the selected nodes, as `bulkView` / `tagChoices` derive it today), toggle via `writeNodesOnce`, ten-tag rule (reuse `MAX_CARD_TAGS`), announcements through `useUiStore().announce`, roving focus in the listbox. Make T026 pass.
- [ ] T030 [US2] `card-tags-field.tsx`: keyboard and focus rules from the contract, remove button wiring, "10 tags max" note, announcements. Make T027 pass.
- [ ] T031 [US2] `apps/app/src/editor/inspector/bulk-inspector.tsx` (`BulkTags`): coloured pills and the picker as its add control; `apps/app/src/editor/quick-edit/field-popover.tsx` `tags` case: host `TagPicker`; remove `tagChoices` from `quick-edit/choice-state.ts` and its test once nothing uses it. Make T028 pass.

**Checkpoint**: tags can be added, created and removed on one or many cards from all three entry points.

---

## Phase 5: User Story 3 - Tags keep the case the user typed (Priority: P1)

**Goal**: "PIC" stays "PIC"; "pic" resolves to the existing "PIC" everywhere tags are typed; filters match ignoring case.

**Independent Test**: add "PIC" to one card and "pic" to another; both show "PIC" and the picker lists one tag.

### Tests for User Story 3 (write first)

- [ ] T032 [P] [US3] `packages/ui/test/tags.test.ts` (update; today it asserts lower-casing): `normalizeTag` trims and single-spaces and keeps case; `addTag` refuses a tag with the same key, keeps the first spelling and respects `max`; `removeTag` matches by key; `TagInput` (`packages/ui/test/components.test.tsx` or `combobox.test.tsx`) filters suggestions and dedupes by key.
- [ ] T033 [P] [US3] App tests: `fields/tags-field.test.tsx` (create if absent) typing "pic" with "PIC" in the deck commits "PIC" on a connection, flow, step and the deck; `inspector/derive.test.ts` `tagSuggestions` distinct by key with the display spelling; a table of 20 spelling variants of one tag never yields a second tag across the picker, bulk add and `TagsField` (SC-004); `view-filter.test.ts` `excludeTags: ['pci']` hides a card tagged "PCI" and the reverse; `views/view-settings-popover.test.tsx` lists "Hide tags" by display spelling, one entry per key, and toggling stores the display spelling.
- [ ] T034 [P] [US3] `deck-tags.test.ts` (extend if T010 did not cover): a deck holding "pci" and "PCI" on different cards lists one tag with the combined count and no document write happens on load.

### Implementation for User Story 3

- [ ] T035 [US3] `packages/ui/src/lib/tags.ts` and `packages/ui/src/components/tag-input.tsx`: `normalizeTag` keeps case; `addTag` / `removeTag` / suggestion filtering by `tagKey`; update the doc comments and the `TagInput` comment ("lower-cased" no longer true). Fix every existing test that expects lower-casing. Make T032 pass.
- [ ] T036 [US3] `apps/app/src/editor/fields/tags-field.tsx` maps each newly typed tag through `canonicalTag(deck, …)` before `onCommit`; `bulk-inspector.tsx` and the picker's create row use `canonicalTag`; `inspector/derive.ts` `tagSuggestions` distinct by key. Make T033 pass for fields and derive.
- [ ] T037 [US3] `apps/app/src/editor/view-filter.ts` compares tags by `tagKey` (build the exclude set from keys); `views/view-settings-popover.tsx` `tagsOf` lists one entry per key with its display spelling. Make the rest of T033 pass.

**Checkpoint**: typing a tag in any field respects the case rule; older lower-case decks behave as before.

---

## Phase 6: User Story 4 - Rename, recolour and delete a tag deck-wide (Priority: P2)

**Goal**: rename (with merge), and delete, from the editor; both reach every carrier in one undo step.

**Independent Test**: rename, merge and delete a tag used on several cards, a connection and a flow; undo each in one step.

### Tests for User Story 4 (write first)

- [ ] T038 [P] [US4] `packages/model/test/tags.test.ts` (extend) for `renameTag` and `deleteTag` per [contracts/tag-editor-api.md](contracts/tag-editor-api.md): rewrites nodes, edges, flows, steps, deck tags and every view's `excludeTags`; moves the colour entry; case-only rename respells without merging; rename onto an existing key merges onto the existing spelling and colour; arrays are de-duplicated keeping first position and no card ends with more tags than before; delete removes from every carrier, drops an emptied array and the colour entry; empty target throws `DeckEditError('invalid')`; absent tag returns zero counts and no change event; returned `TagChange` counts; one undo step restores the whole document; `undo.test.ts` and `concurrency.test.ts` cases; a 500-card deck under 100 ms for each op (`perf.test.ts`).
- [ ] T039 [P] [US4] `apps/app/src/editor/tags/tag-editor.test.tsx` (extend): "Tag name" renames on ⏎; empty is refused with a message; a name matching another tag asks "Merge into “<tag>”? N cards change" with Merge and Cancel and only Merge calls `renameTag`; the button reads "Delete tag · used on N cards", shows "Also on 2 connections and 1 flow" when applicable, and asks to confirm; focus returns to the picker list afterwards; announcements for rename, merge, delete and colour.

### Implementation for User Story 4

- [ ] T040 [US4] `packages/model/src/ops/tags.ts`: `renameTag` and `deleteTag` (one `ctx.transact`, validate each rewritten object before writing, share one carrier walk for both, no-op without a change event), `TagChange` result; add to `DeckEditor` in `src/editor.ts` and exports. Make T038 pass.
- [ ] T041 [US4] `apps/app/src/editor/tags/tag-editor.tsx`: name field, merge confirmation, delete with usage from `tagUsage`, focus return, announcements. Make T039 pass.

**Checkpoint**: tags can be tidied deck-wide without leaving stale references.

---

## Phase 7: User Story 5 - Older decks and other tag places keep working (Priority: P2)

**Goal**: nothing changes for decks without tag colours, and the JSON panel, bulk drawer and other tag fields agree with the canvas.

**Independent Test**: import a deck saved before 033, check nothing changed, then colour a tag and see the JSON panel update.

### Tests for User Story 5 (write first)

- [ ] T042 [P] [US5] `packages/model/test/load.test.ts` / `round-trip.test.ts`: a pre-033 fixture (copy of an existing example without `tagColors`) loads and `toJSON` returns it byte-identical with no `tagColors` key, and merely opening it makes no write (`observe` sees no transaction); a stored Yjs document without `meta.tagColors` can colour a tag and read it back.
- [ ] T043 [P] [US5] `apps/app/src/editor/json-panel.test.tsx`: after `setTagColor` the panel text shows `tagColors` after `swatches`, in sync with the canvas; `deck-inspector.test.tsx` and `edge-inspector.test.tsx`: deck, connection, flow and step tag fields stay neutral and follow the case rule.

### Implementation for User Story 5

- [ ] T044 [US5] Fix whatever T042 and T043 show (expected: none beyond Foundational; list any place that built meta keys by hand). Check `apps/app/src/editor/export/json-export.ts` writes `tagColors` and `apps/app/src/editor/import` (or the library import path) accepts it; add a case to `json-export.test.ts`.

**Checkpoint**: all five stories pass their independent tests.

---

## Phase 8: Polish and cross-cutting

- [ ] T045 [P] Docs: ADR 0022 (mark the `tagColors` row built by 033; add S8, "rename and delete rewrite every carrier", display spelling rule); ADR 0021 layout line for `meta.tagColors`; `DESIGN.md` (`tag-chip` entry: 21px deck chip with colour and drawer row; card pill rule: tag colour, slate default, System dot); `packages/schema/CLAUDE.md` (S8), `packages/model/CLAUDE.md` (tag ops, `tags.ts`, layout line), `packages/ui/CLAUDE.md` (case-keeping `tags.ts`, `TagChip` colour and size), `apps/app/CLAUDE.md` (`editor/tags/`); `docs/backlog.md` §033 status; `docs/design/design-analysis.md` §g note that tag pills follow the tag colour (plan refinement 2). Do not name other diagram or database tools anywhere.
- [ ] T046 Accessibility pass on the picker and editor: keyboard-only run of quickstart scenario 16, visible focus on every control, roles and names as in [contracts/tag-ui.md](contracts/tag-ui.md), reduced motion respected, no colour-only meaning (greyscale screenshot of coloured tags still readable by text). Extend `packages/ui/test/keyboard-a11y.test.tsx` if the picker uses a new pattern.
- [ ] T047 Run the quickstart manual scenarios 1–17 in light and dark; save the screenshots in `specs/033-deck-tag-colours/screens/` and update `visual-check.md`.
- [ ] T048 Performance: run `pnpm bench` and `BENCH_TAGS=1 pnpm bench` on the finished code and save `specs/033-deck-tag-colours/bench-after.md`; compare with `bench-before.md` (pan fps and long frames within run-to-run variation; if not, find the cause before accepting). Re-run `pnpm --filter @sododeck/app test scene.perf`.
- [ ] T049 Definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all pass, with no skipped or `.only` tests and the smoke suite (including no third-party requests) unchanged. Write the final report: what changed, what was skipped, what is uncertain, the bench numbers, and a proposal for the next step. Stop; do not start the next feature.

---

## Dependencies and order

- **Phase 1 → Phase 2 → stories → Phase 8.** Phase 2 blocks everything.
- **Inside Phase 2**: T003 → T004 → T005 (schema); T006 → T007 → T008 (model, needs the generated types from T004); T009 and T010 → T011 and T012 → T013 can run beside the schema and model work once T004 has regenerated the types (T011 and T013 read `SododeckFile`).
- **US1 first** (the MVP): it carries the picker, the editor and the drawer row that US2 and US4 extend. **US2** needs US1's picker and `CardTagsField`. **US3** is independent of US2 in code but its tests touch the picker's create row (T026), so run it after US2. **US4** needs US1's editor. **US5** needs everything before it.
- **P1 stories** are US1–US3, **P2** are US4–US5.

## Parallel examples

- Phase 2: T003, T006, T009, T010 and T012 are all test-writing in different packages and can start together.
- US1: T014, T015, T016, T017 and T018 touch different files and can be written in parallel; T020 (ui), T019 (model) and T022 (export) can be implemented in parallel; T021, T023 and T024 touch the canvas and the drawer and follow them.
- With two agents: one takes the schema and model (T003–T008, T014, T019, T038, T040), the other the app (T010–T013, T016, T018, T021, T023, T024) after the generated types land.
- Alongside 035 (separate worktree): only `deck-node.tsx`, `index.css`, `DESIGN.md` and `docs/backlog.md` overlap; do the docs tasks (T045) after the first of the two merges.

## Implementation strategy

1. **MVP = Phase 1 + Phase 2 + US1.** At that point a user can colour a tag and see it on cards, in the drawer and in the export, with undo. Stop and check the visual match to frame 125 (T025) before continuing.
2. Add US2 (pick, create, bulk, toolbar), then US3 (case rule), which together replace the old tag entry points. Land them in one PR if the case rule changes existing tests, otherwise separately.
3. Add US4 (rename, merge, delete) and US5 (compatibility checks), then Phase 8.
4. Keep commits small: one per task or per tight group (schema, model, ui, app, docs). Run `pnpm lint && pnpm typecheck && pnpm test` after each phase.
