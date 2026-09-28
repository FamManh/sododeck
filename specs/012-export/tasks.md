# Tasks: Export

**Input**: design documents in `specs/012-export/`:

- [plan.md](plan.md) and [spec.md](spec.md). The spec was clarified on 2026-09-28: JSON is always
  the whole deck (scope disabled for JSON); only JSON, PNG and SVG ship.
- [research.md](research.md) (R1–R13) and [data-model.md](data-model.md).
- [contracts/export-ui.md](contracts/export-ui.md).
- [quickstart.md](quickstart.md).

**Tests are required.** Constitution VI asks for unit tests (Vitest) for every pure module and
store, and component tests (Testing Library) that query by role and name as given in
[export-ui.md](contracts/export-ui.md). Write each test first and watch it fail. Do not add
Playwright tests; the smoke suite must pass unchanged.

**Scope guards**:

- No change to `packages/schema` or `packages/model`. `packages/ui` only gains `lib/embedded-fonts.ts` (T021). No new dependency.
- Export only **reads** the deck (`useDeckSnapshot` / `readDeck`) and UI-store values. No document
  writes, nothing in undo history.
- Never call `toFlowNodes` / `toFlowEdges` from export (their module caches serve React Flow, R1).
  Export only cache-free helpers from canvas files.
- No network: fonts are inlined with Vite `?inline`; no `fetch`, no external `href`.
- Direct backup exports stay as they are: `save-status.tsx`, `deck-inspector-storage.tsx` and the
  library deck menu keep `useExportDeck()` / `exportDeckFile`.
- No PDF, no Mermaid. The format list is data-driven so they can be added later, but do not add
  placeholders for them.
- 017 / 020 are not merged: put `TODO(017)` in `edgePath()` / card size lookup and `TODO(020)` in
  the card fill / stroke lookup; nothing else.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: US1–US5 from spec.md.

## Path Conventions

- **App**: `apps/app/src/…`, tests next to the code (`*.test.ts(x)`). New code goes in
  `apps/app/src/editor/export/`. Read `apps/app/CLAUDE.md` first; canvas recipes are in
  `.agents/skills/react-flow/SKILL.md`.
- Shared test harnesses: `apps/app/src/test/` (e.g. `render-library.tsx`, in-process clients).
  Bench deck generator: `generateBenchDeck(nodes, edges, seed, { flows, groups, stickies, views })`
  in `apps/app/src/bench/generate-deck.ts`.
- `packages/ui` imports are by subpath: `@sododeck/ui/components/dialog`,
  `…/components/radio-group`, `…/components/segmented-control`, `…/components/switch`,
  `…/components/button`, `…/components/tooltip`, `…/components/toast`, `…/lib/icons`,
  `…/lib/focus`.
- **Commits**: after each task or logical group, Conventional Commits (`feat(app): …`,
  `test(app): …`, `docs: …`). No AI attribution lines.

---

## Phase 1: Setup

- [ ] T001 Create branch `012-export` from the latest `main`. Run `pnpm install && pnpm test` to confirm a green start.
- [ ] T002 Run `pnpm bench` on the unchanged code and save the result table in `specs/012-export/bench-before.md`.
- [ ] T003 [P] Write ADR `docs/decisions/0016-export-rendering.md` in the header format of `0014-canvas-first-shell.md`. It records: static SVG from a derived scene instead of DOM capture (R1, with the rejected alternatives); light-only images (R2); embedded Geist fonts via `?inline` data URLs (R4); PNG from SVG on the main thread and the canvas size limits (R5); icon geometry copied from lucide with a drift test (R7); main-thread generation with the < 50 ms budget and the worker fallback (R8); JSON compact / `withoutKnowledge` without a model API change (R9). Note that 0015 is reserved by the 019 plan.

---

## Phase 2: Foundational (blocks every user story)

