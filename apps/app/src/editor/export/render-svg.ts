import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';

import { DOT_RADIUS } from '../edge-constants';
import { exportTextColour, kindColours, stickyColours, type ExportPalette } from './export-palette';
import { ICON_PATHS, type IconNode } from './icon-paths';
import type { ExportScene, SceneCard, SceneEdge } from './scene';
import { truncate, type TextMeasurer } from './text-measure';

export interface SvgOptions {
  transparent: boolean;
  palette: ExportPalette;
  /** `@font-face` rules with data-URL sources (R4); never an external URL. */
  fonts: string;
  measure: TextMeasurer;
  /** The document title (the deck name). */
  title: string;
}

const SANS = "'Geist Variable', system-ui, sans-serif";
const MONO = "'Geist Mono Variable', ui-monospace, monospace";

/** Canvas fonts (DESIGN.md sizes), as CSS `font` shorthands for measuring. */
export const FONTS = {
  title: `500 12.5px ${SANS}`,
  subtitle: `11px ${MONO}`,
  caption: `11.5px ${SANS}`,
  group: `500 10.5px ${SANS}`,
  label: `10.5px ${MONO}`,
  badge: `500 10px ${MONO}`,
} as const;

const STYLE = [
  `.t{font:${FONTS.title}}`,
  `.s{font:${FONTS.subtitle}}`,
  `.c{font:${FONTS.caption}}`,
  `.g{font:${FONTS.group};letter-spacing:.07em}`,
  `.l{font:${FONTS.label}}`,
  `.b{font:${FONTS.badge}}`,
].join('');

const TILE = 30;
const PAD = 10;
const LABEL_HEIGHT = 20;
const BADGE = 16;
const BADGE_GAP = 4;

/** Escapes text and attribute values (`&`, `<`, `>`, `"`, `'`). */
export function escapeXml(value: string | number): string {
  return String(value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&apos;';
    }
  });
}

