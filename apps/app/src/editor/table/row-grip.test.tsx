import { createEditor, fromJSON, toJSON } from '@sododeck/model';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../../state/ui-store';
import { deckOf } from '../../test/render-canvas';
import { fixedWidthMeasurer } from '../export/text-measure';
import type { TableContext } from '../table-keys';
import { tableLayout, type TableNode } from '../table-layout';
import { finishRowDrag, reorderIndex } from './row-drag';
import { TableBody } from './table-body';

const table: TableNode = {
  id: 't',
  title: 't',
  columns: ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id, type: 'int' })),
};

const context: TableContext = {
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

const ui = () => useUiStore.getState();

beforeEach(() => {
  ui().resetForDeck();
});

describe('reorderIndex (043 R6)', () => {
  it('moves by whole rows of pointer travel, clamped to the list', () => {
    expect(reorderIndex(1, 0, 24, 4)).toBe(1);
    expect(reorderIndex(1, 30, 24, 4)).toBe(2);
    expect(reorderIndex(1, 50, 24, 4)).toBe(3);
    expect(reorderIndex(1, 500, 24, 4)).toBe(3);
    expect(reorderIndex(1, -40, 24, 4)).toBe(0);
    // Zoomed to 50 %: a row is 12 px on screen.
    expect(reorderIndex(0, 25, 12, 4)).toBe(2);
    // Nothing measured (jsdom): the layout's 24 px rows.
    expect(reorderIndex(0, 24, 0, 4)).toBe(1);
  });
});

describe('row drag (043 FR-009)', () => {
  it('draws the drop line at the target index', () => {
    const layout = tableLayout(table, context, undefined, fixedWidthMeasurer(0.6));
    render(<TableBody nodeId="t" layout={layout} focused={false} />);
    expect(screen.queryByTestId('row-drop-line')).toBeNull();
    act(() => {
      ui().setRowDrag({ tableId: 't', columnId: 'a', overIndex: 2 });
    });
    // Moving down: the line sits under the target row.
    expect(screen.getByTestId('row-drop-line')).toHaveStyle({ top: '71px' });
    act(() => {
      ui().setRowDrag({ tableId: 't', columnId: 'c', overIndex: 0 });
    });
    expect(screen.getByTestId('row-drop-line')).toHaveStyle({ top: '-1px' });
  });

  it('moves the column once on release, in one undo step, and clears the session', () => {
    const doc = fromJSON(deckOf({ nodes: [{ ...table, type: 'db-table', id: 't' }] }));
    const editor = createEditor(doc);
    ui().setRowDrag({ tableId: 't', columnId: 'a', overIndex: 2 });
    finishRowDrag(editor, 'a');
    expect(toJSON(doc).nodes[0]?.columns?.map((c) => c.name)).toEqual(['b', 'c', 'a', 'd']);
    expect(ui().rowDrag).toBeNull();
    editor.undo();
    expect(toJSON(doc).nodes[0]?.columns?.map((c) => c.name)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('writes nothing when the row lands where it was', () => {
    const doc = fromJSON(deckOf({ nodes: [{ ...table, type: 'db-table', id: 't' }] }));
    const editor = createEditor(doc);
    ui().setRowDrag({ tableId: 't', columnId: 'b', overIndex: 1 });
    finishRowDrag(editor, 'b');
    expect(editor.canUndo()).toBe(false);
  });

  it('starts nothing from a grip outside an editor', () => {
    const layout = tableLayout(table, context, undefined, fixedWidthMeasurer(0.6));
    render(<TableBody nodeId="t" layout={layout} focused={false} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Reorder b' }), { button: 0 });
    expect(ui().rowDrag).toBeNull();
  });
});
