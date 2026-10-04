# Implementation Plan: Schema Editing on the Canvas

**Branch**: `043-db-editing` | **Date**: 2026-10-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/043-db-editing/spec.md`

## Summary

Users build and change a schema directly on the canvas:

- A column is added or edited by typing one line. A small pure parser in `apps/app/src/db/column-line.ts` turns the line into the column's fields while the user types. Each save is one `addColumn` or `updateColumn` call and one undo step.
- Rows support keyboard focus (built on 042's row focus), reorder by drag, delete with an Undo toast, and a context menu.
- Relationships get quick settings (cardinality, optional sides, on delete) in their menu and toolbar.
- Tables get add (T, with a starting `id` key column), duplicate and cross-deck paste. The model's paste op now keeps outgoing foreign keys, links or copies enums, and gives copies `_copy` names.
- Any card can be locked, which needs one new optional schema field, `Node.locked`.
- While a table is in row editing it is shown at All through the projected view deck. Nothing is written for this.
- Rows at relationship ends whose types differ show a (!) icon.

Decisions are in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 5 strict, React 19, Node ≥ 24

**Primary Dependencies**:

- Existing only: React Flow (`@xyflow/react`), Radix via `packages/ui` (DropdownMenu, Tooltip, Toast), lucide-react (`GripVertical`, `Lock`, `TriangleAlert`), Yjs, generated Zod.
- No new dependency: the line parser is hand-written (R1).

**Storage**: the deck's Yjs document, with one optional node field, `locked`. The `.sododeck.json` format stays at v1.

**Testing**: Vitest and Testing Library (parser, editor, keys, menus, lock, mismatch, clipboard, view projection), the schema parity test, model round-trip and paste tests, the existing smoke e2e (no new e2e), and `pnpm bench`.

**Target Platform**: modern browsers. Everything runs on the main thread; the parser is under 1 ms per keystroke.

**Project Type**: pnpm monorepo.

- `apps/app`: most of the work.
- `packages/schema`: `locked`.
- `packages/model`: `setLocked` and paste changes.
- `packages/ui`: unchanged.

**Performance Goals**:

- Chips update within one frame of a keystroke, and a saved column shows in under 100 ms on 150 tables (SC-005).
- The bench with 150 tables stays within 5 % of the numbers before this feature.

**Constraints**:

- Card size and row positions are computed, never measured (§g-58).
- No document state in Zustand (the line text is local UI state).
- The look follows the Deck card system (DB3) and uses tokens only.
- Use the shared `packages/ui` controls (§g-86).
- No other tool is named anywhere.

**Scale/Scope**: about 8 new app files and about 20 changed; 1 schema field; 1 model op plus the paste changes; an amendment to ADR 0029.

**Blocked by**: nothing. 040, 041, 042, 045 and 050 are merged.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                           | Gate                                                                                                                                                                        | Status |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| I. Single source of truth           | Columns, relationship settings and `locked` live in Yjs. Line text, row drag and the All override are UI-only. The override patches the projected deck, never the document. | Pass   |
| II. Schema-owned format, round-trip | `v1.json` changes first, then regenerate and run the parity test. Round-trip cases for `locked`. Paste stays in `@sododeck/model`. The change is additive.                  | Pass   |
| III. Stable identity                | Edits keep column ids. Paste and duplicate give new ids to every object, with references remapped. Enums are linked by id after a name match.                               | Pass   |
| IV. Local-first and private         | No network. The clipboard is the platform clipboard, as in 016.                                                                                                             | Pass   |
| V. Performance                      | The parser is under 1 ms. No per-row React Flow objects. The mismatch map is memoised per revision. Bench before and after.                                                 | Pass   |
| VI. Strict types, tested behavior   | Unit and component tests are listed in the quickstart. No new e2e.                                                                                                          | Pass   |
| VII. Accessible by default          | Every action has a key (R5) and a menu item. Row focus and the editor are announced. (!) and the lock have icons and text, never colour alone.                              | Pass   |
| VIII. Simplicity                    | No dependency. Reuses the action registry, the toast, `oneStep`, row focus, the paste op, `typeMismatch` and the export dialog.                                             | Pass   |

**Post-design re-check**: Pass. Planning corrected the spec on one point: on a table, ⏎ keeps opening details, and only ↓ enters the rows (FR-008, R5). It also moves two existing keys: on a table, C now adds a column and R opens the connect popover; on a row, R starts a relationship instead of 042's C.

## Project Structure

### Documentation (this feature)

```text
specs/043-db-editing/
├── plan.md
├── research.md            # R1–R17
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── column-line.md     # grammar + API
│   └── editing-ui.md      # model ops, UI store, keys, menus, feedback text
├── checklists/requirements.md
└── tasks.md               # /speckit-tasks
```

### Source Code (repository root)

```text
packages/schema/schema/v1.json, examples/full.sododeck.json, test/fixtures.ts   # Node.locked
packages/model/src/ops/node-lock.ts (new), editor.ts                           # setLocked
packages/model/src/fragment.ts, ops/paste.ts                                   # external FKs, enums, _copy names, droppedRelationships
packages/model/test/                                                           # round-trip, lock, paste

