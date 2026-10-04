import { Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';

export interface Range {
  start: number;
  end: number;
}

export interface CommandDialogItem {
  id: string;
  title: string;
  meta: string;
  icon?: ReactNode;
  shortcut?: string;
  titleRanges?: readonly Range[];
  snippet?: { text: string; ranges: readonly Range[] };
}

function clamp(index: number, length: number): number {
  if (length === 0) return -1;
  if (index < 0) return 0;
  if (index >= length) return length - 1;
  return index;
}

function HighlightedText({ text, ranges }: { text: string; ranges: readonly Range[] | undefined }) {
  const segments = useMemo(() => {
    if (ranges === undefined || ranges.length === 0) return [{ text, highlighted: false }];
    const out: { text: string; highlighted: boolean }[] = [];
    let cursor = 0;
    for (const range of ranges) {
      if (range.start > cursor) {
        out.push({ text: text.slice(cursor, range.start), highlighted: false });
      }
      out.push({ text: text.slice(range.start, range.end), highlighted: true });
      cursor = range.end;
    }
    if (cursor < text.length) out.push({ text: text.slice(cursor), highlighted: false });
    return out.filter((segment) => segment.text !== '');
  }, [ranges, text]);

  return (
    <>
      {segments.map((segment, index) =>
        segment.highlighted ? (
          <mark
            key={`${segment.text}-${String(index)}`}
            className="bg-transparent font-semibold underline underline-offset-2"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={`${segment.text}-${String(index)}`}>{segment.text}</span>
        ),
      )}
    </>
  );
}

export function CommandDialog({
  open,
  query,
  items,
  total = items.length,
  onQueryChange,
  onOpenChange,
  onSelect,
  emptyState,
}: {
  open: boolean;
  query: string;
  items: readonly CommandDialogItem[];
  total?: number;
  onQueryChange: (query: string) => void;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: CommandDialogItem) => void;
  emptyState?: ReactNode;
}) {
  const listId = useId();
  const optionId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [announcement, setAnnouncement] = useState<{ key: string; text: string }>({
    key: '',
    text: '',
  });
  const active = open ? clamp(activeIndex, items.length) : -1;
  const announcementKey = `${open ? 'open' : 'closed'}:${String(total)}:${String(items.length)}`;
  const announcementText = items.length === 0 ? 'No results' : `${String(total)} results`;

  useEffect(() => {
    if (!open) return;
    const id = globalThis.setTimeout(() => {
      setAnnouncement({ key: announcementKey, text: announcementText });
    }, 300);
    return () => {
      globalThis.clearTimeout(id);
    };
  }, [announcementKey, announcementText, open]);

  const activeItem = active === -1 ? undefined : items[active];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[720px] gap-3"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          setActiveIndex(0);
          inputRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Jump to</DialogTitle>
        </DialogHeader>
        {/* The field's own border turns orange on focus, like `Input` (DESIGN.md text-input): the
            dialog opens with focus here, so a ring around the bare input looked misplaced. */}
        <div className="flex items-center gap-2 rounded-card border border-border bg-surface-2 px-3 transition-colors focus-within:border-primary">
          <Search
            aria-hidden
            strokeWidth={ICON_STROKE_WIDTH}
            className="size-4 shrink-0 text-ink-muted"
          />
          <input
            ref={inputRef}
            role="combobox"
            aria-label="Search the deck"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeItem === undefined ? undefined : `${optionId}-${active}`}
            value={query}
            placeholder="Jump to a node, flow or command"
            onChange={(event) => {
              onQueryChange(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((current) => clamp(current + 1, items.length));
                return;
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((current) => clamp(current - 1, items.length));
                return;
              }
              if (event.key === 'Home') {
                event.preventDefault();
                setActiveIndex(0);
                return;
              }
              if (event.key === 'End') {
                event.preventDefault();
                setActiveIndex(Math.max(0, items.length - 1));
                return;
              }
              if (event.key === 'Enter') {
                if (activeItem === undefined) return;
                event.preventDefault();
                onSelect(activeItem);
                return;
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                onOpenChange(false);
              }
            }}
            className="h-11 w-full bg-transparent text-body text-ink outline-none placeholder:text-ink-muted"
          />
          <kbd aria-hidden className="text-caption text-ink-muted">
            esc
          </kbd>
        </div>
        {items.length === 0 ? (
          <div className="rounded-card border border-border bg-surface-2 px-4 py-6 text-body text-ink-secondary">
            {emptyState ?? 'No results'}
          </div>
        ) : (
          <ul
            id={listId}
            role="listbox"
            aria-label="Results"
            className="max-h-96 overflow-y-auto rounded-card border border-border bg-surface-2 p-1"
          >
            {items.map((item, index) => (
              <li
                key={item.id}
                id={`${optionId}-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseMove={() => {
                  setActiveIndex(index);
                }}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={() => {
                  onSelect(item);
                }}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-row px-3 py-2',
                  index === active && 'bg-surface',
                )}
              >
                {item.icon === undefined ? null : (
                  <span className="mt-0.5 shrink-0 text-ink-secondary">{item.icon}</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <span className="truncate text-body font-medium">
                      <HighlightedText text={item.title} ranges={item.titleRanges} />
                    </span>
                    <span className="shrink-0 text-caption text-ink-secondary">{item.meta}</span>
                  </div>
                  {item.snippet === undefined ? null : (
                    <p className="mt-0.5 text-body-sm text-ink-secondary">
                      <HighlightedText text={item.snippet.text} ranges={item.snippet.ranges} />
                    </p>
                  )}
                </div>
                {item.shortcut === undefined ? null : (
                  <kbd aria-hidden className="shrink-0 text-caption text-ink-muted">
                    {item.shortcut}
                  </kbd>
                )}
              </li>
            ))}
            {total > items.length ? (
              <li className="px-3 py-2 text-caption text-ink-secondary">{`Showing ${String(items.length)} of ${String(total)} · ${String(total - items.length)} more`}</li>
            ) : null}
          </ul>
        )}
        <div className="text-caption text-ink-secondary">↵ open · esc close</div>
        <div role="status" aria-live="polite" className="sr-only">
          {announcement.key === announcementKey ? announcement.text : ''}
        </div>
      </DialogContent>
    </Dialog>
  );
}
