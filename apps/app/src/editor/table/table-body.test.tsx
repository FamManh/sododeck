import type { DbColumn } from '@sododeck/schema';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { fixedWidthMeasurer } from '../export/text-measure';
import type { TableContext } from '../table-keys';
import { tableLayout, type TableNode } from '../table-layout';
import { TableBody } from './table-body';

const col = (id: string, extra: Partial<DbColumn> = {}): DbColumn => ({
  id,
  name: id,
  type: 'uuid',
  notNull: true,
  ...extra,
});

const orders: TableNode = {
  id: 'orders',
  title: 'orders',
  columns: [
    col('id', { pk: true }),
    col('customer_id'),
    col('number', { type: 'text', unique: true }),
    col('status', { type: 'order_status', enumRef: 'e-status' }),
    col('coupon_code', { type: 'text', notNull: false }),
    col('total_cents', { type: 'int' }),
    col('created_at', { type: 'timestamptz' }),
  ],
  indexes: [
    { id: 'i1', columns: ['id'] },
    { id: 'i2', columns: ['number'] },
  ],
};

function context(over: Partial<TableContext['display']> = {}): TableContext {
  return {
    fk: new Map([['orders', new Set(['customer_id', 'id'])]]),
    showSchema: false,
    enums: new Map([['e-status', { id: 'e-status', name: 'order_status', values: [] }]]),
    display: {
      detail: 'auto',
      hideTypes: false,
      hideNullable: false,
      hideNotes: false,
      hideIndexes: false,
      ...over,
    },
  };
}

function renderBody(node: TableNode = orders, ctx: TableContext = context()) {
  const layout = tableLayout(node, ctx, undefined, fixedWidthMeasurer(0.6));
  return render(<TableBody nodeId="orders" layout={layout} focused={false} />);
}

describe('TableBody (041 contracts/table-card-ui.md)', () => {
  it('lists the columns in stored order with their full text', () => {
    renderBody();
    const list = screen.getByRole('list', { name: 'Columns' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
      'id, uuid, primary key, foreign key',
      'customer_id, uuid, foreign key',
      'number, text, unique',
      'status, order_status',
      'coupon_code, text, nullable',
      'total_cents, int',
      'created_at, timestamptz',
    ]);
  });

  it('draws named glyphs: both on a PK + FK row, a "U" for unique, "?" for nullable', () => {
    renderBody();
    const id = screen.getByRole('listitem', { name: /^id,/ });
    expect(within(id).getByRole('img', { name: 'Primary key' })).toBeInTheDocument();
    expect(within(id).getByRole('img', { name: 'Foreign key' })).toBeInTheDocument();
    const number = screen.getByRole('listitem', { name: /^number,/ });
    expect(within(number).getByRole('img', { name: 'Unique' })).toHaveTextContent('U');
    const coupon = screen.getByRole('listitem', { name: /^coupon_code,/ });
    expect(coupon).toHaveTextContent('?');
    expect(screen.getByRole('listitem', { name: /^total_cents,/ })).not.toHaveTextContent('?');
  });

  it('shows an enum column as a chip button', () => {
    renderBody();
    expect(screen.getByRole('button', { name: 'order_status values' })).toHaveTextContent(
      'order_status',
    );
  });

  it('shows "+n columns" at Keys and "n columns" at Names, and the index footer', () => {
    const { unmount } = renderBody(orders, context({ detail: 'keys' }));
    expect(screen.getByRole('img', { name: '+5 columns hidden' })).toHaveTextContent('+5 columns');
    expect(screen.getByRole('img', { name: '2 indexes' })).toBeInTheDocument();
    unmount();
    renderBody({ ...orders, detail: 'names' });
    expect(screen.queryByRole('list', { name: 'Columns' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: '7 columns' })).toBeInTheDocument();
  });

  it('hides types, nullable and the footer when the deck says so', () => {
    renderBody(orders, context({ hideTypes: true, hideNullable: true, hideIndexes: true }));
    expect(screen.queryByRole('button', { name: 'order_status values' })).not.toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: 'coupon_code' })).not.toHaveTextContent('?');
    expect(screen.queryByRole('img', { name: '2 indexes' })).not.toBeInTheDocument();
    expect(screen.getByRole('listitem', { name: /^coupon_code/ })).toHaveAttribute(
      'aria-label',
      'coupon_code',
    );
  });

  it('draws nothing for a table without columns', () => {
    const { container } = renderBody({ id: 'e', title: 'e', columns: [] });
    expect(container).toBeEmptyDOMElement();
  });
});

describe('TableBody editing marks (043)', () => {
  it('shows the (!) icon on a mismatched row, named with both types, and drops it once they match', () => {
    const mismatched = new Map([['orders:customer_id', 'int → uuid · orders.customer_id']]);
    const { rerender } = renderBody(orders, { ...context(), mismatched });
    expect(
      screen.getByRole('img', { name: 'Type differs: int → uuid (orders.customer_id)' }),
    ).toBeInTheDocument();
    const layout = tableLayout(orders, context(), undefined, fixedWidthMeasurer(0.6));
    rerender(<TableBody nodeId="orders" layout={layout} focused={false} />);
    expect(screen.queryByRole('img', { name: /^Type differs/ })).toBeNull();
  });

  it('gives every row a reorder grip, except on a locked table', () => {
    const { rerender } = renderBody();
    expect(screen.getByRole('button', { name: 'Reorder customer_id' })).toBeInTheDocument();
    const layout = tableLayout(orders, context(), undefined, fixedWidthMeasurer(0.6));
    rerender(<TableBody nodeId="orders" layout={layout} focused={false} locked />);
    expect(screen.queryByRole('button', { name: /^Reorder/ })).toBeNull();
  });
});

describe('TableBody touched rows (049 US3)', () => {
  const measure = fixedWidthMeasurer(0.6);

  it('marks read and write rows by letter and shape and says it in the row name', () => {
    const layout = tableLayout(
      orders,
      context({ detail: 'keys' }),
      undefined,
      measure,
      new Set(['total_cents']),
    );
    render(
      <TableBody
        nodeId="orders"
        layout={layout}
        focused={false}
        touched={
          new Map([
            ['total_cents', 'write'],
            ['id', 'read'],
          ])
        }
      />,
    );
    const written = screen.getByRole('listitem', { name: /^total_cents.*, writes$/ });
    expect(within(written).getByText('W')).toHaveAttribute('data-access', 'write');
    const read = screen.getByRole('listitem', { name: /^id.*, reads$/ });
    expect(within(read).getByText('R')).toHaveAttribute('data-access', 'read');
    expect(screen.getByRole('listitem', { name: /^customer_id/ })).not.toHaveAttribute(
      'data-touch-access',
    );
  });
});
