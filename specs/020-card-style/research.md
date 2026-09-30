# Research: Card Style (020)

Every decision below was checked against `main` (`60cfc46`). Paths are repo-relative.

## R1 — `ColorRef` in the file format

- **Decision**:
  - Add three `$defs` to `packages/schema/schema/v1.json`:
    - `CardColor`: `enum` of the 13 names (`red, orange, amber, yellow, lime, green, teal, cyan, blue, indigo, violet, pink, slate`), in DESIGN.md order.
    - `HexColor`: `string`, `pattern: "^#[0-9a-f]{6}$"` (lowercase only, FR-002).
    - `ColorRef`: `anyOf: [{ $ref: CardColor }, { $ref: HexColor }]`.
  - Add `$defs/Style`: `{ fill?: ColorRef, stroke?: ColorRef }`, `additionalProperties: false`, `minProperties: 1`.
  - Add optional `Node.style` (after `position`) and `Group.style` (after `size`, per the 016 note).
  - Add optional top-level `swatches`: an array of `HexColor` with `uniqueItems: true`, declared after `tags` and before `nodes`. There is **no** `maxItems`: the 12-colour cap is an editor rule (§g-52, FR-004).
- **Rationale**:
  - A named enum keeps the names discoverable for the future CLI, MCP server and AI agents that read the schema. It also matches the `StickyColor` precedent.
  - A lowercase-only pattern makes duplicates impossible by construction (edge case "hex letter case"). The UI normalizes what the user types.
  - `minProperties: 1` means `"style": {}` is invalid, so "no colour" has exactly one shape: an absent `style` (FR-005).
  - The change is additive and optional, so ADR 0002 says there is no version bump.
- **Test consequences**:
  - `test/schema-walk.ts` does not follow `anyOf`, so `coverage.test.ts` would never see `CardColor` values. Extend the walker to try each `anyOf` branch and report enum values for the branch that matches.
  - `examples/full.sododeck.json` must then use all 13 names (across node and group fill and stroke) plus at least one hex value, and must include `swatches`.
  - `stripPresenceRules` in `scripts/generate.ts` keeps this `anyOf`, because its branches are not presence-only. Confirm that the generated Zod is a `z.union` of an enum and a regex string, and that `generated.test.ts` stays green.
  - If Zod drops `minProperties` or `uniqueItems`, add semantic rule **S6** (style is not empty) and/or **S7** (swatches are unique) in `src/semantic-rules.ts`, each with an invalid fixture.
