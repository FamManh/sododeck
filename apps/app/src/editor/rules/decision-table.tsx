import { ruleChecks } from '@sododeck/model';
import type { Id, Rule, RuleColumn } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { Check, CircleAlert, GripVertical, Plus, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import { isApplePlatform } from '../../lib/features';
import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { useSortableList } from '../flows/use-sortable-list';
import { useUndoToast } from '../undo-toast';
import { CellEditor } from './cell-editor';
import { ColumnMenu } from './column-menu';
import { conditionText } from './rule-text';
import { gridKey, type GridPos } from './use-grid-keys';

const undoHint = () => (isApplePlatform() ? '⌘Z' : 'Ctrl+Z');

/**
 * The decision table (FR-021–FR-023, design 04): WHEN / THEN column groups, numbered rows with a
 * grip and a delete button, cells edited in place. An ARIA grid: arrows move, Enter / F2 or a
 * typed character edits, ⌥↑ / ⌥↓ moves a row, ⌫ on a row header deletes it. Removing a row or
 * a column asks nothing and shows an Undo toast. `matched` rows (from TEST INPUT) are marked with
 * a check icon, a bold number and `aria-selected`.
 */
export function DecisionTable({
  ruleId,
  rule,
  matched,
  renameColumnId,
  onRenameDone,
}: {
  ruleId: Id;
  rule: Rule;
  matched: ReadonlySet<Id>;
  /** A column just added: its header opens in rename mode. */
  renameColumnId: Id | null;
  onRenameDone: () => void;
}) {
  const editor = useEditor();
  const showUndoToast = useUndoToast();
  const hintId = useId();
  const invalidId = useId();
  const columns = useMemo(
    () => [
      ...rule.inputs.map((c) => ({ column: c, side: 'inputs' as const })),
      ...rule.outputs.map((c) => ({ column: c, side: 'outputs' as const })),
    ],
    [rule.inputs, rule.outputs],
  );
  const invalid = useMemo(() => {
    const set = new Set<string>();
    for (const { rowId, columnId } of ruleChecks(rule).invalidCells)
      set.add(`${rowId}:${columnId}`);
    return set;
  }, [rule]);

  const [active, setActive] = useState<GridPos>({ row: 0, col: 0 });
  const [editing, setEditing] = useState<{ pos: GridPos; text?: string } | null>(null);
  const [renaming, setRenaming] = useState<Id | null>(null);
  const table = useRef<HTMLTableElement>(null);
  const focusWanted = useRef(false);

  const rows = rule.rows.length;
  const cols = columns.length;
  const pos = {
    row: Math.min(active.row, Math.max(0, rows - 1)),
    col: Math.min(active.col, cols - 1),
  };

  // A column just added opens in rename mode until named.
  const renamingId = renaming ?? renameColumnId;

  // Keep keyboard focus on the active position after moves, edits and row changes.
  useEffect(() => {
    if (!focusWanted.current || editing !== null) return;
    focusWanted.current = false;
    table.current
      ?.querySelector<HTMLElement>(`[data-pos="${String(pos.row)}:${String(pos.col)}"]`)
      ?.focus();
  });

  const goTo = (to: GridPos) => {
    focusWanted.current = true;
    setActive(to);
  };

  const sortable = useSortableList({
    ids: rule.rows.map((r) => r.id),
    group: `rule:${ruleId}`,
    onMove: (id, position) => {
      editor.moveRuleRow(ruleId, id, position);
      goTo({ row: position, col: pos.col });
    },
  });

  const deleteRow = (index: number) => {
    const row = rule.rows[index];
    if (row === undefined) return;
    editor.removeRuleRow(ruleId, row.id);
    const text = `Row ${String(index + 1)} deleted`;
    useUiStore.getState().announce(text);
    showUndoToast(`${text} · ${undoHint()} to undo`);
    goTo({ row: Math.max(0, index - 1), col: -1 });
  };

  const removeColumn = (column: RuleColumn) => {
    editor.removeRuleColumn(ruleId, column.id);
    useUiStore.getState().announce(`Column ${column.label} removed`);
    showUndoToast(`Column “${column.label}” deleted · ${undoHint()} to undo`);
  };

  const onGridKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    if (editing !== null || rows === 0) return;
    const target = event.target as HTMLElement;
    if (target.dataset.pos === undefined) return;
    const action = gridKey(event, pos, rows, cols);
    if (action === null) return;
    event.preventDefault();
    if (action.kind === 'move') goTo(action.to);
    else if (action.kind === 'edit') setEditing({ pos, text: action.text });
    else deleteRow(pos.row);
  };

  const commitCell = (value: string | null, move: 'down' | 'stay') => {
    const at = editing?.pos;
    setEditing(null);
    focusWanted.current = true;
    if (at === undefined) return;
    const row = rule.rows[at.row];
    const column = columns[at.col]?.column;
    if (value !== null && row !== undefined && column !== undefined) {
      editor.setRuleCell(ruleId, row.id, column.id, value.trim());
    }
    if (move === 'down') setActive({ row: Math.min(rows - 1, at.row + 1), col: at.col });
  };

  const inputCount = rule.inputs.length;

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table
          ref={table}
          role="grid"
          aria-label={`Decision table ${rule.title}`}
          aria-describedby={hintId}
          onKeyDown={onGridKeyDown}
          className="w-full border-collapse text-body"
        >
          <thead>
            <tr>
              <th aria-hidden className="w-24 bg-surface-2" />
              {rule.inputs.length > 0 && (
                <th
                  colSpan={rule.inputs.length}
                  scope="colgroup"
                  className="bg-amber-soft px-3 py-2 text-left text-micro text-amber-ink uppercase"
                >
                  When
                </th>
              )}
              {rule.outputs.length > 0 && (
                <th
                  colSpan={rule.outputs.length}
                  scope="colgroup"
                  className="border-l-2 border-surface bg-primary-soft px-3 py-2 text-left text-micro text-primary-ink uppercase"
                >
                  Then
                </th>
              )}
            </tr>
            <tr className="border-b border-hairline">
              <th scope="col" className="px-3 py-2 text-left text-caption text-ink-muted">
                #
              </th>
              {columns.map(({ column, side }) => (
                <ColumnHeader
                  key={column.id}
                  column={column}
                  side={side}
                  renaming={renamingId === column.id}
                  onStartRename={() => {
                    setRenaming(column.id);
                  }}
                  onRenamed={(label) => {
                    setRenaming(null);
                    onRenameDone();
                    if (label !== null) editor.renameRuleColumn(ruleId, column.id, label);
                  }}
                  onRemove={() => {
                    removeColumn(column);
                  }}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {rule.rows.map((row, r) => {
              const isMatched = matched.has(row.id);
              const dragging = sortable.drag?.id === row.id;
              return (
                <tr
                  key={row.id}
                  aria-selected={isMatched}
                  {...sortable.rowProps(row.id)}
                  className={cn(
                    'border-b border-hairline last:border-b-0',
                    isMatched && 'bg-primary-soft',
                    dragging && 'opacity-60',
                    sortable.drag !== null &&
                      sortable.drag.over === r &&
                      !dragging &&
                      'outline-2 outline-primary outline-dashed',
                  )}
                >
                  <th
                    scope="row"
                    data-pos={`${String(r)}:-1`}
                    tabIndex={pos.row === r && pos.col === -1 ? 0 : -1}
                    aria-label={`Row ${String(r + 1)}${isMatched ? ', matched' : ''}`}
                    onFocus={() => {
                      setActive({ row: r, col: -1 });
                    }}
                    className="px-2 py-1.5 text-left font-normal outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                  >
                    <span className="flex items-center gap-1">
                      <span
                        {...sortable.gripProps(row.id)}
                        className="cursor-grab text-ink-muted touch-none"
                      >
                        <GripVertical strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
                      </span>
                      <span
                        className={cn(
                          'flex w-7 items-center gap-0.5 text-body-sm text-ink-secondary',
                          isMatched && 'font-semibold text-primary-ink',
                        )}
                      >
                        {isMatched && (
                          <Check aria-hidden strokeWidth={2} className="size-3.5 shrink-0" />
                        )}
                        {r + 1}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        tabIndex={-1}
                        aria-label={`Delete row ${String(r + 1)}`}
                        onClick={() => {
                          deleteRow(r);
                        }}
                      >
                        <X />
                      </Button>
                    </span>
                  </th>
                  {columns.map(({ column, side }, c) => {
                    const value =
                      side === 'inputs' ? (row.when[c] ?? '') : (row.then[c - inputCount] ?? '');
                    const bad = side === 'inputs' && invalid.has(`${row.id}:${column.id}`);
                    const isActive = pos.row === r && pos.col === c;
                    const isEditing =
                      editing !== null && editing.pos.row === r && editing.pos.col === c;
                    return (
                      <td
                        key={column.id}
                        role="gridcell"
                        data-pos={`${String(r)}:${String(c)}`}
                        tabIndex={isActive && !isEditing ? 0 : -1}
                        aria-invalid={bad || undefined}
                        aria-describedby={bad ? invalidId : undefined}
                        aria-label={`${column.label}, row ${String(r + 1)}: ${
                          side === 'inputs' ? conditionText(value) : value === '' ? 'empty' : value
                        }`}
                        onFocus={() => {
                          setActive({ row: r, col: c });
                        }}
                        onDoubleClick={() => {
                          setEditing({ pos: { row: r, col: c } });
                        }}
                        className={cn(
                          'px-3 py-1.5 align-middle outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
                          side === 'inputs' && 'font-mono text-body-sm',
                          side === 'outputs' && c === inputCount && 'border-l-2 border-surface-2',
                          isMatched && 'text-primary-ink',
                        )}
                      >
                        {isEditing ? (
                          <CellEditor
                            label={`Edit ${column.label}, row ${String(r + 1)}`}
                            initial={editing.text ?? value}
                            onDone={commitCell}
                          />
                        ) : bad ? (
                          <span className="flex items-center gap-1 text-clay-ink">
                            <CircleAlert
                              aria-hidden
                              strokeWidth={ICON_STROKE_WIDTH}
                              className="size-3.5 shrink-0"
                            />
                            {value}
                          </span>
                        ) : side === 'inputs' && value.trim() === '' ? (
                          <span className="text-ink-muted">Any</span>
                        ) : (
                          <span className="break-words">{value}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {cols === 0 && (
          <p className="px-4 py-3 text-body-sm text-ink-secondary">
            No columns yet. Add a condition and an action, then rows.
          </p>
        )}
        <div className="border-t border-hairline px-2 py-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              editor.addRuleRow(ruleId);
              goTo({ row: rows, col: Math.min(0, cols - 1) });
            }}
          >
            <Plus />
            Add row
          </Button>
        </div>
      </div>
      <p id={hintId} className="text-caption text-ink-secondary">
        Cells accept ≤ 5, &gt; 20, exact values, comma-separated lists, or Any.
      </p>
      <span id={invalidId} className="sr-only">
        Not a valid condition
      </span>
    </div>
  );
}

function ColumnHeader({
  column,
  side,
  renaming,
  onStartRename,
  onRenamed,
  onRemove,
}: {
  column: RuleColumn;
  side: 'inputs' | 'outputs';
  renaming: boolean;
  onStartRename: () => void;
  /** `null`: cancelled. */
  onRenamed: (label: string | null) => void;
  onRemove: () => void;
}) {
  const kind = side === 'inputs' ? 'Condition' : 'Action';
  return (
    <th
      scope="col"
      aria-label={`${kind} ${column.label}`}
      className={cn(
        'px-3 py-1.5 text-left font-medium',
        side === 'outputs' && 'first-of-type:border-l-2',
      )}
    >
      {renaming ? (
        <ColumnRename initial={column.label} onDone={onRenamed} />
      ) : (
        <span className="flex items-center gap-1">
          <button
            type="button"
            tabIndex={-1}
            title={column.label}
            onDoubleClick={onStartRename}
            className="min-w-0 flex-1 cursor-text truncate text-left"
          >
            {column.label}
          </button>
          <ColumnMenu label={column.label} onRename={onStartRename} onRemove={onRemove} />
        </span>
      )}
    </th>
  );
}

function ColumnRename({
  initial,
  onDone,
}: {
  initial: string;
  onDone: (label: string | null) => void;
}) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState(false);
  const errorId = useId();
  const done = useRef(false);
  const finish = (label: string | null) => {
    if (done.current) return;
    if (label !== null && label.trim() === '') {
      setError(true);
      return;
    }
    done.current = true;
    onDone(label === null ? null : label.trim());
  };
  return (
    <span className="flex flex-col gap-1">
      <input
        aria-label="Column name"
        autoFocus
        value={text}
        aria-invalid={error || undefined}
        aria-describedby={error ? errorId : undefined}
        onFocus={(event) => {
          event.currentTarget.select();
        }}
        onChange={(event) => {
          setText(event.target.value);
          setError(false);
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter') {
            event.preventDefault();
            finish(text);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            finish(null);
          }
        }}
        onBlur={() => {
          // An empty name on blur keeps the old one.
          finish(text.trim() === '' ? null : text);
        }}
        className={cn(
          'h-8 w-full min-w-24 rounded-row border border-primary bg-surface px-2 text-body font-normal text-ink outline-none',
          error && 'border-clay-ink',
        )}
      />
      {error && (
        <span
          id={errorId}
          className="flex items-center gap-1 text-caption font-normal text-clay-ink"
        >
          <CircleAlert aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5 shrink-0" />
          Column name can’t be empty.
        </span>
      )}
    </span>
  );
}
