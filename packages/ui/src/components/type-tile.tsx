import type * as React from 'react';

import { IconGlyph } from '@sododeck/ui/components/icon-glyph';
import type { ResolvedIcon } from '@sododeck/ui/icon-sets';
import { ICON_STROKE_WIDTH, typeStyle } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';

type TypeTileSize = 22 | 28 | 30 | 40;

/** Radius ≈ 0.3 × size, icon ≈ 0.6 × size (design-analysis §b "Kind tile"). */
const SIZE_MAP: Record<TypeTileSize, { radius: number; icon: number }> = {
  22: { radius: 7, icon: 13 },
  28: { radius: 8, icon: 17 },
  30: { radius: 9, icon: 18 },
  40: { radius: 12, icon: 24 },
};

type TypeTileProps = Omit<React.ComponentProps<'span'>, 'children'> & {
  /** A card type id; prototype aliases and any case are accepted; unknown → fallback tile. */
  type: string | null;
  /** The type's name for assistive technology (the caller has the registry); defaults to the id. */
  label?: string;
  size?: TypeTileSize;
  /** Hide from assistive technology when a visible label names the type already. */
  decorative?: boolean;
  /** A resolved icon (038) drawn instead of the type's own; the tone still comes from `type`. */
  icon?: ResolvedIcon;
};

/** Colored icon tile for a card type (canvas cards, Add flyout, inspector, search). */
function TypeTile({
  type,
  label,
  size = 30,
  decorative = false,
  icon: custom,
  className,
  style,
  ...props
}: TypeTileProps) {
  const { icon: Icon, tone } = typeStyle(type ?? '');
  const { radius, icon: iconSize } = SIZE_MAP[size];

  return (
    <span
      data-slot="type-tile"
      data-type={type ?? 'unknown'}
      data-size={size}
      {...(decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': label ?? type ?? '' })}
      className={cn('inline-flex shrink-0 items-center justify-center', tone, className)}
      // Sizes are numeric px from the design, not colors, so inline style keeps them exact.
      style={{ width: size, height: size, borderRadius: radius, ...style }}
      {...props}
    >
      {custom ? (
        <IconGlyph icon={custom} size={iconSize} strokeWidth={ICON_STROKE_WIDTH} />
      ) : (
        <Icon aria-hidden size={iconSize} strokeWidth={ICON_STROKE_WIDTH} />
      )}
    </span>
  );
}

export { TypeTile };
