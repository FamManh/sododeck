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

    // The old title no longer matches as a title (the type name "Service" still matches the body).
    expect(searchDeck(after, 'order service').results.map((r) => r.match)).not.toContain('title');
    expect(resultIds(searchDeck(after, 'checkout core').results)).toContain('order');
    expect(afterSticky).toBe(beforeSticky);
    expect(afterOrder).not.toBe(beforeOrder);

    snapshot.destroy();
    editor.destroy();
    doc.destroy();
  });
});

describe('searching by card type (030)', () => {
  it('finds cards by their type name, built-in or unknown', () => {
    const deck = emptySododeckFile();
    deck.nodes.push(
      { id: 'a', type: 'truck-route', title: 'HCM to DN' },
      { id: 'b', type: 'warehouse', title: 'Hub' },
      { id: 'c', type: 'robot', title: 'Rover' },
    );
    const index = buildSearchIndex(deck);
    expect(searchDeck(index, 'truck route').results.map((r) => r.id)).toEqual(['a']);
    expect(searchDeck(index, 'robot').results.map((r) => r.id)).toEqual(['c']);
    expect(searchDeck(index, 'warehouse').results.map((r) => r.id)).toEqual(['b']);
  });
});

describe('searching typed field values (032 FR-020)', () => {
  const deck = (): SododeckFile => ({
    ...emptySododeckFile(),
    fields: [
      {
        id: 'zone',
        name: 'Temperature zone',
        kind: 'select',
        types: ['warehouse'],
        options: [{ id: 'z1', label: 'Frozen' }],
      },
      { id: 'notes', name: 'Dock notes', kind: 'text' },
      { id: 'site', name: 'Site', kind: 'link' },
    ],
    nodes: [
      {
        id: 'w',
        type: 'warehouse',
        title: 'Hub',
        owner: 'Minh Tran',
        values: {
          zone: 'z1',
          notes: 'Bay four closed',
          'warehouse.sla': 24,
          site: { url: 'https://maps.example.com/hcm', label: 'HCM depot map' },
          'warehouse.capacity': 82,
        },
      },
      { id: 't', type: 'task', title: 'Pack', values: { 'task.assignee': 'Lan' } },
      { id: 'x', type: 'service', title: 'Other', values: { gone: 'Frozen secret' } },
    ],
  });

  it.each([
    ['frozen', ['w'], 'Temperature zone: Frozen'],
    ['bay four', ['w'], 'Dock notes: Bay four closed'],
    ['lan', ['t'], 'Assignee: Lan'],
    ['minh', ['w'], 'Owner: Minh Tran'],
    ['depot map', ['w'], 'Site: HCM depot map'],
    ['24', ['w'], 'SLA: 24 h'],
  ])('finds %j by a value, with a snippet naming the field', (query, ids, snippet) => {
    const { results } = searchDeck(buildSearchIndex(deck()), query);
    expect(results.map((r) => r.id)).toEqual(ids);
    expect(results[0]?.snippet?.field).toBe('field');
    expect(results[0]?.snippet?.text).toBe(snippet);
  });

  it('does not search dangling values or option ids', () => {
    const index = buildSearchIndex(deck());
    expect(searchDeck(index, 'secret').results).toEqual([]);
    expect(searchDeck(index, 'z1').results).toEqual([]);
  });
});

describe('shapes in search (031)', () => {
  it('finds a shape by its title and by its shape name', () => {
    const index = buildSearchIndex({
      ...emptySododeckFile(),
      nodes: [{ id: 'ok', type: 'diamond', title: 'Payment OK?' }],
    });
    expect(resultIds(searchDeck(index, 'payment').results)).toEqual(['ok']);
    expect(resultIds(searchDeck(index, 'diamond').results)).toEqual(['ok']);
  });
});

describe('group-ended connections (050)', () => {
  function groupDeck(): SododeckFile {
    const deck = emptySododeckFile();
    deck.groups.push({ id: 'pay', title: 'Payments zone' }, { id: 'led', title: 'Ledger zone' });
    deck.nodes.push({ id: 'web', type: 'client', title: 'Web shop' });
    deck.edges.push(
      { id: 'web-pay', from: 'web', to: 'pay' },
      { id: 'pay-led', from: 'pay', to: 'led' },
    );
    deck.flows.push({ id: 'f', title: 'Checkout', steps: [{ id: 's', edge: 'web-pay' }] });
    return deck;
  }

  it('titles a connection and a step by the group at either end', () => {
    const { entries } = buildSearchIndex(groupDeck());
    expect(entries.find((e) => e.id === 'web-pay')?.title).toBe('Web shop → Payments zone');
    expect(entries.find((e) => e.id === 'pay-led')?.title).toBe('Payments zone → Ledger zone');
    expect(entries.find((e) => e.id === 's')?.title).toBe('Web shop → Payments zone');
  });

  it('finds a group connection by the group titles', () => {
    const index = buildSearchIndex(groupDeck());
    expect(searchDeck(index, 'payments ledger').results.map((r) => r.id)).toContain('pay-led');
  });
});

