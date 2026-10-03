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
  it('is offered for one connection and for connections only, on the menu and toolbar', () => {
    for (const surface of ['menu', 'toolbar'] as const) {
      expect(lineType(actionContext(one('e1'), 'edit', deck), surface)).toBeDefined();
      expect(lineType(actionContext(many, 'edit', deck), surface)).toBeDefined();
      for (const target of [TARGETS.mixed, TARGETS.component, TARGETS.components, TARGETS.group]) {
        expect(lineType(actionContext(target), surface)).toBeUndefined();
      }
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

  it('labels the toolbar button with the current type or "mixed"', () => {
    expect(lineType(actionContext(one('e2'), 'edit', deck), 'toolbar')?.label).toBe(
      'Line type: Elbow',
    );
    expect(lineType(actionContext(many, 'edit', deck), 'toolbar')?.label).toBe('Line type: mixed');
    expect(lineType(actionContext(many, 'edit', deck))?.label).toBe('Line type');
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
