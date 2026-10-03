import type { SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { branchedDeck } from '../../test/flow-fixtures';
import { deckOf } from '../../test/render-canvas';
import { ARROW_PATH } from '../edge-end-marks';
import { KNOB_RADIUS } from '../edge-constants';
import { LIGHT_PALETTE } from './export-palette';
import { renderSvg, type SvgOptions } from './render-svg';
import { buildScene, type SceneInput } from './scene';
import { fixedWidthMeasurer } from './text-measure';

const ui: SceneInput['ui'] = {
  currentViewId: null,
  revealed: new Set(),
  drill: [],
  activeFlowId: null,
  notesDisplay: 'dimmed',
};

const options: SvgOptions = {
  transparent: false,
  palette: LIGHT_PALETTE,
  fonts: "@font-face{font-family:'Geist Variable';src:url(data:font/woff2;base64,AAAA)}",
  measure: fixedWidthMeasurer(),
  title: 'Deck',
};

const deck = deckOf({
  nodes: [
    { id: 'a', type: 'service', title: 'A <b> & "c"', tech: "it's", position: { x: 0, y: 0 } },
    {
      id: 'b',
      type: 'database',
      title: 'A very long component title that cannot fit on one card '.repeat(4).trim(),
      position: { x: 300, y: 0 },
      rules: ['r'],
    },
    { id: 'p', type: 'service', title: 'Parent', position: { x: 0, y: 200 } },
    { id: 'c', type: 'service', title: 'Child', parent: 'p', position: { x: 0, y: 0 } },
  ],
  groups: [{ id: 'g', title: 'Group' }],
  edges: [{ id: 'ab', from: 'a', to: 'b', label: 'SQL' }],
  rules: { r: { title: 'R', hitPolicy: 'first', inputs: [], outputs: [], rows: [] } },
  stickies: [{ id: 's', text: 'Note', position: { x: 0, y: 400 } }],
});

function svgOf(file: SododeckFile, patch: Partial<SvgOptions> = {}, scene?: Partial<SceneInput>) {
  return renderSvg(buildScene({ deck: file, scope: 'deck', ui, ...scene }), {
    ...options,
    ...patch,
  });
}

function parse(svg: string): Document {
  return new DOMParser().parseFromString(svg, 'image/svg+xml');
}

describe('renderSvg', () => {
  it('writes a well-formed standalone SVG document', () => {
    const doc = parse(svgOf(deck));
    expect(doc.querySelector('parsererror')).toBeNull();
    const root = doc.documentElement;
    expect(root.tagName).toBe('svg');
    expect(root.getAttribute('xmlns')).toBe('http://www.w3.org/2000/svg');
    expect(root.getAttribute('viewBox')?.split(' ')).toHaveLength(4);
    expect(doc.querySelector('title')?.textContent).toBe('Deck');
    expect(doc.querySelector('style')?.textContent).toContain('@font-face');
  });

  it('escapes text so it round-trips', () => {
    const doc = parse(svgOf(deck, { title: 'Q&A <deck>' }));
    const texts = [...doc.querySelectorAll('text')].map((node) => node.textContent);
    expect(texts).toContain('A <b> & "c"');
    expect(texts).toContain("it's");
    expect(doc.querySelector('title')?.textContent).toBe('Q&A <deck>');
  });

  it('draws one group per card, edge, note and a label per labelled edge', () => {
    const doc = parse(svgOf(deck));
    expect(doc.querySelectorAll('[data-export="card"]')).toHaveLength(3);
    expect(doc.querySelectorAll('[data-export="edge"] path[fill="none"]')).toHaveLength(1);
    expect(doc.querySelectorAll('[data-export="sticky"]')).toHaveLength(1);
    const edgeTexts = [...doc.querySelectorAll('[data-export="edge"] text')];
    expect(edgeTexts.map((node) => node.textContent)).toEqual(['SQL']);
  });

  it('clamps a long title to its lines and ends the last one with an ellipsis', () => {
    const doc = parse(svgOf(deck));
    const card = doc.querySelector('[data-export="card"][data-id="b"]');
    const titles = [...(card?.querySelectorAll('text.ti') ?? [])].map((node) => node.textContent);
    expect(titles).toHaveLength(3);
    expect(titles.at(-1)?.endsWith('…')).toBe(true);
    expect(titles[0]?.endsWith('…')).toBe(false);
  });

  it('draws the rules glyph and the child count', () => {
    const doc = parse(svgOf(deck));
    const parent = doc.querySelector('[data-export="card"][data-id="p"]');
    expect([...(parent?.querySelectorAll('text') ?? [])].map((node) => node.textContent)).toContain(
      '1 inside',
    );
    const withRules = doc.querySelector('[data-export="card"][data-id="b"]');
    expect(withRules?.querySelectorAll('g')).toHaveLength(2); // kind icon + rules glyph
  });

  it('fills the background unless transparent', () => {
    const opaque = parse(svgOf(deck));
    expect(opaque.documentElement.querySelector(':scope > rect')?.getAttribute('fill')).toBe(
      LIGHT_PALETTE.canvas,
    );
    const clear = parse(svgOf(deck, { transparent: true }));
    expect(clear.documentElement.querySelector(':scope > rect')).toBeNull();
  });

  it('references nothing outside the file', () => {
    const svg = svgOf(deck);
    for (const match of svg.matchAll(/(?:href="|url\()([^")]*)/g)) {
      expect(match[1]).toMatch(/^(data:|#)/);
    }
  });

  it('draws flow edges in the path colour with numbered badges', () => {
    const doc = parse(
      renderSvg(
        buildScene({ deck: branchedDeck, scope: 'flow', ui: { ...ui, activeFlowId: 'pay' } }),
        options,
      ),
    );
    const edge = (id: string) => doc.querySelector(`[data-export="edge"][data-id="${id}"]`);
    const path = edge('ab')?.querySelector('path');
    expect(path?.getAttribute('stroke')).toBe(LIGHT_PALETTE.primary);
    expect(path?.getAttribute('stroke-width')).toBe('2');
    const texts = (id: string) =>
      [...(edge(id)?.querySelectorAll('text') ?? [])].map((node) => node.textContent);
    expect(texts('ab')).toEqual(['1', 'HTTPS']);
    expect(texts('cx')).toEqual(['3b', 'authorize']);
    const errorBadge = edge('cx')?.querySelectorAll('rect')[1];
    expect(errorBadge?.getAttribute('fill')).toBe(LIGHT_PALETTE.clayInk);
    expect(edge('cx')?.querySelector('path')?.getAttribute('stroke')).toBe(LIGHT_PALETTE.clayInk);
  });

  it('carries no playback mark: no sticker, lip, halo, token or step state (035 FR-021)', () => {
    const svg = renderSvg(
      buildScene({ deck: branchedDeck, scope: 'flow', ui: { ...ui, activeFlowId: 'pay' } }),
      options,
    );
    for (const mark of [
      'step-sticker',
      'flow-token',
      'edge-halo',
      'edge-cross',
      'data-step-state',
      'animateMotion',
      'current-step',
    ]) {
      expect(svg).not.toContain(mark);
    }
  });

  it('draws a card and a group in their custom colour (020 T057)', () => {
    const coloured = deckOf({
      nodes: [{ id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 }, group: 'g' }],
      groups: [{ id: 'g', title: 'G', style: { fill: 'teal', stroke: 'teal' } }],
    });
    const withCardFill = {
      ...coloured,
      nodes: coloured.nodes.map((node) =>
        node.id === 'a' ? { ...node, style: { fill: '#123456' } } : node,
      ),
    };
    const doc = parse(svgOf(withCardFill));
    const card = doc.querySelector('[data-export="card"][data-id="a"] [data-part="body"]');
    expect(card?.getAttribute('fill')).toBe('#123456');
    const cardTitle = doc.querySelector('[data-export="card"][data-id="a"] text.ti');
    expect(cardTitle?.getAttribute('fill')).toBe(LIGHT_PALETTE.cardText.light);
    const group = doc.querySelector('[data-export="group"][data-id="g"] [data-part="frame"]');
    expect(group?.getAttribute('fill')).toBe(LIGHT_PALETTE.cardColours.teal.fill);
    expect(group?.getAttribute('stroke')).toBe(LIGHT_PALETTE.cardColours.teal.stroke);
  });

  it("draws a collapsed card in its group's custom colour", () => {
    const colouredGroup = deckOf({
      nodes: [{ id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 }, group: 'g' }],
      groups: [{ id: 'g', title: 'G', style: { fill: 'teal' } }],
      views: [{ id: 'v', type: 'custom', title: 'V', collapsed: ['g'] }],
    });
    const doc = parse(
      svgOf(colouredGroup, {}, { scope: 'view', ui: { ...ui, currentViewId: 'v' } }),
    );
    const front = doc.querySelector('[data-export="collapsed"][data-id="g"] [data-part="front"]');
    expect(front?.getAttribute('fill')).toBe(LIGHT_PALETTE.cardColours.teal.fill);
  });
});