- [ ] T004 [P] Add `exportDialog: { open: boolean; returnFocus: HTMLElement | null }` (default closed, `null`), `openExport(returnFocus?: HTMLElement | null)` and `closeExport()` to `apps/app/src/state/ui-store.ts`, following the existing `palette` / `openPalette` / `closePalette` pattern; make `resetForDeck` close it. Tests in `apps/app/src/state/ui-store.test.ts`: open stores the return target, close clears it, `resetForDeck` closes.
- [ ] T005 [P] Write `apps/app/src/editor/export/export-file-name.ts` (+ `export-file-name.test.ts`) (R10): `exportFileName(deckName: string | undefined, flowName: string | null, format: ExportFormat): string` — NFC-normalise, lower-case, keep `\p{L}` / `\p{N}`, replace every other run with one "-", trim "-", cut to 80 characters, fall back to `untitled-deck`, append `-<flow slug>` when `flowName` is given (flow slug with the same rules, skipped if empty), extensions `.sododeck.json` / `.png` / `.svg`; and `formatBytes(bytes: number): string` (`"812 B"`, `"11.9 KB"`, `"1.2 MB"`, 1 KB = 1,024 B, one decimal). Also export the `ExportFormat = 'json' | 'png' | 'svg'` and `ImageScope = 'deck' | 'view' | 'flow'` types from a new `apps/app/src/editor/export/types.ts`. Tests: "Logistics Delivery" → `logistics-delivery.sododeck.json`; "Place order" flow → `logistics-delivery-place-order.png`; "Giao hàng nhanh" keeps the Vietnamese letters; "注文フロー" keeps the characters; "🚀 !!!" → `untitled-deck.svg`; empty / undefined → `untitled-deck`; 200-character name is cut to 80 before the extension; byte formatting boundaries (1023, 1024, 12186, 1.5 MiB).
- [ ] T006 [P] Add `downloadBlob(fileName: string, blob: Blob): void` to `apps/app/src/storage/download.ts` (temporary `<a download>` + object URL, revoked after the click) and make `downloadText` call it with a `Blob([text], { type: mime })`. Extend the existing download test (or add `download.test.ts`): `downloadText` still produces the same file name and MIME type; `downloadBlob` revokes its URL.
- [ ] T007 [P] Create `apps/app/src/lib/clipboard.ts` (+ `clipboard.test.ts`) with `copyText(text: string): Promise<boolean>`: returns `false` when `supportsClipboardWrite()` is false or `navigator.clipboard.writeText` rejects, `true` otherwise. If 019 has already added this file with the same function, reuse it and skip this task. Then replace the inline copy code in `apps/app/src/editor/json-panel-header.tsx` with `copyText` (keep its existing toast texts); its tests must stay green.
- [ ] T008 Write `apps/app/src/editor/export/export-dialog-state.ts` (+ `export-dialog-state.test.ts`) per [data-model.md](data-model.md) "Dialog state": `ExportOptions`, `ExportDialogState`, `ExportResultState`, `initialExportState({ flowMode: boolean }): ExportDialogState` (FR-004: outside flow mode `format: 'json'`, `imageScope: 'deck'`; in flow mode `format: 'png'`, `imageScope: 'flow'`; option defaults JSON include + pretty on, PNG 2× and not transparent, SVG not transparent), and `exportReducer` with actions `format`, `scope`, `option`, `flowGone`, `clampScale(max)`, `preparing(key)`, `settled(key, result | 'empty' | 'error')`, `retry`. Rules: `settled` is ignored unless `key` matches the current `result.key`; switching to JSON and back keeps `imageScope` (FR-007); `flowGone` sets `imageScope: 'deck'` and `scopeNote: 'flow-deleted'`; `scope: 'flow'` is ignored when the reducer was told there is no active flow. Tests for every transition in the data-model table.
- [ ] T009 Write the dialog shell `apps/app/src/editor/export/export-dialog.tsx` (default export for `React.lazy`, plus a named `ExportDialog`) using `Dialog` / `DialogContent` (className `w-[820px] max-w-[calc(100vw-32px)] p-0`), `DialogHeader`, `DialogTitle` "Export deck", `DialogDescription` "Exports are generated in your browser. Nothing is uploaded.". Layout per frames 06 / 33 / 34: left column (280 px) with the format list, right column with "Scope" heading + scope `SegmentedControl`, a preview region (`role="region"`, `aria-label="Preview"`, 250 px tall), the options area, and a footer (file icon + mono file name, size hint, Copy, primary Download). Read open state from `useUiStore` (`exportDialog`), close with `closeExport()` and return focus to `returnFocus` (or the canvas element when `null`) on close. The format list is a `RadioGroup` named "Format" rendering one card per entry of a `FORMATS` array in `apps/app/src/editor/export/formats.ts` (`{ id, label, subtitle, icon }`: JSON `Braces` ".sododeck.json · re-importable", PNG `Image` "Raster image for docs and slides", SVG `PenTool` "Vector, editable in Figma"), subtitle linked with `aria-describedby`; selected card uses the primary-soft style from the frames. Use tokens only (no hard-coded colours). In this task the preview and footer render from props so they can be tested; generation comes in the stories. Component test `export-dialog.test.tsx`: dialog name and description, three radios, Close button closes and returns focus.
- [ ] T010 Mount the dialog: in `apps/app/src/editor/shell/shell-chrome.tsx` render `const ExportDialog = lazy(() => import('../export/export-dialog'))` inside `<Suspense fallback={null}>` only while `exportDialog.open`; after the editor is idle (`requestIdleCallback` when available, else `setTimeout(…, 2000)`) call the same `import()` once to prefetch the chunk (R8). Test in `shell-chrome` tests (or a new `export-dialog-mount.test.tsx`): opening the store flag renders the dialog.

**Checkpoint**: the store can open an empty Export dialog; nothing calls it yet.

---

## Phase 3: User Story 1 — Download the deck as a file that can be imported again (P1) 🎯 MVP

**Goal**: the three Export entry points open the dialog; JSON (whole deck) can be previewed, copied and downloaded with both options.

