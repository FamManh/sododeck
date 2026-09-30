# Tasks: Card Style (Fill and Stroke Colours)

**Input**: design documents in `specs/020-card-style/`:

- [plan.md](plan.md) and [spec.md](spec.md). The spec was clarified on 2026-09-29: a mid-tone custom colour where no text colour reaches 4.5:1 is allowed, uses the higher-contrast text and shows a warning (FR-026).
- [research.md](research.md) (R1–R15) and [data-model.md](data-model.md).
- [contracts/card-style-ui.md](contracts/card-style-ui.md).
- [quickstart.md](quickstart.md).

**Tests are required.** Constitution VI asks for:

- Unit tests (Vitest) for every pure module, store and model op.
- Round-trip cases for every model change.
- Component tests (Testing Library) by role and name, as in the [contract](contracts/card-style-ui.md).

Write each test first and watch it fail. Do not add Playwright tests. The smoke suite must keep passing.

**Scope guards**:

- **Schema change is additive and optional only**: `CardColor`, `HexColor`, `ColorRef`, `Style`, `Node.style`, `Group.style`, root `swatches`. No version bump (ADR 0002), and **no `maxItems`** on `swatches` (§g-52). Regenerate with `pnpm schema:generate`, and keep Ajv/Zod parity green.
- **Every document write goes through `DeckEditor`** (`setStyle`, `addSwatch`, `removeSwatch`) and is exactly one undo step per pick, add + apply, or remove.
- **The live preview is UI-only** (`stylePreview` in the UI store). It never writes to Yjs and never creates an undo entry (FR-021).
- **Tokens only in components.** Hex appears only in `tokens.css`, in the export palette mirror, and as user data set as inline CSS custom properties.
- **Out of scope**:
  - Colours on connections and stickies.
  - Opacity and gradients.
  - User-defined attributes (§g-40).
  - New shortcut keys.
- **Colour editing is off** in flow mode and in flow sessions (action `modes: ['edit']`). Colours still render there.

**Approvals**: no new runtime dependency. The colour area and hue slider are built in `packages/ui` (R8; `react-colorful` rejected). The schema change was decided by the founder (§g-39, §g-43, §g-52).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, and no dependency on an unfinished task).
- **[Story]**: US1–US6 from spec.md.

## Path Conventions

- **Schema**: `packages/schema/…`. Read `packages/schema/CLAUDE.md` first:
  - Property order is the file key order.
  - Every property needs a `description`.
  - No `default` / `format`.
  - The `full.sododeck.json` coverage test.
- **Model**: `packages/model/src/…`, with tests in `packages/model/test/`. Read `packages/model/CLAUDE.md`: validate before writing, ops go in `src/ops/`, and each op has an "Added by 020" API entry.
- **UI**: `packages/ui/src/…`, with tests in `packages/ui/test/`. Presentational only, tokens only, `data-slot`, and no `dark:` overrides.
- **App**: `apps/app/src/…`, with tests next to the code.
  - New style code goes in `apps/app/src/editor/style/`, and the action module in `apps/app/src/editor/actions/`.
  - Read `apps/app/CLAUDE.md` and `.agents/skills/react-flow/SKILL.md`.
- **Commits**: small Conventional Commits (`feat(schema): …`, `feat(model): …`, `feat(ui): …`, `feat(app): …`, `test(…): …`, `docs: …`). No AI attribution lines.

---

## Phase 1: Setup

- [ ] T001 Create branch `020-card-style` from the latest `main`, after the docs PR for this spec is merged. Run `pnpm install && pnpm test` to confirm a green start.
- [ ] T002 Run `pnpm bench` on the unchanged code, and save the table in `specs/020-card-style/bench-before.md`.
- [ ] T003 [P] Add a `colours=1` query parameter to `apps/app/src/routes/bench-page.tsx` and `apps/app/src/bench/generate-deck.ts` (R13). Every node gets a fill (cycling through the 13 names plus `#7a3cff` and `#1f2a44`), and every 5th node gets a `blue` stroke. Pass it from `apps/app/bench/perf.bench.ts` when `BENCH_COLOURS=1`. Until T012 lands, the generator writes nothing and logs `TODO(020): styles not in schema yet`.
- [ ] T004 [P] Write ADR `docs/decisions/0018-card-style.md` (or the next free number, if 017 took 0018) in the header format of 0017. It records:
  - `ColorRef` as a named enum plus lowercase hex, and `Style` with `minProperties: 1` (R1).
  - `setStyle` writing key by key (R2).
  - Swatches as a `meta` `Y.Array`, with the cap enforced in the model only (R3, §g-52).
  - Hex tokens clipped from OKLCH (R4).
  - The higher-contrast text rule and its 0.183–0.227 warning band (R6).
  - The preview as UI state (R9).
  - The alternatives from research.

