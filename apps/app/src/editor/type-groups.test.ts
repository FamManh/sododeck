import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { typeGroups } from './type-groups';

const deck = (patch: Partial<SododeckFile>): SododeckFile => ({ ...emptySododeckFile(), ...patch });
const names = (groups: ReturnType<typeof typeGroups>) =>
  groups.map((g) => [g.name, g.types.map((t) => t.id)]);

describe('typeGroups (030)', () => {
  it('lists only Architecture for a deck with no packs', () => {
    expect(names(typeGroups(deck({})))).toEqual([
      [
        'Architecture',
        ['service', 'database', 'gateway', 'client', 'queue', 'external', 'component'],
      ],
    ]);
  });

  it('lists every category whose pack is on, in category order', () => {
    const groups = typeGroups(deck({ packs: ['logistics', 'process'] }));
    expect(names(groups)).toEqual([
      ['Process', ['task', 'decision', 'document']],
      ['Logistics', ['warehouse', 'truck-route']],
    ]);
  });

  it('keeps a type in use or chosen while its pack is off, and puts unknown ids under Other', () => {
    const groups = typeGroups(
      deck({
        packs: ['architecture'],
        nodes: [
          { id: 'a', type: 'warehouse', title: 'A' },
          { id: 'b', type: 'robot', title: 'B' },
        ],
      }),
      ['issue'],
    );
    // Display order (051): Data before Architecture, Logistics last.
    expect(names(groups).map(([name]) => name)).toEqual([
      'Data',
      'Architecture',
      'Logistics',
      'Other',
    ]);
    expect(groups.at(-1)?.types).toEqual([{ id: 'robot', name: 'robot' }]);
  });
});

describe('shapes in the view settings type list (031)', () => {
  it('lists the eleven shapes under Shapes when Basic shapes is on', () => {
    const groups = typeGroups({ ...emptySododeckFile(), packs: ['architecture', 'shapes'] });
    expect(groups.map((g) => g.name)).toEqual(['Shapes', 'Architecture']);
    expect(groups[0]?.types).toHaveLength(11);
  });
});
