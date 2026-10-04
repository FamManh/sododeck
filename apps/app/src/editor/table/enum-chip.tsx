import { cn } from '@sododeck/ui/lib/utils';
import type { CSSProperties } from 'react';

import { useUiStore } from '../../state/ui-store';
import { chipColours } from '../tags/tag-colours';
import type { TableRow } from '../table-layout';
import { cancelEnumHover, enterChip, leaveEnum } from './enum-hover';

type Chip = NonNullable<TableRow['enum']>;

/**
 * An enum column's type (041 FR-007, FR-011): the enum name as a chip in the enum's colour, the
 * tag chip look (033), neutral when the enum has no colour. Resting on it shows the values; Enter
 * or a click opens them as a dialog. The one popover is `EnumPopover`, never one per chip (R7).
 */
export function EnumChip({
  chip,
  nodeId,
  columnId,
  tabIndex,
  maxWidth,
}: {
  chip: Chip;
  nodeId: string;
  columnId: string;
  tabIndex: number;
  maxWidth: string;
}) {
  const colours = chip.color === undefined ? undefined : chipColours(chip.color);
  const style = {
    maxWidth,
    ...(colours === undefined ? {} : { '--enum-chip': colours.chip, '--enum-ink': colours.ink }),
  } as CSSProperties;
  return (
    <button
      type="button"
      aria-label={`${chip.name} values`}
      aria-haspopup="dialog"
      tabIndex={tabIndex}
      data-enum-column={columnId}
      style={style}
      onMouseEnter={() => {
        enterChip({ nodeId, columnId });
      }}
      onMouseLeave={leaveEnum}
      onMouseDown={(event) => {
        // A press on the chip is not a card drag or a selection (like 032's "+N fields").
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        cancelEnumHover();
        useUiStore.getState().openEnumPopover({ nodeId, columnId, source: 'keyboard' });
      }}
      className={cn(
        'nodrag nopan ml-2 h-[18px] shrink-0 truncate rounded-full px-1.5 font-mono text-[11px] leading-[18px]',
        'bg-(--enum-chip,var(--color-surface-2)) text-(--enum-ink,var(--color-ink-secondary))',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
      )}
    >
      {chip.name}
    </button>
  );
}
