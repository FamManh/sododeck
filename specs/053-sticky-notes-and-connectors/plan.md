# Implementation Plan: Sticky notes and connector multi-select

**Branch**: `053-sticky-notes-and-connectors` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/053-sticky-notes-and-connectors/spec.md`

## Summary

Make stickies first-class: a paper look, a stored size, auto-fit text, tags from the deck's tag list,
lock, a floating toolbar, a "pad of notes" tile in the Add flyout, and connectors that can end on a
sticky. Give several selected connectors a floating toolbar (arrow ends, type, colour, weight, lock).

The approach reuses what exists. Multi-select of connectors, the `connections` toolbar target and the
one-undo-step `setEdgeStyle` are already built (research R1); the gap is toolbar buttons and lock.
Stickies as connector ends follow the 050 precedent (groups as ends, ADR 0031): no version bump, an
`endpointOf` that resolves a third collection, and a cascade. The file format gains only additive
optional fields (research R2): `Sticky.size`, `fontSize`, `align`, `tags`, `locked` and
`Edge.locked`. Auto text size is computed at display time and never stored.

## Technical Context

**Language/Version**: TypeScript strict (`noUncheckedIndexedAccess`), Node ≥ 24, pnpm monorepo

**Primary Dependencies**: existing only: React 19, `@xyflow/react`, Yjs, Zustand, Zod/Ajv, Tailwind v4, Radix, lucide-react. No new dependency (constitution VIII).

**Storage**: Yjs document (IndexedDB); `.sododeck.json` file format v1 with additive optional fields.

**Testing**: Vitest (unit, model round-trip, schema Ajv/Zod parity), Testing Library for components. No new e2e (AGENTS.md); the smoke suite must stay green.

**Target Platform**: modern desktop browsers (Chromium first), light and dark themes.

**Project Type**: monorepo web app (`apps/app`, `packages/schema`, `packages/model`, `packages/ui`).

**Performance Goals**: no regression at 500 nodes / 1,000 edges (`pnpm bench` before and after, report both). Text fitting runs only when a note's text, size, font setting or tag rows change, never on pan or zoom.

**Constraints**: tokens only (no hard-coded colours); keyboard access for every control; no network with content; third-party reference images stay local and git-ignored.

**Scale/Scope**: a deck has tens of stickies, rarely hundreds; each note fits in ≤ 12 measure steps.

## Constitution Check

_GATE: passed before Phase 0, re-checked after Phase 1._

| Principle                                    | Result                                                                                                                                                                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth                    | Pass. Size, font size, align, tags, lock and connector ends are document data in Yjs. Zustand holds only the last-used sticky colour (UI-only) and the open toolbar popover. Auto-fitted font size is derived, not stored. |
| II. Schema-owned format, lossless round-trip | Pass. Additive optional fields, generated types and Zod regenerated, Ajv/Zod parity and a round-trip case for every field. No version bump (additive). All Yjs ↔ JSON stays in `packages/model`.                           |
| III. Stable identity                         | Pass. Connectors reference a sticky by its stable id; deleting a sticky removes its connectors. Integrity gains a sticky/node/group id-collision check.                                                                    |
| IV. Local-first, private                     | Pass. No network. Reference screenshots are git-ignored (`specs/*/reference/`).                                                                                                                                            |
| V. Performance                               | Pass with a measurement duty. Bench before and after; fit is cached per (text, size, font, tag rows).                                                                                                                      |
| VI. Strict types, tested                     | Pass. Pure functions (`fitFontSize`, sticky box, tag chip rows) unit-tested; components tested by roles.                                                                                                                   |
| VII. Accessible                              | Pass. Toolbars and the pad tile are keyboard operable and labelled; lock and selection are not colour-only (lock icon, selection ring).                                                                                    |
| VIII. Simplicity, dependencies               | Pass. No new dependency; reuses `TagPicker`, `LineStyleControls`, `setEdgeStyle`, `FlowHandle`, `textMeasurer`. One ADR (0036).                                                                                            |

No violations; Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/053-sticky-notes-and-connectors/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── file-format.md      # additive schema fields, semantic rules
│   └── ui.md               # toolbars, flyout tile, handles, shortcuts
├── checklists/requirements.md
├── reference/              # founder's third-party screenshots; git-ignored, never pushed
└── tasks.md                # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
packages/schema/
├── schema/v1.json                 # Sticky: size, fontSize, align, tags, locked; Edge: locked; end descriptions
├── src/generated/{types,zod}.ts   # pnpm schema:generate
├── src/semantic-rules.ts          # sticky/node/group id collision when an edge end names it
├── examples/full.sododeck.json    # uses every new field (coverage test)
├── test/fixtures.ts               # invalid + valid fixtures
└── CLAUDE.md                      # status + key order note

packages/model/
├── src/geometry.ts                # sticky default/min size, stickyBox()
├── src/endpoint.ts                # endpointOf / endpointTitle resolve stickies
├── src/ops/refs.ts, integrity.ts  # edges.from/to accept nodes|groups|stickies; collision check
├── src/ops/cascade.ts             # deleting a sticky removes its connectors (removeEdgesAt)
├── src/ops/stickies.ts            # setStickySize, setStickyText-style helpers, add with colour/free
├── src/ops/node-lock.ts           # setLocked over nodes | stickies | edges
├── src/ops/tags.ts, tags usage    # rename / delete / colour / usage include stickies
├── src/search/                    # sticky tags searchable
└── test/                          # round-trip, cascade, integrity, tags, lock, stickies

apps/app/src/editor/
├── stickies/sticky-node.tsx       # paper look, handles, tags row, fit text, resize
├── stickies/sticky-paper.tsx      # shared look (node + flyout pad)
├── stickies/fit-font-size.ts      # pure fit + DOM measurer; cached
├── stickies/sticky-toolbar.tsx    # text size, bold, align, link, colour, tags, actions
├── stickies/sticky-tint.ts        # unchanged colours, plus paper tokens
├── stickies/sticky-actions.ts     # addNoteAt(free, colour), drop from pad
├── palette.tsx                    # Sticky tile as a pad of notes (last colour), drag payload
├── deck-to-flow.ts                # size, tags, lock in node data + cache equality; boxFor sticky; edge ends
├── routing/endpoint-target.ts     # 'sticky' hit target; connect from/to
├── use-canvas-handlers.ts         # endpointIdOf sticky: prefix; drop pins nothing from the pad
├── connection-rules.ts            # Ends include stickies; connectTargets
├── visible-graph.ts, view-filter.ts, focus-set.ts  # sticky representative, hidden stickies hide their edges
├── quick-edit/toolbar-variant.ts  # 'sticky' | 'stickies' variants; 'connections' gains buttons
├── actions/connection-actions.ts  # direction, weight, colour as toolbar actions for 'connections'
├── actions/sticky-actions? (new)  # sticky toolbar actions
├── tags/tag-picker.tsx, deck-tags.ts  # targets: nodes + stickies; usage counts stickies
├── lock.ts                        # lock helpers for stickies and edges
├── inspector/sticky-inspector.tsx # size/text size/align/tags/lock rows
├── export/scene.ts, render-svg.ts # real size, wrapped text, tags, sticky connector ends
└── (tests next to each file)

apps/app/src/state/ui-store.ts     # lastStickyColour (UI-only)
apps/app/src/db/import/place-import.ts  # note width constant follows STICKY_DEFAULT_SIZE
apps/app/src/bench/generate-deck.ts     # bench stickies with connectors
packages/ui/                       # sticky paper tokens if a shared token is needed
DESIGN.md                          # Sticky paper look, sticky toolbar, pad tile
docs/decisions/0036-sticky-notes-v2.md
```

**Structure Decision**: Existing monorepo layout; every change lands in the package that owns the concern (format in `schema`, Yjs ↔ JSON and rules in `model`, rendering and interaction in `apps/app`). No new package or app.

## Phase 0 and Phase 1 outputs

- Phase 0: [research.md](research.md), with every unknown from the spec's assumptions resolved.
- Phase 1: [data-model.md](data-model.md), [contracts/file-format.md](contracts/file-format.md), [contracts/ui.md](contracts/ui.md), [quickstart.md](quickstart.md).

## Delivery order (for tasks)

1. Format and model: schema fields, sticky ends (refs, integrity, cascade, endpoint), lock generalisation, tags ops. Tests first.
2. Sticky node: paper look, size and resize, fit text, tags row, handles; deck-to-flow, boxFor, endpoint target, connect.
3. Sticky toolbar and Add flyout pad (including drop-as-free).
4. Connector toolbar buttons for `connections` (direction, weight, colour, lock).
5. Consumers: export, outline/search/delete confirmation, import placement, bench.
6. Docs: DESIGN.md, package CLAUDE.md files, ADR 0036. Full gate: lint, typecheck, test, build, e2e, bench before and after.

Slices 1 to 3 deliver US1 to US3; slice 4 delivers US4 and can ship separately.

## Post-design Constitution Check

Re-checked after Phase 1: unchanged, all pass. The only watch item is performance of fit text, covered by caching, a step list capped at 11 sizes and the bench report.

## Complexity Tracking

No violations to justify.
