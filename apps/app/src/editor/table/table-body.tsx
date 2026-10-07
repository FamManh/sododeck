import type { Severity, TouchAccess } from '@sododeck/model';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { CircleX, KeyRound, Link2, ListOrdered, TriangleAlert } from 'lucide-react';
import { memo, type MouseEvent as ReactMouseEvent } from 'react';

import { EMPTY_SELECTION, useUiStore } from '../../state/ui-store';
import { refuseLocked } from '../lock';
import { rowKey } from '../relationships/row-key';
import { startColumnDrag } from '../editing/column-connect-drag';
import type { RelSide } from '../relationships/relationship-ends';
import { matchOrder, TABLE_CARD, type KeyGlyph, type TableLayout } from '../table-layout';
import { AccessMarker } from './access-marker';
import { ColumnLineEditor } from './column-line-editor';
import { EnumChip } from './enum-chip';
import { RowGrip } from './row-grip';
import { ShowAllButton } from './show-all-button';
import type { ProblemMark } from '../problems/problem-marks';
import { blurTarget, enterTarget } from './db-hover';
import { NoteIcon } from './note-icon';
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

/**
 * A problem on a row (047): the alert glyph takes the key glyph's place. Shape (circle-x or
 * triangle) and name carry the severity as well as colour; the native title is the tooltip.
 */
function ProblemRowGlyph({ severity, text }: { severity: Severity; text: string | undefined }) {
  const Icon = severity === 'error' ? CircleX : TriangleAlert;
  const name = text ?? (severity === 'error' ? 'Error' : 'Warning');
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={cn(
        'flex size-3.5 shrink-0 items-center justify-center',
        severity === 'error' ? 'text-clay-ink' : 'text-amber-ink',
      )}
    >
      <Icon aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
    </span>
  );
}

const TYPE_MAX = `${String(TABLE_CARD.typeShare * 100)}%`;

/** Opens the row menu (043 R8) at the pointer, the table selected. */
function openRowMenu(event: ReactMouseEvent<HTMLElement>, tableId: string, columnId: string) {
  event.preventDefault();
  event.stopPropagation();
  const ui = useUiStore.getState();
  const ids = { ...EMPTY_SELECTION, nodes: [tableId] };
  ui.select(ids);
  ui.focus(tableId);
  ui.openContextMenu({
    target: { kind: 'row', ids, row: { tableId, columnId } },
    point: { x: event.clientX, y: event.clientY },
    via: 'pointer',
    returnFocus: event.currentTarget,
  });
}

/**
 * A row's connection port (042 R9, FR-001): an 8 px dot centred on the card side with a 24 px hit
 * area, shown by CSS on row hover, during a relationship drag and for a selected relationship's
 * rows. A press starts the drag; it is reached from the keyboard through row focus and C.
 */
function RowPort({
  nodeId,
  columnId,
  name,
  side,
}: {
  nodeId: string;
  columnId: string;
  name: string;
  side: RelSide;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={`Connect ${name}`}
      data-port-side={side}
      className={cn(
        'sd-row-port nodrag nopan absolute top-0 flex size-6 cursor-crosshair items-center justify-center opacity-0 group-hover/row:opacity-100',
        side === 'left' ? '-left-4' : '-right-4',
      )}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        // The port, not the card: no node drag, no selection change.
        event.preventDefault();
        event.stopPropagation();
        startColumnDrag(event, { tableId: nodeId, columnId }, side);
      }}
    >
      <span className="size-2 rounded-full border-[1.5px] border-deck-orange bg-surface" />
    </button>
  );
}

/**
 * A table card's column list (041, frame 156): the hairline, one fixed 24 px row per column, the
 * "+n columns" pill and the footer, exactly as `tableLayout` measured them. Rows are plain
 * elements with a CSS hover: no per-row component state. A row with hidden information
 * (`data-db-hover`, 064) opens the column popover on hover (delegated by the canvas) or focus
 * rest; a row with a note shows the note icon after its name.
 *
 * Editing (043): the open line editor takes an edited row's place or the new-row slot the layout
 * reserved (`newRowIndex`); a row drag draws its drop line. Double-click edits a row, right-click opens the row menu.
 *
 * Playback (049): rows the current flow step touches are tinted and carry an R / W marker just
 * outside the card's left edge (a letter in a shape, so read and write differ without colour);
 * the row's name says "reads" / "writes".
 */
