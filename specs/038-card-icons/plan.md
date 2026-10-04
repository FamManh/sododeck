# Implementation Plan: Card Icons

**Branch**: `038-card-icons` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/038-card-icons/spec.md` (refreshed 2026-10-04; clarify 2026-10-04: unreadable `icon` text stays valid and is kept; no icon on nodes drawn as shapes; in-app licence placement deferred to the open-source decision).

**Dependency**: all built (029, 030, 031, 032, 033, 034, 035, 036). Names checked on `main` at `9e7f779`: `packages/ui/src/lib/icons.ts` (`TYPE_STYLE`, `typeStyle`, `resolveTypeId`, `TYPE_FALLBACK`, `ICON_STROKE_WIDTH`), `packages/ui/src/components/type-tile.tsx` (`TypeTile`), `apps/app/src/editor/shapes/{type-glyph,shape-tile}.tsx`, `deck-node.tsx`, `deck-to-flow.ts` (`toFlowNode`, cache compares), `visible-graph.ts` (`memberKinds`), `collapsed-group-node.tsx`, `proxy-layout.ts`, `outside-proxy-node.tsx`, `outline.ts` / `outline-tree.tsx`, `inspector/{node-inspector,bulk-inspector,appearance-section}.tsx`, `flows/inspector-step.tsx`, `rules/used-in.tsx`, `connect-popover.tsx`, `command-palette/palette-results.ts`, `actions/style-actions.ts` (`style.colour`), `quick-edit/{selection-toolbar,field-popover,canvas-menu}.tsx`, `state/ui-store.ts` (`ToolbarFieldId`), `export/{scene,render-svg,icon-paths}.ts`, `palette.tsx` (`neighbour`), `packages/model/src/ops/node-display.ts` (`setNodeDisplay`), `card-types.ts` (`effectiveFamily`). ADR 0027 is 032's; this feature takes **0028**.

## Summary

A user picks an icon for one or more cards from a searchable picker. The icon replaces the type
icon wherever a node's icon is drawn; the type name stays. Lucide is the only icon set, as a
curated catalog of about 300 icons; the reference format (`set:icon`) and the code accept more sets
later without a format change.

- **Icon data** (R1, R2): a hand-written catalog (name, label, category, keywords) plus lucide
  geometry generated from the installed lucide-react (`pnpm icons:generate`), with a freshness
  test. The same table feeds the canvas and the export, replacing the hand-copied `icon-paths.ts`.
- **One resolver** (R3): `parseIconRef`, `resolveIcon`, `nodeIcon` in `packages/ui`; custom →
  type → fallback.
- **File format** (R4): no structural change; `node.icon` description updated; ADR 0028.
- **Model** (R5): `setNodeIcon` (one undo step), `iconUsage`.
- **Surfaces** (R6): card tile, Landscape, collapsed group members, drill-in proxies, outline,
  drawer header, step inspector, rules "used in", connect popover, command palette, export.
- **Picker** (R7, R8): toolbar field + shared action `style.icon` + clickable drawer header tile; search,
  sections, "Used in this deck", Reset, Mixed; cards only (shapes excluded).
- **Unknowns** (R9), **bundle and bench** (R10), **solid test set** (R11), **notices** (R12).

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all installed; **no new runtime dependency**. lucide-react 1.48.0 is read
at generate time only (its geometry is copied into a generated file). `tsx` is added as a
**devDependency** of `packages/ui` for the generator (already used by `packages/schema`).

**Storage**: schema v1 description change only + `pnpm schema:generate`; `node.icon` is a plain key
on the node's Y.Map; no layout or version change, no migration.

**Testing**: Vitest (parse, resolve, aliases, search ranking, `nodeIcon` precedence, generated-file
and notices freshness, `setNodeIcon`, `iconUsage`, round-trip of odd refs, export scene / SVG incl.
solid set), Testing Library (picker, entry points, multi-select, Mixed, Reset, shapes excluded,
surfaces, by role and name per [contracts/icons-ui.md](contracts/icons-ui.md)). No new e2e; smoke
suite green.

**Target Platform**: Evergreen desktop browsers (Chromium for bench and e2e).

**Project Type**: pnpm / turbo monorepo: Vite SPA plus internal packages.

**Performance Goals**: search < 100 ms per keystroke (linear scan of ~300 entries, < 1 ms);
`BENCH_ICONS=1` pan / zoom and editor-open within 5 % of `bench-before.md` (SC-005); editor chunk

- ≤ 25 KB gzip (R10).

**Constraints**: stored references never rewritten (FR-005); single source of truth (the icon is
only in the document; the picker's query and hover are UI state); colour never the only cue
(selected icon has ring + check, Mixed has text); tokens only; no network (icons bundled, FR-014).

**Scale/Scope**: ~6 files in `packages/ui` (new `icon-sets/`), 2 in `packages/model`, 1 in
`packages/schema`, ~20 in `apps/app`; docs (ADR 0028, ADR 0022 row, ADR 0016 note, DESIGN.md
picker, package `CLAUDE.md`s, backlog §038). Estimate **4–5 d** (backlog 4 d; the catalog's ~300
labels and keywords and the extra surfaces found in the survey add about half a day).

## Constitution Check

_GATE: passes before Phase 0. Re-checked after Phase 1 design: still passes; no violations._

| Principle                                    | Status | How                                                                                                                                                                                                         |
| -------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth                    | ✅     | The icon is `node.icon` in the Yjs document; every surface derives it through `nodeIcon`. Picker query, hover and open state are UI state.                                                                  |
| II. Schema-owned format, lossless round-trip | ✅     | `icon` stays in `v1.json` (description only, regenerated); round-trip cases for odd and unknown refs; only `packages/model` converts Yjs ↔ JSON. Additive, no version bump.                                 |
| III. Stable identity                         | ✅     | No new objects or references between objects; icon names are stable keys with aliases for renames (FR-012).                                                                                                 |
| IV. Local-first, private                     | ✅     | All icon data bundled; nothing fetched; smoke test's no-third-party check unchanged.                                                                                                                        |
| V. Performance off the main thread           | ✅     | No heavy work; cached string lookups and stateless SVGs; bench gate with `BENCH_ICONS`.                                                                                                                     |
| VI. Strict types, tested behaviour           | ✅     | Pure modules per [contracts/icons-api.md](contracts/icons-api.md); component tests by role and name; no new e2e.                                                                                            |
| VII. Accessible by default                   | ✅     | Picker fully keyboard-operable; every cell named; selected = `aria-selected` + ring + check; Mixed in text; Esc returns focus.                                                                              |
| VIII. Simplicity, justified deps             | ✅     | No runtime dependency; `tsx` dev-only, already in the repo; reuses `SearchField`, popover, the toolbar field pattern and the palette's grid navigation; one geometry table instead of two copies. ADR 0028. |

## Project Structure

### Documentation (this feature)

```text
specs/038-card-icons/
├── spec.md
├── plan.md              # this file
├── research.md          # R1–R12
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── icons-api.md
│   └── icons-ui.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
packages/schema/
├── schema/v1.json                          # node.icon description
└── src/generated/{types,zod}.ts

