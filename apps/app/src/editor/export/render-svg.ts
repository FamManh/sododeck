import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';

import { DECK_CARD } from '../card-layout';
import { TAG_CHIP } from '../card-tags';
import { KNOB_RADIUS } from '../edge-constants';
import { ARROW_PATH, endMarks } from '../edge-end-marks';
import { exportTextColour, stickyColours, type ExportPalette } from './export-palette';
import { ICON_PATHS, type IconNode } from './icon-paths';
import type { ExportScene, SceneCard, SceneCollapsed, SceneEdge, SceneGroup } from './scene';
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
  /** The Deck card title (029); the box was laid out with this font (`cardLayout`). */
  title: DECK_CARD.titleFont,
  description: DECK_CARD.descriptionFont,
  typeName: `500 11.5px ${SANS}`,
  tag: TAG_CHIP.font,
  groupLabel: `600 12.5px ${SANS}`,
  count: `700 13px ${SANS}`,
  groupCount: `700 10.5px ${SANS}`,
  more: `600 10.5px ${SANS}`,
  /** Notes, port pills. */
  name: `500 12.5px ${SANS}`,
  caption: `11.5px ${SANS}`,
  label: `10.5px ${MONO}`,
  badge: `500 10px ${MONO}`,
  /** The bundle's "×n" pill (DESIGN.md "Bundle count"). */
  bundle: `700 11.5px ${SANS}`,
  outside: `500 10px ${SANS}`,
} as const;

const STYLE = [
  `.ti{font:${FONTS.title}}`,
  `.d{font:${FONTS.description}}`,
  `.ty{font:${FONTS.typeName}}`,
  `.tg{font:${FONTS.tag}}`,
  `.gl{font:${FONTS.groupLabel}}`,
  `.n{font:${FONTS.count}}`,
  `.gc{font:${FONTS.groupCount}}`,
  `.m{font:${FONTS.more}}`,
  `.t{font:${FONTS.name}}`,
  `.c{font:${FONTS.caption}}`,
  `.l{font:${FONTS.label}}`,
  `.b{font:${FONTS.badge}}`,
  `.bn{font:${FONTS.bundle}}`,
  `.o{font:${FONTS.outside}}`,
].join('');

/** The Deck card's corner radius and lip (DESIGN.md `--sd-deck-card-radius`, `--sd-deck-lip`). */
const CARD_RADIUS = 14;
const FRAME_RADIUS = 20;
const BORDER = 1.5;
const LIP = 3;
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
  part?: string,
): string {
  return `<rect ${attrs({ 'data-part': part, x, y, width, height, rx: radius, fill, stroke, 'stroke-dasharray': dash })}/>`;
}

/**
 * A Deck shape: a lip (the whole box moved down, in the border colour) behind a body whose 1.5 px
 * border sits inside the box, as CSS `border` does, so the outer size is the canvas box.
 */
