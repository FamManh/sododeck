import { previewRemoval, type RemovalTarget } from '@sododeck/model';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { deckOf } from '../test/render-canvas';
import { describeRemoval, keptTables, removalToast, withNewProblems } from './describe-removal';

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
  stickies: [
    { id: 'n1', text: 'Note', anchor: 'svc' },
    { id: 'n2', text: 'Second note', position: { x: 20, y: 24 } },
    { id: 'n3', text: 'Third note', position: { x: 32, y: 36 } },
  ],
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
      body: 'Also removes 2 connections. 1 pinned note will stay on the canvas, unpinned. 1 flow step will be flagged broken. You can undo this.',
      toast: 'Deleted Order Service and 2 connections · 1 note unpinned · ⌘Z to undo',
      toastPc: 'Deleted Order Service and 2 connections · 1 note unpinned · Ctrl+Z to undo',
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

  it('uses note-specific wording for one or many selected notes', () => {
    expect(describe_([{ scope: 'stickies', id: 'n1' }])).toEqual({
      title: 'Delete this note?',
      body: 'You can undo this.',
      toast: 'Note deleted · ⌘Z to undo',
      toastPc: 'Note deleted · Ctrl+Z to undo',
    });
    expect(
      describe_([
        { scope: 'stickies', id: 'n1' },
        { scope: 'stickies', id: 'n2' },
        { scope: 'stickies', id: 'n3' },
      ]),
    ).toMatchObject({
      title: 'Delete 3 notes?',
    });
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

describe('withNewProblems (015 FR-026)', () => {
  it('adds the count before the undo hint, and only when problems grew', () => {
    expect(withNewProblems('Deleted A · ⌘Z to undo', 1, 2)).toBe(
      'Deleted A · 1 new problem · ⌘Z to undo',
    );
    expect(withNewProblems('Deleted A · ⌘Z to undo', 0, 3)).toBe(
      'Deleted A · 3 new problems · ⌘Z to undo',
    );
    expect(withNewProblems('Deleted A · ⌘Z to undo', 2, 2)).toBe('Deleted A · ⌘Z to undo');
    expect(withNewProblems('Deleted A · ⌘Z to undo', 3, 1)).toBe('Deleted A · ⌘Z to undo');
    expect(withNewProblems('Deleted A', 0, 1)).toBe('Deleted A · 1 new problem');
  });
});

describe('describeRemoval with group connectors (050 US4)', () => {
  const grouped = deckOf({
    nodes: [
      { id: 'web', type: 'client', title: 'Web' },
      { id: 'db', type: 'database', title: 'Orders DB', group: 'data' },
    ],
    groups: [
      { id: 'data', title: 'Data layer' },
      { id: 'edge', title: 'Edge' },
    ],
    edges: [
      { id: 'g1', from: 'web', to: 'data' },
      { id: 'g2', from: 'edge', to: 'data' },
    ],
  });

  it('counts the connectors a group delete takes with it', () => {
    const targets: RemovalTarget[] = [{ scope: 'groups', id: 'data' }];
    const result = previewRemoval(grouped, targets);
    expect(describeRemoval(grouped, targets, result).body).toContain('Also removes 2 connections.');
    expect(removalToast(grouped, targets, result, true)).toContain('and 2 connections');
  });

  it('names a group end by its title', () => {
    const targets: RemovalTarget[] = [{ scope: 'edges', id: 'g2' }];
    const result = previewRemoval(grouped, targets);
    expect(describeRemoval(grouped, targets, result).title).toBe('Delete Edge → Data layer?');
  });
});

describe('describeRemoval for a database card (049)', () => {
  const dbDeck: SododeckFile = {
    ...emptySododeckFile(),
    nodes: [
      { id: 'odb', type: 'database', title: 'Orders DB' },
      { id: 'orders', type: 'db-table', title: 'orders', parent: 'odb', columns: [] },
      { id: 'svc', type: 'service', title: 'Inner', parent: 'odb' },
    ],
  };
  const targets: RemovalTarget[] = [{ scope: 'nodes', id: 'odb' }];

  it('says how many tables are kept and become unowned', () => {
    const result = previewRemoval(dbDeck, targets);
    expect(keptTables(dbDeck, targets, result)).toEqual(['orders']);
    expect(describeRemoval(dbDeck, targets, result).body).toContain(
      '1 table is kept and becomes unowned.',
    );
    expect(removalToast(dbDeck, targets, result, true)).toBe(
      'Deleted Orders DB · 1 table kept · ⌘Z to undo',
    );
  });
});

describe('describeRemoval for notes with connectors (053)', () => {
  const noted = deckOf({
    nodes: [
      { id: 'svc', type: 'service', title: 'Order Service' },
      { id: 'db', type: 'database', title: 'Orders DB' },
    ],
    stickies: [
      { id: 'n1', text: 'Why retry?', position: { x: 0, y: 0 } },
      { id: 'n2', text: 'Other', position: { x: 300, y: 0 } },
    ],
    edges: [
      { id: 'c1', from: 'svc', to: 'n1' },
      { id: 'c2', from: 'n1', to: 'n2' },
      { id: 'keep', from: 'svc', to: 'db' },
    ],
  });

  it('lists the connectors that go with a deleted note', () => {
    const targets: RemovalTarget[] = [{ scope: 'stickies', id: 'n1' }];
    const result = previewRemoval(noted, targets);
    expect(describeRemoval(noted, targets, result)).toEqual({
      title: 'Delete this note?',
      body: 'Also removes 2 connections. You can undo this.',
    });
  });

  it('names a connector to a note by the note text', () => {
    const targets: RemovalTarget[] = [{ scope: 'edges', id: 'c1' }];
    expect(describeRemoval(noted, targets, previewRemoval(noted, targets)).title).toBe(
      'Delete Order Service → Why retry??',
    );
  });
});
