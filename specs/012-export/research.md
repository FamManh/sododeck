# Research: Export (012)

All names below were checked on `main` @ `92258e7`. The spec's clarifications (JSON = whole deck;
formats JSON, PNG, SVG only) are inputs, not open questions.

## R1. How images are drawn: a static SVG renderer from a derived scene

- **Decision:** a pure pipeline in `apps/app/src/editor/export/`:
  1. `buildScene(input): ExportScene` turns the deck plus a scope into positioned shapes (cards,
     group frames, collapsed cards, port pills, edges with paths / labels / badges, stickies) and
     the diagram bounds. It reuses the canvas's own pure pieces: `viewStateOf` / `viewDeck`
     (views), `visibleGraph` + `scopeOf` (ADR 0011), `groupBounds` / `nodeSize` /
     `COLLAPSED_CARD_SIZE` / `displayPosition` (`canvas-geometry.ts`), `facingSides`
     (`deck-to-flow.ts`), `subtitleOf` (`views/view-state.ts`), `analyzeFlow` + `flowOverlay`
     (flows) and `stickyCanvasPosition` / `stickyLabel` (model).
  2. `renderSvg(scene, options): string` writes one standalone SVG document (text as `<text>`,
     icons as paths, fonts embedded, R4).
  3. PNG = the same SVG drawn onto a canvas at 1× / 2× / 3× (R5).
- **Rationale:** one drawing for preview, SVG and PNG, so they cannot drift (US2 AC5). A pure
  scene is unit-testable in jsdom with no browser APIs. Reusing the canvas helpers keeps views,
  drill, collapsed groups and flow numbering identical to the canvas (FR-009, FR-010, FR-029).
- **Alternatives considered:**
  - _DOM capture of React Flow_ (`html-to-image`-style, serialising the live DOM into
    `<foreignObject>`): new dependency (VIII), only captures what is mounted (React Flow
    virtualises off-screen nodes, so "whole extent", FR-009, breaks), carries hover / selection /
    focus state, and `<foreignObject>` output is not editable in vector tools (FR-028).
  - _Rendering React components to a string (`react-dom/server`)_: pulls the server renderer into
    the bundle and still emits HTML inside SVG. Rejected.
- **Do not call `toFlowNodes` / `toFlowEdges` from export.** They hold single-slot module caches
  (`lastNodes`) that keep React Flow's array identity stable; an export call would evict them and
  force a canvas re-render. The few internal helpers the scene needs (`portNodes`, the subtitle /
  child-count lookups) are exported from `deck-to-flow.ts` as cache-free functions instead.
  `visibleGraph`'s memo is keyed per deck; an export call while the dialog is open (canvas static
  behind a modal) costs at most one recompute when the dialog closes.

## R2. What an image contains for each scope

| Scope         | Deck used                                         | Graph                                                                                                       | Groups                                  | Stickies                                                                                    | Flow marks                                                                                                                             |
| ------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Whole deck    | the raw deck (no view filter)                     | `visibleGraph(deck, root, ∅)`: top level, **every group expanded**                                          | all frames                              | every sticky whose anchor is drawn, plus free stickies                                      | none                                                                                                                                   |
| Current view  | `viewStateOf(deck, currentViewId, revealed).deck` | `visibleGraph(view.deck, scopeOf(drill), view.collapsed)`                                                   | as the canvas                           | as above, on the view's deck                                                                | none                                                                                                                                   |
| Selected flow | as Current view                                   | as Current view, then **filtered** to nodes / edges / collapsed cards / merged edges that carry a flow mark | frames of groups containing a kept node | pinned to a kept node, and `stickyFlowState(…) !== 'hidden'` with the user's `notesDisplay` | `flowOverlay(deck, analyzeFlow(flow), null, null)`: every step badge on the main path and branches; no current step, no played dimming |

- **Nested components** (`node.parent`, 010 drill-in) are not placed next to their parent: at
  the top level a parent shows its child-count pill, exactly like the canvas. "Whole deck" is
  therefore _the top level with every group expanded_. The spec's FR-008 is reworded to say so.
- **Level:** images draw cards at `effectiveLevel('container', scope)` — the look of the canvas at
  100 % zoom (kind tile 30, title, mono subtitle, rules glyph). Drilled into a component, 010
  forces `component`, and export follows. This is the "full detail, not zoomed-out" assumption
  of the spec, made concrete: `component` level (owner row, tags, 104 px cards) would overlap on
  decks laid out for 50 px cards.
- **Drawn:** card frame, kind tile + icon, title, subtitle (view `subtitleField`), rules glyph,
  child-count pill, group frames and labels, collapsed-group stacks with counts, port pills,
  edges with end dots (`direction`), edge label pills, flow step badges (flow scope), stickies
  (tint, note icon, one-line label).
