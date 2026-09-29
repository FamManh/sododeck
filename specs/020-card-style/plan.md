# Implementation Plan: Card Style (Fill and Stroke Colours)

**Branch**: `020-card-style` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/020-card-style/spec.md`, clarified on 2026-09-29: a mid-tone custom colour where no text colour reaches 4.5:1 is allowed, uses the higher-contrast text, and shows a warning in the add panel (FR-026).

**Dependency**: 019 (card quick edit, `55c087e`) and 016 (canvas editing, `60cfc46`) are merged on `main`. I checked these names on `main`:

- **Actions**: `ACTIONS`, `Action` (`field`, `where`, `modes`, `section`), `actionsFor`, `runAction`, `oneStep`, `writeNodesOnce`, `ToolbarFieldId`, `openToolbarField`.
- **Toolbar and menus**: `FieldPopover`, `ChoiceList`, `toolbarVariant` (`component | components | connection | group | mixed`), `canvas-menu.tsx`.
- **Drawer**: `NodeInspector`, `BulkInspector`, `GroupInspector` (+ `FrameFields`), `PanelSection`, `FlowInspector`.
- **Canvas**: `DeckNode` (one memoized component for all levels), `GroupBoundaryNode`, `CollapsedGroupNode`, `toFlowNodes` / `groupNodes` / `collapsedNodes` with per-object caches, `MiniMap nodeColor`.
- **Export**: `scene.ts`, `render-svg.ts` (`TODO(020)` in `card()`), `LIGHT_PALETTE` + `export-palette.test.ts`.
- **Model**: `DeckEditor.{update, updateMeta, batch, beginGesture, endGesture}`, `writeFields` (`ops/frames.ts`), meta `FIELDS`, `validateObject`, `DeckEditError`, `round-trip.test.ts`.
- **Schema**: `v1.json` (root `additionalProperties: false`), `StickyColor` precedent, `schema-walk.ts`, `coverage.test.ts`, `fixtures.ts`, `semantic-rules.ts` (S1–S5).
- **UI**: `contrast.ts` (`contrastRatio`), `tokens.css` / `theme.css`, `SegmentedControl`, `Popover`, `Input`, `Tooltip`.

## Summary

Components and groups get an optional fill and stroke, and each deck keeps up to 12 custom colours of its own.

- **File format** (R1):
  - `CardColor` (13 names), `HexColor` (lowercase `#rrggbb`), `ColorRef = anyOf`, and `Style { fill?, stroke? }` (`minProperties: 1`).
  - Optional `Node.style`, `Group.style` and root `swatches`, with no `maxItems`.
  - No version bump. ADR 0018.
- **Model** (R2, R3):
  - `setStyle(targets, channel, value | null)` writes key by key into a nested `Y.Map`, drops an empty style, and covers nodes and groups in one transaction.
  - `addSwatch` / `removeSwatch` work on a `meta` `Y.Array`. The 12 cap is checked in `addSwatch` only; `MAX_SWATCHES` is exported.
  - `swatches` is wired through `fromJSON` / `toJSON` / meta fields / validate.
- **Tokens** (R4): 26 hex card tokens per theme, clipped from DESIGN.md's OKLCH, plus `card-text-dark` / `card-text-light`. The existing contrast tests cover them: every named fill passes 4.5:1 for ink and secondary text in both themes.
- **Rendering** (R5, R6, R11):
  - A pure `resolveLook` feeds `CardLook` into `deck-to-flow` (in the cache checks). `DeckNode`, the group frame and the collapsed card set `--card-fill` / `--card-stroke` inline.
  - The stroke is suppressed while a state border is active.
  - Text on custom fills uses `readableText(hex)`, the higher-contrast of dark and white, which switches near luminance 0.20.
  - The design-107 dashed clay error ring is added.
  - The outline gets a colour mark, the minimap a `nodeColor` function, and export gets palette card colours.
