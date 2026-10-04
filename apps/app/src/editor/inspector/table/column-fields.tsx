import { isLocked } from '@sododeck/model';
import type { DbColumn, Node, SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { SegmentedControl, SegmentedControlItem } from '@sododeck/ui/components/segmented-control';
import { Switch } from '@sododeck/ui/components/switch';
import { Trash2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { typeEntry } from '../../../db/dialect-types';
import { useEditor } from '../../../model/use-editor';
import { useUiStore } from '../../../state/ui-store';
import { deleteColumn } from '../../actions/table-actions';
import { FieldLabel } from '../../fields/field-label';
import { oneStep } from '../../fields/one-step';
import { useUndoToast } from '../../undo-toast';
import { LiveTextField } from './live-text-field';
import { TypePicker } from './type-picker';

type DefaultKind = 'value' | 'expression';

/** `10,2` → `['10', '2']`; `255` → `['255', '']`. */
const splitSize = (size: string | undefined): [string, string] => {
  const [precision = '', scale = ''] = (size ?? '').split(',');
  return [precision.trim(), scale.trim()];
};

/** A typed default keeps the column's own kind: a number for number types, else text. */
function defaultValue(
  deck: SododeckFile,
  column: DbColumn,
  text: string,
): string | number | boolean {
  const kind = typeEntry(deck.dialect ?? 'generic', column.type)?.kind;
  const numeric = /^-?\d+(\.\d+)?$/.test(text);
  if (numeric && (kind === 'number' || typeof column.default === 'number')) return Number(text);
  const bool = text === 'true' || text === 'false';
  if (bool && (kind === 'boolean' || typeof column.default === 'boolean')) return text === 'true';
  return text;
}

function SwitchField({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (on: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-body text-ink">
        {label}
      </label>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

/**
 * The expanded fields of one column (052 R11): name, type, size, the four flags, default, check
 * and note. Text fields save while typing (one undo step per focus); switches and pickers are one
 * step each. Names are unique in the table, ignoring case (FR-007).
 */
export function ColumnFields({
  deck,
  node,
  column,
}: {
  deck: SododeckFile;
  node: Node;
  column: DbColumn;
}) {
  const editor = useEditor();
  const undoToast = useUndoToast();
  const root = useRef<HTMLDivElement>(null);
  const disabled = isLocked(node);
  const tableId = node.id;
  const dialect = deck.dialect ?? 'generic';
  const entry = typeEntry(dialect, column.type);
  const size = column.enumRef === undefined ? (entry?.size ?? 'none') : 'none';
  const [precision, scale] = splitSize(column.size);
  const [kindDraft, setKindDraft] = useState<DefaultKind | null>(null);
  const kind: DefaultKind =
    kindDraft ?? (column.defaultExpr !== undefined ? 'expression' : 'value');
  const hasDefault = column.default !== undefined || column.defaultExpr !== undefined;
  const defaultText =
    column.defaultExpr ?? (column.default === undefined ? '' : String(column.default));

  // "Edit details" focuses the name once, then the request is spent.
  const focusRequested = useUiStore((s) => s.tableDrawer.focusColumnId === column.id);
  useEffect(() => {
    if (!focusRequested) return;
    const input = root.current?.querySelector<HTMLInputElement>('input[aria-label="Name"]');
    input?.focus();
    input?.select();
    useUiStore.getState().expandColumn(column.id);
  }, [focusRequested, column.id]);

  const write = (patch: Parameters<typeof editor.updateColumn>[2]) => {
    editor.updateColumn(tableId, column.id, patch);
  };
  const flag = (key: 'pk' | 'notNull' | 'unique' | 'increment') => ({
    checked: column[key] === true,
    disabled,
    onChange: (on: boolean) => {
      oneStep(editor, () => {
        write({ [key]: on ? true : null });
      });
    },
  });

  const writeSize = (p: string, s: string) => {
    write({ size: p === '' && s === '' ? null : s === '' ? p : `${p === '' ? '0' : p},${s}` });
  };

  const writeDefault = (text: string, as: DefaultKind) => {
    if (text === '') write({ default: null, defaultExpr: null });
    else if (as === 'expression') write({ defaultExpr: text, default: null });
    else write({ default: defaultValue(deck, column, text), defaultExpr: null });
  };

  const duplicate = (text: string) =>
    (node.columns ?? []).some(
      (other) => other.id !== column.id && other.name.toLowerCase() === text.toLowerCase(),
    )
      ? `${text} is already a column of ${node.title}`
      : undefined;

  const remove = () => {
    const columns = node.columns ?? [];
    const index = columns.findIndex((c) => c.id === column.id);
    const next = columns[index + 1] ?? columns[index - 1];
    deleteColumn(editor, deck, { tableId, columnId: column.id }, undoToast, { moveFocus: false });
    useUiStore.getState().expandColumn(null);
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(
          next === undefined
            ? '[data-add-column]'
            : `[data-column-row="${CSS.escape(next.id)}"] button`,
        )
        ?.focus();
    });
  };

  return (
    <div ref={root} className="flex flex-col gap-3 border-t border-border px-1 pt-3 pb-2">
      <LiveTextField
        label="Name"
        value={column.name}
        required
        validate={duplicate}
        disabled={disabled}
        mono
        onWrite={(text) => {
          write({ name: text });
        }}
      />
      <TypePicker deck={deck} tableId={tableId} column={column} disabled={disabled} />
      {size === 'length' && (
        <LiveTextField
          label="Length"
          value={column.size ?? ''}
          disabled={disabled}
          onWrite={(text) => {
            write({ size: text === '' ? null : text });
          }}
        />
      )}
      {size === 'precision' && (
        <div className="grid grid-cols-2 gap-2">
          <LiveTextField
            label="Precision"
            value={precision}
            disabled={disabled}
            onWrite={(text) => {
              writeSize(text, scale);
            }}
          />
          <LiveTextField
            label="Scale"
            value={scale}
            disabled={disabled}
            onWrite={(text) => {
              writeSize(precision, text);
            }}
          />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <SwitchField label="Primary key" {...flag('pk')} />
        <SwitchField label="Not null" {...flag('notNull')} />
        <SwitchField label="Unique" {...flag('unique')} />
        <SwitchField label="Auto-increment" {...flag('increment')} />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <FieldLabel>Default</FieldLabel>
          <SegmentedControl
            aria-label="Default kind"
            value={kind}
            disabled={disabled}
            className="h-7"
            onValueChange={(next) => {
              const as = next as DefaultKind;
              setKindDraft(as);
              // The text carries over to the other kind in the same step.
              if (hasDefault && as !== kind) {
                oneStep(editor, () => {
                  writeDefault(defaultText, as);
                });
              }
            }}
          >
            <SegmentedControlItem value="value" className="px-2 text-caption">
              Value
            </SegmentedControlItem>
            <SegmentedControlItem value="expression" className="px-2 text-caption">
              Expression
            </SegmentedControlItem>
          </SegmentedControl>
        </div>
        <LiveTextField
          label="Default"
          hideLabel
          value={defaultText}
          disabled={disabled}
          mono={kind === 'expression'}
          placeholder={kind === 'expression' ? 'now()' : 'No default'}
          onWrite={(text) => {
            writeDefault(text, kind);
          }}
        />
      </div>
      <LiveTextField
        label="Check"
        value={column.check ?? ''}
        disabled={disabled}
        mono
        onWrite={(text) => {
          write({ check: text === '' ? null : text });
        }}
      />
      <LiveTextField
        label="Note"
        value={column.note ?? ''}
        disabled={disabled}
        multiline
        onWrite={(text) => {
          write({ note: text === '' ? null : text });
        }}
      />
      <div>
        <Button variant="ghost" size="sm" disabled={disabled} onClick={remove}>
          <Trash2 aria-hidden />
          Delete column
        </Button>
      </div>
    </div>
  );
}
