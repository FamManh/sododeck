# Contract: `visible-graph.ts` and helpers (010)

Pure TypeScript in `apps/app/src/editor/`, no React, no Yjs. Every export is unit-tested next to the code (`*.test.ts`). Inputs are the deck snapshot (`SododeckFile`) and UI state ids; outputs are derived and never stored.

## `levels.ts`

```ts
export type Level = 'landscape' | 'system' | 'container' | 'component';
export const LEVELS: readonly Level[]; // widest → narrowest
export const LEVEL_NAMES: Record<Level, string>; // "Landscape" …
export const LEVEL_MID_ZOOM: Record<Level, number>; // 0.375, 0.68, 1.2, 1.75

/** Band by whole percent: ≤45 landscape, ≤90 system, ≤150 container, else component. */
export function levelForZoom(zoom: number): Level;

/** Same, but stays at `current` until zoom is ≥ 2 points past a threshold (anti-flicker). */
export function levelWithHysteresis(zoom: number, current: Level): Level;

/** `component` when `scope.node` is set (drilled into a node), else the zoom level. */
export function effectiveLevel(zoomLevel: Level, scope: Scope): Level;

/** node.level, or from parent depth: 0 → container, ≥1 → component. */
export function nodeLevel(deck: SododeckFile, nodeId: string): Level | undefined;
```

## `visible-graph.ts`

```ts
/**
 * What is shown. `node`: the last node frame in the drill stack (null = top level) — members are
 * nodes whose effective `parent` is this node. `group`: the last group frame after it (null = none)
 * — members are further limited to that group's subtree.
 */
export interface Scope {
  node: string | null;
  group: string | null;
}

export interface CollapsedCard {
  groupId: string;
  title: string;
  nodeCount: number; // members incl. nested groups
  edgeCount: number; // edges with both ends inside
  rect: Rect; // COLLAPSED_CARD_SIZE centred on the expanded bounds
}

export interface MergedEdge {
  id: string; // `merged:${a}|${b}`, a < b
  a: string; // React Flow id of an end: node id or `collapsed:<groupId>`
  b: string;
  edgeIds: readonly string[]; // deck edge ids, deck order
  direction: 'a-to-b' | 'b-to-a' | 'both';
}

export interface PortPill {
  id: string; // `port:${outsideNodeId}`
  outsideNodeId: string; // what clicking selects after going up
  outsideTitle: string;
  edgeIds: readonly string[];
  insideNodeIds: readonly string[];
}

export interface VisibleGraph {
  scope: Scope;
  nodes: readonly string[]; // visible deck node ids (not inside a card)
  groups: readonly string[]; // expanded group boundaries to draw
  cards: readonly CollapsedCard[];
  edges: readonly string[]; // plain deck edges drawn as-is
  merged: readonly MergedEdge[];
  ports: readonly PortPill[];
  /** Deck node id → React Flow id it is drawn as (itself or its card); absent = not visible. */
  representative: ReadonlyMap<string, string>;
  /** Group id → collapsed card that hides it (itself or an outer collapsed group). */
  hiddenBy: ReadonlyMap<string, string>;
  /** Node id → number of children (effective `parent`), for the drill marker. */
  childCount: ReadonlyMap<string, number>;
}

export function scopeOf(drill: readonly DrillFrame[]): Scope;

export function visibleGraph(
  deck: SododeckFile,
  scope: Scope,
  collapsed: ReadonlySet<string>,
): VisibleGraph;

/** Bounds of what the scope shows, for fitBounds on drill-in (null when empty). */
export function scopeBounds(deck: SododeckFile, graph: VisibleGraph, level: Level): Rect | null;

/** Deepest prefix of `drill` whose frames still exist and are non-empty. */
export function validDrillDepth(deck: SododeckFile, drill: readonly DrillFrame[]): number;
```

Guarantees (tested):

1. **Cached**: same `deck`, `scope` and `collapsed` references return the same object. A new `deck` whose `nodes`, `edges` and `groups` arrays are unchanged also returns the cached graph (drags change `nodes`, so the graph is rebuilt; cost is linear).
2. **No node appears twice**: every visible deck node maps to exactly one representative.
3. **Counts add up**: for every merged edge, `edgeIds.length` equals the number of in-scope deck edges between those representatives. Hidden internal edges are exactly those whose ends share a card.
4. **Direction**: `both` when underlying edges go both ways or any has `direction: 'both'`.
5. **Nested collapse**: a collapsed outer group hides inner groups and their cards. Expanding it restores the inner groups' own `collapsed` state (the set is not modified).
6. **Integrity**: missing `group` / `parent` references and cycles never throw. They are treated as absent.
7. **Children** (clarification Q1): a node with an effective `parent` P is visible only in scopes with `node === P`.
8. **Groups follow members**: a group boundary or card is drawn only if at least one of its subtree's nodes is a scope member (e.g. in `examples/full.sododeck.json`, "Core services" appears only inside "Delivery platform", because its members have that `parent`).

## `focus-set.ts`

```ts
export interface FocusSet {
  focusId: string; // React Flow id (node or `collapsed:<id>`)
  members: ReadonlySet<string>; // focusId + direct neighbours (React Flow ids)
  edges: ReadonlySet<string>; // plain and merged edge ids between them
}
/** null when `id` is not visible in `graph`. */
export function focusSet(deck: SododeckFile, graph: VisibleGraph, id: string): FocusSet | null;
```

## `collapse-flow-marks.ts`

```ts
export interface CollapsedFlowMarks {
  merged: ReadonlyMap<string, EdgeFlowMark>; // merged edge id → folded badges
  cards: ReadonlyMap<string, 'current' | 'path'>; // group id → ring state
}
export function collapseFlowMarks(overlay: FlowOverlay, graph: VisibleGraph): CollapsedFlowMarks;

/** Title of the collapsed group hiding this deck edge, for 007's "inside <group>". */
export function groupAtStep(deck: SododeckFile, graph: VisibleGraph, edgeId: string): string | null;
```

## Changes to existing pure modules

| Module                   | Change                                                                                                                                                                                                                                                                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canvas-geometry.ts`     | `COMPONENT_CARD_SIZE` (164 × 104), `COLLAPSED_CARD_SIZE` (180 × 64), `nodeSize(level)`; `groupBounds(deck, size?)`                                                                                                                                                                                                                                    |
| `deck-to-flow.ts`        | `toFlowNodes(deck, graph, view, overlay)` and `toFlowEdges(deck, graph, view, overlay)`, where `view = { selection, focusedId, focusedEdgeId, labelsOn, level, focus: FocusSet \| null, marks: CollapsedFlowMarks }`. Adds the `collapsed-group`, `port` node types and the `merged` edge type. Cache checks include `level`, `dimmed`, `childCount`. |
| `outline.ts`             | `buildOutline(deck, scope?)` limits the tree to the scope and prepends an `{ type: 'up' }` item when drilled                                                                                                                                                                                                                                          |
| `bench/generate-deck.ts` | `options.groups` (R12)                                                                                                                                                                                                                                                                                                                                |
