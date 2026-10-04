import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { KeyRound, Link2, ListOrdered } from 'lucide-react';
import { memo } from 'react';

import { TABLE_CARD, type KeyGlyph, type TableLayout } from '../table-layout';
import { EnumChip } from './enum-chip';
import { GLYPH_NAMES, rowLabel } from './table-text';

/** The key glyphs (DESIGN.md "Glyphs"): distinct shapes, so they read without colour (FR-010). */
function Glyph({ glyph }: { glyph: KeyGlyph }) {
  const name = GLYPH_NAMES[glyph];
  if (glyph === 'unique') {
    return (
      <span
        role="img"
        aria-label={name}
        className="inline-flex size-3 shrink-0 items-center justify-center rounded-[3px] border-[1.25px] border-current font-mono text-[7.5px] leading-none font-semibold text-ink-secondary"
      >
        U
      </span>
    );
  }
  const Icon = glyph === 'pk' ? KeyRound : Link2;
  return (
    <Icon
      role="img"
      aria-label={name}
      strokeWidth={ICON_STROKE_WIDTH}
      className={cn('size-3.5 shrink-0', glyph === 'pk' ? 'text-ink' : 'text-ink-secondary')}
    />
  );
}

const TYPE_MAX = `${String(TABLE_CARD.typeShare * 100)}%`;

/**
 * A table card's column list (041, frame 156): the hairline, one fixed 24 px row per column, the
 * "+n columns" pill and the footer, exactly as `tableLayout` measured them. Rows are plain
 * elements with a CSS hover and a native `title` when cut (R8): no per-row component state.
 */
export const TableBody = memo(function TableBody({
  nodeId,
  layout,
  focused,
  tinted = false,
}: {
  nodeId: string;
  layout: TableLayout;
  /** The card holds the canvas's Tab stop: its chips join the tab order (roving). */
  focused: boolean;
  /** The card has a colour fill: type text uses Secondary for contrast (§g-90). */
  tinted?: boolean;
}) {
  if (!layout.hasBody) return null;
  const tabIndex = focused ? 0 : -1;
  const muted = tinted ? 'text-ink-secondary' : 'text-ink-muted group-hover/row:text-ink-secondary';
  const footerParts = [
    layout.hidden?.kind === 'all' ? `${String(layout.hidden.count)} columns` : undefined,
    layout.footer,
  ].filter((part) => part !== undefined);
  return (
    <div data-testid="table-body" className="relative flex shrink-0 flex-col">
      {/* The one hairline above the list, in the middle of the 8 px gap (frame 156). */}
      <span aria-hidden className="absolute inset-x-0 -top-1 h-px bg-hairline" />
      {layout.rows.length > 0 && (
        <ul aria-label="Columns" className="flex flex-col">
          {layout.rows.map((row) => (
            <li
              key={row.columnId}
              aria-label={rowLabel(row)}
              title={row.nameCut || row.typeCut ? rowLabel(row) : undefined}
              data-column-id={row.columnId}
              className="group/row -mx-[9px] flex h-6 shrink-0 items-center rounded-row px-[9px] hover:bg-surface-2"
            >
              <span
                className="flex shrink-0 items-center gap-0.5"
                style={{ width: layout.keySlot, marginRight: TABLE_CARD.keyGap }}
              >
                {row.glyphs.map((glyph) => (
                  <Glyph key={glyph} glyph={glyph} />
                ))}
              </span>
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-[12px] leading-6 text-ink',
                  row.glyphs.includes('pk') ? 'font-semibold' : 'font-medium',
                )}
              >
                {row.name}
              </span>
              {row.enum !== undefined ? (
                <EnumChip
                  chip={row.enum}
                  nodeId={nodeId}
                  columnId={row.columnId}
                  tabIndex={tabIndex}
                  maxWidth={TYPE_MAX}
                />
              ) : (
                row.type !== undefined && (
                  <span
                    className={cn('ml-2 shrink-0 truncate text-right font-mono text-[11px]', muted)}
                    style={{ maxWidth: TYPE_MAX }}
                  >
                    {row.type}
                  </span>
                )
              )}
              {layout.showNullable && (
                <span
                  aria-hidden
                  className={cn('ml-[3px] w-[7px] shrink-0 font-mono text-[11px]', muted)}
                >
                  {row.nullable ? '?' : ''}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {layout.hidden?.kind === 'more' && (
        <span
          role="img"
          aria-label={`+${String(layout.hidden.count)} columns hidden`}
          className={cn(
            'flex h-6 shrink-0 items-center justify-center rounded-row border-[1.5px] border-dashed border-border-strong text-[11.5px] font-medium text-ink-secondary',
            layout.rows.length > 0 && 'mt-1.5',
          )}
        >
          +{layout.hidden.count} columns
        </span>
      )}
      {footerParts.length > 0 && (
        <span className={cn('flex h-6 shrink-0 items-center gap-3 text-[11.5px]', muted)}>
          {footerParts.map((part) => (
            <span key={part} role="img" aria-label={part} className="flex items-center gap-1.5">
              {part === layout.footer && (
                <ListOrdered aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
              )}
              {part}
            </span>
          ))}
        </span>
      )}
    </div>
  );
});
