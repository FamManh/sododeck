import { cn } from '@sododeck/ui/lib/utils';
import { useEffect, useRef } from 'react';

import { useUiStore } from '../../state/ui-store';
import { matchOrder, type TableLayout } from '../table-layout';
import { useRevealRow } from './reveal-row';

/**
 * The in-table column filter (048, ⌘F): replaces the header's type name with a labelled input and
 * a "k/n" counter in a live region. Text and the current match are UI state (`ui.tableFilter`);
 * `tableLayout` folds the non-matching rows, so the card and its connectors follow. Enter and
 * Shift+Enter step the match (the canvas pans to it when it is off screen); Esc or clearing closes.
 */
export function TableFilter({
  nodeId,
  title,
  layout,
}: {
  nodeId: string;
  title: string;
  layout: TableLayout;
}) {
  const filter = useUiStore((s) => (s.tableFilter?.tableId === nodeId ? s.tableFilter : null));
  const inputRef = useRef<HTMLInputElement>(null);
  const reveal = useRevealRow();
  const matches = matchOrder(layout);
  const total = matches.length;
  const index = filter?.index ?? 0;
  const current = matches[Math.min(index, Math.max(0, total - 1))];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  // Follow the current match, e.g. after Enter or when typing moves it off screen.
  useEffect(() => {
    if (current !== undefined) reveal(nodeId, layout, current);
    // The layout object changes with every keystroke; only a new match should pan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, nodeId]);

  if (filter === null) return null;
  const ui = useUiStore.getState();
  const close = () => {
    // Back to the card, so keys keep working after the input is gone.
    inputRef.current?.closest<HTMLElement>('.react-flow__node')?.focus();
    ui.closeTableFilter();
  };
  const counting = filter.text.trim() !== '';
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        aria-label={`Find a column in ${title}`}
        value={filter.text}
        spellCheck={false}
        autoComplete="off"
        className={cn(
          'nodrag nopan nowheel h-6 min-w-0 flex-1 rounded-row border border-border-strong bg-surface px-2 text-caption font-medium text-ink outline-none',
          'focus-visible:ring-2 focus-visible:ring-primary',
        )}
        onChange={(event) => {
          if (event.target.value === '') close();
          else ui.setTableFilterText(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            close();
          } else if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            ui.stepTableFilter(event.shiftKey ? -1 : 1, total);
          }
        }}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
      />
      <span
        role="status"
        className="shrink-0 font-mono text-[11px] text-ink-secondary tabular-nums"
      >
        {counting
          ? total === 0
            ? '0'
            : `${String(Math.min(index, total - 1) + 1)}/${String(total)}`
          : ''}
      </span>
    </span>
  );
}
