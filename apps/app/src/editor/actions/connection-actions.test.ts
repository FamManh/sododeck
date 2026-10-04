import { toJSON } from '@sododeck/model';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { actionContext, sel, TARGETS } from '../../test/action-fixtures';
import { deckOf } from '../../test/render-canvas';
import { actionsFor } from './actions-for';
import { ACTIONS } from './index';
import type { ActionContext } from './types';
import type { MenuTarget } from '../../state/ui-store';

const ui = () => useUiStore.getState();

const deck = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
    { id: 'b', type: 'service', title: 'B', position: { x: 300, y: 0 } },
  ],
  edges: [
    { id: 'e1', from: 'a', to: 'b' },
    { id: 'e2', from: 'a', to: 'b', route: { offset: 20 } },
    { id: 'e3', from: 'b', to: 'a', style: { shape: 'straight' } },
  ],
});

const many: MenuTarget = { kind: 'connections', ids: sel({ edges: ['e1', 'e2', 'e3'] }) };
const one = (id: string): MenuTarget => ({ kind: 'connection', ids: sel({ edges: [id] }) });

const lineType = (ctx: ActionContext, surface: 'menu' | 'toolbar' = 'menu') =>
  actionsFor(ACTIONS, ctx, surface)
    .flatMap((s) => s.actions)
    .find((a) => a.id === 'connection.lineType');

beforeEach(() => {
  ui().resetForDeck();
  ui().setLastLineShape('curved');
});

describe('connection.lineType (029)', () => {
  it('is offered on the menu for one connection and for connections only, not the toolbar', () => {
    expect(lineType(actionContext(one('e1'), 'edit', deck))).toBeDefined();
    expect(lineType(actionContext(many, 'edit', deck))).toBeDefined();
    expect(lineType(actionContext(one('e1'), 'edit', deck), 'toolbar')).toBeUndefined();
    for (const target of [TARGETS.mixed, TARGETS.component, TARGETS.components, TARGETS.group]) {
      expect(lineType(actionContext(target))).toBeUndefined();
    }
  });

  it('has Curved, Elbow and Straight as radio children', () => {
    const action = lineType(actionContext(one('e1'), 'edit', deck));
    expect(action?.radio).toBe(true);
    expect(action?.children?.map((c) => c.label)).toEqual(['Curved', 'Elbow', 'Straight']);
  });

  it('checks the effective shape of one connection', () => {
    const checked = (id: string) =>
      lineType(actionContext(one(id), 'edit', deck))?.children?.find((c) => c.checked)?.label;
    expect(checked('e1')).toBe('Curved');
    expect(checked('e2')).toBe('Elbow');
    expect(checked('e3')).toBe('Straight');
  });

  it('checks the shared shape of several, and none when mixed', () => {
    expect(lineType(actionContext(many, 'edit', deck))?.children?.some((c) => c.checked)).toBe(
      false,
    );
    const same: MenuTarget = { kind: 'connections', ids: sel({ edges: ['e2', 'e2'] }) };
    expect(
      lineType(actionContext(same, 'edit', deck))?.children?.find((c) => c.checked)?.label,
    ).toBe('Elbow');
  });

  it('sets every selected connection in one undo step, remembers it and announces', () => {
    const ctx = actionContext(many, 'edit', deck);
    lineType(ctx)
      ?.children?.find((c) => c.label === 'Elbow')
      ?.run();
    const edges = toJSON(ctx.doc).edges;
    expect(edges.map((e) => e.style?.shape)).toEqual(['elbow', 'elbow', 'elbow']);
    expect(ui().lastLineShape).toBe('elbow');
    expect(ui().announcement.text).toBe('Line type: Elbow for 3 connectors');
    ctx.editor.undo();
    expect(toJSON(ctx.doc).edges.map((e) => e.style?.shape)).toEqual([
      undefined,
      undefined,
      'straight',
    ]);
  });

  it('announces one connection without a count', () => {
    const ctx = actionContext(one('e1'), 'edit', deck);
    lineType(ctx)
      ?.children?.find((c) => c.label === 'Elbow')
      ?.run();
    expect(ui().announcement.text).toBe('Line type: Elbow');
  });
});

const byId = (ctx: ActionContext, id: string, surface: 'menu' | 'toolbar' = 'menu') =>
  actionsFor(ACTIONS, ctx, surface)
    .flatMap((s) => s.actions)
    .find((a) => a.id === id);

