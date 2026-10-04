import { describe, expect, it } from 'vitest';

import { fixedWidthMeasurer } from '../export/text-measure';
import type { TableContext } from '../table-keys';
import { tableLayout, type TableNode } from '../table-layout';
import { columnTargetAt, type TargetTable } from './column-target';

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

function target(id: string, x: number, pks: number): TargetTable {
  const node: TableNode = {
    id,
    title: id,
    columns: ['a', 'b', 'c'].map((c, i) => ({
      id: `${id}.${c}`,
      name: c,
      type: 'int',
      ...(i < pks ? { pk: true } : {}),
    })),
  };
  const layout = tableLayout(node, context, 240, fixedWidthMeasurer(0.6));
  return {
    id,
    box: { x, y: 0, width: 240, height: layout.height },
    layout,
    columns: node.columns ?? [],
  };
}

// Rows start at 70: 70–94 is the first row, 94–118 the second.
describe('columnTargetAt (042 FR-016)', () => {
  const tables = [target('orders', 0, 1), target('customers', 400, 1), target('lines', 800, 2)];

  it('hits the row under the point, on another table or the same one', () => {
    expect(columnTargetAt({ x: 500, y: 100 }, tables)).toEqual({
      tableId: 'customers',
      columnId: 'customers.b',
    });
    expect(columnTargetAt({ x: 20, y: 130 }, tables)).toEqual({
      tableId: 'orders',
      columnId: 'orders.c',
    });
  });

  it('falls back to a single-column primary key over the header or title', () => {
    expect(columnTargetAt({ x: 500, y: 20 }, tables)).toEqual({
      tableId: 'customers',
      columnId: 'customers.a',
    });
  });

  it('has no target over a composite key header, without a key, or on the canvas', () => {
    expect(columnTargetAt({ x: 900, y: 20 }, tables)).toBeUndefined();
    expect(columnTargetAt({ x: 20, y: 20 }, [target('plain', 0, 0)])).toBeUndefined();
    expect(columnTargetAt({ x: 340, y: 100 }, tables)).toBeUndefined();
  });

  it('prefers the table drawn on top', () => {
    const under = target('under', 0, 1);
    const over = target('over', 0, 1);
    expect(columnTargetAt({ x: 10, y: 80 }, [under, over])?.tableId).toBe('over');
  });
});
