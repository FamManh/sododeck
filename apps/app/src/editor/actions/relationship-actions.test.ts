import { toJSON, type DeckDoc } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import type { MenuTarget } from '../../state/ui-store';
import { actionContext, actionDeck, sel } from '../../test/action-fixtures';
import { actionsFor } from './actions-for';
import { ACTIONS } from './index';

const table = (id: string, x: number) => ({
  id,
  type: 'db-table',
  title: id,
  position: { x, y: 900 },
  columns: [{ id: `${id}.id`, name: 'id', type: 'int', pk: true as const }],
});

const deck = {
  ...actionDeck,
  nodes: [...actionDeck.nodes, table('orders', 0), table('customers', 400)],
  edges: [
    ...actionDeck.edges,
    {
      id: 'rel',
      from: 'orders',
      to: 'customers',
      fromColumns: ['orders.id'],
      toColumns: ['customers.id'],
      cardinality: 'n-1' as const,
      fromOptional: true as const,
    },
  ],
};

const relTarget: MenuTarget = { kind: 'connection', ids: sel({ edges: ['rel'] }) };
const plainTarget: MenuTarget = { kind: 'connection', ids: sel({ edges: ['e'] }) };

const find = (surface: 'menu' | 'toolbar', id: string, doc?: DeckDoc, target = relTarget) => {
  const ctx = actionContext(target, 'edit', doc ?? deck);
  return {
    ctx,
    action: actionsFor(ACTIONS, ctx, surface)
      .flatMap((s) => s.actions)
      .find((a) => a.id === id),
  };
};
const edgeOf = (doc: DeckDoc) => toJSON(doc).edges.find((e) => e.id === 'rel');

describe('relationship quick settings (043 US4, R9)', () => {
  it('sets the cardinality from a radio with the current choice checked, one step each', () => {
    const { ctx, action } = find('menu', 'relationship.cardinality');
    expect(action?.children?.map((c) => [c.label, c.checked])).toEqual([
      ['1–1', false],
      ['1–n', false],
      ['n–1', true],
      ['n–n', false],
    ]);
    action?.children?.find((c) => c.label === '1–n')?.run();
    expect(edgeOf(ctx.doc)?.cardinality).toBe('1-n');
    ctx.editor.undo();
    expect(edgeOf(ctx.doc)?.cardinality).toBe('n-1');
  });

  it('toggles the optional sides as true or removed, never false', () => {
    const { ctx, action } = find('menu', 'relationship.optional');
    expect(action?.children?.map((c) => [c.label, c.checked])).toEqual([
      ['From side optional', true],
      ['To side optional', false],
    ]);
    action?.children?.[0]?.run();
    expect(edgeOf(ctx.doc)).not.toHaveProperty('fromOptional');
    const again = find('menu', 'relationship.optional', ctx.doc);
    again.action?.children?.[1]?.run();
    expect(edgeOf(ctx.doc)?.toOptional).toBe(true);
  });

  it('sets on delete, and None removes it', () => {
    const { ctx, action } = find('menu', 'relationship.onDelete');
    expect(action?.children?.map((c) => c.label)).toEqual([
      'None',
      'Cascade',
      'Restrict',
      'Set null',
      'Set default',
      'No action',
    ]);
    action?.children?.find((c) => c.label === 'Cascade')?.run();
    expect(edgeOf(ctx.doc)?.onDelete).toBe('cascade');
    find('menu', 'relationship.onDelete', ctx.doc)
      .action?.children?.find((c) => c.label === 'None')
      ?.run();
    expect(edgeOf(ctx.doc)).not.toHaveProperty('onDelete');
  });

  it('shows cardinality and on delete on the connection toolbar, for relationships only', () => {
    expect(find('toolbar', 'relationship.cardinality').action?.label).toBe('Cardinality: n–1');
    expect(find('toolbar', 'relationship.onDelete').action?.label).toBe('On delete: None');
    expect(find('menu', 'relationship.cardinality', undefined, plainTarget).action).toBeUndefined();
    expect(find('toolbar', 'relationship.onDelete', undefined, plainTarget).action).toBeUndefined();
  });
});