const deckLook = deckOf({
  nodes: [
    {
      id: 'a',
      type: 'database',
      title: 'Orders',
      tech: 'Postgres 16',
      tags: ['core', 'pii'],
      position: { x: 0, y: 0 },
    },
    { id: 'b', type: 'service', title: 'Bare', position: { x: 400, y: 0 } },
    { id: 'c', type: 'client', title: 'Web', position: { x: 0, y: 300 } },
  ],
  groups: [{ id: 'g', title: 'Core' }],
  edges: [
    { id: 'curved', from: 'a', to: 'b' },
    { id: 'straight', from: 'a', to: 'c', style: { shape: 'straight' }, direction: 'both' },
    { id: 'elbow', from: 'b', to: 'c', style: { shape: 'elbow' }, direction: 'none' },
  ],
});

const inCard = (doc: Document, id: string) =>
  doc.querySelector(`[data-export="card"][data-id="${id}"]`);

describe('renderSvg: the Deck card (029)', () => {
  const doc = parse(svgOf(deckLook));
  const orders = inCard(doc, 'a');

  it('draws radius 14, a 1.5 px border, and a lip 3 px below in the stroke colour', () => {
    const lip = orders?.querySelector('[data-part="lip"]');
    const body = orders?.querySelector('[data-part="body"]');
    expect(body?.getAttribute('stroke-width')).toBe('1.5');
    expect(body?.getAttribute('stroke')).toBe(LIGHT_PALETTE.borderStrong);
    expect(lip?.getAttribute('fill')).toBe(LIGHT_PALETTE.borderStrong);
    // The body is inset by half the border; the lip is the whole box moved 3 px down.
    expect(Number(lip?.getAttribute('y')) - Number(body?.getAttribute('y'))).toBeCloseTo(3 - 0.75);
    expect(lip?.getAttribute('rx')).toBe('14');
    // The outer box is the canvas box: the stroke sits inside it.
    expect(Number(body?.getAttribute('rx'))).toBeCloseTo(13.25);
  });

  it('takes the lip colour from the card stroke', () => {
    const coloured = deckOf({
      nodes: [
        {
          id: 'a',
          type: 'service',
          title: 'A',
          position: { x: 0, y: 0 },
          style: { stroke: 'teal' },
        },
      ],
    });
    const lip = parse(svgOf(coloured)).querySelector('[data-part="lip"]');
    expect(lip?.getAttribute('fill')).toBe(LIGHT_PALETTE.cardColours.teal.stroke);
  });

  it('draws the header: a 24 px tile with the type name beside it', () => {
    const tile = orders?.querySelector('[data-part="tile"]');
    expect(tile?.getAttribute('width')).toBe('24');
    expect(tile?.getAttribute('rx')).toBe('8');
    expect(tile?.getAttribute('fill')).toBe(LIGHT_PALETTE.surface2);
    expect(orders?.querySelector('text.ty')?.textContent).toBe('Database');
  });

  it('draws the title in the 600 weight and the description under it', () => {
    expect(orders?.querySelector('text.ti')?.textContent).toBe('Orders');
    expect(orders?.querySelector('text.d')?.textContent).toBe('Postgres 16');
    expect(svgOf(deckLook)).toContain('600 14px');
  });

  it('draws one pill per tag, and no tag area without tags', () => {
    expect([...(orders?.querySelectorAll('[data-part="tag"]') ?? [])]).toHaveLength(2);
    expect(
      [...(orders?.querySelectorAll('text.tg') ?? [])].map((node) => node.textContent),
    ).toEqual(['core', 'pii']);
    const bare = inCard(doc, 'b');
    expect(bare?.querySelectorAll('[data-part="tag"]')).toHaveLength(0);
    expect(bare?.querySelectorAll('text.d')).toHaveLength(0);
    // The lip, the body and the tile: nothing else is reserved for the empty regions.
    expect(bare?.querySelectorAll('rect')).toHaveLength(3);
  });

  it('colours the tile from the card colour and each tag from its own colour (033)', () => {
    const coloured = deckOf({
      tagColors: { PCI: 'violet', Lan: '#1f2a44' },
      nodes: [
        {
          id: 'a',
          type: 'service',
          title: 'A',
          tags: ['pci', 'Lan', 'plain'],
          position: { x: 0, y: 0 },
          style: { fill: 'teal' },
        },
      ],
    });
    const card = inCard(parse(svgOf(coloured)), 'a');
    const teal = LIGHT_PALETTE.cardChips.teal;
    expect(card?.querySelector('[data-part="tile"]')?.getAttribute('fill')).toBe(teal.chip);
    const pills = [...(card?.querySelectorAll('[data-part="tag"]') ?? [])];
    const labels = [...(card?.querySelectorAll('text.tg') ?? [])];
    const violet = LIGHT_PALETTE.cardChips.violet;
    const slate = LIGHT_PALETTE.cardChips.slate;
    expect(pills.map((pill) => pill.getAttribute('fill'))).toEqual([
      violet.chip,
      '#1f2a44',
      slate.chip,
    ]);
    expect(labels.map((label) => label.getAttribute('fill'))).toEqual([
      violet.ink,
      LIGHT_PALETTE.cardText.light,
      slate.ink,
    ]);
  });

  it('draws a tag in a light-only slate pill when no colour is set, even on a coloured card (033)', () => {
    const plain = deckOf({
      nodes: [{ id: 'a', type: 'service', title: 'A', tags: ['x'], position: { x: 0, y: 0 } }],
    });
    const card = inCard(parse(svgOf(plain)), 'a');
    expect(card?.querySelector('[data-part="tag"]')?.getAttribute('fill')).toBe(
      LIGHT_PALETTE.cardChips.slate.chip,
    );
    expect(card?.querySelector('text.tg')?.getAttribute('fill')).toBe(
      LIGHT_PALETTE.cardChips.slate.ink,
    );
  });

  it('draws nothing of hover, drag or selection', () => {
    const svg = svgOf(deckLook);
    expect(svg).not.toMatch(/hover|drag|select|opacity|filter|shadow/i);
    expect(orders?.querySelector('[transform]')?.getAttribute('transform')).not.toMatch(/rotate/);
  });
});

