# Contract: Code panel UI (JSON | DBML | SQL)

Reference: design frames 137 and 166 (code panel only; §g-91), DESIGN.md tokens, `packages/ui`
controls. Component tests assert by role and label (constitution VI).

## Header

| Element             | Role / label                                        | Behaviour                                             |
| ------------------- | --------------------------------------------------- | ----------------------------------------------------- |
| Format tabs         | `tablist` "Code format": tabs "JSON", "DBML", "SQL" | Always all three (clarify Q2). Remembered (`format`). |
| Scope (JSON)        | segmented "Selection" / "Deck"                      | Unchanged.                                            |
| Scope (DBML, SQL)   | segmented "Selection" / "Whole schema"              | Shared `schemaScope`.                                 |
| JSON read-only text | "Read-only · synced with canvas"                    | JSON only.                                            |
| Close               | button "Close code panel"                           | Unchanged (overlay).                                  |

## DBML tab body

- Editable Monaco editor, accessible name "DBML schema".
- Empty scope: placeholder hint "Select tables, or switch to Whole schema. You can also type a new
  table here." (Selection) / "Type a table to start your schema." (Whole schema, no tables).
- Error and warning markers on their ranges; hover shows the message and suggestion.

## Footer (DBML)

| State                | Pill (icon + text)              | Helper text                          | Extra                |
| -------------------- | ------------------------------- | ------------------------------------ | -------------------- |
| `synced` / `applied` | ✓ "Applied"                     | "Edits apply as you type"            | Copy                 |
| `dirty`              | "Applying…"                     | "Edits apply as you type"            | Copy                 |
| `invalid`            | ⊗ "Can't apply: fix n error(s)" | "Canvas keeps the last valid schema" | Copy                 |
| `confirm`            | ⚠ "This removes all n tables"   |                                      | button "Apply", Copy |

- Warnings (no errors): pill stays "Applied", plus "n warning(s)" text.
- Pill text changes are announced through the app's live region (`announce`); never colour only.

## SQL tab

- Read-only Monaco, name "SQL schema"; read-only attempt announces "SQL is read-only here; edit
  DBML or the canvas" (3 s cooldown, as JSON).
- Generic deck: a "Preview dialect" select (Postgres / MySQL / SQLite) in the footer.
- Writer notes listed under the editor (same component as the export dialog notes).
- Footer: Copy.

## Keyboard

- ⌘Z / ⇧⌘Z / ⌘Y in either editor → deck undo / redo (also end the DBML burst).
- F8 / ⇧F8 → next / previous problem (Monaco).
- Esc → focus back to the canvas (unchanged overlay rule); unapplied DBML text is discarded.

## Toasts

- Apply that removes tables: Undo toast "Removed shipments" / "Removed n tables" with "Undo"
  (`showUndoToast`).
- Apply that restores from session memory: no toast.
