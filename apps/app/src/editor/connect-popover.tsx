import { endpointOf } from '@sododeck/model';
import type { SododeckFile } from '@sododeck/schema';
import { Popover, PopoverAnchor, PopoverContent } from '@sododeck/ui/components/popover';
import { SearchField } from '@sododeck/ui/components/search-field';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { Image as ImageIcon, SquareDashed, StickyNote } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

import { iconProp } from './card-icon';
import { NodeTypeTile } from './shapes/shape-tile';
import { useEditor } from '../model/use-editor';
import { useUiStore } from '../state/ui-store';
import {
  canvasElement,
  connectColumns,
  connectComponents,
  focusCanvas,
  nodeElement,
} from './canvas-actions';
import { columnConnectTargets, connectTargets, type ConnectTarget } from './connection-rules';
import { rowKey } from './relationships/row-key';
import { GROUP_NODE_PREFIX, IMAGE_NODE_PREFIX, STICKY_NODE_PREFIX } from './deck-to-flow';

function anchorRect(nodeId: string): DOMRect {
  // A group is drawn as its `group:` frame (050 R6), a note as its `sticky:` node (053).
  const rect = (
    nodeElement(nodeId) ??
    nodeElement(`${GROUP_NODE_PREFIX}${nodeId}`) ??
    nodeElement(`${STICKY_NODE_PREFIX}${nodeId}`) ??
    nodeElement(`${IMAGE_NODE_PREFIX}${nodeId}`) ??
    canvasElement()
  )?.getBoundingClientRect();
  return rect ?? new DOMRect(0, 0, 0, 0);
}

function rowRect(tableId: string, columnId: string): DOMRect {
  const row = canvasElement()?.querySelector(
    `[data-row="${CSS.escape(rowKey(tableId, columnId))}"]`,
  );
  return row?.getBoundingClientRect() ?? anchorRect(tableId);
}

/** Next enabled option from `index` in `step` direction, or `index` when there is none. */
function nextEnabled(
  options: readonly { disabled: boolean }[],
  index: number,
  step: 1 | -1,
): number {
  for (let i = index + step; i >= 0 && i < options.length; i += step) {
    if (!options[i]?.disabled) return i;
  }
  return index;
}

/** Home / End target for the listbox: the first or last enabled option, else the current one. */
function edgeEnabled(options: readonly { disabled: boolean }[], key: 'Home' | 'End'): number {
  const order = options.map((_, index) => index);
  const found = (key === 'Home' ? order : order.reverse()).find((i) => !options[i]?.disabled);
  return found ?? -1;
}

/** Keeps the keyboard's option on screen: arrows move it past the end of a scrolling list. */
function useScrollActiveIntoView(listId: string, activeIndex: number) {
  useEffect(() => {
    const option: Element | null = document.getElementById(`${listId}-${String(activeIndex)}`);
    // Test DOMs have no scrollIntoView.
    if (option !== null && 'scrollIntoView' in option) option.scrollIntoView({ block: 'nearest' });
  }, [listId, activeIndex]);
}

/** "Connect <title> to…": type-ahead keyboard connect (FR-012, design 56). */
export function ConnectPopover({ deck }: { deck: SododeckFile }) {
  const popover = useUiStore((s) => s.popover);
  if (popover?.kind === 'connect-column') {
    const column = deck.nodes
      .find((n) => n.id === popover.tableId)
      ?.columns?.find((c) => c.id === popover.columnId);
    if (column === undefined) return null;
    return (
      <ColumnConnectContent
        key={`${popover.tableId}:${popover.columnId}`}
        deck={deck}
        tableId={popover.tableId}
        columnId={popover.columnId}
        name={column.name}
      />
    );
  }
  const fromId = popover?.kind === 'connect' ? popover.fromId : null;
  // From a card or a group (050 R6).
  const from = fromId === null ? null : endpointOf(deck, fromId);
  if (fromId === null || from === null) return null;
  return <ConnectPopoverContent key={fromId} deck={deck} fromId={fromId} title={from.title} />;
}

