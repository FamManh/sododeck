import type { DeckProblems, Problem } from '@sododeck/model';
import { describe, expect, it } from 'vitest';

import { schemaProblems } from './schema-problems';

function problem(
  key: string,
  kind: Problem['kind'],
  target: Problem['target'],
  severity: Problem['severity'] = 'error',
): Problem {
  return {
    key,
    kind,
    target,
    title: key,
    detail: key,
    objectTitle: key,
    order: 0,
    severity,
    path: '',
  };
}

const list = [
  problem('a', 'db-dangling-reference', { type: 'node', id: 'orders' }),
  problem('b', 'db-composite-mismatch', { type: 'edges', ids: ['e1'] }),
  problem('c', 'db-dangling-reference', { type: 'node', id: 'users' }),
  problem('d', 'broken-reference', { type: 'node', id: 'orders' }),
  problem('e', 'db-dangling-reference', { type: 'nodes', ids: ['x', 'orders'] }),
  problem('w1', 'db-no-primary-key', { type: 'node', id: 'orders' }, 'warning'),
  problem('w2', 'db-no-primary-key', { type: 'node', id: 'payments' }, 'warning'),
];
const problems: DeckProblems = {
  list,
  total: list.length,
  errors: list.length,
  warnings: 0,
  byObject: new Map(),
};
const deck = { edges: [{ id: 'e1', from: 'items', to: 'orders' }] };

describe('schemaProblems', () => {
  const keys = (list: readonly Problem[]) => list.map((p) => p.key);

  it('splits db problems touching a table in scope into errors and warnings', () => {
    const { errors, warnings } = schemaProblems(problems, ['orders'], deck);
    expect(keys(errors)).toEqual(['a', 'b', 'e']);
    expect(keys(warnings)).toEqual(['w1']);
  });

  it('lists errors before warnings whatever the input order', () => {
    const mixed: DeckProblems = { ...problems, list: [list[5] as Problem, list[0] as Problem] };
    const { errors, warnings } = schemaProblems(mixed, ['orders'], deck);
    expect([...keys(errors), ...keys(warnings)]).toEqual(['a', 'w1']);
  });

  it('resolves relationship problems to their tables', () => {
    expect(keys(schemaProblems(problems, ['items'], deck).errors)).toEqual(['b']);
  });

  it('ignores problems out of scope, other kinds and a missing list', () => {
    expect(schemaProblems(problems, ['nowhere'], deck)).toEqual({ errors: [], warnings: [] });
    expect(schemaProblems(null, ['orders'], deck)).toEqual({ errors: [], warnings: [] });
  });
});
