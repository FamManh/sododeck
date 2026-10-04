import { createEditor, fromJSON, toJSON } from '@sododeck/model';
import { emptySododeckFile, type EdgeRoute, type SododeckFile } from '@sododeck/schema';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { decodeWaypoints, encodeWaypoint } from '../routing/connector-geometry';
import { elbowRuns, type Run } from '../routing/elbow-runs';
import type { Point } from '../routing/route-path';
import { cancelActiveGesture, hasActiveGesture, resetActiveGesture } from './drag-session';
import {
  cancelSegmentDrag,
  endSegmentDrag,
  moveSegment,
  nudgeSegment,
  resetSegment,
  segmentVertices,
  startSegmentDrag,
  type SegmentContext,
} from './segment-drag';

// Card A at (0,0) and card B at (400,200), both 160 × 50; right side → left side.
const fromBox = { x: 0, y: 0, width: 160, height: 50 };
const toBox = { x: 400, y: 200, width: 160, height: 50 };
const fromCentre = { x: 80, y: 25 };
const toCentre = { x: 480, y: 225 };

const file = (route?: EdgeRoute, style = true): SododeckFile => ({
  ...emptySododeckFile(),
  nodes: [
    { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
    { id: 'b', type: 'service', title: 'B', position: { x: 400, y: 200 } },
  ],
  edges: [
    {
      id: 'e',
      from: 'a',
      to: 'b',
      ...(style ? { style: { shape: 'elbow' as const } } : {}),
      ...(route === undefined ? {} : { route }),
    },
  ],
});

function setup(route?: EdgeRoute, style = true) {
  const doc = fromJSON(file(route, style));
  const editor = createEditor(doc, { captureTimeout: 0 });
  return { doc, editor, route: () => toJSON(doc).edges[0]?.route };
}

/** The context the canvas passes: line ends on the cards, the drawn bends, and both end boxes. */
function ctx(
  bends: readonly Point[] = [],
  ends: { fromAt?: number; toAt?: number } = {},
): SegmentContext {
  const fromAt = ends.fromAt ?? 0.5;
  const toAt = ends.toAt ?? 0.5;
  return {
    edgeId: 'e',
    fromCentre,
    toCentre,
    start: { x: 160, y: 50 * fromAt },
    end: { x: 400, y: 200 + 50 * toAt },
    bends,
    fromBox,
    toBox,
    fromSide: 'right',
    toSide: 'left',
    fromAt,
    toAt,
  };
}

function runOf(c: SegmentContext, index: number): Run {
  const run = elbowRuns(segmentVertices(c), 0, 1).find((r) => r.index === index);
  if (run === undefined) throw new Error(`no run ${String(index)}`);
  return run;
}

const encoded = (points: readonly Point[]) =>
  points.map((p) => encodeWaypoint(p, fromCentre, toCentre));

const initialUi = useUiStore.getState();
beforeEach(() => {
  useUiStore.setState(initialUi, true);
});

describe('segmentVertices', () => {
  it('is the drawn elbow: an automatic Z between facing sides', () => {
    expect(segmentVertices(ctx())).toEqual([
      { x: 160, y: 25 },
      { x: 280, y: 25 },
      { x: 280, y: 225 },
      { x: 400, y: 225 },
    ]);
  });
});

describe('inner runs', () => {
  it('move both bends on the run axis only, previewing without writing', () => {
    const { editor, doc } = setup();
    const c = ctx();
    const session = startSegmentDrag(editor, c, runOf(c, 1));
    expect(useUiStore.getState().canvasGesture).toBe('segment');
    expect(hasActiveGesture()).toBe(true);
    moveSegment(session, { x: 330, y: 999 }, { mod: true, zoom: 1 });
    expect(useUiStore.getState().bendPreview).toEqual({
      edgeId: 'e',
      bends: [
        { x: 330, y: 25 },
        { x: 330, y: 225 },
      ],
    });
    expect(useUiStore.getState().connectorReadout).toBe('x 330');
    expect(toJSON(doc).edges[0]).not.toHaveProperty('route');
    expect(editor.canUndo()).toBe(false);
  });

  it('keeps the grab offset, so pressing off the run centre does not jump it', () => {
    const { editor } = setup();
    const c = ctx();
    const session = startSegmentDrag(editor, c, runOf(c, 1), { x: 284, y: 120 });
    moveSegment(session, { x: 294, y: 120 }, { mod: true, zoom: 1 });
    expect(useUiStore.getState().bendPreview?.bends[0]).toEqual({ x: 290, y: 25 });
  });

  it('materialises an automatic elbow on release: bends written, sides pinned, one undo step', () => {
    const { editor, route } = setup();
    const c = ctx();
    const session = startSegmentDrag(editor, c, runOf(c, 1));
    moveSegment(session, { x: 330, y: 0 }, { mod: true, zoom: 1 });
    endSegmentDrag(editor, session);
    const stored = route();
    expect(stored?.fromSide).toBe('right');
    expect(stored?.toSide).toBe('left');
    const bends = decodeWaypoints(stored?.waypoints ?? [], fromCentre, toCentre);
    expect(bends.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }))).toEqual([
      { x: 330, y: 25 },
      { x: 330, y: 225 },
    ]);
    expect(useUiStore.getState().announcement.text).toBe('Segment moved');
    expect(useUiStore.getState().canvasGesture).toBeNull();
    expect(useUiStore.getState().bendPreview).toBeNull();
    expect(hasActiveGesture()).toBe(false);
    editor.undo();
    expect(route()).toBeUndefined();
  });

  it('materialises a 017 offset (022 rule): offset removed, elbow pinned', () => {
    const { editor, route, doc } = setup({ fromSide: 'right', toSide: 'left', offset: 30 }, false);
    const corners = [
      { x: 310, y: 25 },
      { x: 310, y: 225 },
    ];
    const c = ctx(corners);
    const session = startSegmentDrag(editor, c, runOf(c, 1));
    moveSegment(session, { x: 352, y: 0 }, { mod: true, zoom: 1 });
    endSegmentDrag(editor, session);
    expect(route()?.offset).toBeUndefined();
    expect(route()?.waypoints).toHaveLength(2);
    expect(toJSON(doc).edges[0]?.style).toEqual({ shape: 'elbow' });
  });

  it('snaps to the neighbouring run lines and the 22 px grid; ⌘ disables', () => {
    const { editor } = setup();
    const c = ctx();
    const session = startSegmentDrag(editor, c, runOf(c, 1));
    const x = () => useUiStore.getState().bendPreview?.bends[0]?.x;
    moveSegment(session, { x: 164, y: 0 }, { mod: false, zoom: 1 });
    expect(x()).toBe(160); // in line with the start run's end
    expect(useUiStore.getState().guides).toEqual([{ axis: 'x', at: 160, from: 25, to: 225 }]);
    moveSegment(session, { x: 301, y: 0 }, { mod: false, zoom: 1 });
    expect(x()).toBe(308);
    expect(useUiStore.getState().guides).toEqual([]);
    moveSegment(session, { x: 301, y: 0 }, { mod: true, zoom: 1 });
    expect(x()).toBe(301);
    // 6 screen px: at zoom 0.5 a 5 px canvas gap is 2.5 screen px
    moveSegment(session, { x: 405, y: 0 }, { mod: false, zoom: 0.5 });
    expect(x()).toBe(400);
  });

  it('release simplifies: a run snapped in line with its neighbour drops its bends', () => {
    const { editor, route } = setup();
    const c = ctx();
    const session = startSegmentDrag(editor, c, runOf(c, 1));
    moveSegment(session, { x: 160, y: 0 }, { mod: false, zoom: 1 });
    endSegmentDrag(editor, session);
    const bends = decodeWaypoints(route()?.waypoints ?? [], fromCentre, toCentre);
    expect(bends.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }))).toEqual([
      { x: 160, y: 225 },
    ]);
  });

  it('a release that changes nothing writes nothing', () => {
    const { editor } = setup();
    const c = ctx();
    const session = startSegmentDrag(editor, c, runOf(c, 1));
    moveSegment(session, { x: 280, y: 40 }, { mod: true, zoom: 1 });
    endSegmentDrag(editor, session);
    expect(editor.canUndo()).toBe(false);
  });
});

