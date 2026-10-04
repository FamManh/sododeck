import { cn } from '@sododeck/ui/lib/utils';
import type { CSSProperties } from 'react';

import { chipColours } from '../tags/tag-colours';
import type { TableRow } from '../table-layout';

type Chip = NonNullable<TableRow['enum']>;

/**
 * An enum column's type (041 FR-007): the enum name as a chip in the enum's colour, the tag chip
 * look (033); neutral when the enum has no colour. A button, so its values open from the keyboard.
 */
export function EnumChip({
  chip,
  tabIndex,
  maxWidth,
}: {
  chip: Chip;
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
      tabIndex={tabIndex}
      data-enum-id={chip.id}
      style={style}
      className={cn(
        // `nodrag nopan`: a press on the chip is not a card drag (like 032's "+N fields").
        'nodrag nopan ml-2 h-[18px] shrink-0 truncate rounded-full px-1.5 font-mono text-[11px] leading-[18px]',
        'bg-(--enum-chip,var(--color-surface-2)) text-(--enum-ink,var(--color-ink-secondary))',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
      )}
    >
      {chip.name}
    </button>
  );
}
