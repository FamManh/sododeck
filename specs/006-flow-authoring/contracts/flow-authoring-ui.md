# Contract: flow authoring UI (006)

This is the user-visible contract. Tests assert it through roles, labels and text (constitution VI).
Design frames: 02 and 03 (left panel), 41–48, light and dark. The spec's FR numbers are in brackets.

## Left panel: features and flows [FR-001–005, FR-001a, FR-034–036]

- **Region** `complementary` "Features". It contains:
  - A **filter**: `searchbox` "Filter flows", with its shortcut hint `/`, a status text "n of m",
    and Esc to clear.
  - The **feature list**. Each feature is a `group` named after its title, with:
    - a menu button "Feature actions: <title>" offering Rename (F2), New flow, and Delete…
    - a `list` of flows
    - a "+ New flow" button
  - A **"No feature" group**, shown only when flows without a feature exist.
  - A **"New feature" button**.
- **Flow row**: a `listitem` with:
  - a button whose name is the flow title
  - its step count ("8 steps"), shown with `aria-describedby`
  - an alert icon plus the text "Has problems" when `analyzeFlow` reports broken or chain-break
    steps
  - a "Flow actions: <title>" menu: Open, Edit steps, Rename (F2), Move to feature ▸, Delete…
- **Grip handles**: rows have them. ⌥↑ / ⌥↓ move a row and announce "Moved to position n of m".
- **Filter matches** render bold and underlined (`<mark>` with a token style, not color alone).
- **Empty filter result**: the text `No flows match "<text>"` with the buttons "Clear filter" and
  "New flow '<text>'".
- **Deletes** open the existing alertdialog. For a feature, the body says "Its n flows will move to
  No feature." Confirming shows the 6 s toast "Deleted '<title>'" with Undo and the hint ⌘Z
  [FR-004].

## Recording and edit mode [FR-006–018, FR-022–030]

- **"+ New flow"** opens a small dialog, "New flow in <feature>", with a Name field and "Start
  recording". Empty name → the inline error "Enter a flow name".
- **Top-bar chip** (`status` region) sits in the centre of the top bar, where the view switcher from 010 and 011 will go (the top bar has no switcher yet):
  - "Recording '<name>' · n steps", or "Editing '<name>'", or "Editing '<name>' · adding branch
    after step n"
  - Buttons: "Undo last step" (⌘Z), "Done" (disabled with `aria-describedby` naming the reason),
    "Cancel" (Esc)
- **Left panel during a session**: the heading "NEW FLOW · <feature>" or "<FLOW> · STEPS", the
  name field, and the ordered `list` "Steps" with a count ("3", or "3 + 2 branches").
  - **Rows** [FR-019a]:
    - main line: the title, or "<from> → <to>"
    - second line: the connection label, then the condition
    - number badge
    - grip
    - remove button "Remove step n"
  - **Branch headers**: "◇ <label>", with an alert icon and the text "error path" when it is an
    error path.
  - **Hint card**: "Next: click an edge leaving <node>", or "Click an edge leaving <node>" for a
    new branch, or "This flow can't continue from <node>…".
  - **Keyboard legend**: ⌥↑↓ move, ⌫ remove, B add branch, Tab next candidate, ↵ use focused edge.
- **Canvas** [FR-007–010, FR-026, FR-031]:
  - It stays at full opacity.
  - Recorded edges show numbered badges.
  - The next start node has a ring and the tag "Step n starts here".
  - Candidate edges are dotted, and the hovered edge shows a dotted preview.
  - An invalid click flashes the edge dashed with a ban icon and opens a popover (role `dialog`,
    non-modal) titled "Can't add this edge as step n", with the text "It doesn't start at
    <node>." and the buttons "Add as branch from step k" (when allowed) and "Got it". The same
    text goes to the polite live region.
- **Keyboard**: Tab / Shift+Tab move between candidates (the name is announced) and Enter records.
  Esc cancels: it asks only if something was recorded or structurally changed.
- **B on a step**:
  - On a step inside a branch, it announces "Branches can only start from the main path." and
    does nothing.
  - On an earlier main step while branches exist, it announces "This flow already branches after
    step n."
- **Inspector while adding a branch**: "NEW BRANCH · LABEL" (required), "CONDITION" (required), and
  a `switch` "Error path" with the description "Draws dashed with an error icon". Done with empty
  fields → an inline error with an icon under each field, focus moves to the first one, and the
  branch is not saved [FR-023].
- **Done** [FR-016]: ends the session, selects the flow, and shows the toast "Saved flow '<name>' ·
  n steps".
- **Cancel in edit mode**: restores the structure after confirmation. Text edits stay (clarification
  Q1).

## Showing a flow, steps and branches [FR-018a, FR-019, FR-027, FR-031–033]

- **Clicking a flow row** makes it the active flow:
  - The left panel shows "<FEATURE> · FLOWS" and the step list.
  - The canvas marks its edges: numbered badges, a solid primary stroke for the happy path, dashed
    clay plus an alert icon for error paths.
  - Other elements keep their look (no dimming; that is 007).
- **Inspector for a flow**: Title, Description (markdown), Owner (combobox with suggestions),
  Feature (select, including "No feature"), and "Edit steps".
- **Inspector for a step**: the header "Step n · <from> → <to>", then Title, Description, Condition
  and SLA target. On the branch step it also shows "BRANCHES AFTER THIS STEP" as a list of buttons
  "<letter> · <label>", each with its condition.
- **Inspector for a branch**: Label, Condition, the Error path switch, and a "Delete branch…"
  button.
- **Text fields** save on Enter or blur and undo with ⌘Z, in or out of a session.
- **Broken step**: an alert icon plus "Connection deleted" in place of the second line, and the
  main line reads its title or "Unknown connection".
- **Chain break**: a dashed clay dot, an alert icon and the text "Doesn't start where step n
  ended".
- **JSON panel Selection tab**: labelled "Flow" or "Step", it shows `serializeEntry('flows', flow)`
  (step and branch views show the flow entry scrolled to the object).

## Announcements (polite live region)

- "Step n added: <from> → <to>"
- "Can't add <edge> as step n. It doesn't start at <node>."
- "Removed step n"
- "Moved to position n of m"
- "Branch '<label>' added after step n"
- "Recording cancelled"
- "Saved flow '<name>'"
