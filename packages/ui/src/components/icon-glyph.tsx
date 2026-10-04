import type * as React from 'react';

import type { ResolvedIcon } from '@sododeck/ui/icon-sets';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';

type IconGlyphProps = Omit<React.ComponentProps<'svg'>, 'children' | 'width' | 'height'> & {
  icon: ResolvedIcon;
  /** Edge in px. */
  size?: number;
  strokeWidth?: number;
};

/**
 * A resolved icon as a plain, stateless `<svg>`. The canvas, the picker and the export all draw
 * the same geometry; `line` sets stroke `currentColor`, `solid` sets fill `currentColor`.
 */
function IconGlyph({ icon, size = 16, strokeWidth = ICON_STROKE_WIDTH, ...props }: IconGlyphProps) {
  const paint =
    icon.style === 'line'
      ? {
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth,
          strokeLinecap: 'round' as const,
          strokeLinejoin: 'round' as const,
        }
      : { fill: 'currentColor', stroke: 'none' };

  return (
    <svg
      data-slot="icon-glyph"
      data-icon={`${icon.set}:${icon.name}`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      {...paint}
      {...props}
    >
      {icon.node.map(([tag, attrs], index) => {
        const Shape = tag;
        return <Shape key={index} {...attrs} />;
      })}
    </svg>
  );
}

export { IconGlyph };
