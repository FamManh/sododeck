# Contract: user-visible UI (009)

This contract fixes the roles, accessible names and visible text that component tests assert (constitution VI: query by role and label).

Visual targets are in `docs/design/screens/`:

- 14 (palette STRUCTURE › Note)
- 30, 31, 32 (command palette)
- 62, light and dark (stickies)

63 is deferred until after 007. Exceptions to the design:

- Notes have no title field; the first line is the heading (research R4).
- The command labels follow research R10.
- The theme command toggles the resolved theme.

## Palette card (left panel, STRUCTURE)

- A `button` "Note", with the secondary text "Markdown, 180 px". It is draggable, with the kind MIME `note`. Clicking it adds a free note at the view centre in edit mode.
- Help text under STRUCTURE: "Drag Note onto a node to pin it, or onto empty canvas for a free note. N adds one at the pointer."

## Sticky note on the canvas

| Part            | Role / structure                                                     | Accessible name / text                                                           |
| --------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Card            | focusable `group` (React Flow node), `aria-roledescription="note"`   | "Note: <label>" (+ ", pinned to <node>" \| ", collapsed"); blank → "Note: empty" |
| Collapse toggle | `button`, `aria-expanded`                                            | "Collapse note" / "Expand note"                                                  |
| Body (expanded) | markdown rendered as elements (`p`, `ul/li`, `strong`, `em`, `code`) | —                                                                                |
| Collapsed line  | text, ellipsis                                                       | the label                                                                        |
| Pinned footer   | text with pin icon                                                   | "Pinned to <node title>"                                                         |
| Edit mode       | `textbox` (multiline)                                                | "Note text"                                                                      |
| Leader          | dotted line + pin glyph, `aria-hidden`                               | —                                                                                |

**Keys on a focused or selected note:**

- Enter / F2 / double-click: edit.
- Esc: leave edit mode, or clear the selection.
- ⌥C: collapse or expand.
- Arrows: nudge by 8 px (Shift: 32 px).
- Delete / Backspace: delete (asks first).
- **N** on the canvas adds a note (not while typing, not during a flow session).

**Announcements (polite):**

- "Note added" / "Note added, pinned to <node>"
- "Empty note removed"
- "Note pinned to <node>" / "Note unpinned"
- "Note collapsed" / "Note expanded"

## Sticky inspector (`aria-label="Inspector"`)

- **Header**: note icon, `heading` = label (or "Note"), subtitle "Note · pinned to <node>" \| "Note · free", `button` "Delete note".
- **TEXT · MARKDOWN**:
  - `radiogroup` "Note text view" (Write / Preview).
  - Write: `textbox` "Note text".
  - Empty preview: "Nothing to preview."
- **ANCHOR**: `radiogroup` "Anchor" with Free / Pinned to node.
- **PINNED TO**:
  - `combobox` (pick mode) "Pinned to", with options = components by title. Placeholder "Choose a component".
  - Help text: "Moves with the node. Unpin keeps it where it is."
  - For a foreign anchor: read-only text "Pinned to <object kind> <title>" plus `button` "Unpin".
  - For a missing anchor: "Pinned object is missing" (icon + text) plus `button` "Unpin".
- **DISPLAY**: `radiogroup` "Display" with Expanded / Collapsed.
- **Stay visible during flows**: `switch` "Stay visible during flows", with the description "Off: dims to 35% unless its node is on the current step".

## Outline

- A section `heading` "Notes · n" (collapsible `button` "Notes", with `aria-expanded`) holding a `list` of notes.
- Each item is a `button` labelled with the note's label, or "Empty note". Choosing one selects the note and brings it into view.
- The section is hidden when n = 0.

## Delete (existing dialog and toast)

- Dialog `heading`: "Delete this note?" / "Delete <n> notes?"; confirm `button` "Delete".
- Toast: "Note deleted · ⌘Z to undo" (Ctrl+Z off Apple), with `button` "Undo".
- When a component with pinned notes is deleted, the dialog adds "<n> pinned note(s) will stay on the canvas, unpinned." and the toast adds " · <n> note(s) unpinned".

## Top bar

- A `button` "Jump to…" with a kbd hint of ⌘K (Ctrl K off Apple). Accessible name: "Jump to… (⌘K)". It has `aria-haspopup="dialog"`.

## Command palette (design 30–32)

| Part        | Role / structure                                                                                   | Name / text                                                                                                                              |
| ----------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Dialog      | `dialog` (modal)                                                                                   | "Jump to"                                                                                                                                |
| Input       | `combobox`, `aria-expanded="true"`, `aria-controls` → listbox, `aria-activedescendant` → highlight | "Search the deck"; placeholder "Jump to a node, flow or command"                                                                         |
| Esc hint    | kbd                                                                                                | "esc"                                                                                                                                    |
| List        | `listbox`                                                                                          | "Results"                                                                                                                                |
| Row         | `option`, `aria-selected` on the highlighted row                                                   | "<title>, <kind · context>" (+ ", <snippet>")                                                                                            |
| Row meta    | right-aligned text                                                                                 | "Command" · "Service · Core services" · "Flow · 8 steps" · "Step 4 · Place order" · "Rule · First match" · "Note" · "Connection · A → B" |
| Snippet     | second line under the title (body matches only)                                                    | "…text with **match**…". The match is shown in bold and underlined                                                                       |
| Overflow    | text at the end                                                                                    | "Showing 50 of <n>"                                                                                                                      |
| Empty       | text (design 32)                                                                                   | "No results" + "Try a different word."                                                                                                   |
| Footer      | hint row                                                                                           | "↵ open · esc close"                                                                                                                     |
| Live region | `status`                                                                                           | "<n> results" / "No results" (debounced)                                                                                                 |

**Behavior:**

- ⌘K / Ctrl+K opens the palette, or closes it when open. The top-bar button also opens it.
- When opened, the input is focused and empty, and the highlight is on row 1.
- With an empty query, the list shows commands (in order: Export deck…, Toggle dark mode, Toggle focus mode (only when available), Open rule editor, Go to library, New deck), then flows.
- ↑ / ↓ move the highlight without wrapping; Home / End also work. Enter opens the highlighted row and does nothing when there are no results. Hover moves the highlight, and a click opens the row.
- Esc, or a click outside, closes the palette and returns focus to the element that had it.
- Opening a row closes the palette and moves focus to the target (research R11).
- If the target no longer exists, "This item no longer exists" is announced and the palette stays open.
- Command aliases: "Switch theme" also matches "theme"; "Open rules" also matches "rules".