**Independent test**: open the dialog on a sample deck, download JSON with default options, import it, compare with the original (quickstart 1–2).

- [ ] T011 [P] [US1] Write `apps/app/src/editor/export/json-export.ts` (+ `json-export.test.ts`) (R9): `withoutKnowledge(file: SododeckFile): SododeckFile` (pure, returns a new object; removes `description` from the deck, nodes, groups, edges, features, flows, branches and steps; `links` from nodes, edges, flows and steps; `rules` and `ruleInputs` from steps; `rules` from nodes; sets `rules: {}`; keeps notes, payloads, conditions, SLA targets, stickies, views); `jsonExport(file, { includeKnowledge, pretty }): { text: string; bytes: number }` (`serializeDeck` for pretty; `JSON.stringify(JSON.parse(serializeDeck(…)))` for compact; `bytes` via `TextEncoder`). Tests: default options are byte-identical to `serializeDeck(file)`; compact has no newline/indent and parses to the same value; round-trip `fromJSON(text)` → `toJSON` equals the input for every sample deck and for `generateBenchDeck(60, 90, 7, { flows: 3, groups: 4, stickies: 4, views: 2 })` with descriptions, links and rules added; `withoutKnowledge` output passes `parseSododeckFile` with `ok: true` for those decks and contains no `description` / `links` / rule references; the input object is not mutated.
- [ ] T012 [US1] Write `apps/app/src/editor/export/use-export-result.ts`: a hook `useExportResult(state, dispatch, inputs)` that computes the request key (format + that format's options + for images the scope and its UI values + deck snapshot identity), dispatches `preparing(key)`, waits 150 ms (debounce, cancelled on key change), then generates and dispatches `settled(key, …)`. In this task handle JSON only: `readDeck`-equivalent snapshot from `useDeckSnapshot(editor.doc)` → `jsonExport` → `ExportResult { fileName: exportFileName(deck.name, null, 'json'), sizeHint: formatBytes(bytes), text, svg: null, bounds: null }`. Wrap generation in try/catch → `settled(key, 'error')`. Unit-test the key function separately in `use-export-result.test.ts` (same inputs → same key; any option change → new key).
- [ ] T013 [US1] Wire JSON into `export-dialog.tsx`: when JSON is selected, the scope group shows "Whole deck", is disabled, and has the description "JSON always contains the whole deck" (FR-007); options are two `Switch`es with visible labels "Include descriptions, links and rules" and "Pretty-print"; the preview is a `<pre>` (mono, scrollable) with the first 400 lines of `text`; the footer shows `fileName`, `sizeHint`, Copy and Download. Download → `downloadText(fileName, text)`, `markExported()` from `useSaveControls()`, toast "Downloaded <file name>" via `useToast`, `announce` the same text; dialog stays open. Copy → `copyText(text)`; toast + announce "Copied", or "Couldn't copy — use Download instead" on `false`. While `preparing`, show "Preparing…" in a polite live region and disable Copy / Download; on `error` show "Couldn't create this export" + "Retry" button (dispatch `retry`). Extend `export-dialog.test.tsx` (mock `download.ts` and `lib/clipboard.ts` at module level): defaults outside flow mode (JSON selected, both switches on, scope disabled with the note); footer `logistics-delivery.sododeck.json` and a KB size for a deck named "Logistics Delivery"; Pretty-print off shrinks the size and removes indentation from the preview; Download calls `downloadText` with the right name and `serializeDeck` text, calls `markExported`, shows the toast; Copy success and failure toasts; error + Retry path (force `jsonExport` to throw via `vi.spyOn`).
- [ ] T014 [US1] Point the entry points at the dialog: `apps/app/src/editor/shell/tools-island.tsx` Export button → `openExport(event.currentTarget)`; `apps/app/src/editor/shell/deck-menu.tsx` "Export…" → `openExport(<the ≡ trigger element>)`; `apps/app/src/editor/command-palette/commands.ts` rename `CommandContext.exportDeck` to `openExport` (title stays "Export deck…") and pass `() => openExport(null)` from `command-palette.tsx`. Leave `save-status.tsx` and `deck-inspector-storage.tsx` on `useExportDeck()`.
- [ ] T015 [US1] Update the tests that clicked Export: `apps/app/src/editor/shell/tools-island.test.tsx` (clicking Export sets `exportDialog.open`, no direct download; compact accessible name still "Export"); `apps/app/src/routes/editor-page.test.tsx` around lines 345–356 (click Export → dialog → Download → `downloadText` called and the library record's `exportedAt` set); `commands.test.ts` / `palette-results.test.ts` if they reference `exportDeck`; add a deck-menu test that "Export…" opens the dialog. Confirm `save-status.test.tsx` and the deck-inspector test are unchanged and green.

**Checkpoint**: US1 complete — JSON export works from all three entry points; backups unchanged.

---

## Phase 4: User Story 2 — Put a picture of the diagram in a doc or slide (P1)

**Goal**: PNG (1× / 2× / 3×, transparent) and SVG (transparent, Copy) of the whole deck, drawn like the canvas.

**Independent test**: quickstart 3–4 (sizes match the footer; transparency; SVG opens and has text).

- [ ] T016 [P] [US2] Export cache-free helpers from canvas code without changing behaviour: in `apps/app/src/editor/deck-to-flow.ts` export the internal `portNodes` as `exportPortRects(deck, graph): { id: string; rect: Rect; label: string }[]` (or export `portNodes` itself if its output already has position, size and label — keep `toFlowNodes` using it) and make sure nothing exported carries the `lastNodes` / edge caches; in `apps/app/src/editor/deck-edge.tsx` move `DOT_RADIUS` to `apps/app/src/editor/edge-constants.ts` and import it from both `deck-edge.tsx` and `merged-edge.tsx` if used there. Existing canvas tests must stay green; update `.agents/skills/react-flow/SKILL.md` with one line about these exports (per `apps/app/CLAUDE.md`).
- [ ] T017 [P] [US2] Write `apps/app/src/editor/export/png-size.ts` (+ test) (R5): `MAX_CANVAS_SIDE = 16_384`, `MAX_CANVAS_AREA = 16_777_216`, `pngSize(bounds: { width: number; height: number }, scale: PngScale): { width: number; height: number }` (ceil then × scale), `scaleAllowed(bounds, scale): boolean`, `largestScale(bounds): PngScale | null`. Tests: 1090 × 660 → 2180 × 1320 at 2×; a 6,000 × 3,000 diagram allows 1× and 2× only (area); 17,000 wide → `null`.
- [ ] T018 [P] [US2] Write `apps/app/src/editor/export/text-measure.ts` (+ test) (R6): `type TextMeasurer = (text: string, font: string) => number`; `fixedWidthMeasurer(emRatio = 0.6)` (font size parsed from the CSS font string × ratio × grapheme count via `Intl.Segmenter`); `canvasMeasurer(): TextMeasurer | null` (one `<canvas>` 2D context, `Map` cache keyed by font + text; `null` when `getContext('2d')` is unavailable, e.g. jsdom); `truncate(text, font, maxWidth, measure): string` (returns text unchanged if it fits, else the longest grapheme prefix + "…" that fits; binary search). Tests with the fixed measurer: fits / cut / emoji not split / empty.
- [ ] T019 [P] [US2] Write `apps/app/src/editor/export/icon-paths.ts` (R7): `IconNode = readonly (readonly [tag: 'path' | 'circle' | 'rect' | 'line' | 'polyline' | 'polygon' | 'ellipse', attrs: Readonly<Record<string, string | number>>])[]` and `ICON_PATHS: Record<'client' | 'gateway' | 'service' | 'queue' | 'database' | 'external' | 'fallback' | 'rules' | 'children' | 'sticky', IconNode>` for `MonitorSmartphone`, `Router`, `Box`, `ArrowLeftRight`, `Database`, `Cloud`, `Shapes`, `Table`, `Layers`, `StickyNote` (take the geometry from the installed `lucide-react` 1.48 `dist/esm/icons/*.mjs`; file header credits lucide, ISC). Drift test `icon-paths.test.tsx`: render each lucide-react component (via `KIND_STYLE[kind].icon` / `KIND_FALLBACK` for kinds, direct imports for the others) with Testing Library and assert its child elements' tag names and attributes (excluding `key`) equal `ICON_PATHS`.
- [ ] T020 [P] [US2] Write `apps/app/src/editor/export/export-palette.ts`: `ExportPalette` (canvas `#fafaf8`, surface, surface-2, border, hairline, group fill, ink, ink-secondary, ink-muted, edge, primary, primary-soft, primary-ink, on-primary, clay-ink, and each kind's tile bg / icon colour, sticky tints) with `LIGHT_PALETTE` values copied from the light section of `packages/ui/src/styles/tokens.css` (see the kind table in research R2 / the canvas agent notes). Add `export-palette.test.ts` that reads `tokens.css` as text (`?raw` import) and asserts every `LIGHT_PALETTE` value equals the matching light custom property, so a token change cannot silently diverge.
- [ ] T021 [P] [US2] Write `packages/ui/src/lib/embedded-fonts.ts` (subpath `@sododeck/ui/lib/embedded-fonts`; `@fontsource-variable/*` are dependencies of `packages/ui` and do **not** resolve from `apps/app`, so the file must live there — no new dependency): import the Geist and Geist Mono `latin` and `latin-ext` `wght-normal` woff2 files from `@fontsource-variable/geist/files/…` and `@fontsource-variable/geist-mono/files/…` with Vite's `?inline` suffix (add `declare module '*.woff2?inline' { const src: string; export default src; }` to the package's type declarations if typecheck needs it) and export `EMBEDDED_FONT_CSS: string` with four `@font-face` rules (`font-family: 'Geist Variable'` / `'Geist Mono Variable'`, `font-weight: 100 900`, `unicode-range` copied from the fontsource CSS). Only the lazy export chunk imports it, so the editor bundle does not grow. Then write `apps/app/src/editor/export/export-fonts.ts` with `ensureFontsLoaded(): Promise<void>` (`document.fonts.load('500 12.5px "Geist Variable"')` and `'11px "Geist Mono Variable"'`; resolves at once when `document.fonts` is missing). Test in `packages/ui/test/embedded-fonts.test.ts`: four `src: url(data:font/woff2;base64,` entries and no `http`. Update `packages/ui/CLAUDE.md` with one line about this module.
- [ ] T022 [US2] Write `apps/app/src/editor/export/edge-geometry.ts` (+ test) (R3): `handlePoint(rect, side): Point` (side midpoint), `edgePath(from: Rect, to: Rect): { path: string; labelX: number; labelY: number; extent: Rect }` using `facingSides` on the rects' top-left points and `getSmoothStepPath({ …, borderRadius: 8 })` from `@xyflow/react` (with `// TODO(017): honour edge.route`), `extent` = the bounding box of both handle points expanded by 20 px. Tests: left-to-right rects give right→left handles and a path starting at the right-edge midpoint; vertical case; extent contains both handles.
- [ ] T023 [US2] Write `apps/app/src/editor/export/scene.ts` (+ `scene.test.ts`) (R1, R2, data-model "ExportScene") for scope `deck` first: `buildScene(input: SceneInput): ExportScene`. Steps: `graph = visibleGraph(deck, scopeOf([]), new Set())`; `level = effectiveLevel('container', graph.scope)`; cards from `graph.nodes` with `displayPosition` + `nodeSize(level)` (`// TODO(017): node.size`), `kind` = `toComponentKind(node.type)`, `subtitle` = `node.tech ?? null` at container level (`subtitleOf` with the view render in later scopes), `hasRules` = `(node.rules?.length ?? 0) > 0`, `childCount` from `graph.childCount`; group frames from `groupBounds(deck, nodeSize(level))` for `graph.groups` with title and member count; collapsed cards from `graph.cards`; ports from T016's helper; edges from `graph.edges` and `graph.merged` via `edgePath` (label = edge label, `dots` from `direction` defaulting to `forward`, `stroke: 'default'`, no badges); stickies via `stickyCanvasPosition(deck, sticky)` — keep `free` placements and `pinned` ones whose anchor is a drawn card, rect `180 × 40`, label `stickyLabel(text)`, tint `sticky.color ?? 'amber'`; drop edges whose ends are not drawn; `bounds` = union of all rects, edge extents and estimated label pills (label length × 6.3 px + 16, height 18) + `EXPORT_MARGIN = 32` on each side, origin at the union's top-left minus the margin; empty graph → a scene with no shapes and `bounds` `0 × 0`. Tests on small hand-built decks: counts per type; a group with two members gives one frame that contains both cards; bounds include the margin; an edge to a node inside a collapsed group is not in the whole-deck scene because groups are expanded (collapsed set is empty); nested child nodes are represented by the parent card with `childCount`; empty deck → empty scene.
- [ ] T024 [US2] Write `apps/app/src/editor/export/render-svg.ts` (+ `render-svg.test.ts`) (R2–R6, data-model "renderSvg"): `renderSvg(scene, { transparent, palette, fonts, measure, title }): string`. Output: `<?xml` prolog-free `<svg xmlns="http://www.w3.org/2000/svg" width height viewBox="minX minY w h">`, `<title>` = deck name, `<style>` with `fonts` CSS and classes (`.t` sans 12.5 / 500, `.s` mono 11, `.g` sans 11 / 500 uppercase letter-spacing 0.07em, `.l` mono 10.5, `.b` mono 10 / 500), background `<rect>` filled `palette.canvas` unless `transparent`, then in stacking order: group frames (radius 16, 1 px dashed border, group fill, label "TITLE n"), collapsed cards (two offset sheets + card, title, "n components · m connections"), edges (`<path fill="none">` stroke `palette.edge` 1.5, flow strokes from `FLOW_STROKES` for later scopes, end dots `r = DOT_RADIUS`, label pill: rounded rect + text, badges drawn before the label text as 16 px pills), port pills (120 × 36), cards (radius 12, surface fill, 1 px border, `// TODO(020): node.style fill/stroke`, kind tile 30 px radius 9 with the icon 18 px via a local `renderIcon(ICON_PATHS[…], x, y, size, colour)` using `stroke-width` `ICON_STROKE_WIDTH`, round caps / joins, title and subtitle truncated with `truncate()` to the text column width, rules glyph 14 px, child-count pill), stickies (tint fill / border, note icon 16 px, one-line label). Escape `&`, `<`, `>`, `"`, `'` in all text and attributes. Tests with `fixedWidthMeasurer` and a tiny `fonts` string: output parses with `DOMParser` (`image/svg+xml`, no `parsererror`); a title `A <b> & "c"` round-trips as text content; `transparent: true` has no background rect; long titles end with "…"; `href`/`url(` only reference `data:` or `#`; element counts match the scene (cards, paths, labels).
- [ ] T025 [US2] Write `apps/app/src/editor/export/rasterize.ts`: `rasterize(svg: string, size: { width: number; height: number }, scale: PngScale): Promise<Blob>` — `Blob([svg], { type: 'image/svg+xml' })` → object URL → `new Image()`, `await img.decode()` → `<canvas>` sized with `pngSize` → `drawImage(img, 0, 0, w, h)` → `canvas.toBlob('image/png')` (reject with `Error('png-failed')` on `null`); always revoke the URL. No unit test (browser-only); it is mocked in component tests and covered by the bench scenario (T040).
- [ ] T026 [US2] Extend `use-export-result.ts` for PNG and SVG with scope `deck`: `await ensureFontsLoaded()` once; `measure = canvasMeasurer() ?? fixedWidthMeasurer()`; `scene = buildScene(…)`; empty scene → `settled(key, 'empty')`; `svg = renderSvg(scene, { transparent: <format option>, palette: LIGHT_PALETTE, fonts: EMBEDDED_FONT_CSS, measure, title: deck.name ?? 'Untitled deck' })`; result: SVG → `text = svg`, `sizeHint = formatBytes(bytes)`; PNG → `text = null`, `sizeHint = "${w} × ${h} px"` from `pngSize(scene.bounds, scale)`; both → `svg`, `bounds`. If the chosen PNG scale is not allowed, dispatch `clampScale(largestScale(bounds))` (all disabled when `null`). The result key for PNG excludes the scale's effect on the SVG (the preview SVG does not depend on scale) but the footer uses the current scale.
- [ ] T027 [US2] Wire images into `export-dialog.tsx`: scope `SegmentedControl` enabled for PNG / SVG with items "Whole deck", "Current view", "Selected flow"; until US3 and US4 land, keep "Current view" and "Selected flow" disabled (T030 and T033 enable them); PNG options: `SegmentedControl` named "Scale" with "1×", "2×", "3×" (a disallowed scale is disabled and wrapped in a `Tooltip` "Too large for this browser"), `Switch` "Transparent background"; SVG options: `Switch` "Transparent background"; preview: `<img alt="Preview of <file name>">` from an object URL of the SVG (created in an effect, revoked on change / unmount; `object-fit: contain`); empty → "Nothing to export yet" and Copy / Download disabled. Footer: PNG shows no Copy button. Download: SVG → `downloadText(fileName, svg, 'image/svg+xml')`; PNG → `rasterize(svg, bounds, scale)` then `downloadBlob(fileName, blob)` (Download shows a busy state while rasterising; on rejection show the error toast "Couldn't create this export"); toast + announce "Downloaded <file name>"; do not call `markExported` for images. Copy (SVG): same as JSON.
- [ ] T028 [US2] Extend `export-dialog.test.tsx` for US2 (mock `rasterize`, `download.ts`, `lib/clipboard.ts`; `canvasMeasurer` returns `null` in jsdom): choosing PNG shows 2× selected and the "W × H px" hint that matches `pngSize(bounds, 2)`; picking 3× changes the hint; a huge generated deck (positions spread past 16,384 px) disables 3× (and 2× where applicable) with the tooltip; Transparent background toggles and the preview `img` has the alt text; SVG shows Copy and a KB size; Download for PNG calls `rasterize` with the scale and `downloadBlob` with `<deck>.png`; Download for SVG calls `downloadText` with `image/svg+xml`; empty deck shows "Nothing to export yet" for PNG and SVG while JSON still works.

**Checkpoint**: US1 + US2 — JSON, PNG and SVG of the whole deck.

---

## Phase 5: User Story 3 — Export a picture of just one flow (P1)

**Goal**: in flow mode the dialog opens on PNG + "Selected flow"; images contain only the flow's objects with step numbers; file name includes the flow.

**Independent test**: quickstart 5.

- [ ] T029 [US3] Add scope `flow` to `buildScene` in `apps/app/src/editor/export/scene.ts`: base = the current-view pipeline (`viewStateOf(deck, ui.currentViewId, ui.revealed)` → `visibleGraph(view.deck, scopeOf(ui.drill), view.collapsed)`, `level = effectiveLevel('container', scope)`); `overlay = flowOverlay(view.deck, analyzeFlow(flow, view.deck.edges), null, null)` (check the exact parameter list in `flows/flow-overlay.ts`; no session, no hover, no playback); map marks onto collapsed cards with `collapseFlowMarks(overlay, graph)`; keep only cards / collapsed cards / ports / edges / merged edges that carry a mark (in path or with badges); groups = frames of groups containing a kept card; edges get `stroke: 'flow'` (`'flow-error'` for error-path styles) and `badges` from `EdgeFlowMark.badges` (`label`, `errorPath`); stickies = pinned to a kept card and `stickyFlowState(sticky, placement, { flowMode: true, display: ui.notesDisplay, … }) !== 'hidden'`; a flow with no steps → empty scene. Tests in `scene.test.ts` on a hand-built deck with a 3-step flow plus unrelated nodes: only the flow's nodes and edges; badges "1", "2", "3"; a branch step gets "2a"; unrelated sticky dropped; `notesDisplay: 'hidden'` drops pinned stickies; empty flow → empty scene.
- [ ] T030 [US3] Flow mode in the dialog: pass `flowMode = isFlowMode(useUiStore.getState())` and the active flow into `initialExportState` (PNG + `flow` by default, FR-004); enable "Selected flow" only in flow mode, otherwise disabled with tooltip "Open a flow to export it"; file name uses `exportFileName(deck.name, flow.name, format)` in flow scope; if the active flow id is no longer in the deck while open, dispatch `flowGone` and show + announce "The flow was deleted, so the whole deck is shown."; the result key includes `activeFlow.flowId` and `notesDisplay`. Tests in `export-dialog.test.tsx` (set the store to flow mode on a deck with a flow "Place order"): opens with PNG and "Selected flow" checked; file name `…-place-order.png`; JSON shows the disabled whole-deck scope, then PNG shows "Selected flow" again; outside flow mode "Selected flow" is disabled with the tooltip; deleting the flow from the doc while open shows the note and selects "Whole deck".
- [ ] T031 [P] [US3] `render-svg.test.ts`: a flow scene draws `FLOW_STROKES.path` colour / width on flow edges, a badge pill with the step number text inside each label pill, and error-path badges in `palette.clayInk`.

**Checkpoint**: all P1 stories done.

---

## Phase 6: User Story 4 — Export a picture of the current view (P2)

**Goal**: "Current view" draws exactly what the active view shows at the current drill level, over its whole extent.

**Independent test**: quickstart 6.

- [ ] T032 [US4] Add scope `view` to `buildScene`: `view = viewStateOf(deck, ui.currentViewId, ui.revealed)`; `graph = visibleGraph(view.deck, scopeOf(ui.drill), view.collapsed)`; `level = effectiveLevel('container', graph.scope)`; subtitles via `subtitleOf(node, view.render)` (respecting `subtitleField`, `'none'` → no subtitle); collapsed groups drawn as collapsed cards; stickies from `view.deck` (hidden components' notes are already dropped by `viewDeck`); no flow marks. Tests: a view hiding the `database` kind drops those cards and their edges; a collapsed group appears as one collapsed card with counts and merged edges; drilled into a group only its members are drawn; drilled into a component the level is `component` (card size 164 × 104); `subtitleField: 'owner'` shows owners; whole-deck and current-view scenes are equal for a deck whose default view hides nothing and has nothing collapsed.
- [ ] T033 [US4] Enable "Current view" in the dialog (remove its TODO); the result key includes `currentViewId`, `revealed`, `drill`. Test in `export-dialog.test.tsx`: switching to a view that hides a kind and choosing "Current view" changes the PNG size hint versus "Whole deck"; with identical content the hint stays the same (US4 AC3).

---

## Phase 7: User Story 5 — Do it all from the keyboard (P2)

**Goal**: full keyboard and screen-reader operation per the contract.

**Independent test**: quickstart 7.

- [ ] T034 [US5] Keyboard and focus in `export-dialog.tsx`: initial focus on the checked format radio (`onOpenAutoFocus` → focus it); ↑ / ↓ in the format `RadioGroup` (Radix default orientation vertical), ← / → in the scope and scale `SegmentedControl`s skipping disabled items; every switch, Copy and Download in Tab order; Esc / scrim / Close → `closeExport()` and focus returns to `returnFocus` or, when opened from ⌘K (`null`), to the canvas (`[data-testid="canvas"]` or the element the shell uses for canvas focus — reuse the palette's close behaviour); disabled items keep their tooltip reachable (wrap in a focusable span with `aria-describedby`); with `prefers-reduced-motion` the dialog has no open / close animation (check the `DialogContent` classes use `motion-reduce:` variants; add them locally if missing).
- [ ] T035 [US5] Announcements: "Preparing…" in a polite live region; Copy / Download / error / flow-deleted texts through `useUiStore.getState().announce`; the preview region has the name "Preview"; the format radios have `aria-describedby` subtitles. Tests in `export-dialog.test.tsx` with `userEvent.keyboard`: open from the tools island, `{ArrowDown}` moves to PNG, `{Tab}` reaches Scope and `{ArrowRight}` skips the disabled "Selected flow", `{Escape}` closes and focus is back on the Export button; ⌘K "Export deck…" path returns focus to the canvas; `announce` is called with "Downloaded logistics-delivery.png"; run `axe` if the repo already has an a11y helper in `apps/app/src/test/` (otherwise skip, do not add a dependency).

---

## Phase 8: Polish & cross-cutting

- [ ] T036 [P] Write `apps/app/src/editor/export/scene.perf.test.ts`: `generateBenchDeck(500, 1000, 42, { flows: 5, groups: 10, stickies: 20 })`, time `buildScene` (deck scope) + `renderSvg` with the fixed measurer, `console.info` the ms, fail above 250 ms (jsdom regression ceiling; the real 50 ms budget is checked in the bench).
- [ ] T037 [P] Update `apps/app/CLAUDE.md`: the `editor/export/` module (pure pipeline + dialog), the rule that export never calls `toFlowNodes` / `toFlowEdges`, entry points vs direct backup exports, and `lib/clipboard.ts` / `downloadBlob`.
- [ ] T038 [P] Update the design gallery mock in `apps/app/src/design-gallery/overlays-section.tsx` (lines ~80–121) to match the shipped dialog texts: description "Exports are generated in your browser. Nothing is uploaded.", formats JSON / PNG / SVG only (remove Mermaid), switch "Include descriptions, links and rules". Keep it a static mock.
- [ ] T039 [P] Update `docs/backlog.md` §012 status line when the PR is opened (e.g. "Status: implemented in PR #…"), leaving the "Later: PDF and Mermaid export" note.
- [ ] T040 Measure the budget: add the `export-preview` scenario to `apps/app/bench/perf.bench.ts` — open `/bench?nodes=500&edges=1000&flows=5&groups=10&stickies=20`, open the dialog via the tools island, select PNG, wait for the preview `img`, record (a) time from click to preview, (b) the longest task via `PerformanceObserver({ type: 'longtask' })` during preparation, (c) time for a 2× Download until `downloadBlob` would be called (expose a `window.__sododeckBench` hook or intercept the download event). Targets from SC-003: dialog < 300 ms, preview < 2 s, longest task < 50 ms, 2× PNG < 5 s. If the longest task exceeds 50 ms, **stop and report** before moving generation to a worker (R8 fallback).
- [ ] T041 Run `pnpm bench` after the change; save `specs/012-export/bench-after.md` and compare with `bench-before.md` (canvas scenarios must not regress; export numbers against SC-003).
- [ ] T042 Visual check: screenshots at 1440×900, light and dark, of the dialog in JSON, PNG, SVG and flow-scope states next to `docs/design/screens/06-export-json-{light,dark}.png`, `33-export-png-light.png`, `33-export-svg-light.png`, `34-export-flow-scope-light.png`; list differences (no PDF / Mermaid rows, lucide icons, DESIGN.md tokens). Also open one downloaded PNG and SVG next to the canvas and note any drawing differences (expected: no dotted background, stickies one-line, labels always on).
- [ ] T043 Walk through [quickstart.md](quickstart.md) scenarios 1–9 by hand, including DevTools Network (no request other than the app's own export chunk) and the backup exports.
- [ ] T044 Definition of done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e` all pass; no `.only` / skipped tests; small Conventional Commits; final report (what changed, what was skipped, what is uncertain, bench numbers).

---

## Dependencies & execution order

- **Phase 1 → Phase 2 → stories.** T008 (reducer) before T009 (dialog); T009 before T010.
- **US1 (Phase 3)** needs Phase 2. It is the MVP and independently shippable.
- **US2 (Phase 4)** needs Phase 2; it touches `export-dialog.tsx` and `use-export-result.ts` after US1's wiring (T013, T012), so do US1 first. T016–T021 have no dependency on US1 and can start in parallel with it.
- **US3 (Phase 5)** needs US2 (scene + renderer).
- **US4 (Phase 6)** needs US2; independent of US3 except both edit `scene.ts` and the dialog (do them one after the other).
- **US5 (Phase 7)** needs the dialog with all formats and scopes (after US3 and US4).
- **Polish** last; T040 needs US2 at least.

```text
T001–T003 → T004–T008 [P] → T009 → T010
                          ├─ US1: T011 [P] → T012 → T013 → T014 → T015
                          └─ US2 prep [P]: T016 T017 T018 T019 T020 T021 → T022 → T023 → T024 → T025
US1 + US2 prep → T026 → T027 → T028 → US3 (T029 → T030, T031 [P]) → US4 (T032 → T033) → US5 (T034 → T035) → T036–T044
```

## Parallel examples

- **Phase 2:** T004 (store), T005 (file names), T006 (download), T007 (clipboard) are different files.
- **US1 + US2 prep together:** T011 (json-export) alongside T016 (canvas helper exports), T017 (png-size), T018 (text measure), T019 (icon paths), T020 (palette), T021 (fonts, in `packages/ui`).
- **US3:** T031 (render test) alongside T029 once T024 exists.
- **Polish:** T036, T037, T038, T039 in parallel.

## Implementation strategy

1. **MVP = US1**: the dialog with JSON from all entry points — shippable on its own and keeps backups intact.
2. **US2** adds images of the whole deck (largest chunk: scene + renderer + fonts + icons).
3. **US3** (flow pictures), then **US4** (current view), then **US5** (keyboard / screen-reader polish and tests).
4. Check the < 50 ms budget (T040) before the PR; if it fails, stop and report instead of silently moving work.
