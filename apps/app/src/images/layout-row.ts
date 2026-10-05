/** Space between pictures added together (contracts/ui.md: 16 px). */
export const ROW_GAP = 16;

interface Size {
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

/**
 * Top-left corners for pictures added together (055 US2): left to right from `origin`, a 16 px
 * gap apart, wrapping to a new line when the next one would pass `maxWidth`. Lines are as tall as
 * their tallest picture, so nothing overlaps. One picture too wide for a line gets a line to itself.
 */
export function layoutRow(
  sizes: readonly Size[],
  origin: Point,
  maxWidth: number,
  gap: number = ROW_GAP,
): Point[] {
  const points: Point[] = [];
  let x = 0;
  let y = 0;
  let lineHeight = 0;
  for (const size of sizes) {
    if (x > 0 && x + size.width > maxWidth) {
      x = 0;
      y += lineHeight + gap;
      lineHeight = 0;
    }
    points.push({ x: origin.x + x, y: origin.y + y });
    x += size.width + gap;
    lineHeight = Math.max(lineHeight, size.height);
  }
  return points;
}

/** The box around `sizes` laid out by `layoutRow`, to centre the block on a point. */
export function blockSize(sizes: readonly Size[], maxWidth: number, gap: number = ROW_GAP): Size {
  const points = layoutRow(sizes, { x: 0, y: 0 }, maxWidth, gap);
  let width = 0;
  let height = 0;
  sizes.forEach((size, index) => {
    const at = points[index];
    if (at === undefined) return;
    width = Math.max(width, at.x + size.width);
    height = Math.max(height, at.y + size.height);
  });
  return { width, height };
}
