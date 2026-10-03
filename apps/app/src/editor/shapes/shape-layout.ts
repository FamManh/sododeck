/**
 * A shape's box and title lines (031 R3): the shape analogue of `cardLayout`, read through
 * `canvas-geometry.ts`'s `cardLayoutOf` so groups, snapping, resize and export all agree. A shape
 * never grows with its content: its size is the stored one (clamped) or its default, and the
 * title wraps inside `titleBox`, cut at what fits (at most 3 lines).
 */
import type { Geometry } from '@sododeck/model';
import type { Size } from '@sododeck/schema';

import { textMeasurer } from '../card-tags';
import { wrapText, type CardLayout } from '../card-layout';
import type { TextMeasurer } from '../export/text-measure';
import { defaultSize, minSize, SHAPE_TITLE_FONT, titleBox, titleLineRoom } from './shape-geometry';

/** The largest size any node may be drawn at (shared with cards, 017). */
export const SHAPE_MAX = { width: 800, height: 600 } as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** A shape's drawn size: the stored size within its limits, or its default. */
export function shapeSize(geometry: Geometry, stored: Size | undefined): Size {
  if (stored === undefined) return defaultSize(geometry);
  const min = minSize(geometry);
  return {
    width: clamp(stored.width, min.width, SHAPE_MAX.width),
    height: clamp(stored.height, min.height, SHAPE_MAX.height),
  };
}

/** The lines of `title` as the shape draws them (the export draws these same lines). */
export function shapeTitleLines(
  geometry: Geometry,
  size: Size,
  title: string,
  measure: TextMeasurer = textMeasurer(),
): readonly string[] {
  const box = titleBox(geometry, { x: 0, y: 0, ...size });
  return wrapText(title, box.width, SHAPE_TITLE_FONT, measure);
}

export function shapeLayout(
  geometry: Geometry,
  node: { title?: string | undefined; size?: Size | undefined },
  measure: TextMeasurer = textMeasurer(),
): CardLayout {
  const size = shapeSize(geometry, node.size);
  const natural = Math.max(1, shapeTitleLines(geometry, size, node.title ?? '', measure).length);
  const titleLines = Math.min(natural, titleLineRoom(geometry, size));
  return {
    ...size,
    titleLines,
    titleCut: natural > titleLines,
    descriptionLines: 0,
    tagRows: 0,
    hasChildrenRow: false,
    // Shapes keep typed fields in the drawer only (032).
    fieldsHeight: 0,
  };
}
