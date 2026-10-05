import { buildSearchIndex } from '@sododeck/model';
import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { render } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { buildPaletteResults, type PaletteCommand } from './palette-results';

function command(id: string, title: string, aliases: readonly string[] = []): PaletteCommand {
  return { id, title, aliases, run: vi.fn() };
}

function searchDeckFixture(): SododeckFile {
  const deck = emptySododeckFile();
  deck.groups.push({ id: 'core', title: 'Core services' });
  deck.nodes.push(
    { id: 'svc', type: 'service', title: 'Order Service', group: 'core' },
    { id: 'a', type: 'service', title: 'A' },
    { id: 'b', type: 'service', title: 'B' },
  );
  deck.edges.push({ id: 'ab', from: 'a', to: 'b' });
  deck.flows.push({
    id: 'place',
    title: 'Place order',
    description: 'Main checkout path',
    steps: Array.from({ length: 8 }, (_, index) => ({
      id: `step-${String(index + 1)}`,
      edge: 'ab',
      ...(index === 3 ? { title: 'Authorize order' } : {}),
    })),
  });
  deck.rules['retry'] = {
    title: 'Reattempt policy',
    hitPolicy: 'first',
    inputs: [{ id: 'attempt', label: 'Attempt' }],
    outputs: [{ id: 'action', label: 'Action' }],
    rows: [{ id: 'row-1', when: ['2'], then: ['retry'] }],
  };
  deck.stickies.push({ id: 'note-1', text: 'Retry note', position: { x: 24, y: 36 } });
  return deck;
}

describe('buildPaletteResults', () => {
  it('lists commands first and flows second when the query is empty', () => {
    const deck = searchDeckFixture();
    const results = buildPaletteResults({
      deck,
      searchIndex: buildSearchIndex(deck),
      query: '',
      commands: [command('export', 'Export deck…'), command('rules', 'Open rule editor')],
    });

    expect(results.total).toBe(3);
    expect(results.items.map((item) => [item.kind, item.title])).toEqual([
      ['command', 'Export deck…'],
      ['command', 'Open rule editor'],
      ['flow', 'Place order'],
    ]);
  });

  it('merges matched commands ahead of deck title matches', () => {
    const deck = searchDeckFixture();
    const results = buildPaletteResults({
      deck,
      searchIndex: buildSearchIndex(deck),
      query: 'order',
      commands: [command('order-help', 'Order shortcuts'), command('rules', 'Open rule editor')],
    });

    expect(results.items.slice(0, 4).map((item) => [item.kind, item.id])).toEqual([
      ['command', 'order-help'],
      ['node', 'svc'],
      ['flow', 'place'],
      ['step', 'step-4'],
    ]);
  });

  it('marks components hidden in the current view in text (011 FR-016)', () => {
    const deck = searchDeckFixture();
    const results = buildPaletteResults({
      deck,
      searchIndex: buildSearchIndex(deck),
      query: 'order service',
      commands: [],
      hidden: new Set(['svc']),
    });
    const node = results.items.find((item) => item.id === 'svc');
    expect(node?.meta).toMatch(/ · Hidden in this view$/);
  });

  it('limits rows to 50 and reports the overflow text', () => {
    const deck = searchDeckFixture();
    deck.flows = Array.from({ length: 60 }, (_, index) => ({
      id: `flow-${String(index + 1)}`,
      title: `Shared flow ${String(index + 1).padStart(2, '0')}`,
      steps: [{ id: `step-${String(index + 1)}`, edge: 'ab' }],
    }));

    const results = buildPaletteResults({
      deck,
      searchIndex: buildSearchIndex(deck),
      query: 'shared',
      commands: [],
    });

    expect(results.items).toHaveLength(50);
    expect(results.overflowText).toBe('Showing 50 of 60 · 10 more');
  });

  it('formats meta text per result kind', () => {
    const deck = searchDeckFixture();
    const searchIndex = buildSearchIndex(deck);

    expect(
      buildPaletteResults({ deck, searchIndex, query: 'order service', commands: [] }).items[0]
        ?.meta,
    ).toBe('Service · Core services');
    expect(
      buildPaletteResults({ deck, searchIndex, query: 'a b', commands: [] }).items[0]?.meta,
    ).toBe('Connection · A → B');
    expect(
      buildPaletteResults({ deck, searchIndex, query: 'checkout path', commands: [] }).items[0]
        ?.meta,
    ).toBe('Flow · 8 steps');
    expect(
      buildPaletteResults({ deck, searchIndex, query: 'authorize', commands: [] }).items[0]?.meta,
    ).toBe('Step 4 · Place order');
    expect(
      buildPaletteResults({ deck, searchIndex, query: 'reattempt', commands: [] }).items[0]?.meta,
    ).toBe('Rule · First match');
    expect(
      buildPaletteResults({ deck, searchIndex, query: 'retry note', commands: [] }).items[0]?.meta,
    ).toBe('Note');
  });
});