---

## Phase 2: Foundational (blocks every story)

### Schema

- [x] T005 Add invalid fixtures first in `packages/schema/test/fixtures.ts`, following the 016 block:
  - `nodes[0].style.fill` set to `"Green"`, `"#7A3CFF"`, `"#abc"` and `"purple"`
  - `nodes[0].style` set to `{}`
  - `nodes[0].style.opacity` set to `0.5`
  - a group `style.stroke` set to `"red "`
  - `swatches` set to `["#7a3cff", "#7a3cff"]`
  - `swatches` set to `["7a3cff"]`

  Each expects its issue `path`. In `packages/schema/test/schema-walk.ts`, follow `anyOf` branches: pick the branch whose schema accepts the value, and report enum values of that branch. Run the tests and confirm the new fixtures fail.

- [x] T006 Edit `packages/schema/schema/v1.json` (R1, [data-model](data-model.md#file-format-schema-v1-additive-no-version-bump)). Every property gets a `description`.
  - Add `$defs`:
    - `CardColor`: an enum of the 13 names, in DESIGN.md order.
    - `HexColor`: pattern `^#[0-9a-f]{6}$`.
    - `ColorRef`: `anyOf [CardColor, HexColor]`.
    - `Style`: `fill?` and `stroke?` as `ColorRef`, with `additionalProperties: false` and `minProperties: 1`.
  - Add `Node.style` after `position`, and `Group.style` after `size`.
  - Add root `swatches` (an array of `HexColor` with `uniqueItems: true`, no `maxItems`) after `tags`.
- [x] T007 Run `pnpm schema:generate` and inspect `packages/schema/src/generated/{types,zod}.ts`:
  - `ColorRef` must be a `z.union` of an enum and a regex string.
  - `minProperties` and `uniqueItems` must be kept.

  For each one Zod drops, add a semantic rule in `packages/schema/src/semantic-rules.ts` (+ test): **S6** "style has at least one of fill / stroke" and/or **S7** "swatches are unique". Keep `generated.test.ts` green.

- [x] T008 Extend `packages/schema/examples/full.sododeck.json` in schema key order:
  - use all 13 names across node and group `fill` / `stroke`
  - at least one hex value on a node and one on a group
  - `"swatches": ["#7a3cff", "#1f2a44"]`

  Make `coverage.test.ts`, `key-order.test.ts` and the Ajv/Zod parity tests pass (T005 now green).

### Model

- [x] T009 [P] Write failing round-trip cases in `packages/model/test/round-trip.test.ts` (a `perType` entry `'card style and swatches (020)'`, next to the 016 frames case):
  - a node with a named fill, a node with a hex stroke, a node with both
  - a group with a fill and a stroke
  - a deck with `swatches` whose order is preserved
  - a deck with 14 swatches
  - an old deck that gains no `style` or `swatches` keys
  - key order: `style` after `position` / `size`, and `swatches` after `tags`
- [x] T010 [P] Write failing tests in `packages/model/test/style.test.ts` for `setStyle` (R2):
  - It sets a fill on 2 nodes and 1 group in one undo step.
  - `null` clears only that channel, and clearing the last channel removes `style`.
  - An invalid value (`'Green'`, `'#abc'`) throws `DeckEditError` and writes nothing.
  - Unknown ids are skipped, and empty targets do nothing.
  - Two docs synced through updates, one setting fill and the other stroke on the same node, end with both.
- [x] T011 [P] Write failing tests in `packages/model/test/swatches.test.ts` for `addSwatch` / `removeSwatch` (R3):
  - `addSwatch` lowercases and adds the `#`, and does nothing for a duplicate.
  - The 13th add throws `DeckEditError('invalid')`, but a file loaded with 14 is kept.
  - `removeSwatch` removes every match and never touches node styles, and does nothing when the colour is absent.
  - Concurrent adds from two docs both survive.
  - `MAX_SWATCHES === 12`.
- [x] T012 Implement `swatches` as a meta field. In `packages/model/src/deck.ts` (`fromJSON` / `toJSON`), `src/ops/meta.ts` (`FIELDS`, `MetaPatch`), `src/validate.ts` (the meta pick) and `src/editor.ts` (the `updateMeta` type), store it as a `Y.Array` via `toY`, like `tags`. T009 is now green.
- [x] T013 Create `packages/model/src/ops/style.ts` with `setStyle(ctx, targets, channel, value)` (R2, [data-model](data-model.md#model-api-added-by-020)):
  - Validate `value` with the generated Zod `ColorRef` first.
  - In one `ctx.transact`, per target, get or create the nested `style` `Y.Map` and set or delete `channel` key by key (the `writeFields` pattern from `ops/frames.ts`). Delete `style` when it becomes empty.

  Wire `DeckEditor.setStyle` in `src/editor.ts` and export the types (`StyleChannel`, `StyleTargets`) from `src/index.ts`. T010 is now green.

- [x] T014 Create `packages/model/src/ops/swatches.ts` with `addSwatch`, `removeSwatch` and `MAX_SWATCHES = 12`, operating on the `meta` `swatches` `Y.Array` (creating it on the first add). Wire them into `DeckEditor` and export `MAX_SWATCHES`. T011 is now green.

### Tokens and pure colour helpers (`packages/ui`)

- [x] T015 [P] Write failing tests:
  - In `packages/ui/test/contrast.test.ts`, add `TEXT_PAIRS` `['ink','card-<name>-fill']` and `['text-secondary','card-<name>-fill']` for all 13 names at 4.5:1, and a non-text list `['card-<name>-stroke','surface']` at 3:1, in both themes.
  - In `packages/ui/test/readable-text.test.ts`:
    - `#1f2a44` gives `light` and is readable.
    - `#e8d5b7` gives `dark` and is readable.
    - The switch happens near luminance 0.204.
    - `#7c7c7c` is not readable.
    - Both ends of the ≈ 0.183–0.227 band are not readable.
- [x] T016 [P] Write failing tests in `packages/ui/test/colour.test.ts` for `normalizeHex`:
  - `7A3CFF` and `#7a3cff` both give `#7a3cff`.
  - `#abc`, `zzzzzz` and an empty string give `null`.

  Also test `hexToHsv` / `hsvToHex` round trips for primaries, grey, black and white, and for `#7a3cff`.

- [x] T017 Add the 26 hex tokens per theme plus `--sd-card-text-dark` / `--sd-card-text-light` to `packages/ui/src/styles/tokens.css` (values in the [data-model table](data-model.md#named-colour-tokens)). Map them in `packages/ui/src/styles/theme.css` `@theme inline` as `--color-card-<name>-fill`, `--color-card-<name>-stroke`, `--color-card-text-dark` and `--color-card-text-light`. `token-parity.test.ts` and T015's pair tests are now green.
- [x] T018 In `packages/ui/src/lib/contrast.ts`, export `relativeLuminance` and add `readableText(hex)`, returning `{ text: 'dark' | 'light'; ratio; readable }` against `#1c1c1a` / `#ffffff` (R6). Create `packages/ui/src/lib/colour.ts` with `normalizeHex`, `hexToHsv` and `hsvToHex`, and export both modules from the package entry. T015 and T016 are now green.

### App derived look

- [x] T019 [P] Write failing tests in `apps/app/src/editor/style/card-style.test.ts` for `resolveLook(style, preview?)`:
  - It returns `undefined` with no style.
  - A named fill gives `var(--sd-card-green-fill)`, `namedFill: true` and `text: 'default'`.
  - A hex fill gives the hex, `text` from `readableText`, and `namedFill: false`.
  - A stroke alone leaves `fill` undefined.
  - A preview overrides only its channel.

  Also test `colourName(ref)`: "Green", or the hex as-is.

- [x] T020 Create `apps/app/src/editor/style/card-style.ts` with `CardLook`, `resolveLook`, `colourName` and the `CARD_COLORS` list (from the generated schema type). T019 is now green.
- [x] T021 In `apps/app/src/editor/deck-to-flow.ts`:
  - Add `look?: CardLook` to `DeckNodeData`, `GroupBoundaryData` and the collapsed-group data.
  - Compute it in `toFlowNode`, `groupNodes` and `collapsedNodes`.
  - Add it to each cache check with a structural compare of its fields.
  - Accept a `stylePreview` input plus the selected ids, applying the preview only to selected objects (R9).

  Add tests in `deck-to-flow.test.ts`:
  - An unchanged node keeps its object identity across a snapshot where another node's style changed.
  - A preview changes only the selected nodes' `look`.

- [x] T022 In `apps/app/src/state/ui-store.ts`:
  - Add `'style'` to `ToolbarFieldId`.
  - Add `stylePickerTab: 'fill' | 'stroke'` (default `'fill'`), `stylePreview` and `setStylePreview`.
  - Clear `stylePreview` on selection change, on `closeToolbarField` and on `setCanvasGesture`.

  Pass `stylePreview` into `toFlowNodes` in `apps/app/src/editor/canvas.tsx`. Add store tests.

**Checkpoint**: styles and swatches round-trip through the file and the model, and the JSON panel shows them after an import. Nothing renders them yet.

---

## Phase 3: User Story 1 — Colour a component from the palette (P1) 🎯 MVP

**Goal**: a selected card gets a named fill or stroke from a toolbar picker, sees it in both themes, and can undo it.

**Independent test**: quickstart scenario 1.

### Tests first

- [x] T023 [P] [US1] Write failing tests in `packages/ui/test/swatch-grid.test.tsx` for `SwatchGrid` / `Swatch`:
  - It is a `radiogroup` with a name, and has `radio`s named by their labels.
  - It has a roving tabindex. ←/→ move by 1, ↑/↓ by the column count (7), and Home / End jump to the ends.
  - Enter and Space call `onSelect`.
  - The checked radio has `aria-checked` and a check icon.
  - Nothing is checked when `value` is `null`.
  - The swatch colour comes from a CSS custom property prop, not a class.
- [x] T024 [P] [US1] Write failing tests in `apps/app/src/editor/style/style-picker.test.tsx`, by role and name from the [contract](contracts/card-style-ui.md#picker-stylepopover-dialog):
  - It shows a dialog "Colour" with a "Colour target" radiogroup (Fill / Stroke), a "No colour" button, and a "Colours" radiogroup with 13 radios "Red"…"Slate".
  - Picking "Green" calls `onApply('fill', 'green')`.
  - Switching to Stroke then picking "Blue" calls `onApply('stroke', 'blue')`.
  - "No colour" calls `onApply('fill', null)`.
  - The footer `status` shows "Green · card-green-fill" for the checked or hovered swatch.
- [x] T025 [P] [US1] Write failing tests in `apps/app/src/editor/actions/style-actions.test.ts`:
  - `style.colour` is offered on the toolbar and menu for `component`, `components`, `group` and `mixed`.
  - It is not offered for `connection`, `sticky` or `canvas`.
  - It is not offered in `flow` or `session` mode.
  - Running it from the menu calls `openToolbarField('style')`.
- [x] T026 [P] [US1] Write failing tests in `apps/app/src/editor/style/apply-style.test.ts`:
  - `applyStyle(editor, selection, channel, value)` is one undo step (one `editor.undo()` restores all).
  - It passes only nodes and groups to `setStyle`.
  - It announces "Fill set to Green on 1 component" or "Fill removed from 3 components".
- [x] T027 [P] [US1] Write failing tests in `apps/app/src/editor/deck-node.test.tsx`:
  - A card with `look.fill` has an accessible description containing "Green fill".
  - With a named fill, the subtitle uses the secondary text role. Check via computed style from the tokens map, not class names, or assert through `data-text="secondary"` as the design gallery does.
  - A hex fill with `text: 'light'` sets `data-text="light"`.
  - A stroke adds the description "Blue stroke".

### Implementation

- [x] T028 [P] [US1] Create `packages/ui/src/components/swatch-grid.tsx`: `SwatchGrid` (`role="radiogroup"`, `columns` prop, roving focus) and `Swatch` (28 px circle, background from a `--swatch` custom property, a 1 px ring from `--swatch-ring`, and when checked a 2 px surface gap, a 2 px orange ring and a lucide `Check`). Add it to the design gallery (`apps/app/src/design-gallery/`) with checked, focused and unchecked samples. T023 is now green.
- [x] T029 [US1] Create `apps/app/src/editor/style/style-picker.tsx`: Fill / Stroke `SegmentedControl` (bound to `stylePickerTab`), a "No colour" button (lucide `Ban`, `aria-pressed`), the named `SwatchGrid` with 7 columns, and the footer `status`. It takes `value: { fill; stroke } | 'mixed'` per channel, `onApply` and `deckColours` (rendered in US3). T024 is now green (except the US3 parts).
- [x] T030 [US1] Create `apps/app/src/editor/style/apply-style.ts`: `applyStyle`, which is `oneStep(editor, () => editor.setStyle(targets, channel, value))`, plus the announcement through the live region (`useUiStore.getState().announce`). T026 is now green.
- [x] T031 [US1] Create `apps/app/src/editor/actions/style-actions.ts` with `style.colour` (`field: 'style'`, section `edit`, `where` per the contract, default modes). Its menu run closes the menu and calls `openToolbarField('style')`. Register it in `apps/app/src/editor/actions/index.ts` `ACTIONS` after `FIELD`. T025 is now green.
- [x] T032 [US1] Wire the toolbar:
  - In `apps/app/src/editor/quick-edit/field-popover.tsx`, render `StylePopover` for `field === 'style'` at 272 px, with `aria-label` "Colour". The popover reads the selected objects from the snapshot, computes each channel's value or `'mixed'` (reusing `bulkView`), and calls `applyStyle`. Picking keeps the popover open.
  - In `selection-toolbar.tsx`, the button shows the current fill as a mini swatch, with the accessible name "Colour: Green", "Colour: none" or "Colour: Mixed".
  - Place it after Rules (component and components) and after Collapse (group).
  - Add a test in `selection-toolbar.test.tsx`.
- [x] T033 [US1] Render colours on cards in `apps/app/src/editor/deck-node.tsx` (R5):
  - Set `--card-fill` / `--card-stroke` inline from `data.look`.
  - Add a fill class (`bg-(--card-fill)`), and a stroke class (`border-[1.5px] border-(--card-stroke)`) only when neither the current-step nor the connect-target class is active.
  - On a named fill the subtitle uses `text-ink-secondary`. On a custom fill, the title, subtitle, owner and glyphs use `text-card-text-dark` / `text-card-text-light`, and the node gets `data-text`.
  - Extend the accessible description with `colourName` ("Green fill", "Custom fill #7a3cff", "Blue stroke").
  - Check all four levels (landscape KindTile, system / container row, component card).

  T027 is now green.

- [x] T034 [US1] Create `apps/app/src/editor/inspector/appearance-section.tsx` (+ test): a `PanelSection` "Appearance" with two `button`s, "Fill: <name|none>" and "Stroke: <name|none>" (`aria-haspopup="dialog"`). Each opens `StylePicker` in a `Popover` with its tab preselected, and Esc returns focus to the row. Add it to `apps/app/src/editor/inspector/node-inspector.tsx`, after the Links / Pin sections and before `AttachedRules`.

**Checkpoint**: US1 acceptance scenarios 1–7 pass. The JSON panel shows `"style": { "fill": "green" }`.

---

## Phase 4: User Story 2 — Colour several components at once (P1)

**Goal**: a multi-selection (components, groups, or both) is coloured or reset in one undo step, and differing values show "Mixed".

**Independent test**: quickstart scenario 2.

- [x] T035 [P] [US2] Add failing tests to `apps/app/src/editor/style/style-picker.test.tsx`:
  - With `value.fill === 'mixed'`, no radio is checked and the footer reads "Mixed".
  - When all targets share `amber`, "Amber" is checked.
  - "No colour" has `aria-pressed="true"` only when no target has that channel.
- [x] T036 [P] [US2] Add failing tests to `apps/app/src/editor/style/apply-style.test.ts`:
  - For a selection of 2 components, 1 group and 1 sticky, `setStyle` gets `{ nodes: [2], groups: [1] }`, and the footer helper `skippedCount` returns 1 ("Colours 3 of 4 selected items").
  - "No colour" on 3 cards with different fills keeps their strokes, and one undo restores each fill.
- [x] T037 [US2] Implement mixed values and the skipped-items footer:
  - A pure `channelValue(objects, channel)` in `apps/app/src/editor/style/card-style.ts`, returning a `ColorRef`, `null` or `'mixed'`.
  - `skippedCount` in `apply-style.ts`.

  Use both in `style-picker.tsx` and the toolbar button name. T035 and T036 are now green.

- [x] T038 [US2] Add `AppearanceSection` to `apps/app/src/editor/inspector/bulk-inspector.tsx`, with mixed values shown as "Fill: Mixed". Add a test.

**Checkpoint**: US2 scenarios 1–5 pass.

---

## Phase 5: User Story 6 — States stay visible on colour (P1)

**Goal**: selection, flow step, error, focus, hover, pinned and dimmed states stay distinct on every fill and stroke.

**Independent test**: quickstart scenario 9, plus the design-gallery board of states on colour.

- [x] T039 [P] [US6] Add failing tests to `apps/app/src/editor/deck-node.test.tsx`:
  - A card that is the current flow step and has a stroke shows no stroke marker (`data-stroke` absent) and keeps its step badge and announcement.
  - A card with a problem has the error ring marker (`data-problem`) and the alert badge named as today, with and without a fill.
  - A selected coloured card keeps `aria-selected` and the "Selected" description.
- [x] T040 [US6] Implement the design-107 error ring in `apps/app/src/editor/deck-node.tsx`: a 3 px dashed `outline-clay-ink` 3 px outside the card for cards with problems (015), and the alert glyph on a surface-coloured disc so it reads on any fill. Confirm the flow / focus / view dim rules in `apps/app/src/index.css` apply to coloured cards unchanged (the opacity is on `.react-flow__node`). T039 is now green.
- [x] T041 [US6] Create `apps/app/src/design-gallery/style-samples.tsx`, a board like design 107:
  - all 13 fills with title, subtitle and rules glyph
  - all 13 strokes
  - custom fills `#1f2a44`, `#e8d5b7` and `#c9e7dc`
  - selected, flow step, error, dimmed and pinned on colour

  Register it in `apps/app/src/routes/design-gallery-page.tsx` `SECTIONS`, rendering real `DeckNode`s with static data.

**Checkpoint**: US6 scenarios 1–5 pass. The gallery board matches 107 in light and dark.

---

## Phase 6: User Story 3 — Add a deck colour (P2)

**Goal**: "+" adds a custom colour with a live preview, saves it in the deck (up to 12), and warns about hard-to-read text.

**Independent test**: quickstart scenarios 3, 4, 6 and 8.

### Tests first

- [ ] T042 [P] [US3] Write failing tests in `packages/ui/test/colour-area.test.tsx` and `packages/ui/test/hue-slider.test.tsx`:
  - The roles are `slider` "Saturation and brightness" (`aria-valuetext` "Saturation 60 %, brightness 40 %") and `slider` "Hue" (0–359, `aria-valuetext` "Hue 262°").
  - Arrows step by 1, and ⇧ plus arrows by 10.
  - Values are clamped.
  - `onChange` is called with the new HSV or hue.
- [ ] T043 [P] [US3] Add failing tests to `apps/app/src/editor/style/style-picker.test.tsx` for the add panel:
  - The "Deck colours" radiogroup lists the deck's hex swatches in order, followed by the "Add a deck colour" button.
  - "+" opens the panel with the "Hex colour" textbox.
  - Typing `7A3CFF` enables Add and calls `onPreview('fill', '#7a3cff')`.
  - `#abc` disables Add and shows the error "Enter a 6-digit hex colour, e.g. #7a3cff" (via `aria-describedby`).
  - `#7c7c7c` shows the `status` "Text may be hard to read on this colour" with Add still enabled.
  - Add calls `onAddColour('fill', '#7a3cff')`.
  - Cancel and Esc call `onPreview(null)` and return to the palette.
  - With 12 deck colours, "+" is not in the DOM and the footer reads "12 of 12 deck colours: remove one to add another".
- [ ] T044 [P] [US3] Add failing tests to `apps/app/src/editor/style/apply-style.test.ts` for `addDeckColour(editor, selection, channel, hex)`:
  - In one undo step, the swatch is added and the colour applied.
  - Adding an existing colour applies it without duplicating it.
  - It announces "Saved to this deck as n of 12".
  - At 12 colours it throws nothing, because the UI never calls it then. Add a guard test: it returns `false` and writes nothing.

### Implementation

- [ ] T045 [P] [US3] Create `packages/ui/src/components/colour-area.tsx` (an S×V box: pointer drag with pointer capture, and keyboard control per T042) and `packages/ui/src/components/hue-slider.tsx`. Use tokens only; the gradient backgrounds are built from the `hue` prop through CSS custom properties. Add gallery samples. T042 is now green.
- [ ] T046 [US3] Implement `addDeckColour` in `apps/app/src/editor/style/apply-style.ts`: `oneStep(editor, () => { editor.addSwatch(hex); editor.setStyle(targets, channel, hex); })`, guarded by `MAX_SWATCHES`, with the announcement. T044 is now green.
- [ ] T047 [US3] Extend `apps/app/src/editor/style/style-picker.tsx`:
  - The "Deck colours" `SwatchGrid` (7 columns) plus the "+" button (dashed border; hidden at `>= MAX_SWATCHES`).
  - The add panel: `ColourArea`, `HueSlider`, the hex `Input` (kept in sync both ways through `normalizeHex` / `hsvToHex`), the error text, the `readableText` warning (FR-026), and Add and Cancel.
  - "Saved to this deck as n of 12" in the footer.
  - `onPreview` calls `setStylePreview` while the value is valid.

  T043 is now green.

- [ ] T048 [US3] Wire the preview and the add in `StylePopover` (`field-popover.tsx`) and in `appearance-section.tsx`: closing the popover or changing the selection clears `stylePreview` (T022). Add a test showing that the preview changes the rendered card's `data-text` / description, and that Cancel leaves `editor.undoManager` with no new step.
- [ ] T049 [US3] Confirm the paste behaviour (R12) with a test in `packages/model/test/fragment.test.ts`: a fragment of a node with a hex fill pastes the hex into a deck that has no such swatch, and the target's `swatches` is unchanged.

**Checkpoint**: US3 scenarios 1–9 pass. Export and re-import keep the swatches and their order (quickstart 8).

---

## Phase 7: User Story 4 — Remove a deck colour (P3)

**Goal**: a custom swatch can be removed from the deck via × or ⌫; cards keep their colour.

**Independent test**: quickstart scenario 5.

- [ ] T050 [P] [US4] Add failing tests:
  - In `packages/ui/test/swatch-grid.test.tsx`, a `removable` swatch shows a `button` "Remove #7a3cff from deck colours" on hover and on focus. ⌫ or Delete on the focused swatch calls `onRemove`, and focus moves to the next swatch (or "+").
  - In `apps/app/src/editor/style/apply-style.test.ts`, `removeDeckColour` is one undo step, leaves node styles untouched, and announces "Removed #7a3cff from deck colours".
  - In `style-picker.test.tsx`, a card whose fill is a hex not in the deck list shows no checked radio, and the footer shows the hex.
- [ ] T051 [US4] Add `removable` / `onRemove` to `packages/ui/src/components/swatch-grid.tsx` (a 16 px inverse × badge that is a sibling button, not nested in the radio). Implement `removeDeckColour` in `apps/app/src/editor/style/apply-style.ts`, and wire it into the deck grid in `style-picker.tsx`. When the deck drops below 12, "+" comes back. T050 is now green.

**Checkpoint**: US4 scenarios 1–4 pass.

---

## Phase 8: User Story 5 — Colour a group (P3)

**Goal**: groups get a fill tint and a dashed coloured stroke, including when collapsed.

**Independent test**: quickstart scenario 10.

- [ ] T052 [P] [US5] Add failing tests:
  - In `apps/app/src/editor/group-boundary-node.test.tsx`, a group with `look.fill` has the description "Teal fill", and one with `look.stroke` has "Red stroke" and `data-stroke`. With a custom dark fill, the label has `data-text="light"`.
  - In `collapsed-group-node.test.tsx`, a collapsed coloured group renders with the same description as a card.
- [ ] T053 [US5] Render group colours:
  - In `apps/app/src/editor/group-boundary-node.tsx`, the fill replaces `bg-group` through `--card-fill`, and the stroke becomes `border-[1.5px] border-dashed border-(--card-stroke)`. The drop-target state still wins. The label follows the text rule on custom fills.
  - In `apps/app/src/editor/collapsed-group-node.tsx`, apply the same rules as `DeckNode` (the front plate only).

  T052 is now green.

- [ ] T054 [US5] Add `AppearanceSection` to `apps/app/src/editor/inspector/group-inspector.tsx`, after `FrameFields`. Check that the group toolbar shows the Colour button after Collapse. Add tests.

**Checkpoint**: US5 scenarios 1–4 pass.

---

## Phase 9: Polish and cross-cutting

- [ ] T055 [P] Outline: in `apps/app/src/editor/outline.ts`, `buildOutline` carries `look`. In `outline-tree.tsx`, show an 8 px `aria-hidden` mark before the title (the fill, or a stroke-only ring) and add the colour to the row's accessible description. Add tests (FR-035).
- [ ] T056 [P] Minimap: in `apps/app/src/editor/canvas.tsx`, `nodeColor={(n) => n.data.look?.fill ?? 'var(--color-surface-3)'}` and `nodeStrokeColor` in the same way. Add a test through the node data mapping.
- [ ] T057 [P] Export:
  - `apps/app/src/editor/export/export-palette.ts` `LIGHT_PALETTE.cardColours` (the light hex values from the tokens), plus `cardText { dark, light }`, guarded in `export-palette.test.ts` against `tokens.css`.
  - `scene.ts`: `SceneCard` / `SceneGroup` gain `fill?`, `stroke?` and `text`.
  - `render-svg.ts`: use them in `card()` (resolving `TODO(020)`), for groups (a dashed stroke), and for collapsed cards.

  Add tests in `export/scene.test.ts` and `render-svg.test.ts`.

- [ ] T058 [P] Update `DESIGN.md` "Card colours": add a hex column, state that OKLCH is the design source and hex is what ships, and replace "below 0.18 … flip to white" with the higher-contrast rule (switching near 0.20) and the warning band. Add the error ring (107) to the node states line.
- [ ] T059 [P] Update the package docs:
  - `packages/schema/CLAUDE.md` Status (the colour defs, `swatches`, S6 / S7 if added).
  - `packages/model/CLAUDE.md` "Added by 020" (`setStyle`, `addSwatch`, `removeSwatch`, `MAX_SWATCHES`).
  - `packages/ui/CLAUDE.md` ("Tokens added by 020", `SwatchGrid`, `ColourArea`, `HueSlider`, `readableText`, `colour.ts`).
  - `apps/app/CLAUDE.md` (`editor/style/`, the `style.colour` action, `stylePreview`).
  - `.agents/skills/react-flow/SKILL.md` (the per-node CSS custom property recipe).
- [ ] T060 [P] Update `docs/backlog.md`: mark 020 as implemented, with links to the spec and ADR.
- [ ] T061 Accessibility pass:
  - Complete quickstart 1, 3 and 5 with the keyboard only.
  - Check with a screen reader that swatch names, the checked state, the warning and the announcements are read.
  - Check that reduced motion shows no popover or preview animation.
  - Confirm the contrast tests from T015 cover every new pair.
- [ ] T062 Visual check against screens 91 (Appearance), 105, 106 and 107, in light and dark at 1440×900. Take screenshots into `specs/020-card-style/screens/` and list the differences in `specs/020-card-style/visual-check.md` (SC-007). Call out the new error ring on uncoloured problem cards.
- [ ] T063 Run `pnpm bench` and `BENCH_COLOURS=1 pnpm bench` after the change, and save them in `specs/020-card-style/bench-after.md` next to `bench-before.md`. Confirm pan, zoom and drag are within 5 % and flow highlight is < 100 ms (SC-005).
- [ ] T064 Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` and fix anything red. The smoke suite (including the no-third-party-requests check) must pass unchanged.
- [ ] T065 Run the quickstart scenarios 1–12 by hand and record the results in the PR description.

---

## Dependencies and execution order

- **Setup (T001–T004)** comes first. T003 and T004 can run in parallel.
- **Foundational (T005–T022)** blocks every story:
  - Schema: T005 → T006 → T007 → T008.
  - Model: T009–T011 (tests, in parallel) after T008, then T012 → T013 → T014.
  - UI helpers: T015, T016 → T017, T018. They are independent of schema and model and can start at once.
  - App: T019 → T020 (needs T007 types and T018), then T021 and T022 (need T020).
- **US1 (T023–T034)** depends on Foundational. It is the MVP.
- **US2 (T035–T038)** depends on US1's picker (T029), apply helper (T030) and toolbar (T032).
- **US6 (T039–T041)** depends on T033 (card rendering). It can run in parallel with US2.
- **US3 (T042–T049)** depends on US1. T042 and T045 (the ui components) can start after Foundational.
- **US4 (T050–T051)** depends on US3's deck grid (T047).
- **US5 (T052–T054)** depends on Foundational (T021) and US1's picker. The rendering (T053) can run in parallel with US2–US4.
- **Polish (T055–T065)** comes last. T055–T060 can run in parallel.

Story order is US1 → US2 → US6 → US3 → US4 → US5.

## Parallel examples

- **Foundational**: T009, T010, T011 (model tests in separate files) together with T015, T016 (ui tests) and T019.
- **US1**: T023, T024, T025, T026, T027 (separate test files), then T028 alongside T030 and T031.
- **US3**: T042 and T045 (ui sliders) alongside T043 and T044.
- **Polish**: T055, T056, T057, T058, T059, T060.

## Implementation strategy

1. **MVP**: Setup, then Foundational, then US1. The result is a named fill and stroke on one card from the toolbar and the drawer, round-tripping through the file. This is a shippable PR if the scope has to be split.
2. **Increment 2**: US2 + US6. Multi-selection, plus states guaranteed on colour, which finishes the P1 scope.
3. **Increment 3**: US3 + US4. Deck colours with preview, warning, limit and removal.
4. **Increment 4**: US5 and Polish. Groups, outline, minimap, export, docs, visual check and bench.

Each increment ends with a green `pnpm lint && pnpm typecheck && pnpm test`, and the last one with the full definition-of-done set and the bench numbers.
