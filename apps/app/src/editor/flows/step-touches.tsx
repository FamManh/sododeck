import { isDbTable, isTouch, type TouchAccess, type TouchKey } from '@sododeck/model';
import type { Id, SododeckFile, Step, Touch } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { PanelSection } from '@sododeck/ui/components/panel';
import { Popover, PopoverContent, PopoverTrigger } from '@sododeck/ui/components/popover';
import { SearchField } from '@sododeck/ui/components/search-field';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { Columns3, Plus, Table, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { AccessMarker } from '../table/access-marker';
import { contextOf, keyId, touchOptions, type TouchOption } from './touch-options';

const ACCESS_NAME: Record<TouchAccess, string> = { read: 'read', write: 'write' };

type Node = SododeckFile['nodes'][number];

/** "orders" or "orders · email" for a stored touch (its ids when the table is gone). */
function touchLabel(byId: ReadonlyMap<Id, Node>, touch: Touch): string {
  const table = byId.get(touch.table);
  const tableName = table?.title ?? touch.table;
  if (touch.column === undefined) return tableName;
  const column = table?.columns?.find((c) => c.id === touch.column);
  return `${tableName} · ${column?.name ?? touch.column}`;
}

/**
 * The step inspector's "Touches" section (049 US3, contracts/ui.md §3): the tables and columns
 * this step reads or writes. Each row has a Read / Write toggle and a remove button; "Add table
 * or column…" searches tables by name and columns by "table.column". Every change is one undo
 * step through the model's touch ops. Delete or Backspace on a row's controls removes it.
 */
export function StepTouches({
  deck,
  flowId,
  step,
}: {
  deck: SododeckFile;
  flowId: Id;
  step: Step;
}) {
  const editor = useEditor();
  const listRef = useRef<HTMLUListElement>(null);
  const touches = step.touches ?? [];
  const byId = new Map(deck.nodes.map((node) => [node.id, node]));
  const hasTables = deck.nodes.some(isDbTable);

  // The row to focus once React has drawn it: a new row, or the next one after a removal.
  const pendingFocus = useRef<string | null>(null);
  const focusToggle = (id: string) => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-touch="${id}"] [data-access-toggle]`)
      ?.focus();
  };
  useEffect(() => {
    const id = pendingFocus.current;
    if (id === null) return;
    pendingFocus.current = null;
    focusToggle(id);
  });
  const focusRow = (key: TouchKey, now = false) => {
    if (now) focusToggle(keyId(key));
    else pendingFocus.current = keyId(key);
  };

  const add = (key: TouchKey) => {
    if (touches.some((touch) => isTouch(touch, key))) {
      // Nothing changes, so nothing re-renders: the row is already there.
      focusRow(key, true);
      return;
    }
    editor.addTouch(flowId, step.id, { ...key, access: 'read' });
    useUiStore.getState().announce(`Touches ${touchLabel(byId, { ...key, access: 'read' })}`);
    focusRow(key);
  };

  const remove = (touch: Touch, index: number) => {
    editor.removeTouch(flowId, step.id, touch);
    useUiStore.getState().announce(`Removed ${touchLabel(byId, touch)}`);
    // Keep the keyboard in the list: the next row, else the previous, else the add button.
    const next = touches[index + 1] ?? touches[index - 1];
    if (next !== undefined) focusRow(next);
  };

  return (
    <PanelSection label="Touches" aria-label="Touches">
      {touches.length === 0 ? (
        <p className="text-body-sm text-ink-secondary">This step touches no tables.</p>
      ) : (
        <ul
          ref={listRef}
          role="list"
          aria-label="Tables this step touches"
          className="flex flex-col gap-1"
        >
          {touches.map((touch, index) => {
            const label = touchLabel(byId, touch);
            const table = byId.get(touch.table);
            const context = table === undefined ? 'Missing table' : contextOf(byId, table);
            const RowIcon = touch.column === undefined ? Table : Columns3;
            return (
              <li
                key={keyId(touch)}
                data-touch={keyId(touch)}
                className="flex h-9 items-center gap-2 rounded-row bg-surface-2 pr-1 pl-1.5"
                onKeyDown={(event) => {
                  if (event.key === 'Delete' || event.key === 'Backspace') {
                    event.preventDefault();
                    remove(touch, index);
                  }
                }}
              >
                <button
                  type="button"
                  data-access-toggle
                  aria-label={`Access for ${label}: ${ACCESS_NAME[touch.access]}`}
                  title="Switch read / write"
                  className={cn(
                    'flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-row px-1.5 text-caption font-medium text-ink hover:bg-surface-3',
                    focusRing,
                  )}
                  onClick={() => {
                    const access = touch.access === 'read' ? 'write' : 'read';
                    editor.setTouchAccess(flowId, step.id, touch, access);
                    useUiStore.getState().announce(`${label}: ${access}`);
                  }}
                >
                  <AccessMarker access={touch.access} />
                  {touch.access === 'read' ? 'Read' : 'Write'}
                </button>
                <RowIcon
                  aria-hidden
                  strokeWidth={ICON_STROKE_WIDTH}
                  className="size-3.5 shrink-0 text-ink-secondary"
                />
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-body-sm">{label}</span>
                  <span className="truncate text-caption text-ink-secondary">{context}</span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${label}`}
                  onClick={() => {
                    remove(touch, index);
                  }}
                >
                  <X />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <AddTouchPopover deck={deck} disabled={!hasTables} onPick={add} />
    </PanelSection>
  );
}