describe('renderSvg: connectors (029)', () => {
  const doc = parse(svgOf(deckLook));
  const edge = (id: string) => doc.querySelector(`[data-export="edge"][data-id="${id}"]`);

  it('draws each line type with routedPath', () => {
    expect(edge('curved')?.querySelector('path')?.getAttribute('d')).toMatch(/ C /);
    expect(edge('straight')?.querySelector('path')?.getAttribute('d')).toMatch(/^M [^C]* L [^C]*$/);
    const elbow = edge('elbow')?.querySelector('path')?.getAttribute('d') ?? '';
    expect(elbow).not.toMatch(/ C /);
  });

  it('draws the shared end marks per direction', () => {
    const marks = (id: string) =>
      [...(edge(id)?.querySelectorAll('[data-mark]') ?? [])].map((node) =>
        node.getAttribute('data-mark'),
      );
    expect(marks('curved')).toEqual(['knob', 'arrow']);
    expect(marks('straight')).toEqual(['arrow', 'arrow']);
    expect(marks('elbow')).toEqual(['knob', 'knob']);
    const arrow = edge('curved')?.querySelector('[data-mark="arrow"]');
    expect(arrow?.getAttribute('d')).toBe(ARROW_PATH);
    expect(arrow?.getAttribute('transform')).toMatch(/^translate\(.+\) rotate\(-?\d+\)$/);
    expect(edge('curved')?.querySelector('circle')?.getAttribute('r')).toBe(String(KNOB_RADIUS));
  });

  it('draws the line at 2 px in the Deck connector colour', () => {
    const path = edge('curved')?.querySelector('path');
    expect(path?.getAttribute('stroke')).toBe(LIGHT_PALETTE.deckEdge);
    expect(path?.getAttribute('stroke-width')).toBe('2');
  });
});