- **Not drawn** (UI state, not content): selection, focus rings, hover lift, pin badge, problem
  glyph, `flowStart` tag, dotted background, sticky leader lines' pin glyph hover state, expanded
  sticky markdown bodies (stickies are drawn in their one-line form — listed in the PR as a known
  difference).
- **Labels are always drawn**, whatever the Labels toggle: a label is content, and the toggle is a
  screen-density preference.
- **Theme:** always the light token values (spec assumption). The renderer takes a `Palette`
  object built from `packages/ui` light tokens, so a dark option later is one more palette.

## R3. Edge paths, dots, labels

- **Decision:** `getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY,
targetPosition, borderRadius: 8 })` from `@xyflow/react` (already a dependency, DOM-free
  function re-exported from `@xyflow/system`) with handle points at the side midpoints chosen by
  `facingSides`, exactly as `DeckEdge` / `MergedEdge`. It returns the label point too.
- Stroke: `--color-edge` 1.5 px; flow scope uses `FLOW_STROKES.path` (primary, 2 px).
  Direction dots: `DOT_RADIUS = 3` at the target (`forward`), both ends (`both`), none (`none`).
- Label pill: mono 10.5 px, `px-2`, `py-0.5`, rounded-full, surface fill, border, centred on the
  label point; width from text measurement (R6). Step badges: 16 px circles / pills, mono 10 px
  medium, `bg-primary` / `text-on-primary` (error path `clay-ink`), placed before the label text
  inside the pill, as `flow-badges.tsx`.
- **Bounds** include every card, frame, sticky, label pill and each edge's handle points expanded
  by the smooth-step offset (20 px), then `EXPORT_MARGIN = 32` on each side.
- 017 (`edge.route`, `node.size`) and 020 (`node.style`) are **not merged**. The scene reads sizes
  and paths only through `nodeSize` / one `edgePath()` function, so 017 / 020 plug in there. A
  `TODO(017)` / `TODO(020)` marks each spot.

## R4. Fonts in SVG and PNG

- **Decision:** embed the Geist and Geist Mono variable fonts (latin + latin-ext subsets, from the
  already-bundled `@fontsource-variable/geist` / `geist-mono` packages) as `@font-face` rules with
  `data:font/woff2;base64,…` URLs inside the SVG's `<style>`. The files are imported with Vite's
  `?inline` suffix in a new `packages/ui/src/lib/embedded-fonts.ts` (the font packages are
  `packages/ui` dependencies and do not resolve from `apps/app`), which only the lazily loaded
  export chunk imports (R8), so there is no runtime fetch and
  no extra cost for users who never export. Latin woff2 files are 29 KB and 23 KB; with latin-ext
  the SVG carries about 120 KB of fonts.
- `font-family` lists end with `system-ui, sans-serif` / `ui-monospace, monospace`, so scripts
  outside those subsets (e.g. CJK) fall back to the system font, as they do on the canvas.
- **Vector tools:** browsers honour embedded fonts; Figma and some editors ignore them and
  substitute a font, but text stays real, editable text. FR-028 is reworded to promise that (not
  pixel-identical glyphs in every tool).
- **PNG:** an SVG loaded as an `<img>` may use its embedded data-URL fonts (Chrome, Firefox,
  Safari), so PNG glyphs match the canvas (US2 AC4). Before drawing, the dialog awaits
  `document.fonts.load()` for both families so measurement (R6) uses the real metrics.
- **Alternatives:** converting text to paths (not editable, FR-028; needs a font parser
  dependency); linking fonts by URL (breaks outside the app, and would be a network reference).

## R5. PNG rasterisation and size limits

- **Decision:** `rasterize(svg, { width, height, scale }): Promise<Blob>`: SVG string → `Blob`
  → `URL.createObjectURL` → `Image.decode()` → `<canvas>` of `width × scale` by
  `height × scale` → `drawImage` → `canvas.toBlob('image/png')`. Transparent background = the SVG
  simply has no background rect; otherwise the SVG draws a canvas-colour (`#fafaf8`) rect.
- **Main thread, by necessity:** workers cannot decode SVG images (`createImageBitmap` on an SVG
  blob is unsupported in Chrome workers; no `Image` in workers). Decoding and PNG encoding
  (`toBlob`) are asynchronous in all target browsers; only `drawImage` is a synchronous step.
- **Limits:** `MAX_CANVAS_SIDE = 16_384` and `MAX_CANVAS_AREA = 16_777_216` px (Safari's canvas
  area cap, the strictest target). `pngSize(bounds, scale)` and `largestScale(bounds)` are pure;
  scales beyond the limits are disabled ("Too large for this browser", FR-026). If `toBlob`
  returns `null` anyway, the preview shows the generation error (FR-034).
