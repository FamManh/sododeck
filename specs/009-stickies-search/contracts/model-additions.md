# Contract: `@sododeck/schema` and `@sododeck/model` additions (009)

All additive. Nothing that exists today changes meaning, with one exception: `removeNode` now frees notes pinned to the removed node (ADR 0010, amends ADR 0005 for node anchors).

## Schema (`packages/schema/schema/v1.json`, `Sticky`)

```jsonc
"collapsed":   { "type": "boolean", "description": "True when the note is shown as one line. Absent means expanded." },
"showInFlows": { "type": "boolean", "description": "True when the note stays at full strength during flow playback. Absent means it is dimmed unless pinned to a node of the current step." }
```

- Both are appended after `position`, with no `default`.
- Regenerate `src/generated/{types,zod}.ts` (`pnpm schema:generate`).
- Extend `examples/full.sododeck.json`: one sticky with `collapsed: true`, one with `showInFlows: true`.
- Add invalid fixtures: `collapsed: "yes"` and `showInFlows: 1`.
- The parity, coverage, generated and key-order tests stay green.

## Geometry (`src/geometry.ts`, new, exported)

```ts
export interface Point {
  x: number;
  y: number;
}
/** Grid used for nodes without a stored position (moved from apps/app canvas-geometry). */
export const NODE_GRID: { readonly columns: number; readonly dx: number; readonly dy: number };
/** Offset of a pinned note that has no stored position. */
export const STICKY_DEFAULT_OFFSET: Point; // { x: 24, y: -96 }

/** The node's stored position, or its grid slot by index in `file.nodes`. Null when no such node. */
export function nodeCanvasPosition(file: SododeckFile, nodeId: Id): Point | null;

export type StickyPlacement =
  | { status: 'free'; point: Point }
  | { status: 'pinned'; point: Point; pinnedTo: Id }
  | { status: 'foreign'; point: Point; anchor: Id } // anchor is a non-node object
  | { status: 'missing'; point: Point; anchor: Id }; // anchor names nothing
export function stickyCanvasPosition(file: SododeckFile, sticky: Sticky): StickyPlacement;

/** First non-empty line with markdown markers removed, case kept; null when the text is blank. */
export function stickyLabel(text: string): string | null;
```

## Editor ops (`src/ops/stickies.ts`, wired into `DeckEditor`)

```ts
interface DeckEditor {
  /**
   * Adds a note and opens a draft gesture. Text edits to it merge into the same undo step
   * until `endStickyDraft`. Returns the new id. Throws if a draft is already open.
   */
  beginStickyDraft(sticky: Omit<Sticky, 'id'>): Id;
  /**
   * Ends the draft. If the note's text is blank (or the note is gone), removes it and drops
   * the draft's undo step, so it leaves no undo or redo entry. Returns 'kept' | 'discarded'.
   */
  endStickyDraft(id: Id): 'kept' | 'discarded';
  /** Pins a note to a node, keeping its canvas point (writes anchor + offset). Throws missing-reference. */
  pinSticky(id: Id, nodeId: Id): void;
  /** Unpins a note, keeping its canvas point (removes anchor, writes absolute position). */
  unpinSticky(id: Id): void;
  /** Moves a note to a canvas point: offset when pinned to a node, absolute otherwise. */
  moveSticky(id: Id, point: Point): void;
}
```

- `collapsed` and `showInFlows` use the generic `update('stickies', id, { collapsed: true })`. Turning a flag off removes the key: `update(…, { collapsed: null })`. `null` is how `Patch` already clears optional keys (`ops/types.ts:16-21`).
- Each op is one transaction and one undo step, except `beginStickyDraft`/`endStickyDraft` (see above).

## Cascade (`src/ops/cascade.ts`) and preview (`src/preview.ts`)

- `removeNode(id)`: in the same transaction, every sticky with `anchor === id` gets `position = nodeCanvasPosition + (position ?? STICKY_DEFAULT_OFFSET)` and loses `anchor`.
- `RemovalResult` gains `freed: readonly Id[]`. Those ids are excluded from `broken`.
- `previewRemoval` reports the same stickies in a new `freed` list, so the dialog can say "1 note will be unpinned".
- Other anchors (edges, flows, steps, groups, rules) keep ADR 0005 behavior.

## Search (`src/search/`, exported)

```ts
export type SearchKind = 'node' | 'edge' | 'flow' | 'step' | 'rule' | 'sticky';
export type SearchField =
  'title' | 'description' | 'condition' | 'notes' | 'text' | 'cell' | 'column';
export interface Range {
  start: number;
  end: number;
}

/** NFKD, strip accents, lower-case, strip markdown markers, collapse spaces. */
export function normalizeText(text: string): string;

export interface SearchIndex {
  readonly entries: readonly SearchEntry[];
}
export interface SearchEntry {
  kind: SearchKind;
  id: Id;
  flowId?: Id;
  title: string;
  context: string;
  fields: readonly { field: SearchField; raw: string; norm: string }[];
}
/** Builds the index; entries are cached per (structurally shared) snapshot object. */
export function buildSearchIndex(file: SododeckFile): SearchIndex;

export interface SearchResult {
  kind: SearchKind;
  id: Id;
  flowId?: Id;
  title: string;
  context: string;
  match: 'title' | 'body';
  titleRanges: readonly Range[];
  snippet?: { field: SearchField; text: string; ranges: readonly Range[] };
}
/** Every query word must appear in some field. Ordered title > body, then kind, then title. */
export function searchDeck(
  index: SearchIndex,
  query: string,
  options?: { limit?: number },
): { results: readonly SearchResult[]; total: number };
```

- Ranges point into the _displayed_ strings (`title`, `snippet.text`), mapped back from normalized offsets.
- An empty query returns `{ results: [], total: 0 }`; the app shows commands and flows instead.

## Tests (`packages/model/test/`)

- `stickies.test.ts` (new):
  - The placement statuses.
  - The default offset.
  - Grid fallback.
  - Pin, unpin and move keep the canvas point.
  - `stickyLabel`.
  - Draft kept vs discarded, including `canUndo`/`canRedo` unchanged after a discard.
  - Remote tab sees add and remove.
- `cascade.test.ts`:
  - A node delete frees a pinned note at the same point, including for an unpositioned node on the grid.
  - A multi-node delete.
  - An edge or step anchor is still reported broken.
  - `freed` vs `broken`.
- `undo.test.ts`: one undo restores the node and the pin with its original offset.
- `preview.test.ts`: `freed` counts.
- `round-trip.test.ts`: stickies with every combination of anchor/position/collapsed/showInFlows (including explicit `false`), plus key order.
- `search.test.ts` (new):
  - Normalization (accents, case, markdown).
  - Multi-word AND.
  - Every field kind: title, description, step condition, step notes, sticky text, rule cell, column.
  - Ordering.
  - Snippet window and ranges.
  - The limit and total.
  - The backlog case "reattempt" → rule plus step.
  - Rename safety (the index follows the new title).
- `perf.test.ts`: `searchDeck` < 50 ms (median of 5) on a 2,000-node generated deck. `buildSearchIndex` < 100 ms cold.