apps/app/src/
├── db/column-line.ts (new)                 # parse, format, patch, lineError
├── state/ui-store.ts                       # columnEdit, rowDrag, rowEditTableId, openExport seed, row MenuTarget
├── views/view-state.ts                     # All override for rowEditTableId
├── editor/
│   ├── table/column-line-editor.tsx (new)  # in-row editor + chips overlay
│   ├── table/row-grip.tsx (new)            # reorder grip + drop line
│   ├── table/table-body.tsx                # editor row, grip, (!) icon, lock, row context menu
│   ├── table-layout.ts                     # extra new row height
│   ├── table-keys.ts                       # mismatchedColumns
│   ├── actions/table-actions.ts (new)      # table.*, row.*, node.lock
│   ├── actions/relationship-actions.ts (new) # cardinality, optional sides, on delete
│   ├── actions/index.ts                    # register
│   ├── quick-edit/canvas-menu.tsx          # row target
│   ├── canvas-actions.ts                   # addTable
│   ├── use-canvas-shortcuts.ts, shell/shortcuts.ts, shell/use-shell-shortcuts.ts  # R5 keys
│   ├── editing/clipboard-ops.ts            # keepOutgoing, drop toast, rename after duplicate
│   ├── editing/drag-session.ts, use-nudge.ts, use-resize-key.ts  # skip locked
│   ├── confirm-delete-dialog.tsx           # skip locked + "Skipped n locked"
│   ├── deck-to-flow.ts, deck-node.tsx      # draggable / resizable / lock badge
│   ├── palette.tsx, packs-panel.tsx        # Database tools, description
│   ├── empty-canvas-card.tsx               # Add table
│   └── export/export-dialog*.tsx           # seed format + scope
packages/model/src/card-types.ts            # Database pack tools + description

docs/decisions/0029-database-pack-model.md (amendment: Lock), docs/backlog-database.md (043 split,
new drawer feature), apps/app/CLAUDE.md, packages/schema/CLAUDE.md, packages/model/CLAUDE.md
```

**Structure Decision**:

- Parsing is a pure module in `apps/app/src/db/`, next to the 045 export code. It is app-level because it is UI input, not a file format.
- Document writes go through existing `DeckEditor` ops. The only new model op is `setLocked`, plus the paste changes.
- UI follows the 019 action registry, so menus, the toolbar and keys share one definition.

## Phases (for /speckit-tasks)

1. **Format and model:** `Node.locked`, `setLocked`, and the paste changes (external foreign keys, enums, names, dropped count).
2. **Pure layer:** the column line parser, formatter, patch and errors; `mismatchedColumns`; `nextTableName` / `copyName`; the view-state override.
3. **US1 and US2:** the line editor (add and edit in place), `columnEdit` state, and the extra-row layout.
4. **US3:** row keys (R5), reorder grip, delete with toast.
5. **US4:** row, table and relationship actions; toolbar; export seed.
6. **US5:** add table, duplicate and paste in the app (toast, rename).
7. **US6:** lock, covering drag, resize, nudge, edits, delete, the badge and the tooltip.
8. **US7:** Add flyout Database tools, pack description, multi-select checks.
9. **Wrap-up:** (!) icon polish, bench before and after, docs, ADR amendment, backlog update, definition of done.

## Complexity Tracking

There are no constitution violations to justify.
