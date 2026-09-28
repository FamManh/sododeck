# Data Model: Canvas-First Layout (018)

**No document data changes.** The `.sododeck.json` schema, the Yjs layout and `@sododeck/model` are untouched. Everything here is UI-only state (constitution I): in the Zustand UI store, or in per-deck preferences in `localStorage`. None of it enters the deck file, the Yjs document or undo history (FR-042).

## UI store: `shell` slice (`apps/app/src/state/ui-store.ts`)

| Field          | Type                                                            | Default                                     | Notes                                                                                                                                                            |
| -------------- | --------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flyout`       | `FlyoutId \| null`                                              | from prefs                                  | The flyout shown. Starts as `pinnedFlyout`.                                                                                                                      |
| `pinnedFlyout` | `FlyoutId \| null`                                              | from prefs                                  | Stays open on canvas clicks; returns when a temporary flyout closes.                                                                                             |
| `drawer`       | `{ open: boolean; width: number; mode: 'selection' \| 'deck' }` | `{ false, prefs.drawerWidth, 'selection' }` | `mode: 'deck'` shows deck settings and ignores an empty selection.                                                                                               |
| `drawerReturn` | `string \| null`                                                | `null`                                      | Canvas object id that gets focus back when the drawer closes.                                                                                                    |
| `hideUi`       | `boolean`                                                       | `false`                                     | Per tab session; not saved.                                                                                                                                      |
| `minimap`      | `boolean`                                                       | `false`                                     | Per tab session.                                                                                                                                                 |
| `tool`         | `'select' \| 'sticky' \| 'connector'`                           | `'select'`                                  | Resets to `select` after one use, on Esc and on deck change.                                                                                                     |
| `helpOpen`     | `boolean`                                                       | `false`                                     |                                                                                                                                                                  |
| `jsonShown`    | `boolean`                                                       | from prefs                                  | Whether the JSON overlay is shown (⌘J). `jsonPanel` (004) is unchanged: its `open` is still expanded / collapsed inside the overlay, global with height and tab. |

`FlyoutId = 'palette' | 'outline' | 'flows' | 'rules' | 'problems'`.

`leftTab` and `setLeftTab` are removed (Outline and Palette become separate flyouts).

### Actions

| Action                                               | Effect                                                                                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `openFlyout(id)`                                     | `flyout = id`. If it is the one shown, closes it (toggle).                                                                                                               |
| `closeFlyout()`                                      | `flyout = pinnedFlyout === flyout ? null : pinnedFlyout`; unpins when closing the pinned one itself.                                                                     |
| `dismissFlyout()`                                    | Outside click / Esc: closes only when `flyout !== pinnedFlyout`, then `flyout = pinnedFlyout`.                                                                           |
| `togglePin()`                                        | `pinnedFlyout = pinnedFlyout === flyout ? null : flyout`; saved to prefs.                                                                                                |
| `openDrawer(mode?)`                                  | `drawer.open = true`, records `drawerReturn` from `focusedId`.                                                                                                           |
| `closeDrawer()`                                      | `drawer.open = false`, `mode = 'selection'`.                                                                                                                             |
| `toggleDrawer()`                                     | Open ↔ closed.                                                                                                                                                           |
| `setDrawerWidth(px)`                                 | Clamped to 320–560; saved to prefs on release (the grip calls it with `commit: true`).                                                                                   |
| `setHideUi(on)`                                      | Flag only; other shell state is kept.                                                                                                                                    |
| `setMinimap(on)`, `setTool(tool)`, `setHelpOpen(on)` | Flags.                                                                                                                                                                   |
| `resetForDeck(deckId)`                               | Existing reset plus: reads per-deck prefs → `pinnedFlyout`, `flyout`, `drawer.width`, `jsonShown`; `drawer.open = false`; `hideUi`, `minimap`, `tool`, `helpOpen` reset. |

### Derived (pure, not stored)

- **Drawer auto-close:** when the pruned selection becomes empty and `drawer.mode === 'selection'`, `closeDrawer()` (called from the existing `pruneSelection` / `select` paths).
- **Visible regions** (`regions.ts`): `deck`, `tools`, `rail`, `history`, `zoom` are visible unless `hideUi`; `canvas` always; `drawer` when `drawer.open && !hideUi`.
- **Geometry** (`shell-geometry.ts`): island rectangles for a viewport size, chrome coverage ratio, drawer rectangle (`right 12, top 68, bottom 12, width`), JSON overlay rectangle (`left 68`, `right 12` or `drawer.width + 24`, height from `jsonPanel.height` clamped to `viewport − 80`), zoom island bottom offset, pan-to-clear offset.

## Per-deck preferences (`apps/app/src/editor/shell/shell-prefs.ts`)

Stored at `localStorage["sododeck.shell.<deckId>"]` as JSON:

```ts
interface ShellPrefs {
  drawerWidth: number; // 320–560, default 360
  pinnedFlyout: FlyoutId | null; // default null
  jsonOpen: boolean; // → jsonShown, default false
}
```

- **Read:** validated field by field; an invalid or missing field falls back to its default; blocked storage returns all defaults (same pattern as `json-panel-prefs.ts`).
- **Write:** best-effort on `togglePin`, drawer resize release and JSON toggle. Not written for the demo or memory decks (no stable id).
- **Delete:** when the library purges a deck (`purgeDeleted`), its key is removed.
- **Tabs:** read only when the deck opens; never broadcast (§g-50).

## State transitions

**Flyouts** (`P` = pinned flyout, `F` = shown flyout):

| From                   | Event                                 | To                                                                          |
| ---------------------- | ------------------------------------- | --------------------------------------------------------------------------- |
| `F=null, P=null`       | open outline                          | `F=outline`                                                                 |
| `F=outline, P=null`    | open flows                            | `F=flows`                                                                   |
| `F=outline, P=null`    | canvas click / Esc                    | `F=null`                                                                    |
| `F=outline, P=null`    | pin                                   | `F=outline, P=outline`                                                      |
| `F=outline, P=outline` | canvas click                          | unchanged                                                                   |
| `F=outline, P=outline` | open palette                          | `F=palette, P=outline`                                                      |
| `F=palette, P=outline` | close / Esc / canvas click / add done | `F=outline, P=outline`                                                      |
| `F=outline, P=outline` | unpin or ×                            | `F=null, P=null`                                                            |
| any                    | recording session starts              | `F=flows` (temporarily pinned; previous `P` restored when the session ends) |

**Drawer:**

| From               | Event                                                          | To                                       |
| ------------------ | -------------------------------------------------------------- | ---------------------------------------- |
| closed             | Enter on a plain component / double-click / ⌘⇧D / Open details | open (`selection`), focus inside         |
| closed             | Deck menu → Deck settings                                      | open (`deck`)                            |
| open               | Esc / close / ⌘⇧D                                              | closed, focus → `drawerReturn` or canvas |
| open (`selection`) | selection becomes empty                                        | closed                                   |
| open               | selection changes                                              | open, shows new selection                |

**Hide UI:** `false ⇄ true` via ⌘\\ or the pill; no other field changes.
