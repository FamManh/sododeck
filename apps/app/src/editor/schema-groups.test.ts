import { schemaGroupId } from '@sododeck/model';
import { emptySododeckFile, type Node, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { collapsedSchemaTables, groupTitleOf, schemaGroupedDeck } from './schema-groups';

const table = (id: string, schema?: string, group?: string): Node => ({
  id,
  type: 'db-table',
  title: id,
  ...(schema === undefined ? {} : { schema }),
  ...(group === undefined ? {} : { group }),
});

const deck = (nodes: Node[], groups: SododeckFile['groups'] = []): SododeckFile => ({
  ...emptySododeckFile(),
  nodes,
  groups,
});

describe('schemaGroupedDeck', () => {
  it('makes one virtual group per schema with the schema name as title', () => {
    const out = schemaGroupedDeck(
      deck([table('a', 'billing'), table('b', 'auth'), table('c', 'billing')]),
    );
    expect(out.groups.map((g) => [g.id, g.title])).toEqual([
      [schemaGroupId('billing'), 'billing'],
      [schemaGroupId('auth'), 'auth'],
    ]);
    expect(out.nodes.map((n) => n.group)).toEqual([
      'schema:billing',
      'schema:auth',
      'schema:billing',
    ]);
  });

  it('leaves tables without a schema and other nodes where they are', () => {
    const service: Node = { id: 's', type: 'service', title: 'S', schema: 'billing', group: 'g' };
    const out = schemaGroupedDeck(
      deck([table('a'), table('b', '', 'g'), service], [{ id: 'g', title: 'G' }]),
    );
    expect(out.groups.map((g) => g.id)).toEqual(['g']);
    expect(out.nodes.map((n) => n.group)).toEqual([undefined, 'g', 'g']);
  });

  it('a table with a real group follows its schema; the stored deck is not changed', () => {
    const input = deck(
      [table('a', 'billing', 'g'), table('b', undefined, 'g')],
      [
        { id: 'g', title: 'G' },
        { id: 'h', title: 'H', parent: 'g' },
      ],
    );
    const out = schemaGroupedDeck(input);
    expect(out.nodes[0]?.group).toBe('schema:billing');
    expect(out.nodes[1]?.group).toBe('g');
    expect(out.groups.map((g) => g.id)).toEqual(['g', 'h', 'schema:billing']);
    expect(out.groups[1]?.parent).toBe('g');
    expect(input.nodes[0]?.group).toBe('g');
  });

  it('drops a real group that only schema grouping emptied, keeps ones empty before', () => {
    const out = schemaGroupedDeck(
      deck(
        [table('a', 'billing', 'g')],
        [
          { id: 'g', title: 'G' },
          { id: 'e', title: 'Empty' },
        ],
      ),
    );
    expect(out.groups.map((g) => g.id)).toEqual(['e', 'schema:billing']);
  });

  it('returns the deck itself when no table has a schema', () => {
    const input = deck([table('a'), table('b', '')]);
    expect(schemaGroupedDeck(input)).toBe(input);
  });

  it('is identity-stable for the same lists', () => {
    const input = deck([table('a', 'billing')]);
    expect(schemaGroupedDeck(input)).toBe(schemaGroupedDeck(input));
    const edited = { ...input, edges: [] };
    expect(schemaGroupedDeck(edited).nodes).toBe(schemaGroupedDeck(input).nodes);
    expect(schemaGroupedDeck(edited).groups).toBe(schemaGroupedDeck(input).groups);
  });
});

describe('collapsedSchemaTables and groupTitleOf', () => {
  it('maps tables of collapsed schema groups to their group', () => {
    const grouped = schemaGroupedDeck(deck([table('a', 'billing'), table('b', 'auth')]));
    const map = collapsedSchemaTables(grouped, new Set(['schema:billing', 'g']));
    expect([...map]).toEqual([['a', 'schema:billing']]);
    expect(collapsedSchemaTables(grouped, new Set()).size).toBe(0);
  });

  it('names a derived group by its schema and a stored one by its title', () => {
    const input = deck([], [{ id: 'g', title: 'G' }]);
    expect(groupTitleOf(input, 'schema:billing')).toBe('billing');
    expect(groupTitleOf(input, 'g')).toBe('G');
    expect(groupTitleOf(input, 'nope')).toBeUndefined();
  });
});
