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
    expect(results.overflowText).toBe('Showing 50 of 60');
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
