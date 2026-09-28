import { Check, Search } from 'lucide-react';
import { useId, useState } from 'react';
import type * as React from 'react';

import { TagChip } from '@sododeck/ui/components/tag-chip';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';

export interface ChoiceOption {
  value: string;
  label: string;
  /** `selected`: the current value (check + `aria-selected`); `partial`: on some objects only. */
  state?: 'selected' | 'partial';
  /** Shown after a partial option's label and read with it, e.g. "2 of 3". */
  count?: string;
}

type ChoiceListProps = Omit<React.ComponentProps<'div'>, 'onChange' | 'autoFocus'> & {
  /** Accessible name of the listbox, e.g. "Owner options". */
  label: string;
  /** Accessible name of the filter field, e.g. "Filter owner". */
  filterLabel: string;
  options: readonly ChoiceOption[];
  /** The selected objects hold different values: says "Mixed" above the list. */
  mixed?: boolean;
  /** An explicit "none" row (optional fields), which picks `null`. */
  none?: { label: string };
  /** The label of a row that uses the typed text ("Use 'x'"), or `null` for no such row. */
  create?: (typed: string) => string | null;
  /** Several values (tags): `aria-multiselectable`; the caller keeps the list open. */
  multiple?: boolean;
  /** Focuses the filter on mount (default; the popover opened it). */
  autoFocus?: boolean;
  /** An option's value, the trimmed typed text, or `null` for the "none" row. */
  onPick: (value: string | null) => void;
};

type Row =
  | { kind: 'option'; option: ChoiceOption }
  | { kind: 'none'; label: string }
  | { kind: 'create'; label: string; value: string };

/**
 * A filter field over a listbox (019 toolbar popover, research R6). The filter keeps focus; ↑ / ↓
 * move the active row (`aria-activedescendant`), Enter or a click picks it. Escape is left to the
 * surrounding popover. Mixed and partial states are carried in text, never by style alone.
 */
function ChoiceList({
  label,
  filterLabel,
  options,
  mixed = false,
  none,
  create,
  multiple = false,
  autoFocus = true,
  onPick,
  className,
  ...props
}: ChoiceListProps) {
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState(0);
  const id = useId();

  const needle = filter.trim().toLowerCase();
  const createLabel = create?.(filter) ?? null;
  const rows: Row[] = [
    ...(none !== undefined && (needle === '' || none.label.toLowerCase().includes(needle))
      ? [{ kind: 'none' as const, label: none.label }]
      : []),
    ...options
      .filter((option) => option.label.toLowerCase().includes(needle))
      .map((option) => ({ kind: 'option' as const, option })),
    ...(createLabel === null
      ? []
      : [{ kind: 'create' as const, label: createLabel, value: filter.trim() }]),
  ];
  const activeIndex = Math.min(active, rows.length - 1);
  const rowId = (index: number) => `${id}-row-${String(index)}`;

  const pick = (row: Row) => {
    if (row.kind === 'none') onPick(null);
    else if (row.kind === 'create') onPick(row.value);
    else onPick(row.option.value);
  };

  return (
    <div data-slot="choice-list" className={cn('flex flex-col gap-2', className)} {...props}>
      <div className="flex h-8 items-center gap-2 rounded-input bg-surface-2 px-2.5">
        <Search
          aria-hidden
          strokeWidth={ICON_STROKE_WIDTH}
          className="size-4 shrink-0 text-ink-secondary"
        />
        <input
          type="search"
          aria-label={filterLabel}
          aria-controls={`${id}-list`}
          aria-activedescendant={activeIndex >= 0 ? rowId(activeIndex) : undefined}
          autoFocus={autoFocus}
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive(Math.min(activeIndex + 1, rows.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive(Math.max(activeIndex - 1, 0));
            } else if (event.key === 'Enter') {
              const row = rows[activeIndex];
              if (row === undefined) return;
              event.preventDefault();
              pick(row);
            }
          }}
          className="h-full min-w-0 flex-1 bg-transparent text-body-sm text-ink outline-none placeholder:text-ink-secondary"
        />
      </div>
      {mixed && <p className="px-2.5 text-caption text-ink-secondary">Mixed</p>}
      <div
        id={`${id}-list`}
        role="listbox"
        aria-label={label}
        aria-multiselectable={multiple || undefined}
        className="flex max-h-64 flex-col overflow-y-auto"
      >
        {rows.map((row, index) => {
          const selected = row.kind === 'option' && row.option.state === 'selected';
          const partial = row.kind === 'option' && row.option.state === 'partial';
          const text = row.kind === 'option' ? row.option.label : row.label;
          return (
            <div
              key={row.kind === 'option' ? `o:${row.option.value}` : row.kind}
              id={rowId(index)}
              role="option"
              aria-selected={selected}
              aria-label={
                partial && row.option.count !== undefined
                  ? `${text}, ${row.option.count}`
                  : undefined
              }
              data-active={index === activeIndex || undefined}
              onMouseDown={(event) => {
                // The filter keeps focus, so the keyboard keeps working after a click.
                event.preventDefault();
              }}
              onMouseMove={() => {
                if (index !== activeIndex) setActive(index);
              }}
              onClick={() => {
                pick(row);
              }}
              className={cn(
                'flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-row px-2.5 text-body-sm text-ink select-none data-[active]:bg-surface-2',
                row.kind !== 'option' && 'text-ink-secondary',
              )}
            >
              {partial ? (
                <TagChip label={text} partial count={row.option.count} />
              ) : (
                <span className="min-w-0 flex-1 truncate">{text}</span>
              )}
              {selected && (
                <Check
                  aria-hidden
                  strokeWidth={ICON_STROKE_WIDTH}
                  className="ml-auto size-4 shrink-0 text-primary-ink"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { ChoiceList };
