import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { NotebookText } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import { cancelDbHover, type DbTarget } from './db-hover';

const sameTarget = (a: DbTarget | null, b: DbTarget) =>
  a !== null && a.kind === b.kind && a.nodeId === b.nodeId && a.columnId === b.columnId;

/**
 * The note icon after a column or table name (064 FR-005, FR-009a): a click or tap opens that
 * popover at once and a second one closes it. A press never selects the row or the table and never
 * starts a drag. Reached by pointer only: keyboard users get the popover from focus rest (FR-009).
 */
export function NoteIcon({
  target,
  name,
  size,
  textClass,
}: {
  target: DbTarget;
  name: string;
  size: 12 | 14;
  textClass?: string | null;
}) {
  const expanded = useUiStore((s) => sameTarget(s.dbPopover, target));
  return (
    <button
      type="button"
      aria-label={`Show note for ${name}`}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      tabIndex={-1}
      data-note-icon=""
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        cancelDbHover();
        const ui = useUiStore.getState();
        if (sameTarget(ui.dbPopover, target) && ui.dbPopover?.source === 'click') {
          ui.closeDbPopover();
        } else {
          ui.openDbPopover({ ...target, source: 'click' });
        }
      }}
      className={cn(
        'nodrag nopan inline-flex shrink-0 items-center justify-center rounded-[4px] hover:text-ink',
        expanded ? 'text-primary-ink' : (textClass ?? 'text-ink-muted'),
      )}
    >
      <NotebookText
        aria-hidden
        strokeWidth={ICON_STROKE_WIDTH}
        className={size === 12 ? 'size-3' : 'size-3.5'}
      />
    </button>
  );
}
