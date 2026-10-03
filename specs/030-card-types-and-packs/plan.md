# Implementation Plan: Card Types and Packs

**Branch**: `030-card-types-and-packs` | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/030-card-types-and-packs/spec.md` (three founder decisions: Basic shapes with 031, every 030 pack on in new decks, "Kind" → "Type" everywhere).

**Dependency**: 029 is merged. 031 and 032 build on this; 032's spec waits for this plan. I checked these names on `main`: see the "Where kinds are hard-coded today" table in [research.md](research.md) (schema `NodeKind`; ui `COMPONENT_KINDS`, `KIND_STYLE`, `KIND_FALLBACK`, `toComponentKind`, `kind-tile.tsx`; app `kind-label.ts`, `palette.tsx`, `palette-order.ts`, `use-shell-shortcuts.ts` `Digit1–6`, `inspector/choices.ts`, `field-actions.ts`, `view-settings-popover.tsx`, `view-filter.ts`, `export/icon-paths.ts`, `export/scene.ts`, `library/deck-thumbnail.tsx`, `storage/library-db.ts`, `command-palette/palette-results.ts`, `deck-node.tsx`, `collapsed-group-node.tsx`, `outside-proxy-node.tsx`, `bench/generate-deck.ts`; model `deck.ts` `createDeck`, `views.ts`, `ops/views.ts`, `search/index.ts`, `problems.ts` `ProblemKind`); `shell/flyout.tsx` (pin, Esc); ADR numbers 0023 (034) and 0024 (022) reserved.

## Summary

Card types become an app registry grouped in packs; a deck stores which packs are on; Add becomes the frame-127 flyout.

- **File format** (R2): `NodeKind` enum → open `TypeId` (pattern `^[a-z][a-z0-9-]{0,47}$`) for `node.type` and views' kind lists (key names unchanged); root `packs` (`PackId[]`, absent = `["architecture"]`). No version bump. New ADR **0025** "Card type registry"; ADR 0022 rows marked built.
- **Registry** (R1, R3): data in `packages/model/src/card-types.ts` (13 types, 4 packs, helpers); icons and tones in `packages/ui/src/lib/icons.ts` `TYPE_STYLE`; a test ties them together. Today's six ids, icons, tones and names are unchanged ("Gateway" stays).
- **Document** (R4): `meta.packs` `Y.Map<true>`, created on first change or by `createDeck()` with all four packs; emitted in registry order; `setPackOn` refuses the last pack.
- **Add flyout** (R5): search (`/`), category tabs, sections, 3-column tile grid, number keys 1–9 on visible tiles, "Packs · N on" → "Packs in this deck" with switches, inside the existing `Flyout` host.
- **Type picker and copy** (R6): grouped by category, packs-on plus current type; every "Kind" label → "Type".
- **Unknown ids** (R7): fallback tile, raw id as name, kept on save; problems `unknown-card-type`, `unknown-pack`.
- **Everything else** reads the registry: card header, collapsed group tiles, proxies, views, search, command palette, export icons, library thumbnail, bench.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all installed; **no new dependency**. New lucide icons used: `Puzzle`, `SquareCheck`, `Diamond`, `FileText`, `Warehouse`, `Truck`, `Ticket` (present in the installed version; their geometry is copied into `export/icon-paths.ts` under the existing drift test).

**Storage**: schema v1 change (R2) + `pnpm schema:generate`; Yjs `meta.packs` map (R4), no layout change, no migration; library summaries keep storing the type string per node (no IndexedDB schema change).

**Testing**: Vitest (schema parity and fixtures; registry guarantees in [contracts/registry-api.md](contracts/registry-api.md); `deckPacks`, `setPackOn`, `createDeck`, problems, round-trip, concurrency of pack toggles; view filter by type; export scene icons; thumbnail), Testing Library (flyout, packs view, picker, view settings by role and name per [contracts/type-ui.md](contracts/type-ui.md)). No new e2e; the smoke suite must stay green (update only if "Kind" text it asserts changes).

**Target Platform**: Evergreen desktop browsers (Chromium for bench and e2e).

**Project Type**: pnpm / turbo monorepo: Vite SPA (`apps/app`) plus internal packages.

**Performance Goals**: no regression on the 500 / 1,000 bench; `BENCH_TYPES=1` (13 types round-robin) within run-to-run variation; flyout search filters 13 tiles instantly (no debounce needed).

**Constraints**: older decks byte-identical until a pack change (FR-003); single source of truth (packs only in `meta.packs`; flyout tab / search / packs-view state is UI-only); colour never the only cue (each type has its own icon); no network; icons bundled.

**Scale/Scope**: ~3 schema files, ~6 model files, ~3 ui files, ~20 app files, docs (ADR 0025, ADR 0022, DESIGN.md left rail / Add flyout, package `CLAUDE.md`s, backlog §030 / §032 status). Estimate **5 d** (backlog).

## Constitution Check

_GATE: passes before Phase 0. Re-checked after Phase 1 design: still passes; no violations._

| Principle                                    | Status | How                                                                                                                                                                                                                                                                            |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. Single source of truth                    | ✅     | Pack choice lives only in `meta.packs`; card type only in `node.type`. Registry is static app data, not document state. Flyout tab, search text and the packs view are UI-store / component state.                                                                             |
| II. Schema-owned format, lossless round-trip | ✅     | `TypeId`, `PackId`, `packs` in `v1.json`; regenerated types / Zod; fixtures for unknown ids (valid) and bad `packs` (invalid); round-trip cases: legacy file byte-identical, explicit `packs`, unknown type and pack ids preserved. Only `packages/model` converts Yjs ↔ JSON. |
| III. Stable identity                         | ✅     | Type and pack ids are fixed strings independent of names; a test renames a display name and checks nothing stored changes.                                                                                                                                                     |
| IV. Local-first, private                     | ✅     | No network; icons from the bundled set; export icon geometry copied locally.                                                                                                                                                                                                   |
| V. Performance off the main thread           | ✅     | Registry lookups are map gets; no per-frame work added; bench before / after with all types.                                                                                                                                                                                   |
| VI. Strict types, tested behaviour           | ✅     | Pure registry and pack helpers with the guarantees in the API contract; component tests by role and name; no new e2e.                                                                                                                                                          |
| VII. Accessible by default                   | ✅     | Tabs, grid, switches and listbox with names; keyboard paths for search, tabs, tiles, packs and picker; announcements; every type has a distinct icon (tones are not the cue).                                                                                                  |
| VIII. Simplicity, justified deps             | ✅     | No dependency; registry split only along existing package boundaries; one flyout host reused; no generic plugin system (packs are a fixed list until user types exist).                                                                                                        |

## Project Structure

### Documentation (this feature)

```text
specs/030-card-types-and-packs/
├── spec.md
├── plan.md              # this file
├── research.md          # inventory + R1–R8
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── type-ui.md       # roles, names, keys
│   └── registry-api.md  # registry, packs, DeckEditor.setPackOn, TYPE_STYLE
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
packages/schema/
├── schema/v1.json                    # TypeId, PackId, packs; NodeKind removed
├── src/generated/{types,zod}.ts      # regenerated
├── examples/full.sododeck.json       # packs + a new type
└── test/{fixtures,schema,coverage,key-order}.test.ts

