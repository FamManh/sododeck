# Contract: canvas UI (003)

The user-facing contract: accessible names and roles (what component tests query), keyboard map,
and the smoke-suite hooks that must not change. Visual reference: the screens listed in the spec.

## Landmarks and names

| Element                                                                                    | Role / name                                                    | Notes                                                                |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| Left panel                                                                                 | `complementary` "Outline" (unchanged, smoke test)              | tabs "Outline" / "Palette" (`tablist`)                               |
| Palette card                                                                               | `button` "Add <Kind>" ; draggable                              | six kinds: Client, Gateway, Service, Queue, Database, External       |
| Outline tree                                                                               | `tree` "Components"; items `treeitem` with the title           | groups expandable (`aria-expanded`)                                  |
| Canvas                                                                                     | region labelled "Diagram canvas" (unchanged, smoke test)       | one Tab stop (roving)                                                |
| Component focusable element, name "<Kind>: <title>", `data-testid="deck-node"` (unchanged) | `aria-selected` when selected                                  |
| Connection                                                                                 | name "<from title> to <to title>[: <label>]"                   | reached with E from a focused node (keyboard map)                    |
| Handles                                                                                    | `button` "Connect from <title>" (4 per node)                   | visible on hover/focus                                               |
| Invalid target text                                                                        | visible text "Already connected" / "Can't connect to itself"   | also announced                                                       |
| Selection count                                                                            | text "<n> selected"                                            | shown when n ≥ 2                                                     |
| Zoom control                                                                               | `button` "Zoom out", "Zoom in", "Fit diagram"; text "<n>%"     | disabled at 30% / 200%                                               |
| Minimap                                                                                    | labelled "Minimap"                                             |                                                                      |
| Labels toggle                                                                              | `button` "Labels", `aria-pressed`                              |                                                                      |
| Undo / Redo                                                                                | `button` "Undo", "Redo", disabled when unavailable             | top bar                                                              |
| Empty-canvas card                                                                          | heading "Start your diagram" + `button` "Open palette"         | only when the deck has no components                                 |
| Edge popover                                                                               | `dialog` "Connection"; fields "Label", "Protocol", "Direction" | focus starts on Label                                                |
| Connect list                                                                               | `dialog` "Connect <title> to…"; `listbox` with `option`s       | disabled options say "already connected"                             |
| Delete confirmation                                                                        | `alertdialog` "Delete …?"; buttons "Cancel", "Delete"          | Cancel has initial focus                                             |
| Undo toast                                                                                 | status text "Deleted … ⌘Z to undo" + `button` "Undo"           | 6 s                                                                  |
| Inspector                                                                                  | `complementary` "Inspector" (unchanged); heading = title       | editable title ("Title") / label ("Label") / deck name ("Deck name") |
| Live region                                                                                | `status` (polite), visually hidden                             | adds, deletes, refusals, undo/redo                                   |

## Keyboard map (canvas focused unless noted)

| Key                    | Action                                                                    |
| ---------------------- | ------------------------------------------------------------------------- |
| Tab / ⇧Tab             | into / out of the canvas (focus lands on the selected or first node)      |
| ← ↑ → ↓                | focus + select the nearest node in that direction                         |
| Shift + arrows         | extend the selection with the nearest node in that direction              |
| Enter                  | on a node: edit its title in the inspector; on an edge: open the popover  |
| C                      | open "Connect <title> to…"                                                |
| E                      | cycle focus through the focused node's connections (then Enter = popover) |
| Delete / Backspace     | open delete confirmation for the selection (never inside text fields)     |
| Esc                    | close popover/dialog; else clear selection                                |
| ⌘/Ctrl A               | select all components                                                     |
| ⌘/Ctrl Z, ⇧⌘Z / Ctrl Y | undo / redo (text fields keep native text undo)                           |
| ⌘/Ctrl + / − / 0       | zoom in / out / fit                                                       |
| Palette: Enter / Space | add that kind at the centre of the view                                   |

## Smoke-suite hooks that must keep working

`/deck/demo` shows 3 `data-testid="deck-node"`; "Outline" and "Inspector" complementaries;
"Diagram canvas"; clicking "Order Service" makes the inspector heading "Order Service"; JSON
region with Monaco; no third-party requests.
