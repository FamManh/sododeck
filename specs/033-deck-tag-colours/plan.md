# Implementation Plan: Deck Tag Colours

**Branch**: `033-deck-tag-colours` | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/033-deck-tag-colours/spec.md`. Defaults from backlog §033, ADR 0022 and design-analysis §g-59, §g-64, §g-75 are taken as decided; the three Clarifications of the spec are kept.

**Dependency**: 029 (`2e85e4a`) is merged on `main`. 035 is independent and may be built in parallel (see "Parallel work with 035" below). I checked these names on `main`:

- **Schema**: `v1.json` root `swatches`, `$defs/Tags`, `$defs/ColorRef`, `$defs/CardColor`, `$defs/HexColor`; `semantic-rules.ts` (S1–S7); `test/fixtures.ts`, `schema.test.ts` (Ajv / Zod parity), `coverage.test.ts`, `key-order.test.ts`; `examples/full.sododeck.json`.
- **Model**: `deck.ts` (layout 2, `fromJSON`, `meta.set('swatches', …)`), `layout.ts` (`metaMap`, `swatchesArray`), `read.ts` `readMeta` (swatches omitted when empty), `ops/swatches.ts` (the pattern to copy), `ops/meta.ts`, `ops/collections.ts` `updateObject`, `validate.ts` `ELEMENT_SCHEMAS.meta`, `editor.ts` (`batch`, `addSwatch`), `key-order.ts` (map keys keep their own order).
- **Canvas**: `deck-node.tsx` (tag `<ul>` with pills and System dots), `card-tags.ts` (`TAG_CHIP`, `tagChips`, `cardTags`, `MAX_CARD_TAGS`), `card-layout.ts`, `deck-to-flow.ts` (node data `tags`, cache checks), `style/card-style.ts` `resolveLook` (chip / ink / dot from the card colour), `view-filter.ts` (`excludeTags`), `index.css`.
- **Drawer and toolbar**: `fields/tags-field.tsx`, `inspector/node-inspector.tsx`, `inspector/bulk-inspector.tsx` (`BulkTags`), `inspector/derive.ts` (`tagSuggestions`, `bulkView`), `quick-edit/field-popover.tsx` (`tags` case), `quick-edit/choice-state.ts` (`tagChoices`), `views/view-settings-popover.tsx` (`tagsOf`, "Hide tags"), `state/ui-store.ts` (`announce`).
- **Export**: `export/scene.ts` (`SceneCard.tags`, `tagChips`), `export/render-svg.ts` (tag pills), `export/export-palette.ts` (chip / ink per named colour), ADR 0016.
- **UI package**: `lib/tags.ts` (`normalizeTag`, `addTag`, `removeTag`), `components/tag-chip.tsx`, `components/tag-input.tsx`, `components/swatch-grid.tsx`, `components/popover.tsx`, `components/search-field.tsx`; `tokens.css` (`--sd-card-<colour>-chip|ink|dot`, `--sd-card-slate-*`), `test/contrast.test.ts`.

## Summary

Tags get one colour per deck, a picker and an editor, and keep the case the user typed.

- **File format** (R1): optional root `tagColors` (tag text → `ColorRef`), declared after `swatches`; semantic rule S8 (no empty key, no two keys equal ignoring case). ADR 0022 row confirmed and refined. No version bump.
- **Document** (R2): `meta.tagColors` is a nested `Y.Map`, always present like `swatches` (so two tabs never create two maps), emitted only when non-empty. `readMeta`, `fromJSON` and `toJSON` carry it.
- **Model ops** (R3): `setTagColor`, `renameTag`, `deleteTag`, each one transaction and one undo step, covering every object that carries the tag (cards, connections, flows, steps, deck tags, view `excludeTags`) and the colour entry. A pure `tagKey` (trim, single-space, lower-case) is exported.
- **Case rule** (R4): matching and uniqueness by `tagKey`; text keeps its case; the display spelling is the `tagColors` key if there is one, else the first spelling in deck order. Pure derivation `deckTags(deck)` gives each tag with colour and card count; `canonicalTag(deck, typed)` picks the spelling written on add.
- **Canvas** (R5): tag pills take the **tag's** colour (slate when none), no longer the card's; System dots too. Node data carries a resolved colour per tag; `deck-to-flow` cache keys include `tagColors`. Card height is unchanged (tag layout does not depend on colour).
- **Picker and editor** (R6, R7): one `TagPicker` (search, rows with colour and count, "Create tag “…” ⏎", pencil) and one `TagEditor` (name, 13 swatches + deck colours, delete with usage count) in one popover, used by the drawer tag row, the bulk drawer and the selection toolbar's Tags popover. Drawer pills are 21px with ×; ⌫ removes, ⏎ opens the picker.
- **Other tag fields** (R8): connections, flows, steps and the deck keep their neutral chips and `TagsField`; they follow the new case rules. `view-filter.ts` and the view settings compare by `tagKey`.
- **Export** (R9): tag pills drawn with the tag's colour from the light palette (custom hex gets a readable ink).
- **Tokens** (R10): no new tokens; `chip` / `ink` / `dot` already exist for 13 colours × 2 themes. New contrast cases for custom hex.
- **Bench** (R11): before / after, with a tagged deck.

**Spec refinements** (decided here from ADR 0022; the spec's acceptance criteria still hold):

1. Rename and delete rewrite **every** object that carries the tag, not only cards, as ADR 0022 says ("rewrites the objects that carry it"). The delete label still counts cards ("used on N cards"); when other objects also carry the tag, a second line says so ("Also on 2 connections and 1 flow").
2. A tag pill on a card follows the **tag's** colour or slate, not the card's colour. Before 033 the pills followed the card's colour (029); a coloured card with uncoloured tags now shows slate pills.
3. The picker lists tags from cards; spelling resolution on add looks at colours, then cards, then the other objects' tags.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all already installed; **no new dependency**. `yjs`, `zustand` 5, Radix through `packages/ui` (`Popover`, `SwatchGrid`, `SearchField`), `lucide-react` (`Pencil`, `Plus`, `Trash2`, `Check`; names to be confirmed against the installed version).

**Storage**:

- Schema v1, additive: root `tagColors`. Types and Zod regenerated with `pnpm schema:generate`.
- Yjs (ADR 0021): `meta.tagColors` `Y.Map<string>`, created in `fromJSON` and lazily for older stored documents (as `swatches`); no layout change, no migration.
- UI store: no new state; the picker's open row and search text are component state.

**Testing**: Vitest (schema, model ops, pure tag helpers, export scene, view filter), Testing Library (picker, editor, drawer row, bulk, toolbar popover by role and name). No new e2e (constitution VI `TODO(e2e)`); the smoke suite must stay green.

**Target Platform**: Evergreen desktop browsers (Chromium for bench and e2e).

**Project Type**: pnpm / turbo monorepo: Vite SPA (`apps/app`) plus internal packages (`schema`, `model`, `ui`).

**Performance Goals**: no regression against the `bench-before` run in pan FPS and long frames at 500 nodes / 1,000 edges (constitution V); `deckTags` for 500 cards under 5 ms; a recolour, rename or delete of a tag on 500 cards is one transaction under 100 ms.

**Constraints**: card size never depends on tags' colour (§g-58); no colour-only meaning (VII): the tag text is always shown, dots at System carry an accessible name; pills use tokens or the user's own hex, never hard-coded colours; no network (IV).

**Scale/Scope**: ~4 schema / model files, ~14 app files, ~3 ui files, docs (DESIGN.md, ADR 0022, ADR 0021 comment, package `CLAUDE.md`s, backlog). Estimate 3 d (backlog).

## Constitution Check

_GATE: passes before Phase 0. Re-checked after Phase 1 design: still passes; no violations._

| Principle                                    | Status | How                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth                    | ✅     | Tag colours live only in `meta.tagColors` of the Yjs document. Canvas pills, drawer, picker, toolbar, export and the JSON panel derive from it through `deckTags` and `tagColourOf`; usage counts are derived, never stored. Picker state (search text, open row) is UI-only component state.                                |
| II. Schema-owned format, lossless round-trip | ✅     | `tagColors` in `v1.json`, regenerated types and Zod, S8 for what Zod cannot say, invalid fixtures for parity. Round-trip cases: colours, mixed case keys, empty map not emitted. Additive optional field, `version` 1 (ADR 0022, 0002). Only `packages/model` converts Yjs ↔ JSON; the three tag ops live there.             |
| III. Stable identity                         | ✅     | A tag is its text by design (ADR 0022: "a tag is still its text on each object"); no ids are derived from titles. Rename rewrites every carrier in one transaction, so no reference breaks; tests cover the rewrite of cards, connections, flows, steps and view filters.                                                    |
| IV. Local-first, private                     | ✅     | No network; no new asset; the smoke no-third-party check is unchanged. No browser-only API is used.                                                                                                                                                                                                                          |
| V. Performance off the main thread           | ✅     | Pure derivations over the snapshot, memoised per deck change; ops are one transaction. A tagged-deck bench before / after is a gate (R11). Nothing heavy enough for a worker.                                                                                                                                                |
| VI. Strict types, tested behaviour           | ✅     | Pure modules (`tagKey`, `deckTags`, `canonicalTag`, ops) unit-tested; model tests for ops, undo, concurrency and round-trip; component tests by role and name per [contracts/tag-ui.md](contracts/tag-ui.md); no new e2e.                                                                                                    |
| VII. Accessible by default                   | ✅     | Picker and editor fully keyboard-operable with visible focus; roles (`listbox` / `option`, `radiogroup` for swatches, `dialog` for confirmations); adds, removals, merges announced; tag meaning never rests on colour (text always shown, dots named); ink on chip ≥ 4.5:1 tested for the 13 colours, slate and custom hex. |
| VIII. Simplicity, justified deps             | ✅     | No new dependency; one popover hosts picker and editor; existing `SwatchGrid`, `Popover`, `TagChip` extended rather than new components for the same job; ADR 0022 row refined in place (no new ADR); `tagKey` is a one-liner kept in two leaf packages with a parity test instead of a new shared package (R4).             |

## Project Structure

### Documentation (this feature)

```text
specs/033-deck-tag-colours/
├── spec.md
├── plan.md                 # this file
├── research.md             # R1–R12
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── tag-ui.md           # roles, names, keys, announcements
│   └── tag-editor-api.md   # DeckEditor methods and pure helpers
├── checklists/requirements.md
├── tasks.md                # /speckit-tasks
├── bench-before.md, bench-after.md, visual-check.md, screens/   # during implementation
```

### Source Code (repository root)

```text
packages/schema/
├── schema/v1.json                      # root tagColors (after swatches)
├── src/semantic-rules.ts               # S8: tagColors keys
├── src/generated/{types,zod}.ts        # regenerated
├── examples/full.sododeck.json         # tagColors entries (coverage)
└── test/{fixtures,schema,semantic-rules}.test.ts   # invalid: empty key, case-duplicate keys, bad colour

