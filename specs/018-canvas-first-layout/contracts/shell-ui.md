# Contract: Canvas-First Shell UI (018)

The user-visible contract that component tests and the smoke suite rely on: roles, accessible names, keys and texts. Tests query by these, never by class names. Sizes and tokens are in DESIGN.md "Canvas-first Editor"; they are not repeated here.

## Regions (F6 order)

| #   | Region  | Element                                  | Accessible name  | Visible when                |
| --- | ------- | ---------------------------------------- | ---------------- | --------------------------- |
| 1   | deck    | `toolbar`                                | "Deck"           | not Hide UI                 |
| 2   | tools   | `toolbar`                                | "Tools"          | not Hide UI                 |
| 3   | rail    | `toolbar`, `aria-orientation="vertical"` | "Canvas tools"   | not Hide UI                 |
| 4   | history | `toolbar`                                | "History"        | not Hide UI                 |
| 5   | canvas  | existing canvas wrapper                  | "Diagram canvas" | always                      |
| 6   | zoom    | `toolbar`                                | "Zoom"           | not Hide UI                 |
| 7   | drawer  | `complementary`                          | "Details"        | drawer open and not Hide UI |

F6 moves forward, ⇧F6 backward, wrapping; hidden regions are skipped. Inside a toolbar, Tab / ⇧Tab move between its controls (no roving tabindex: islands are short). Under Hide UI, F6 alternates between the canvas and the "Show UI" button.

## Deck island

| Control      | Role / name                                                                                            | Behaviour                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Menu         | `button` "Deck menu", `aria-haspopup="menu"`                                                           | Opens `menu` "Deck menu"                                                                       |
| Deck name    | `button` "Rename deck" → `textbox` "Deck name"                                                         | Enter commits (one undo step), Esc cancels, empty keeps the old name (unchanged from today)    |
| Save status  | `button` or `status` with name "Saving…" / "Saved in this browser" / "Couldn't save — export a backup" | Icon only; the error state opens the existing save-error popover; announced in the live region |
| Views        | existing `tablist` "Views" (compact: `combobox` "View")                                                | 011 behaviour; tab menu holds "View settings…" and "Tidy layout"                               |
| Flow chip    | `button` "Exit flow <name>" with visible text "Flow · <name>"                                          | Exits flow mode                                                                                |
| Session chip | existing 006 chip                                                                                      | Replaces the views control during recording / edit                                             |
| Drill chip   | existing `navigation` "Breadcrumb" from `DrillCrumbs`                                                  | 010 behaviour                                                                                  |

Deck menu items (`menuitem`): "All decks" (library), "Import…", "Export…", "Deck settings", "Show JSON" / "Hide JSON" (shortcut hint ⌘J / Ctrl+J).

## Tools island

| Control | Role / name                                                      | Notes                                                 |
| ------- | ---------------------------------------------------------------- | ----------------------------------------------------- |
| Jump to | `button` "Jump to… (⌘K)" `aria-haspopup="dialog"`                | Existing command palette                              |
| Labels  | `button` "Labels" `aria-pressed`                                 | Existing toggle                                       |
| Notes   | `button` "Notes: <dimmed\|shown\|hidden>" `aria-haspopup="menu"` | Sticky visibility (§g-46); moved from `CanvasToolbar` |
| Focus   | `button` "Focus" `aria-pressed`                                  | Existing; disabled with reason in flow mode           |
| Theme   | `button` "Switch to <light\|dark> theme"                         | Existing                                              |
| Export  | `button` "Export"                                                | Existing export                                       |

Pin / unpin (011) moves to the drawer's component inspector (existing switch) and the command palette; Tidy layout to the views menu (§g-46).

## Rail

`toolbar` "Canvas tools". Each item is a `button` with `aria-label` = name; tool buttons use `aria-pressed`, panel buttons use `aria-expanded` + `aria-controls` of their flyout. Tooltip (400 ms, focus or hover): "<name> <shortcut>".