describe('start and end runs', () => {
  it('a start run changes only fromAt, with the side pinned', () => {
    const { editor, route } = setup();
    const c = ctx();
    const session = startSegmentDrag(editor, c, runOf(c, 0));
    moveSegment(session, { x: 200, y: 40 }, { mod: true, zoom: 1 });
    // An automatic route stays automatic: only the end moves, so the preview has no bends.
    expect(useUiStore.getState().bendPreview).toEqual({ edgeId: 'e', bends: [], fromAt: 0.8 });
    expect(useUiStore.getState().connectorReadout).toBe('right side · 80 %');
    endSegmentDrag(editor, session);
    expect(route()).toEqual({ fromSide: 'right', fromAt: 0.8 });
  });

  it('an end run changes only toAt, clamped to 0–1', () => {
    const { editor, route } = setup();
    const c = ctx();
    const session = startSegmentDrag(editor, c, runOf(c, 2));
    moveSegment(session, { x: 380, y: 999 }, { mod: true, zoom: 1 });
    expect(useUiStore.getState().bendPreview?.toAt).toBe(1);
    moveSegment(session, { x: 380, y: -50 }, { mod: true, zoom: 1 });
    expect(useUiStore.getState().bendPreview?.toAt).toBe(0);
    endSegmentDrag(editor, session);
    expect(route()).toEqual({ toSide: 'left', toAt: 0 });
  });

  it('on a bent connector, the next bend follows so the right angle stays', () => {
    const bends = [
      { x: 330, y: 25 },
      { x: 330, y: 225 },
    ];
    const { editor, route } = setup({ waypoints: encoded(bends) });
    const c = ctx(bends);
    const session = startSegmentDrag(editor, c, runOf(c, 0));
    moveSegment(session, { x: 200, y: 10 }, { mod: true, zoom: 1 });
    endSegmentDrag(editor, session);
    const stored = route();
    expect(stored?.fromSide).toBe('right');
    expect(stored?.fromAt).toBe(0.2);
    const drawn = decodeWaypoints(stored?.waypoints ?? [], fromCentre, toCentre);
    expect(drawn.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }))).toEqual([
      { x: 330, y: 10 },
      { x: 330, y: 225 },
    ]);
  });

  it('snaps along the side to the grid, ⌘ off', () => {
    const { editor } = setup();
    const c = ctx();
    const session = startSegmentDrag(editor, c, runOf(c, 0));
    moveSegment(session, { x: 200, y: 30 }, { mod: false, zoom: 1 });
    expect(useUiStore.getState().bendPreview?.fromAt).toBe(0.44);
    moveSegment(session, { x: 200, y: 30 }, { mod: true, zoom: 1 });
    expect(useUiStore.getState().bendPreview?.fromAt).toBe(0.6);
  });
});

