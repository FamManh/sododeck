import { VIEW_PRESETS } from '@sododeck/model';
import type { SododeckFile, View } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { deckOf } from '../test/render-canvas';
import { firstViewShowing, flowCountByNode, viewFilter } from './view-filter';

const deck: SododeckFile = deckOf({
  nodes: [
    { id: 'app', type: 'client', title: 'App', group: 'clients' },
    { id: 'web', type: 'client', title: 'Web', group: 'clients', tags: ['legacy'] },
    { id: 'api', type: 'gateway', title: 'API', group: 'edge' },
    { id: 'svc', type: 'service', title: 'Svc', group: 'core' },
    { id: 'db', type: 'database', title: 'DB', group: 'data' },
    { id: 'pay', type: 'external', title: 'Pay', tags: ['pci', 'legacy'] },
  ],
  groups: [
    { id: 'clients', title: 'Clients' },
    { id: 'platform', title: 'Platform' },
    { id: 'edge', title: 'Edge', parent: 'platform' },
    { id: 'core', title: 'Core', parent: 'platform' },
    { id: 'data', title: 'Data', parent: 'core' },
  ],
  edges: [
    { id: 'e1', from: 'app', to: 'api' },
    { id: 'e2', from: 'api', to: 'svc' },
    { id: 'e3', from: 'svc', to: 'db' },
    { id: 'e4', from: 'svc', to: 'pay' },
  ],
  features: [
    { id: 'checkout', title: 'Checkout' },
    { id: 'billing', title: 'Billing' },
  ],
  flows: [
    {
      id: 'f1',
      title: 'Order',
      feature: 'checkout',
      steps: [
        { id: 's1', edge: 'e1' },
        { id: 's2', edge: 'e2' },
      ],
    },
    { id: 'f2', title: 'Pay', feature: 'billing', steps: [{ id: 's3', edge: 'e4' }] },
    { id: 'f3', title: 'Broken', steps: [{ id: 's4', edge: 'gone' }] },
  ],
});

const view = (patch: Partial<View> = {}): View => ({
  id: 'v',
  type: 'custom',
  title: 'V',
  ...patch,
});
const none = new Set<string>();
const sorted = (set: ReadonlySet<string>) => [...set].sort();

describe('viewFilter (FR-012–FR-014)', () => {
  it('hides and dims nothing for a plain view', () => {
    const result = viewFilter(deck, view(), none);
    expect(result.hidden.size).toBe(0);
    expect(result.dimmed.size).toBe(0);
  });

  it('treats includes as a whitelist', () => {
    expect(sorted(viewFilter(deck, view({ includes: ['api', 'svc'] }), none).hidden)).toEqual([
      'app',
      'db',
      'pay',
      'web',
    ]);
  });

  it('hides excluded groups with their nested groups', () => {
    expect(sorted(viewFilter(deck, view({ excludeGroups: ['platform'] }), none).hidden)).toEqual([
      'api',
      'db',
      'svc',
    ]);
    expect(sorted(viewFilter(deck, view({ excludeGroups: ['core'] }), none).hidden)).toEqual([
      'db',
      'svc',
    ]);
  });

  it('hides excluded kinds and any node carrying an excluded tag', () => {
    expect(sorted(viewFilter(deck, view({ excludeKinds: ['client'] }), none).hidden)).toEqual([
      'app',
      'web',
    ]);
    expect(sorted(viewFilter(deck, view({ excludeTags: ['legacy'] }), none).hidden)).toEqual([
      'pay',
      'web',
    ]);
  });

  it('matches tags by key, ignoring case and spacing, in both directions (033)', () => {
    const cased = {
      ...deck,
      nodes: deck.nodes.map((n) => (n.id === 'pay' ? { ...n, tags: ['PCI', 'Legacy  Code'] } : n)),
    };
    expect(sorted(viewFilter(cased, view({ excludeTags: ['pci'] }), none).hidden)).toEqual(['pay']);
    expect(
      sorted(viewFilter(cased, view({ excludeTags: [' legacy code '] }), none).hidden),
    ).toEqual(['pay']);
    const lower = {
      ...deck,
      nodes: deck.nodes.map((n) => (n.id === 'pay' ? { ...n, tags: ['pci'] } : n)),
    };
    expect(sorted(viewFilter(lower, view({ excludeTags: ['PCI'] }), none).hidden)).toEqual(['pay']);
  });

  it('keeps only the ends of edges used by a feature flow', () => {
    expect(sorted(viewFilter(deck, view({ feature: 'checkout' }), none).hidden)).toEqual([
      'db',
      'pay',
      'web',
    ]);
    // A feature that no longer exists falls back to all components.
    expect(viewFilter(deck, view({ feature: 'gone' }), none).hidden.size).toBe(0);
  });

  it('dims kinds, but never hidden components', () => {
    const result = viewFilter(deck, view({ dimKinds: ['client'], excludeTags: ['legacy'] }), none);
    expect(sorted(result.dimmed)).toEqual(['app']);
  });

  it('hides the children of a hidden component', () => {
    const nested = deckOf({
      nodes: [
        { id: 'p', type: 'service', title: 'P', tags: ['x'] },
        { id: 'k', type: 'service', title: 'K', parent: 'p' },
        { id: 'kk', type: 'service', title: 'KK', parent: 'k' },
      ],
    });
    expect(sorted(viewFilter(nested, view({ excludeTags: ['x'] }), none).hidden)).toEqual([
      'k',
      'kk',
      'p',
    ]);
  });

  it('never hides revealed components', () => {
    const result = viewFilter(deck, view({ excludeKinds: ['client'] }), new Set(['app']));
    expect(sorted(result.hidden)).toEqual(['web']);
  });

  it('Infra dims clients and hides nothing', () => {
    const infra = VIEW_PRESETS[2] as View;
    const result = viewFilter(deck, infra, none);
    expect(result.hidden.size).toBe(0);
    expect(sorted(result.dimmed)).toEqual(['app', 'web']);
  });

  it('keeps the same sets while the result does not change', () => {
    const v = view({ excludeKinds: ['client'] });
    const first = viewFilter(deck, v, none);
    const again = viewFilter({ ...deck, nodes: [...deck.nodes] }, v, none);
    expect(again.hidden).toBe(first.hidden);
    expect(again.dimmed).toBe(first.dimmed);
  });

  it('runs in linear time on 500 components', () => {
    const big = deckOf({
      nodes: Array.from({ length: 500 }, (_, i) => ({
        id: `n${String(i)}`,
        type: 'service' as const,
        title: `N${String(i)}`,
        group: `g${String(i % 25)}`,
        tags: [`t${String(i % 7)}`],
      })),
      groups: Array.from({ length: 25 }, (_, i) => ({
        id: `g${String(i)}`,
        title: `G${String(i)}`,
        ...(i > 0 ? { parent: `g${String(i - 1)}` } : {}),
      })),
    });
    const v = view({ excludeGroups: ['g20'], excludeTags: ['t3'], dimKinds: ['service'] });
    viewFilter(big, v, none);
    const start = performance.now();
    for (let i = 0; i < 10; i++) viewFilter({ ...big, nodes: [...big.nodes] }, v, none);
    expect((performance.now() - start) / 10).toBeLessThan(5);
  });
});

