import { toJSON } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { actionContext, actionDeck, sel } from '../../test/action-fixtures';
import { actionsFor } from './actions-for';
import { ACTIONS } from './index';

/** b is a database (two forms); a is a service (one form); d a decision already shown as shape. */
const deck = {
  ...actionDeck,
  nodes: [
    ...actionDeck.nodes,
    {
      id: 'd',
      type: 'decision',
      display: 'shape' as const,
      title: 'OK?',
      position: { x: 0, y: 900 },
    },
  ],
};

const resolved = (ids: string[], surface: 'menu' | 'toolbar') => {
  const ctx = actionContext(
    { kind: ids.length === 1 ? 'component' : 'components', ids: sel({ nodes: ids }) },
    'edit',
    deck,
  );
  return actionsFor(ACTIONS, ctx, surface)
    .flatMap((s) => s.actions)
    .find((a) => a.id === 'node.showAs');
};

describe('node.showAs (031 US3)', () => {
  it('is offered only for decision, database and document selections', () => {
    expect(resolved(['b'], 'menu')?.label).toBe('Show as');
    expect(resolved(['b', 'd'], 'menu')).toBeDefined();
    expect(resolved(['a'], 'menu')).toBeUndefined();
    expect(resolved(['a', 'b'], 'menu')).toBeUndefined();
  });

  it('names the current form in the toolbar: Card, Shape or Mixed', () => {
    expect(resolved(['b'], 'toolbar')?.label).toBe('Show as: Card');
    expect(resolved(['d'], 'toolbar')?.label).toBe('Show as: Shape');
    expect(resolved(['b', 'd'], 'toolbar')?.label).toBe('Show as: Mixed');
    const items = resolved(['b'], 'menu')?.children ?? [];
    expect(items.map((c) => [c.label, c.checked])).toEqual([
      ['Show as card', true],
      ['Show as shape', false],
    ]);
    expect(resolved(['b', 'd'], 'menu')?.children?.some((c) => c.checked)).toBe(false);
  });

  it('switches every selected object in one undo step and announces it', () => {
    useUiStore.getState().resetForDeck();
    const ctx = actionContext(
      { kind: 'components', ids: sel({ nodes: ['b', 'd'] }) },
      'edit',
      deck,
    );
    const choose = (id: string) => {
      const action = actionsFor(ACTIONS, ctx, 'menu')
        .flatMap((s) => s.actions)
        .find((a) => a.id === 'node.showAs');
      action?.children?.find((c) => c.id === id)?.run();
    };
    choose('node.showAs.shape');
    const nodes = toJSON(ctx.doc).nodes;
    expect(nodes.find((n) => n.id === 'b')?.display).toBe('shape');
    expect(nodes.find((n) => n.id === 'd')?.display).toBe('shape');
    expect(useUiStore.getState().announcement.text).toBe('Shown as shape');
    expect(ctx.editor.undo()).toBe(true);
    expect(toJSON(ctx.doc).nodes.find((n) => n.id === 'b')?.display).toBeUndefined();
    choose('node.showAs.card');
    expect(toJSON(ctx.doc).nodes.find((n) => n.id === 'd')?.display).toBeUndefined();
    expect(useUiStore.getState().announcement.text).toBe('Shown as card');
  });
});
