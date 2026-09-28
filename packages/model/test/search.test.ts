import { createDeckSnapshot, createEditor, fromJSON } from '../src';
import {
  buildSearchIndex,
  normalizeText,
  searchDeck,
  type SearchKind,
  type SearchResult,
} from '../src';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

function searchDeckFixture(): SododeckFile {
  const deck = emptySododeckFile();
  deck.groups.push({ id: 'core', title: 'Core services' });
  deck.nodes.push(
    {
      id: 'order',
      type: 'service',
      title: 'Order Service',
      description: 'Handles café orders for checkout',
      group: 'core',
    },
    {
      id: 'retry',
      type: 'service',
      title: 'Retry Worker',
      description: 'Retries failed orders after backoff',
      group: 'core',
    },
    { id: 'pay', type: 'service', title: 'Payments API', description: 'Charges cards' },
  );
  deck.edges.push(
    {
      id: 'edge-1',
      from: 'order',
      to: 'retry',
      description: 'Passes failed orders to the retry worker',
    },
    {
      id: 'edge-2',
      from: 'retry',
      to: 'pay',
      label: 'Charge request',
      description: 'Submits the payment attempt',
    },
  );
  deck.flows.push({
    id: 'flow-1',
    title: 'Place order',
    description: 'Main checkout path',
    steps: [
      {
        id: 'step-1',
        edge: 'edge-1',
        title: 'Retry handoff',
        description: 'Send the failed order to retries',
        condition: 'Use Reattempt policy',
        notes: 'Escalate to ops if the queue backs up',
      },
      { id: 'step-2', edge: 'edge-2' },
    ],
  });
  deck.rules['rule-1'] = {
    title: 'Reattempt policy',
    description: 'Decides whether an order should retry',
    hitPolicy: 'first',
    inputs: [
      { id: 'severity', label: 'Severity' },
      { id: 'market', label: 'Market' },
    ],
    outputs: [{ id: 'action', label: 'Action' }],
    rows: [
      { id: 'row-1', when: ['high', 'EU'], then: ['manual review'] },
      { id: 'row-2', when: ['', ''], then: ['auto retry'] },
    ],
  };
  deck.stickies.push({
    id: 'sticky-1',
    text: 'Follow up with the café team about retries',
    position: { x: 24, y: 36 },
  });
  return deck;
}

function rankingDeck(): SododeckFile {
  const deck = emptySododeckFile();
  deck.nodes.push({ id: 'node', type: 'service', title: 'Shared node' });
  deck.edges.push({ id: 'edge', from: 'node', to: 'node', label: 'Shared edge' });
  deck.flows.push({
    id: 'flow',
    title: 'Shared flow',
    steps: [{ id: 'step', edge: 'edge', title: 'Shared step' }],
  });
  deck.rules['rule'] = {
    title: 'Shared rule',
    hitPolicy: 'first',
    inputs: [{ id: 'in', label: 'Shared column' }],
    outputs: [{ id: 'out', label: 'Result' }],
    rows: [{ id: 'row', when: ['shared cell'], then: ['shared output'] }],
  };
  deck.stickies.push({ id: 'sticky', text: 'Shared note', position: { x: 8, y: 12 } });
  deck.nodes.push({
    id: 'body-node',
    type: 'service',
    title: 'Body only',
    description: 'Mentions shared in the description',
  });
  return deck;
}

function resultKinds(results: readonly SearchResult[]): readonly SearchKind[] {
  return results.map((result) => result.kind);
}

function resultIds(results: readonly SearchResult[]): readonly string[] {
  return results.map((result) => result.id);
}

describe('normalizeText', () => {
  it('normalizes accents, case, markdown markers, and whitespace', () => {
    expect(normalizeText('  Café **OPS**\n- `retry`  ')).toBe('cafe ops retry');
  });
});

