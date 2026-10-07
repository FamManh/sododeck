import type { DbColumn, SododeckFile } from '@sododeck/schema';
import { Button } from '@sododeck/ui/components/button';
import { Popover, PopoverAnchor, PopoverContent } from '@sododeck/ui/components/popover';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { BookOpen, Columns3, Table2 } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

import { useUiStore, type DbPopover as Target } from '../../state/ui-store';
import { blurTarget, enterPopover, leaveTarget } from './db-hover';
import { columnConstraints, columnSummary, fullType } from './table-text';

type Node = SododeckFile['nodes'][number];

/** The live element a popover is anchored to: the row or the table title (it may re-render). */
function anchorElement(target: Target): HTMLElement | null {
  const card = `[data-node-id="${CSS.escape(target.nodeId)}"]`;
  return document.querySelector<HTMLElement>(
    target.kind === 'column'
      ? `${card} [data-column-id="${CSS.escape(target.columnId ?? '')}"]`
      : `${card} [data-table-title]`,
  );
}

interface Resolved {
  table: Node;
  column: DbColumn | undefined;
}

/** The table and column the popover names, read from the deck by id (no copied data). */
function resolve(deck: SododeckFile, target: Target): Resolved | undefined {
  const table = deck.nodes.find((node) => node.id === target.nodeId);
  if (table === undefined) return undefined;
  if (target.kind === 'table') {
    return (table.description ?? '').trim() === '' ? undefined : { table, column: undefined };
  }
  const column = table.columns?.find((c) => c.id === target.columnId);
  return column === undefined ? undefined : { table, column };
}

/**
 * The one column / table note popover of the canvas (064 US1, US2): beside the hovered row or
 * title, the name, the full type and constraints of a column, and the note as plain text. Mounted
 * once next to the enum popover; renders nothing while closed, and closes itself when its column
 * or table is removed.
 */
export function DbPopover({ deck }: { deck: SododeckFile }) {
  const target = useUiStore((s) => s.dbPopover);
  const resolved = target === null ? undefined : resolve(deck, target);
  const missing = target !== null && resolved === undefined;
  useEffect(() => {
    if (missing) useUiStore.getState().closeDbPopover();
  }, [missing]);
  if (target === null || resolved === undefined) return null;
  return (
    <DbPopoverContent
      key={`${target.kind}:${target.nodeId}:${target.columnId ?? ''}`}
      target={target}
      deck={deck}
      resolved={resolved}
    />
  );
}

function DbPopoverContent({
  target,
  deck,
  resolved,
}: {
  target: Target;
  deck: SododeckFile;
  resolved: Resolved;
}) {
  const close = useUiStore((s) => s.closeDbPopover);
  const openTableDrawer = useUiStore((s) => s.openTableDrawer);
  const virtualRef = useRef({
    getBoundingClientRect: () => anchorElement(target)?.getBoundingClientRect() ?? new DOMRect(),
  });
  const { table, column } = resolved;
  const note = (column === undefined ? table.description : column.note)?.trim() ?? '';
  const constraints = column === undefined ? [] : columnConstraints(deck, table.id, column);
  const name = column?.name ?? table.title;
  // A focus rest opens without moving focus, so the content is read out once (FR-009).
  const spoken =
    column === undefined ? `${table.title}, note: ${note}` : columnSummary(deck, table.id, column);
  const keyboard = target.source === 'keyboard';
  useEffect(() => {
    if (keyboard) useUiStore.getState().announce(spoken);
    // Once per open: the component is keyed by its target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <PopoverAnchor virtualRef={virtualRef} />
      <PopoverContent
        aria-label={`${column === undefined ? 'Table' : 'Column'} ${name}`}
        data-db-popover=""
        side="right"
        align="start"
        collisionPadding={8}
        className="w-auto max-w-80 min-w-56 gap-2 p-3"
        onPointerEnter={enterPopover}
        onPointerMove={enterPopover}
        onPointerLeave={leaveTarget}
        onOpenAutoFocus={(event) => {
          // Hover and focus rest show the details without taking focus from where the user is.
          if (target.source !== 'click') event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          // A note icon toggles or switches the popover itself.
          if (event.target instanceof Element && event.target.closest('[data-note-icon]') !== null)
            event.preventDefault();
        }}
        onEscapeKeyDown={() => {
          blurTarget();
        }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {column === undefined ? (
            <Table2
              aria-hidden
              strokeWidth={ICON_STROKE_WIDTH}
              className="size-3.5 shrink-0 text-ink-muted"
            />
          ) : (
            <Columns3
              aria-hidden
              strokeWidth={ICON_STROKE_WIDTH}
              className="size-3.5 shrink-0 text-ink-muted"
            />
          )}
          <span className="min-w-0 truncate text-[13px] font-semibold text-ink">{name}</span>
          {column !== undefined && (
            <span className="min-w-0 truncate font-mono text-[12px] text-primary-ink">
              {fullType(column, deck)}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open details"
            className="ml-auto shrink-0"
            onClick={() => {
              close();
              openTableDrawer(table.id, column === undefined ? undefined : { columnId: column.id });
            }}
          >
            <BookOpen aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
          </Button>
        </div>
        {constraints.length > 0 && (
          <ul aria-label="Constraints" className="flex flex-wrap gap-x-2 gap-y-0.5">
            {constraints.map((text) => (
              <li key={text} className="text-caption text-ink-secondary">
                {text}
              </li>
            ))}
          </ul>
        )}
        {note !== '' && <NoteSection>{note}</NoteSection>}
      </PopoverContent>
    </Popover>
  );
}

/** The note under a hairline: plain text, line breaks kept, scrolling past 200 px (FR-010). */
function NoteSection({ children }: { children: ReactNode }) {
  return (
    <>
      <span aria-hidden className="h-px bg-hairline" />
      <span className="text-[11px] font-semibold tracking-wide text-ink-muted uppercase">Note</span>
      <p
        tabIndex={-1}
        className="max-h-[200px] overflow-auto text-[12.5px] leading-[1.45] break-words whitespace-pre-wrap text-ink-secondary outline-none"
      >
        {children}
      </p>
    </>
  );
}
