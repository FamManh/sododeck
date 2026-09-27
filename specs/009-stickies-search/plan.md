# Implementation Plan: Sticky Notes and Command Palette

**Branch**: `009-stickies-search` | **Date**: 2026-09-27 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/009-stickies-search/spec.md` (clarified 2026-09-27, 2 answers; reviewed against 007 on 2026-09-28)

**Dependency**: 008 is merged on `main` (`324d1bd`). Names were checked against `main` (research header). 007 (flow playback) is merged (`b519550`); its names were re-checked on 2026-09-28 (research header), and User Story 4 (dimming, Notes switch, notes on the step, view-only notes) is in this plan (research R15). 010 is being specified in parallel; see merge hot spots below.

## Summary

Add sticky notes (K-3) as a derived canvas layer over the existing `stickies` collection, and a ⌘K command palette (C-3, K-4) backed by a pure search module.

- **Schema** (`packages/schema`): two optional `Sticky` fields, `collapsed` and `showInFlows`. The change is additive, so the version does not change (R1).
- **Model** (`packages/model`):
  - `nodeCanvasPosition` / `stickyCanvasPosition` / `stickyLabel` geometry. The node grid fallback moves here from the app (R2, R3).
  - Sticky ops: the draft pair `beginStickyDraft` / `endStickyDraft` (an empty note leaves no undo entry, R5), plus `pinSticky`, `unpinSticky` and `moveSticky`.
  - `removeNode` frees notes pinned to the deleted node, and `RemovalResult.freed` reports them. This is ADR 0010, amending ADR 0005 (R2).
  - `search/`: `normalizeText`, `buildSearchIndex`, which is incremental through snapshot structural sharing, and `searchDeck`. It runs on the main thread, and a perf test guards the budget (R8).
- **UI kit** (`packages/ui`): bold and italic in `parseMarkdown` (R7), and a presentational `CommandDialog` on Radix Dialog with the combobox pattern and no new dependency (R9).
- **App** (`apps/app`):
  - A `sticky` node type and a `sticky-leader` edge type (R4).
  - In-card editing through `useLiveField` (R6).
  - Palette drop, N, ⌥C and arrow nudge (R12).
  - `Selection.stickies`, a sticky inspector and a Notes section in the outline (R13).
  - Delete text in the existing dialog and toast (R14).
  - The ⌘K palette with commands and result opening (R10, R11), and a "Jump to…" button in the top bar.
  - Notes in 007's flow mode (R15): 35% dimming with exceptions, view-only notes, a Notes switch in the canvas toolbar, and NOTES ON THIS STEP in the step inspector. Palette flow and step results open flow mode through `openFlow`.

## Technical Context

**Language/Version**: TypeScript ~6.0 (strict, `noUncheckedIndexedAccess`), React 19, Node ≥ 24

**Primary Dependencies**: all already installed:

- `yjs` 13.6
- `@xyflow/react` 12.12 (custom node and edge types)
- `zustand` 5
- `react-router` ^8.4
- `radix-ui` (Dialog)
- `lucide-react`: `StickyNote`, `Pin`, `PinOff`, `ChevronDown`, `ChevronRight`, `Search`, `Command`, `Moon`, `Sun`, `Focus`, `Table2`, `FolderOpen`, `Plus`, `Upload`, `Workflow`, `Spline`
- `@sododeck/ui`: `Dialog`, `Combobox`, `SearchField`, `SegmentedControl`, `Switch`, `MarkdownView`, `PanelSection`, `useToast`, `focusRing`, `MOTION`

No cmdk or search library (R8, R9).

**Storage**:

- Document data goes through `@sododeck/model`: two new optional sticky fields.
- UI-only state goes in `useUiStore`: `selection.stickies`, `stickyEditing`, `stickyDraft`, `canvasPointer` and `palette`.
- Autosave and tab sync come from 005 unchanged.

**Testing**:

- **Vitest (`packages/schema`)**: parity, coverage, fixtures and key order for the new fields.
- **Vitest (`packages/model`)**:
  - `stickies`, `search` (new)
  - `cascade`, `undo`, `preview`, `round-trip`, `perf` (additions)
- **Vitest (`packages/ui`)**: `markdown` (bold and italic), `command-dialog` (keyboard, ARIA, live region), and the contrast suite for the sticky tints.
- **Vitest + Testing Library (`apps/app`)**, by role and label per the [UI contract](contracts/stickies-palette-ui.md):
  - `sticky-node`, `sticky-inspector`, the outline notes
  - shortcuts N, ⌥C, ⌘K
  - `command-palette` (results, keyboard, no results, commands, opening each kind)
  - `deck-to-flow` for stickies and leaders
  - the delete text
- **E2E**: the existing smoke suite only (constitution VI).
- **Bench**: before and after with `BENCH_STICKIES=100`, plus a new "⌘K type → results" scenario (R16).

**Target Platform**: latest 2 versions of Chrome, Edge, Firefox and Safari; desktop 1440×900 reference; offline.

**Project Type**: Web SPA (`apps/app`) plus internal packages (pnpm/Turborepo monorepo).

**Performance Goals**:

- Palette results update in < 50 ms per keystroke at 2,000 nodes (SC-001).
- The palette is ready in < 100 ms (SC-008).
- Pan and zoom stay at ≥ 60 fps at 500 nodes / 1,000 edges with 100 notes (SC-009).

**Constraints**:

- No duplicated document state. Note placement is derived; drafts live in the Yjs document inside a gesture.
- No network: search is local, and queries are never sent.
- Markdown is never rendered as HTML.
- Keyboard-operable, and no state by color alone.
- Tokens only.
- Canvas keys stay in `use-canvas-shortcuts.ts`.
- `packages/ui` stays presentational.

**Scale/Scope**:

- Up to ~200 notes per deck, and ~6k searchable objects at 2,000 nodes.
- About 20 new app files, 4 new model files and 2 new UI files.
- One ADR (0010).

## Constitution Check

_GATE: passes before Phase 0. Re-checked after Phase 1 design: still passes, with no justified exceptions._

| Principle                        | Status | How                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Single source of truth        | ✅     | Notes live only in the Yjs `stickies` array. The canvas position, leaders, labels and search index are derived from the snapshot. The draft note is a real document object inside a gesture, not a React copy. The inspector and the in-card editor write the same field through `useLiveField`. UI state is selection, edit mode, pointer and palette only.                                                           |
| II. Schema-owned format          | ✅     | `collapsed` and `showInFlows` are added to `v1.json` with regenerated types and Zod, fixtures, the full example, parity and key order (R1). The version is not bumped, because the fields are optional and additive. The model stays the only Yjs ↔ JSON code. Round-trip cases cover every sticky combination. The cascade change is recorded in ADR 0010.                                                            |
| III. Stable identity             | ✅     | Notes keep generated `sticky` ids. Anchors reference node ids, and renaming a node is tested not to break a pin or its label ("Pinned to <new title>"). Canvas ids are prefixed `sticky:` so they never collide with component ids.                                                                                                                                                                                    |
| IV. Local-first, private         | ✅     | Search runs in-process on the snapshot. No request carries a query or content. No new assets or CDNs. The smoke no-third-party check is unchanged.                                                                                                                                                                                                                                                                     |
| V. Performance                   | ✅     | Search is a linear substring scan over cached normalized fields: about 2–5 ms at 2,000 nodes. A perf test enforces < 50 ms, and a worker is required if it exceeds 25 ms (R8). This is not heavy work, so no worker is used now. Sticky nodes are memoized per object. Bench runs before and after with 100 notes.                                                                                                     |
| VI. Strict types, tested         | ✅     | Pure geometry, ops, cascade and search get unit tests. Component tests go by role and label per the UI contract. Undo tests cover the draft discard and the freed-pin restore. No new e2e.                                                                                                                                                                                                                             |
| VII. Accessible                  | ✅     | Notes are focusable, with an accessible name and role description, and are keyboard editable, movable, collapsible and deletable. Collapsed state uses a chevron plus `aria-expanded`. Pinned is shown by a leader, a pin and footer text. Palette matches use bold plus underline. The palette follows the WAI-ARIA combobox/listbox pattern and announces the result count. Sticky tints pass the AA contrast suite. |
| VIII. Simplicity, justified deps | ✅     | No new dependency: `CommandDialog` is small and built on Radix, the search is about 150 lines, and markdown is extended in-house. The geometry rule moves rather than being duplicated. Only five sticky ops are added, where invariants need them (keeping the canvas point, the draft undo); flags use the generic `update`.                                                                                         |

## Project Structure

### Documentation (this feature)

```text
specs/009-stickies-search/
├── plan.md              # This file
├── research.md          # Phase 0: R1–R17
├── data-model.md        # Phase 1: sticky fields, states, derived data, UI state
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── model-additions.md        # schema + @sododeck/model additions
│   └── stickies-palette-ui.md    # user-visible contract (roles, labels, text)
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
packages/schema/
├── schema/v1.json                     # Sticky + collapsed, showInFlows
├── src/generated/{types,zod}.ts       # regenerated
├── examples/full.sododeck.json        # uses both fields
└── test/fixtures.ts                   # invalid boolean fixtures

