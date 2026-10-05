# Quickstart results (055)

Run on 2026-10-05 in Chrome against `vite` (dev server, port 5199), a fresh deck. Pictures were
generated in the page with a canvas (gradient PNG / JPEG), and pasted and dropped with synthetic
`ClipboardEvent` / `DragEvent` carrying real `File` objects, so the real OS clipboard and file picker
were **not** exercised. Screenshots: `screenshots/`.

| #   | Step                  | Result                                                                                                                                                                                                                                                                                                                                        |
| --- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Gate                  | Pass: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` (one timing test, `connector-geometry` "20-bend path", failed once under parallel load and passes alone; lint has 1 warning, `canvas.tsx` fast-refresh, present before 055). Rerun of lint, typecheck and app tests after the last fixes: green (app 4,783 tests). |
| 2   | Paste (US1)           | Pass after a fix (see below): a pasted PNG appears selected, `Added 1 image.` with Undo; reload keeps it (`01`). ⌘Z / ⌘⇧Z covered by component tests, not clicked in the browser.                                                                                                                                                             |
| 3   | Upload and drop (US2) | Drop: pass. A dropped `.txt` + PNG gives `notes.txt: type not supported (use PNG, JPEG, WebP, GIF, SVG or AVIF). Added 1 image.` The Add flyout shows the Image tile; the native file picker was **not** opened (cannot be driven here).                                                                                                      |
| 4   | Limits                | Partly: a 1800 × 1200 noisy PNG (7.4 MB) is refused (`still 7.1 MB after compression; the limit is 5 MB.`) and an SVG with `<script>` is refused (`SVG contains scripts or outside links and was not added.`); nothing was added. A file over 10 MB was **not** tried (unit-tested).                                                          |
| 5   | Compression           | Pass: a 6000 × 4000 JPEG (345 KB) is stored as 2048 × 1365 (44 KB blob row); a 120 × 80 PNG stays 120 × 80. Pasting both took about 2.3 s. AVIF was **not** tried.                                                                                                                                                                            |
| 6   | Work with it (US3)    | Partly: drag moves an image, selection toolbar shows alt / caption / stacking / lock / delete. Resize by a corner, connectors, groups and lock were **not** clicked in the browser (component tests cover them).                                                                                                                              |
| 7   | Stacking              | Pass: a card added after the images is drawn above them; a selected image is raised only while selected (`02`). Send backward and the image-below-every-card case were **not** clicked (unit tests).                                                                                                                                          |
| 8   | Round trip            | **Not verified in the browser** (needs a file download and a second profile). Covered by `library-ops` and model round-trip tests (byte-identical re-export, missing asset opens with a placeholder). The export dialog shows the JSON with pictures at 165.7 KB (`03`).                                                                      |
| 9   | Export                | Pass: the PNG preview (768 × 528 px, 2×) and the SVG preview (276 KB) draw the images in order with the card on top (`04`, `05`). The exported SVG file was not opened on its own; the preview renders it as a self-contained image, and `render-svg` tests assert no external reference.                                                     |
| 10  | Privacy               | `pnpm e2e` smoke (no-third-party-requests) passes. In DevTools the app made no cross-origin requests; the only third-party hits (`my.productfruits.com`) come from a browser extension, not the repo. Pictures load from `blob:` URLs.                                                                                                        |
| 11  | Perf                  | See `bench-before.md` / `bench-after.md`.                                                                                                                                                                                                                                                                                                     |
| 12  | Cleanup               | Pass: after deleting an image and reloading, its blob row is gone (4 rows → 3). Removing a stored picture and reloading shows the "Picture missing" placeholder with the file name (`06`). Deleting a whole deck and restarting was **not** tried (unit-tested in `blob-store.test.ts` / `purgeDeleted`).                                     |

## Bugs found in this run (fixed, each in its own commit)

1. **Every picture was refused as "could not read this image".** The picture worker named
   `HTMLImageElement` / `HTMLCanvasElement` in `instanceof` checks, which throw a ReferenceError in a
   worker; decode swallowed it and returned "unreadable". Fixed by duck typing (`image-ops.ts`) with
   a unit test; the paths had no browser coverage before.
2. **"Start your diagram" stayed on top of a deck that only held pictures.** The empty-canvas card
   looked at cards and groups only. Fixed with a canvas test.
3. **Dragging cards dropped from 59 to about 48 FPS** (found by the bench, bisected to the Add flyout
   commit): `useAddImages()` was a dependency of the canvas handlers, so they were rebuilt whenever a
   toast or viewport helper changed. It is now read through a ref.

## Not verified

Native file picker, real clipboard paste, AVIF, files over 10 MB, a JPEG with EXIF rotation, the
export / import file round trip in a second profile, multi-tab sync in two real tabs, undo and redo
by keyboard, resize, connectors, groups, and the SVG file opened alone.
