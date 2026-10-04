import { cn } from '@sododeck/ui/lib/utils';

import type { TableLayout } from '../table-layout';

/** At most this many key dots; the count after them says the rest. */
const MAX_DOTS = 8;

/**
 * A table at System level (041 FR-013, frame 162): primary-key dots filled, foreign-key dots
 * hollow, then the column count, inside the same box as its rows.
 */
export function TableCompact({
  layout,
  textClass,
}: {
  layout: TableLayout;
  textClass: string | null;
}) {
  const { pkCount, fkCount, columnCount } = layout.compact;
  const pk = Math.min(pkCount, MAX_DOTS);
  const fk = Math.min(fkCount, MAX_DOTS - pk);
  const label = [
    pkCount > 0 ? `${String(pkCount)} primary ${pkCount === 1 ? 'key' : 'keys'}` : undefined,
    fkCount > 0 ? `${String(fkCount)} foreign ${fkCount === 1 ? 'key' : 'keys'}` : undefined,
    `${String(columnCount)} ${columnCount === 1 ? 'column' : 'columns'}`,
  ]
    .filter((part) => part !== undefined)
    .join(', ');
  return (
    <span
      role="img"
      aria-label={label}
      data-testid="table-compact"
      className={cn(
        'flex h-6 shrink-0 items-center gap-1.5 text-caption',
        textClass ?? 'text-ink-secondary',
      )}
    >
      {Array.from({ length: pk }, (_, i) => (
        <span key={`pk${String(i)}`} className="size-2 rounded-full bg-current" />
      ))}
      {Array.from({ length: fk }, (_, i) => (
        <span
          key={`fk${String(i)}`}
          className="size-2 rounded-full border-[1.5px] border-current"
        />
      ))}
      <span className={cn(pk + fk > 0 && 'ml-0.5')}>{columnCount}</span>
    </span>
  );
}
