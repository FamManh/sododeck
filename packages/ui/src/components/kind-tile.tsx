import type * as React from 'react';

import {
  ICON_STROKE_WIDTH,
  KIND_FALLBACK,
  KIND_STYLE,
  type ComponentKind,
  toComponentKind,
} from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';

type KindTileSize = 22 | 28 | 30 | 40;

/** Radius ≈ 0.3 × size, icon ≈ 0.6 × size (design-analysis §b "Kind tile"). */
const SIZE_MAP: Record<KindTileSize, { radius: number; icon: number }> = {
  22: { radius: 7, icon: 13 },
  28: { radius: 8, icon: 17 },
  30: { radius: 9, icon: 18 },
  40: { radius: 12, icon: 24 },
};

type KindTileProps = Omit<React.ComponentProps<'span'>, 'children'> & {
  /** One of the six kinds; prototype aliases and any case are accepted; unknown → fallback. */
  kind: ComponentKind | (string & {}) | null;
  size?: KindTileSize;
  /** Hide from assistive technology when a visible label names the kind already. */
  decorative?: boolean;
};

/** Colored icon tile for a component kind (canvas nodes, palette, inspector, search). */
function KindTile({
  kind,
  size = 30,
  decorative = false,
  className,
  style,
  ...props
}: KindTileProps) {
  const resolved = kind === null ? null : toComponentKind(kind);
  const { icon: Icon, label, tone } = resolved ? KIND_STYLE[resolved] : KIND_FALLBACK;
  const { radius, icon } = SIZE_MAP[size];

  return (
    <span
      data-slot="kind-tile"
      data-kind={resolved ?? 'unknown'}
      data-size={size}
      {...(decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
      className={cn('inline-flex shrink-0 items-center justify-center', tone, className)}
      // Sizes are numeric px from the design, not colors, so inline style keeps them exact.
      style={{ width: size, height: size, borderRadius: radius, ...style }}
      {...props}
    >
      <Icon aria-hidden size={icon} strokeWidth={ICON_STROKE_WIDTH} />
    </span>
  );
}

export { KindTile };
