import { toJSON } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { actionContext, actionDeck, labels, TARGETS } from '../../test/action-fixtures';
import { actionsFor, runAction } from './actions-for';
import { ACTIONS } from './index';

describe('node.resetSize (017 R4)', () => {
  it('is offered on a component, disabled at the default size', () => {
    expect(labels(TARGETS.component, 'menu').flat()).toContain('Reset size');
  });

  it('resets a sized card to its default in one undo step and announces it', () => {
    useUiStore.getState().resetForDeck();
    const sizedDeck = {
      ...actionDeck,
      nodes: actionDeck.nodes.map((n) =>
        n.id === 'a' ? { ...n, size: { width: 244, height: 140 } } : n,
      ),
    };
    const ctx = actionContext(TARGETS.component, 'edit', sizedDeck);
    expect(runAction(ACTIONS, 'node.resetSize', ctx)).toBe(true);
    expect(toJSON(ctx.doc).nodes.find((n) => n.id === 'a')?.size).toBeUndefined();
    expect(useUiStore.getState().announcement.text).toBe('Size reset');
    expect(ctx.editor.undo()).toBe(true);
    expect(toJSON(ctx.doc).nodes.find((n) => n.id === 'a')?.size).toEqual({
      width: 244,
      height: 140,
    });
  });
});

describe('edge.resetRoute (017 R12)', () => {
  it('is offered only on an elbow connection, disabled when the route is automatic (029)', () => {
    expect(labels(TARGETS.connection, 'menu').flat()).not.toContain('Reset route');
    const elbow = {
      ...actionDeck,
      edges: actionDeck.edges.map((e) => ({ ...e, style: { shape: 'elbow' as const } })),
    };
    const ctx = actionContext(TARGETS.connection, 'edit', elbow);
    expect(
      actionsFor(ACTIONS, ctx, 'menu')
        .flatMap((s) => s.actions)
        .map((a) => a.label),
    ).toContain('Reset route');
    const action = ACTIONS.find((a) => a.id === 'edge.resetRoute');
    expect(action?.disabledReason?.(ctx)).toBe('Route is automatic');
  });

  it('clears a pinned side and offset in one undo step and announces it', () => {
    useUiStore.getState().resetForDeck();
    const routedDeck = {
      ...actionDeck,
      edges: actionDeck.edges.map((e) =>
        e.id === 'e' ? { ...e, route: { fromSide: 'right' as const, offset: 20 } } : e,
      ),
    };
    const ctx = actionContext(TARGETS.connection, 'edit', routedDeck);
    expect(runAction(ACTIONS, 'edge.resetRoute', ctx)).toBe(true);
    expect(toJSON(ctx.doc).edges.find((e) => e.id === 'e')?.route).toBeUndefined();
    expect(useUiStore.getState().announcement.text).toBe('Route reset');
    expect(ctx.editor.undo()).toBe(true);
    expect(toJSON(ctx.doc).edges.find((e) => e.id === 'e')?.route).toEqual({
      fromSide: 'right',
      offset: 20,
    });
  });
});

describe('edge.resetRoute with bends and anchors (022)', () => {
  const routed = (route: object, shape: 'curved' | 'straight') => ({
    ...actionDeck,
    edges: actionDeck.edges.map((e) => ({ ...e, route, style: { shape } })),
  });
  const offered = (deck: typeof actionDeck) =>
    actionsFor(ACTIONS, actionContext(TARGETS.connection, 'edit', deck), 'menu')
      .flatMap((s) => s.actions)
      .map((a) => a.label)
      .includes('Reset route');

  it('is offered for every shape once a connector has bends, anchors or an offset', () => {
    expect(offered(routed({ waypoints: [{ x: 0.5, y: 0.5 }] }, 'curved'))).toBe(true);
    expect(offered(routed({ fromSide: 'right', fromAt: 0.2 }, 'straight'))).toBe(true);
    expect(offered(routed({ offset: 10 }, 'straight'))).toBe(true);
    expect(offered(routed({ fromSide: 'right' }, 'curved'))).toBe(false);
  });

  it('clears bends and anchors together in one undo step and announces it', () => {
    useUiStore.getState().resetForDeck();
    const deck = routed(
      { fromSide: 'right', fromAt: 0.2, waypoints: [{ x: 0.5, y: 0.5 }] },
      'curved',
    );
    const ctx = actionContext(TARGETS.connection, 'edit', deck);
    expect(runAction(ACTIONS, 'edge.resetRoute', ctx)).toBe(true);
    expect(toJSON(ctx.doc).edges.find((e) => e.id === 'e')).not.toHaveProperty('route');
    expect(useUiStore.getState().announcement.text).toBe('Route reset');
    ctx.editor.undo();
    expect(toJSON(ctx.doc).edges.find((e) => e.id === 'e')?.route?.waypoints).toHaveLength(1);
  });
});
