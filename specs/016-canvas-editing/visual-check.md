# Visual check (016, SC-009)

Checked on 2026-09-29 in Chrome against the dev build (`vite`, this branch), on a new deck built
in the browser: components added from the canvas menu, copies made with ⌘D, then grouped with ⌘G.
Screenshots are in [`screens/`](screens/).

| Screen                                                  | Ours                                                                                                                                                                  | Result                                                                                                                                                                                                                                            |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 102 Context menu on a component                         | [dark](screens/102-component-menu-dark.jpg)                                                                                                                           | Matches: sections, right-aligned shortcuts, Group disabled with one card, Align ▸ and Arrange ▸, Delete in clay with its icon. Differences below.                                                                                                 |
| 103 Context menu on the empty canvas                    | [light](screens/103-canvas-menu-light.jpg)                                                                                                                            | Matches: Paste first (enabled after a copy; disabled with its tooltip before, checked in the browser and in `canvas-menu.test.tsx`), Add component ▸, Add sticky, Select all, Fit.                                                                |
| 99 Multi-selection toolbar                              | [light](screens/99-toolbar-multi-light.jpg) · [dark, before the Group label fix](screens/99-toolbar-multi-dark.jpg) · [Align open](screens/99-align-submenu-dark.jpg) | Matches: count, shared fields, Group, Align ▾ with the contract's submenu (rules between the groups, ⌥ shortcuts). Differences below.                                                                                                             |
| 104 Context menu on a group                             | not captured                                                                                                                                                          | Items checked in `canvas-menu.test.tsx`: Open details, Rename, Collapse, Select members, Copy, Cut, Duplicate, Delete group.                                                                                                                      |
| 109 Dragging a group                                    | [selected frame, light](screens/109-group-selected-light.jpg)                                                                                                         | Frame, members and nested frames move together by the label; eight handles while selected. The dashed ghost and the offset readout are drawn during the drag (`guides-overlay.test.tsx`); the drag tool cannot hold a drag open for a screenshot. |
| 108 Marquee, 110 Drop target, 111 Snap guides, hint bar | not captured                                                                                                                                                          | Mid-gesture states: covered by `drop-target`, `guides-overlay`, `marquee-chip`, `gesture-hint` and `group-boundary-node` tests. Drop into / out of a frame, undo and frame resize were exercised by hand in the browser.                          |
| 92 Drawer for a multi-selection (Align part)            | not done                                                                                                                                                              | The bulk drawer has no Align / Distribute row yet: align is in the menu, the toolbar and ⌥A / ⌥D / ⌥W / ⌥S.                                                                                                                                       |

## Differences to review

1. **Component menu (102):** the design shows _Copy, Paste, Duplicate, Copy JSON_; the contract (and
   the build) has _Copy, Cut, Duplicate, Copy JSON_, with Paste only in the canvas menu. The design's
   "Group selection" is "Group" here, as in the contract.
2. **Toolbar order (99):** the design has _Align ▾_ before _Group_; the build shows _Group_ then
   _Align ▾_, the same order as the menu (102 has Group before Align). One of the two orders should
   win.
3. **Bulk drawer (92):** Align and distribute are not in the drawer (see above).
4. **Collapse chevron:** on a selected, focused frame the collapse chevron (existing 010 control)
   shows at the top right, as before 016.

## Found and fixed during the check

- A drag could leave its undo gesture open when a toast re-rendered the canvas handlers, so later
  edits merged into one undo step (`fix(app): keep one drag controller across re-renders …`).
- Renaming a group, or resizing its frame, did not redraw the frame: the group lookup was cached by
  nodes and edges only (`fix(app): redraw a group frame when only the groups change …`). This was
  latent before 016 for renames.
- A selected frame was drawn over its members (React Flow raises selected nodes); selection now
  lives in the frame's data (`fix(app): keep member cards above a selected frame …`).
- New-group name field said "Name this component"; it now says "Name this group".
