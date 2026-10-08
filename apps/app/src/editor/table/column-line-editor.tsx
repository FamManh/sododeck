import { cn } from '@sododeck/ui/lib/utils';
import type { DbEnum } from '@sododeck/schema';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  columnLinePatch,
  formatColumnLine,
  lineError,
  lineErrorText,
  newColumnData,
  parseColumnLine,
  typeTokenStart,
  type ParsedColumnLine,
} from '../../db/column-line';
import { lineChips } from './line-chips';
import { readDeck } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { useUiStore, type ColumnEdit } from '../../state/ui-store';
import { oneStep } from '../fields/one-step';
import { rowKey } from '../relationships/row-key';
import { typeText } from '../table-layout';
import { focusRowSoon } from './row-focus';

const NO_ENUMS: readonly DbEnum[] = [];

/** The parsed parts said to screen readers (FR-011). */
function spoken(parsed: ParsedColumnLine): string {
  const type =
    parsed.type === undefined ? '' : ` ${typeText({ type: parsed.type, size: parsed.size })}`;
  return `${parsed.name}${type}`;
}

/**
 * The column line editor (043 R3, frame 160 A/B): one 24 px input in the row's place and font,
 * with the parsed parts as chips under it. A new row (`columnId: null`) adds a column at its
 * index and opens the next new row; an existing row is rewritten in one `updateColumn` and keeps
 * its id (FR-007). The text is this component's state only, never the store's or the document's.
 * ⏎ saves, Esc cancels, Tab puts the caret at the type; a click elsewhere saves a valid line.
 */
