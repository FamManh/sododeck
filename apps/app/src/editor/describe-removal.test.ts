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

const flowDeck = deckOf({
  nodes: [{ id: 'a', type: 'service', title: 'A' }],
  edges: [{ id: 'aa', from: 'a', to: 'a' }],
  features: [{ id: 'feat', title: 'Delivery' }],
  flows: [
    {
      id: 'f',
      title: 'Checkout',
      feature: 'feat',
      branches: [{ id: 'b1', label: 'payment failed', condition: 'declined' }],
      steps: [
        { id: 's1', edge: 'aa' },
        { id: 's2', edge: 'aa', branch: 'b1' },
      ],
    },
    { id: 'g', title: 'Refund', feature: 'feat', steps: [] },
  ],
});

function describeFlowDeck(targets: RemovalTarget[]) {
  const result = previewRemoval(flowDeck, targets);
  return {
    ...describeRemoval(flowDeck, targets, result),
    toast: removalToast(flowDeck, targets, result, true),
  };
}

describe('describeRemoval for features, flows and branches (006)', () => {
  it('says a feature keeps its flows', () => {
    expect(describeFlowDeck([{ scope: 'features', id: 'feat' }])).toEqual({
      title: 'Delete ‘Delivery’?',
      body: 'Its 2 flows will move to No feature. You can undo this.',
      toast: 'Deleted ‘Delivery’ · ⌘Z to undo',
    });
  });

  it('counts the steps deleted with a flow or a branch', () => {
    expect(describeFlowDeck([{ scope: 'flows', id: 'f' }])).toMatchObject({
      title: 'Delete ‘Checkout’?',
      body: 'Its 2 steps will be deleted. You can undo this.',
    });
    expect(describeFlowDeck([{ scope: 'branches', flowId: 'f', id: 'b1' }])).toMatchObject({
      title: 'Delete ‘branch payment failed’?',
      body: 'Its 1 step will be deleted. You can undo this.',
    });
  });
});

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

describe('describeRemoval for a rule (008 FR-024)', () => {
  const ruleDeck = deckOf({
    nodes: [
      { id: 'p', type: 'service', title: 'Pricing', rules: ['R'] },
      { id: 'q', type: 'service', title: 'Quote' },
    ],
    edges: [{ id: 'pq', from: 'p', to: 'q' }],
    flows: [
      {
        id: 'f',
        title: 'Place order',
        steps: [
          { id: 's1', edge: 'pq', rules: ['R'], ruleInputs: { R: { c: '5' } } },
          { id: 's2', edge: 'pq', rules: ['R'] },
        ],
      },
    ],
    rules: {
      R: {
        title: 'Delivery tier',
        hitPolicy: 'first',
        inputs: [{ id: 'c', label: 'C' }],
        outputs: [],
        rows: [],
      },
      U: { title: 'Unused', hitPolicy: 'first', inputs: [], outputs: [], rows: [] },
    },
  });
  const run = (id: string) => {
    const targets: RemovalTarget[] = [{ scope: 'rules', id }];
    const result = previewRemoval(ruleDeck, targets);
    return {
      ...describeRemoval(ruleDeck, targets, result),
      toast: removalToast(ruleDeck, targets, result, true),
      toastPc: removalToast(ruleDeck, targets, result, false),
    };
  };

  it('names the rule and its usage', () => {
    expect(run('R')).toEqual({
      title: 'Delete rule “Delivery tier”?',
      body: 'Used in 2 steps and 1 component. It will be detached from them.',
      toast: 'Rule “Delivery tier” deleted · ⌘Z to undo',
      toastPc: 'Rule “Delivery tier” deleted · Ctrl+Z to undo',
    });
  });

  it('says when the rule is not used', () => {
    expect(run('U').body).toBe('It isn’t used anywhere.');
  });
});
