import { cardType } from '@sododeck/model';
import { IconGlyph } from '@sododeck/ui/components/icon-glyph';
import type { ResolvedIcon } from '@sododeck/ui/icon-sets';
import { ICON_STROKE_WIDTH, typeStyle } from '@sododeck/ui/lib/icons';
import { Type } from 'lucide-react';

import { defaultSize, shapePath } from './shape-geometry';

/**
 * A type's glyph at icon size: the type's icon for a card type, a mini outline of the geometry
 * for a shape type (031 contract: lucide has no parallelogram, and a shape's tile should look
 * like the shape). The text shape shows a "T". Drawn in `currentColor`.
 */
export function TypeGlyph({
  kind,
  size,
  icon,
  className,
}: {
  kind: string;
  size: number;
  /** A resolved icon (038) drawn instead of the type's own; shapes ignore it. */
  icon?: ResolvedIcon;
  className?: string;
}) {
  const type = cardType(kind);
  const geometry = type?.family === 'shape' ? type.geometry : undefined;
  if (geometry === undefined) {
    if (icon)
      return (
        <IconGlyph
          icon={icon}
          size={size}
          strokeWidth={ICON_STROKE_WIDTH}
          {...(className === undefined ? {} : { className })}
        />
      );
    const Icon = typeStyle(kind).icon;
    return <Icon aria-hidden size={size} strokeWidth={ICON_STROKE_WIDTH} className={className} />;
  }
  if (geometry === 'none') {
    return <Type aria-hidden size={size} strokeWidth={ICON_STROKE_WIDTH} className={className} />;
  }
  // The shape's own proportions, fitted inside the icon box with room for the stroke.
  const natural = defaultSize(geometry);
  const room = size - 2;
  const scale = Math.min(room / natural.width, room / natural.height);
  const width = natural.width * scale;
  const height = natural.height * scale;
  const { outline, extra } = shapePath(geometry, {
    x: (size - width) / 2,
    y: (size - height) / 2,
    width,
    height,
  });
  return (
    <svg
      aria-hidden
      data-testid="shape-glyph"
      data-geometry={geometry}
      width={size}
      height={size}
      viewBox={`0 0 ${String(size)} ${String(size)}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={ICON_STROKE_WIDTH}
      strokeLinejoin="round"
      strokeLinecap="round"
      className={className}
    >
      <path d={outline} />
      {extra !== undefined && <path d={extra} />}
    </svg>
  );
}