/** Rounds to two decimals so the file stays small and stable. */
function n(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function attrs(values: Record<string, string | number | undefined>): string {
  return Object.entries(values)
    .flatMap(([name, value]) =>
      value === undefined
        ? []
        : [`${name}="${escapeXml(typeof value === 'number' ? n(value) : value)}"`],
    )
    .join(' ');
}

function box(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke?: string,
  dash?: string,
): string {
  return `<rect ${attrs({ x, y, width, height, rx: radius, fill, stroke, 'stroke-dasharray': dash })}/>`;
}

function text(
  className: string,
  x: number,
  y: number,
  fill: string,
  value: string,
  anchor?: string,
): string {
  return `<text ${attrs({ class: className, x, y, fill, 'text-anchor': anchor })}>${escapeXml(value)}</text>`;
}

/** A lucide icon at `size` px, drawn like lucide-react (stroke 1.5, round caps and joins). */
function icon(nodes: IconNode, x: number, y: number, size: number, colour: string): string {
  const shapes = nodes.map(([tag, values]) => `<${tag} ${attrs(values)}/>`).join('');
  return `<g ${attrs({
    transform: `translate(${n(x)} ${n(y)}) scale(${n(size / 24)})`,
    fill: 'none',
    stroke: colour,
    'stroke-width': ICON_STROKE_WIDTH,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  })}>${shapes}</g>`;
}

function card(item: SceneCard, palette: ExportPalette, measure: TextMeasurer): string {
  const { x, y, width, height } = item.rect;
  const colours = kindColours(item.kind, palette);
  const ink = exportTextColour(item.text, palette);
  const subtitleInk = item.text === 'default' ? palette.inkMuted : ink;
  const rulesInk = item.text === 'default' ? palette.primaryInk : ink;
  const out: string[] = [`<g data-export="card" data-id="${escapeXml(item.id)}">`];
  out.push(
    box(x, y, width, height, 12, item.fill ?? palette.surface, item.stroke ?? palette.border),
  );
  // Every level draws the same compact card (§g-58).
  const tileY = y + (height - TILE) / 2;
  out.push(box(x + PAD, tileY, TILE, TILE, 9, colours.fill));
  out.push(icon(ICON_PATHS[item.kind], x + PAD + 6, tileY + 6, 18, colours.ink));

  // Right side, like the card's flex row: child-count pill, then the rules glyph.
  let right = x + width - PAD;
  const rowMiddle = tileY + TILE / 2;
  if (item.childCount > 0) {
    const count = String(item.childCount);
    const pillWidth = 6 + 12 + 4 + measure(count, FONTS.caption) + 6;
    right -= pillWidth;
    out.push(box(right, rowMiddle - 9, pillWidth, 18, 9, palette.surface2));
    out.push(icon(ICON_PATHS.children, right + 6, rowMiddle - 6, 12, palette.inkSecondary));
    out.push(text('c', right + 22, rowMiddle + 4, palette.inkSecondary, count));
    right -= 8;
  }
  if (item.hasRules) {
    right -= 14;
    out.push(icon(ICON_PATHS.rules, right, rowMiddle - 7, 14, rulesInk));
    right -= 8;
  }
  const textX = x + PAD + TILE + 9;
  const textWidth = Math.max(0, right - textX);
  const title = truncate(item.title, FONTS.title, textWidth, measure);
  if (item.subtitle === null || item.subtitle === '') {
    out.push(text('t', textX, rowMiddle + 4.5, ink, title));
  } else {
    out.push(text('t', textX, rowMiddle - 2, ink, title));
    const subtitle = truncate(item.subtitle, FONTS.subtitle, textWidth, measure);
    out.push(text('s', textX, rowMiddle + 12, subtitleInk, subtitle));
  }
  out.push('</g>');
  return out.join('');
}

function edgeStroke(edge: SceneEdge, palette: ExportPalette): { colour: string; width: number } {
  switch (edge.stroke) {
    case 'flow':
      return { colour: palette.primary, width: 2 };
    case 'flow-error':
      return { colour: palette.clayInk, width: 2 };
    case 'default':
      return { colour: palette.edge, width: 1.5 };
  }
}

function edge(item: SceneEdge, palette: ExportPalette, measure: TextMeasurer): string {
  const { colour, width } = edgeStroke(item, palette);
  const out: string[] = [`<g data-export="edge" data-id="${escapeXml(item.id)}">`];
  out.push(
    `<path ${attrs({ d: item.path, fill: 'none', stroke: colour, 'stroke-width': width })}/>`,
  );
  const dots = [
    ...(item.dots === 'both' ? [item.source] : []),
    ...(item.dots === 'none' ? [] : [item.target]),
  ];
  for (const dot of dots) {
    out.push(`<circle ${attrs({ cx: dot.x, cy: dot.y, r: DOT_RADIUS, fill: colour })}/>`);
  }
  if (item.label !== null || item.badges.length > 0) {
    const label = item.label ?? '';
    const badgeWidths = item.badges.map((badge) =>
      Math.max(BADGE, measure(badge.label, FONTS.badge) + 8),
    );
    const badgesWidth = badgeWidths.reduce((sum, w) => sum + w + BADGE_GAP, 0);
    const labelWidth = label === '' ? 0 : measure(label, FONTS.label);
    const pillWidth = 2 + badgesWidth + labelWidth + (label === '' ? 0 : 8);
    const left = item.labelPoint.x - pillWidth / 2;
    const top = item.labelPoint.y - LABEL_HEIGHT / 2;
    out.push(
      box(left, top, pillWidth, LABEL_HEIGHT, LABEL_HEIGHT / 2, palette.surface, palette.border),
    );
    let cursor = left + 2;
    item.badges.forEach((badge, index) => {
      const badgeWidth = badgeWidths[index] ?? BADGE;
      const fill = badge.errorPath ? palette.clayInk : palette.primary;
      const ink = badge.errorPath ? palette.onInverse : palette.onPrimary;
      out.push(box(cursor, item.labelPoint.y - BADGE / 2, badgeWidth, BADGE, BADGE / 2, fill));
      out.push(
        text('b', cursor + badgeWidth / 2, item.labelPoint.y + 3.5, ink, badge.label, 'middle'),
      );
      cursor += badgeWidth + BADGE_GAP;
    });
    if (label !== '') out.push(text('l', cursor + 2, item.labelPoint.y + 3.5, palette.ink, label));
  }
  out.push('</g>');
  return out.join('');
}

/**
 * Writes the scene as one standalone SVG document (R1–R6): real `<text>`, lucide icon paths,
 * embedded fonts, light colours. Stacking order as on the canvas: groups, collapsed groups,
 * edges, ports, cards, notes.
 */
export function renderSvg(scene: ExportScene, options: SvgOptions): string {
  const { transparent, palette, fonts, measure, title } = options;
  const { bounds } = scene;
  const out: string[] = [
    `<svg ${attrs({
      xmlns: 'http://www.w3.org/2000/svg',
      width: Math.ceil(bounds.width),
      height: Math.ceil(bounds.height),
      viewBox: `${n(bounds.x)} ${n(bounds.y)} ${n(bounds.width)} ${n(bounds.height)}`,
    })}>`,
    `<title>${escapeXml(title)}</title>`,
    `<style>${fonts}${STYLE}</style>`,
  ];
  if (!transparent) {
    out.push(box(bounds.x, bounds.y, bounds.width, bounds.height, 0, palette.canvas));
  }
  for (const group of scene.groups) {
    const { x, y, width, height } = group.rect;
    const labelInk =
      group.text === 'default' ? palette.inkMuted : exportTextColour(group.text, palette);
    out.push(`<g data-export="group" data-id="${escapeXml(group.id)}">`);
    out.push(
      box(
        x,
        y,
        width,
        height,
        16,
        group.fill ?? palette.group,
        group.stroke ?? palette.border,
        '4 3',
      ),
    );
    // Upper-cased in the text itself: vector editors ignore `text-transform`.
    const label = truncate(group.label.toUpperCase(), FONTS.group, width - 48, measure);
    out.push(text('g', x + 16, y + 20, labelInk, `${label}  ${String(group.count)}`));
    out.push('</g>');
  }
  for (const item of scene.collapsed) {
    const { x, y, width, height } = item.rect;
    const ink = exportTextColour(item.text, palette);
    const subtitleInk = item.text === 'default' ? palette.inkSecondary : ink;
    out.push(`<g data-export="collapsed" data-id="${escapeXml(item.id)}">`);
    out.push(box(x + 12, y + 8, width - 24, height, 12, palette.surface2, palette.hairline));
    out.push(box(x + 6, y + 4, width - 12, height, 12, palette.surface2, palette.hairline));
    out.push(
      box(x, y, width, height, 12, item.fill ?? palette.surface, item.stroke ?? palette.border),
    );
    const name = truncate(item.title, FONTS.title, width - 24, measure);
    out.push(text('t', x + 12, y + height / 2 - 3, ink, name));
    const counts = `${String(item.nodeCount)} nodes · ${String(item.edgeCount)} edges`;
    out.push(text('c', x + 12, y + height / 2 + 13, subtitleInk, counts));
    out.push('</g>');
  }
  for (const item of scene.edges) out.push(edge(item, palette, measure));
  for (const port of scene.ports) {
    // The canvas pill (port-pill-node.tsx): dashed primary border, fitted to its label and
    // centred in the port box. "Go to …" is a UI action, so only the outside title is drawn.
    const { x, y, width, height } = port.rect;
    const name = truncate(port.label, FONTS.title, width * 2, measure);
    const pillWidth = measure(name, FONTS.title) + 24;
    const pillHeight = 26;
    const left = x + (width - pillWidth) / 2;
    const top = y + (height - pillHeight) / 2;
    out.push(`<g data-export="port" data-id="${escapeXml(port.id)}">`);
    out.push(
      box(
        left,
        top,
        pillWidth,
        pillHeight,
        pillHeight / 2,
        palette.surface,
        palette.primary,
        '4 3',
      ),
    );
    out.push(text('t', left + 12, top + pillHeight / 2 + 4.5, palette.primaryInk, name));
    out.push('</g>');
  }
  for (const item of scene.cards) out.push(card(item, palette, measure));
  for (const sticky of scene.stickies) {
    const { x, y, width, height } = sticky.rect;
    const colours = stickyColours(sticky.tint, palette);
    out.push(`<g data-export="sticky" data-id="${escapeXml(sticky.id)}">`);
    out.push(box(x, y, width, height, 12, colours.fill, colours.border));
    out.push(icon(ICON_PATHS.sticky, x + 12, y + (height - 16) / 2, 16, colours.ink));
    const label = truncate(sticky.label, FONTS.title, width - 48, measure);
    out.push(text('t', x + 36, y + height / 2 + 4.5, colours.ink, label));
    out.push('</g>');
  }
  out.push('</svg>');
  return out.join('');
}