describe('flowCountByNode (FR-011)', () => {
  it('counts flows with a step touching each component, once per flow', () => {
    const counts = flowCountByNode(deck);
    expect(counts.get('api')).toBe(1);
    expect(counts.get('svc')).toBe(2);
    expect(counts.get('db')).toBeUndefined();
    expect(flowCountByNode(deck)).toBe(counts);
  });
});

describe('firstViewShowing (FR-016)', () => {
  it('returns the first view whose filters show the component, else null', () => {
    const views: View[] = [
      view({ id: 'a', excludeKinds: ['client'] }),
      view({ id: 'b', excludeTags: ['legacy'] }),
      view({ id: 'c' }),
    ];
    expect(firstViewShowing(deck, views, 'app')?.id).toBe('b');
    expect(firstViewShowing(deck, views, 'web')?.id).toBe('c');
    expect(firstViewShowing(deck, views.slice(0, 2), 'web')).toBeNull();
  });
});

describe('viewFilter by card type (030)', () => {
  const typed = deckOf({
    nodes: [
      { id: 'w', type: 'warehouse', title: 'Hub' },
      { id: 'r', type: 'truck-route', title: 'Route' },
      { id: 's', type: 'service', title: 'Svc' },
    ],
  });
  const mk = (patch: Partial<View>): View => ({ id: 'v', type: 'custom', title: 'V', ...patch });

  it('hides and dims by new type ids', () => {
    expect([...viewFilter(typed, mk({ excludeKinds: ['warehouse'] }), none).hidden]).toEqual(['w']);
    expect([...viewFilter(typed, mk({ dimKinds: ['truck-route'] }), none).dimmed]).toEqual(['r']);
  });

  it('keeps hiding a type whose pack is off', () => {
    const off = deckOf({ ...typed, packs: ['architecture'] });
    expect([...viewFilter(off, mk({ excludeKinds: ['warehouse'] }), none).hidden]).toEqual(['w']);
  });
});

describe('shape types in views (031 US5)', () => {
  const file = deckOf({
    nodes: [
      { id: 'ok', type: 'diamond', title: 'OK?' },
      { id: 'go', type: 'pill', title: 'Go' },
      { id: 'svc', type: 'service', title: 'Svc' },
    ],
  });
  const custom = (patch: Partial<View>): View => ({
    id: 'v',
    type: 'custom',
    title: 'V',
    ...patch,
  });

  it('hides and dims each shape type like a card type', () => {
    const result = viewFilter(
      file,
      custom({ excludeKinds: ['diamond'], dimKinds: ['pill'] }),
      new Set(),
    );
    expect([...result.hidden]).toEqual(['ok']);
    expect([...result.dimmed]).toEqual(['go']);
  });
});