- **Picker** (R7, R8):
  - The `style.colour` action appears in the toolbar and the context menu, for components, groups and mixed selections, in edit mode only.
  - `StylePopover` has Fill / Stroke (`SegmentedControl`), No colour, the named `SwatchGrid`, the deck `SwatchGrid` plus "+", and a footer.
  - The add panel uses `ColourArea` + `HueSlider` + a hex `Input`. New presentational parts go in `packages/ui`; there is no new dependency.
  - The drawer gains an `AppearanceSection` in the node, bulk and group inspectors.
- **Preview and undo** (R9, R10):
  - `stylePreview` is UI-only and is mapped in `toFlowNodes`. Nothing is written until Add.
  - Pick, add + apply, and remove are each one `oneStep`.
- **Tests and bench** (R13): schema, model, pure, and component tests by role and name. No new e2e. `pnpm bench` runs before and after, plus a `BENCH_COLOURS=1` run.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all already installed; no new dependency.

- `@xyflow/react` ^12 (`MiniMap nodeColor` / `nodeStrokeColor` functions), `yjs`, `zustand` 5, and `radix-ui` through `packages/ui` (`Popover`, `RadioGroup` via `SegmentedControl`).
- `lucide-react` icons: `Palette` (toolbar fallback), `Check`, `Plus`, `X`, `Ban` ("No colour"), `TriangleAlert` (warning).

**Storage**:

- **Schema v1, additive**: `CardColor`, `HexColor`, `ColorRef`, `Style`, `Node.style`, `Group.style`, root `swatches`. Types and Zod are regenerated with `pnpm schema:generate`.
- **Yjs**: nested `Y.Map` for `style`, and a `meta` `Y.Array` for `swatches` (R2, R3). No layout migration.
- **UI store**: `'style'` added to `ToolbarFieldId`, plus `stylePickerTab` and `stylePreview`.

**Testing**:

- **Schema**:
  - `schema-walk.ts` follows `anyOf`. `full.sododeck.json` uses all 13 names, a hex value and `swatches` (coverage + key order).
  - Invalid fixtures: `"Green"`, `"#7A3CFF"`, `"#abc"`, `"purple"`, `style: {}`, `style.opacity`, and a duplicate swatch. Semantic rules S6 / S7 are added only if Zod drops `minProperties` / `uniqueItems`.
  - Ajv/Zod parity stays green.
