import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { Calendar, CalendarRange, Link as LinkIcon } from 'lucide-react';
import type { StatusIcon } from '@sododeck/schema';
import { createElement, type CSSProperties } from 'react';

import { useUiStore } from '../state/ui-store';
import {
  FIELD_CHIP,
  hiddenLabel,
  hiddenName,
  type CardFieldView,
  type FieldBlock,
  type FieldChip,
  type FieldRow,
} from './card-fields';
import { useOpenLink } from './embed-host-context';
import { statusIconOf } from './fields/field-icons';
import { tagColours } from './tags/tag-colours';

/** Option chips take their option's colour; person and date chips follow the card's tile (029). */
function chipStyle(chip: FieldChip): CSSProperties {
  if (chip.kind === 'select' || chip.kind === 'status') {
    const colours = tagColours(chip.color);
    return {
      '--field-chip': colours.chip,
      '--field-ink': colours.ink,
      '--field-dot': colours.dot,
    } as CSSProperties;
  }
  return {
    '--field-chip': 'var(--card-chip, var(--color-surface-2))',
    '--field-ink': 'var(--card-ink, var(--color-ink-secondary))',
    '--field-dot': 'var(--card-dot, var(--color-ink-muted))',
  } as CSSProperties;
}

/** A status option's lucide icon (absent = circle). */
function StatusGlyph({ icon, className }: { icon: StatusIcon | undefined; className: string }) {
  return createElement(statusIconOf(icon), { 'aria-hidden': true, strokeWidth: 2, className });
}

function ChipLead({ chip }: { chip: FieldChip }) {
  if (chip.kind === 'status') {
    return <StatusGlyph icon={chip.icon} className="size-3 shrink-0" />;
  }
  if (chip.kind === 'person') {
    return (
      <span
        aria-hidden
        className="flex size-4 shrink-0 items-center justify-center rounded-full bg-surface-3 font-mono text-[7.5px] font-semibold text-ink-secondary"
      >
        {chip.initials}
      </span>
    );
  }
  if (chip.kind === 'date' || chip.kind === 'dateRange') {
    const Icon = chip.kind === 'date' ? Calendar : CalendarRange;
    return <Icon aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3 shrink-0" />;
  }
  return null;
}

/** One field chip (DESIGN.md `--sd-deck-chip`): 21 tall, padding 0 8 0 7, Geist 11.5 / 500. */
function Chip({ chip, as: Tag = 'li' }: { chip: FieldChip; as?: 'li' | 'span' }) {
  return (
    <Tag
      aria-label={chip.name}
      title={chip.name}
      style={chipStyle(chip)}
      className="flex h-[21px] max-w-full min-w-0 items-center gap-1 rounded-full bg-(--field-chip) pr-2 pl-[7px] text-[11.5px] leading-none font-medium text-(--field-ink)"
    >
      <ChipLead chip={chip} />
      <span aria-hidden className="truncate">
        {chip.text}
      </span>
    </Tag>
  );
}

/**
 * The first on-card status in the header's status slot (frame 124): the chip, or its icon alone
 * on a card narrower than 150 px. Named "<field>: <label>" either way.
 */
export function HeaderStatus({ chip, narrow }: { chip: FieldChip; narrow: boolean }) {
  if (!narrow) {
    return (
      <span data-testid="header-status" className="flex min-w-0 shrink">
        <Chip chip={chip} as="span" />
      </span>
    );
  }
  return (
    <span
      data-testid="header-status"
      role="img"
      aria-label={chip.name}
      title={chip.name}
      style={chipStyle(chip)}
      className="flex size-[21px] shrink-0 items-center justify-center rounded-full bg-(--field-chip) text-(--field-ink)"
    >
      <StatusGlyph icon={chip.icon} className="size-3" />
    </span>
  );
}

