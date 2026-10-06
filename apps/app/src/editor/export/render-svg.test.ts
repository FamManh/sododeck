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

  it("draws a note's wrapped text at its fitted size, aligned, with tag chips", () => {
    const notes = deckOf({
      nodes: [{ id: 'a', type: 'service', title: 'A', position: { x: 0, y: 0 } }],
      stickies: [
        {
          id: 'n',
          text: 'Alpha **beta** gamma',
          position: { x: 0, y: 300 },
          align: 'left',
          tags: ['Ops'],
        },
        { id: 'k', text: 'Folded', collapsed: true, position: { x: 400, y: 300 } },
      ],
    });
    const doc = parse(svgOf(notes));
    expect(doc.querySelector('parsererror')).toBeNull();
    const sheet = doc.querySelector('[data-export="sticky"][data-id="n"]');
    const lines = [...(sheet?.querySelectorAll('text.sn') ?? [])];
    expect(lines.map((line) => line.textContent).join(' ')).toBe('Alpha beta gamma');
    expect(lines[0]?.getAttribute('font-size')).not.toBeNull();
    expect(lines[0]?.getAttribute('text-anchor')).toBeNull();
    expect(sheet?.querySelectorAll('[data-part="tag"]')).toHaveLength(1);
    expect(sheet?.querySelector('text.tg')?.textContent).toBe('Ops');
    // A collapsed note keeps one line, with no lock or body.
    const folded = doc.querySelector('[data-export="sticky"][data-id="k"]');
    expect(folded?.querySelector('text.t')?.textContent).toBe('Folded');
    expect(folded?.querySelectorAll('text.sn')).toHaveLength(0);
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

describe('renderSvg card icons (038)', () => {
  const iconed = deckOf({
    nodes: [
      {
        id: 'c',
        type: 'service',
        title: 'Custom',
        icon: 'lucide:search',
        position: { x: 0, y: 0 },
      },
      {
        id: 'k',
        type: 'service',
        title: 'Kafka',
        icon: 'simple:kafka',
        position: { x: 300, y: 0 },
      },
    ],
  });

  it("draws the card's custom icon in the header tile, and the type icon for one it cannot show", () => {
    const doc = parse(renderSvg(buildScene({ deck: iconed, scope: 'deck', ui }), options));
    const custom = doc.querySelector('[data-export="card"][data-id="c"]')?.innerHTML ?? '';
    const kafka = doc.querySelector('[data-export="card"][data-id="k"]')?.innerHTML ?? '';
    expect(custom).toContain('<circle cx="11" cy="11" r="8"');
    expect(custom).not.toContain('M21 8a2 2 0 0 0-1-1.73');
    expect(kafka).toContain('M21 8a2 2 0 0 0-1-1.73');
  });

  it('draws a filled icon of a solid set with fill and no stroke', () => {
    const built = buildScene({ deck: iconed, scope: 'deck', ui });
    const solid = {
      set: 'solid-test',
      name: 'dot',
      label: 'Dot',
      style: 'solid' as const,
      node: [['circle', { cx: 12, cy: 12, r: 5 }]] as const,
    };
    const svg = renderSvg(
      { ...built, cards: built.cards.map((card) => ({ ...card, icon: solid })) },
      options,
    );
    const doc = parse(svg);
    const group = doc
      .querySelector('[data-export="card"][data-id="c"]')
      ?.querySelector('circle[r="5"]')?.parentElement;
    expect(group?.getAttribute('fill')).not.toBe('none');
    expect(group?.hasAttribute('stroke')).toBe(false);
  });
});

describe('renderSvg: typed fields (032)', () => {
  const typed = deckOf({
    nodes: [
      {
        id: 't',
        type: 'task',
        title: 'Write spec',
        position: { x: 0, y: 0 },
        values: { 'task.status': 'doing', 'task.assignee': 'Lan' },
      },
      {
        id: 'w',
        type: 'warehouse',
        title: 'HCM',
        position: { x: 300, y: 0 },
        values: { 'warehouse.capacity': 82, 'warehouse.sla': 24 },
        owner: 'Minh',
      },
    ],
    fields: [
      {
        id: 'warehouse.capacity',
        name: 'Capacity',
        kind: 'progress',
        types: ['warehouse'],
        onCard: true,
      },
      { id: 'warehouse.sla', name: 'SLA', kind: 'number', unit: 'h', types: ['warehouse'] },
      {
        id: 'warehouse.region',
        name: 'Region',
        kind: 'select',
        types: ['warehouse'],
        onCard: true,
      },
    ],
    fieldDefaults: ['warehouse'],
  });
  const doc = parse(svgOf(typed));

  it('draws the header status chip, person chip and initials like the canvas', () => {
    const task = inCard(doc, 't');
    const texts = [...(task?.querySelectorAll('text') ?? [])].map((t) => t.textContent);
    expect(texts).toContain('In progress');
    expect(texts).toContain('Lan');
    expect(texts).toContain('L');
    const chips = task?.querySelectorAll('[data-part="field-chip"]');
    expect(chips?.length).toBe(2);
    expect(chips?.[0]?.getAttribute('fill')).toBe(LIGHT_PALETTE.cardChips.blue.chip);
  });

  it('draws progress as a bar row, and hidden values as a dashed pill', () => {
    const wh = inCard(doc, 'w');
    const texts = [...(wh?.querySelectorAll('text') ?? [])].map((t) => t.textContent);
    expect(texts).toEqual(expect.arrayContaining(['Capacity', '82 %', '+1 field']));
    expect(wh?.querySelector('[data-part="bar"]')).not.toBeNull();
    const pill = wh?.querySelector('[data-part="more-fields"]');
    expect(pill?.getAttribute('stroke-dasharray')).toBe('3 2');
  });
});

describe('shapes in the export (031 FR-016)', () => {
  const shapes = deckOf({
    nodes: [
      { id: 'ok', type: 'diamond', title: 'Payment OK?', position: { x: 0, y: 0 } },
      {
        id: 'db',
        type: 'database',
        display: 'shape',
        title: 'Orders DB',
        position: { x: 400, y: 0 },
        style: { fill: 'blue', stroke: 'red' },
      },
      { id: 'who', type: 'actor', title: 'Customer', position: { x: 0, y: 300 } },
      { id: 'h', type: 'text', title: 'Checkout v2', position: { x: 400, y: 300 } },
      { id: 'svc', type: 'service', title: 'Svc', position: { x: 800, y: 0 } },
    ],
    edges: [{ id: 'e', from: 'ok', to: 'db' }],
  });

  it('draws each shape’s geometry, lip and centred title; cards stay cards', () => {
    const doc = parse(svgOf(shapes));
    const shape = (id: string) => doc.querySelector(`[data-export="shape"][data-id="${id}"]`);
    expect(shape('ok')?.querySelector('[data-part="outline"]')?.getAttribute('d')).toMatch(/^M /);
    expect(shape('ok')?.querySelector('[data-part="lip"]')).not.toBeNull();
    const title = shape('ok')?.querySelector('text');
    expect(title?.textContent).toBe('Payment OK?');
    expect(title?.getAttribute('text-anchor')).toBe('middle');
    // Actor: no lip; text: no outline at all.
    expect(shape('who')?.querySelector('[data-part="lip"]')).toBeNull();
    expect(shape('who')?.querySelector('[data-part="extra"]')).not.toBeNull();
    expect(shape('h')?.querySelector('[data-part="outline"]')).toBeNull();
    expect(shape('h')?.querySelector('text')?.textContent).toBe('Checkout v2');
    expect(doc.querySelector('[data-export="card"][data-id="svc"]')).not.toBeNull();
    expect(doc.querySelector('[data-export="card"][data-id="ok"]')).toBeNull();
  });

  it('takes the shape’s colours (not on the text shape) and never tilts', () => {
    const svg = svgOf(shapes);
    const doc = parse(svg);
    const outline = doc.querySelector('[data-export="shape"][data-id="db"] [data-part="outline"]');
    expect(outline?.getAttribute('fill')).not.toBe(LIGHT_PALETTE.surface);
    expect(outline?.getAttribute('stroke')).not.toBe(LIGHT_PALETTE.borderStrong);
    for (const group of doc.querySelectorAll('[data-export="shape"]')) {
      expect(group.outerHTML).not.toMatch(/rotate|transform/);
    }
  });

  it('turns a turned text around its box centre, as on the canvas (ADR 0043)', () => {
    const turned = deckOf({
      nodes: [
        {
          id: 'h',
          type: 'text',
          title: 'Checkout v2',
          position: { x: 400, y: 300 },
          size: { width: 160, height: 40 },
          rotation: -30,
        },
        // Kept and ignored on any other type.
        { id: 'ok', type: 'diamond', title: 'OK?', position: { x: 0, y: 0 }, rotation: 45 },
      ],
    });
    const doc = parse(svgOf(turned));
    const shape = (id: string) => doc.querySelector(`[data-export="shape"][data-id="${id}"]`);
    expect(shape('h')?.getAttribute('transform')).toBe('rotate(-30 480 320)');
    expect(shape('ok')?.hasAttribute('transform')).toBe(false);
  });
});

describe('renderSvg: table cards (041 US5)', () => {
  const shop = deckOf({
    enums: [{ id: 'e', name: 'order_status', color: 'violet', values: [] }],
    nodes: [
      {
        id: 'orders',
        type: 'db-table',
        title: 'orders',
        position: { x: 0, y: 0 },
        columns: [
          { id: 'o-id', name: 'id', type: 'uuid', pk: true },
          { id: 'o-n', name: 'number', type: 'text', notNull: true, unique: true },
          { id: 'o-s', name: 'status', type: 'order_status', enumRef: 'e', notNull: true },
          { id: 'o-q', name: 'coupon', type: 'text' },
        ],
        indexes: [
          { id: 'ix', columns: ['o-n'] },
          { id: 'ix2', columns: ['o-q'] },
        ],
      },
      {
        id: 'keys',
        type: 'db-table',
        title: 'keys_only',
        position: { x: 400, y: 0 },
        detail: 'keys',
        columns: [
          { id: 'k-id', name: 'id', type: 'int', pk: true },
          { id: 'k-x', name: 'x', type: 'int' },
        ],
      },
    ],
  });

  it('draws rows as text with glyph paths, the enum chip, the pill and the footer', () => {
    const svg = svgOf(shop);
    const doc = parse(svg);
    expect(svg).not.toContain('foreignObject');
    const rows = [...doc.querySelectorAll('[data-part="row"]')];
    expect(rows.map((row) => row.getAttribute('data-column'))).toEqual([
      'o-id',
      'o-n',
      'o-s',
      'o-q',
      'k-id',
    ]);
    const texts = (row: Element | undefined) =>
      [...(row?.querySelectorAll('text') ?? [])].map((t) => t.textContent);
    expect(texts(rows[0])).toEqual(['id', 'uuid']);
    expect(rows[0]?.querySelector('g path, g circle')).not.toBeNull();
    expect(texts(rows[1])).toEqual(['U', 'number', 'text']);
    expect(rows[2]?.querySelector('[data-part="enum"]')).not.toBeNull();
    expect(texts(rows[2])).toEqual(['status', 'order_status']);
    expect(texts(rows[3])).toEqual(['coupon', 'text', '?']);
    const all = [...doc.querySelectorAll('text')].map((t) => t.textContent);
    expect(all).toContain('2 indexes');
    expect(all).toContain('+1 columns');
    expect(doc.querySelectorAll('[data-part="hairline"]')).toHaveLength(2);
  });
});

describe('renderSvg: row limit (048)', () => {
  const long = (expanded: boolean) =>
    deckOf({
      nodes: [
        {
          id: 'wide',
          type: 'db-table',
          title: 'wide',
          position: { x: 0, y: 0 },
          ...(expanded ? { expanded } : {}),
          columns: Array.from({ length: 30 }, (_, i) => ({
            id: `c${String(i)}`,
            name: `c${String(i)}`,
            type: 'int',
            ...(i === 0 ? { pk: true } : {}),
          })),
        },
      ],
    });

  it('draws the limited rows and the Show all button, as the canvas does', () => {
    const doc = parse(svgOf(long(false)));
    expect(doc.querySelectorAll('[data-part="row"]')).toHaveLength(12);
    expect(doc.querySelectorAll('[data-part="show-all"]')).toHaveLength(1);
    const labels = [...doc.querySelectorAll('text')].map((t) => t.textContent);
    expect(labels).toContain('Show all 30 columns');
  });

  it('draws every row and "Show fewer" for an opened table, one row taller per column', () => {
    const limited = parse(svgOf(long(false)));
    const open = parse(svgOf(long(true)));
    expect(open.querySelectorAll('[data-part="row"]')).toHaveLength(30);
    expect([...open.querySelectorAll('text')].map((t) => t.textContent)).toContain('Show fewer');
    const height = (doc: Document) =>
      Number(doc.querySelector('[data-export="card"] rect')?.getAttribute('height'));
    expect(height(open) - height(limited)).toBe(18 * 24);
  });
});

describe('renderSvg relationships (042 FR-027)', () => {
  const shop = deckOf({
    nodes: [
      {
        id: 'orders',
        type: 'db-table',
        title: 'orders',
        position: { x: 0, y: 0 },
        columns: [
          { id: 'o.id', name: 'id', type: 'uuid', pk: true },
          { id: 'o.cid', name: 'customer_id', type: 'uuid' },
        ],
      },
      {
        id: 'customers',
        type: 'db-table',
        title: 'customers',
        position: { x: 500, y: 0 },
        columns: [{ id: 'c.id', name: 'id', type: 'uuid', pk: true }],
      },
    ],
    edges: [
      {
        id: 'fk',
        from: 'orders',
        to: 'customers',
        fromColumns: ['o.cid'],
        toColumns: ['c.id'],
        cardinality: 'n-1',
        fromOptional: true,
        toOptional: true,
      },
    ],
  });

  it('draws crow paths and canvas-filled rings, with no knob, arrow or foreignObject', () => {
    const svg = svgOf(shop);
    expect(svg).toContain('data-mark="zero-many"');
    expect(svg).toContain('data-mark="ring"');
    expect(svg).toContain(`fill="${LIGHT_PALETTE.canvas}"`);
    expect(svg).not.toContain('data-mark="knob"');
    expect(svg).not.toContain('data-mark="arrow"');
    expect(svg).not.toContain('<foreignObject');
  });

  it('draws 1 / n text ends', () => {
    const svg = svgOf({ ...shop, relationshipDisplay: { notation: 'numeric' } });
    expect(svg).toContain('>0..n</text>');
    expect(svg).toContain('>0..1</text>');
  });
});

describe('renderSvg: cropped and flipped images (057)', () => {
  const asset = 'c'.repeat(64);
  const DATA = 'data:image/png;base64,AAAA';
  const facts = { type: 'image/png' as const, bytes: 1, width: 1280, height: 800, data: '' };
  const edited = deckOf({
    images: [
      {
        id: 'img-k3m9',
        asset,
        position: { x: 120, y: 80 },
        size: { width: 240, height: 150 },
        crop: { x: 0.25, y: 0.1, width: 0.5, height: 0.5 },
        flipX: true,
      },
    ],
    assets: { [asset]: { ...facts, name: 'shot.png' } },
  });
  const pictures = new Map([[asset, DATA]]);

  it('draws the crop as a nested <svg viewBox>, mirrored inside it', () => {
    const svg = svgOf(edited, { pictures });
    const doc = parse(svg);
    expect(doc.querySelector('parsererror')).toBeNull();
    const group = doc.querySelector('[data-export="image"][data-id="img-k3m9"]');
    const view = group?.querySelector('svg');
    expect(view?.getAttribute('x')).toBe('120');
    expect(view?.getAttribute('y')).toBe('80');
    expect(view?.getAttribute('width')).toBe('240');
    expect(view?.getAttribute('height')).toBe('150');
    expect(view?.getAttribute('viewBox')).toBe('320 80 640 400');
    expect(view?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
    const image = view?.querySelector('image');
    expect(image?.getAttribute('href')).toBe(DATA);
    expect(image?.getAttribute('width')).toBe('1280');
    expect(image?.getAttribute('height')).toBe('800');
    expect(image?.getAttribute('transform')).toBe('translate(1280 0) scale(-1 1)');
    expect(svg).not.toMatch(/(?:href|src)="(?!data:|#)/);
  });

  it('mirrors on both axes, and draws a flip without a crop over the whole picture', () => {
    const both = deckOf({
      images: [
        {
          id: 'i',
          asset,
          position: { x: 0, y: 0 },
          size: { width: 128, height: 80 },
          flipX: true,
          flipY: true,
        },
      ],
      assets: { [asset]: { ...facts, name: 'shot.png' } },
    });
    const view = parse(svgOf(both, { pictures })).querySelector('[data-id="i"] svg');
    expect(view?.getAttribute('viewBox')).toBe('0 0 1280 800');
    expect(view?.querySelector('image')?.getAttribute('transform')).toBe(
      'translate(1280 800) scale(-1 -1)',
    );
  });

  it('keeps the placeholder of a missing picture unmirrored', () => {
    const lost = parse(svgOf(edited)).querySelector('[data-id="img-k3m9"]');
    expect(lost?.querySelector('svg')).toBeNull();
    expect(lost?.querySelector('[transform]')).toBeNull();
    expect(lost?.textContent).toContain('Picture missing');
  });
});

describe('renderSvg: images (055)', () => {
  const asset = 'a'.repeat(64);
  const GONE = 'b'.repeat(64);
  const DATA = 'data:image/png;base64,AAAA';
  const facts = { type: 'image/png' as const, bytes: 1, width: 4, height: 3, data: '' };
  const picture = (id: string, x: number, extra: Record<string, unknown> = {}) => ({
    id,
    asset,
    position: { x, y: 300 },
    size: { width: 80, height: 60 },
    ...extra,
  });
  const file = deckOf({
    nodes: [
      { id: 'c0', type: 'service', title: 'C0', position: { x: 0, y: 0 } },
      { id: 'c1', type: 'service', title: 'C1', position: { x: 400, y: 0 } },
    ],
    images: [
      picture('i0', 0, { alt: 'Logo <1> & "co"', caption: 'Figure' }),
      picture('lost', 200, { asset: GONE, size: { width: 240, height: 140 } }),
    ],
    assets: { [asset]: { ...facts, name: 'a.png' }, [GONE]: { ...facts, name: 'gone.png' } },
    edges: [{ id: 'e', from: 'c0', to: 'c1' }],
  });
  const pictures = new Map([[asset, DATA]]);

  it('draws an <image> with the data URI at its box, with its alt text as title', () => {
    const svg = svgOf(file, { pictures });
    const doc = parse(svg);
    expect(doc.querySelector('parsererror')).toBeNull();
    const group = doc.querySelector('[data-export="image"][data-id="i0"]');
    const image = group?.querySelector('image');
    expect(image?.getAttribute('href')).toBe(DATA);
    expect(image?.getAttribute('x')).toBe('0');
    expect(image?.getAttribute('y')).toBe('300');
    expect(image?.getAttribute('width')).toBe('80');
    expect(image?.getAttribute('height')).toBe('60');
    expect(image?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
    expect(group?.querySelector('title')?.textContent).toBe('Logo <1> & "co"');
    expect(svg).toContain('Figure');
  });

  it('draws the placeholder for a picture it has no bytes for, with file name and caption', () => {
    const svg = svgOf(file, { pictures });
    const lost = parse(svg).querySelector('[data-export="image"][data-id="lost"]');
    expect(lost?.querySelector('image')).toBeNull();
    expect(lost?.textContent).toContain('Picture missing');
    expect(lost?.textContent).toContain('gone.png');
    // Without any bytes at all, every image is a placeholder.
    expect(parse(svgOf(file)).querySelectorAll('[data-export="image"] image')).toHaveLength(0);
  });

  it('writes no reference outside the file', () => {
    const svg = svgOf(file, { pictures });
    expect(svg).not.toMatch(/(?:href|src)="(?!data:|#)/);
    expect(svg).not.toContain('http://www.w3.org/1999/xlink');
  });

  it('draws images and cards in stack order, over the connectors', () => {
    const doc = parse(svgOf(file, { pictures }));
    const order = [...doc.querySelectorAll('[data-export="image"], [data-export="card"]')].map(
      (el) => el.getAttribute('data-id'),
    );
    // c0 and i0 tie at rank 0 (cards first), then c1 and the second image.
    expect(order).toEqual(['c0', 'i0', 'c1', 'lost']);
    const body = svgOf(file, { pictures });
    expect(body.indexOf('data-id="i0"')).toBeGreaterThan(body.indexOf('data-export="edge"'));
  });

  it('draws an image below every card before the connectors', () => {
    const below = deckOf({
      nodes: [
        { id: 'c0', type: 'service', title: 'C0', position: { x: 0, y: 0 }, z: 5 },
        { id: 'c1', type: 'service', title: 'C1', position: { x: 400, y: 0 }, z: 6 },
      ],
      images: [picture('i0', 0, { z: -1 })],
      assets: { [asset]: { ...facts, name: 'a.png' } },
      edges: [{ id: 'e', from: 'c0', to: 'c1' }],
    });
    const svg = svgOf(below, { pictures });
    expect(svg.indexOf('data-id="i0"')).toBeLessThan(svg.indexOf('data-id="e"'));
  });

  it('a deck without images renders exactly as before', async () => {
    const { createHash } = await import('node:crypto');
    const plain = deckOf({
      nodes: [
        { id: 'a', type: 'service', title: 'A <b> & "c"', tech: "it's", position: { x: 0, y: 0 } },
        { id: 'b', type: 'database', title: 'B', position: { x: 300, y: 0 }, rules: ['r'] },
        { id: 'c', type: 'service', title: 'C', position: { x: 0, y: 200 }, group: 'g' },
      ],
      groups: [{ id: 'g', title: 'Group' }],
      edges: [{ id: 'ab', from: 'a', to: 'b', label: 'SQL' }],
      rules: { r: { title: 'R', hitPolicy: 'first', inputs: [], outputs: [], rows: [] } },
      stickies: [{ id: 's', text: 'Note', position: { x: 0, y: 400 } }],
    });
    const svg = renderSvg(buildScene({ deck: plain, scope: 'deck', ui }), {
      ...options,
      fonts: '',
      title: 'Deck',
    });
    expect(createHash('sha256').update(svg).digest('hex')).toBe(
      '74fce24cb9f31da6b5152384c4f03c2fe61becbb7a93eca0d3bdae4047ae63d9',
    );
  });
});