- **Alternatives**:
  - One string `pattern` holding both names and hex: loses the enum as a named, documented type.
  - `{ name } | { hex }` objects: more verbose JSON (`"fill": { "name": "green" }`), and the backlog acceptance criteria require `"fill": "green"`.
  - Accepting `#RGB` or uppercase: two spellings of one colour break "no duplicates".
  - `maxItems: 12`: would reject files that another tab or tool produced (the spec's edge case). §g-52 puts the cap in the model.

## R2 — Storing and writing styles in the model

- **Decision**:
  - The Yjs layout is unchanged in kind. `style` becomes a nested `Y.Map{fill?, stroke?}` on the node or group map, exactly as `toY` already does for `position`. `fromJSON` and `toJSON` need no special case for it.
  - New op module `packages/model/src/ops/style.ts`:
    - `setStyle(targets: { nodes: Id[]; groups: Id[] }, channel: 'fill' | 'stroke', value: ColorRef | null)`: validates `value` with the generated Zod `ColorRef`, then in one `ctx.transact` sets or deletes the key in each target's `style` map. It creates the map when needed and deletes `style` when it becomes empty (FR-005).
    - It writes key by key into the existing nested map, the same pattern as `writeFields` in `ops/frames.ts`, so a fill change in one tab and a stroke change in another both survive (FR-041).
  - `DeckEditor.setStyle` is exposed from `editor.ts`. The generic `update()` path keeps working for whole-object patches, such as paste and import.
- **Rationale**:
  - `writePatch` replaces any nested object other than `position` as a whole, so updating `{ style: { fill } }` through the generic path would erase a concurrent `stroke`.
  - One op over nodes and groups gives FR-015 (mixed selection, one undo step) without the app having to compose two batches.
- **Alternatives**:
  - Extending `writePatch` to merge `style` the way it merges `position`: works, but "clear only the fill" would need a nested `null` in `Patch`, which would widen a shared type for one field.
  - Flat `fill` / `stroke` fields on the node: diverges from the backlog schema and §g-43.

## R3 — Deck swatches in the model

- **Decision**:
  - `swatches` is stored in `meta` as a `Y.Array<string>`, the same way `tags` is (via `toY`).
  - Wire it through the four places that list meta fields by hand:
    - `deck.ts` `fromJSON` and `toJSON`
    - `ops/meta.ts` `FIELDS`
    - `validate.ts`, the meta pick
    - the `DeckEditor.updateMeta` type
  - New ops in `ops/swatches.ts`:
    - `addSwatch(hex)`: normalizes to lowercase; does nothing if the colour is already present; throws `DeckEditError('invalid', …)` when the list already holds 12 or more (FR-004); otherwise pushes to the `Y.Array`.
    - `removeSwatch(hex)`: deletes every matching index; does nothing if the colour is absent. Nodes and groups are never touched (FR-025).
  - Export `MAX_SWATCHES = 12` from the model so the UI reads the same constant.
- **Rationale**:
  - Pushing to a `Y.Array` makes concurrent adds in two tabs merge, which is the spec's edge case. Replacing the whole array through `updateMeta` would lose one of the two adds.
  - The cap sits in the op, like `assertFrames`, so a longer list from a file or a merge is kept and "+" is simply hidden.
- **Alternatives**:
  - `updateMeta({ swatches: [...] })`: loses concurrent adds (last write wins).
  - Storing swatches per user in `localStorage`: the spec and §g-39 make them deck data that travels with export.

## R4 — Named colour tokens

- **Decision**:
  - Add 26 tokens per theme to `packages/ui/src/styles/tokens.css`: `--sd-card-<name>-fill` and `--sd-card-<name>-stroke`. Values are **hex**, converted from DESIGN.md's OKLCH values with an sRGB gamut clip (table in [data-model.md](data-model.md#named-colour-tokens)).
  - Add `--sd-card-text-dark: #1c1c1a` and `--sd-card-text-light: #ffffff`, with the same values in both themes, for text on custom fills (R6).
  - Map them into Tailwind's `@theme inline` in `theme.css` (`--color-card-<name>-fill`, …). Components reference them only through a lookup of CSS variable names, never as literal colours.
  - DESIGN.md "Card colours" gains a hex column, and notes that OKLCH is the design source while hex is what ships.
- **Rationale**:
  - The existing contrast and parity tests (`packages/ui/test/contrast.test.ts`, `monaco-theme.test.ts`) only read hex tokens. With hex, the new pairs are covered automatically: ink and text-secondary on every fill, in both themes.
  - The export palette (`export-palette.ts`) and the minimap need plain values anyway.
  - 10 of the 13 OKLCH pairs fall slightly outside sRGB, so browsers would clip them on most screens anyway. Clipping them once, in a tested table, keeps canvas, export and minimap identical.
- **Measured** (with the hex values):
  - Light theme: ink on fill is 14.1–15.0:1 and text-secondary on fill is 6.2–6.6:1.
  - Dark theme: ink is 11.0–11.7:1 and text-secondary is 6.4–6.9:1.
  - Stroke against surface is 3.2–4.8:1 (light) and 5.7–7.7:1 (dark), all ≥ 3:1 for non-text UI (WCAG 1.4.11).
  - FR-032 and SC-002 therefore hold for every named fill.
- **Alternatives**:
  - OKLCH in `tokens.css`: needs a new OKLCH parser in the contrast tests, and export would still need hex.
  - Inline OKLCH in components: breaks the "tokens only" rule.

## R5 — Rendering colours on cards and groups

- **Decision**:
  - The pure resolver `apps/app/src/editor/style/card-style.ts` maps `Style` and the deck's text rule to `CardLook`: `{ fill?: string; stroke?: string; text: 'default' | 'dark' | 'light'; customFill: boolean }`, where the colour strings are CSS values (`var(--sd-card-green-fill)` or `#7a3cff`).
  - `deck-to-flow.ts` adds `look` to `DeckNodeData` and `GroupBoundaryData` (and to the collapsed-group data). It is included in the WeakMap / Map cache checks by a structural compare of its four fields, so unchanged nodes keep their identity.
  - `DeckNode` sets two CSS custom properties inline (`--card-fill`, `--card-stroke`) and toggles classes:
    - a fill class that sets the background from `--card-fill`;
    - a stroke class that sets a 1.5 px border from `--card-stroke`, **only when no state class sets its own border** (current flow step, connect target). That keeps the flow ring distinct (FR-036, spec US6-5).
    - text classes: on a named fill the subtitle uses `text-ink-secondary` instead of `text-ink-muted`; on a custom fill the title, subtitle, owner and glyphs use `--sd-card-text-dark` or `--sd-card-text-light`.
  - The same applies to every semantic-zoom level (it is one component, `levels.ts`) and to `collapsed-group-node.tsx`.
  - Groups (`group-boundary-node.tsx`): the fill replaces `bg-group` (a solid frame fill); the stroke gives a 1.5 px dashed border; the label text follows the same text rule on custom fills.
  - Error state (design 107): cards with a problem (015) also get a 3 px dashed `clay-ink` outline outside the card, next to the existing alert glyph. The glyph sits on a surface-coloured badge, so it reads on any fill.
- **Rationale**:
  - Inline custom properties plus fixed classes keep Tailwind output static and avoid per-node style objects. `React.memo` on `DeckNode` plus the cached `data` means only recoloured cards re-render.
  - Suppressing the stroke under state borders is the simplest way to make sure a stroke never looks like "on the flow".
- **Alternatives**:
  - A generated class per colour (`bg-card-green-fill`): 26 × variants, and it still needs inline styles for custom hex.
  - `data-fill="green"` plus CSS attribute selectors in `index.css`: works for named colours, but custom hex still needs inline styles, so there would be two mechanisms.

## R6 — Text colour on custom fills

- **Decision**:
  - The pure helper `readableText(hex)` in `packages/ui/src/lib/contrast.ts` returns `{ text: 'dark' | 'light'; ratio: number; readable: boolean }`. It compares `--sd-card-text-dark` (#1c1c1a) and `--sd-card-text-light` (#ffffff) against the fill, picks the one with the higher WCAG ratio, and sets `readable = ratio >= 4.5`.
  - `contrast.ts` also exports `relativeLuminance` (currently private).
  - The text colours are the same in both themes, because a custom hex is identical in both themes (FR-031).
  - On custom fills the subtitle and glyphs use the title's colour, not a muted variant, so they get the same contrast.
- **Numbers**:
  - "Higher contrast" switches from dark to light at relative luminance **≈ 0.204** (both give 4.13:1 there).
  - Neither colour reaches 4.5:1 between ≈ 0.183 and ≈ 0.227. That is exactly the band where the clarified spec shows the warning (FR-026).
  - DESIGN.md's "flip below 0.18" is updated to "whichever of dark or white text gives more contrast (switches near 0.20)".
- **Rationale**: FR-033 says "higher contrast". A fixed 0.18 threshold would choose dark text between 0.18 and 0.204, which is always the worse option there.
- **Alternatives**:
  - A fixed 0.18 threshold: slightly lower contrast in that band, for no benefit.
  - Theme-dependent ink: dark-theme ink is light, so the same custom card would flip text between themes while its fill stays the same.

## R7 — Picker surfaces and the action module

- **Decision**:
  - New action module `apps/app/src/editor/actions/style-actions.ts`, registered in `ACTIONS`:
    - `colour`: a toolbar field (`field: 'style'`). `where.toolbar` is `['component','components','group','mixed']`, and `where.menu` is `['component','components','group','mixed']`, in section `edit`, with the label "Colour…".
    - In the menu it runs `openToolbarField('style')`, so the picker opens from the toolbar anchored to the selection. There is no second popover anchor.
    - It uses the default `modes: ['edit']`, so it is hidden in flow mode and in flow sessions (FR-040).
  - `ToolbarFieldId` gains `'style'`. `field-popover.tsx` renders `StylePopover` for it, at the wide width of 272 px.
  - The toolbar button shows the current fill as a small swatch (or a "no colour" / "mixed" glyph) with the accessible name "Colour: Green" / "Colour: Mixed" / "Colour: none".
  - The drawer's `AppearanceSection` (`inspector/appearance-section.tsx`) is added to `NodeInspector` (after Links / Pin), `BulkInspector` and `GroupInspector` (after `FrameFields`). It shows two rows, Fill and Stroke, each a button with the current swatch and name that opens the same `StylePicker` in a `Popover`, with that tab preselected.
- **Rationale**:
  - ADR 0015 says one action list drives the toolbar, the menu and keys.
  - Reusing the toolbar field state gives Esc and focus return for free.
- **Alternatives**:
  - A `children` radio submenu with 13 + n items in the context menu: long, has no custom-colour input, and would differ from the picker.
  - Separate Fill and Stroke toolbar buttons: design 105 shows one popover with tabs (spec Assumptions).

## R8 — The picker component

- **Decision**:
  - The presentational parts go in `packages/ui/src/components/` (no model, tokens only):
    - `swatch-grid.tsx`: `SwatchGrid` is a `role="radiogroup"` using roving tabindex and arrow keys in a 7-column grid (FR-014). `Swatch` is a `role="radio"` with `aria-checked`, and shows the ring and check when checked. The remove badge is a sibling button labelled "Remove #7a3cff from deck colours". ⌫ / Delete on a focused custom swatch calls `onRemove`.
    - `colour-area.tsx`: `ColourArea` is the saturation × value box. It is a single focusable `role="slider"` with `aria-valuetext` ("Saturation 60 %, brightness 40 %"): arrows step by 1 %, and ⇧ plus arrows by 10 %.
    - `hue-slider.tsx`: `HueSlider` is a `role="slider"` from 0 to 359.
    - `lib/colour.ts`: pure `hsvToHex`, `hexToHsv` and `normalizeHex` (accepts `7A3CFF`, `#7a3cff` or `#7A3CFF`, and returns `#7a3cff` or `null`).
  - The Fill / Stroke tabs reuse `SegmentedControl` (a Radix radio group; no new primitive).
  - The app composes them in `apps/app/src/editor/style/style-picker.tsx`: tabs, "No colour", the named grid, the deck grid ending in "+", the footer (name and token, or hex, or "n of 12"), and the add panel with the hex `Input`, Add and Cancel.
- **Rationale**:
  - The platform `<input type="color">` looks different in every browser, can't be embedded in the popover, and doesn't match design 106.
  - A small HSV area plus hue slider is about 150 lines, with no dependency (constitution VIII).
- **Alternatives**:
  - `react-colorful` (≈ 2 KB): small, but it would still be a new runtime dependency needing founder approval, for something the platform and a few pure functions cover.
  - Hex field only: fails design 106.

## R9 — Live preview without touching the document

- **Decision**:
  - The UI store gets `stylePreview: { channel: 'fill' | 'stroke'; value: ColorRef } | null`.
  - `toFlowNodes` (and the group mappers) take it as an input, just like selection. For selected ids the preview overrides that channel in the resolved `look`.
  - Add commits through `setStyle` and `addSwatch` inside `oneStep`, then clears the preview. Cancel or close only clears it (FR-021). Nothing is written to Yjs until Add, so there is no undo entry and no autosave.
  - Hovering the named swatches does **not** preview. Only the custom input does, matching design 106.
- **Rationale**:
  - Principle I: a draft is UI state, and writing it to Yjs then rolling it back would reach autosave and the other tabs.
  - Mapping at the same point as selection keeps the cache logic in one place.
- **Alternatives**:
  - Each `DeckNode` subscribing to the store: 500 selector calls on every store change.
  - A CSS override injected by id: bypasses the derived-canvas rule (apps/app/CLAUDE.md).

## R10 — Add, apply and remove as undo steps

- **Decision**:
  - Picking a swatch or "No colour" runs `oneStep(editor, () => editor.setStyle(targets, channel, value))`.
  - Add runs `oneStep(() => { editor.addSwatch(hex); editor.setStyle(targets, channel, hex); })`, so one ⌘Z undoes both (spec US3-9).
  - Remove runs `oneStep(() => editor.removeSwatch(hex))`, with no confirmation (spec Assumptions) and an announcement: "Removed #7a3cff from deck colours".
  - A selection of stickies and connections together with cards: `targets` keeps only nodes and groups. The picker footer says "Colours 3 of 5 selected items" when some items are skipped.
- **Rationale**: this matches 019 FR-025 (one step per selection) and §g-11 / §g-19. Those rules cover deleting objects, not swatches.

## R11 — Outline, minimap and export

- **Decision**:
  - **Outline**: `buildOutline` carries `look`. The row shows an 8 px mark before the title (the fill, or a ring in the stroke colour when there is only a stroke). The mark is `aria-hidden`; the row's accessible description gains "Green fill" / "Custom fill #7a3cff".
  - **Minimap**: `nodeColor` becomes a function returning `node.data.look?.fill ?? 'var(--color-surface-3)'`. `nodeStrokeColor` does the same for the stroke.
  - **Export** (012, always light):
    - `export-palette.ts` `LIGHT_PALETTE` gains `cardColours: Record<CardColor, { fill; stroke }>`, copied from the light tokens. `export-palette.test.ts` checks it against `tokens.css`.
    - `scene.ts` adds `fill?`, `stroke?` and `text` to `SceneCard` / `SceneGroup`, resolving names against the palette (hex stays as-is).
    - `render-svg.ts` uses them, which resolves `TODO(020)` at `card()`.
- **Rationale**: FR-035. Export already renders its own SVG and never reads the DOM, so the palette mirror is the established pattern.

## R12 — Paste, other decks and oversized lists

- **Decision**:
  - The 016 fragment is built from `emptySododeckFile()`, so node and group `style` travel with a paste, and `swatches` do not (spec edge case: the pasted hex is kept and not added to the target deck).
  - `fromJSON` accepts any number of swatches. The picker hides "+" when `swatches.length >= MAX_SWATCHES` (FR-004).
  - Unknown names and malformed hex fail the normal file validation (Zod / Ajv), with a message naming the path.
- **Rationale**: no new code paths. The existing fragment and load checks already behave as the spec wants.

## R13 — Performance

- **Decision**:
  - Add a `colours=1` query parameter to `src/routes/bench-page.tsx` / `src/bench/generate-deck.ts`. It gives every generated node a fill (cycling through the 13 names plus 2 hex) and every 5th node a stroke. `BENCH_COLOURS=1` passes it from `perf.bench.ts`.
  - Run `pnpm bench` on `main` before starting, then after the change with and without `BENCH_COLOURS=1`. Report the pan/zoom, drag and flow-highlight numbers (SC-005: within 5 %).
- **Rationale**: principle V. The only per-frame cost is two inline custom properties per card. The resolver runs in `toFlowNodes` and is cached per node.

## R14 — Mode gating

- **Decision**:
  - Flow mode and flow sessions: the action's default `modes: ['edit']` hides the toolbar button and the menu item.
  - The drawer shows `FlowInspector` in flow mode, so the Appearance section is not reachable there.
  - The "view-only editor (< 1024 px)" from the spec does not exist in the app yet (`use-action-context.ts` notes that `viewOnly` is never returned). The action lists `modes: ['edit']`, so it will be hidden automatically once that mode lands.
  - Colours still render in every mode (FR-040).

## R15 — Docs and ADR

- **Decision**:
  - Write ADR **0018-card-style** (or the next free number if another feature merges an ADR first). It covers `ColorRef` and why it has a named enum plus lowercase hex, the model-level cap, hex tokens clipped from OKLCH, the "higher contrast" text rule, and preview as UI state.
  - Update:
    - DESIGN.md "Card colours" (the hex column and the text rule)
    - `packages/schema/CLAUDE.md` Status
    - `packages/model/CLAUDE.md` "Added by 020" (`setStyle`, `addSwatch`, `removeSwatch`, `MAX_SWATCHES`)
    - `packages/ui/CLAUDE.md` "Tokens added by 020" and the new components
    - `apps/app/CLAUDE.md` (the style action module and `stylePreview`)
    - `.agents/skills/react-flow/SKILL.md` if the per-node custom-property recipe is new there.
