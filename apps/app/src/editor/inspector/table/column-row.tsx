import type { DbColumn, Node, SododeckFile } from '@sododeck/schema';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { ChevronDown, ChevronRight, GripVertical, KeyRound, Link2 } from 'lucide-react';
import type { HTMLAttributes, KeyboardEvent } from 'react';

import { useUiStore } from '../../../state/ui-store';
import { typeText } from '../../table-layout';
import { ColumnFields } from './column-fields';

/** What the row says to a screen reader: the badge text is read too, as words. */
const spoken = (column: DbColumn, key: boolean, link: boolean) =>
  [
    column.name,
    typeText(column).trim(),
    key ? 'primary key' : null,
    link ? 'foreign key' : null,
    column.notNull === true ? 'not null' : null,
  ]
    .filter((part) => part !== null && part !== '')
    .join(', ');

/**
 * One column of the Columns tab (frame 164): grip, key or link glyph, name, type, a not-null
 * badge and a chevron; the row expands in place to `ColumnFields`. ⏎ / Space expand it, ⌥↑ / ⌥↓
 * move it (`rowProps` from the sortable list) and ⌫ deletes it.
 */
export function ColumnRow({
  deck,
  node,
  column,
  foreignKey,
  expanded,
  dragging,
  dropTarget,
  rowProps,
  gripProps,
  onDelete,
}: {
  deck: SododeckFile;
  node: Node;
  column: DbColumn;
  foreignKey: boolean;
  expanded: boolean;
  dragging: boolean;
  dropTarget: boolean;
  rowProps: HTMLAttributes<HTMLElement>;
  gripProps: HTMLAttributes<HTMLElement>;
  onDelete: () => void;
}) {
  const expandColumn = useUiStore((s) => s.expandColumn);
  const panelId = `column-panel-${column.id}`;
  const key = column.pk === true;
  const Chevron = expanded ? ChevronDown : ChevronRight;
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      onDelete();
    }
  };
  return (
    <li
      data-column-row={column.id}
      className={cn(
        'rounded-row border border-transparent',
        expanded && 'border-border bg-surface',
        dragging && 'opacity-50',
        dropTarget && 'border-primary',
      )}
    >
      <div {...rowProps} className="flex items-center gap-1 pr-1.5">
        <span
          {...gripProps}
          className="flex h-8 w-5 shrink-0 cursor-grab items-center justify-center text-ink-muted"
        >
          <GripVertical aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
        </span>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={expanded ? panelId : undefined}
          aria-label={spoken(column, key, foreignKey)}
          onClick={() => {
            expandColumn(expanded ? null : column.id);
          }}
          onKeyDown={onKeyDown}
          className={cn(
            'flex h-8 min-w-0 flex-1 items-center gap-2 rounded-row px-1 text-left text-body text-ink hover:bg-surface-2',
            focusRing,
          )}
        >
          <span
            aria-hidden
            className="flex size-4 shrink-0 items-center justify-center text-ink-muted"
          >
            {key ? (
              <KeyRound strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
            ) : foreignKey ? (
              <Link2 strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
            ) : null}
          </span>
          <span className="truncate font-medium">{column.name}</span>
          <span className="ml-auto shrink-0 truncate font-mono text-caption text-ink-secondary">
            {typeText(column)}
          </span>
          {column.notNull === true && (
            <span
              aria-hidden
              className="shrink-0 rounded-segment bg-surface-2 px-1 text-micro text-ink-secondary"
            >
              NN
            </span>
          )}
          <Chevron
            aria-hidden
            strokeWidth={ICON_STROKE_WIDTH}
            className="size-4 shrink-0 text-ink-muted"
          />
        </button>
      </div>
      {expanded && (
        <div id={panelId}>
          <ColumnFields deck={deck} node={node} column={column} />
        </div>
      )}
    </li>
  );
}