packages/model/
├── src/geometry.ts                    # NEW nodeCanvasPosition, stickyCanvasPosition, stickyLabel, NODE_GRID, STICKY_DEFAULT_OFFSET
├── src/ops/stickies.ts                # NEW beginStickyDraft, endStickyDraft, pinSticky, unpinSticky, moveSticky
├── src/ops/cascade.ts                 # removeNode frees pinned notes
├── src/preview.ts                     # RemovalResult / preview `freed`
├── src/search/{normalize,index,search}.ts  # NEW
├── src/editor.ts, src/index.ts        # wire + export
└── test/{stickies,search}.test.ts     # NEW
    test/{cascade,undo,preview,round-trip,perf}.test.ts  # + cases

packages/ui/
├── src/lib/markdown.ts                # + bold / italic inline
├── src/components/markdown-view.tsx   # render strong / em
├── src/components/command-dialog.tsx  # NEW presentational palette
└── test/…                             # markdown, command-dialog, contrast (sticky tints)

apps/app/src/
├── state/ui-store.ts                  # Selection.stickies, stickyEditing, stickyDraft, canvasPointer, palette
├── editor/canvas-geometry.ts          # displayPosition → model nodeCanvasPosition
├── editor/deck-to-flow.ts             # toStickyNodes, toLeaderEdges (cached per object)
├── editor/canvas.tsx                  # register sticky node + leader edge; pane pointer tracking
├── editor/use-canvas-handlers.ts      # sticky drag → moveSticky; note drop → draft (pinned on a node)
├── editor/use-canvas-shortcuts.ts     # N, ⌥C, sticky nudge/edit; ⌘K in useEditorShortcuts
├── editor/palette.tsx                 # STRUCTURE › Note card + help text
├── editor/stickies/                   # NEW
│   ├── sticky-node.tsx                # card: header, markdown body, collapsed line, footer, in-card editor
│   ├── sticky-leader-edge.tsx         # dotted leader + pin
│   ├── sticky-actions.ts              # addNoteAt(point) (draft + pin-on-node), finishDraft
│   └── sticky-tint.ts                 # color → token classes
├── editor/inspector/sticky-inspector.tsx   # NEW
├── editor/stickies/sticky-flow.ts     # NEW stickyFlowState, notesOnStep (007 overlay)
├── editor/canvas-toolbar.tsx          # Notes: dimmed/shown/hidden (flow mode only)
├── editor/flows/inspector-step.tsx    # NOTES ON THIS STEP (007 file)
├── index.css, flow-mode-css.test.ts   # note dimming at 35%, exempt from the 20% path dimming
├── editor/inspector.tsx               # route single sticky → StickyInspector
├── editor/outline.ts, left-sidebar.tsx     # Notes section
├── editor/describe-removal.ts         # note text + freed notes
├── editor/json-panel-view.ts          # Selection tab shows a selected sticky
├── editor/command-palette/            # NEW
│   ├── command-palette.tsx            # CommandDialog + index + results
│   ├── commands.ts                    # command list + availability
│   ├── palette-results.ts             # empty-query list, merge commands + searchDeck, limit
│   └── open-result.ts                 # select/centre, show flow/step, open rule, run command
├── editor/top-bar.tsx                 # "Jump to… ⌘K" button
├── routes/editor-page.tsx             # mount CommandPalette in EditorChrome
└── bench/generate-deck.ts, bench/perf.bench.ts  # stickies option, ⌘K scenario

