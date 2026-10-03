import { emptySododeckFile, type Node, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { branchedDeck, flowDeck } from '../../test/flow-fixtures';
import {
  bulkView,
  deckStats,
  edgeUsage,
  flowSummary,
  nodeConnections,
  ownerSuggestions,
  ruleListItem,
  tagSuggestions,
} from './derive';

const knowledge: SododeckFile = {
  ...branchedDeck,
  tags: ['logistics'],
  nodes: branchedDeck.nodes.map((n, i) =>
    i === 0
      ? { ...n, owner: 'orders', tags: ['edge', 'pci'] }
      : i === 1
        ? { ...n, owner: 'Core' }
        : n,
  ),
  edges: branchedDeck.edges.map((e, i) =>
    i === 0 ? { ...e, owner: 'Platform', tags: ['sync'] } : e,
  ),
  features: [{ id: 'delivery', title: 'Delivery', owner: 'Orders' }],
  flows: branchedDeck.flows.map((f, i) =>
    i === 0
      ? {
          ...f,
          owner: 'Dispatch',
          tags: ['checkout'],
          steps: f.steps.map((s, j) => (j === 0 ? { ...s, owner: 'Mobile', tags: ['quote'] } : s)),
        }
      : f,
  ),
  rules: {
    R: {
      title: 'Tier',
      hitPolicy: 'first',
      inputs: [],
      outputs: [],
      rows: [
        { id: 'r1', when: [], then: [] },
        { id: 'r2', when: [], then: [] },
      ],
    },
  },
};

describe('ownerSuggestions', () => {
  it('lists distinct owners of nodes, edges, features, flows and steps, sorted by name', () => {
    expect(ownerSuggestions(knowledge)).toEqual([
      'Core',
      'Dispatch',
      'Mobile',
      'orders',
      'Orders',
      'Platform',
    ]);
    expect(ownerSuggestions(flowDeck)).toEqual([]);
  });
});

describe('tagSuggestions', () => {
  it('lists distinct tags across the deck, nodes, edges, flows and steps', () => {
    expect(tagSuggestions(knowledge)).toEqual([
      'checkout',
      'edge',
      'logistics',
      'pci',
      'quote',
      'sync',
    ]);
  });
});

describe('tagSuggestions: one per key (033)', () => {
  it('lists "PCI" once for "pci" and "PCI", in the spelling the deck uses', () => {
    const deck: SododeckFile = {
      ...emptySododeckFile(),
      tagColors: { Lan: 'red' },
      tags: ['Pci'],
      nodes: [
        { id: 'a', type: 'service', title: 'A', tags: ['PCI', 'lan'] },
        { id: 'b', type: 'service', title: 'B', tags: ['pci'] },
      ],
    };
    expect(tagSuggestions(deck)).toEqual(['Lan', 'PCI']);
  });
});

describe('nodeConnections', () => {
  it('lists outgoing and incoming connections with the other component', () => {
    expect(nodeConnections(flowDeck, 'c')).toEqual([
      { edgeId: 'bc', direction: 'in', otherId: 'b', label: 'POST /orders' },
      { edgeId: 'cd', direction: 'out', otherId: 'd', label: 'order.created' },
      { edgeId: 'cx', direction: 'out', otherId: 'x', label: 'authorize' },
      { edgeId: 'cy', direction: 'out', otherId: 'y', label: 'INSERT' },
    ]);
    expect(nodeConnections(flowDeck, 'b')).toContainEqual({
      edgeId: 'bb',
      direction: 'out',
      otherId: 'b',
      label: 'retry',
    });
  });
});

describe('edgeUsage', () => {
  it('lists each step using the connection with its flow and derived number', () => {
    expect(edgeUsage(branchedDeck, 'bc')).toEqual([
      { flowId: 'place', flowTitle: 'Place order', stepId: 's2', number: '2' },
      { flowId: 'pay', flowTitle: 'Pay', stepId: 'p2', number: '2' },
    ]);
    expect(edgeUsage(branchedDeck, 'cx')).toEqual([
      { flowId: 'pay', flowTitle: 'Pay', stepId: 'p3b', number: '3b' },
    ]);
    expect(edgeUsage(branchedDeck, 'cy')).toEqual([
      { flowId: 'loose', flowTitle: 'Refund', stepId: 'r1', number: '1' },
    ]);
    expect(edgeUsage(branchedDeck, 'bb')).toEqual([]);
  });
});

describe('flowSummary', () => {
  it('counts steps, branches, distinct components and broken steps', () => {
    expect(flowSummary(branchedDeck, 'pay')).toEqual({
      steps: 4,
      branches: 2,
      components: 5,
      broken: 0,
    });
    const broken = {
      ...branchedDeck,
      edges: branchedDeck.edges.filter((e) => e.id !== 'cx'),
    };
    expect(flowSummary(broken, 'pay')).toEqual({ steps: 4, branches: 2, components: 4, broken: 1 });
    expect(flowSummary(branchedDeck, 'nope')).toBeNull();
  });
});

describe('deckStats', () => {
  it('counts components, connections, flows and rules', () => {
    expect(deckStats(knowledge)).toEqual({ components: 6, connections: 6, flows: 4, rules: 1 });
  });
});

describe('ruleListItem', () => {
  it('gives the title, row count and number of steps using the rule', () => {
    const withUse: SododeckFile = {
      ...knowledge,
      flows: knowledge.flows.map((f) =>
        f.id === 'place' ? { ...f, steps: f.steps.map((s) => ({ ...s, rules: ['R'] })) } : f,
      ),
    };
    expect(ruleListItem(withUse, 'R')).toEqual({ title: 'Tier', rows: 2, usedInSteps: 2 });
    expect(ruleListItem(withUse, 'nope')).toBeNull();
  });
});

describe('bulkView', () => {
  const nodes: Node[] = [
    {
      id: 'p',
      type: 'service',
      title: 'Pricing',
      owner: 'Orders',
      tech: 'Go',
      group: 'g',
      tags: ['critical', 'pci'],
    },
    {
      id: 'q',
      type: 'service',
      title: 'Payment',
      owner: 'Payments',
      tech: 'Go',
      group: 'g',
      tags: ['critical'],
    },
    { id: 'r', type: 'service', title: 'Dispatch', tech: 'Go', tags: ['core'] },
  ];

  it('shows shared values, Mixed values and tag counts in first-seen order', () => {
    expect(bulkView(nodes)).toEqual({
      kind: { mixed: false, value: 'service' },
      owner: { mixed: true },
      tech: { mixed: false, value: 'Go' },
      group: { mixed: true },
      tags: [
        { tag: 'critical', count: 2 },
        { tag: 'pci', count: 1 },
        { tag: 'core', count: 1 },
      ],
    });
  });

  it('treats a missing owner or group the same on every node as shared empty', () => {
    const view = bulkView([nodes[2] as Node, { ...(nodes[2] as Node), id: 's' }]);
    expect(view.owner).toEqual({ mixed: false, value: '' });
    expect(view.group).toEqual({ mixed: false, value: null });
  });
});
