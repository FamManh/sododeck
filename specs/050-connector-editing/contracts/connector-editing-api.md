# Contract: connector editing API (050)

Model methods and pure helpers other code relies on. Names may still be adjusted during implementation; the behaviour may not. Distances marked "screen px" are divided by the current zoom before use.

## `@sododeck/model`

```ts
/** What an edge end names. Replaces node-only title lookups. */
type EndpointKind = 'node' | 'group';
function endpointOf(deck: SododeckFile, id: Id): { kind: EndpointKind; title: string } | null;

/** Ref target for edge ends: accepted when `id` names a node or a group. */
type RefTarget = 'nodes' | 'groups' | 'nodes|groups' | …;
```

- `checkIntegrity`: `edges.from/to` resolve against nodes ∪ groups. A node and a group with the same id give a `duplicate-id` problem.
- `removeGroup(groupId)`: also removes every edge touching the group, in the same transaction. `previewRemoval` lists those edges under `edges`.
- `toFragment` / `pasteFragment`: group-ended edges are kept when both ends are in the fragment and remapped through `groupIds`.
- `analyzeFlow`: unchanged logic. Group ids are ordinary endpoint ids.
- Round-trip: a deck with card→group, group→card and group→group edges, each with route and style, is lossless.

## `apps/app` pure helpers

```ts
// editing/pointer-drag.ts
const DRAG_THRESHOLD = 4; // screen px
interface PointerDragHandlers {
  onStart?(e: PointerEvent): void; // after the threshold
  onMove(e: PointerEvent): void; // rAF-throttled, only after onStart
  onEnd(e: PointerEvent, committed: boolean): void;
  onCancel(): void; // Esc, blur, pointercancel, lost capture, unmount
}
function startPointerDrag(e: PointerEvent, handlers: PointerDragHandlers): { cancel(): void };
function hasActiveGesture(): boolean; // drag-session.ts, for the guide safety net

// routing/endpoint-target.ts
interface EndpointTarget {
  id: Id;
  kind: 'node' | 'group';
  flowId: string;
  box: Box;
  geometry?: Geometry;
}
/** Topmost card within 16 screen px, else the innermost group frame containing / near the point. */
function hitTarget(point: Point, scene: TargetScene, zoom: number): EndpointTarget | null;

// routing/outline-attach.ts
const MIDPOINT_SNAP = 6; // screen px
const CENTRE_ZONE = 0.4; // fraction of each axis
const CENTRE_MARGIN = 24; // screen px, min distance of the zone from every side
interface Attachment {
  side: Side;
  at: number;
  point: Point;
  snapped: boolean;
  automatic: boolean;
}
function attachToOutline(
  box: Box,
  geometry: Geometry | undefined,
  pointer: Point,
  opts: { zoom: number; mod: boolean; allowAutomatic: boolean },
): Attachment;
/** Shift + arrow: ±1 % along the side, carrying round corners like stepAnchor. */
function nudgeAnchor(side: Side, at: number, delta: -0.01 | 0.01): { side: Side; at: number };

// editing/endpoint-drag.ts
function startEndpointDrag(
  editor: DeckEditor,
  ctx: EndpointContext,
  pointer: Point,
): EndpointSession;
function moveEndpoint(
  s: EndpointSession,
  pointer: Point,
  opts: { mod: boolean; zoom: number },
): void;
function endEndpointDrag(editor: DeckEditor, s: EndpointSession): void; // one write or none
function cancelEndpointDrag(s: EndpointSession): void;

// routing/elbow-runs.ts + editing/segment-drag.ts
interface Run {
  index: number;
  axis: 'x' | 'y';
  from: Point;
  to: Point;
  kind: 'inner' | 'start' | 'end';
}
function elbowRuns(vertices: readonly Point[], minScreenLength: number, zoom: number): Run[];
function startSegmentDrag(
  editor: DeckEditor,
  ctx: BendContext & EndContext,
  run: Run,
): SegmentSession;
function moveSegment(s: SegmentSession, pointer: Point, opts: { mod: boolean; zoom: number }): void;
function endSegmentDrag(editor: DeckEditor, s: SegmentSession): void;
function resetSegment(editor: DeckEditor, ctx: BendContext & EndContext, run: Run): void;

// editing/spread-ends.ts
function spreadEnds(
  view: SpreadView,
  cardIds: readonly Id[],
): { edgeId: Id; patch: EdgeRoutePatch }[];

// connection-rules.ts
type ConnectionCheck = 'ok' | 'self' | 'duplicate' | 'contains';
function connectionCheck(deck: SododeckFile, from: Id, to: Id, ignoreEdgeId?: Id): ConnectionCheck;
```

### Guarantees (unit-tested)

- `startPointerDrag`: no `onStart` / `onMove` below 4 screen px. `onEnd(…, false)` for a click. `onCancel` exactly once on blur, pointercancel or `cancel()`. Listeners are removed on every exit.
- `hitTarget`: a card over a group wins. Nested groups resolve to the innermost. 16 px reach scales with zoom. Hidden or out-of-scope objects are never returned.
- `attachToOutline`: continuous. Moving the pointer by d moves `point` by ≤ d + snap reach. Around a corner, `side` changes only where the two sides meet. `at` snaps only to 0.5. `mod` turns snapping off. `automatic` only with `allowAutomatic`, inside the 40 % zone, and when the zone keeps a 24 px margin. Shapes follow the outline.
- `endEndpointDrag`: unchanged result → no write. Released off every target → no write, announces "Not connected: drop on a card or group". `'self' | 'duplicate' | 'contains'` → no write, announces the refusal text. Target changed → `from`/`to` plus side/at in one undo step.
- `elbowRuns`: runs shorter than 24 screen px are omitted. The axis is exact for elbow vertices.
- `moveSegment`: inner runs move both bends on one axis. End runs change only `fromAt` / `toAt`, clamped to [0, 1]. Right angles are kept.
- `spreadEnds`: sides with < 2 ends are skipped. `at = (i+1)/(n+1)`, ordered by the other end, ties by edge id. Includes automatic ends at their resolved side. Same input → same output.
- `connectionCheck`: `'contains'` for a group ↔ any descendant node or group, either direction.
