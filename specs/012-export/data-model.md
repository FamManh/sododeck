# Data Model: Export (012)

No document or schema change. Nothing is written to the deck or the undo history. Two kinds of
state are added: one UI-store field (dialog open) and the dialog's local state. Everything else is
derived values passed between pure functions.

## UI store (`apps/app/src/state/ui-store.ts`)

| Field          | Type                                                  | Default                              | Notes                                                                                                               |
| -------------- | ----------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `exportDialog` | `{ open: boolean; returnFocus: HTMLElement \| null }` | `{ open: false, returnFocus: null }` | Set by `openExport(returnFocus?)`, cleared by `closeExport()`. `resetForDeck` closes it. Same pattern as `palette`. |

## Dialog state (local to `ExportDialog`, `useReducer`)

```ts
type ExportFormat = 'json' | 'png' | 'svg';
type ImageScope = 'deck' | 'view' | 'flow';
type PngScale = 1 | 2 | 3;

interface ExportOptions {
  json: { includeKnowledge: boolean; pretty: boolean }; // defaults true, true
  png: { scale: PngScale; transparent: boolean }; // defaults 2, false
  svg: { transparent: boolean }; // default false
}

interface ExportDialogState {
  format: ExportFormat; // 'json' outside flow mode, 'png' in flow mode (FR-004)
  imageScope: ImageScope; // 'deck' outside flow mode, 'flow' in flow mode; kept while JSON is shown (FR-007)
  options: ExportOptions;
  scopeNote: 'flow-deleted' | null; // shown + announced when the flow disappears (R11)
  result: ExportResultState;
}

type ExportResultState =
  | { status: 'preparing'; key: string }
  | { status: 'empty'; key: string } // images of an empty scope: "Nothing to export yet"
  | { status: 'error'; key: string }
  | { status: 'ready'; key: string; result: ExportResult };
```

**Transitions**

| Event                                    | Effect                                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| open                                     | defaults from FR-004 / option defaults; `result = preparing(key)`                         |
| select format / scope / option change    | update the field; new `key`; `result = preparing(key)` after the 150 ms debounce          |
| deck changes (snapshot)                  | new `key` (includes the deck snapshot identity); `result = preparing(key)`                |
| generation finishes for `key`            | ignored unless `key` is current; then `ready` / `empty` / `error`                         |
| active flow disappears                   | `imageScope = 'deck'`, `scopeNote = 'flow-deleted'`, announce                             |
| select "Selected flow" outside flow mode | impossible (item disabled)                                                                |
| PNG scale above `largestScale(bounds)`   | `options.png.scale = largestScale(bounds)` (only happens when the bounds grow while open) |
| Retry (error)                            | `result = preparing(key)` with the same key, generation re-run                            |

**Key** = `format` + (image formats: `imageScope` + their options; JSON: its options) + deck
snapshot identity (the `SododeckFile` object from `useDeckSnapshot`, compared by reference) +
for view / flow scopes the relevant UI-store values (`currentViewId`, `revealed`, `drill`,
`activeFlow.flowId`, `notesDisplay`).

## Derived values (pure)

### `ExportResult`

| Field      | Type                                        | Notes                                                                       |
| ---------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| `fileName` | `string`                                    | `exportFileName(deckName, flowName, format)` (R10)                          |
| `sizeHint` | `string`                                    | JSON / SVG: bytes formatted ("11.9 KB"); PNG: `"W × H px"` from `pngSize()` |
| `text`     | `string \| null`                            | JSON / SVG text (Copy and Download); `null` for PNG                         |
| `svg`      | `string \| null`                            | the SVG used for the image preview and, for PNG, rasterised on Download     |
| `bounds`   | `{ width: number; height: number } \| null` | diagram size at 1× incl. margin (PNG size and scale limits)                 |

PNG bytes are produced on Download, not for the preview (the preview shows the SVG, the same
drawing), so switching scales costs nothing.

### `ExportScene` (`buildScene`, R1–R3)

```ts
interface ExportScene {
  bounds: Rect; // diagram coordinates, margin included
  groups: SceneGroup[]; // { id, rect, label, count, landscape: boolean }
  collapsed: SceneCollapsed[]; // { id, rect, title, nodeCount, edgeCount }
  ports: ScenePort[]; // { id, rect, label }
  cards: SceneCard[]; // { id, rect, kind, title, subtitle | null, hasRules, childCount, level }
  edges: SceneEdge[]; // { id, path, dots: 'target' | 'both' | 'none', stroke: 'default' | 'flow' | 'flow-error', label | null, badges: SceneBadge[], labelPoint }
  stickies: SceneSticky[]; // { id, rect, tint, label }
}
interface SceneBadge {
  label: string; // "3", "4a"
  errorPath: boolean;
}
```

**Input**

```ts
interface SceneInput {
  deck: SododeckFile; // from useDeckSnapshot
  scope: ImageScope;
  ui: {
    currentViewId: Id | null;
    revealed: ReadonlySet<Id>;
    drill: readonly DrillFrame[];
    activeFlowId: Id | null;
    notesDisplay: NotesDisplay;
  };
}
```

**Validation rules**

- Every `SceneEdge` endpoint is a drawn card, collapsed card or port (edges to undrawn objects are
  dropped, as `visibleGraph` does).
- `flow` scope: only objects with a flow mark; `groups` are only those containing a kept card.
- Empty scene (no cards, collapsed cards or ports) → the dialog shows `empty` for images.
- `bounds` covers every shape and edge path (handle points ± 20 px) plus `EXPORT_MARGIN` (32).

### `renderSvg(scene, options)`

```ts
interface SvgOptions {
  transparent: boolean;
  palette: ExportPalette; // light token values (R2)
  fonts: EmbeddedFonts; // data-URL @font-face CSS (R4)
  measure: TextMeasurer; // (text, font) => width px (R6)
}
```

Output: one `<svg xmlns=… width height viewBox>` document with `<title>` (deck name), a
`<style>` (fonts + classes), an optional background `<rect>`, then groups → collapsed → edges →
ports → cards → stickies (canvas stacking order).

### Size limits (`png-size.ts`)

- `pngSize(bounds, scale) = { width: ceil(bounds.width) × scale, height: ceil(bounds.height) × scale }`
- allowed iff `width ≤ 16_384`, `height ≤ 16_384` and `width × height ≤ 16_777_216`
- `largestScale(bounds): PngScale | null` (`null` → every PNG scale disabled; SVG still works)
