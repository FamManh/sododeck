# Contract: views and Tidy layout UI (011)

These are the user-visible roles, names, keys and texts that component tests assert. Tests use Testing Library, by role and label. Spec FRs are given in brackets.

## View switcher (top bar, centre slot) [FR-002–FR-004, FR-040]

| Element      | Role / name                                   | Behaviour                                                                                          |
| ------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Switcher     | `tablist` "Views"                             | ←/→ move focus, Home/End jump, Enter/Space select. Hidden while recording (the SessionChip shows). |
| Tab          | `tab` "<title>, <type> view", `aria-selected` | Click selects. Double-click renames. Right-click, Shift+F10 or ⋯ opens the tab menu.               |
| Tab ⋯        | `button` "View options for <title>"           | Shown on hover and focus.                                                                          |
| Add          | `button` "Add view"                           | Adds "Custom <n>", selects it, and shows the toast `View "Custom <n>" created`.                    |
| Overflow     | `button` "More views"                         | Menu of the tabs that don't fit. The current tab is always visible.                                |
| Announcement | live region                                   | "<title> view" on every switch.                                                                    |

Switching clears selection, drill-in and focus, and fits the view's visible components (fit zoom clamped to 40–130%).

## Tab menu [FR-041–FR-043]

| Item           | Role / name                 | Behaviour                                                                                                                                                                                           |
| -------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rename         | `menuitem` "Rename"         | Inline `textbox` "View name". Enter commits, Esc cancels. Blank input shows "A view needs a name" and keeps the old title.                                                                          |
| View settings… | `menuitem` "View settings…" | Opens the settings popover anchored to the tab.                                                                                                                                                     |
| Delete view    | `menuitem` "Delete view"    | Opens `alertdialog` 'Delete view "<title>"?' (Cancel / Delete), then the Undo toast `View "<title>" deleted` for 6 s. Disabled on the last view, with the tooltip "A deck needs at least one view". |

## Settings popover [FR-010–FR-014, FR-043]

A `dialog` "View settings: <title>" that isn't modal. Esc or an outside click closes it and focus returns to the tab. Each change is one undo step.

| Control     | Role / name                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| Subtitle    | `radiogroup` "Subtitle": Technology · Hosting · Flows · owner · Owner · None                            |
| Hide groups | `group` "Hide groups" with a `checkbox` per group (nesting shown by indentation)                        |
| Hide kinds  | `group` "Hide kinds" with a `checkbox` per kind used in the deck, plus any already chosen               |
| Hide tags   | `group` "Hide tags" with a `checkbox` per tag used in the deck, plus any already chosen                 |
| Dim kinds   | `group` "Dim kinds" with a `checkbox` per kind used in the deck                                         |
| Feature     | `combobox` "Feature": "All features" or a feature title. It shows "(deleted)" when the feature is gone. |

## Canvas [FR-012, FR-013, FR-020–FR-024, US1–US2]

- Component subtitle text follows the view: tech / host / owner / "3 flows · Orders" / "1 flow" / "0 flows" / none.
- A dimmed component has its accessible name suffixed ", dimmed in this view", reduced opacity via a token, and stays clickable and focusable.
- A pinned component shows an `img` "Pinned" glyph (every level except Landscape) and has ", pinned" in its name.
- A component revealed in a view that hides it shows the note "Hidden in this view" until the next switch.

## Pin controls [FR-023]

- Node inspector: `switch` "Pin position" (mixed state for a mixed multi-selection; toggling pins all of them).
- Canvas toolbar, when the selection has nodes: `button` "Pin" / "Unpin" (`aria-pressed`).

## Tidy layout [FR-030–FR-036]

| Element  | Role / name                                                 | States                                                                                                              |
| -------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Button   | `button` "Tidy layout" (canvas toolbar)                     | Disabled with a tooltip: "Not available while a flow is open" · "Nothing to arrange" · "All components are pinned". |
| Progress | `progressbar` "Tidying layout" and `button` "Cancel layout" | Appears after 500 ms. Cancel leaves positions unchanged and announces "Layout cancelled".                           |
| Done     | live region                                                 | "Layout tidied, <n> components moved". The canvas fits the result.                                                  |

⌘Z right after it restores every moved position in one step.

## Undo across views [FR-045]

When undo or redo changes only another view, a toast reads "Undid <move | pin | rename | view settings | change> in <title>" (or "Redid …"), with the `button` "Go to <title>". The same text is announced. Nothing extra is shown for changes to shared data or to the current view.

## Search [FR-016]

- A result for a component hidden in this view has the meta text "… · Hidden in this view".
- Choosing it keeps the view and shows the toast "<title> is hidden in this view", with the `button` "Show in <view>" (focused, so Enter activates it). When no view shows the component, the toast reads "<title> is hidden in every view" with no action.

## Breadcrumb [FR-004]

The view crumb is "<title> view" (it was the fixed "System view" in 010).
