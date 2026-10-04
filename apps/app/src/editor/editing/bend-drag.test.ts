import { createEditor, fromJSON, toJSON } from '@sododeck/model';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { decodeWaypoints } from '../routing/connector-geometry';
import {
  addBendAt,
  cancelBendDrag,
  endBendDrag,
  moveBend,
  nudgeBend,
  removeBend,
  startBendDrag,
  type BendContext,
} from './bend-drag';
import { cancelActiveGesture, hasActiveGesture, resetActiveGesture } from './drag-session';

const file = (route?: NonNullable<SododeckFile['edges'][number]['route']>): SododeckFile => ({
  ...emptySododeckFile(),
  nodes: [
    { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
    { id: 'b', type: 'service', title: 'B', position: { x: 400, y: 200 } },
  ],
  edges: [{ id: 'e', from: 'a', to: 'b', ...(route === undefined ? {} : { route }) }],
});

const initialUi = useUiStore.getState();
beforeEach(() => {
  useUiStore.setState(initialUi, true);
});

// Card centres, line ends and bends as the canvas would pass them.
const from = { x: 80, y: 25 };
const to = { x: 480, y: 225 };
const ctx = (bends: BendContext['bends'] = []): BendContext => ({
  edgeId: 'e',
  fromCentre: from,
  toCentre: to,
  start: { x: 160, y: 25 },
  end: { x: 400, y: 225 },
  bends,
});

function setup(route?: Parameters<typeof file>[0]) {
  const doc = fromJSON(file(route));
  const editor = createEditor(doc, { captureTimeout: 0 });
  return { doc, editor, route: () => toJSON(doc).edges[0]?.route };
}

describe('startBendDrag / moveBend / endBendDrag', () => {
  it('inserts a bend at the right index, previews it, and writes nothing until release', () => {
    const { editor, doc } = setup();
    const session = startBendDrag(editor, ctx(), { kind: 'add', index: 0, at: { x: 280, y: 125 } });
    expect(useUiStore.getState().canvasGesture).toBe('bend');
    moveBend(session, { x: 300, y: 130 }, { mod: false, zoom: 1 });
    expect(useUiStore.getState().bendPreview).toEqual({ edgeId: 'e', bends: [{ x: 308, y: 132 }] });
    expect(toJSON(doc).edges[0]).not.toHaveProperty('route');
    expect(editor.canUndo()).toBe(false);
  });

  it('snaps to a neighbour line within 6 screen px, else to the 22 px grid; ⌘ disables', () => {
    const { editor } = setup();
    const session = startBendDrag(editor, ctx(), { kind: 'add', index: 0, at: { x: 280, y: 125 } });
    moveBend(session, { x: 163, y: 130 }, { mod: false, zoom: 1 });
    expect(session.live[0]?.x).toBe(160); // aligned with the start
    moveBend(session, { x: 301, y: 131 }, { mod: false, zoom: 1 });
    expect(session.live[0]).toEqual({ x: 308, y: 132 });
    moveBend(session, { x: 301, y: 131 }, { mod: true, zoom: 1 });
    expect(session.live[0]).toEqual({ x: 301, y: 131 });
    // the threshold is in screen px: at zoom 0.5 a 5 px canvas gap is 2.5 screen px
    moveBend(session, { x: 405, y: 131 }, { mod: false, zoom: 0.5 });
    expect(session.live[0]?.x).toBe(400);
  });

  it('release writes the encoded waypoints once and announces', () => {
    const { editor, route } = setup();
    const session = startBendDrag(editor, ctx(), { kind: 'add', index: 0, at: { x: 280, y: 125 } });
    moveBend(session, { x: 308, y: 20 }, { mod: true, zoom: 1 });
    endBendDrag(editor, session);
    const [point] = decodeWaypoints(route()?.waypoints ?? [], from, to);
    expect(point?.x).toBeCloseTo(308, 1);
    expect(point?.y).toBeCloseTo(20, 1);
    expect(useUiStore.getState().announcement.text).toBe('Bend added');
    expect(useUiStore.getState().canvasGesture).toBeNull();
    expect(useUiStore.getState().bendPreview).toBeNull();
    editor.undo();
    expect(route()).toBeUndefined();
  });

  it('a release that changes nothing writes nothing', () => {
    const { editor } = setup({ waypoints: [{ x: 0.5, y: 0 }] });
    const bend = decodeWaypoints([{ x: 0.5, y: 0 }], from, to);
    const session = startBendDrag(editor, ctx(bend), { kind: 'move', index: 0 });
    moveBend(session, bend[0] ?? from, { mod: true, zoom: 1 });
    endBendDrag(editor, session);
    expect(editor.canUndo()).toBe(false);
  });

  it('dropping a bend onto the line between its neighbours removes it (auto-simplify)', () => {
    const { editor, route } = setup({ waypoints: [{ x: 0.5, y: 0 }] });
    const bend = decodeWaypoints([{ x: 0.5, y: 0 }], from, to);
    const session = startBendDrag(editor, ctx(bend), { kind: 'move', index: 0 });
    // halfway between start (160,25) and end (400,225)
    moveBend(session, { x: 280, y: 125 }, { mod: true, zoom: 1 });
    endBendDrag(editor, session);
    expect(route()).toBeUndefined();
    expect(useUiStore.getState().announcement.text).toBe('Bend removed');
  });

  it('Esc cancels with no write', () => {
    const { editor, route } = setup();
    const session = startBendDrag(editor, ctx(), { kind: 'add', index: 0, at: { x: 280, y: 125 } });
    moveBend(session, { x: 300, y: 50 }, { mod: true, zoom: 1 });
    expect(cancelActiveGesture()).toBe(true);
    endBendDrag(editor, session);
    expect(route()).toBeUndefined();
    expect(editor.canUndo()).toBe(false);
    expect(useUiStore.getState().canvasGesture).toBeNull();
    expect(useUiStore.getState().bendPreview).toBeNull();
  });

  it('R resets the whole route as its own undo step', () => {
    const { editor, route } = setup({ fromSide: 'right', waypoints: [{ x: 0.5, y: 0 }] });
    const bend = decodeWaypoints([{ x: 0.5, y: 0 }], from, to);
    const session = startBendDrag(editor, ctx(bend), { kind: 'move', index: 0 });
    moveBend(session, { x: 10, y: 10 }, { mod: true, zoom: 1 });
    expect(resetActiveGesture()).toBe(true);
    expect(route()).toBeUndefined();
    expect(useUiStore.getState().announcement.text).toBe('Route reset');
    editor.undo();
    expect(route()).toEqual({ fromSide: 'right', waypoints: [{ x: 0.5, y: 0 }] });
  });

  it('a session on a 017 offset starts from its two corner bends and its write removes offset', () => {
    const { editor, route, doc } = setup({ fromSide: 'right', toSide: 'left', offset: 30 });
    const corners = [
      { x: 310, y: 25 },
      { x: 310, y: 225 },
    ];
    const session = startBendDrag(editor, ctx(corners), { kind: 'move', index: 1 });
    moveBend(session, { x: 330, y: 250 }, { mod: true, zoom: 1 });
    endBendDrag(editor, session);
    expect(route()?.offset).toBeUndefined();
    expect(route()?.waypoints).toHaveLength(2);
    expect(toJSON(doc).edges[0]?.style).toEqual({ shape: 'elbow' });
  });

  it('cancelBendDrag clears the preview', () => {
    const { editor } = setup();
    const session = startBendDrag(editor, ctx(), { kind: 'add', index: 0, at: { x: 1, y: 1 } });
    cancelBendDrag(session);
    expect(useUiStore.getState().bendPreview).toBeNull();
  });

  it.each([
    ['release', 'end'],
    ['cancel', 'cancel'],
    ['release after a cancel', 'cancel-then-end'],
  ] as const)('clears guides, preview, readout and the gesture on %s (050 R9)', (_name, exit) => {
    const { editor } = setup();
    const session = startBendDrag(editor, ctx(), { kind: 'add', index: 0, at: { x: 280, y: 125 } });
    moveBend(session, { x: 300, y: 130 }, { mod: false, zoom: 1 });
    if (exit === 'cancel' || exit === 'cancel-then-end') cancelBendDrag(session);
    // Something left a guide behind after the cancel: the release must still clear it.
    useUiStore.getState().setGuides([{ axis: 'x', at: 1, from: 0, to: 1 }]);
    if (exit === 'end' || exit === 'cancel-then-end') endBendDrag(editor, session);
    if (exit === 'cancel') cancelBendDrag(session);
    const ui = useUiStore.getState();
    expect(ui.guides).toHaveLength(0);
    expect(ui.bendPreview).toBeNull();
    expect(ui.connectorReadout).toBeNull();
    expect(ui.canvasGesture).toBeNull();
    expect(hasActiveGesture()).toBe(false);
  });
});

describe('keyboard edits', () => {
  it('removeBend drops only that bend; the connector stays', () => {
    const { editor, route, doc } = setup({
      waypoints: [
        { x: 0.3, y: 0 },
        { x: 0.6, y: 1 },
      ],
    });
    const bends = decodeWaypoints(route()?.waypoints ?? [], from, to);
    removeBend(editor, ctx(bends), 0);
    expect(route()?.waypoints).toHaveLength(1);
    expect(toJSON(doc).edges).toHaveLength(1);
    expect(useUiStore.getState().announcement.text).toBe('Bend removed');
    removeBend(editor, ctx(decodeWaypoints(route()?.waypoints ?? [], from, to)), 0);
    expect(route()).toBeUndefined();
    expect(toJSON(doc).edges).toHaveLength(1);
  });

  it('addBendAt adds a bend at the midpoint', () => {
    const { editor, route } = setup();
    addBendAt(editor, ctx(), 0, { x: 280, y: 125 });
    expect(route()?.waypoints).toHaveLength(1);
    expect(useUiStore.getState().announcement.text).toBe('Bend added');
  });

  it('nudgeBend moves by 22 px or 1 px, one undo step each', () => {
    const { editor, route } = setup({ waypoints: [{ x: 0.5, y: 0.5 }] });
    const at = () => decodeWaypoints(route()?.waypoints ?? [], from, to);
    const start = at()[0];
    nudgeBend(editor, ctx(at()), 0, { x: 22, y: 0 });
    expect(at()[0]?.x).toBeCloseTo((start?.x ?? 0) + 22, 1);
    nudgeBend(editor, ctx(at()), 0, { x: 0, y: -1 });
    expect(at()[0]?.y).toBeCloseTo((start?.y ?? 0) - 1, 1);
    editor.undo();
    expect(at()[0]?.y).toBeCloseTo(start?.y ?? 0, 1);
    editor.undo();
    expect(at()[0]?.x).toBeCloseTo(start?.x ?? 0, 1);
  });
});
