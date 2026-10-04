import { createEditor, fromJSON, toJSON } from '@sododeck/model';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { targetScene, type SceneNode } from '../routing/endpoint-target';
import { cancelActiveGesture, hasActiveGesture } from './drag-session';
import {
  cancelEndpointDrag,
  endEndpointDrag,
  moveEndpoint,
  startEndpointDrag,
  type EndpointContext,
} from './endpoint-drag';

type Route = NonNullable<SododeckFile['edges'][number]['route']>;

const file = (route?: Route, extraEdges: SododeckFile['edges'] = []): SododeckFile => ({
  ...emptySododeckFile(),
  nodes: [
    { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 }, group: 'g' },
    { id: 'b', type: 'service', title: 'B', position: { x: 400, y: 200 } },
    { id: 'c', type: 'service', title: 'C', position: { x: 400, y: -200 } },
  ],
  groups: [{ id: 'g', title: 'Data layer' }],
  edges: [
    { id: 'e', from: 'a', to: 'b', ...(route === undefined ? {} : { route }) },
    ...extraEdges,
  ],
});

const card = (id: string, x: number, y: number): SceneNode => ({
  id,
  type: 'deck',
  position: { x, y },
  width: 200,
  height: 100,
  data: {},
});

const scene = targetScene([
  {
    id: 'group:g',
    type: 'group-boundary',
    position: { x: -40, y: -40 },
    width: 280,
    height: 400,
    zIndex: -1,
    data: {},
  },
  card('a', 0, 0),
  card('b', 400, 200),
  card('c', 400, -200),
]);

/** The target end of `e`, drawn on B's left side middle. */
const ctx = (extra: Partial<EndpointContext> = {}): EndpointContext => ({
  edgeId: 'e',
  end: 'target',
  ownId: 'b',
  otherId: 'a',
  start: { x: 400, y: 250 },
  scene,
  ...extra,
});

const free = { mod: true, zoom: 1 };

const initialUi = useUiStore.getState();
beforeEach(() => {
  useUiStore.setState(initialUi, true);
});

function setup(route?: Route, extraEdges?: SododeckFile['edges']) {
  const doc = fromJSON(file(route, extraEdges));
  const editor = createEditor(doc, { captureTimeout: 0 });
  const edge = () => toJSON(doc).edges.find((e) => e.id === 'e');
  const ui = () => useUiStore.getState();
  return { doc, editor, edge, ui };
}