function ConnectPopoverContent({
  deck,
  fromId,
  title,
}: {
  deck: SododeckFile;
  fromId: string;
  title: string;
}) {
  const editor = useEditor();
  const closePopover = useUiStore((s) => s.closePopover);
  const [query, setQuery] = useState('');
  const options = connectTargets(deck, fromId, query);
  const [active, setActive] = useState(() => nextEnabled(options, -1, 1));
  const activeIndex = options[active]?.disabled === false ? active : nextEnabled(options, -1, 1);
  const listId = useId();
  const virtualRef = useRef({ getBoundingClientRect: () => anchorRect(fromId) });
  // Choosing opens the edge popover next; focus must not jump back to the canvas in between.
  const chose = useRef(false);

  const choose = (option: ConnectTarget | undefined) => {
    if (!option || option.disabled) return;
    chose.current = true;
    connectComponents(editor, fromId, option.id);
  };

  const optionId = (index: number) => `${listId}-${String(index)}`;
  useScrollActiveIntoView(listId, activeIndex);

  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) closePopover();
      }}
    >
      <PopoverAnchor virtualRef={virtualRef} />
      <PopoverContent
        aria-label={`Connect ${title} to…`}
        side="bottom"
        align="start"
        className="w-80 gap-2 p-2"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          if (!chose.current) focusCanvas();
        }}
      >
        <span className="px-1 pt-1 text-micro text-ink-muted uppercase">Connect {title} to…</span>
        <SearchField
          label="Find component"
          placeholder="Find component"
          value={query}
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={options.length > 0 ? optionId(activeIndex) : undefined}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setActive(nextEnabled(options, activeIndex, event.key === 'ArrowDown' ? 1 : -1));
            } else if (event.key === 'Home' || event.key === 'End') {
              // The field has no use for them while a list is on offer; the list does.
              if (options.length === 0) return;
              event.preventDefault();
              setActive(edgeEnabled(options, event.key));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              choose(options[activeIndex]);
            }
          }}
        />
        <ul
          id={listId}
          role="listbox"
          aria-label="Components"
          className="flex max-h-64 flex-col overflow-y-auto"
        >
          {options.length === 0 && (
            <li className="px-2 py-3 text-body-sm text-ink-secondary">No matching components</li>
          )}
          {options.map((option, index) => (
            <li
              key={option.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              aria-disabled={option.disabled || undefined}
              onPointerDown={(event) => {
                // Keep focus in the search field; the click chooses.
                event.preventDefault();
              }}
              onClick={() => {
                choose(option);
              }}
              className={cn(
                'flex h-9 items-center gap-2 rounded-row px-2 text-body-sm',
                option.disabled
                  ? 'cursor-not-allowed text-ink-muted'
                  : 'cursor-pointer text-ink hover:bg-surface-2',
                index === activeIndex && 'bg-primary-soft font-medium text-primary-ink',
              )}
            >
              {option.kind === 'note' ? (
                <span
                  data-note-icon
                  className="flex size-[22px] shrink-0 items-center justify-center rounded-[7px] bg-surface-2 text-ink-secondary"
                >
                  <StickyNote aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
                </span>
              ) : option.kind === 'image' ? (
                <span
                  data-image-icon
                  className="flex size-[22px] shrink-0 items-center justify-center rounded-[7px] bg-surface-2 text-ink-secondary"
                >
                  <ImageIcon aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
                </span>
              ) : option.kind === 'group' ? (
                <span
                  data-group-icon
                  className="flex size-[22px] shrink-0 items-center justify-center rounded-[7px] bg-surface-2 text-ink-secondary"
                >
                  <SquareDashed aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
                </span>
              ) : (
                <NodeTypeTile type={option.kind} size={22} decorative {...iconProp(option.icon)} />
              )}
              <span className="min-w-0 flex-1 truncate">
                {option.title}
                {option.kind === 'group' && (
                  <span className="ml-1 text-caption text-ink-muted">(group)</span>
                )}
                {option.kind === 'note' && (
                  <span className="ml-1 text-caption text-ink-muted">(note)</span>
                )}
                {option.kind === 'image' && (
                  <span className="ml-1 text-caption text-ink-muted">(image)</span>
                )}
              </span>
              {option.disabled && (
                <span className="text-caption">{option.reason ?? 'already connected'}</span>
              )}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/**
 * "Connect <column> to": the keyboard path for a relationship (042 R9). Lists every table column
 * as "table.column", primary keys first; Enter draws it through `connectColumns`.
 */
function ColumnConnectContent({
  deck,
  tableId,
  columnId,
  name,
}: {
  deck: SododeckFile;
  tableId: string;
  columnId: string;
  name: string;
}) {
  const editor = useEditor();
  const closePopover = useUiStore((s) => s.closePopover);
  const [query, setQuery] = useState('');
  const source = { tableId, columnId };
  const options = columnConnectTargets(deck, source, query);
  const [active, setActive] = useState(() => nextEnabled(options, -1, 1));
  const activeIndex = options[active]?.disabled === false ? active : nextEnabled(options, -1, 1);
  const listId = useId();
  const virtualRef = useRef({ getBoundingClientRect: () => rowRect(tableId, columnId) });
  const optionId = (index: number) => `${listId}-${String(index)}`;
  useScrollActiveIntoView(listId, activeIndex);
  const choose = (index: number) => {
    const option = options[index];
    if (option === undefined || option.disabled) return;
    closePopover();
    connectColumns(editor, source, option);
  };
  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) closePopover();
      }}
    >
      <PopoverAnchor virtualRef={virtualRef} />
      <PopoverContent
        aria-label={`Connect ${name} to`}
        side="bottom"
        align="start"
        className="w-80 gap-2 p-2"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          focusCanvas();
        }}
      >
        <span className="px-1 pt-1 text-micro text-ink-muted uppercase">Connect {name} to…</span>
        <SearchField
          label="Find column"
          placeholder="Find column"
          value={query}
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={options.length > 0 ? optionId(activeIndex) : undefined}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setActive(nextEnabled(options, activeIndex, event.key === 'ArrowDown' ? 1 : -1));
            } else if (event.key === 'Home' || event.key === 'End') {
              // The field has no use for them while a list is on offer; the list does.
              if (options.length === 0) return;
              event.preventDefault();
              setActive(edgeEnabled(options, event.key));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              choose(activeIndex);
            }
          }}
        />
        <ul
          id={listId}
          role="listbox"
          aria-label={`Connect ${name} to`}
          className="flex max-h-64 flex-col overflow-y-auto"
        >
          {options.length === 0 && (
            <li className="px-2 py-3 text-body-sm text-ink-secondary">No matching columns</li>
          )}
          {options.map((option, index) => (
            <li
              key={`${option.tableId}:${option.columnId}`}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              aria-disabled={option.disabled || undefined}
              onPointerDown={(event) => {
                event.preventDefault();
              }}
              onClick={() => {
                choose(index);
              }}
              className={cn(
                'flex h-8 items-center gap-2 rounded-row px-2 font-mono text-[12px]',
                option.disabled
                  ? 'cursor-not-allowed text-ink-muted'
                  : 'cursor-pointer text-ink hover:bg-surface-2',
                index === activeIndex && 'bg-primary-soft font-medium text-primary-ink',
              )}
            >
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              {option.disabled && <span className="font-sans text-caption">already related</span>}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
