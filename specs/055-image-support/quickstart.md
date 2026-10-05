# Quickstart: validate image support (055)

Prerequisites: `pnpm install`; Node ≥ 24; Chromium for manual checks. Test pictures: any PNG, JPEG,
WebP, GIF, AVIF, SVG, plus a >10 MB file, a 6 MB noisy PNG, an SVG containing `<script>`.

1. **Gate**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e`.
2. **Paste (US1)**: `pnpm dev`, open a deck, copy a screenshot, focus the canvas, ⌘V. An image object
   appears selected; reload keeps it; ⌘Z removes it, ⌘⇧Z restores it with its picture.
3. **Upload and drop (US2)**: Add flyout → Image → pick two PNGs: two objects in a row, one undo step.
   Drop one file; drop a `.txt` and see the refusal text.
4. **Limits (SC-004)**: add the >10 MB file, the 6 MB noisy PNG and the SVG with a script: each is
   refused with its message; nothing is added; the deck is unchanged.
5. **Compression (FR-005)**: add a 6000×4000 JPEG: stored pixel size ≤ 2048 on the long edge (inspector
   shows it); a small PNG is stored unchanged.
6. **Work with it (US3)**: resize by a corner (ratio holds), draw a connector to a card, put the image in a
   group and move / collapse / lock the group, edit alt text and caption.
7. **Stacking (FR-020)**: paste an image, add a card on it (card above); paste another image (on top);
   Send backward moves it under the card; an image below every card sits under the connectors.
8. **Round trip (US4, SC-003)**: export `.sododeck.json`, open a fresh browser profile, import: all images
   and pictures return; the file re-exports byte-identical. A copy with one `assets` entry removed opens
   with a "Picture missing" placeholder and one notice.
9. **Export (US5)**: PNG and SVG exports show the images in order; open the SVG alone: images still show.
10. **Privacy (SC-007)**: `pnpm e2e` smoke passes; DevTools Network shows no request for pictures.
11. **Perf (SC-008)**: `pnpm bench` before (on `main`) and after; record both in the report. Add a 50-image
    deck and pan / zoom.
12. **Cleanup (FR-011)**: delete an image, reload the deck, check the blob row is gone (Dexie viewer);
    delete the deck, restart the app, no rows remain for it.