export function ColumnLineEditor({
  edit,
  keySlot,
  keyGap,
}: {
  edit: ColumnEdit;
  /** The row's key slot width, so the text starts where row names start. */
  keySlot: number;
  keyGap: number;
}) {
  const editor = useEditor();
  const deck = readDeck(editor.doc);
  const table = deck.nodes.find((node) => node.id === edit.tableId);
  const column =
    edit.columnId === null ? undefined : table?.columns?.find((c) => c.id === edit.columnId);
  const enums = deck.enums ?? NO_ENUMS;
  const [text, setText] = useState(() =>
    column === undefined ? '' : formatColumnLine(column, enums),
  );
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);
  // Set once saved or cancelled, so the blur that follows (focus going back to the row) does
  // nothing more.
  const done = useRef(false);
  const parsed = useMemo(() => parseColumnLine(text, { enums }), [text, enums]);
  const chips = lineChips(parsed, enums);

  useEffect(() => {
    const input = field.current;
    if (input === null) return;
    input.focus({ preventScroll: true });
    if (edit.select === 'all') {
      input.select();
      return;
    }
    const name = parseColumnLine(input.value, { enums }).tokens.find((t) => t.kind === 'name');
    input.setSelectionRange(name?.from ?? 0, name?.to ?? input.value.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per edit session: a new row reuses this component with a fresh key
  }, []);

  const close = (focusColumnId: string | null) => {
    done.current = true;
    const ui = useUiStore.getState();
    ui.endColumnEdit();
    if (focusColumnId !== null) focusRowSoon({ tableId: edit.tableId, columnId: focusColumnId });
  };

  /** Writes the line; false (and the message shown) when it cannot be saved. */
  const save = (): string | false => {
    const current = readDeck(editor.doc).nodes.find((node) => node.id === edit.tableId);
    if (current === undefined) return false;
    const problem = lineError(parsed, current, edit.columnId ?? undefined);
    if (problem !== null) {
      const message = lineErrorText(problem, parsed.name.trim());
      setError(message);
      useUiStore.getState().announce(message);
      return false;
    }
    const ui = useUiStore.getState();
    if (edit.columnId === null) {
      let id = '';
      oneStep(editor, () => {
        id = editor.addColumn(edit.tableId, newColumnData(parsed), edit.at);
      });
      ui.announce(`Added column ${spoken(parsed)}`);
      return id;
    }
    const previous = current.columns?.find((c) => c.id === edit.columnId);
    if (previous === undefined) return false;
    const patch = columnLinePatch(previous, parsed);
    oneStep(editor, () => {
      editor.updateColumn(edit.tableId, previous.id, patch);
    });
    ui.announce(`Saved column ${spoken(parsed)}`);
    return previous.id;
  };

  const submit = () => {
    // An empty line saves nothing (spec edge case "Empty name"); Esc closes the row.
    const id = save();
    if (id === false) return;
    if (edit.columnId !== null) {
      close(id);
      return;
    }
    // A new row opens the next one right below the column just added (FR-006).
    const columns = readDeck(editor.doc).nodes.find((n) => n.id === edit.tableId)?.columns ?? [];
    const index = columns.findIndex((c) => c.id === id);
    done.current = true;
    useUiStore.getState().startColumnEdit({
      tableId: edit.tableId,
      columnId: null,
      at: index + 1,
      select: 'name',
    });
  };

  const label = edit.columnId === null ? 'New column' : `Edit column ${column?.name ?? ''}`;
  return (
    <li
      data-line-editor={edit.columnId === null ? 'new' : rowKey(edit.tableId, edit.columnId)}
      className="relative -mx-[9px] flex h-6 shrink-0 items-center rounded-row bg-surface px-[9px] ring-2 ring-primary"
    >
      <span aria-hidden className="shrink-0" style={{ width: keySlot, marginRight: keyGap }} />
      <input
        ref={field}
        aria-label={label}
        aria-invalid={error !== null}
        aria-describedby={error === null ? undefined : `${edit.tableId}-line-error`}
        spellCheck={false}
        autoComplete="off"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setError(null);
        }}
        onKeyDown={(event) => {
          // The canvas never sees these keys: they belong to the line (FR-006).
          event.stopPropagation();
          if (event.key === 'Enter') {
            event.preventDefault();
            submit();
          } else if (event.key === 'Escape') {
            event.preventDefault();
            close(edit.columnId);
            useUiStore.getState().announce('Edit cancelled');
          } else if (event.key === 'Tab' && !event.shiftKey) {
            event.preventDefault();
            const input = event.currentTarget;
            const at = typeTokenStart(parsed);
            if (at !== undefined) {
              input.setSelectionRange(at, at);
              return;
            }
            // A name only: a space after it, so what is typed next is the type.
            const next = text.endsWith(' ') ? text : `${text} `;
            setText(next);
            requestAnimationFrame(() => {
              input.setSelectionRange(next.length, next.length);
            });
          }
        }}
        onBlur={() => {
          if (done.current) return;
          const unchanged =
            column !== undefined ? text === formatColumnLine(column, enums) : text.trim() === '';
          if (unchanged || lineError(parsed, table ?? {}, edit.columnId ?? undefined) !== null) {
            close(null);
            return;
          }
          if (save() !== false) close(null);
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        className="nodrag nopan min-w-0 flex-1 bg-transparent text-[12px] leading-6 font-medium text-ink outline-none"
      />
      {(chips.length > 0 || error !== null || parsed.hints.length > 0) && (
        <div
          aria-live="polite"
          className="pointer-events-none absolute top-full left-0 z-20 mt-1 flex w-max max-w-[320px] flex-col gap-1"
        >
          {chips.length > 0 && (
            <ul aria-label="Parsed parts" className="flex flex-wrap gap-1">
              {chips.map((chip, index) => (
                <li
                  key={`${String(index)}:${chip.label}`}
                  aria-label={chip.label}
                  className={cn(
                    'h-[18px] rounded-full px-1.5 font-mono text-[10.5px] leading-[18px] whitespace-nowrap shadow-sm',
                    chip.tone === 'part' && 'bg-surface-2 text-ink-secondary',
                    chip.tone === 'enum' && 'bg-deck-orange-soft text-deck-orange-ink',
                    chip.tone === 'ignored' && 'bg-surface text-ink-muted line-through',
                  )}
                >
                  {chip.label}
                </li>
              ))}
            </ul>
          )}
          {parsed.hints.map((hint) => (
            <span key={hint} className="text-[11px] text-ink-muted">
              {hint}
            </span>
          ))}
          {error !== null && (
            <span
              id={`${edit.tableId}-line-error`}
              role="alert"
              className="w-max rounded-row bg-clay-soft px-1.5 text-[11px] leading-[18px] font-medium text-clay-ink"
            >
              {error}
            </span>
          )}
        </div>
      )}
    </li>
  );
}