describe('type names in results (030)', () => {
  it('shows the registry name, and the raw id for an unknown type', () => {
    const deck = emptySododeckFile();
    deck.nodes.push(
      { id: 'a', type: 'truck-route', title: 'HCM to DN' },
      { id: 'b', type: 'robot', title: 'Rover' },
    );
    const run = (query: string) =>
      buildPaletteResults({ deck, searchIndex: buildSearchIndex(deck), query, commands: [] });
    expect(run('truck route').items.find((r) => r.id === 'a')?.meta).toBe('Truck route');
    expect(run('robot').items.find((r) => r.id === 'b')?.meta).toBe('robot');
  });
});

describe('buildPaletteResults icons (038)', () => {
  function results(deck: SododeckFile, query: string) {
    return buildPaletteResults({
      deck,
      searchIndex: buildSearchIndex(deck),
      query,
      commands: [],
    }).items;
  }

  it("gives a component result its own icon, or its type's", () => {
    const deck = emptySododeckFile();
    deck.nodes.push(
      { id: 'a', type: 'service', title: 'Zeta custom', icon: 'lucide:search' },
      { id: 'b', type: 'service', title: 'Zeta plain' },
    );
    const items = results(deck, 'zeta');
    const iconOf = (title: string) => {
      const item = items.find((entry) => entry.title === title);
      expect(item?.icon).toBeDefined();
      return render(createElement('div', null, item?.icon)).container;
    };
    expect(iconOf('Zeta custom').querySelector('[data-icon="lucide:search"]')).not.toBeNull();
    expect(iconOf('Zeta plain').querySelector('[data-icon="lucide:box"]')).not.toBeNull();
  });

  it('leaves other result kinds without an icon', () => {
    const deck = searchDeckFixture();
    const items = results(deck, 'retry');
    expect(items.some((item) => item.kind === 'rule')).toBe(true);
    for (const item of items) expect(item.kind === 'node' || item.icon === undefined).toBe(true);
  });
});

describe('palette results group ends (050 US4)', () => {
  it('names a connector to a group by the group title', () => {
    const deck: SododeckFile = {
      ...emptySododeckFile(),
      nodes: [{ id: 'w', type: 'client', title: 'Web' }],
      groups: [{ id: 'g', title: 'Data layer' }],
      edges: [{ id: 'wg', from: 'w', to: 'g' }],
    };
    const results = buildPaletteResults({
      deck,
      searchIndex: buildSearchIndex(deck),
      query: 'web data',
      commands: [],
    });
    expect(results.items.find((item) => item.id === 'wg')?.meta).toBe(
      'Connection · Web → Data layer',
    );
  });
});

describe('palette results sticky ends and tags (053)', () => {
  const deck: SododeckFile = {
    ...emptySododeckFile(),
    nodes: [{ id: 'w', type: 'client', title: 'Web' }],
    stickies: [
      { id: 's1', text: 'Check the cache\nlater', position: { x: 0, y: 0 }, tags: ['Question'] },
      { id: 's2', text: 'Other note', position: { x: 0, y: 200 } },
    ],
    edges: [
      { id: 'ws', from: 'w', to: 's1' },
      { id: 'ss', from: 's1', to: 's2' },
    ],
  };
  const run = (query: string) =>
    buildPaletteResults({ deck, searchIndex: buildSearchIndex(deck), query, commands: [] }).items;

  it('labels both ends of a connector that touches a note', () => {
    const items = run('check web');
    expect(items.find((item) => item.id === 'ws')?.meta).toBe('Connection · Web → Check the cache');
  });

  it('labels a note-to-note connector with both note labels', () => {
    const meta = run('other check').find((item) => item.id === 'ss')?.meta;
    expect(meta).toBe('Connection · Check the cache → Other note');
  });

  it('finds a note by one of its tags', () => {
    const hit = run('question').find((item) => item.kind === 'sticky');
    expect(hit?.id).toBe('s1');
    expect(hit?.meta).toBe('Note');
  });
});