describe('searchDeck', () => {
  it('matches every searchable field kind', () => {
    const index = buildSearchIndex(searchDeckFixture());
    expect(resultIds(searchDeck(index, 'order service').results)).toContain('order');
    expect(resultIds(searchDeck(index, 'cafe').results)).toContain('order');
    expect(resultIds(searchDeck(index, 'charge request').results)).toContain('edge-2');
    expect(resultIds(searchDeck(index, 'order retry').results)).toContain('edge-1');
    expect(resultIds(searchDeck(index, 'checkout path').results)).toContain('flow-1');
    expect(resultIds(searchDeck(index, 'retry handoff').results)).toContain('step-1');
    expect(resultIds(searchDeck(index, 'escalate ops').results)).toContain('step-1');
    expect(resultIds(searchDeck(index, 'reattempt policy').results)).toContain('rule-1');
    expect(resultIds(searchDeck(index, 'severity').results)).toContain('rule-1');
    expect(resultIds(searchDeck(index, 'manual review').results)).toContain('rule-1');
    expect(resultIds(searchDeck(index, 'cafe team').results)).toContain('sticky-1');
  });

  it('matches multi-word queries in any order across title and body fields', () => {
    const index = buildSearchIndex(searchDeckFixture());
    const { results } = searchDeck(index, 'ops reattempt');
    expect(results[0]).toMatchObject({ kind: 'step', id: 'step-1' });
  });

  it('orders title matches before body matches, then by kind, then by title', () => {
    const index = buildSearchIndex(rankingDeck());
    const { results } = searchDeck(index, 'shared', { limit: 10 });
    expect(resultKinds(results)).toEqual([
      'node',
      'edge',
      'flow',
      'step',
      'rule',
      'sticky',
      'node',
    ]);
    expect(results[0]?.match).toBe('title');
    expect(results.at(-1)).toMatchObject({ id: 'body-node', match: 'body' });
  });

  it('returns title ranges and body snippets with ranges', () => {
    const index = buildSearchIndex(searchDeckFixture());
    const title = searchDeck(index, 'order').results[0];
    expect(title?.titleRanges).toEqual([{ start: 0, end: 5 }]);

    const body = searchDeck(index, 'manual').results.find((result) => result.id === 'rule-1');
    expect(body?.snippet?.text).toContain('manual review');
    expect(body?.snippet?.ranges[0]).toEqual({ start: 0, end: 6 });
  });

  it('applies limit and total, trims the query, and returns nothing for an empty query', () => {
    const index = buildSearchIndex(rankingDeck());
    expect(searchDeck(index, '').results).toEqual([]);
    const limited = searchDeck(index, `  shared${' '.repeat(250)}  `, { limit: 3 });
    expect(limited.total).toBeGreaterThan(3);
    expect(limited.results).toHaveLength(3);
  });

  it('finds the backlog case for reattempt, with the rule before the step', () => {
    const index = buildSearchIndex(searchDeckFixture());
    const { results } = searchDeck(index, 'reattempt');
    expect(results.slice(0, 2).map((result) => [result.kind, result.id])).toEqual([
      ['rule', 'rule-1'],
      ['step', 'step-1'],
    ]);
  });

  it('updates renamed objects and reuses unchanged entry objects', () => {
    const doc = fromJSON(searchDeckFixture());
    const editor = createEditor(doc);
    const snapshot = createDeckSnapshot(doc);
    const beforeFile = snapshot.get();
    const before = buildSearchIndex(beforeFile);
    const beforeSticky = before.entries.find(
      (entry) => entry.kind === 'sticky' && entry.id === 'sticky-1',
    );
    const beforeOrder = before.entries.find(
      (entry) => entry.kind === 'node' && entry.id === 'order',
    );

    editor.update('nodes', 'order', { title: 'Checkout Core' });
    const afterFile = snapshot.get();
    const after = buildSearchIndex(afterFile);
    const afterSticky = after.entries.find(
      (entry) => entry.kind === 'sticky' && entry.id === 'sticky-1',
    );
    const afterOrder = after.entries.find((entry) => entry.kind === 'node' && entry.id === 'order');

    expect(searchDeck(after, 'order service').results).toEqual([]);
    expect(resultIds(searchDeck(after, 'checkout core').results)).toContain('order');
    expect(afterSticky).toBe(beforeSticky);
    expect(afterOrder).not.toBe(beforeOrder);

    snapshot.destroy();
    editor.destroy();
    doc.destroy();
  });
});
