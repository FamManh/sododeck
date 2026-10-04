import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { connectionCheck, connectTargets } from './connection-rules';

const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { id: 'svc', type: 'service', title: 'Order Service' },
    { id: 'db', type: 'database', title: 'Orders DB' },
    { id: 'q', type: 'queue', title: 'Event Bus' },
  ],
  edges: [{ id: 'e1', from: 'svc', to: 'db' }],
};

describe('connectTargets icons (038)', () => {
  it('carries the stored icon of a card, not of a shape', () => {
    const iconed: SododeckFile = {
      ...deck,
      nodes: [
        ...deck.nodes,
        { id: 'c', type: 'service', title: 'Card', icon: 'lucide:search' },
        { id: 's', type: 'rectangle', title: 'Shape', icon: 'lucide:search' },
      ],
    };
    const byId = new Map(connectTargets(iconed, 'svc', '').map((t) => [t.id, t]));
    expect(byId.get('c')?.icon).toBe('lucide:search');
    expect(byId.get('s')).not.toHaveProperty('icon');
    expect(byId.get('q')).not.toHaveProperty('icon');
  });
});

describe('connectionCheck', () => {
  it('refuses self and duplicate connections in either direction', () => {
    expect(connectionCheck(deck, 'svc', 'svc')).toBe('self');
    expect(connectionCheck(deck, 'svc', 'db')).toBe('duplicate');
    expect(connectionCheck(deck, 'db', 'svc')).toBe('duplicate');
    expect(connectionCheck(deck, 'svc', 'q')).toBe('ok');
  });

  it('ignores the edge being reconnected', () => {
    expect(connectionCheck(deck, 'svc', 'db', 'e1')).toBe('ok');
    expect(connectionCheck(deck, 'db', 'db', 'e1')).toBe('self');
  });
});

describe('connectTargets', () => {
  it('lists other components by title, marking duplicates disabled', () => {
    expect(connectTargets(deck, 'svc', '')).toEqual([
      { id: 'q', title: 'Event Bus', kind: 'queue', disabled: false },
      {
        id: 'db',
        title: 'Orders DB',
        kind: 'database',
        disabled: true,
        reason: 'already connected',
      },
    ]);
  });

  it('filters case-insensitively by title', () => {
    expect(connectTargets(deck, 'svc', 'ORD').map((t) => t.id)).toEqual(['db']);
    expect(connectTargets(deck, 'svc', 'zzz')).toEqual([]);
  });
});
