import { cardType, typeName } from '@sododeck/model';
import type { ResolvedIcon } from '@sododeck/ui/icon-sets';
import { TypeTile } from '@sododeck/ui/components/type-tile';
import { cn } from '@sododeck/ui/lib/utils';

import { TypeGlyph } from './type-glyph';

type TileSize = 22 | 28 | 30 | 40;

/** Radius and glyph size per tile size, as `TypeTile` draws them. */
const SIZE_MAP: Record<TileSize, { radius: number; icon: number }> = {
  22: { radius: 7, icon: 15 },
  28: { radius: 8, icon: 20 },
  30: { radius: 9, icon: 20 },
  40: { radius: 12, icon: 26 },
};

/**
 * The tile of any node type: `TypeTile` (icon) for a card type, a 20 px mini outline for a shape
 * type (031). Use it wherever the app draws a type's tile, so shapes never show the fallback icon.
 */
export function NodeTypeTile({
  type,
  size = 30,
  decorative = false,
  label,
  icon: custom,
  className,
}: {
  /** A type id; null or unknown → the fallback tile. */
  type: string | null;
  size?: TileSize;
  decorative?: boolean;
  label?: string;
  /** The node's resolved icon (038); a card type draws it, a shape type ignores it. */
  icon?: ResolvedIcon;
  className?: string;
}) {
  if (type === null || cardType(type)?.family !== 'shape') {
    return (
      <TypeTile
        type={type}
        size={size}
        decorative={decorative}
        className={className}
        {...(custom === undefined ? {} : { icon: custom })}
        {...(label === undefined ? {} : { label })}
      />
    );
  }
  const { radius, icon } = SIZE_MAP[size];
  return (
    <span
      data-slot="type-tile"
      data-type={type}
      data-size={size}
      {...(decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': label ?? typeName(type) })}
      className={cn(
        'inline-flex shrink-0 items-center justify-center bg-surface-2 text-ink-secondary',
        className,
      )}
      style={{ width: size, height: size, borderRadius: radius }}
    >
      <TypeGlyph kind={type} size={icon} />
    </span>
  );
}