packages/ui/
├── scripts/generate-icons.ts               # new: catalog names + chrome names → geometry, notices
├── src/icon-sets/
│   ├── types.ts                            # new: IconSet, IconEntry, IconNode, ResolvedIcon
│   ├── lucide-catalog.ts                   # new: ~300 entries, 12 categories
│   ├── lucide.generated.ts                 # new: generated geometry + aliases
│   ├── lucide.ts, index.ts                 # new: the set, ICON_SETS
│   ├── resolve.ts                          # new: parseIconRef, resolveIcon, iconRef, nodeIcon, chromeIcon
│   └── search.ts                           # new: searchIcons
├── src/components/icon-glyph.tsx           # new: line / solid SVG
├── src/components/type-tile.tsx            # optional icon prop
├── src/lib/icons.ts                        # TYPE_STYLE gains the lucide name per type
└── test/icon-sets/*.test.ts, test/fixtures/solid-test-set.ts

packages/model/
├── src/ops/node-icon.ts                    # new: setNodeIcon
├── src/icons.ts                            # new: iconUsage
├── src/editor.ts, src/index.ts
└── test/{node-icon,icons,round-trip}.test.ts

apps/app/
├── public/third-party-notices.txt          # new, generated
└── src/editor/
    ├── icons/icon-picker.tsx (+ test)      # new
    ├── icons/icon-field.tsx (+ test)       # new: toolbar popover content + drawer tile wiring
    ├── icons/apply-icon.ts (+ test)        # new: card targets (effectiveFamily), one setNodeIcon call
    ├── grid-nav.ts                         # neighbour() moved out of palette.tsx
    ├── actions/style-actions.ts            # style.icon
    ├── state/ui-store.ts, quick-edit/field-popover.tsx   # 'icon' toolbar field
    ├── inspector/node-inspector.tsx        # header tile → "Change icon" button (inspector-frame.tsx if the slot needs it)
    ├── deck-to-flow.ts, deck-node.tsx      # data.icon, tile + Landscape
    ├── visible-graph.ts, collapsed-group-node.tsx        # members with icon
    ├── proxy-layout.ts, outside-proxy-node.tsx           # proxy icon
    ├── outline.ts, outline-tree.tsx, inspector/node-inspector.tsx, flows/inspector-step.tsx,
    │   rules/used-in.tsx, connect-popover.tsx, command-palette/palette-results.ts
    ├── shapes/{type-glyph,shape-tile}.tsx  # optional icon prop
    ├── export/{scene,render-svg}.ts        # ResolvedIcon instead of IconKey
    ├── export/icon-paths.ts (+ test)       # deleted
    └── bench: apps/app/bench/perf.bench.ts, src/bench/generate-deck.ts   # BENCH_ICONS

docs/  decisions/0028-icon-references-and-icon-sets.md (new) · decisions/0022-schema-roadmap.md ·
       decisions/0016-export-rendering.md (point 5 superseded) · DESIGN.md (icon picker) · backlog.md (§038)
packages/ui/CLAUDE.md, packages/model/CLAUDE.md, apps/app/CLAUDE.md
```

**Structure Decision**: existing layout. Icon data and the resolver are UI data in `packages/ui`
(which already owns `TYPE_STYLE`); the model only stores and counts the string; the app wires
surfaces, the picker and export.

## Delivery slices

1. **Icon data and resolver** (R1–R3, R11, R12): types, catalog, generator, generated file,
   notices, resolver, search, `IconGlyph`, solid test set. No user-visible change yet.
2. **Export on the new table** (R6 export row): scene and render-svg on `ResolvedIcon`; delete
   `icon-paths.ts`. Output identical for decks without custom icons (snapshot tests unchanged).
3. **Format and model** (R4, R5): schema description, ADR 0028, `setNodeIcon`, `iconUsage`,
   round-trip.
4. **US3 surfaces** (R6): `nodeIcon` everywhere; cards with `icon` in a fixture render correctly.
5. **US1 + US2 picker** (R7, R8): action, toolbar field, drawer header tile, picker, multi-select, Mixed,
   Reset, shapes excluded.
6. **US4 unknowns** (R9): drawer note; round-trip proof. **US5** "Used in this deck".
7. **Polish**: bench, bundle size, DESIGN.md, docs, quickstart.

## Risks

- **No design frame for the picker.** The UI follows the 020 colour popover and the Add palette;
  a design pass may change spacing. Mitigation: build in `DESIGN.md` tokens, record screenshots.
- **Curating ~300 labels and keywords** is content work; quality of search depends on it. The
  catalog is data, so it can be improved after merge without code changes.
- **lucide-react upgrades** may rename icons: the generator fails on a missing name, and lucide's
  `aliases` keep old references resolving (FR-012).

## Complexity Tracking

No constitution violations to justify.
