# Contract: user-visible UI (008)

This contract fixes the roles, accessible names and visible text that component tests assert (constitution VI: tests query by role and label). Visual targets: `docs/design/screens/` 02, 04, 10, 18, 23, 28, 29, 49, 50, 51, 58 (light and dark), with these exceptions from the spec (FR-037):

- SLA target only.
- The owner field is a combobox.
- DESIGN.md `success` for matches and `clay` for no-match and errors.
- Lucide icons.

## Shared fields

| Field       | Role / structure                                                                                                                                                          | Accessible name                       | Text                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------- |
| Section     | `PanelSection` heading (micro-label)                                                                                                                                      | —                                     | TITLE, DESCRIPTION · MARKDOWN, OWNER, TECH, HOST, TAGS, LINKS, RULES, CONNECTIONS · n, … |
| Text field  | `textbox`                                                                                                                                                                 | the section label ("Title", "Tech" …) | Empty required value on blur: "<Label> can’t be empty." (existing `FieldEdit` text)      |
| Description | `radiogroup` "Description view" with `radio` Write / Preview; Write = `textbox` (multiline) "Description"; Preview = region "Description preview"                         | as listed                             | Empty preview: "Nothing to preview."                                                     |
| Owner       | `combobox` (`aria-autocomplete="list"`) + `listbox` "Owner suggestions" of `option`s                                                                                      | "Owner"                               | Placeholder "Add owner"                                                                  |
| Tags        | `list` "Tags" of chips, each with `button` "Remove tag <tag>"; add field `combobox` "Add tag"                                                                             | as listed                             | "+ Add tag"                                                                              |
| Links       | `list` "Links"; each `listitem` has `link` "<label>" (opens a new tab), `button` "Edit label for <label>", `button` "Remove link <label>"; add field `textbox` "Add link" | as listed                             | Refused: "Only http, https or relative links" (icon + text, `aria-describedby`)          |
| Undo toast  | `status` toast with `button` "Undo"                                                                                                                                       | —                                     | "<What> deleted · ⌘Z to undo" (Ctrl+Z off Apple), 6 s                                    |

## Component inspector (`aria-label="Inspector"`)

- Header: kind tile, `heading` = title, subtitle "<Kind> · <Group or No group> · <id>", `button` "Delete component".
- The frame is 006's `InspectorFrame` (moved to `editor/inspector/`).
- Fields, in order: Title, Kind (`combobox` pick mode), Group (`combobox` pick mode, with "No group"), Description, Owner + Tech (one row), Host, Tags, Links, Rules, Connections · n.
- Rules: `list` "Attached rules". Each item has `button` "<rule title>" (opens the rule editor) and `button` "Detach <rule title>". Then `button` "Attach rule". A missing rule shows "Missing rule <id>" with an icon and "Detach".
- Connections · n: `list`. Each `button` reads "→ <other>" or "← <other>", with the label as secondary text, and selects that connection.

## Connection inspector

- Header: `heading` "<from> → <to>", subtitle "Connection · <id>", `button` "Delete connection".
- Title (the label), From and To (each a `combobox` in pick mode over components; refused: "Can't connect to itself" / "Already connected", announced), Protocol (`radiogroup` "Protocol": HTTP, gRPC, Event, SQL, WebSocket, Other, plus "Not set"), Description, Owner, Direction (`radiogroup`: Forward, Both, None), Tags, Links.
- USED IN FLOWS: `list` of `button` "<flow> · Step <n>". When empty: "Not used in any flow".

## Flow inspector (extends 006)

- 006's Title, Description, Owner and Feature, plus Tags and Links, plus the summary line "<n> steps · <b> branches · <c> components", with " · <k> broken steps" when k > 0 (icon + text).

## Step inspector (extends 006)

- Header unchanged from 006: `heading` "Step <n> · <from> → <to>", subtitle "<flow> · step <n>" (or "branch “<label>”").
- 006's Title, Description, Condition and SLA target (a text field only: no meter, no measured value), plus Owner, Edge (read-only text "<label> · <protocol>", or "Connection deleted" with an icon), Tags, Links, and Attached rules.
- Attached rules: section heading "ATTACHED RULES <count>".
  - Each rule is an `article` named after the rule, containing:
    - A compact `table` (caption = rule title): condition and action columns, numbered rows.
    - "Evaluated with": one `textbox` per condition, labelled with the column label.
    - A result `status`, either "Row <n> matches → <a1> · <a2> …" with a check icon, the matched row with `aria-selected="true"` and a bold number, or "No row matches these inputs" with an alert icon, or "<n> rows match; Unique expects one" with a warning icon.
    - `button` "Edit rule" and `button` "Detach <rule>".
  - With no rules: "No decision table on this step." and `button` "Attach rule".

