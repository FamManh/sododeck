import { emptySododeckFile, type SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { fixedWidthMeasurer } from '../export/text-measure';
import type { TargetTable } from '../relationships/column-target';
import type { TableContext } from '../table-keys';
import { tableLayout, type TableNode } from '../table-layout';
import { dragAt, portPoint } from './column-connect-drag';

const context: TableContext = {
  fk: new Map(),
  showSchema: false,
  enums: new Map(),
  display: {
    detail: 'all',
    hideTypes: false,
    hideNullable: false,
    hideNotes: false,
    hideIndexes: false,
  },
};

const node = (
  id: string,
  types: string[],
): TableNode & { id: string; columns: NonNullable<TableNode['columns']> } => ({
  id,
  title: id,
  columns: types.map((type, i) => ({
    id: `${id}.c${String(i)}`,
    name: `c${String(i)}`,
    type,
    ...(i === 0 ? { pk: true } : {}),
  })),
});

const orders = node('orders', ['uuid', 'int']);
const customers = node('customers', ['uuid']);
const deck: SododeckFile = {
  ...emptySododeckFile(),
  nodes: [
    { ...orders, type: 'db-table' },
    { ...customers, type: 'db-table' },
  ],
};
const target = (n: typeof orders, x: number): TargetTable => {
  const layout = tableLayout(n, context, 240, fixedWidthMeasurer(0.6));
  return {
    id: n.id,
    box: { x, y: 0, width: 240, height: layout.height },
    layout,
    columns: n.columns,
  };
};
const tables = [target(orders, 0), target(customers, 400)];
const source = { tableId: 'orders', columnId: 'orders.c1' };
const base = {
  source,
  mode: 'create' as const,
  from: { x: 240, y: 106 },
  point: { x: 240, y: 106 },
};

describe('column drag (042 R9)', () => {
  it('starts at the row on the pressed side', () => {
    expect(portPoint(tables, source, 'right')).toEqual({ x: 240, y: 106 });
    expect(portPoint(tables, source, 'left')).toEqual({ x: 0, y: 106 });
  });

  it('targets the row under the pointer, with the warning and the chip spot', () => {
    expect(dragAt(base, { x: 450, y: 80 }, tables, deck)).toEqual({
      ...base,
      point: { x: 450, y: 80 },
      target: { tableId: 'customers', columnId: 'customers.c0' },
      targetAt: { x: 640, y: 82 },
      mismatch: 'int → uuid',
    });
  });

  it('has no target over the source row or empty canvas', () => {
    expect(dragAt(base, { x: 100, y: 106 }, tables, deck).target).toBeUndefined();
    expect(dragAt(base, { x: 320, y: 80 }, tables, deck)).toEqual({
      ...base,
      point: { x: 320, y: 80 },
    });
  });

  it('reads a moved from end as target → fixed', () => {
    const moving = {
      ...base,
      mode: 'reconnect' as const,
      edgeId: 'r1',
      end: 'from' as const,
      source: { tableId: 'customers', columnId: 'customers.c0' },
    };
    expect(dragAt(moving, { x: 100, y: 106 }, tables, deck).mismatch).toBe('int → uuid');
  });
});