packages/model/
├── src/tags.ts                         # tagKey, sameTag, displayTag (pure, exported)
├── src/layout.ts                       # tagColorsMap(doc)
├── src/deck.ts                         # meta.tagColors in fromJSON; layout comment
├── src/read.ts                         # readMeta emits tagColors when non-empty
├── src/validate.ts                     # ELEMENT_SCHEMAS.meta picks tagColors
├── src/ops/tags.ts                     # setTagColor, renameTag, deleteTag
├── src/editor.ts, src/index.ts         # DeckEditor methods, exports
└── test/{tags,round-trip,undo,concurrency}.test.ts

packages/ui/
├── src/lib/tags.ts                     # case-keeping normalizeTag, key-based addTag / removeTag, tagKey
├── src/components/tag-chip.tsx         # colour prop (chip / ink), size 'deck' (21 tall)
├── src/components/tag-input.tsx        # key-based dedupe and suggestions
└── test/{tags,contrast}.test.ts        # case rules; ink on custom hex

apps/app/src/
├── editor/tags/
│   ├── deck-tags.ts (+ .test.ts)       # new: deckTags, canonicalTag, tagColourOf, tag usage
│   ├── tag-colours.ts (+ .test.ts)     # new: chip / ink / dot for a ColorRef or none (slate)
│   ├── tag-picker.tsx (+ .test.tsx)    # new: search, rows, create, pencil
│   ├── tag-editor.tsx (+ .test.tsx)    # new: name, swatches, delete / merge confirmation
│   └── card-tags-field.tsx (+ test)    # new: drawer row for cards (21px pills, ⌫, ⏎)
├── editor/deck-node.tsx                # pills and dots take the tag colour
├── editor/deck-to-flow.ts              # node data tags carry colours; cache includes tagColors
├── editor/style/card-style.ts          # chip mapping factored out and shared
├── editor/inspector/{node-inspector,bulk-inspector,derive}.tsx  # CardTagsField, BulkTags with colour, canonical spelling
├── editor/fields/tags-field.tsx        # other objects: canonical spelling on add
├── editor/quick-edit/{field-popover,choice-state}.tsx  # Tags popover hosts TagPicker
├── editor/view-filter.ts, views/view-settings-popover.tsx  # compare by tagKey
├── editor/export/{scene,render-svg,export-palette}.ts      # coloured pills
└── bench/perf.bench.ts                 # tagged deck variant

docs/  DESIGN.md · decisions/0022-schema-roadmap.md · decisions/0021-… (layout comment) · backlog.md
packages/*/CLAUDE.md, apps/app/CLAUDE.md
```

## Parallel work with 035

033 and 035 depend only on 029. Files both may touch: `deck-node.tsx` (033: tag `<ul>`; 035: step stickers and lip), `index.css`, `DESIGN.md`, `docs/backlog.md`. Use separate worktrees and branches; keep docs edits for after merge; whoever merges second rebases. 033 owns the schema change, so `pnpm schema:generate` output conflicts only on 033's branch. Run `pnpm bench` on each branch alone.

## Complexity Tracking

No constitution violations to justify.