function paper(
  [x, y, width, height]: readonly [number, number, number, number],
  radius: number,
  fill: string,
  stroke: string,
  lip: number,
  parts: { lip: string; body: string },
): string {
  const half = BORDER / 2;
  const body = `<rect ${attrs({
    'data-part': parts.body,
    x: x + half,
    y: y + half,
    width: width - BORDER,
    height: height - BORDER,
    rx: radius - half,
    fill,
    stroke,
    'stroke-width': BORDER,
  })}/>`;
  return `${lip > 0 ? box(x, y + lip, width, height, radius, stroke, undefined, undefined, parts.lip) : ''}${body}`;
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
function icon(
  nodes: IconNode,
  x: number,
  y: number,
  size: number,
  colour: string,
  strokeWidth: number = ICON_STROKE_WIDTH,
): string {
  const shapes = nodes.map(([tag, values]) => `<${tag} ${attrs(values)}/>`).join('');
  return `<g ${attrs({
    transform: `translate(${n(x)} ${n(y)}) scale(${n(size / 24)})`,
    fill: 'none',
    stroke: colour,
    'stroke-width': strokeWidth,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  })}>${shapes}</g>`;
}

/** Baseline of a line of `size` px text centred in a band of `height` px that starts at `top`. */
function baseline(top: number, height: number, size: number): number {
  return top + height / 2 + size * 0.35;
}

function card(item: SceneCard, palette: ExportPalette, measure: TextMeasurer): string {
  const { x, y, width, height } = item.rect;
  const c = DECK_CARD;
  const ink = exportTextColour(item.text, palette);
  const custom = item.text !== 'default';
  const chip = item.chip ?? palette.surface2;
  const chipInk = item.ink ?? palette.inkSecondary;
  const typeInk = custom ? ink : item.namedFill === true ? palette.inkSecondary : palette.inkMuted;
  const bodyInk = custom ? ink : palette.inkSecondary;
  const out: string[] = [`<g data-export="card" data-id="${escapeXml(item.id)}">`];
  out.push(
    paper(
      [x, y, width, height],
      CARD_RADIUS,
      item.fill ?? palette.surface,
      item.stroke ?? palette.borderStrong,
      LIP,
      { lip: 'lip', body: 'body' },
    ),
  );
  // Every region is stacked from the top, as the canvas card's flex column: header, title,
  // description, tags, the "n inside" row, each 8 px apart; an empty one takes no room.
  const left = x + c.paddingX;
  const inner = width - 2 * c.paddingX;
  let top = y + c.paddingY;

  out.push(box(left, top, c.headerHeight, c.headerHeight, 8, chip, undefined, undefined, 'tile'));
  out.push(icon(ICON_PATHS[item.kind], left + 5, top + 5, 14, chipInk, 2));
  const headerMiddle = top + c.headerHeight / 2;
  const slotRight = left + inner;
  let typeRight = slotRight;
  if (item.hasRules) {
    typeRight = slotRight - 14 - 8;
    const rulesInk = custom ? ink : palette.primaryInk;
    out.push(icon(ICON_PATHS.rules, slotRight - 14, headerMiddle - 7, 14, rulesInk));
  }
  const typeX = left + c.headerHeight + 8;
  out.push(
    text(
      'ty',
      typeX,
      baseline(top, c.headerHeight, 11.5),
      typeInk,
      truncate(item.typeName, FONTS.typeName, Math.max(0, typeRight - typeX), measure),
    ),
  );
  top += c.headerHeight + c.gap;

  for (const [index, line] of item.titleLines.entries()) {
    out.push(
      text('ti', left, top + index * c.titleLineHeight + c.titleLineHeight / 2 + 4.9, ink, line),
    );
  }
  top += item.titleLines.length * c.titleLineHeight;

  if (item.descriptionLines.length > 0) {
    top += c.gap;
    for (const [index, line] of item.descriptionLines.entries()) {
      out.push(
        text(
          'd',
          left,
          top + index * c.descriptionLineHeight + c.descriptionLineHeight / 2 + 4.2,
          bodyInk,
          line,
        ),
      );
    }
    top += item.descriptionLines.length * c.descriptionLineHeight;
  }

  if (item.tagChips.length > 0) {
    top += c.gap;
    for (const chipBox of item.tagChips) {
      const chipY = top + chipBox.row * (TAG_CHIP.height + TAG_CHIP.gap);
      out.push(
        box(
          left + chipBox.x,
          chipY,
          chipBox.width,
          TAG_CHIP.height,
          9,
          chipBox.chip,
          undefined,
          undefined,
          'tag',
        ),
      );
      // Only a chip the card's width capped is cut; the others fit by `tagChips`' own measure.
      const label =
        chipBox.width < inner
          ? chipBox.tag
          : truncate(chipBox.tag, FONTS.tag, chipBox.width - 2 * TAG_CHIP.paddingX, measure);
      out.push(
        text(
          'tg',
          left + chipBox.x + TAG_CHIP.paddingX,
          baseline(chipY, TAG_CHIP.height, 10.5),
          chipBox.ink,
          label,
        ),
      );
    }
    const rows = item.tagChips.reduce((most, entry) => Math.max(most, entry.row + 1), 0);
    top += rows * TAG_CHIP.height + (rows - 1) * TAG_CHIP.gap;
  }

  if (item.childCount > 0) {
    top += c.gap;
    const middle = top + c.childrenRowHeight / 2;
    out.push(box(left, top, inner, c.childrenRowHeight, 8, palette.surface2));
    out.push(icon(ICON_PATHS.children, left + 8, middle - 6, 12, palette.inkSecondary));
    out.push(
      text(
        'c',
        left + 8 + 12 + 6,
        baseline(top, c.childrenRowHeight, 11.5),
        palette.inkSecondary,
        `${String(item.childCount)} inside`,
      ),
    );
    out.push(icon(ICON_PATHS.enter, left + inner - 8 - 12, middle - 6, 12, palette.inkSecondary));
  }
  out.push('</g>');
  return out.join('');
}

function groupFrame(group: SceneGroup, palette: ExportPalette, measure: TextMeasurer): string {
  const { x, y, width, height } = group.rect;
  const stroke = group.stroke ?? palette.borderStrong;
  const labelInk = exportTextColour(group.text, palette);
  const out: string[] = [`<g data-export="group" data-id="${escapeXml(group.id)}">`];
  // The frame has no lip; its label pill has a 2 px one (DESIGN.md "Groups").
  out.push(
    paper([x, y, width, height], FRAME_RADIUS, group.fill ?? palette.surface2, stroke, 0, {
      lip: 'frame-lip',
      body: 'frame',
    }),
  );
  // Chevron, name, count disc: left padding 8, gaps 6, right padding 6, 28 tall, 14 above the edge.
  const countText = String(group.count);
  const disc = 18;
  const room = Math.max(0, width - 2 * 16 - (8 + 14 + 6 + 6 + disc + 6));
  const name = truncate(group.label, FONTS.groupLabel, room, measure);
  const pillWidth = 8 + 14 + 6 + measure(name, FONTS.groupLabel) + 6 + disc + 6;
  const pillX = x + 16;
  const pillY = y - 14;
  out.push(
    paper([pillX, pillY, pillWidth, 28], 14, palette.surface, stroke, 2, {
      lip: 'pill-lip',
      body: 'pill',
    }),
  );
  out.push(icon(ICON_PATHS.chevron, pillX + 8, pillY + 7, 14, labelInk));
  out.push(text('gl', pillX + 8 + 14 + 6, baseline(pillY, 28, 12.5), labelInk, name));
  const discX = pillX + pillWidth - 6 - disc;
  out.push(box(discX, pillY + 5, disc, disc, disc / 2, palette.ink));
  out.push(
    text(
      'gc',
      discX + disc / 2,
      baseline(pillY + 5, disc, 10.5),
      palette.surface,
      countText,
      'middle',
    ),
  );
  out.push('</g>');
  return out.join('');
}

/** A member tile: 22 px tall, radius 7, a 1.5 px border inside the box and no fill. */
function outlineTile(
  x: number,
  y: number,
  width: number,
  part: string,
  palette: ExportPalette,
): string {
  return `<rect ${attrs({
    'data-part': part,
    x: x + BORDER / 2,
    y: y + BORDER / 2,
    width: width - BORDER,
    height: 22 - BORDER,
    rx: 7 - BORDER / 2,
    fill: 'none',
    stroke: palette.borderStrong,
    'stroke-width': BORDER,
  })}/>`;
}

/** Member tiles on a hand; the last slot reads "+n" when there are more. */
const MAX_TILES = 5;

function collapsedHand(
  item: SceneCollapsed,
  palette: ExportPalette,
  measure: TextMeasurer,
): string {
  const { x, y, width, height } = item.rect;
  const stroke = item.stroke ?? palette.borderStrong;
  const ink = exportTextColour(item.text, palette);
  const out: string[] = [`<g data-export="collapsed" data-id="${escapeXml(item.id)}">`];
  // Two back sheets in the group's colour, rotated around the bottom centre (DESIGN.md "Groups").
  for (const degrees of [-7, 4]) {
    out.push(
      `<g ${attrs({ 'data-part': 'sheet', transform: `rotate(${String(degrees)} ${n(x + width / 2)} ${n(y + height)})` })}>${paper(
        [x, y, width, height],
        CARD_RADIUS,
        item.fill ?? palette.surface2,
        stroke,
        LIP,
        { lip: 'sheet-lip', body: 'sheet-body' },
      )}</g>`,
    );
  }
  out.push(
    paper([x, y, width, height], CARD_RADIUS, item.fill ?? palette.surface, stroke, LIP, {
      lip: 'front-lip',
      body: 'front',
    }),
  );
  const left = x + 12;
  const top = y + 11;
  const inner = width - 24;
  const chip = item.chip ?? palette.surface2;
  const chipInk = item.ink ?? palette.inkSecondary;
  out.push(box(left, top, 24, 24, 8, chip, undefined, undefined, 'tile'));
  out.push(icon(ICON_PATHS.children, left + 5, top + 5, 14, chipInk, 2));
  const disc = 26;
  out.push(
    text(
      'ty',
      left + 32,
      baseline(top, 24, 11.5),
      item.text === 'default' ? palette.inkSecondary : ink,
      'Group',
    ),
  );
  const discX = left + inner - disc;
  out.push(box(discX, top - 1, disc, disc, disc / 2, palette.ink));
  out.push(
    text(
      'n',
      discX + disc / 2,
      baseline(top - 1, disc, 13),
      palette.surface,
      String(item.nodeCount),
      'middle',
    ),
  );
  const nameTop = top + 24 + 7;
  out.push(
    text('ti', left, nameTop + 13.9, ink, truncate(item.title, FONTS.title, inner, measure)),
  );
  const tilesTop = nameTop + 18 + 7;
  const kinds = item.memberKinds;
  const shown = kinds.length > MAX_TILES ? kinds.slice(0, MAX_TILES - 1) : kinds;
  let cursor = left;
  for (const kind of shown) {
    out.push(outlineTile(cursor, tilesTop, 22, 'member', palette));
    out.push(icon(ICON_PATHS[kind], cursor + 5, tilesTop + 5, 12, palette.inkSecondary));
    cursor += 22 + 4;
  }
  const extra = kinds.length - shown.length;
  if (extra > 0) {
    const label = `+${String(extra)}`;
    const more = Math.max(22, measure(label, FONTS.more) + 8);
    out.push(outlineTile(cursor, tilesTop, more, 'more', palette));
    out.push(
      text(
        'm',
        cursor + more / 2,
        baseline(tilesTop, 22, 10.5),
        palette.inkSecondary,
        label,
        'middle',
      ),
    );
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
      return { colour: palette.deckEdge, width: 2 };
  }
}

function edge(item: SceneEdge, palette: ExportPalette, measure: TextMeasurer): string {
  const { colour, width } = edgeStroke(item, palette);
  const out: string[] = [`<g data-export="edge" data-id="${escapeXml(item.id)}">`];
  out.push(
    `<path ${attrs({ d: item.path, fill: 'none', stroke: colour, 'stroke-width': width })}/>`,
  );
  // The canvas's own end marks (`endMarks`), in the line colour.
  for (const mark of endMarks(item.ends, item.direction)) {
    out.push(
      mark.kind === 'knob'
        ? `<circle ${attrs({ 'data-mark': 'knob', cx: mark.at.x, cy: mark.at.y, r: KNOB_RADIUS, fill: colour })}/>`
        : `<path ${attrs({
            'data-mark': 'arrow',
            d: ARROW_PATH,
            transform: `translate(${n(mark.at.x)} ${n(mark.at.y)}) rotate(${String(mark.angle)})`,
            fill: colour,
            stroke: colour,
            'stroke-width': 2,
            'stroke-linejoin': 'round',
          })}/>`,
    );
  }
  if (item.count === true && item.label !== null && item.badges.length === 0) {
    // The Ink "×n" pill: 22 tall, Surface text, a 2 px canvas ring around it (frame 118, 119).
    const width = measure(item.label, FONTS.bundle) + 20;
    const left = item.labelPoint.x - width / 2;
    const top = item.labelPoint.y - 11;
    out.push(
      `<rect ${attrs({ 'data-part': 'bundle-pill', x: left, y: top, width, height: 22, rx: 11, fill: palette.ink, stroke: palette.canvas, 'stroke-width': 2 })}/>`,
    );
    out.push(
      text('bn', item.labelPoint.x, baseline(top, 22, 11.5), palette.surface, item.label, 'middle'),
    );
  } else if (item.label !== null || item.badges.length > 0) {
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
  for (const group of scene.groups) out.push(groupFrame(group, palette, measure));
  for (const item of scene.collapsed) out.push(collapsedHand(item, palette, measure));
  for (const item of scene.edges) out.push(edge(item, palette, measure));
  for (const port of scene.ports) {
    // The canvas proxy (outside-proxy-node.tsx): a dashed 1.5 px Secondary card on the canvas
    // colour with the outside card's type tile, its title and "Outside". "Go to" is a UI action.
    const { x, y, width, height } = port.rect;
    out.push(`<g data-export="port" data-id="${escapeXml(port.id)}">`);
    out.push(
      box(
        x + 0.75,
        y + 0.75,
        width - 1.5,
        height - 1.5,
        CARD_RADIUS,
        palette.canvas,
        palette.inkSecondary,
        '5 4',
        'proxy',
      ).replace('/>', ` stroke-width="${String(BORDER)}"/>`),
    );
    out.push(box(x + 12, y + (height - 24) / 2, 24, 24, 8, palette.surface2));
    out.push(
      icon(ICON_PATHS[port.kind], x + 17, y + (height - 14) / 2, 14, palette.inkSecondary, 2),
    );
    const name = truncate(port.label, FONTS.groupLabel, width - 12 - 24 - 8 - 12, measure);
    out.push(text('gl', x + 12 + 24 + 8, y + height / 2 - 2, palette.ink, name));
    out.push(text('o', x + 12 + 24 + 8, y + height / 2 + 11, palette.inkMuted, 'Outside'));
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
