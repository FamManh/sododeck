# Quickstart: Canvas Editing (016)

A manual validation guide. Automated coverage is in unit and component tests. Per the [contract](contracts/canvas-editing-ui.md), there is no new e2e test.

## Setup

```bash
pnpm install
pnpm dev            # app on http://localhost:5173
```

Open the demo deck, or import `packages/schema/examples/full.sododeck.json`. For scenario 8,
import a deck saved before this feature, such as `main`'s `apps/app/src/editor/demo-deck.ts` export.

## Scenarios

1. **Copy / paste**:
   - Select three connected components where one of them also connects to an outside component. Press ⌘C, move the pointer to empty space, then press ⌘V.
   - Expect: 3 new components and 2 new connections at the pointer, and the outside connection is not copied. The new objects are selected and have new ids in the JSON panel. One ⌘Z removes them all.
2. **Cross-deck**:
   - Copy in deck A. Open deck B in a second tab and press ⌘V.
   - Expect: the objects appear in B, and A is unchanged.
   - Put plain text on the clipboard and press ⌘V. Expect: nothing is pasted. The canvas menu shows Paste disabled with its tooltip.
3. **Duplicate and ⌥-drag**:
   - Press ⌘D. Expect: a copy at +24/+24.
   - ⌥-drag a card. Expect: the original stays, and a copy lands at the drop point. One undo step each.
4. **⌘G**:
   - Select 4 cards and press ⌘G, then type "Payments" and press Enter.
   - Expect: a frame fitted around the cards, with `group.position` / `group.size` and each card's `group` in the JSON panel.
   - Press ⌘Z twice. Expect: the rename is undone, then the group.
5. **Frame drag and resize**:
   - Drag the "Payments" label by about (100, 40). Expect: the frame, the members and the nested groups all move, a ghost and a readout show during the drag, and one ⌘Z restores them.
   - Esc during a drag: expect everything back and no undo entry.
   - Drag the bottom-right handle. Expect: no card moves.
   - Try to shrink the frame past its members. Expect: it stops at members plus padding.
   - Use the drawer's Frame W/H fields: expect the same resize.
6. **Drop into / out**:
   - Drag a card over another frame. Expect: the dashed orange highlight and the "Drop into …" chip. Release, and it joins that group; the frame does not grow.
   - Drag it out onto empty canvas. Expect: it leaves the group.
   - Repeat with ⌥ held. Expect: membership is unchanged.
   - Drag a group into another frame. Expect: it nests, with an Undo toast.
7. **Align and snapping**:
   - Select 3 cards. Use Align left (⌥A), then Distribute horizontally. Expect: equal x, then equal gaps.
   - Drag a card near another card's centre. Expect: a guide within 6 screen px, a snap, and a distance label.
   - Hold ⌘. Expect: no snap.
   - Press ⌥⇧→ three times, then ⌘Z. Expect: it moves 30 px, and one undo restores it.
8. **Old decks**:
   - Open a deck saved before 016. Expect: groups look as before at full detail, the JSON now shows the frames, and ⌘Z does nothing (no undo entry for the fitting).
9. **Views**:
   - In a non-base view with its own positions, move a group frame. Expect: the base view's frame is unchanged, and the view's `groupFrames` in the JSON panel.
10. **Marquee**:
    - Shift+drag across cards. Expect: a count chip, and with ⌥ the touched cards are included too.
    - Esc during the marquee. Expect: the previous selection is restored.
    - The hint bar shows during each gesture.
11. **Modes**:
    - In flow mode or view-only (window < 1024 px), expect Copy to work, and cut, paste, group, align, nudge, snapping and frame edits not to be available.

## Definition of done

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
pnpm bench                       # before (main) and after; BENCH_GROUPS=1 for group-drag
```

Record the bench numbers in `bench-before.md` / `bench-after.md`, and the visual comparison with 92, 99, 102–104 and 108–111 in `visual-check.md`.
