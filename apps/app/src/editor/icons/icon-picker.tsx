/**
 * The icon picker (038 T025, contract "Picker"): search, set filter, sections of icon cells,
 * Reset and a footer echo. It only chooses: callers own the popover and the write (`applyIcon`).
 * No design frame exists, so it follows the colour popover and the Add palette grid: a recessed
 * search field, small captions per section, tiles with a ring + check on the current one.
 */
import { SearchField } from '@sododeck/ui/components/search-field';
import { IconGlyph } from '@sododeck/ui/components/icon-glyph';
import { SegmentedControl, SegmentedControlItem } from '@sododeck/ui/components/segmented-control';
import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import {
  ICON_SETS,
  iconRef,
  resolveIcon,
  searchIcons,
  type IconSet,
  type ResolvedIcon,
} from '@sododeck/ui/icon-sets';
import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import { Check } from 'lucide-react';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';

import { neighbour } from '../grid-nav';

const COLUMNS = 8;
/** Stroke of the glyphs in the picker (as the type icon elsewhere). */
const PICKER_STROKE = 1.5;

export interface IconPickerProps {
  /** The selection's icon: one resolved icon, `null` (type icons) or `'mixed'` (they differ). */
  current: ResolvedIcon | 'mixed' | null;
  /** How many cards a pick changes. */
  cardCount: number;
  /** Show the "Changes N cards" scope line (the selection has other items, or several cards). */
  showScope: boolean;
  /** Whether any selected card has an icon of its own (enables Reset). */
  canReset: boolean;
  /** A stored reference this version cannot show (it stays until a pick or Reset). */
  unavailable?: string | null;
  /** `iconUsage` of the deck; hidden for now, listed by the "Used in this deck" section. */
  usage: readonly { ref: string; count: number }[];
  sets?: readonly IconSet[];
  onPick: (ref: string) => void;
  onReset: () => void;
}

interface Section {
  id: string;
  name: string;
  icons: readonly ResolvedIcon[];
}

const same = (a: ResolvedIcon | null, b: ResolvedIcon | null) =>
  a !== null && b !== null && a.set === b.set && a.name === b.name;

/** Rows of `COLUMNS` cells: ARIA grids need `row > gridcell`. */
function chunk<T>(items: readonly T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += COLUMNS) rows.push(items.slice(i, i + COLUMNS));
  return rows;
}

function sectionsOf(set: IconSet | undefined, sets: readonly IconSet[]): Section[] {
  if (set === undefined) return [];
  return set.categories.flatMap((category) => {
    const icons = set.icons
      .filter((entry) => entry.category === category.id)
      .flatMap((entry) => resolveIcon(`${set.id}:${entry.name}`, sets) ?? []);
    return icons.length === 0 ? [] : [{ id: category.id, name: category.label, icons }];
  });
}