packages/model/
├── src/card-types.ts                 # new: registry and helpers
├── src/deck.ts                       # createDeck stores NEW_DECK_PACKS; fromJSON keeps absent packs absent
├── src/layout.ts, src/read.ts        # meta.packs map (lazy), emitted in registry order
├── src/ops/packs.ts                  # new: setPackOn
├── src/problems.ts                   # unknown-card-type, unknown-pack
├── src/search/index.ts               # type name from registry
├── src/views.ts, src/ops/views.ts    # TypeId lists
├── src/editor.ts, src/index.ts
└── test/{card-types,packs,round-trip,concurrency,problems,views}.test.ts

packages/ui/
├── src/lib/icons.ts                  # TYPE_STYLE / TYPE_FALLBACK / typeStyle replace KIND_*
├── src/components/kind-tile.tsx      # type tile (label from caller)
└── test/icons.test.ts

apps/app/src/
├── editor/palette.tsx (+ test)       # Add flyout: search, tabs, sections, grid, numbers, footer
├── editor/packs-panel.tsx (+ test)   # new: Packs in this deck
├── editor/palette-order.ts           # removed (registry order)
├── editor/kind-label.ts              # → type-label.ts (registry typeName)
├── editor/shell/use-shell-shortcuts.ts   # 1–9 on visible tiles
├── state/ui-store.ts                 # palette search / tab / view, visible tiles; 'type' field id
├── editor/inspector/{choices,node-inspector,bulk-inspector}.tsx  # "Type", grouped options
├── editor/quick-edit/field-popover.tsx, actions/field-actions.ts  # "Type: …" picker
├── editor/views/view-settings-popover.tsx, view-filter.ts        # "Hide types" / "Dim types"
├── editor/{deck-node,collapsed-group-node,outside-proxy-node}.tsx  # tile + name from registry
├── editor/command-palette/palette-results.ts
├── editor/export/{icon-paths,scene}.ts   # icons for 13 types + fallback
├── library/deck-thumbnail.tsx, storage/library-db.ts             # TypeId
├── design-gallery/*                  # "Kind" copy → "Type"
└── bench/generate-deck.ts, bench/perf.bench.ts  # BENCH_TYPES

docs/  decisions/0025-card-type-registry.md (new) · decisions/0022-schema-roadmap.md · DESIGN.md (Add flyout, packs, type tiles) · backlog.md (§030 status; §032 unblocked)
packages/schema/CLAUDE.md, packages/model/CLAUDE.md, packages/ui/CLAUDE.md, apps/app/CLAUDE.md
```

**Structure Decision**: existing monorepo layout; registry data in `model`, icons in `ui`, joined in `app` (dependency rules unchanged).

## Delivery slices

1. **Format, registry, packs model** (R1–R4, R7): schema, model registry, `setPackOn`, `createDeck`, problems, round-trip; ui `TYPE_STYLE`. App compiles with the six types; no visible change except new decks storing `packs`.
2. **US5 + US4 places**: card header, group tiles, proxies, views, search, export icons, thumbnail read the registry; unknown ids drawn and reported.
3. **US1 + US2 Add flyout and packs** (R5).
4. **US3 type picker and "Kind" → "Type"** (R6).
5. **Polish**: docs, a11y pass, quickstart walk, bench.

## Complexity Tracking

No constitution violations to justify.
