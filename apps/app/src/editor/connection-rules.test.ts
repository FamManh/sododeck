import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { connectionCheck, connectTargets, REFUSAL_TEXT } from './connection-rules';

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

describe('groups as connector ends (050 US4)', () => {
  // outer ⊃ inner ⊃ deep (card); outer ⊃ member (card); other is a separate group.
  const grouped: SododeckFile = {
    ...emptySododeckFile(),
    groups: [
      { id: 'outer', title: 'Data layer' },
      { id: 'inner', title: 'Storage', parent: 'outer' },
      { id: 'other', title: 'Edge' },
    ],
    nodes: [
      { id: 'member', type: 'service', title: 'Member', group: 'outer' },
      { id: 'deep', type: 'database', title: 'Deep', group: 'inner' },
      { id: 'free', type: 'service', title: 'Free' },
    ],
    edges: [{ id: 'g1', from: 'free', to: 'other' }],
  };

  it("refuses a group and anything inside it, in either direction ('contains')", () => {
    for (const inside of ['member', 'inner', 'deep']) {
      expect(connectionCheck(grouped, 'outer', inside)).toBe('contains');
      expect(connectionCheck(grouped, inside, 'outer')).toBe('contains');
    }
    expect(connectionCheck(grouped, 'inner', 'deep')).toBe('contains');
    expect(connectionCheck(grouped, 'inner', 'member')).toBe('ok');
    expect(connectionCheck(grouped, 'outer', 'other')).toBe('ok');
    expect(connectionCheck(grouped, 'deep', 'other')).toBe('ok');
  });

  it('applies the self and duplicate rules to groups', () => {
    expect(connectionCheck(grouped, 'outer', 'outer')).toBe('self');
    expect(connectionCheck(grouped, 'free', 'other')).toBe('duplicate');
    expect(connectionCheck(grouped, 'other', 'free')).toBe('duplicate');
    expect(connectionCheck(grouped, 'other', 'free', 'g1')).toBe('ok');
  });

  it('has a refusal text for contains', () => {
    expect(REFUSAL_TEXT.contains).toBe("Can't connect a group to something inside it");
  });

  it('survives a parent cycle in a hand-edited file', () => {
    const cyclic: SododeckFile = {
      ...grouped,
      groups: [
        { id: 'a', title: 'A', parent: 'b' },
        { id: 'b', title: 'B', parent: 'a' },
      ],
      nodes: [{ id: 'n', type: 'service', title: 'N', group: 'a' }],
    };
    expect(connectionCheck(cyclic, 'a', 'n')).toBe('contains');
    expect(connectionCheck(cyclic, 'b', 'n')).toBe('contains');
  });

  it('lists groups with kind group, disabled when refused', () => {
    const targets = connectTargets(grouped, 'free', '');
    const byId = new Map(targets.map((t) => [t.id, t]));
    expect(byId.get('outer')).toEqual({
      id: 'outer',
      title: 'Data layer',
      kind: 'group',
      disabled: false,
    });
    expect(byId.get('other')).toMatchObject({ kind: 'group', disabled: true });
    expect(targets.map((t) => t.id)).not.toContain('free');

    const fromGroup = new Map(connectTargets(grouped, 'outer', '').map((t) => [t.id, t]));
    expect(fromGroup.has('outer')).toBe(false);
    expect(fromGroup.get('member')).toMatchObject({ disabled: true, reason: 'inside' });
    expect(fromGroup.get('inner')).toMatchObject({ kind: 'group', disabled: true });
    expect(fromGroup.get('free')).toMatchObject({ disabled: false });
  });
});
