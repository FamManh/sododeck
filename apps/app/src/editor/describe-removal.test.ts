import { previewRemoval, type RemovalTarget } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { deckOf } from '../test/render-canvas';
import { describeRemoval, removalToast } from './describe-removal';

const deck = deckOf({
  nodes: [
    { id: 'svc', type: 'service', title: 'Order Service' },
    { id: 'db', type: 'database', title: 'Orders DB' },
    { id: 'web', type: 'client', title: 'Web' },
  ],
  edges: [
    { id: 'e1', from: 'web', to: 'svc' },
    { id: 'e2', from: 'svc', to: 'db' },
  ],
  flows: [{ id: 'f', title: 'Checkout', steps: [{ id: 's1', edge: 'e1' }] }],
  stickies: [{ id: 'n1', text: 'Note', anchor: 'svc' }],
});

function describe_(targets: RemovalTarget[]) {
  const result = previewRemoval(deck, targets);
  return {
    ...describeRemoval(deck, targets, result),
    toast: removalToast(deck, targets, result, true),
    toastPc: removalToast(deck, targets, result, false),
  };
}

describe('describeRemoval', () => {
  it('names one component with its connections and what breaks', () => {
    expect(describe_([{ scope: 'nodes', id: 'svc' }])).toEqual({
      title: 'Delete Order Service?',
      body: 'Also removes 2 connections. 1 flow step and 1 note will be flagged broken. You can undo this.',
      toast: 'Deleted Order Service and 2 connections · ⌘Z to undo',
      toastPc: 'Deleted Order Service and 2 connections · Ctrl+Z to undo',
    });
  });

  it('counts several components, each removed connection once', () => {
    const d = describe_([
      { scope: 'nodes', id: 'db' },
      { scope: 'nodes', id: 'web' },
    ]);
    expect(d.title).toBe('Delete 2 components?');
    expect(d.body).toBe(
      'Also removes 2 connections. 1 flow step will be flagged broken. You can undo this.',
    );
  });

  it('names a single connection by its ends, and omits zero parts', () => {
    const d = describe_([{ scope: 'edges', id: 'e2' }]);
    expect(d.title).toBe('Delete Order Service → Orders DB?');
    expect(d.body).toBe('You can undo this.');
    expect(d.toast).toBe('Deleted Order Service → Orders DB · ⌘Z to undo');
  });

  it('does not count a selected connection as cascaded', () => {
    const d = describe_([
      { scope: 'edges', id: 'e2' },
      { scope: 'nodes', id: 'db' },
    ]);
    expect(d.title).toBe('Delete 2 items?');
    expect(d.body).toBe('You can undo this.');
  });

  it('uses singular words for one', () => {
    const d = describe_([{ scope: 'nodes', id: 'db' }]);
    expect(d.body).toBe('Also removes 1 connection. You can undo this.');
  });
});
