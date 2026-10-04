import type { DeckProblems, Problem } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { schemaProblems } from './schema-problems';

function problem(key: string, kind: Problem['kind'], target: Problem['target']): Problem {
  return { key, kind, target, title: key, detail: key, objectTitle: key, order: 0 };
}

const list = [
  problem('a', 'db-dangling-reference', { type: 'node', id: 'orders' }),
  problem('b', 'db-composite-mismatch', { type: 'edges', ids: ['e1'] }),
  problem('c', 'db-dangling-reference', { type: 'node', id: 'users' }),
  problem('d', 'broken-reference', { type: 'node', id: 'orders' }),
  problem('e', 'db-dangling-reference', { type: 'nodes', ids: ['x', 'orders'] }),
];
const problems: DeckProblems = { list, total: list.length, byObject: new Map() };
const deck = { edges: [{ id: 'e1', from: 'items', to: 'orders' }] };

describe('schemaProblems', () => {
  it('keeps db problems touching a table in scope', () => {
    expect(schemaProblems(problems, ['orders'], deck).map((p) => p.key)).toEqual(['a', 'b', 'e']);
  });

  it('resolves relationship problems to their tables', () => {
    expect(schemaProblems(problems, ['items'], deck).map((p) => p.key)).toEqual(['b']);
  });

  it('ignores problems out of scope, other kinds and a missing list', () => {
    expect(schemaProblems(problems, ['payments'], deck)).toEqual([]);
    expect(schemaProblems(null, ['orders'], deck)).toEqual([]);
  });
});