- **Footer size = file size:** both come from the same `pngSize()` (SC-004).

## R6. Text measurement and truncation

- The canvas truncates titles with CSS ellipsis; an SVG cannot. `renderSvg` takes a
  `TextMeasurer = (text, font) => number` and truncates with "…" to the card's text width
  (`truncate(text, font, maxWidth, measure)`, pure, binary search on graphemes via
  `Intl.Segmenter`).
- In the browser the measurer is a cached `CanvasRenderingContext2D.measureText` on one
  offscreen `<canvas>`, after `document.fonts.load()` (R4). In jsdom (no canvas context) and in
  unit tests a fixed-width measurer (`0.6 em` per grapheme) is injected, so tests are
  deterministic.
- Label pills and group labels use the measured width; nothing is wrapped (titles are one line
  on the canvas at container level).

## R7. Kind and glyph icons without React

- **Decision:** `export/icon-paths.ts` holds the lucide node data (`[tag, attrs][]`) for the icons
  the export draws: the six kind icons from `KIND_STYLE`, the fallback `Shapes`, `Table`
  (rules), `Layers` (child count) and `StickyNote`. `renderIcon(nodes, x, y, size, color)` writes
  them with `stroke-width` `ICON_STROKE_WIDTH` (1.5), round caps and joins, as lucide does.
- **Drift guard:** a unit test renders each lucide-react component with Testing Library and
  compares its child elements with `icon-paths.ts`, so a lucide upgrade that changes an icon
  fails the test instead of silently diverging. Licence: lucide is ISC; the file header credits
  it.
- **Alternatives:** lucide-react's per-icon `__iconData` export is not part of its typed public
  API; calling the components outside React breaks on their context hook; `react-dom/server`
  (R1).

## R8. Where the work runs (principle V) and loading

- **Decision:** scene building, SVG writing and JSON serialisation run **on the main thread**,
  debounced (150 ms) and scheduled after paint, with a hard budget verified by tests and bench:
  `buildScene + renderSvg` for 500 components / 1,000 connections **< 50 ms** in the bench browser
  (no long task). PNG decoding / encoding is asynchronous (R5).
- **Rationale:** the work is linear and small (string building); measurement needs the page's
  loaded fonts (R6), which a worker does not share; `getSmoothStepPath` and the view / graph
  helpers live in app code already loaded. A worker would add a protocol, copy the whole deck
  across, and still need the main thread for PNG. Principle V names layout, large imports and
  bulk validation as heavy; this is not in that class _if the budget holds_. The plan's
  Constitution Check records the budget as the condition; if the bench shows a long task, the
  pure `buildScene` / `renderSvg` modules move to a worker with `OffscreenCanvas` measurement
  (they import no DOM API, R6 measurer is injected) — no redesign needed.
- **Lazy chunk:** the dialog, renderer and inlined fonts load with `React.lazy` on first open, and
  the chunk is prefetched with `import()` when the editor becomes idle, so the dialog still opens
  in < 300 ms (SC-003). Only a same-origin, bundled asset is requested (principle IV).
- **Spec SC-003** said the canvas stays at 60 fps while an export is prepared; the dialog is
  modal, so the canvas cannot be panned then. It is reworded to "no main-thread task longer than
  50 ms while a preview is prepared, except the final PNG draw".

## R9. JSON export

- **Whole deck, always** (clarification). Source: `readDeck(editor.doc)` → `SododeckFile`.
- **Pretty-print on:** `serializeDeck(file)` unchanged (canonical order, 2-space indent, trailing
  newline) — byte-identical to today's backup export.
- **Pretty-print off:** `JSON.stringify(JSON.parse(serializeDeck(file)))`. `JSON.parse` keeps key
  insertion order, so canonical order survives; no `@sododeck/model` API change. The cost (one
  extra parse of an already small string) is negligible.
- **"Include descriptions, links and rules" off:** `withoutKnowledge(file): SododeckFile`
  (pure) removes `description` from the deck, nodes, groups, edges, features, flows, branches and
  steps; `links` from nodes, edges, flows and steps; `node.rules`, `step.rules`,
  `step.ruleInputs`; and sets `rules` to `{}`. Notes, payloads, conditions and SLA targets stay.
  A test runs `parseSododeckFile` on the result for every sample and bench deck (FR-022, FR-023).
- **Round-trip test** (FR-020, SC-001): export → `fromJSON` → `toJSON` equals the original, for
  sample decks and a generated deck with every optional field set.
- **Size hint:** UTF-8 byte length (`TextEncoder`), shown as `B` below 1 KB, else `KB` / `MB`
  with one decimal, 1 KB = 1,024 bytes.
