import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import {
  columnConnectionCheck,
  connectionCheck,
  connectTargets,
  REFUSAL_TEXT,
} from './connection-rules';

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

describe('columnConnectionCheck (042 R12)', () => {
  const end = (tableId: string, columnId: string) => ({ tableId, columnId });
  const edges: SododeckFile['edges'] = [
    { id: 'r1', from: 'o', to: 'c', fromColumns: ['o.cid'], toColumns: ['c.id'] },
  ];

  it('allows a self-reference and a second relationship between the same tables', () => {
    expect(columnConnectionCheck({ edges }, end('t', 't.parent'), end('t', 't.id'))).toEqual({
      ok: true,
    });
    expect(columnConnectionCheck({ edges }, end('o', 'o.bid'), end('c', 'c.id'))).toEqual({
      ok: true,
    });
    expect(columnConnectionCheck({ edges }, end('c', 'c.id'), end('o', 'o.cid'))).toEqual({
      ok: true,
    });
  });

  it('returns the existing relationship for the same pair and direction', () => {
    expect(columnConnectionCheck({ edges }, end('o', 'o.cid'), end('c', 'c.id'))).toEqual({
      ok: false,
      existing: 'r1',
    });
    expect(columnConnectionCheck({ edges }, end('o', 'o.cid'), end('c', 'c.id'), 'r1')).toEqual({
      ok: true,
    });
  });

  it('refuses the source row itself', () => {
    expect(columnConnectionCheck({ edges }, end('o', 'o.cid'), end('o', 'o.cid'))).toEqual({
      ok: false,
    });
  });

  it('leaves card connections refusing self and duplicates', () => {
    const deck = { ...emptySododeckFile(), edges };
    expect(connectionCheck(deck, 'o', 'o')).toBe('self');
    expect(connectionCheck(deck, 'c', 'o')).toBe('duplicate');
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

describe('stickies as connector ends (053 US1)', () => {
  const withNotes: SododeckFile = {
    ...deck,
    groups: [{ id: 'g', title: 'Platform' }],
    stickies: [
      { id: 'n1', text: 'Ask the team about retries' },
      { id: 'n2', text: 'Second note' },
    ],
    edges: [...deck.edges, { id: 'e2', from: 'n1', to: 'svc' }],
  };

  it('accepts sticky to card, sticky to group and sticky to sticky', () => {
    expect(connectionCheck(withNotes, 'n1', 'q')).toBe('ok');
    expect(connectionCheck(withNotes, 'n1', 'g')).toBe('ok');
    expect(connectionCheck(withNotes, 'n1', 'n2')).toBe('ok');
    expect(connectionCheck(withNotes, 'q', 'n2')).toBe('ok');
  });

  it('refuses a sticky to itself and a duplicate in either direction', () => {
    expect(connectionCheck(withNotes, 'n1', 'n1')).toBe('self');
    expect(connectionCheck(withNotes, 'n1', 'svc')).toBe('duplicate');
    expect(connectionCheck(withNotes, 'svc', 'n1')).toBe('duplicate');
  });

  it('lists notes for the keyboard connect popover, titled by their first line', () => {
    const targets = connectTargets(withNotes, 'svc', '');
    const note = targets.find((t) => t.id === 'n2');
    expect(note).toEqual({ id: 'n2', title: 'Second note', kind: 'note', disabled: false });
    expect(targets.find((t) => t.id === 'n1')).toMatchObject({ kind: 'note', disabled: true });
    expect(connectTargets(withNotes, 'n1', '').some((t) => t.id === 'n1')).toBe(false);
    expect(connectTargets(withNotes, 'svc', 'second').map((t) => t.id)).toEqual(['n2']);
  });
});
