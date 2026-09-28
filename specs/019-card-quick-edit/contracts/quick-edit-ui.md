# Contract: Card Quick Edit UI (019)

This is the user-visible contract that component tests rely on: roles, accessible names, keys and texts. Tests query by these and never by class names. Sizes and tokens come from DESIGN.md "Canvas-first Editor" and the design-analysis inventory (selection toolbar, toolbar popover, context menu), and are not repeated here.

## Inline title edit

| Where          | Element                                        | Name              | Keys                                                                      |
| -------------- | ---------------------------------------------- | ----------------- | ------------------------------------------------------------------------- |
| Component card | `textbox` inside the card's `group`            | "Component title" | ⏎ commit · Esc cancel · Tab / ⇧Tab commit + next / previous · blur commit |
| New component  | same, empty, placeholder "Name this component" | "Component title" | + ⌘⏎ commit and add another of the same kind                              |
| Group label    | `textbox` in the group label                   | "Group title"     | ⏎ · Esc · blur                                                            |

Start: double-click a component, F2 on a focused or selected component or group, or the Rename action. All text is selected on start, except for a new component, where the field is empty.

Announcements: "Renamed to <title>" and "Added <kind> <title>". When a new component is left empty, the announcement reads "Untitled <kind>".

## Details button

| Element  | Name                       | Visible when                                                                                                                             |
| -------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `button` | "Open details for <title>" | Card hovered or focus inside it, **and** not dragging, not flow mode or session, not view-only, not Hide UI, card ≥ 80 px wide on screen |

Activation: selects the card and opens the `complementary` "Details" drawer (018) on it.

## Selection toolbar

Element: a `toolbar`, `aria-orientation="horizontal"`. It is not an F6 region, and there is only one on screen.

| Variant    | Name                            | Buttons (in order; accessible names)                                                                                                      |
| ---------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| component  | "Selection: <title>"            | "Open details" · "Kind: <value>" · "Owner: <value \| none>" · "Tags" · "Technology: <value \| none>" · "Links" · "Rules" · "More actions" |
| components | "Selection: <n> components"     | text "<n> selected" · "Kind" · "Owner" · "Tags" · "Technology" · "More actions"                                                           |
| connection | "Selection: connection <label>" | "Label" · "Protocol: <value>" · "Direction: <value>" · "More actions"                                                                     |
| group      | "Selection: group <title>"      | "Rename" · "Ungroup" · "Collapse" / "Expand" · "Select members" · "More actions"                                                          |
| mixed      | "Selection: <n> items"          | text "<n> selected" · "More actions"                                                                                                      |

In a multi-selection with differing values, the button text reads "Mixed".

- **Field buttons:** `aria-haspopup="dialog"` and `aria-expanded`. "More actions" has `aria-haspopup="menu"`.
- **Tooltips:** name plus shortcut, from `SHORTCUTS`.
- **Keys:**
  - ⌘E focuses the first button.
  - ← / → / Home / End move between buttons.
  - Esc returns focus to the selected object.
  - Tab from a selected card enters the toolbar, and Tab after the last button returns focus to the card.
  - P on a selected connection opens "Protocol".
  - ⇧⌘G on a selected group runs Ungroup (the tooltip shows it, and the key works).
- **Hidden:** during pan, zoom or drag, title edit, flow mode, a session, view-only, Hide UI, or when the selection is empty or only stickies.
- **Placement:** 12 px above the selection. It flips below when its top would be < 68 px, and it always sits inside the window.

### Field popover

| Element                | Name                         | Content                                                                                                       |
| ---------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `dialog`               | the field name ("Owner")     | `searchbox` "Filter <field>" (focused on open) + `listbox` "<field> options"                                  |
| `option`               | value text                   | `aria-selected` for the current value; "Mixed" row text when values differ; tags: "<tag>, 2 of 3" for partial |
| "none" option          | "No owner" / "No technology" | Clears the field                                                                                              |
| "Use '<typed>'" option | Owner / Tech only            | Sets the typed value                                                                                          |

Keys: ↑ / ↓ move, ⏎ picks, and Esc closes and returns focus to the toolbar button. Tags is `aria-multiselectable`: ⏎ toggles a tag and the popover stays open. Links and Rules show the existing 008 editors inside the dialog.

Each pick is one undo step for the whole selection. It is announced as "<Field> set to <value> on <n> components", or "<Field> cleared …".

## Context menu

| Opened by                                                                | Anchor                                                | Focus on open      |
| ------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------ |
| Right-click on a component, connection, group, selection or empty canvas | pointer                                               | menu (pointer)     |
| ⇧F10 / ContextMenu key on the canvas                                     | bottom-left of the focused object, or the view centre | first enabled item |
| Toolbar "More actions"                                                   | below the button                                      | first enabled item |

The element is a `menu` named "Actions for <target>". It closes on Esc and returns focus to the opener.

| Target     | Items (sections separated; shortcut hints right-aligned)                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| component  | Open details ⏎ · Open inside ⏎ (only with children) · Rename F2 │ Copy JSON ⇧⌘C │ Arrange ▸ (Bring to front, Send to back) │ Pin / Unpin (view active) │ Delete ⌫ |
| components | Open details │ Copy JSON │ Arrange ▸ │ Pin all / Unpin all │ Delete                                                                                               |
| connection | Open details · Edit label ⏎ · Protocol ▸ (radio) · Direction ▸ (radio) │ Copy JSON │ Delete                                                                       |
| group      | Open details · Rename F2 │ Collapse / Expand Space · Select members │ Delete group (tooltip "Members move to the parent level")                                   |
| canvas     | Add component ▸ (six kinds, 1–6) · Add sticky │ Select all ⌘A · Fit ⌘0                                                                                            |
| sticky     | Open details │ Copy JSON │ Delete ⌫                                                                                                                               |
| mixed      | Copy JSON │ Delete                                                                                                                                                |

- **Flow mode, session and view-only:** only Open details, Copy JSON and Fit are shown.
- **Delete:** the destructive `menuitem` has a trash icon and the text "Delete".
- **Submenus:** a `menuitem` with `aria-haspopup="menu"`, opened with →.
- **Selection rules:** right-clicking an unselected object selects it. Right-clicking inside the selection keeps the selection.
- **Copy JSON:** writes the Selection-tab JSON to the clipboard. The toast reads "Copied JSON for <label>". If the clipboard is unavailable, it shows the existing "Couldn't copy" toast.

## Shortcut help (018 dialog), new section "Quick edit"

The section lists:

- F2 Rename
- double-click Rename
- ⌘⏎ Save and add another
- ⌘E Focus the selection toolbar
- ⇧F10 Open the context menu
- ⇧⌘C Copy JSON
- ⇧⌘G Ungroup
- P Connection protocol