describe('table and column results (048 FR-019, FR-022)', () => {
  function tablesDeck(): SododeckFile {
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
        ],
      },
      { id: 'invoices', type: 'db-table', title: 'invoices', columns: [] },
    );
    deck.edges.push({
      id: 'fk',
      from: 'payments',
      to: 'invoices',
      cardinality: 'n-1',
      fromColumns: ['p-inv'],
    });
    return deck;
  }
  const run = (query: string, extra: Partial<Parameters<typeof buildPaletteResults>[0]> = {}) => {
    const deck = tablesDeck();
    return buildPaletteResults({
      deck,
      searchIndex: buildSearchIndex(deck),
      query,
      commands: [],
      ...extra,
    });
  };

  it('lists a table with its schema and column count, and a column with type and key', () => {
    const table = run('payments').items.find((item) => item.kind === 'table');
    expect(table).toMatchObject({
      id: 'payments',
      title: 'payments',
      meta: 'Table · billing · 2 columns',
    });
    const column = run('invoice_id').items[0];
    expect(column).toMatchObject({
      kind: 'column',
      id: 'p-inv',
      tableId: 'payments',
      title: 'payments.invoice_id',
      meta: 'Column · uuid · foreign key',
    });
  });

  it('puts the table before its columns', () => {
    expect(run('payments').items.map((item) => item.kind)).toEqual([
      'table',
      'column',
      'column',
      'edge',
    ]);
  });

  it('marks a result hidden in this view, for a table and for its columns', () => {
    const hidden = new Set(['payments']);
    const items = run('payments', { hidden }).items.filter((item) => item.kind !== 'edge');
    expect(items.every((item) => item.meta.endsWith('Hidden in this view'))).toBe(true);
    expect(run('invoices', { hidden }).items[0]?.meta).toBe('Table · 0 columns');
  });

  it('marks a result in a collapsed schema group', () => {
    const items = run('payments', { inCollapsedSchema: new Set(['payments']) }).items.filter(
      (item) => item.kind !== 'edge',
    );
    expect(items.every((item) => item.meta.endsWith('In collapsed schema'))).toBe(true);
  });

  it('counts the rest honestly with a bounded search', () => {
    const deck = emptySododeckFile();
    deck.nodes.push({
      id: 't',
      type: 'db-table',
      title: 't',
      columns: Array.from({ length: 300 }, (_, i) => ({
        id: `c${String(i)}`,
        name: `invoice_${String(i)}`,
        type: 'int',
      })),
    });
    const results = buildPaletteResults({
      deck,
      searchIndex: buildSearchIndex(deck),
      query: 'invoice',
      commands: [],
    });
    expect(results.items).toHaveLength(50);
    expect(results.total).toBe(300);
    expect(results.overflowText).toBe('Showing 50 of 300 · 250 more');
  });
});

describe('palette results for images (055)', () => {
  const asset = 'a'.repeat(64);
  const deck: SododeckFile = {
    ...emptySododeckFile(),
    nodes: [{ id: 'w', type: 'client', title: 'Web' }],
    images: [
      {
        id: 'i1',
        asset,
        position: { x: 0, y: 0 },
        size: { width: 80, height: 60 },
        alt: 'Checkout flow sketch',
        caption: 'Figure one',
      },
    ],
    assets: {
      [asset]: {
        type: 'image/png',
        bytes: 1,
        width: 1,
        height: 1,
        name: 'whiteboard.png',
        data: '',
      },
    },
    edges: [{ id: 'wi', from: 'w', to: 'i1' }],
  };
  const run = (query: string) =>
    buildPaletteResults({ deck, searchIndex: buildSearchIndex(deck), query, commands: [] }).items;

  it('finds an image by alt text, caption and file name', () => {
    for (const query of ['sketch', 'figure', 'whiteboard']) {
      const hit = run(query).find((item) => item.kind === 'image');
      expect(hit?.id, query).toBe('i1');
      expect(hit?.meta).toBe('Image');
    }
  });

  it('labels a connector that touches an image', () => {
    expect(run('web checkout').find((item) => item.id === 'wi')?.meta).toBe(
      'Connection · Web → Checkout flow sketch',
    );
  });
});
