import type { SododeckFile } from '@sododeck/schema';
import { KindTile } from '@sododeck/ui/components/kind-tile';
import { Popover, PopoverAnchor, PopoverContent } from '@sododeck/ui/components/popover';
import { SearchField } from '@sododeck/ui/components/search-field';
import { cn } from '@sododeck/ui/lib/utils';
import { useId, useRef, useState } from 'react';

import { useEditor } from '../model/use-editor';
import { useUiStore } from '../state/ui-store';
import { canvasElement, connectComponents, focusCanvas, nodeElement } from './canvas-actions';
import { connectTargets, type ConnectTarget } from './connection-rules';

function anchorRect(nodeId: string): DOMRect {
  const rect = (nodeElement(nodeId) ?? canvasElement())?.getBoundingClientRect();
  return rect ?? new DOMRect(0, 0, 0, 0);
}

/** Next enabled option from `index` in `step` direction, or `index` when there is none. */
function nextEnabled(options: readonly ConnectTarget[], index: number, step: 1 | -1): number {
  for (let i = index + step; i >= 0 && i < options.length; i += step) {
    if (!options[i]?.disabled) return i;
  }
  return index;
}

/** "Connect <title> to…": type-ahead keyboard connect (FR-012, design 56). */
export function ConnectPopover({ deck }: { deck: SododeckFile }) {
  const popover = useUiStore((s) => s.popover);
  const fromId = popover?.kind === 'connect' ? popover.fromId : null;
  const from = fromId === null ? undefined : deck.nodes.find((n) => n.id === fromId);
  if (!from) return null;
  return <ConnectPopoverContent key={from.id} deck={deck} fromId={from.id} title={from.title} />;
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
              <KindTile kind={option.kind} size={22} decorative />
              <span className="min-w-0 flex-1 truncate">{option.title}</span>
              {option.disabled && <span className="text-caption">already connected</span>}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
