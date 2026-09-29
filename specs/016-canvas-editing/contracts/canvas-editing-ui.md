# UI Contract: Canvas Editing (016)

Component tests assert these roles, names, keys and texts. Mac key labels are shown. On Windows and Linux ⌘ is Ctrl and ⌥ is Alt, and `shortcutLabel()` renders them.

## Shortcuts (added to `SHORTCUTS`, section "Editing")

| Id                   | Keys   | Action id              | Applies to                         |
| -------------------- | ------ | ---------------------- | ---------------------------------- |
| `copy`               | ⌘C     | `clipboard.copy`       | components / groups selected       |
| `cut`                | ⌘X     | `clipboard.cut`        | components / groups selected       |
| `paste`              | ⌘V     | `clipboard.paste`      | canvas (fragment on the clipboard) |
| `duplicate`          | ⌘D     | `clipboard.duplicate`  | components / groups selected       |
| `group`              | ⌘G     | `group.create`         | ≥ 2 components (plus groups)       |
| `ungroup`            | ⇧⌘G    | `group.ungroup`        | unchanged (019)                    |
| `align-left`         | ⌥A     | `arrange.align.left`   | ≥ 2 components                     |
| `align-right`        | ⌥D     | `arrange.align.right`  | ≥ 2 components                     |
| `align-top`          | ⌥W     | `arrange.align.top`    | ≥ 2 components                     |
| `align-bottom`       | ⌥S     | `arrange.align.bottom` | ≥ 2 components                     |
| `nudge`              | ⌥←↑→↓  | —                      | selection, 1 px                    |
| `nudge-10`           | ⌥⇧←↑→↓ | —                      | selection, 10 px                   |
| `drag-no-snap`       | hold ⌘ | —                      | during a drag                      |
| `drag-lock-axis`     | hold ⇧ | —                      | during a drag                      |
| `drag-duplicate`     | hold ⌥ | —                      | on release                         |
| `drop-without-group` | hold ⌥ | —                      | on release                         |

The existing 'group' (G) shortcut entry becomes ⌘G. Keys are matched by `event.code`. None of these shortcuts fire while a text field has focus.

## Menus and toolbar items (019 surfaces)

| Surface              | Items added (section)                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Component menu (102) | Copy ⌘C, Cut ⌘X, Duplicate ⌘D (clipboard); Group ⌘G (edit; disabled "Select two or more components"); Align ▸ (arrange; disabled with fewer than 2) |
| Components menu      | Copy, Cut, Duplicate; Group; Align ▸                                                                                                                |
| Group menu (104)     | Copy, Cut, Duplicate (clipboard)                                                                                                                    |
| Canvas menu (103)    | Paste ⌘V (first item). Disabled tooltip "Nothing to paste: copy components first", or "Press ⌘V to paste" when clipboard read is unavailable        |
| Multi toolbar (99)   | Align ▸ (button "Align", `aria-haspopup="menu"`), Group ⌘G                                                                                          |
| Group toolbar (101)  | unchanged                                                                                                                                           |
| Rail                 | Group button enabled, tooltip "Group ⌘G"                                                                                                            |

**Align ▸ submenu** has these items, in order:

1. Align left ⌥A
2. Align centre
3. Align right ⌥D
4. separator
5. Align top ⌥W
6. Align middle
7. Align bottom ⌥S
8. separator
9. Distribute horizontally (disabled with fewer than 3: "Select three or more components")
10. Distribute vertically (same)

## Canvas elements

| Element               | Role / name                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------- |
| Group label (handle)  | `button` "<title> group, n nodes", draggable. Press = select                                 |
| Group frame edge      | not focusable; pointer only (keyboard path: drawer X/Y/W/H, ⌥ arrows)                        |
| Resize handles        | 8 handles, `aria-hidden`; pointer only                                                       |
| Group drawer geometry | `spinbutton` "X", "Y", "Width", "Height" in a "Frame" section                                |
| Drop target chip      | text "Drop into <title>"                                                                     |
| Offset readout        | text `+dx, +dy` (signed, rounded)                                                            |
| Guides                | `aria-hidden`; distance labels are text                                                      |
| Marquee count chip    | text "<n>"                                                                                   |
| Hint bar              | `status`-less presentational; the text is announced once per gesture through the live region |

## Hint bar texts

| Gesture        | Text                                                            |
| -------------- | --------------------------------------------------------------- |
| Marquee        | `⇧ Add · ⌥ Touch · Esc Cancel`                                  |
| Component drag | `⌥ Duplicate / No group · ⇧ Lock axis · ⌘ No snap · Esc Cancel` |
| Group drag     | `⌥ Duplicate · ⇧ Lock axis · ⌘ No snap · Esc Cancel`            |
| Group resize   | `⇧ Keep ratio · ⌥ From centre · Esc Cancel`                     |

## Announcements (polite live region)

| When               | Text                                                       |
| ------------------ | ---------------------------------------------------------- |
| copy               | "Copied 3 components and 2 connections"                    |
| cut                | "Cut 3 components" (then the existing delete announcement) |
| paste              | "Pasted 3 components and 2 connections"                    |
| duplicate          | "Duplicated 3 components"                                  |
| paste with nothing | "Nothing to paste"                                         |
| group              | "Grouped 4 components"                                     |
| align              | "Aligned 3 components left"                                |
| distribute         | "Distributed 5 components horizontally"                    |
| drop into          | "Moved Fraud check into Payments"                          |
| drop out           | "Moved Fraud check out of Payments"                        |
| nudge burst end    | "Moved 2 components 30 px right"                           |
| gesture cancelled  | "Cancelled"                                                |
| clipboard failed   | toast "Could not use the clipboard"                        |

## Toasts

- **Group nested by drag**: "Moved Payments into Checkout", with an Undo button (`showUndoToast`).
- **Cut with confirmation**: the existing delete confirmation and toast are reused.
