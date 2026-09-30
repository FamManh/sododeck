# UI Contract: Resize Cards and Route Connectors (017)

Component tests assert these roles, names, keys and texts. Mac key labels are shown. On Windows and Linux ⌘ is Ctrl and ⌥ is Alt, and `shortcutLabel()` renders them.

## Shortcuts (added to `SHORTCUTS`, section "Editing")

| Id                | Keys   | Action id         | Applies to                                                              |
| ----------------- | ------ | ----------------- | ----------------------------------------------------------------------- |
| `resize-card`     | ⌘⇧←↑→↓ | —                 | one focused or selected component; → / ↓ grow, ← / ↑ shrink, 4 px       |
| `move-segment`    | ⌥←↑→↓  | —                 | one selected connection with a middle segment, 1 px, across the segment |
| `move-segment-10` | ⌥⇧←↑→↓ | —                 | same, 10 px                                                             |
| `reset-route`     | R      | `edge.resetRoute` | only during a segment drag                                              |
| `resize-no-snap`  | hold ⌘ | —                 | during a card resize or a segment drag                                  |
| `resize-ratio`    | hold ⇧ | —                 | during a card resize                                                    |
| `resize-centre`   | hold ⌥ | —                 | during a card resize                                                    |

- ⌥ + arrow with a component selected keeps 016's nudge. With a single connection selected, it moves the segment. Arrows along the segment do nothing.
- Key bursts less than 1 s apart are one undo step.
- None of these fire while a text field has focus.

## Menus and toolbar items (019 surfaces)

| Surface                  | Item                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| Component menu (102)     | "Reset size" (arrange). Disabled with the tooltip "Default size" when the card has no stored size. |
| Connection toolbar (100) | "Reset route" button (icon `RotateCcw`). Disabled with the tooltip "Route is automatic".           |
| Connection menu          | "Reset route" (arrange). The same rule applies.                                                    |

## Canvas elements

| Element               | Role / name                                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Card resize handles   | 8 handles, `aria-hidden`, pointer only. The keyboard path is ⌘⇧ + arrow and the drawer. Double-click resets the size.                                                                      |
| Size readout          | Text `244 × 80`.                                                                                                                                                                           |
| Segment handle        | `slider` "Move middle segment", `aria-valuenow` = offset, `aria-orientation` = the axis it moves along. It is focusable when shown, and arrows move it (the same step rules as ⌥ + arrow). |
| Offset readout        | Text with a sign: `+60`, `−18`, `0`.                                                                                                                                                       |
| Automatic-route ghost | `aria-hidden`, a dashed path.                                                                                                                                                              |
| Side targets          | `aria-hidden`, 4 rings per hovered card. The hot one is filled and larger (not colour only).                                                                                               |
| Live end path         | `aria-hidden`, dashed.                                                                                                                                                                     |

## Drawer (detail drawer, 019)

| Target     | Section | Controls                                                                                                                                                                                                                                                                       |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Component  | "Size"  | `spinbutton` "Width" and "Height" (min 120 / 44, max 800 / 600). `button` "Reset size", disabled when there is no stored size.                                                                                                                                                 |
| Connection | "Route" | `combobox` "From side" and "To side" with the options Auto, Top, Right, Bottom, Left. `spinbutton` "Offset", disabled when there is no middle segment, with the description "No middle segment for these sides". `button` "Reset route", disabled when the route is automatic. |

Fields commit on Enter or blur and cancel on Esc. Each commit is one undo step. Values are rounded to whole px and clamped.

## Hint bar texts

| Gesture      | Text                                                    |
| ------------ | ------------------------------------------------------- |
| Card resize  | `⇧ Keep ratio · ⌥ From centre · ⌘ No snap · Esc Cancel` |
| Segment drag | `⌘ No snap · R Reset route · Esc Cancel`                |
| End drag     | `Drop on a side to pin it · Esc Keep old end`           |

## Announcements (polite live region)

| When                    | Text                                  |
| ----------------------- | ------------------------------------- |
| resize end / key burst  | "Resized API Gateway to 244 × 80"     |
| reset size              | "Size reset"                          |
| segment end / key burst | "Moved middle segment to +60"         |
| side pinned             | "Connection now leaves from the top"  |
| side pinned (target)    | "Connection now enters from the left" |
| reconnect               | the existing 003 text                 |
| reset route             | "Route reset"                         |
| gesture cancelled       | "Cancelled" (016)                     |

## Problems (015)

| Kind                     | Text                                                                            |
| ------------------------ | ------------------------------------------------------------------------------- |
| `card-size-out-of-range` | `Component "API Gateway" has a size of 900 × 40; allowed 120 × 44 to 800 × 600` |

## Not available

In flow mode, during flow recording, in the view-only editor, and for cards inside a collapsed group, none of the following are rendered: resize handles, the segment handle, side targets, or the size and route keys. The drawer fields are read-only there. Stored sizes and routes are still drawn.
