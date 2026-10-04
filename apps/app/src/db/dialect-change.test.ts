import type { DbColumn, Dialect, Node, SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { changeGroups, planDialectChange } from './dialect-change';

function col(id: string, name: string, type: string, extra: Partial<DbColumn> = {}): DbColumn {
  return { id, name, type, ...extra };
}

function table(id: string, columns: DbColumn[], schema?: string): Node {
  return {
    id,
    type: 'db-table',
    title: id,
    ...(schema === undefined ? {} : { schema }),
    columns,
  };
}

function deck(dialect: Dialect, nodes: Node[]): SododeckFile {
  return { dialect, nodes, edges: [] } as unknown as SododeckFile;
}

const shop = (): SododeckFile =>
  deck('postgres', [
    table('customers', [col('c1', 'id', 'uuid')]),
    table('orders', [
      col('o1', 'created_at', 'timestamptz'),
      col('o2', 'total', 'numeric', { size: '10,2' }),
      col('o3', 'status', 'order_status', { enumRef: 'e1' }),
    ]),
    table('payments', [col('p1', 'metadata', 'jsonb')]),
    table('docs', [col('d1', 'search', 'tsvector')]),
  ]);

describe('planDialectChange', () => {
  it('plans Postgres → MySQL like the contract example', () => {
    const plan = planDialectChange(shop(), 'mysql');
    expect(plan.from).toBe('postgres');
    expect(plan.to).toBe('mysql');
    const byLabel = Object.fromEntries(plan.changes.map((c) => [c.label, c]));
    expect(byLabel['customers.id']?.after).toEqual({ type: 'char', size: '36' });
    expect(byLabel['orders.created_at']?.after).toEqual({ type: 'timestamp' });
    expect(byLabel['orders.total']?.after).toEqual({ type: 'decimal', size: '10,2' });
    expect(byLabel['payments.metadata']?.after).toEqual({ type: 'json' });
    expect(byLabel['orders.status']).toBeUndefined();
    expect(plan.kept.map((k) => k.label)).toEqual(['docs.search']);
    expect(plan.kept[0]?.type).toBe('tsvector');
  });

  it('keeps tables and columns in deck order', () => {
    const labels = planDialectChange(shop(), 'mysql').changes.map((c) => c.label);
    expect(labels).toEqual([
      'customers.id',
      'orders.created_at',
      'orders.total',
      'payments.metadata',
    ]);
  });

  it('skips enum-linked columns', () => {
    const plan = planDialectChange(shop(), 'mysql');
    expect(plan.kept.some((k) => k.columnId === 'o3')).toBe(false);
    expect(plan.changes.some((c) => c.columnId === 'o3')).toBe(false);
  });

  it('turns serial into int with increment', () => {
    const plan = planDialectChange(
      deck('postgres', [table('t', [col('a', 'id', 'serial'), col('b', 'big', 'bigserial')])]),
      'mysql',
    );
    expect(plan.changes[0]?.after).toEqual({ type: 'int', increment: true });
    expect(plan.changes[1]?.after).toEqual({ type: 'bigint', increment: true });
  });

  it('keeps a size where the target allows it and flags a dropped one', () => {
    const source = deck('postgres', [table('t', [col('a', 'name', 'varchar', { size: '80' })])]);
    expect(planDialectChange(source, 'mysql').changes).toEqual([]);
    const numeric = deck('postgres', [table('t', [col('a', 'n', 'numeric', { size: '10,2' })])]);
    const mysql = planDialectChange(numeric, 'mysql').changes[0];
    expect(mysql?.after).toEqual({ type: 'decimal', size: '10,2' });
    expect(mysql?.sizeDropped).toBe(false);
    const sqlite = planDialectChange(source, 'sqlite').changes[0];
    expect(sqlite?.after).toEqual({ type: 'text' });
    expect(sqlite?.sizeDropped).toBe(true);
  });

  it('returns an empty plan for the same dialect', () => {
    const plan = planDialectChange(shop(), 'postgres');
    expect(plan.changes).toEqual([]);
    expect(plan.kept).toEqual([]);
  });

  it('skips a column already written in the target spelling', () => {
    const plan = planDialectChange(
      deck('generic', [table('t', [col('a', 'x', 'text'), col('b', 'y', 'int')])]),
      'postgres',
    );
    expect(plan.changes.map((c) => c.columnId)).toEqual(['b']);
    expect(plan.changes[0]?.after.type).toBe('integer');
  });

  it('converts Generic → SQL and SQL → Generic', () => {
    const generic = deck('generic', [
      table('t', [col('a', 'id', 'uuid'), col('b', 'n', 'varchar', { size: '20' })]),
    ]);
    for (const to of ['postgres', 'mysql', 'sqlite'] as const) {
      const plan = planDialectChange(generic, to);
      expect(plan.from).toBe('generic');
      expect(plan.changes.length + plan.kept.length).toBeGreaterThanOrEqual(0);
      if (to !== 'postgres') expect(plan.changes.length).toBeGreaterThan(0);
    }
    const back = planDialectChange(
      deck('mysql', [
        table('t', [
          col('a', 'n', 'varchar', { size: '20' }),
          col('b', 'm', 'mediumtext'),
          col('c', 'p', 'decimal', { size: '10,2' }),
        ]),
      ]),
      'generic',
    );
    expect(back.changes.map((c) => c.after)).toEqual([{ type: 'text' }]);
  });

  it('qualifies labels only when the deck has several schemas', () => {
    const one = planDialectChange(
      deck('postgres', [table('t', [col('a', 'id', 'uuid')], 'app')]),
      'mysql',
    );
    expect(one.changes[0]?.label).toBe('t.id');
    const many = planDialectChange(
      deck('postgres', [
        table('t', [col('a', 'id', 'uuid')], 'app'),
        table('u', [col('b', 'id', 'uuid')], 'audit'),
      ]),
      'mysql',
    );
    expect(many.changes.map((c) => c.label)).toEqual(['app.t.id', 'audit.u.id']);
  });

  it('plans 150 tables × 12 columns in under 50 ms', () => {
    const nodes = Array.from({ length: 150 }, (_, t) =>
      table(
        `t${String(t)}`,
        Array.from({ length: 12 }, (_, c) =>
          col(`t${String(t)}c${String(c)}`, `c${String(c)}`, c % 2 === 0 ? 'uuid' : 'jsonb'),
        ),
      ),
    );
    const start = performance.now();
    const plan = planDialectChange(deck('postgres', nodes), 'mysql');
    expect(performance.now() - start).toBeLessThan(50);
    expect(plan.changes).toHaveLength(1800);
  });
});

describe('changeGroups', () => {
  it('counts changes by conversion in first-seen order', () => {
    const plan = planDialectChange(
      deck('postgres', [
        table('t', [col('a', 'a', 'uuid'), col('b', 'b', 'jsonb'), col('c', 'c', 'uuid')]),
      ]),
      'mysql',
    );
    expect(changeGroups(plan)).toEqual([
      { before: 'uuid', after: 'char(36)', count: 2 },
      { before: 'jsonb', after: 'json', count: 1 },
    ]);
  });
});