| Name             | Shortcut | Kind  | Action                                                                           |
| ---------------- | -------- | ----- | -------------------------------------------------------------------------------- |
| Select           | V        | tool  | Default tool                                                                     |
| Add component    | C        | panel | Palette flyout. C opens it only when no card is focused (§g-49)                  |
| Sticky note      | S        | tool  | Next click adds a note there                                                     |
| Group            | G        | tool  | `aria-disabled="true"`, tooltip "Group from selection — coming soon" (until 016) |
| Connector        | L        | tool  | Next click on a card opens its connect popover                                   |
| Outline          | ⌥1       | panel | Outline flyout                                                                   |
| Flows & features | ⌥2       | panel | Flows flyout                                                                     |
| Rules            | —        | panel | Rules flyout                                                                     |
| Search           | ⌘K       | —     | Command palette                                                                  |
| Problems         | ⌘.       | panel | Problems flyout; name "Problems, <n>" with a visible count badge; absent at 0    |

History island: `button` "Undo" / "Redo" (existing names, tooltips with ⌘Z / ⇧⌘Z).

## Flyout

- `dialog` (non-modal) named by its title: "Components", "Outline", "Flows & features", "Rules", "Problems".
- Header: `button` "Pin <title>" `aria-pressed`; `button` "Close <title>".
- Opening moves focus to the first control (filter field if present). Esc: clears a non-empty filter first; then closes an unpinned flyout (focus → rail button) or moves focus to the rail button of a pinned one.
- Pointer down on the canvas closes an unpinned flyout; the pointer event still reaches the canvas.
- Announcements: "<title> opened", "<title> closed", "<title> pinned".
- Palette flyout: kind tiles are `button`s "Add <kind>" with a `1`–`6` key hint; keys 1–6 add at the view centre while it is open; tiles stay draggable.

## Detail drawer

- `complementary` "Details". Header: kind tile, title, subline, `button` "Close details".
- Opens on: Enter on a plain focused component; double-click on a plain component; ⌘⇧D / Ctrl+⇧D (toggle); command palette "Open details"; deck menu "Deck settings" (deck mode).
- Enter on a group or a component with children still drills in (010).
- Focus on open: the inspector's title field (or the first field). Esc (not consumed by a field popover) or "Close details" closes it; focus returns to the canvas object.
- Grip: `separator` "Resize details", `aria-orientation="vertical"`, `aria-valuemin="320"`, `aria-valuemax="560"`, `aria-valuenow`; ←/→ ±8, ⇧←/⇧→ ±40, Home / End min / max.
- The canvas never changes size; if the selection is under the drawer the canvas pans (no zoom change).

## JSON overlay

- Existing `region` "JSON" (004), positioned as a bottom overlay. Hidden by default per deck.
- ⌘J / Ctrl+J toggles and focuses the viewer on open; Esc in the viewer returns focus to the canvas without closing; `button` "Close JSON" closes.
- Read-only message unchanged: "Read-only. Edit on the canvas or in the inspector."

## Zoom island

`toolbar` "Zoom": `button` "Fit diagram" (⇧1, also ⌘0), `button` "Fit selection" (⇧2, disabled without a selection), `button` "Zoom out" (⌘−), zoom % (not focusable), `button` "Zoom in" (⌘+), existing level indicator, `button` "Minimap" `aria-pressed` (M), `button` "Keyboard shortcuts" (?).

## Hide UI

- ⌘\\ / Ctrl+\\ toggles. When on, only `button` "Show UI" (hint ⌘\\) is visible; announcement "Interface hidden" / "Interface shown".
- Canvas keys, selection, delete confirmation, toasts, popovers, command palette and playback keys keep working.

## Shortcut help

`dialog` "Keyboard shortcuts", sections as `heading`s (Canvas, Tools, Panels, Flows, JSON), each shortcut a `row` of a `table` (Action, Keys). Content from the shared `SHORTCUTS` table used by tooltips.

## Single-key guard

V, S, G, L, C, M, 1–6, ? and F (focus) are ignored while focus is in a text input, textarea, contenteditable or the Monaco viewer.