describe('resetSegment', () => {
  it("drops an inner run's two bends", () => {
    const bends = [
      { x: 330, y: 25 },
      { x: 330, y: 225 },
    ];
    const { editor, route } = setup({ waypoints: encoded(bends) });
    const c = ctx(bends);
    resetSegment(editor, c, runOf(c, 1));
    expect(route()).toBeUndefined();
    expect(useUiStore.getState().announcement.text).toBe('Segment reset');
    editor.undo();
    expect(route()?.waypoints).toHaveLength(2);
  });

  it("clears an end run's at", () => {
    const { editor, route } = setup({ fromSide: 'right', fromAt: 0.8 });
    const c = ctx([], { fromAt: 0.8 });
    resetSegment(editor, c, runOf(c, 0));
    expect(route()).toEqual({ fromSide: 'right' });
  });

  it('does nothing on an automatic run', () => {
    const { editor } = setup();
    const c = ctx();
    resetSegment(editor, c, runOf(c, 1));
    expect(editor.canUndo()).toBe(false);
  });
});

describe('cancel', () => {
  it('Esc writes nothing and clears the preview, guides and gesture', () => {
    const { editor, route } = setup();
    const c = ctx();
    const session = startSegmentDrag(editor, c, runOf(c, 1));
    moveSegment(session, { x: 164, y: 0 }, { mod: false, zoom: 1 });
    expect(cancelActiveGesture()).toBe(true);
    expect(useUiStore.getState().announcement.text).toBe('Cancelled');
    endSegmentDrag(editor, session);
    expect(route()).toBeUndefined();
    expect(editor.canUndo()).toBe(false);
    const ui = useUiStore.getState();
    expect(ui.canvasGesture).toBeNull();
    expect(ui.bendPreview).toBeNull();
    expect(ui.guides).toEqual([]);
    expect(ui.connectorReadout).toBeNull();
    expect(hasActiveGesture()).toBe(false);
  });

  it('cancelSegmentDrag clears everything too', () => {
    const { editor } = setup();
    const c = ctx();
    const session = startSegmentDrag(editor, c, runOf(c, 1));
    moveSegment(session, { x: 330, y: 0 }, { mod: true, zoom: 1 });
    cancelSegmentDrag(session);
    expect(useUiStore.getState().bendPreview).toBeNull();
    expect(useUiStore.getState().canvasGesture).toBeNull();
    expect(hasActiveGesture()).toBe(false);
    moveSegment(session, { x: 360, y: 0 }, { mod: true, zoom: 1 });
    expect(useUiStore.getState().bendPreview).toBeNull();
  });

  it('R during the drag resets the segment as its own step', () => {
    const bends = [
      { x: 330, y: 25 },
      { x: 330, y: 225 },
    ];
    const { editor, route } = setup({ waypoints: encoded(bends) });
    const c = ctx(bends);
    const session = startSegmentDrag(editor, c, runOf(c, 1));
    moveSegment(session, { x: 400, y: 0 }, { mod: true, zoom: 1 });
    expect(resetActiveGesture()).toBe(true);
    expect(route()).toBeUndefined();
    endSegmentDrag(editor, session);
    expect(route()).toBeUndefined();
    expect(hasActiveGesture()).toBe(false);
  });
});

describe('nudgeSegment', () => {
  it('moves a run by a delta on its axis in one undo step', () => {
    const { editor, route } = setup();
    const c = ctx();
    nudgeSegment(editor, c, runOf(c, 1), 22);
    const drawn = decodeWaypoints(route()?.waypoints ?? [], fromCentre, toCentre);
    expect(drawn.map((p) => Math.round(p.x))).toEqual([302, 302]);
    expect(hasActiveGesture()).toBe(false);
    editor.undo();
    expect(route()).toBeUndefined();
  });
});
