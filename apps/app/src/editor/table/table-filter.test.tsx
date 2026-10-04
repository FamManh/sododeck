import type { DbColumn } from '@sododeck/schema';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { editorWrapper, deckOf } from '../../test/render-canvas';
import { fixedWidthMeasurer } from '../export/text-measure';
import type { TableContext } from '../table-keys';
import { tableLayout, withFilter, type TableNode } from '../table-layout';
import { TableBody } from './table-body';
import { TableFilter } from './table-filter';

const col = (id: string, name: string): DbColumn => ({ id, name, type: 'int' });
const node: TableNode = {
  id: 'orders',
  title: 'orders',
  columns: [
    col('c1', 'id'),
    col('c2', 'invoice_id'),
    ...Array.from({ length: 20 }, (_, i) => col(`f${String(i)}`, `field_${String(i)}`)),
    col('c3', 'Invoice_Total'),
  ],
};
const ctx: TableContext = {
  fk: new Map(),
  showSchema: false,
  enums: new Map(),
  display: {
    detail: 'auto',
    hideTypes: false,
    hideNullable: false,
    hideNotes: false,
    hideIndexes: false,
  },
};

/** The header filter and the body, drawn from the store's filter text like the canvas does. */
function Harness() {
  const filter = useUiStore((s) => s.tableFilter);
  const projected = filter === null ? { ...node } : withFilter({ ...node }, filter.text);
  const layout = tableLayout(projected, ctx, undefined, fixedWidthMeasurer(0.6));
  return (
    <>
      {filter?.tableId === 'orders' && (
        <TableFilter nodeId="orders" title="orders" layout={layout} />
      )}
      <TableBody nodeId="orders" layout={layout} focused={false} />
    </>
  );
}

function setup() {
  const { wrapper } = editorWrapper(
    deckOf({ nodes: [{ ...node, id: 'orders', type: 'db-table', title: 'orders' }] }),
  );
  act(() => {
    useUiStore.getState().select({ nodes: ['orders'] });
    useUiStore.getState().openTableFilter('orders');
  });
  return render(<Harness />, { wrapper });
}

describe('TableFilter (048 contracts/scale-ui.md)', () => {
  it('has a labelled input, focused, with nothing counted before typing', () => {
    setup();
    const input = screen.getByRole('textbox', { name: 'Find a column in orders' });
    expect(input).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('shows "1/2" for two matches, folds the rest and highlights the matches', () => {
    setup();
    fireEvent.change(screen.getByRole('textbox', { name: 'Find a column in orders' }), {
      target: { value: 'INVOICE' },
    });
    expect(screen.getByRole('status')).toHaveTextContent('1/2');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('listitem', { name: /^invoice_id/ })).toHaveAttribute(
      'data-match',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Show all 23 columns' })).toBeInTheDocument();
  });

  it('Enter and Shift+Enter step the current match and wrap', () => {
    setup();
    const input = screen.getByRole('textbox', { name: 'Find a column in orders' });
    fireEvent.change(input, { target: { value: 'invoice' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('status')).toHaveTextContent('2/2');
    expect(screen.getByRole('listitem', { name: /^Invoice_Total/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('status')).toHaveTextContent('1/2');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(screen.getByRole('status')).toHaveTextContent('2/2');
  });

  it('says 0 when nothing matches', () => {
    setup();
    fireEvent.change(screen.getByRole('textbox', { name: 'Find a column in orders' }), {
      target: { value: 'zzz' },
    });
    expect(screen.getByRole('status')).toHaveTextContent('0');
  });

  it('Escape closes it and restores the exact layout', () => {
    setup();
    const input = screen.getByRole('textbox', { name: 'Find a column in orders' });
    fireEvent.change(input, { target: { value: 'invoice' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(useUiStore.getState().tableFilter).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(12);
  });

  it('clearing the text closes it', () => {
    setup();
    const input = screen.getByRole('textbox', { name: 'Find a column in orders' });
    fireEvent.change(input, { target: { value: 'i' } });
    fireEvent.change(input, { target: { value: '' } });
    expect(useUiStore.getState().tableFilter).toBeNull();
  });
});
