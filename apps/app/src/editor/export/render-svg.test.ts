import type { SododeckFile } from '@sododeck/schema';
import { describe, expect, it } from 'vitest';

import { branchedDeck } from '../../test/flow-fixtures';
import { deckOf } from '../../test/render-canvas';
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
      title: 'A very long component title that cannot fit on one card',
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
    expect(doc.querySelectorAll('[data-export="edge"] path')).toHaveLength(1);
    expect(doc.querySelectorAll('[data-export="sticky"]')).toHaveLength(1);
    const edgeTexts = [...doc.querySelectorAll('[data-export="edge"] text')];
    expect(edgeTexts.map((node) => node.textContent)).toEqual(['SQL']);
  });

  it('truncates long titles with an ellipsis', () => {
    const doc = parse(svgOf(deck));
    const card = doc.querySelector('[data-export="card"][data-id="b"]');
    const title = card?.querySelector('text')?.textContent ?? '';
    expect(title.endsWith('…')).toBe(true);
    expect(title.length).toBeLessThan(30);
  });

  it('draws the rules glyph and the child count', () => {
    const doc = parse(svgOf(deck));
    const parent = doc.querySelector('[data-export="card"][data-id="p"]');
    expect([...(parent?.querySelectorAll('text') ?? [])].map((node) => node.textContent)).toContain(
      '1',
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
});