export function IconPicker({
  current,
  cardCount,
  showScope,
  canReset,
  unavailable = null,
  sets = ICON_SETS,
  onPick,
  onReset,
}: IconPickerProps) {
  const [query, setQuery] = useState('');
  const [setId, setSetId] = useState(sets[0]?.id ?? '');
  const [active, setActive] = useState<string | null>(null);
  const [peek, setPeek] = useState<ResolvedIcon | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const cells = useRef(new Map<string, HTMLButtonElement>());

  const set = sets.find((s) => s.id === setId) ?? sets[0];
  const searching = query.trim() !== '';
  const results = useMemo(
    () => (searching ? searchIcons(query, sets, set?.id) : []),
    [searching, query, sets, set?.id],
  );
  const sections: Section[] = useMemo(
    () =>
      searching
        ? results.length === 0
          ? []
          : [{ id: 'results', name: 'Results', icons: results }]
        : sectionsOf(set, sets),
    [searching, results, set, sets],
  );

  const cellId = (section: Section, icon: ResolvedIcon) => `${section.id}|${iconRef(icon)}`;
  const ids = sections.map((section) => section.icons.map((icon) => cellId(section, icon)));
  const firstId = ids[0]?.[0] ?? null;
  const focusId = active !== null && ids.some((row) => row.includes(active)) ? active : firstId;

  const focusCell = (id: string) => {
    setActive(id);
    cells.current.get(id)?.focus();
  };

  const onCellKey = (event: KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (event.key.startsWith('Arrow')) {
      event.preventDefault();
      const next = neighbour(ids, id, event.key, COLUMNS);
      if (next !== null) focusCell(next);
    }
  };

  /** A printable key typed anywhere but the search box is a search (contract "Keys"). */
  const onRootKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target === searchRef.current) return;
    if (
      event.key.length !== 1 ||
      event.key === ' ' ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    setQuery((q) => q + event.key);
    searchRef.current?.focus();
  };

  const footerIcon = peek ?? (current !== 'mixed' ? current : null);
  const footerText =
    peek !== null
      ? peek.label
      : current === 'mixed'
        ? 'Icons differ'
        : current === null
          ? 'Type icon'
          : current.label;

  return (
    <div className="flex flex-col gap-3" onKeyDown={onRootKey}>
      {(showScope || current === 'mixed') && (
        <div className="flex items-center justify-between text-caption text-ink-secondary">
          {showScope ? (
            <span>{`Changes ${String(cardCount)} ${cardCount === 1 ? 'card' : 'cards'}`}</span>
          ) : (
            <span />
          )}
          {current === 'mixed' && <span className="font-medium text-ink">Mixed</span>}
        </div>
      )}
      {unavailable !== null && (
        <p className="flex flex-col gap-0.5 rounded-button bg-surface-2 px-2 py-1.5 text-caption text-ink-secondary">
          <code className="font-mono text-code-sm break-all text-ink">{unavailable}</code>
          <span>Icon not available in this version</span>
        </p>
      )}
      <SearchField
        ref={searchRef}
        label="Search icons"
        placeholder="Search icons…"
        value={query}
        autoFocus
        onChange={(event) => {
          setQuery(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            const first = results[0];
            if (first === undefined) return;
            event.preventDefault();
            onPick(iconRef(first));
          } else if (event.key === 'ArrowDown' && focusId !== null) {
            event.preventDefault();
            focusCell(focusId);
          }
        }}
      />
      {sets.length > 1 && (
        <SegmentedControl
          aria-label="Icon set"
          value={set?.id ?? ''}
          onValueChange={(value) => {
            setSetId(value);
          }}
        >
          {sets.map((s) => (
            <SegmentedControlItem key={s.id} value={s.id} aria-label={s.name}>
              {s.name}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      )}
      <div className="flex max-h-72 flex-col gap-3 overflow-y-auto pr-0.5">
        {sections.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-body-sm text-ink-secondary">
            <p>No icons match</p>
            <button
              type="button"
              className={cn(
                'rounded-button px-2 py-1 text-primary hover:bg-primary-soft',
                focusRing,
              )}
              onClick={() => {
                setQuery('');
                searchRef.current?.focus();
              }}
            >
              Clear search
            </button>
          </div>
        ) : (
          sections.map((section) => (
            <section key={section.id} className="flex flex-col gap-1.5">
              <h3 className="text-micro text-ink-muted uppercase" aria-hidden>
                {section.name}
              </h3>
              <div role="grid" aria-label={section.name} className="flex flex-col gap-1">
                {chunk(section.icons).map((row) => (
                  <div
                    key={row[0] ? iconRef(row[0]) : 'row'}
                    role="row"
                    className="grid grid-cols-8 gap-1"
                  >
                    {row.map((icon) => {
                      const id = cellId(section, icon);
                      const selected = current !== 'mixed' && same(current, icon);
                      return (
                        <div key={id} role="gridcell" aria-selected={selected} className="contents">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label={icon.label}
                                ref={(el) => {
                                  if (el === null) cells.current.delete(id);
                                  else cells.current.set(id, el);
                                }}
                                tabIndex={id === focusId ? 0 : -1}
                                onFocus={() => {
                                  setActive(id);
                                  setPeek(icon);
                                }}
                                onBlur={() => {
                                  setPeek(null);
                                }}
                                onMouseEnter={() => {
                                  setPeek(icon);
                                }}
                                onMouseLeave={() => {
                                  setPeek(null);
                                }}
                                onKeyDown={(event) => {
                                  onCellKey(event, id);
                                }}
                                onClick={() => {
                                  onPick(iconRef(icon));
                                }}
                                className={cn(
                                  'relative flex size-8 items-center justify-center rounded-button text-ink-secondary transition-colors hover:bg-surface-2 hover:text-ink',
                                  selected && 'bg-primary-soft text-ink ring-2 ring-primary',
                                  focusRing,
                                )}
                              >
                                <IconGlyph icon={icon} size={18} strokeWidth={PICKER_STROKE} />
                                {selected && (
                                  <Check
                                    data-check
                                    aria-hidden
                                    strokeWidth={3}
                                    className="absolute -top-1 -right-1 size-3 rounded-full bg-primary p-px text-on-primary"
                                  />
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>{icon.label}</TooltipContent>
                          </Tooltip>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-hairline pt-2">
        <span
          data-testid="icon-picker-footer"
          className="flex min-w-0 items-center gap-1.5 truncate text-caption text-ink-secondary"
        >
          {footerIcon !== null && (
            <IconGlyph icon={footerIcon} size={14} strokeWidth={PICKER_STROKE} />
          )}
          {footerText}
        </span>
        <button
          type="button"
          disabled={!canReset}
          onClick={onReset}
          className={cn(
            'shrink-0 rounded-button px-2 py-1 text-body-sm text-primary hover:bg-primary-soft disabled:pointer-events-none disabled:text-ink-muted',
            focusRing,
          )}
        >
          Reset to type icon
        </button>
      </div>
    </div>
  );
}
