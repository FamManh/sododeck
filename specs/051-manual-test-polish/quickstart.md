# Quickstart: validate 051

## Prerequisites

- Node ≥ 24 and `pnpm install`.
- Branch `051-manual-test-polish`.
- Before any canvas change, record the baseline: `pnpm bench`, then save the output as `specs/051-manual-test-polish/bench-before.md`.

## Automated

```bash
pnpm --filter @sododeck/model test     # pack registry: display order, onByDefault, file order unchanged
pnpm --filter @sododeck/ui test        # radio item: description and row selection
pnpm --filter @sododeck/app test       # C1–C8 in contracts/ui-behaviour.md
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
pnpm bench                             # compare with bench-before.md (≤ 5 % regression on zoom/pan fps)
```

## Manual walk-through (`pnpm dev`, then open http://localhost:5173)

1. **Focus (US1)**
   - Open a deck. Hover and select cards: nothing dims.
   - Press F with nothing selected, then hover a card: its neighbours light up and the rest dims.
   - Select a card: the focus stays on it while you hover elsewhere.
   - Press F: everything is back to normal.
2. **Duplicate-drag (US2)**
   - Hold ⌥ (Alt on Windows) and drag a card: the original stays and a copy follows. Drop the copy, then press ⌘Z: only the copy disappears.
   - Repeat and press Esc mid-drag: nothing changes.
   - Start a plain drag, then press and release ⌥ mid-drag: the drag switches between copy and move.
3. **No tilt (US4)**: drag a card and a shape. They lift (shadow) but never rotate.
4. **Zoom (US3)**: zoom to 60 %: the type name and description are visible. At 45 %: compact cards with title only. At 25 %: icons only.
5. **Export (US5)**: open Export and click each format's subtitle text. Each one selects.
6. **Save (US6)**: type a long card title. The indicator stays on "Saved" without spinning. Reload right after the last key: the title is complete.
7. **Packs (US7)**
   - Create a new deck and open Add, then Packs: the order is Basic shapes, Process, Data cards, Database, Architecture, and Logistics is off.
   - Open an older deck that uses Logistics: it is unchanged.
8. **Library (US8)**: there is no "Persistent storage" card, and the import button reads "Import".

Capture a screenshot of each step for the PR (Definition of done: UI work is demonstrated).