docs/decisions/0010-sticky-notes.md    # NEW ADR (renumber if 010 lands first, R17)
apps/app/CLAUDE.md, packages/model/CLAUDE.md, packages/ui/CLAUDE.md, packages/schema/CLAUDE.md
```

**Structure Decision**:

- `schema` owns the two fields.
- `model` owns note geometry, the draft/undo invariant, the cascade and search, so a future CLI/MCP gets identical behavior.
- `ui` gains one presentational dialog and the markdown extension.
- The app gets two new folders: `editor/stickies/` and `editor/command-palette/`. Shared editor files are touched only at their extension points.

### Merge hot spots

- **With 010** (specified in parallel; it touches the canvas and groups):
  - `deck-to-flow.ts`, `canvas.tsx`, `canvas-geometry.ts`
  - `ui-store.ts` (Selection)
  - `use-canvas-shortcuts.ts`, `outline.ts`, `left-sidebar.tsx`, `top-bar.tsx`
  - the ADR number
  - The Focus mode command is wired to 010 when it lands (`focusModeAvailable`).
- **With 007** (merged): build on its files rather than around them: `flows/flow-overlay.ts` (read-only), `flows/inspector-step.tsx`, `canvas-toolbar.tsx`, `index.css` and `flow-mode-css.test.ts`, `ui-store.ts`.
- Branch from the latest `main`, and rebase before the PR.

## Implementation order (for /speckit-tasks)

1. **Foundation (schema + model + ui)**:
   - ADR 0010.
   - The two schema fields and regeneration, with fixtures and the example.
   - `geometry.ts`, then the app's `displayPosition` switched to it.
   - Sticky ops with the draft undo.
   - The `removeNode` cascade and `freed`.
   - Round-trip, cascade, undo and preview cases.
   - Markdown bold and italic.
   - `CommandDialog`.
2. **Search (model)**: `search/` with its tests and the perf test.
3. **App foundation**:
   - `Selection.stickies` and the UI state.
   - `deck-to-flow` sticky nodes and leaders.
   - Register the node and edge types.
   - `sticky-tint`.
   - Run the bench before.
4. **Story 1 (P1)**:
   - The sticky card with in-card edit.
   - Palette Note drop and click, and N with pointer tracking.
   - Empty draft discard.
   - Drag and move.
   - ⌥C collapse, and Enter/F2/arrows.
   - The sticky inspector: anchor, pinned to, display, stay-visible switch.
   - Delete text and freed notes.
   - The Notes section in the outline.
   - The JSON selection view.
5. **Story 2 (P1)**:
   - The palette component and the top-bar button.
   - ⌘K in `useEditorShortcuts`.
   - Results, snippets and highlight.
   - Keyboard behavior and no results.
   - `open-result` for every kind, including from the rules screen.
6. **Story 3 (P2)**: `commands.ts` (export, theme, rules, library, new deck; focus hidden), the empty-query list, and aliases.
7. **Story 4**: `stickyFlowState` and `notesOnStep` (pure), overlay-aware `toStickyNodes`, the 35% CSS rule and its test, view-only notes in flow mode, `notesDisplay` in the store and the Notes switch in the canvas toolbar, NOTES ON THIS STEP in the step inspector.
8. **Wrap-up**:
   - Update the docs (the four `CLAUDE.md` files).
   - Visual check against frames 14, 30, 31, 32 and 62 (light and dark).
   - Bench after, with the ⌘K scenario.
   - The full definition-of-done run.

## Complexity Tracking

No constitution violations. Two items are noted for review:

- **Cascade semantics change** (R2): `removeNode` now edits stickies instead of leaving them broken. This follows the founder decision Q1, amends ADR 0005 for node anchors only, and is covered by cascade, undo and round-trip tests. The existing 002 tests that assert "sticky kept and broken after node delete" are updated to expect a free note, and only for node anchors.
- **Markdown parser change** (R7): bold and italic also apply to 008 descriptions. The existing markdown tests must stay green, and the new cases cover unmatched markers.