describe('endpoint drag (050 US2)', () => {
  it('press and release without a move writes nothing (FR-007)', () => {
    const { editor, edge, ui } = setup();
    const session = startEndpointDrag(editor, ctx(), { x: 400, y: 250 });
    expect(ui().canvasGesture).toBe('endpoint');
    expect(hasActiveGesture()).toBe(true);
    endEndpointDrag(editor, session);
    expect(edge()).toEqual({ id: 'e', from: 'a', to: 'b' });
    expect(editor.canUndo()).toBe(false);
    expect(ui().endpointPreview).toBeNull();
    expect(ui().canvasGesture).toBeNull();
    expect(hasActiveGesture()).toBe(false);
  });

  it('keeps the pointer offset: a drag by (dx, dy) moves the end from where it was', () => {
    const { editor, ui } = setup();
    // pressed 5 px left of and 5 px below the end
    const session = startEndpointDrag(editor, ctx(), { x: 395, y: 255 });
    moveEndpoint(session, { x: 395, y: 235 }, free);
    expect(ui().endpointPreview).toMatchObject({
      edgeId: 'e',
      end: 'target',
      targetId: 'b',
      targetKind: 'node',
      side: 'left',
      at: 0.3,
      point: { x: 400, y: 230 },
      automatic: false,
      valid: 'ok',
    });
    expect(ui().connectorReadout).toBe('left side · 30 %');
  });

  it('writes nothing during the drag; sliding on the same card writes toSide/toAt once', () => {
    const { editor, edge, ui } = setup();
    const session = startEndpointDrag(editor, ctx(), { x: 400, y: 250 });
    moveEndpoint(session, { x: 390, y: 270 }, free);
    moveEndpoint(session, { x: 390, y: 230 }, free);
    expect(edge()).not.toHaveProperty('route');
    endEndpointDrag(editor, session);
    expect(edge()?.route).toEqual({ toSide: 'left', toAt: 0.3 });
    expect(ui().announcement.text).toBe('Anchor left side · 30 %');
    expect(ui().endpointPreview).toBeNull();
    editor.undo();
    expect(edge()).not.toHaveProperty('route');
    expect(editor.canUndo()).toBe(false);
  });

  it('snaps to the side middle and says so', () => {
    const { editor, ui } = setup();
    const session = startEndpointDrag(editor, ctx(), { x: 400, y: 250 });
    moveEndpoint(session, { x: 390, y: 253 }, { mod: false, zoom: 1 });
    expect(ui().endpointPreview).toMatchObject({ side: 'left', at: 0.5, snapped: true });
    expect(ui().connectorReadout).toBe('left side · 50 % · snapped');
  });

  it('an unchanged result writes nothing', () => {
    const { editor, edge } = setup({ toSide: 'left', toAt: 0.3 });
    const session = startEndpointDrag(
      editor,
      ctx({ side: 'left', at: 0.3, start: { x: 400, y: 230 } }),
      {
        x: 400,
        y: 230,
      },
    );
    moveEndpoint(session, { x: 390, y: 260 }, free);
    moveEndpoint(session, { x: 390, y: 230 }, free);
    endEndpointDrag(editor, session);
    expect(edge()?.route).toEqual({ toSide: 'left', toAt: 0.3 });
    expect(editor.canUndo()).toBe(false);
  });

  it('dropping in the centre zone of its own card makes the end automatic', () => {
    const { editor, edge, ui } = setup({ toSide: 'top', toAt: 0.2 });
    const session = startEndpointDrag(
      editor,
      ctx({ side: 'top', at: 0.2, start: { x: 440, y: 200 } }),
      { x: 440, y: 200 },
    );
    moveEndpoint(session, { x: 500, y: 250 }, free);
    expect(ui().endpointPreview).toMatchObject({ automatic: true, targetId: 'b' });
    expect(ui().connectorReadout).toBe('automatic');
    endEndpointDrag(editor, session);
    expect(edge()).not.toHaveProperty('route');
    expect(ui().announcement.text).toBe('End back to automatic');
    editor.undo();
    expect(edge()?.route).toEqual({ toSide: 'top', toAt: 0.2 });
  });

  it('the centre zone of an already automatic end changes nothing', () => {
    const { editor, edge } = setup();
    const session = startEndpointDrag(editor, ctx(), { x: 400, y: 250 });
    moveEndpoint(session, { x: 500, y: 250 }, free);
    endEndpointDrag(editor, session);
    expect(edge()).toEqual({ id: 'e', from: 'a', to: 'b' });
    expect(editor.canUndo()).toBe(false);
  });

  it('released off every target: no write, and says why', () => {
    const { editor, edge, ui } = setup();
    const session = startEndpointDrag(editor, ctx(), { x: 400, y: 250 });
    moveEndpoint(session, { x: 1000, y: 1000 }, free);
    expect(ui().endpointPreview).toMatchObject({
      targetId: null,
      point: { x: 1000, y: 1000 },
      valid: 'none',
    });
    endEndpointDrag(editor, session);
    expect(edge()).toEqual({ id: 'e', from: 'a', to: 'b' });
    expect(editor.canUndo()).toBe(false);
    expect(ui().announcement.text).toBe('Not connected: drop on a card or group');
  });

  it('dropping on another card writes `to` and the side in one undo step', () => {
    const { editor, edge, ui } = setup();
    const session = startEndpointDrag(editor, ctx(), { x: 400, y: 250 });
    moveEndpoint(session, { x: 450, y: -90 }, free);
    expect(ui().endpointPreview).toMatchObject({ targetId: 'c', side: 'bottom', at: 0.25 });
    expect(ui().connectorReadout).toBe('→ C');
    endEndpointDrag(editor, session);
    expect(edge()).toMatchObject({ from: 'a', to: 'c', route: { toSide: 'bottom', toAt: 0.25 } });
    expect(ui().announcement.text).toBe('Connection now enters C');
    editor.undo();
    expect(edge()).toEqual({ id: 'e', from: 'a', to: 'b' });
    expect(editor.canUndo()).toBe(false);
  });

  it('moves the source end the same way', () => {
    const { editor, edge, ui } = setup();
    const session = startEndpointDrag(
      editor,
      ctx({ end: 'source', ownId: 'a', otherId: 'b', start: { x: 200, y: 50 } }),
      { x: 200, y: 50 },
    );
    moveEndpoint(session, { x: 450, y: -90 }, free);
    endEndpointDrag(editor, session);
    expect(edge()).toMatchObject({
      from: 'c',
      to: 'b',
      route: { fromSide: 'bottom', fromAt: 0.25 },
    });
    expect(ui().announcement.text).toBe('Connection now leaves C');
  });

  it('refuses a self connection and a duplicate, writing nothing', () => {
    const { editor, edge, ui } = setup(undefined, [{ id: 'f', from: 'c', to: 'a' }]);
    let session = startEndpointDrag(editor, ctx(), { x: 400, y: 250 });
    moveEndpoint(session, { x: 100, y: 50 }, free);
    expect(ui().endpointPreview).toMatchObject({ targetId: 'a', valid: 'self' });
    endEndpointDrag(editor, session);
    expect(ui().announcement.text).toBe("Can't connect to itself");
    session = startEndpointDrag(editor, ctx(), { x: 400, y: 250 });
    moveEndpoint(session, { x: 500, y: -150 }, free);
    expect(ui().endpointPreview).toMatchObject({ targetId: 'c', valid: 'duplicate' });
    endEndpointDrag(editor, session);
    expect(ui().announcement.text).toBe('Already connected');
    expect(edge()).toEqual({ id: 'e', from: 'a', to: 'b' });
    expect(editor.canUndo()).toBe(false);
  });

  it('a group is not a drop target while group ends are off', () => {
    const { editor, edge, ui } = setup();
    const session = startEndpointDrag(editor, ctx(), { x: 400, y: 250 });
    // inside the frame of g, below card A
    moveEndpoint(session, { x: 100, y: 300 }, free);
    expect(ui().endpointPreview).toMatchObject({ targetId: null, valid: 'none' });
    endEndpointDrag(editor, session);
    expect(edge()).toEqual({ id: 'e', from: 'a', to: 'b' });
    expect(ui().announcement.text).toBe('Not connected: drop on a card or group');
  });

  it('with group ends allowed, dropping on a group frame connects to the group', () => {
    const { editor, edge, ui } = setup();
    // The source end of `e`, drawn on A's right side middle, moved onto the frame of g: g → b.
    const start = { x: 200, y: 50 };
    const session = startEndpointDrag(
      editor,
      ctx({ allowGroups: true, end: 'source', ownId: 'a', otherId: 'b', start }),
      start,
    );
    moveEndpoint(session, { x: 240, y: 300 }, free);
    expect(ui().endpointPreview).toMatchObject({
      targetId: 'g',
      targetKind: 'group',
      side: 'right',
    });
    expect(ui().connectorReadout).toBe('→ Data layer (group)');
    endEndpointDrag(editor, session);
    expect(edge()).toMatchObject({ from: 'g', to: 'b', route: { fromSide: 'right' } });
    expect(ui().announcement.text).toBe('Connection now leaves Data layer');
    expect(editor.canUndo()).toBe(true);
    editor.undo();
    expect(edge()).toEqual({ id: 'e', from: 'a', to: 'b' });
  });

  it("refuses reconnecting to a group that holds the other end ('contains')", () => {
    const { editor, edge, ui } = setup();
    // e is a → b and a sits in g: the target end can't go onto g.
    const session = startEndpointDrag(editor, ctx({ allowGroups: true }), { x: 400, y: 250 });
    moveEndpoint(session, { x: 240, y: 300 }, free);
    expect(ui().endpointPreview).toMatchObject({ targetId: 'g', valid: 'contains' });
    expect(ui().connectorReadout).toBe("Can't connect a group to something inside it");
    endEndpointDrag(editor, session);
    expect(ui().announcement.text).toBe("Can't connect a group to something inside it");
    expect(edge()).toEqual({ id: 'e', from: 'a', to: 'b' });
    expect(editor.canUndo()).toBe(false);
  });

  it('Esc (the gesture cancel) and blur (cancelEndpointDrag) clear the preview, no write', () => {
    const { editor, edge, ui } = setup();
    let session = startEndpointDrag(editor, ctx(), { x: 400, y: 250 });
    moveEndpoint(session, { x: 450, y: -90 }, free);
    expect(cancelActiveGesture()).toBe(true);
    expect(ui().endpointPreview).toBeNull();
    expect(ui().connectorReadout).toBeNull();
    expect(ui().canvasGesture).toBeNull();
    expect(hasActiveGesture()).toBe(false);
    endEndpointDrag(editor, session);
    session = startEndpointDrag(editor, ctx(), { x: 400, y: 250 });
    moveEndpoint(session, { x: 450, y: -90 }, free);
    cancelEndpointDrag(session);
    expect(ui().endpointPreview).toBeNull();
    endEndpointDrag(editor, session);
    expect(edge()).toEqual({ id: 'e', from: 'a', to: 'b' });
    expect(editor.canUndo()).toBe(false);
  });
});