- `markExported()` (autosave "last export", 005) is called on every JSON **download** (not copy),
  as today.

## R10. File names

- `exportFileName(deckName, flowName | null, format)`: NFC-normalise, lower-case, keep
  `\p{L}` / `\p{N}`, replace every other run of characters with one "-", trim "-", cut to 80
  characters, fall back to `untitled-deck`; append `-<flow slug>` in flow scope; extensions
  `.sododeck.json`, `.png`, `.svg`. Pure and unit-tested with Latin, Vietnamese, Japanese, emoji
  and empty names.
- The direct backup exports keep `safeFileName` (spec assumption).

## R11. Dialog, state and entry points

- **Store:** `exportDialog: { open: boolean; returnFocus: HTMLElement | null }` with
  `openExport(returnFocus?)` / `closeExport()` in `useUiStore`, the pattern of
  `palette` / `openPalette`. It is reset by `resetForDeck`.
- **Entry points:** `tools-island.tsx` (Export button), `shell/deck-menu.tsx` ("Export…") and
  `command-palette` (`exportDeck` in `CommandContext` becomes `openExport`; title "Export deck…"
  unchanged) call `openExport`. `save-status.tsx` and `deck-inspector-storage.tsx` keep
  `useExportDeck()` (direct backup).
- **Dialog state** is local to the dialog (`useReducer`): `format`, `imageScope`, per-format
  options, and a `result: { key, status: 'preparing' | 'ready' | 'error', … }`. A request key
  (format + scope + options + deck revision) drops stale results. The deck is read with
  `useDeckSnapshot`, so live-sync edits from another tab re-run the preview (spec edge case).
- **Components:** `Dialog` / `DialogContent` (820 px), `RadioGroup` styled as format cards,
  `SegmentedControl` for scope and scale, `Switch` with visible labels, `Button`, `Tooltip`,
  `useToast` — all existing `packages/ui` exports. No new `packages/ui` component.
- **Preview:** JSON → a `<pre>` with the first 400 lines (keeps the DOM small; the footer size is
  the full file); PNG / SVG → `<img>` of the SVG blob URL (revoked on change), `object-fit:
contain`, `alt="Preview of <file name>"`.
- **Clipboard:** `copyText(text)` in `apps/app/src/lib/clipboard.ts` (feature-detected with
  `supportsClipboardWrite`). 019's plan extracts the same helper from `json-panel-header.tsx`; if
  019 has not landed, this feature extracts it with that name and signature.
- **Download:** `download.ts` gains `downloadBlob(fileName, blob)`; `downloadText` becomes a thin
  wrapper over it.
- **Flow scope when the flow disappears:** if `activeFlow` points to a flow no longer in the deck,
  `imageScope` falls back to `deck` and the note "The flow was deleted, so the whole deck is
  shown." is displayed and announced.

## R12. Testing and bench

- **Pure (Vitest):** `export-file-name`, `json-export` (`withoutKnowledge`, compact, size,
  round-trip), `scene` (per scope: counts, bounds, flow filter, collapsed / drill / view cases),
  `edge-geometry`, `truncate`, `png-size` / `largestScale`, `render-svg` (well-formed XML via
  `DOMParser`, escaping of `<`, `&`, quotes; transparent vs background; fonts present),
  `icon-paths` drift test.
- **Component (Testing Library, by role / name):** `export-dialog` (defaults outside / inside
  flow mode, JSON scope disabled note, scope restore, options, footer texts, Copy / Download toasts
  and calls, keyboard: arrows in format list and scope, Esc returns focus, disabled "Selected
  flow" tooltip, empty deck message, too-large scale disabled). `downloadBlob`, `copyText` and
  `rasterize` are mocked at module boundaries (jsdom has no canvas).
- **Existing tests updated:** `tools-island.test.tsx` and `routes/editor-page.test.tsx` (Export now
  opens the dialog; Download inside it still calls the download and sets `exportedAt`);
  `command-palette` tests if the context key is renamed.
- **Perf:** `scene.perf.test.ts` (jsdom, `generateBenchDeck(500, 1000)`, logs the time, fails
  above a generous 250 ms ceiling to catch regressions). `pnpm bench` gains an `export-preview`
  scenario (real browser: open the dialog, switch to PNG, record the longest task and the 2× PNG
  time) for SC-003. Canvas bench numbers before / after are also recorded, as the canvas files
  (`deck-to-flow.ts`) change.
- **E2E:** none new (constitution VI). The smoke test does not touch Export and stays green.

## R13. Decisions recorded as an ADR

`docs/decisions/0016-export-rendering.md`: static SVG from a derived scene (not DOM capture),
embedded fonts, PNG from SVG on the main thread, the 50 ms budget and the worker fallback, and
light-only images. (0015 is reserved by the 019 plan.)