describe('connection.lineStyle and the style menu items (022 US1)', () => {
  it('puts "Line style" on the toolbar for one and several connections', () => {
    for (const target of [one('e1'), many]) {
      const action = byId(actionContext(target, 'edit', deck), 'connection.lineStyle', 'toolbar');
      expect(action?.label).toBe('Line style');
      expect(action?.field).toBe('lineStyle');
    }
    expect(
      byId(actionContext(TARGETS.component), 'connection.lineStyle', 'toolbar'),
    ).toBeUndefined();
  });

  it('has Dash and Weight radio submenus that check the shared value', () => {
    const ctx = actionContext(one('e1'), 'edit', deck);
    const dash = byId(ctx, 'connection.dash');
    expect(dash?.children?.map((c) => c.label)).toEqual(['Solid', 'Dashed', 'Dotted']);
    expect(dash?.children?.find((c) => c.checked)?.label).toBe('Solid');
    const weight = byId(ctx, 'connection.weight');
    expect(weight?.children?.map((c) => c.label)).toEqual([
      '1 px',
      '1.5 px',
      '2 px',
      '3 px',
      '4 px',
    ]);
    expect(weight?.children?.find((c) => c.checked)?.label).toBe('2 px');
    expect(
      byId(actionContext(many, 'edit', deck), 'connection.weight')?.children?.some(
        (c) => c.checked,
      ),
    ).toBe(true);
  });

  it('writes one key to every selected connection as one undo step', () => {
    const ctx = actionContext(many, 'edit', deck);
    byId(ctx, 'connection.dash')
      ?.children?.find((c) => c.label === 'Dotted')
      ?.run();
    expect(toJSON(ctx.doc).edges.map((e) => e.style?.dash)).toEqual(['dotted', 'dotted', 'dotted']);
    expect(toJSON(ctx.doc).edges[2]?.style?.shape).toBe('straight');
    expect(ui().announcement.text).toBe('Dash set to Dotted for 3 connectors');
    ctx.editor.undo();
    expect(toJSON(ctx.doc).edges.map((e) => e.style?.dash)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('toggles Animate direction and checks it when every connector animates', () => {
    const ctx = actionContext(many, 'edit', deck);
    expect(byId(ctx, 'connection.animate')?.checked).toBe(false);
    byId(ctx, 'connection.animate')?.run();
    expect(toJSON(ctx.doc).edges.map((e) => e.style?.animated)).toEqual([true, true, true]);
    expect(ui().announcement.text).toBe('Animate direction, on for 3 connectors');
    expect(byId(actionContext(many, 'edit', toJSON(ctx.doc)), 'connection.animate')?.checked).toBe(
      true,
    );
  });

  it('"Colour…" opens the Line style popover', () => {
    byId(actionContext(one('e1'), 'edit', deck), 'connection.colour')?.run();
    expect(ui().toolbarField).toBe('lineStyle');
  });
});

describe('node.spreadEnds (050 US7)', () => {
  // Three connectors end on the hub's right side; the other ends sit at y 200, -200 and 0.
  const spreadDeck = deckOf({
    nodes: [
      { id: 'hub', type: 'service', title: 'Hub', group: 'g', position: { x: 300, y: 0 } },
      { id: 'r1', type: 'service', title: 'R1', position: { x: 700, y: 200 } },
      { id: 'r2', type: 'service', title: 'R2', position: { x: 700, y: -200 } },
      { id: 'r3', type: 'service', title: 'R3', position: { x: 700, y: 0 } },
    ],
    edges: [
      { id: 'e1', from: 'hub', to: 'r1' },
      { id: 'e2', from: 'hub', to: 'r2', route: { fromSide: 'right', fromAt: 0.5 } },
      { id: 'e3', from: 'r3', to: 'hub' },
      { id: 'e4', from: 'r1', to: 'r2' },
    ],
    groups: [{ id: 'g', title: 'Core' }],
  });
  const box = (id: string, x: number, y: number, width = 100, height = 50) => ({
    id,
    position: { x, y },
    width,
    height,
  });
  const drawn = (id: string, source: string, target: string, sides: [string, string]) => ({
    id,
    type: 'deck',
    source,
    target,
    sourceHandle: sides[0],
    targetHandle: sides[1],
  });
  const nodes = [
    box('hub', 300, 0),
    box('r1', 700, 200),
    box('r2', 700, -200),
    box('r3', 700, 0),
    box('group:g', 280, -20, 140, 90),
  ];
  const edges = [
    drawn('e1', 'hub', 'r1', ['right', 'left']),
    drawn('e2', 'hub', 'r2', ['right', 'left']),
    drawn('e3', 'r3', 'hub', ['left', 'right']),
    drawn('e4', 'r1', 'r2', ['top', 'bottom']),
  ];
  function spreadContext(
    target: MenuTarget,
    drawnEdges: readonly (ReturnType<typeof drawn> & { hidden?: boolean })[] = edges,
  ) {
    const ctx = actionContext(target, 'edit', spreadDeck);
    const canvas = ctx.canvas;
    if (canvas === null) throw new Error('the fixture has a canvas');
    return { ...ctx, canvas: { ...canvas, getNodes: () => nodes, getEdges: () => drawnEdges } };
  }
  const hub: MenuTarget = { kind: 'component', ids: sel({ nodes: ['hub'] }) };
  const spread = (ctx: ActionContext, surface: 'menu' | 'toolbar' = 'menu') =>
    byId(ctx, 'node.spreadEnds', surface);

  it('is offered on the menu and toolbar for cards and groups, not for connections', () => {
    for (const target of [TARGETS.component, TARGETS.components, TARGETS.group, TARGETS.mixed]) {
      expect(spread(actionContext(target))?.label).toBe('Spread ends evenly');
      expect(spread(actionContext(target), 'toolbar')?.label).toBe('Spread ends evenly');
    }
    expect(spread(actionContext(TARGETS.connection))).toBeUndefined();
    expect(spread(actionContext(TARGETS.canvas))).toBeUndefined();
  });

  it('is disabled when no side of the selection has two or more ends', () => {
    const r3: MenuTarget = { kind: 'component', ids: sel({ nodes: ['r3'] }) };
    expect(spread(spreadContext(r3))?.disabled).toBe('No side has two or more connector ends');
    expect(spread(actionContext(hub, 'edit', spreadDeck))?.disabled).toBe(
      'No side has two or more connector ends',
    );
    expect(spread(spreadContext(hub))?.disabled).toBeNull();
  });

  it('pins the ends at equal spacing, ordered by the other end, in one undo step', () => {
    const ctx = spreadContext(hub);
    spread(ctx)?.run();
    const route = (id: string) => toJSON(ctx.doc).edges.find((e) => e.id === id)?.route;
    expect(route('e2')).toMatchObject({ fromSide: 'right', fromAt: 0.25 });
    // The middle (0.5) is the default, so only the pinned side is stored.
    expect(route('e3')).toEqual({ toSide: 'right' });
    expect(route('e1')).toMatchObject({ fromSide: 'right', fromAt: 0.75 });
    expect(route('e4')).toBeUndefined();
    expect(ui().announcement.text).toBe('Spread 3 ends on 1 side');
    ctx.editor.undo();
    expect(toJSON(ctx.doc).edges.map((e) => e.route)).toEqual(spreadDeck.edges.map((e) => e.route));
  });

  it('skips connectors hidden in the view', () => {
    const ctx = spreadContext(
      hub,
      edges.map((e) => (e.id === 'e3' ? { ...e, hidden: true } : e)),
    );
    spread(ctx)?.run();
    expect(toJSON(ctx.doc).edges.find((e) => e.id === 'e3')?.route).toBeUndefined();
    expect(ui().announcement.text).toBe('Spread 2 ends on 1 side');
  });

  it('spreads the ends drawn on a selected group frame', () => {
    const ctx = spreadContext(TARGETS.group, [
      drawn('e1', 'group:g', 'r1', ['right', 'left']),
      drawn('e2', 'group:g', 'r2', ['right', 'left']),
    ]);
    expect(spread(ctx)?.disabled).toBeNull();
    spread(ctx)?.run();
    const routes = toJSON(ctx.doc).edges.map((e) => e.route);
    expect(routes[1]).toMatchObject({ fromSide: 'right', fromAt: 0.3333 });
    expect(routes[0]).toMatchObject({ fromSide: 'right', fromAt: 0.6667 });
    expect(ui().announcement.text).toBe('Spread 2 ends on 1 side');
  });
});