function schemaDeck(): SododeckFile {
  const deck = emptySododeckFile();
  deck.nodes.push(
    {
      id: 'payments',
      type: 'db-table',
      title: 'payments',
      schema: 'billing',
      columns: [
        { id: 'p-id', name: 'id', type: 'uuid', pk: true },
        { id: 'p-inv', name: 'invoice_id', type: 'uuid' },
        { id: 'p-amt', name: 'amount', type: 'numeric', size: '10,2', note: 'Gross total' },
      ],
    },
    {
      id: 'invoices',
      type: 'db-table',
      title: 'invoices',
      schema: 'billing',
      columns: [
        { id: 'i-id', name: 'id', type: 'uuid', pk: true },
        { id: 'i-code', name: 'code', type: 'text', unique: true },
      ],
    },
    { id: 'svc', type: 'service', title: 'Payments API' },
  );
  deck.edges.push({
    id: 'fk',
    from: 'payments',
    to: 'invoices',
    cardinality: 'n-1',
    fromColumns: ['p-inv'],
    toColumns: ['i-id'],
  });
  return deck;
}

describe('table and column search (048 FR-019)', () => {
  it('indexes a table as a table entry (name, schema, column count), not as a node', () => {
    const index = buildSearchIndex(schemaDeck());
    const tables = index.entries.filter((entry) => entry.kind === 'table');
    expect(tables.map((entry) => entry.id)).toEqual(['payments', 'invoices']);
    expect(index.entries.filter((e) => e.kind === 'node').map((e) => e.id)).toEqual(['svc']);
    expect(tables[0]?.context).toBe('Table · billing · 3 columns');
    expect(resultIds(searchDeck(index, 'billing').results)).toEqual(['invoices', 'payments']);
  });

  it('finds a column as "table.column" with its type and key marker, carrying its table', () => {
    const index = buildSearchIndex(schemaDeck());
    const found = searchDeck(index, 'invoice_id').results;
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      kind: 'column',
      id: 'p-inv',
      tableId: 'payments',
      title: 'payments.invoice_id',
      context: 'Column · uuid · foreign key',
    });
    expect(searchDeck(index, 'invoices.id').results[0]).toMatchObject({
      id: 'i-id',
      context: 'Column · uuid · primary key',
    });
    expect(searchDeck(index, 'invoices code').results[0]?.context).toBe('Column · text · unique');
    expect(searchDeck(index, 'gross').results[0]).toMatchObject({ id: 'p-amt', match: 'body' });
    expect(resultIds(searchDeck(index, 'numeric').results)).toEqual(['p-amt']);
  });

  it('ranks a table above its columns on an equal match', () => {
    const index = buildSearchIndex(schemaDeck());
    const kinds = resultKinds(searchDeck(index, 'payments').results);
    expect(kinds.slice(0, 2)).toEqual(['node', 'table']);
    expect(kinds).toContain('column');
    expect(kinds.indexOf('table')).toBeLessThan(kinds.indexOf('column'));
  });

  it('reuses the table and column entries while their tables are unchanged', () => {
    const file = schemaDeck();
    const a = buildSearchIndex(file);
    const b = buildSearchIndex({ ...file, nodes: [...file.nodes] });
    const pick = (index: typeof a) =>
      index.entries.filter((entry) => entry.kind === 'column' || entry.kind === 'table');
    pick(a).forEach((entry, i) => {
      expect(pick(b)[i]).toBe(entry);
    });
  });

  it('leaves a deck without tables unchanged', () => {
    const index = buildSearchIndex(searchDeckFixture());
    expect(index.entries.some((e) => e.kind === 'table' || e.kind === 'column')).toBe(false);
  });
});

describe('bounded search (048 FR-023, SC-004)', () => {
  function bigDeck(tables: number, columns: number, name: (t: number, c: number) => string) {
    const deck = emptySododeckFile();
    for (let t = 0; t < tables; t++) {
      deck.nodes.push({
        id: `t${String(t)}`,
        type: 'db-table',
        title: `table_${String(t)}`,
        columns: Array.from({ length: columns }, (_, c) => ({
          id: `t${String(t)}c${String(c)}`,
          name: name(t, c),
          type: 'int',
        })),
      });
    }
    return deck;
  }

  it('caps 10,000 matching columns at the limit and reports the rest', () => {
    const index = buildSearchIndex(bigDeck(100, 100, (_, c) => `invoice_${String(c)}`));
    const { results, total } = searchDeck(index, 'invoice', { limit: 20 });
    expect(results).toHaveLength(20);
    expect(total).toBe(10_000);
    // Table names sort before... only columns match here, in title order.
    expect(results.every((r) => r.kind === 'column')).toBe(true);
  });

  it('keeps 1,800 columns indexed within 10 ms and a query within 50 ms', () => {
    const file = bigDeck(150, 12, (t, c) => `col_${String(t)}_${String(c)}`);
    // Warm the module, then measure a cold index (new objects, nothing cached).
    buildSearchIndex(bigDeck(2, 2, () => 'warm'));
    const started = performance.now();
    const index = buildSearchIndex(file);
    const indexed = performance.now() - started;
    const queryStarted = performance.now();
    const { results } = searchDeck(index, 'col_14');
    const queried = performance.now() - queryStarted;
    expect(results.length).toBeGreaterThan(0);
    // Budget 10 ms (measured 4 to 7 ms cold); 5x headroom so a loaded CI machine stays green.
    expect(indexed).toBeLessThan(50);
    expect(queried).toBeLessThan(50);
  });
});
