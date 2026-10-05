# Implementation Plan: Editor chrome polish

**Branch**: `054-editor-chrome-polish` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/054-editor-chrome-polish/spec.md`

## Summary

Seven small chrome changes, all in `apps/app` plus one constant table in `packages/model`. No file
format change, no new dependency, no new document data.

- **Deck settings** becomes an icon button in the tools island (top-right); the menu entry stays.
- **Focus** moves from the tools island to the rail, directly under Select.
- **Views**: the two built-in presets are retitled Overview and Flows; Infra is dropped from the
  presets. Ids and types stay (`system`, `feature`), so no schema change and no stored deck changes.
- **Table detail** becomes one compact dropdown button with a one-line description per choice.
- **Spread ends evenly** gets an enabled-state description (the `Action.description` field exists).
- **Lock** gains the `group` and `mixed` targets. A group's lock is derived: every card inside it
  (nested groups included) is locked. Locked groups refuse move, resize and delete.
- **DBML drawer**: a second right-side drawer with DBML and SQL tabs, always the whole schema;
  the JSON panel keeps JSON only. The Selection / Whole schema switch is hidden, not removed.

## Technical Context

**Language/Version**: TypeScript strict (`noUncheckedIndexedAccess`), Node ≥ 24, pnpm monorepo

**Primary Dependencies**: existing only (React 19, `@xyflow/react`, Yjs, Zustand, Radix, lucide-react, Monaco). No new dependency (constitution VIII).

**Storage**: Yjs document unchanged. UI preferences in `localStorage` (`sododeck.jsonPanel`, extended with the code drawer) and per-deck shell prefs (unchanged).

**Testing**: Vitest (pure geometry, prefs, presets, lock helpers), Testing Library for components (roles and labels). No new e2e (AGENTS.md); the smoke suite must stay green and is updated only if the moved controls break it.

**Target Platform**: modern desktop browsers (Chromium first), light and dark themes, compact shell (1024–1279 px).

**Project Type**: monorepo web app; this feature touches `apps/app` and `packages/model` (preset constants only).

**Performance Goals**: no regression at 500 nodes / 1,000 edges. Lock over a group is one transaction (one undo step); group-locked checks are computed from the snapshot, not per frame. `pnpm bench` before and after only if canvas handlers are touched (group drag guard), numbers in the report.

**Constraints**: tokens only; keyboard access for every control; DBML parser and editor stay lazy-loaded (046 FR-006); no network with content.

**Scale/Scope**: ~25 source files, mostly small edits; one new component (`CodeDrawer`).

## Constitution Check

_GATE: passed before Phase 0, re-checked after Phase 1._

| Principle                                    | Result                                                                                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I. Single source of truth                    | Pass. Lock stays `node.locked` in Yjs; a group's lock is derived from its members, no copy. Drawer open / width are UI-only (Zustand + prefs).                           |
| II. Schema-owned format, lossless round-trip | Pass. No schema change. Preset retitling touches constants only; stored views are never rewritten (research R2).                                                         |
| III. Stable identity                         | Pass. Preset ids `system` / `feature` are unchanged; only titles change.                                                                                                 |
| IV. Local-first, private                     | Pass. No network.                                                                                                                                                        |
| V. Performance                               | Pass with a duty: the DBML drawer reuses the lazy chunks; the group-lock guard is O(group size). Bench if `use-canvas-handlers` changes.                                 |
| VI. Strict types, tested                     | Pass. Pure helpers (`groupLockState`, `clampCodeDrawerWidth`, prefs reader) unit-tested; components by roles.                                                            |
| VII. Accessible                              | Pass. Every moved control keeps its name, shortcut and tooltip; the new drawer grip is a keyboard-operable separator like the details drawer's.                          |
| VIII. Simplicity, dependencies               | Pass. No new dependency; reuses `DrawerGrip` pattern, `DbmlTab`, `SqlTab`, `Action.description`, `toggleLock`. No ADR needed (no format or data decision); see research. |

No violations; Complexity Tracking is empty.

## Project Structure

### Documentation (this feature)

```text
specs/054-editor-chrome-polish/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/ui.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
packages/model/
├── src/views.ts                         # presets: Overview, Flows (ids/types kept); Infra removed
├── src/ops/node-lock.ts                 # unchanged (setLocked over node ids)
├── src/ops/group-members.ts (or in group-selection.ts)  # descendantNodeIds(group) incl. nested
└── test/views.test.ts                   # presets, resolveViews, nextCustomTitle

apps/app/src/
├── editor/views/view-title.ts           # tab name without "system view"; crumb fallback "Overview view"
├── editor/shell/tools-island.tsx        # + Deck settings button; − Focus
├── editor/shell/rail.tsx                # + Focus under Select (aria-pressed, disabled reason)
├── editor/shell/shell-geometry.ts       # ISLAND_SIZES (rail 11 buttons), code drawer clamp, insets
├── editor/shell/shell-chrome.tsx        # mounts CodeDrawer; right offsets for zoom island, JSON overlay
├── editor/shell/json-overlay.tsx        # right edge accounts for both drawers
├── editor/shell/code-drawer.tsx         # NEW: header [DBML|SQL] + Copy + close; grip; body DbmlTab/SqlTab
├── editor/shell/code-drawer-grip.tsx    # NEW (or DrawerGrip generalised with min/max/onCommit props)
├── editor/shell/deck-menu.tsx           # "Show DBML / SQL" item; keeps Deck settings
├── editor/shell/use-shell-shortcuts.ts  # Esc / focus return; region order gains 'code'
├── editor/shell/regions.ts              # + 'code' region
├── editor/json-panel.tsx, json-panel-header.tsx   # JSON only; no format tabs, no scope switch
├── editor/code/dbml-tab.tsx, sql-tab.tsx          # scope fixed to 'schema'; selection hint copy removed
├── editor/code/code-format-tabs.tsx     # offers dbml | sql only (used by the drawer)
├── editor/shell/table-detail-control.tsx# one dropdown always, option descriptions
├── editor/shell/zoom-island.tsx         # slot for the compact control
├── editor/actions/connection-actions.ts # SPREAD_ENDS_ACTION.description
├── editor/actions/table-actions.ts      # node.lock → targets group, mixed; group-aware toggleLock
├── editor/lock.ts                       # groupLockedIds, isGroupLocked, refuse for groups
├── editor/use-canvas-handlers.ts        # group move/resize/delete guard
├── editor/command-palette/commands.ts   # "Open DBML drawer" entry
├── state/json-panel-prefs.ts            # format limited to json; code drawer prefs
├── state/ui-store.ts                    # codeDrawer { open, width, format }
└── (tests next to each file)
```

**Structure Decision**: one new component pair in `editor/shell/`; everything else is an edit. The
JSON panel loses its format tabs instead of gaining a flag, so the two surfaces share no state.

## Phase 0 → research.md · Phase 1 → data-model.md, contracts/ui.md, quickstart.md

## Complexity Tracking

_Empty: no constitution violations._