## Deck inspector

- Name (required), Description, Tags.
- Stats: a `list` "Deck summary" with Components n, Connections n, Flows n, and `button` "Rules n" (opens the rule editor).
- 005's Storage section.

## Bulk inspector (two or more components)

- Header `heading` "<n> components selected". The subtitle lists the first three titles. When connections are selected too: "<n> components, <m> connections selected" plus the note "Changes apply to components only."
- Kind (`combobox`, pick mode), Owner, Tech, Group (pick, including "No group"), Tags.
- A Mixed field shows the placeholder "Mixed" in italics, with accessible description "Mixed values". A shared field shows the hint "Same on all <n>".
- A partial tag chip is dashed, labelled "<tag> <k>/<n>", with `button` "Add <tag> to all" and `button` "Remove <tag> from all".
- Note text: "Fields marked Mixed keep each component's own value until you type a new one. Dashed tags are on some components only."
- `button` "Delete <n> components" opens 003's confirmation.

## Attach rule popover

- `dialog` "Attach rule", containing a `searchbox` "Filter rules" and a `listbox` of `option`s "<title> · <rows> rows". Already attached options are `aria-disabled` and marked "Attached".
- Last option: "New rule".
- Enter attaches the rule and closes the dialog; Esc closes it.

## Top bar

- Canvas screen: `link` "Rules" with the count badge, placed before the save status.
- Rules screen: the breadcrumb adds "Rules". `link` "Back to canvas" (primary) replaces Export.

## Rule editor (`/deck/:deckId/rules/:ruleId?`)

**Left column**

- `navigation` "Decision tables" with `button` "New rule" and a `list` of `link` "<title>", secondary "<rows> rows · used in <n> steps". The current rule has `aria-current="page"`.
- Footer: "Rules are shared across the deck. Attach one to any flow step; edits apply everywhere it is used."
- Empty deck: "No decision tables yet" and `button` "New rule".

**Centre**

- Name: `textbox` "Rule name". Description: Write / Preview.
- Hit policy: `combobox` "Hit policy" with First match, Unique, Collect.
- `button` "Add condition" and `button` "Add action".
- `button` "Delete rule…" in the header menu opens the confirmation.
- Table: `grid` "Decision table <title>".
  - Column groups WHEN / THEN. Column header cells are editable (name "Condition <label>" / "Action <label>"), each with a `button` "Column options" menu containing Rename and Remove.
  - Row header: row number, `button` "Drag row <n>" (the grip), `button` "Delete row <n>".
  - Cells are `gridcell`s. An invalid cell has `aria-invalid="true"`, an icon, and the description "Not a valid condition".
- `button` "Add row".
- Hint: "Cells accept ≤ 5, > 20, exact values, comma-separated lists, or Any."
- Keys:
  - Arrows move between cells.
  - Enter or F2 edits; Enter commits and moves down; Esc cancels; typing a character starts editing.
  - ⌥↑ / ⌥↓ moves a row; ⌫ on a row header deletes the row.
  - ⌘Z / ⇧⌘Z undo and redo (outside an editing cell).

**Right column**

- TEST INPUT: one `textbox` per condition, labelled with the column label.
- The result is a polite `status`, one of:
  - "Matched Row <n>" with a definition list of action label → value.
  - "Matched <k> rows" (Collect).
  - "No row matches these inputs" (alert icon).
  - "<k> rows match; Unique expects one", naming the rows.
- When opened from a step: `button` "Save as step inputs (<flow> · Step <n>)".
- USED IN: a `list` of `button`s "<flow> · Step <n> · <from> → <to>" (or "Connection deleted") and "<component title>". When empty: "Not used yet".
- CHECKS: a `list`, containing either "No catch-all row — some inputs match nothing" (warning icon) or "Has a catch-all row" (check icon), plus one line for the policy: "Row order decides the winner" / "Only one row may match" / "Every matching row applies".

## Delete rule dialog

- `alertdialog` with title "Delete rule “<title>”?".
- Body: "Used in <n> steps and <m> components. It will be detached from them." When unused: "It isn't used anywhere."
- `button` "Delete" (destructive) and `button` "Cancel".
- Toast: "Rule “<title>” deleted · ⌘Z to undo".

## Announcements (polite live region)

"Undone" / "Redone" (existing), "<Tag> added", "Rule attached", "Rule detached", "Row <n> deleted", "Column <label> removed", the evaluation result text when TEST INPUT changes (debounced 500 ms), and connection reattach refusals.