/** "Add table or column…": a filter field over a listbox, ↑ / ↓ to move, Enter to add, Esc to close. */
function AddTouchPopover({
  deck,
  disabled,
  onPick,
}: {
  deck: SododeckFile;
  disabled: boolean;
  onPick: (key: TouchKey) => void;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState(0);
  // A pick moves focus to its row, so the popover does not hand focus back to its button.
  const picked = useRef(false);
  const options = open ? touchOptions(deck, filter) : [];
  const current = Math.min(active, Math.max(0, options.length - 1));

  const choose = (option: TouchOption | undefined) => {
    if (option === undefined) return;
    picked.current = true;
    setOpen(false);
    onPick(option.key);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setFilter('');
        setActive(0);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled} className="self-start">
          <Plus />
          Add table or column…
        </Button>
      </PopoverTrigger>
      <PopoverContent
        aria-label="Add table or column"
        align="start"
        className="w-72 gap-2 p-2"
        onCloseAutoFocus={(event) => {
          if (picked.current) event.preventDefault();
          picked.current = false;
        }}
      >
        <SearchField
          label="Find a table or table.column"
          placeholder="orders or orders.email"
          value={filter}
          aria-controls={listId}
          aria-activedescendant={options.length === 0 ? undefined : `${listId}-${String(current)}`}
          onChange={(event) => {
            setFilter(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              const step = event.key === 'ArrowDown' ? 1 : -1;
              setActive((current + step + options.length) % Math.max(1, options.length));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              choose(options[current]);
            }
          }}
        />
        {options.length === 0 ? (
          <p className="px-2 py-1 text-body-sm text-ink-secondary">No matching table or column.</p>
        ) : (
          <ul
            id={listId}
            role="listbox"
            aria-label="Tables and columns"
            className="flex max-h-64 flex-col overflow-y-auto"
          >
            {options.map((option, i) => {
              const OptionIcon = option.key.column === undefined ? Table : Columns3;
              return (
                <li
                  key={keyId(option.key)}
                  id={`${listId}-${String(i)}`}
                  role="option"
                  aria-selected={i === current}
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onClick={() => {
                    choose(option);
                  }}
                  className={cn(
                    'flex h-8 cursor-pointer items-center gap-2 rounded-row px-2 text-body-sm',
                    i === current && 'bg-surface-2',
                  )}
                >
                  <OptionIcon
                    aria-hidden
                    strokeWidth={ICON_STROKE_WIDTH}
                    className="size-4 shrink-0 text-ink-secondary"
                  />
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  <span className="shrink-0 truncate text-caption text-ink-secondary">
                    {option.context}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
