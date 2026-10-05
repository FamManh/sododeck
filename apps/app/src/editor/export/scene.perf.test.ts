import { describe, expect, it } from 'vitest';

import { generateBenchDeck } from '../../bench/generate-deck';
import { LIGHT_PALETTE } from './export-palette';
import { renderSvg } from './render-svg';
import { buildScene } from './scene';
import { fixedWidthMeasurer } from './text-measure';

/**
 * Regression ceiling in jsdom. The real budget (< 50 ms, no long task) is measured in the bench
 * browser (`pnpm bench`, export-preview scenario; ADR 0016).
 */
const CEILING_MS = 250;

describe('export scene performance', () => {
  it('builds and renders 500 components / 1,000 connections under the ceiling', () => {
    const { deck } = generateBenchDeck(500, 1000, 42, { flows: true, groups: true, stickies: 20 });
    const ui = {
      currentViewId: null,
      revealed: new Set<string>(),
      drill: [],
      activeFlowId: null,
    };
    const measure = fixedWidthMeasurer();
    // Warm-up run (module init, JIT), then a timed one on a fresh copy: the canvas helpers
    // memoise per deck object, and a real preview meets a new snapshot.
    buildScene({ deck, scope: 'deck', ui });
    const fresh = structuredClone(deck);
    const start = performance.now();
    const scene = buildScene({ deck: fresh, scope: 'deck', ui });
    const svg = renderSvg(scene, {
      transparent: false,
      palette: LIGHT_PALETTE,
      fonts: '',
      measure,
      title: 'Bench',
    });
    const elapsed = performance.now() - start;
    console.info(
      `export scene + svg (500 / 1000): ${elapsed.toFixed(1)} ms, ${String(svg.length)} chars`,
    );
    expect(scene.cards.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(CEILING_MS);
  });

  it('builds and renders 150 tables × 12 columns under the same ceiling (041)', () => {
    const { deck } = generateBenchDeck(150, 300, 42, { tables: 150 });
    const ui = {
      currentViewId: null,
      revealed: new Set<string>(),
      drill: [],
      activeFlowId: null,
    };
    buildScene({ deck, scope: 'deck', ui });
    const fresh = structuredClone(deck);
    const start = performance.now();
    const scene = buildScene({ deck: fresh, scope: 'deck', ui });
    const svg = renderSvg(scene, {
      transparent: false,
      palette: LIGHT_PALETTE,
      fonts: '',
      measure: fixedWidthMeasurer(),
      title: 'Bench',
    });
    const elapsed = performance.now() - start;
    console.info(`export scene + svg (150 tables): ${elapsed.toFixed(1)} ms`);
    expect(scene.cards.every((card) => card.table?.rows.length === 12)).toBe(true);
    expect(svg).toContain('data-part="row"');
    expect(elapsed).toBeLessThan(CEILING_MS);
  });

  it('builds and renders 150 tables with ~200 relationships under the same ceiling (042)', () => {
    const { deck } = generateBenchDeck(500, 1000, 42, { tables: 150, rel: true });
    const ui = {
      currentViewId: null,
      revealed: new Set<string>(),
      drill: [],
      activeFlowId: null,
    };
    buildScene({ deck, scope: 'deck', ui });
    const fresh = structuredClone(deck);
    const start = performance.now();
    const scene = buildScene({ deck: fresh, scope: 'deck', ui });
    renderSvg(scene, {
      transparent: false,
      palette: LIGHT_PALETTE,
      fonts: '',
      measure: fixedWidthMeasurer(),
      title: 'Bench',
    });
    const elapsed = performance.now() - start;
    console.info(`export scene + svg (150 tables, relationships): ${elapsed.toFixed(1)} ms`);
    expect(scene.edges.filter((edge) => edge.rel !== undefined).length).toBeGreaterThan(150);
    expect(elapsed).toBeLessThan(CEILING_MS);
  });

  it('builds and renders 500 components / 1,000 connections with 50 images under the ceiling (055)', () => {
    const { deck } = generateBenchDeck(500, 1000, 42, { groups: true, images: 50 });
    const ui = {
      currentViewId: null,
      revealed: new Set<string>(),
      drill: [],
      activeFlowId: null,
    };
    buildScene({ deck, scope: 'deck', ui });
    const fresh = structuredClone(deck);
    const start = performance.now();
    const scene = buildScene({ deck: fresh, scope: 'deck', ui });
    const pictures = new Map(
      Object.keys(fresh.assets ?? {}).map((id) => [id, 'data:image/png;base64,AAAA']),
    );
    const svg = renderSvg(scene, {
      transparent: false,
      palette: LIGHT_PALETTE,
      fonts: '',
      measure: fixedWidthMeasurer(),
      title: 'Bench',
      pictures,
    });
    const elapsed = performance.now() - start;
    console.info(`export scene + svg (500 / 1000, 50 images): ${elapsed.toFixed(1)} ms`);
    expect(scene.images).toHaveLength(50);
    expect(scene.stack.length).toBe(scene.cards.length + 50);
    expect(svg.match(/<image /g)).toHaveLength(50);
    expect(elapsed).toBeLessThan(CEILING_MS);
  });
});
