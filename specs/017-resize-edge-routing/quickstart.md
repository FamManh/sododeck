# Quickstart: Resize Cards and Route Connectors (017)

This is a manual validation guide. Unit and component tests cover the behaviour automatically. There is no new e2e test (constitution VI). Roles, names and texts are listed in the [contract](contracts/resize-routing-ui.md), and the field rules in the [data model](data-model.md).

## Setup

```bash
pnpm install
pnpm dev            # app on http://localhost:5173
```

Open the demo deck, or import `packages/schema/examples/full.sododeck.json`, which has a sized component and a routed connection. For scenario 7, also import a deck exported from `main` before this feature.

## Scenarios

1. **Resize**:
   - At the default zoom, select one card and drag its bottom-right handle by about (80, 30).
   - Expect: the readout shows `244 × 80`, connections stay attached, and the JSON panel shows `"size": { "width": 244, "height": 80 }`. One ⌘Z restores the card and removes `size`.
2. **Modifiers and limits**:
   - Resize with ⇧: the ratio is kept. Resize with ⌥: the card changes around its centre.
   - Move an edge near a neighbour's edge: a guide shows and the edge snaps. Hold ⌘: no snapping.
   - Shrink the card past the minimum: it stops at 120 × 44. Grow it past the maximum: it stops at 800 × 600.
   - Press Esc mid-drag: the card goes back to its previous size, with no undo entry.
3. **Reset and text**:
   - Double-click a handle: the card returns to the level default size and `size` is gone.
   - Give a card a long title, then enlarge it: the title wraps onto more lines at the same font size.
   - Zoom from the system level to the component level: a resized card keeps its size, and an untouched card changes as today.
4. **Group frame**:
   - Resize a member card past its group frame: the frame does not change and the card overhangs it.
   - Resize the frame (016): it cannot shrink past the enlarged card.
5. **Segment**:
   - Select a connector between two stacked cards and drag its middle handle 60 px right.
   - Expect: the ghost of the automatic route, the readout `+60`, and `route.offset: 60`. The label and step badges move with it. With a flow open, the highlight and token follow the new path.
   - It passes over other cards freely.
   - Press R mid-drag: the route resets in one step.
6. **Ends and reset**:
   - Drag the source end onto the top of its own card. Expect: four side targets with the nearest one hot, a dashed live path, then `route.fromSide: "top"`.
   - Drag an end to another card: it reconnects (003 rules), that side is pinned, and the offset is cleared.
   - Press Esc during an end drag: nothing changes.
   - Choose Reset route in the connection toolbar: `route` is gone. Reset route is disabled when the route is automatic.
   - Pin two sides at right angles: there is no middle handle, and the Offset field is disabled.
7. **Old decks and round trip**:
   - Open a deck from before 017: it looks the same.
   - Edit a title and export: the file has no `size` or `route`.
   - Import `full.sododeck.json`, then export it: the sizes and routes are unchanged.
   - Import a deck with `"size": { "width": 900, "height": 40 }`: it opens, the card is drawn clamped, and Problems lists "Card size out of range".
8. **Keyboard**:
   - Focus a card and press ⌘⇧→ four times: it is 16 px wider. One ⌘Z restores it.
   - Select a connector and press ⌥⇧↓ twice: the segment moves 20 px (one undo step).
   - In the drawer, type W 240, set From side = Top, and set Offset = −30. Each commit is one undo step. Check the announcements.
9. **Views, layout, export**:
   - In a view with its own positions, resize a card: the size is the same in every view.
   - Run Tidy: cards keep their sizes, the layout respects them, and pinned sides stay.
   - Export PNG and SVG: the sizes and routes match the canvas.
   - The library thumbnail shows the resized card.
10. **Modes**:
    - In flow mode, during recording, and in view-only (window < 1024 px), there are no handles and no size or route keys. Stored sizes and routes are still drawn.

## Definition of done

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
pnpm bench                       # before (main) and after, incl. the resized-routed scenario
```

Record the bench numbers in `bench-before.md` / `bench-after.md`. Record the visual comparison with frames 100 (Reset route), 112, 113 and 114 (light and dark) in `visual-check.md`.
