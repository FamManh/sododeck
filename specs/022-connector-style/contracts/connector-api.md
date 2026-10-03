# Contract: connector API (022)

Model methods and pure helpers other code relies on. Every `DeckEditor` call validates first and
writes in one transaction (one undo step). Names may still be adjusted during implementation; the
behaviour may not.

## `@sododeck/model`

```ts
type EdgeStylePatch = Partial<{
  shape: EdgeShape | null;
  dash: 'solid' | 'dashed' | 'dotted' | null;
  width: 1 | 1.5 | 2 | 3 | 4 | null;
  color: ColorRef | null;
  animated: boolean | null;
}>;

interface DeckEditor {
  /** Writes only the keys in `patch` to every edge; a default value or null removes the key. */
  setEdgeStyle(edgeIds: readonly Id[], patch: EdgeStylePatch): void;
  /** Unchanged; delegates to setEdgeStyle. */
  setEdgeShape(edgeIds: readonly Id[], shape: EdgeShape): void;
  /**
   * EdgeRoutePatch gains fromAt, toAt and waypoints (null removes a key; null patch resets the
   * whole route). Setting waypoints on a route with offset removes offset and pins
   * style.shape = 'elbow' when no shape is stored.
   */
  setEdgeRoute(edgeId: Id, patch: EdgeRoutePatch | null): void;
  /** Stores labelAt; null or 0.5 removes it. */
  setEdgeLabelAt(edgeId: Id, at: number | null): void;
}

/** Effective values with defaults applied (pure). */
function edgeLineStyle(edge: Pick<Edge, 'style' | 'route'>): {
  shape: EdgeShape;
  dash: Dash;
  width: Width;
  color: ColorRef | null;
  animated: boolean;
};
```

Errors: unknown id, a value outside the enums, `fromAt` without a side, or `waypoints` with both
`x` and `dx` throw the existing validation error and write nothing.

## `apps/app/src/editor/routing/connector-geometry.ts` (pure, no DOM)

```ts
anchorPoint(box: Box, side: Side, at?: number): Point
cardCentre(box: Box): Point
encodeWaypoint(point: Point, sourceCentre: Point, targetCentre: Point): RouteWaypoint
decodeWaypoints(waypoints: readonly RouteWaypoint[], sourceCentre: Point, targetCentre: Point): Point[]
offsetBends(segment: RouteSegment): [Point, Point]          // 017 offset → implicit bends
autoSides(fromBox, toBox, bends, route): ResolvedSides       // faces the first / last bend
pointsToPath(points: readonly Point[], shape: PathShape, ends: EndNormals, options): RoutedShapePath
simplifyWaypoints(points: readonly Point[], tolerance: number): Point[]
snapBend(point, neighbours, grid: 22, tolerance): { point; guides }
projectOnPath(samples: PathSamples, point: Point): number    // → fraction 0–1
labelPoint(samples: PathSamples, at: number, clamp: number): Point
samplePath(path: string, count?: number): PathSamples
```

Guarantees (unit-tested):

- With no waypoints, no `fromAt` / `toAt`: output identical to `routedPath` today for every shape,
  direction and self-loop.
- `decodeWaypoints(encodeWaypoint(p, s, t), s, t)` returns `p` within 1e-9.
- Translating both centres by `d` translates every decoded bend by `d` exactly.
- Elbow output has only horizontal and vertical runs; curved passes through every point.
- `simplifyWaypoints` never removes a point farther than `tolerance` from its neighbours' segment.
- `labelPoint` stays on the path and at least `clamp` from each end.

## `apps/app/src/editor/style/line-colour.ts` (pure)

```ts
lineColour(ref: ColorRef | null, theme: 'light' | 'dark'): string   // token var or adjusted hex
lineDash(dash: Dash, width: number): string | undefined             // dashed 4w 3.5w, dotted 0 3w (round caps)
```

Contrast test: every named colour and a set of light / dark custom hex reach ≥ 3:1 on the canvas in
both themes after `lineColour`.
