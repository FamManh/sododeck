# Contract: UI (062)

No design frame exists for these surfaces. They reuse existing components (`Dialog`, `Button`,
toast, the 044 import report panel's list layout) and design tokens only. English copy below is
final unless DESIGN.md wording rules say otherwise.

## Import problems dialog (`apps/app/src/library/import-problems-dialog.tsx`)

Opened from: library import (button, drop), editor deck menu "Import…", in two modes.

| Part    | Refused mode                                                                                                                          | Opened mode                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Title   | `Couldn't open "<file name>"`                                                                                                         | `"<deck name>" opened with problems`                  |
| Summary | `<n> problems. Nothing was added.`                                                                                                    | `<n> problems. The deck opened unchanged.`            |
| List    | one row per entry, ≤ 500 rows, then `and <m> more`                                                                                    | same                                                  |
| Row     | severity icon (shape + text, not colour only) · message · location (`/nodes/3/title` or `line 14, column 5`) · fix hint in muted text | same                                                  |
| Actions | **Copy problems** (primary), **Close**                                                                                                | **Copy problems**, **Open deck** (primary), **Close** |

- Accessible name = title; list is a `list` with `listitem`s; Esc closes; focus starts on the
  primary button.
- Copy success: toast `Copied problems` (polite live region). Copy failure: a read-only text
  area labelled `Problems as JSON` appears under the list, focused with all text selected, plus
  the existing `Couldn't copy — select the text and press ⌘C / Ctrl+C` hint.

## Import toast

- No problems: unchanged (`Imported "<name>"`).
- With `error`/`warning` entries or damaged pictures: `Imported "<name>" with <n> problem(s)`
  - action **Show** → opened-mode dialog. Replaces today's "N pictures are missing" sentence.
- Refused: no toast; the refused-mode dialog opens. Several files at once: unchanged toast.

## Problems panel

- Header gains an icon button **Copy problems** (lucide `copy`, accessible name "Copy
  problems"), disabled when the list is empty. Same success/failure behaviour; the fallback text
  area opens in a small popover anchored to the button.

## Fidelity report (Mermaid dialog `import-report-view.tsx`, DB `import-report-panel.tsx`)

- Items are grouped under headings in this order: **Merged**, **Collapsed**, **Left out**,
  **Not supported**; a heading shows its count; empty groups are hidden.
- With no items: `Everything was imported.` in place of the lists.
- **Copy report** button next to the counts; same success/failure behaviour.
- Existing per-reason collapse (044: 20 rows then "and n more …") is kept inside each group.