export const TableBody = memo(function TableBody({
  nodeId,
  layout,
  focused,
  tinted = false,
  locked = false,
  touched,
  problems,
}: {
  nodeId: string;
  layout: TableLayout;
  /** The card holds the canvas's Tab stop: its chips join the tab order (roving). */
  focused: boolean;
  /** The card has a colour fill: type text uses Secondary for contrast (§g-90). */
  tinted?: boolean;
  /** A locked table (043): no grip, no editing; rows still highlight and connect. */
  locked?: boolean;
  /** Flow mode (049): the columns the current step reads or writes. */
  touched?: ReadonlyMap<string, TouchAccess> | undefined;
  /**
   * The table's problem mark (047): a row with a problem draws its severity glyph in place of the
   * key glyphs. It rides on the node's data, not on the layout, so a problem change never
   * re-measures every table.
   */
  problems?: ProblemMark | undefined;
}) {
  // This table's line editor and row drag only: other tables never re-render for them.
  const columnEdit = useUiStore((s) => (s.columnEdit?.tableId === nodeId ? s.columnEdit : null));
  const rowDrag = useUiStore((s) => (s.rowDrag?.tableId === nodeId ? s.rowDrag : null));
  const filterIndex = useUiStore((s) =>
    s.tableFilter?.tableId === nodeId ? s.tableFilter.index : -1,
  );
  if (!layout.hasBody) return null;
  // The filter's matches (048): the current one is the one Enter stepped to.
  const matches = layout.matchIds.size === 0 ? [] : matchOrder(layout);
  const currentMatch = matches[Math.min(filterIndex, matches.length - 1)];
  const tabIndex = focused ? 0 : -1;
  const muted = tinted ? 'text-ink-secondary' : 'text-ink-muted group-hover/row:text-ink-secondary';
  const footerParts = [
    layout.hidden?.kind === 'all' ? `${String(layout.hidden.count)} columns` : undefined,
    layout.footer,
  ].filter((part) => part !== undefined);
  const count = layout.rows.length;
  const editor = (edit: NonNullable<typeof columnEdit>, key: string) => (
    <ColumnLineEditor key={key} edit={edit} keySlot={layout.keySlot} keyGap={TABLE_CARD.keyGap} />
  );
  // A new row sits in the slot the layout made for it (the end when the projection has none yet).
  const newRow =
    columnEdit !== null && columnEdit.columnId === null
      ? {
          at: layout.newRowIndex ?? count,
          // A fresh editor per slot: after ⏎ the next new row starts empty and focused.
          element: editor(columnEdit, `new-row:${String(columnEdit.at ?? count)}`),
        }
      : null;
  const dragFrom =
    rowDrag === null ? -1 : layout.rows.findIndex((row) => row.columnId === rowDrag.columnId);
  const dropTop =
    rowDrag === null || dragFrom < 0
      ? undefined
      : (rowDrag.overIndex <= dragFrom ? rowDrag.overIndex : rowDrag.overIndex + 1) *
        TABLE_CARD.rowHeight;

  const items = layout.rows.flatMap((row, index) => {
    const before = newRow?.at === index ? [newRow.element] : [];
    if (columnEdit?.columnId === row.columnId) {
      return [...before, editor(columnEdit, `edit:${row.columnId}`)];
    }
    const access = touched?.get(row.columnId);
    const severity = problems?.rows.get(row.columnId);
    return [
      ...before,
      <li
        key={row.columnId}
        aria-label={
          access === undefined
            ? rowLabel(row)
            : `${rowLabel(row)}, ${access === 'write' ? 'writes' : 'reads'}`
        }
        data-touch-access={access}
        aria-posinset={index + 1}
        aria-setsize={count}
        data-column-id={row.columnId}
        data-db-hover={row.hidden ? '' : undefined}
        data-row={rowKey(nodeId, row.columnId)}
        data-match={layout.matchIds.has(row.columnId) ? 'true' : undefined}
        aria-current={filterIndex >= 0 && currentMatch === row.columnId ? 'true' : undefined}
        // Roving row focus (042 R9): ↓ / ↑ from the focused table, never a Tab stop.
        tabIndex={-1}
        onFocus={(event) => {
          useUiStore.getState().setFocusedRow({ tableId: nodeId, columnId: row.columnId });
          if (row.hidden && event.target === event.currentTarget) {
            enterTarget({ kind: 'column', nodeId, columnId: row.columnId }, 'keyboard');
          }
        }}
        onBlur={(event) => {
          blurTarget();
          const next = event.relatedTarget;
          if (next instanceof Element && next.closest('[data-row], [data-line-editor]') !== null)
            return;
          useUiStore.getState().setFocusedRow(null);
        }}
        onDoubleClick={(event) => {
          // A row edits its column (043 FR-007), never the card title underneath.
          event.stopPropagation();
          if (locked) {
            refuseLocked();
            return;
          }
          useUiStore
            .getState()
            .startColumnEdit({ tableId: nodeId, columnId: row.columnId, select: 'name' });
        }}
        onContextMenu={(event) => {
          openRowMenu(event, nodeId, row.columnId);
        }}
        className={cn(
          'group/row relative -mx-[9px] flex h-6 shrink-0 items-center rounded-row px-[9px] outline-none hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary',
          rowDrag?.columnId === row.columnId && 'bg-surface-2 opacity-60',
          access !== undefined && 'bg-deck-orange-soft hover:bg-deck-orange-soft',
          layout.matchIds.has(row.columnId) && 'bg-deck-orange-soft',
          filterIndex >= 0 && currentMatch === row.columnId && 'ring-1 ring-deck-orange-ink',
        )}
      >
        {access !== undefined && (
          <AccessMarker
            access={access}
            className="pointer-events-none absolute top-[5px] -left-[19px]"
          />
        )}
        <RowPort nodeId={nodeId} columnId={row.columnId} name={row.name} side="left" />
        {!locked && (
          <RowGrip
            tableId={nodeId}
            columnId={row.columnId}
            name={row.name}
            index={index}
            count={count}
          />
        )}
        <span
          className="flex shrink-0 items-center gap-0.5"
          style={{ width: layout.keySlot, marginRight: TABLE_CARD.keyGap }}
        >
          {severity === undefined ? (
            row.glyphs.map((glyph) => <Glyph key={glyph} glyph={glyph} />)
          ) : (
            <ProblemRowGlyph severity={severity} text={problems?.rowText.get(row.columnId)} />
          )}
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-1">
          <span
            className={cn(
              'min-w-0 truncate text-[12px] leading-6 text-ink',
              row.glyphs.includes('pk') ? 'font-semibold' : 'font-medium',
              layout.matchIds.has(row.columnId) && 'font-semibold text-deck-orange-ink',
            )}
          >
            {row.name}
          </span>
          {row.hasNote && (
            <NoteIcon
              target={{ kind: 'column', nodeId, columnId: row.columnId }}
              name={row.name}
              size={12}
            />
          )}
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
        <RowPort nodeId={nodeId} columnId={row.columnId} name={row.name} side="right" />
      </li>,
    ];
  });
  if (newRow !== null && newRow.at >= count) items.push(newRow.element);

  return (
    <div data-testid="table-body" className="relative flex shrink-0 flex-col">
      {/* The one hairline above the list, in the middle of the 8 px gap (frame 156). */}
      <span aria-hidden className="absolute inset-x-0 -top-1 h-px bg-hairline" />
      {items.length > 0 && (
        <ul aria-label="Columns" className="relative flex flex-col">
          {items}
          {dropTop !== undefined && (
            <li
              aria-hidden
              data-testid="row-drop-line"
              className="pointer-events-none absolute inset-x-0 h-0.5 rounded-full bg-primary ring-2 ring-primary-soft"
              style={{ top: dropTop - 1 }}
            />
          )}
        </ul>
      )}
      {layout.hidden?.kind === 'more' && (
        <span
          role="img"
          aria-label={`+${String(layout.hidden.count)} columns hidden`}
          className={cn(
            'flex h-6 shrink-0 items-center justify-center rounded-row border-[1.5px] border-dashed border-border-strong text-[11.5px] font-medium text-ink-secondary',
            items.length > 0 && 'mt-1.5',
          )}
        >
          +{layout.hidden.count} columns
        </span>
      )}
      {layout.button !== undefined && (
        <ShowAllButton
          nodeId={nodeId}
          label={layout.button.label}
          expanded={layout.button.expanded}
          tabIndex={tabIndex}
          withGap={items.length > 0}
        />
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