- **Model** (`packages/model/test`):
  - Round trip: named and hex styles on nodes and groups, `swatches` order, 14 swatches, and an old deck with no keys added (see [data-model](data-model.md#round-trip-cases-packagesmodeltestround-triptestts)).
  - `setStyle`:
    - one undo step across nodes and groups
    - clearing the last key removes `style`
    - an invalid value throws before any write
    - concurrent fill and stroke edits from two docs merge
  - `addSwatch`: normalizes, ignores duplicates, throws on the 13th, and concurrent adds merge.
  - `removeSwatch` leaves node styles untouched.
- **Vitest, pure**:
  - `packages/ui`: `lib/colour.ts` (`normalizeHex`, `hsvToHex` / `hexToHsv` round trip) and `readableText` (the 0.204 switch, the 0.183–0.227 warning band, `#1f2a44` → light, `#7c7c7c` → not readable).
  - `apps/app`: `resolveLook` (named, hex, preview override, undefined when there is no style), `deck-to-flow` (the look sits in the cache check and unchanged nodes keep identity), `buildOutline` (look), `export/scene` (card and group colours from the palette), and `export-palette.test.ts` (card colours match the light tokens).
  - Contrast tests: new pairs for each fill against ink and secondary, and each stroke against surface.
- **Testing Library, by role and name** (the [contract](contracts/card-style-ui.md)):
  - `packages/ui`: `swatch-grid` (arrow keys, checked state, remove button, ⌫), `colour-area` and `hue-slider` (keys and `aria-valuetext`).
  - `apps/app`: `style-popover` (apply, No colour, Mixed, add, invalid, warning, limit hides "+", preview cleared on Cancel), `style-actions` (menu "Colour…" on the four targets, hidden in flow mode), the toolbar button name, `appearance-section` in three inspectors, and `deck-node` (the accessible description names the colour, and the flow step hides the stroke).
- **E2E**: no new tests (constitution VI). Smoke stays green.
- **Bench**: before and after, plus `BENCH_COLOURS=1`.

**Target Platform**: latest 2 versions of Chrome, Edge, Firefox and Safari. CSS custom properties and hex colours are universal, and no browser-only API is used.

**Project Type**: web app (monorepo). Changes span `packages/schema`, `packages/model`, `packages/ui` and `apps/app`.

**Performance Goals**:

- No pan, zoom or drag regression beyond 5 % with every card coloured (SC-005).
- Flow highlight stays < 100 ms.
- `resolveLook` runs once per changed node; unchanged nodes keep their object identity.

**Constraints**:

- One undo step per pick, add + apply, or remove.
- The preview never touches Yjs.
- Only tokens in components. Hex appears only as user data (inline custom properties) and in the token and palette files.
- No network.

**Scale/Scope**:

- About 14 new files:
  - 4 in `packages/ui`: `swatch-grid`, `colour-area`, `hue-slider`, `lib/colour`
  - 2 in model: `ops/style`, `ops/swatches`
  - about 6 in `apps/app/src/editor/style/` and `actions/`
  - tests
- About 25 changed files.
- 1 ADR, plus updates to DESIGN.md and 4 `CLAUDE.md` files.

## Constitution Check

_GATE: passes before Phase 0. Re-checked after Phase 1 design: still passes, with no deviations._

| Principle                        | Status | How                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth        | ✅     | Styles and swatches live only in the Yjs document and are written through `DeckEditor.setStyle` / `addSwatch` / `removeSwatch`. `CardLook` is derived in `deck-to-flow` and never stored. The live preview, the picker tab and the open state are UI-only store fields; nothing is written until Add (R9).                                                                                                                                                                             |
| II. Schema-owned format          | ✅     | `v1.json` gains optional `$defs` and properties, and types and Zod are regenerated with parity green. `style` and `swatches` round-trip through the existing `toY` / `fromY` plus hand-wired meta fields in `packages/model` only. There are round-trip cases for each new field and for an old deck. Additive, so no version bump (ADR 0002).                                                                                                                                         |
| III. Stable identity             | ✅     | No new references. Swatches are values, not ids. Removing a swatch never rewrites objects, and styles are keyed by the object's existing id.                                                                                                                                                                                                                                                                                                                                           |
| IV. Local-first, private         | ✅     | Colours are deck data in IndexedDB and the file. No network, fonts or assets are added, and the smoke test's third-party check is unaffected. No new browser API.                                                                                                                                                                                                                                                                                                                      |
| V. Performance off main thread   | ✅     | The per-node work is O(1) and cached. There is no heavy work, so no worker is needed. Bench runs before and after, plus a fully coloured deck (R13).                                                                                                                                                                                                                                                                                                                                   |
| VI. Strict types, tested         | ✅     | Pure modules have unit tests, model ops have round-trip and behaviour tests, and the UI is tested by role and name. No new e2e.                                                                                                                                                                                                                                                                                                                                                        |
| VII. Accessible                  | ✅     | The picker is fully keyboard operable (radiogroups, sliders, ⌫ to remove), with named swatches, a checked ring plus check icon (not colour alone), announced results, and the warning shown as text. State cues on coloured cards keep their shapes: an outside frame, a dashed ring, badges, and the step border replacing the stroke. Every named fill is tested at 4.5:1 or more, and the custom-fill rule picks the higher contrast and warns when it can't reach it. Tokens only. |
| VIII. Simplicity, justified deps | ✅     | No new dependency: the colour area and hue slider are about 150 lines on top of the platform and Radix (R8, rejecting `react-colorful`). One action module and one popover are reused by the toolbar, menu and drawer. The ADR records the format and contrast decisions.                                                                                                                                                                                                              |

## Project Structure

### Documentation (this feature)

```text
specs/020-card-style/
├── plan.md                     # This file
├── research.md                 # Phase 0: R1–R15
├── data-model.md               # Phase 1: schema, Yjs, model API, tokens, UI state
├── quickstart.md               # Phase 1: validation guide
├── contracts/card-style-ui.md  # user-visible contract
├── checklists/requirements.md
└── tasks.md                    # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
packages/schema/
├── schema/v1.json                       # + CardColor, HexColor, ColorRef, Style, Node.style, Group.style, swatches
├── src/generated/{types,zod}.ts         # regenerated
├── src/semantic-rules.ts (+test)        # + S6 / S7 only if Zod drops minProperties / uniqueItems
├── examples/full.sododeck.json          # + every colour, a hex, swatches
└── test/{schema-walk,fixtures}.ts       # walker follows anyOf; invalid colour fixtures
packages/model/src/
├── ops/style.ts                         # NEW setStyle
├── ops/swatches.ts                      # NEW addSwatch, removeSwatch, MAX_SWATCHES
├── ops/meta.ts, deck.ts, validate.ts    # + swatches in meta fields
├── editor.ts, index.ts                  # wire and export
packages/model/test/                     # round-trip cases, style, swatches
packages/ui/src/
├── styles/tokens.css, theme.css         # + --sd-card-<name>-{fill,stroke}, --sd-card-text-{dark,light}
├── lib/contrast.ts (+test)              # + relativeLuminance, readableText
├── lib/colour.ts (+test)                # NEW normalizeHex, hsvToHex, hexToHsv
├── components/swatch-grid.tsx (+test)   # NEW SwatchGrid, Swatch
├── components/colour-area.tsx (+test)   # NEW saturation × brightness slider
└── components/hue-slider.tsx (+test)    # NEW
apps/app/src/
├── editor/style/                        # NEW (020)
│   ├── card-style.ts (+test)            # resolveLook, CardLook, colour names
│   ├── style-picker.tsx (+test)         # tabs, grids, No colour, footer, add panel
│   ├── style-popover.tsx                # toolbar field wrapper
│   └── apply-style.ts (+test)           # oneStep wrappers + announcements
├── editor/actions/style-actions.ts      # NEW style.colour; registered in index.ts
├── editor/quick-edit/field-popover.tsx  # 'style' field
├── editor/inspector/appearance-section.tsx (+test)  # NEW; used by node, bulk and group inspectors
├── editor/deck-to-flow.ts               # look in node, group and collapsed data + cache checks; preview input
├── editor/deck-node.tsx                 # fill / stroke custom properties, text rule, error ring, description
├── editor/group-boundary-node.tsx, collapsed-group-node.tsx
├── editor/canvas.tsx                    # MiniMap nodeColor / nodeStrokeColor functions
├── editor/outline.ts, outline-tree.tsx  # colour mark + description
├── editor/export/{export-palette,scene,render-svg}.ts
├── state/ui-store.ts                    # 'style' field, stylePickerTab, stylePreview
├── bench/generate-deck.ts, routes/bench-page.tsx  # colours=1
└── design-gallery/style-samples.tsx     # picker + coloured card states for the visual check
apps/app/bench/perf.bench.ts             # BENCH_COLOURS
docs/decisions/0018-card-style.md        # NEW ADR (next free number)
DESIGN.md                                # card colours: hex column, text rule
```

**Structure Decision**: the existing monorepo layout. Format and ops go in `schema` / `model`, tokens and presentational primitives in `ui`, and composition and wiring in `apps/app`. This keeps the dependency direction `app → model → schema`, `app → ui`.

## Complexity Tracking

No constitution violations, so nothing to justify.

## Notes for tasks

- **Order**:
  1. schema
  2. model
  3. tokens and contrast
  4. rendering (so colours can be seen via the JSON / import path)
  5. picker and action
  6. drawer
  7. outline, minimap and export
  8. bench, docs, visual check
- The 107 error ring changes how problem cards look even without colour. Call it out in the PR's visual check.
- Another feature (017) may add ADR 0018 first. Use the next free number at commit time.
