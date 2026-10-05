import type { SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { diffDecks } from '../src/diff';
import { diffText } from '../src/text';
import { example } from './fixtures';

const copy = (file: SododeckFile) => structuredClone(file);

describe('deck diff (027 FR-018)', () => {
  const before = example('checkout.sododeck');

  it('reports no changes for the same deck, even with keys reordered', () => {
    const after = copy(before);
    after.nodes = after.nodes.map(
      (node) => Object.fromEntries(Object.entries(node).reverse()) as typeof node,
    );
    const diff = diffDecks(before, after, 'a', 'b');
    expect(diff.changes).toEqual([]);
    expect(diff.meta).toEqual([]);
    expect(diffText(diff)).toBe('No changes.');
  });

  it('shows only additions for a new flow and its connector', () => {
    const after = copy(before);
    after.nodes.push({ id: 'refunds', type: 'service', title: 'Refund Service' });
    after.edges.push({ id: 'orders-refunds', from: 'orders', to: 'refunds' });
    after.flows.push({
      id: 'refund',
      title: 'Refund',
      steps: [{ id: 'r1', edge: 'orders-refunds' }],
    });
    const diff = diffDecks(before, after, 'a', 'b');
    expect(diff.counts).toEqual({ added: 3, changed: 0, removed: 0 });
    expect(diff.changes.map((c) => `${c.change} ${c.collection}/${c.id}`)).toEqual([
      'added nodes/refunds',
      'added edges/orders-refunds',
      'added flows/refund',
    ]);
    expect(diff.changes[2]?.steps).toEqual([{ id: 'r1', change: 'added' }]);
  });

  it('shows a rename as one changed field on the same id', () => {
    const after = copy(before);
    if (after.nodes[2] !== undefined) after.nodes[2].title = 'Orders';
    const diff = diffDecks(before, after, 'a', 'b');
    expect(diff.changes).toEqual([
      { collection: 'nodes', id: 'orders', change: 'changed', title: 'Orders', fields: ['title'] },
    ]);
    expect(diffText(diff)).toBe(
      '~ nodes/orders "Orders" fields: title\n0 added, 1 changed, 0 removed.',
    );
  });

  it('lists removals, step changes, rule changes and deck fields', () => {
    const after = copy(before);
    after.edges = after.edges.filter((edge) => edge.id !== 'orders-db-write');
    const flow = after.flows[0];
    if (flow !== undefined) {
      flow.steps = flow.steps.filter((step) => step.id !== 'confirm');
      if (flow.steps[0] !== undefined) flow.steps[0].sla = '< 1 s';
    }
    after.rules = { r: { title: 'R', hitPolicy: 'first', inputs: [], outputs: [], rows: [] } };
    after.name = 'Checkout v2';
    const diff = diffDecks(before, after, 'a', 'b');
    expect(diff.meta).toEqual(['name']);
    expect(diff.changes.map((c) => `${c.change} ${c.collection}/${c.id}`)).toEqual([
      'removed edges/orders-db-write',
      'changed flows/checkout',
      'added rules/r',
    ]);
    expect(diff.changes[1]).toMatchObject({
      fields: ['steps'],
      steps: [
        { id: 'submit', change: 'changed', fields: ['sla'] },
        { id: 'confirm', change: 'removed' },
      ],
    });
    expect(diffText(diff).split('\n')).toEqual([
      '~ deck fields: name',
      '- edges/orders-db-write',
      '~ flows/checkout "Checkout" fields: steps',
      '    ~ step submit fields: sla',
      '    - step confirm',
      '+ rules/r "R"',
      '1 added, 1 changed, 1 removed.',
    ]);
  });

  it('reports reordered steps as a change of the flow', () => {
    const after = copy(before);
    after.flows[0]?.steps.reverse();
    expect(diffDecks(before, after, 'a', 'b').changes).toEqual([
      {
        collection: 'flows',
        id: 'checkout',
        change: 'changed',
        title: 'Checkout',
        fields: ['steps'],
      },
    ]);
  });
});
