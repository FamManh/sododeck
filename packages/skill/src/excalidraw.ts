/**
 * An outline of a hand-drawn whiteboard file (`.excalidraw` JSON) for the `outline` command
 * (027, from-diagrams mode): the boards on it (its largest titles), every labelled shape, every
 * arrow with the labels it joins, and the free text. An agent reads this instead of a JSON file
 * that can be megabytes of coordinates and embedded pictures. Pure; never throws for odd input,
 * it skips what it cannot read.
 */

export interface OutlineShape {
  id: string;
  kind: string;
  label: string;
  x: number;
  y: number;
  fill?: string;
}

export interface OutlineArrow {
  id: string;
  from?: string;
  to?: string;
  label?: string;
  /** True when an end was matched to the nearest shape rather than bound in the file. */
  guessed?: boolean;
}

export interface OutlineText {
  text: string;
  x: number;
  y: number;
  size: number;
}

export interface OutlineBoard {
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Outline {
  report: 'sododeck-sketch-outline';
  reportVersion: 1;
  boards: OutlineBoard[];
  shapes: OutlineShape[];
  arrows: OutlineArrow[];
  texts: OutlineText[];
  counts: { shapes: number; arrows: number; texts: number; skipped: number };
}

interface Element {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  fontSize?: number;
  containerId?: string | null;
  backgroundColor?: string;
  points?: [number, number][];
  startBinding?: { elementId?: string } | null;
  endBinding?: { elementId?: string } | null;
}

const SHAPES = new Set(['rectangle', 'ellipse', 'diamond']);
/** How far an unbound arrow end may be from a shape and still count as touching it. */
const SNAP = 40;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asElement(raw: unknown): Element | undefined {
  if (!isRecord(raw) || raw.isDeleted === true) return undefined;
  const { id, type, x, y } = raw;
  if (typeof id !== 'string' || typeof type !== 'string') return undefined;
  if (typeof x !== 'number' || typeof y !== 'number') return undefined;
  return {
    ...(raw as unknown as Element),
    width: typeof raw.width === 'number' ? raw.width : 0,
    height: typeof raw.height === 'number' ? raw.height : 0,
  };
}

const clean = (text: string) => text.replace(/\s+/g, ' ').trim();
const round = (n: number) => Math.round(n);

export interface OutlineOptions {
  /** Keep only what lies inside this board (matched by title, case-insensitive substring). */
  board?: string;
  /** Free texts smaller than this are left out (scribbles, footnotes). Default 13. */
  minTextSize?: number;
}

const inside = (e: Pick<Element, 'x' | 'y'>, b: OutlineBoard) =>
  e.x >= b.x - 100 && e.x < b.x + b.width && e.y >= b.y - 50 && e.y < b.y + b.height;

/** Fewest shapes a titled area must hold to count as a board (not a large note). */
const BOARD_MIN_SHAPES = 8;

/**
 * Boards: one-line free texts set clearly larger than the body text, with the area each one
 * heads, kept only when that area holds a diagram (scribbled notes are large too).
 */
function findBoards(
  texts: readonly Element[],
  shapes: readonly Element[],
  allTexts: readonly Element[],
): OutlineBoard[] {
  // Body size: the median of every text, labels included.
  const sizes = allTexts.map((t) => t.fontSize ?? 0).sort((a, b) => a - b);
  const body = sizes[Math.floor(sizes.length / 2)] ?? 16;
  const titles = texts
    .filter((t) => {
      const text = t.text ?? '';
      return (
        (t.fontSize ?? 0) >= Math.max(24, body * 1.5) &&
        !text.trim().includes('\n') &&
        clean(text).length >= 4 &&
        clean(text).length <= 100
      );
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const boards = titles.map((title) => {
    // A board reaches right to the next title on roughly the same row, and down to the next
    // title that starts within its columns; only titles at least as large end it (a smaller one
    // heads a section inside). A lone title gets a generous default area.
    const right = titles
      .filter(
        (o) =>
          o !== title &&
          (o.fontSize ?? 0) >= (title.fontSize ?? 0) &&
          o.x > title.x + 50 &&
          Math.abs(o.y - title.y) < 600,
      )
      .reduce((min, o) => Math.min(min, o.x), title.x + 6000);
    const below = titles
      .filter(
        (o) =>
          o !== title &&
          (o.fontSize ?? 0) >= (title.fontSize ?? 0) &&
          o.y > title.y + 50 &&
          o.x >= title.x - 50 &&
          o.x < right,
      )
      .reduce((min, o) => Math.min(min, o.y), title.y + 8000);
    return {
      title: clean(title.text ?? ''),
      x: round(title.x),
      y: round(title.y),
      width: round(right - title.x),
      height: round(below - title.y),
    };
  });
  return boards.filter((b) => shapes.filter((e) => inside(e, b)).length >= BOARD_MIN_SHAPES);
}

export function outlineExcalidraw(input: unknown, options: OutlineOptions = {}): Outline {
  const rawElements = isRecord(input) && Array.isArray(input.elements) ? input.elements : [];
  let skipped = 0;
  const all: Element[] = [];
  for (const raw of rawElements) {
    const element = asElement(raw);
    if (element === undefined) skipped += 1;
    else all.push(element);
  }
  const allShapes = all.filter((e) => SHAPES.has(e.type));
  const freeTexts = all.filter((e) => e.type === 'text' && !e.containerId && clean(e.text ?? ''));
  const boards = findBoards(
    freeTexts,
    allShapes,
    all.filter((e) => e.type === 'text'),
  );
  const board =
    options.board === undefined
      ? undefined
      : boards.find((b) => b.title.toLowerCase().includes(options.board?.toLowerCase() ?? ''));
  const elements = board === undefined ? all : all.filter((e) => inside(e, board));

  const labels = new Map<string, string>();
  for (const e of all) {
    if (e.type === 'text' && typeof e.containerId === 'string' && e.text !== undefined) {
      const prior = labels.get(e.containerId);
      labels.set(e.containerId, clean(prior === undefined ? e.text : `${prior} ${e.text}`));
    }
  }
  const shapeElements = elements.filter((e) => SHAPES.has(e.type));
  // Many boards place a label as free text over a shape instead of binding it: such a text
  // labels the smallest shape that contains its centre, and stops being free text.
  const overlaid = new Set<string>();
  for (const text of elements) {
    if (text.type !== 'text' || text.containerId || text.text === undefined) continue;
    const cx = text.x + text.width / 2;
    const cy = text.y + text.height / 2;
    let host: Element | undefined;
    for (const shape of shapeElements) {
      if (cx < shape.x || cx > shape.x + shape.width || cy < shape.y || cy > shape.y + shape.height)
        continue;
      if (host === undefined || shape.width * shape.height < host.width * host.height) host = shape;
    }
    if (host === undefined) continue;
    const prior = labels.get(host.id);
    labels.set(host.id, clean(prior === undefined ? text.text : `${prior} ${text.text}`));
    overlaid.add(text.id);
  }
  const shapes: OutlineShape[] = shapeElements
    .filter((e) => labels.has(e.id))
    .map((e) => ({
      id: e.id,
      kind: e.type,
      label: labels.get(e.id) ?? '',
      x: round(e.x),
      y: round(e.y),
      ...(e.backgroundColor === undefined || e.backgroundColor === 'transparent'
        ? {}
        : { fill: e.backgroundColor }),
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const labelled = new Set(shapes.map((s) => s.id));
  const textById = new Map(all.map((e) => [e.id, e]));

  const nearest = (px: number, py: number): string | undefined => {
    let best: { id: string; d: number } | undefined;
    for (const s of shapeElements) {
      if (!labelled.has(s.id)) continue;
      const dx = Math.max(s.x - px, 0, px - (s.x + s.width));
      const dy = Math.max(s.y - py, 0, py - (s.y + s.height));
      const d = Math.hypot(dx, dy);
      if (d <= SNAP && (best === undefined || d < best.d)) best = { id: s.id, d };
    }
    return best?.id;
  };
  const endOf = (binding: Element['startBinding'], px: number, py: number) => {
    const bound = binding?.elementId;
    if (bound !== undefined) {
      const target = textById.get(bound);
      // An arrow bound to a shape's label text means the shape.
      const id =
        target?.type === 'text' && typeof target.containerId === 'string'
          ? target.containerId
          : bound;
      if (labelled.has(id)) return { id, guessed: false };
    }
    const id = nearest(px, py);
    return id === undefined ? undefined : { id, guessed: true };
  };

  const arrows: OutlineArrow[] = [];
  for (const e of elements) {
    if (e.type !== 'arrow') continue;
    const points = e.points ?? [];
    const first = points[0] ?? [0, 0];
    const last = points[points.length - 1] ?? [0, 0];
    const from = endOf(e.startBinding, e.x + first[0], e.y + first[1]);
    const to = endOf(e.endBinding, e.x + last[0], e.y + last[1]);
    const label = labels.get(e.id);
    if (from === undefined && to === undefined && label === undefined) continue;
    arrows.push({
      id: e.id,
      ...(from === undefined ? {} : { from: from.id }),
      ...(to === undefined ? {} : { to: to.id }),
      ...(label === undefined ? {} : { label }),
      ...(from?.guessed === true || to?.guessed === true ? { guessed: true } : {}),
    });
  }

  const minSize = options.minTextSize ?? 13;
  const texts: OutlineText[] = elements
    .filter(
      (e) =>
        e.type === 'text' && !e.containerId && !overlaid.has(e.id) && (e.fontSize ?? 0) >= minSize,
    )
    .map((e) => ({
      text: clean(e.text ?? ''),
      x: round(e.x),
      y: round(e.y),
      size: e.fontSize ?? 0,
    }))
    .filter((t) => t.text !== '')
    .sort((a, b) => a.y - b.y || a.x - b.x);

  return {
    report: 'sododeck-sketch-outline',
    reportVersion: 1,
    boards: board === undefined ? boards : [board],
    shapes,
    arrows,
    texts,
    counts: { shapes: shapes.length, arrows: arrows.length, texts: texts.length, skipped },
  };
}

export function outlineText(outline: Outline): string {
  const label = new Map(outline.shapes.map((s) => [s.id, s.label]));
  const name = (id: string | undefined) =>
    id === undefined ? '?' : `"${(label.get(id) ?? id).slice(0, 60)}"`;
  const lines = [`Boards (${String(outline.boards.length)}):`];
  for (const b of outline.boards) {
    lines.push(
      `  "${b.title}" at (${String(b.x)}, ${String(b.y)}), ${String(b.width)}×${String(b.height)}`,
    );
  }
  lines.push('', `Shapes (${String(outline.shapes.length)}):`);
  for (const s of outline.shapes) {
    const fill = s.fill === undefined ? '' : ` ${s.fill}`;
    lines.push(`  [${s.id}] ${s.kind}${fill} (${String(s.x)}, ${String(s.y)}): ${s.label}`);
  }
  lines.push('', `Arrows (${String(outline.arrows.length)}):`);
  for (const a of outline.arrows) {
    const text = a.label === undefined ? '' : ` "${a.label}"`;
    lines.push(
      `  ${name(a.from)} → ${name(a.to)}${text}${a.guessed === true ? ' (end guessed)' : ''}`,
    );
  }
  lines.push('', `Free text (${String(outline.texts.length)}):`);
  for (const t of outline.texts)
    lines.push(`  [${String(t.size)}px] (${String(t.x)}, ${String(t.y)}) ${t.text}`);
  return lines.join('\n');
}