function Row({ row, textClass }: { row: FieldRow; textClass: string | null }) {
  const openLink = useOpenLink();
  const label = (
    <span
      className={cn('shrink-0 text-[11.5px] leading-none', textClass ?? 'text-ink-muted')}
      aria-hidden
    >
      {row.label}
    </span>
  );
  let value;
  if (row.kind === 'progress') {
    value = (
      <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <span aria-hidden className="h-2 min-w-6 flex-1 overflow-hidden rounded-[4px] bg-surface-3">
          <span
            className="block h-full rounded-[4px] bg-ink-secondary"
            style={{ width: `${String(row.progress ?? 0)}%` }}
          />
        </span>
        <span className="shrink-0 font-mono text-[11.5px] leading-none text-ink">{row.text}</span>
      </span>
    );
  } else if (row.kind === 'link' && row.href !== undefined && openLink === null) {
    // The host cannot open links: the text stays, with no action to open it (067).
    value = (
      <span
        title={row.href}
        className="flex min-w-0 items-center justify-end gap-1 text-[11.5px] leading-none text-ink"
      >
        <LinkIcon aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3 shrink-0" />
        <span className="truncate">{row.text}</span>
      </span>
    );
  } else if (row.kind === 'link' && row.href !== undefined) {
    const href = row.href;
    value = (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={href}
        onClick={(event) => {
          event.stopPropagation();
          // Through the host's door, so a link never navigates the editor's own frame.
          event.preventDefault();
          openLink?.(href);
        }}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
        className="nodrag nopan flex min-w-0 items-center justify-end gap-1 text-[11.5px] leading-none text-ink underline underline-offset-2"
      >
        <LinkIcon aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3 shrink-0" />
        <span className="truncate">{row.text}</span>
      </a>
    );
  } else {
    value = (
      <span
        title={row.text}
        className={cn(
          'min-w-0 truncate text-right text-[11.5px] leading-none text-ink',
          row.kind === 'number' && 'font-mono',
        )}
      >
        {row.text}
      </span>
    );
  }
  return (
    <li
      aria-label={`${row.label}: ${row.text}`}
      className="flex h-[19px] min-w-0 items-center justify-between gap-2"
    >
      {label}
      {value}
    </li>
  );
}

/**
 * The card's typed fields (032, frame 124): the chip shelf, the label–value rows and the dashed
 * "+N fields" pill, between the description and the tags. At System level the chips are 6 px
 * dots in their colour and no rows (§g-63); the block keeps the room its layout reserved.
 */
export function CardFieldsBlock({
  nodeId,
  view,
  block,
  dots,
  textClass,
  focused,
}: {
  nodeId: string;
  /** The card holds the canvas's Tab stop: the pill is reachable too (roving focus). */
  focused: boolean;
  view: CardFieldView;
  block: FieldBlock;
  /** System level: chips as dots, no rows. */
  dots: boolean;
  textClass: string | null;
}) {
  if (block.height === 0) return null;
  const shelfHeight =
    block.chipRows === 0 ? 0 : block.chipRows * FIELD_CHIP.height + (block.chipRows - 1) * 4;
  return (
    <div
      data-testid="card-fields"
      className="flex shrink-0 flex-col"
      style={{ height: block.height }}
    >
      {view.chips.length > 0 && (
        <ul
          aria-label="Fields"
          className="flex shrink-0 flex-wrap content-start gap-1 overflow-hidden"
          style={{ height: shelfHeight }}
        >
          {view.chips.map((chip) =>
            dots ? (
              <li
                key={chip.fieldId}
                aria-label={chip.name}
                title={chip.name}
                style={chipStyle(chip)}
                className="m-[7.5px] size-1.5 rounded-full bg-(--field-dot)"
              />
            ) : (
              <Chip key={chip.fieldId} chip={chip} />
            ),
          )}
        </ul>
      )}
      {view.rows.length > 0 && !dots && (
        <ul
          aria-label="Field values"
          className="flex shrink-0 flex-col"
          style={{ marginTop: block.rowsTop - shelfHeight }}
        >
          {view.rows.map((row) => (
            <Row key={row.fieldId} row={row} textClass={textClass} />
          ))}
        </ul>
      )}
      {view.hidden > 0 && (
        <button
          type="button"
          aria-label={hiddenName(view.hidden)}
          tabIndex={focused ? 0 : -1}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
          }}
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            const ui = useUiStore.getState();
            ui.select({ nodes: [nodeId] });
            ui.focus(nodeId);
            ui.openDrawerAt('fields');
          }}
          className="nodrag nopan flex h-5 w-max shrink-0 cursor-pointer items-center rounded-full border-[1.5px] border-dashed border-border-strong px-2 text-[11px] leading-none font-medium text-ink-secondary hover:bg-surface-2"
          style={{ marginTop: 'auto' }}
        >
          {hiddenLabel(view.hidden)}
        </button>
      )}
    </div>
  );
}
