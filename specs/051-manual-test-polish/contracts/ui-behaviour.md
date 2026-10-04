# Contract: user-visible behaviour (051)

These contracts are checked with Testing Library through roles, labels and visible text. Where a Testing Library test cannot see the behaviour (CSS paint, timing), the contract says so and names the test style.

## C1 — Focus mode and hover (US1)

| Given                            | Action                                     | Expect                                                                                                               |
| -------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Focus mode off                   | `mouseenter` a card, wait 200 ms           | No `data-hover-focus` on the canvas wrapper. No node or edge has the dimmed state.                                   |
| Focus mode off                   | Select a card                              | No dimmed nodes or edges.                                                                                            |
| Focus mode off                   | Tab to a card                              | No `data-hover-focus`. The focus ring is shown.                                                                      |
| Nothing selected                 | Press F                                    | Focus mode is on: the toggle is pressed and the announcement says "Focus mode on". No "Select a component to focus". |
| Focus mode on, nothing selected  | Hover a card, wait 200 ms                  | `data-hover-focus` is set. The card's neighbours are lit, the rest dimmed (034 CSS).                                 |
| Focus mode on, one card selected | Hover another card                         | The pinned focus is unchanged and there is no `data-hover-focus`.                                                    |
| Focus mode on, one card selected | Click empty canvas (the selection empties) | Focus mode stays on, and hover works again.                                                                          |
| Focus mode on                    | Press F or click the toggle                | Focus mode is off. No dimming, no `data-hover-focus`.                                                                |
| Flow playing                     | Anything                                   | The flow look wins (unchanged). F is refused, as today.                                                              |

## C2 — Duplicate-drag (US2)

| Given                  | Action                               | Expect                                                                                                                                                  |
| ---------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A card at (x, y)       | Drag with ⌥ held, past the threshold | The original stays at (x, y), present in the doc. A second card with the same title exists at the pointer position. The wrapper has `data-duplicating`. |
| Duplicate-drag         | Drop                                 | Two cards. One undo removes the copy and leaves the original at (x, y). The copy is selected. "Duplicated 1 component" is announced.                    |
| Duplicate-drag         | Esc                                  | One card at (x, y). No undo entry is added.                                                                                                             |
| Duplicate-drag         | Window blur                          | Same as Esc.                                                                                                                                            |
| Plain drag in progress | Press ⌥                              | The original snaps back to (x, y) and a copy follows the pointer.                                                                                       |
| Duplicate-drag         | Release ⌥, then drop                 | One card, at the drop position (a plain move).                                                                                                          |
| 3 cards selected       | ⌥-drag one of them                   | 3 originals stay put and 3 copies move together. Edges between the selected cards are copied, as today.                                                 |
| Group frame            | ⌥-drag                               | The group and its members stay. A copied group with its members follows.                                                                                |

## C3 — Drag look (US4)

The CSS test reads `index.css`. Every `.dragging` rule for `.sd-card` and `.sd-shape-art` must contain no `rotate`. The lift (lip variable and Float shadow) is still present.

## C4 — Zoom detail (US3)

| Zoom              | Card shows (deck-node test, via text and roles)       |
| ----------------- | ----------------------------------------------------- |
| 100 %, 60 %, 51 % | title, type name, description, field chips, tag pills |
| 50 %, 31 %        | title. No type name, no description. Chips as dots.   |
| 30 %              | type icon plate only                                  |

`levelForZoom`: 0.30 → landscape, 0.31 → system, 0.50 → system, 0.51 → container, 1.50 → container, 1.51 → component. The hysteresis table is updated to match.

## C5 — Export options (US5)

| Action                                                     | Expect                                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Click a format's subtitle text                             | That radio is `checked` and the preview request changes.                                                |
| Click the row padding (the label element outside the text) | That radio is `checked`.                                                                                |
| Tab into the group, then press ↓                           | The next format is checked (Radix, unchanged).                                                          |
| Query `getByRole('radio', { name: 'PNG' })`                | Found. The accessible name is still the format name, and the description comes from `aria-describedby`. |

`packages/ui` radio-group test: clicking the `description` selects the item.

## C6 — Save indicator (US6)

All timings use fake timers.

| Sequence                                                           | Expect                                                          |
| ------------------------------------------------------------------ | --------------------------------------------------------------- |
| `pending`, then `saved` at +100 ms                                 | The indicator never shows "Saving…" and no spinner is rendered. |
| 30 keystrokes, 80 ms apart (each a `pending` → `saved` at +100 ms) | "Saving…" is never shown.                                       |
| `pending`, nothing for 1,000 ms                                    | "Saving…" is shown.                                             |
| `pending`, then `failed` at +50 ms                                 | The error state shows at once.                                  |

The persistence test confirms writes are unchanged: a write happens 100 ms after the first update.

## C7 — Packs (US7)

| Surface                                                                | Expect                                                               |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Packs panel rows                                                       | Basic shapes, Process, Data cards, Database, Architecture, Logistics |
| New deck                                                               | Logistics switch off. Add shows "Packs · 5 on". No Warehouse tile.   |
| Turn Logistics on                                                      | Its tiles appear, in the last tab or section.                        |
| Import a file with `logistics` in `packs`                              | Logistics is on.                                                     |
| `toJSON` of a deck with `packs: ['architecture', 'process', 'shapes']` | The same order is written (file order unchanged).                    |

## C8 — Library (US8)

| Expect                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------- |
| `queryByText('Persistent storage')` is null on the library page. There is no "Request persistent storage" button.          |
| `getByRole('button', { name: /^Import/ })` has the visible text "Import" and the name "Import deck file (.sododeck.json)". |
| The import flow is unchanged (the existing `import-button.test.tsx` passes).                                               |
