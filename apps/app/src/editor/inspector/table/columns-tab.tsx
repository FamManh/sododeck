import { isLocked } from '@sododeck/model';
import type { Node, SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { SearchField } from '@sododeck/ui/components/search-field';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { newColumnData, parseColumnLine } from '../../../db/column-line';
import { useEditor } from '../../../model/use-editor';
import { useUiStore } from '../../../state/ui-store';
import { deleteColumn } from '../../actions/table-actions';
import { oneStep } from '../../fields/one-step';
import { useSortableList } from '../../flows/use-sortable-list';
import { fkColumnsOf } from '../../table-keys';
import { typeText } from '../../table-layout';
import { useUndoToast } from '../../undo-toast';
import { ColumnRow } from './column-row';

/** `column_1`, or the first `column_n` the table does not have (any case). */
function nextColumnName(node: Node): string {
  const taken = new Set((node.columns ?? []).map((c) => c.name.toLowerCase()));
  let n = 1;
  while (taken.has(`column_${String(n)}`)) n += 1;
  return `column_${String(n)}`;
}

/**
 * The Columns tab (052 US1, frame 164): a filter, "+ Column" and one row per column. A row
 * expands to every column setting; rows reorder by drag and ⌥↑ / ⌥↓. Every write goes through
 * `DeckEditor`; only the expanded row and the filter are UI state.
 */
export function ColumnsTab({ deck, node }: { deck: SododeckFile; node: Node }) {
  const editor = useEditor();
  const undoToast = useUndoToast();
  const expandedId = useUiStore((s) => s.tableDrawer.expandedColumnId);
  const [filter, setFilter] = useState('');
  const columns = node.columns ?? [];
  const disabled = isLocked(node);
  const foreignKeys = fkColumnsOf(deck, node.id);
  const query = filter.trim().toLowerCase();
  const shown = columns.filter(
    (c) =>
      query === '' ||
      c.name.toLowerCase().includes(query) ||
      typeText(c).toLowerCase().includes(query),
  );

  const sort = useSortableList({
    ids: columns.map((c) => c.id),
    group: `columns:${node.id}`,
    // Positions are in the whole list: moving inside a filtered view would be a guess.
    locked: () => query !== '' || disabled,
    onMove: (id, position) => {
      oneStep(editor, () => {
        editor.moveColumn(node.id, id, position);
      });
    },
  });

  const add = () => {
    let id = '';
    oneStep(editor, () => {
      id = editor.addColumn(
        node.id,
        newColumnData(parseColumnLine(nextColumnName(node), { enums: [] })),
      );
    });
    setFilter('');
    useUiStore.getState().openTableDrawer(node.id, { tab: 'columns', columnId: id });
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <SearchField
          label="Filter columns"
          placeholder="Filter columns"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
          }}
          onClear={() => {
            setFilter('');
          }}
        />
        <Button size="sm" disabled={disabled} data-add-column onClick={add}>
          <Plus aria-hidden />
          Column
        </Button>
      </div>
      <ul aria-label="Columns" className="flex flex-col gap-0.5">
        {shown.map((column) => (
          <ColumnRow
            key={column.id}
            deck={deck}
            node={node}
            column={column}
            foreignKey={foreignKeys.has(column.id)}
            expanded={expandedId === column.id}
            dragging={sort.drag?.id === column.id}
            dropTarget={sort.drag !== null && sort.drag.over === columns.indexOf(column)}
            rowProps={sort.rowProps(column.id)}
            gripProps={sort.gripProps(column.id)}
            onDelete={() => {
              deleteColumn(editor, deck, { tableId: node.id, columnId: column.id }, undoToast, {
                moveFocus: false,
              });
            }}
          />
        ))}
      </ul>
    </div>
  );
}