describe('renderSvg: groups (029)', () => {
  const grouped = deckOf({
    nodes: [
      { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 }, group: 'g' },
      { id: 'b', type: 'database', title: 'B', position: { x: 0, y: 200 }, group: 'g' },
      { id: 'x', type: 'client', title: 'X', position: { x: 400, y: 0 } },
    ],
    groups: [{ id: 'g', title: 'Core' }],
    edges: [{ id: 'ax', from: 'a', to: 'x' }],
    views: [{ id: 'v', type: 'custom', title: 'V', collapsed: ['g'] }],
  });

  it('draws the expanded frame at radius 20 with a label pill on the top edge', () => {
    const doc = parse(svgOf(grouped));
    const group = doc.querySelector('[data-export="group"][data-id="g"]');
    const frame = group?.querySelector('[data-part="frame"]');
    expect(frame?.getAttribute('stroke-dasharray')).toBeNull();
    expect(frame?.getAttribute('stroke')).toBe(LIGHT_PALETTE.borderStrong);
    expect(frame?.getAttribute('fill')).toBe(LIGHT_PALETTE.surface2);
    const pill = group?.querySelector('[data-part="pill"]');
    expect(frame?.getAttribute('rx')).toBe('19.25');
    expect(pill?.getAttribute('height')).toBe('26.5');
    expect(Number(pill?.getAttribute('y'))).toBeCloseTo(Number(frame?.getAttribute('y')) - 14);
    expect(group?.querySelector('[data-part="pill-lip"]')?.getAttribute('fill')).toBe(
      LIGHT_PALETTE.borderStrong,
    );
    expect([...(group?.querySelectorAll('text') ?? [])].map((node) => node.textContent)).toEqual([
      'Core',
      '2',
    ]);
  });

  it('draws a collapsed group as a fanned hand: two tilted sheets behind a front card', () => {
    const doc = parse(svgOf(grouped, {}, { scope: 'view', ui: { ...ui, currentViewId: 'v' } }));
    const hand = doc.querySelector('[data-export="collapsed"][data-id="g"]');
    const sheets = [...(hand?.querySelectorAll('[data-part="sheet"]') ?? [])];
    expect(sheets.map((sheet) => sheet.getAttribute('transform'))).toEqual([
      expect.stringMatching(/^rotate\(-7 /),
      expect.stringMatching(/^rotate\(4 /),
    ]);
    expect(hand?.querySelectorAll('[data-part="front"]')).toHaveLength(1);
    const texts = [...(hand?.querySelectorAll('text') ?? [])].map((node) => node.textContent);
    expect(texts).toEqual(['Group', '2', 'Core']);
    expect(hand?.querySelectorAll('[data-part="member"]')).toHaveLength(2);
  });

  it('turns members past five into a "+n" tile', () => {
    const many = deckOf({
      nodes: Array.from({ length: 7 }, (_, index) => ({
        id: `n${String(index)}`,
        type: 'service' as const,
        title: `N${String(index)}`,
        position: { x: 0, y: index * 100 },
        group: 'g',
      })),
      groups: [{ id: 'g', title: 'Many' }],
      views: [{ id: 'v', type: 'custom', title: 'V', collapsed: ['g'] }],
    });
    const doc = parse(svgOf(many, {}, { scope: 'view', ui: { ...ui, currentViewId: 'v' } }));
    const hand = doc.querySelector('[data-export="collapsed"]');
    expect(hand?.querySelectorAll('[data-part="member"]')).toHaveLength(4);
    expect(hand?.querySelectorAll('[data-part="more"]')).toHaveLength(1);
    expect([...(hand?.querySelectorAll('text') ?? [])].map((node) => node.textContent)).toContain(
      '+3',
    );
  });
});

describe('renderSvg: connector style (022)', () => {
  const styled = (style: NonNullable<SododeckFile['edges'][number]['style']>): SododeckFile => ({
    ...deck,
    edges: deck.edges.map((e) => ({ ...e, style })),
  });
  const edgePath = (file: SododeckFile) =>
    parse(svgOf(file)).querySelector('[data-export="edge"] path');

  it('draws a style-less deck exactly as before', () => {
    const plain = edgePath(deck);
    expect(plain?.getAttribute('stroke')).toBe(LIGHT_PALETTE.deckEdge);
    expect(plain?.getAttribute('stroke-width')).toBe('2');
    expect(plain?.hasAttribute('stroke-dasharray')).toBe(false);
    expect(plain?.hasAttribute('stroke-linecap')).toBe(false);
  });

  it('draws dash, weight and the light stroke of a named colour', () => {
    const path = edgePath(styled({ dash: 'dashed', width: 3, color: 'blue' }));
    expect(path?.getAttribute('stroke')).toBe(LIGHT_PALETTE.cardColours.blue.stroke);
    expect(path?.getAttribute('stroke-width')).toBe('3');
    expect(path?.getAttribute('stroke-dasharray')).toBe('12 10.5');
  });

  it('draws dots with round caps and a custom hex', () => {
    const path = edgePath(styled({ dash: 'dotted', color: '#7a3cff' }));
    expect(path?.getAttribute('stroke-dasharray')).toBe('0 6');
    expect(path?.getAttribute('stroke-linecap')).toBe('round');
    expect(path?.getAttribute('stroke')).toBe('#7a3cff');
  });

  it('lets a heavier line grow the arrow', () => {
    const arrow = (file: SododeckFile) =>
      parse(svgOf(file)).querySelector('[data-mark="arrow"]')?.getAttribute('transform');
    expect(arrow(styled({ width: 4 }))).toMatch(/scale\(1\.5\)/);
    expect(arrow(deck)).not.toMatch(/scale/);
  });

  it('never animates in an export', () => {
    expect(svgOf(styled({ animated: true, dash: 'dashed' }))).not.toMatch(/animate|@keyframes/);
  });
});

describe('renderSvg: bundles and proxies (034 R9)', () => {
  const parallel = deckOf({
    nodes: [
      { id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } },
      { id: 'b', type: 'service', title: 'B', position: { x: 400, y: 0 } },
    ],
    edges: [
      { id: 'e1', from: 'a', to: 'b' },
      { id: 'e2', from: 'a', to: 'b' },
    ],
  });

  it('draws the Ink "×n" pill on a folded curve', () => {
    const doc = parse(svgOf(parallel));
    const edge = doc.querySelector('[data-export="edge"][data-id="bundle:a|b"]');
    const pill = edge?.querySelector('[data-part="bundle-pill"]');
    expect(pill?.getAttribute('fill')).toBe(LIGHT_PALETTE.ink);
    expect(pill?.getAttribute('stroke')).toBe(LIGHT_PALETTE.canvas);
    expect(pill?.getAttribute('height')).toBe('22');
    const label = edge?.querySelector('text');
    expect(label?.textContent).toBe('×2');
    expect(label?.getAttribute('fill')).toBe(LIGHT_PALETTE.surface);
  });

  it('draws the dashed Outside proxy with its title', () => {
    const outside = deckOf({
      nodes: [
        { id: 'in', type: 'service', title: 'In', group: 'g', position: { x: 0, y: 0 } },
        { id: 'out', type: 'database', title: 'Orders DB', position: { x: 600, y: 0 } },
      ],
      groups: [{ id: 'g', title: 'G' }],
      edges: [{ id: 'e', from: 'in', to: 'out' }],
    });
    const doc = parse(
      svgOf(
        outside,
        {},
        {
          scope: 'view',
          ui: { ...ui, drill: [{ kind: 'group', id: 'g', viewport: { x: 0, y: 0, zoom: 1 } }] },
        },
      ),
    );
    const port = doc.querySelector('[data-export="port"][data-id="port:out"]');
    expect(port?.querySelector('[data-part="proxy"]')?.getAttribute('stroke-dasharray')).toBe(
      '5 4',
    );
    expect(port?.textContent).toContain('Orders DB');
    expect(port?.textContent).toContain('Outside');
  });
});

describe('renderSvg card types (030)', () => {
  it('draws the icon of each type and the fallback for an unknown one', () => {
    const typed = deckOf({
      nodes: [
        { id: 'w', type: 'warehouse', title: 'Hub', position: { x: 0, y: 0 } },
        { id: 'r', type: 'robot', title: 'Rover', position: { x: 300, y: 0 } },
      ],
    });
    const svg = renderSvg(buildScene({ deck: typed, scope: 'deck', ui }), options);
    expect(svg).toContain('M18 21V10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v11');
    expect(svg).toContain('M8.3 10a.7.7 0 0 1-.626-1.079');
  });
});
