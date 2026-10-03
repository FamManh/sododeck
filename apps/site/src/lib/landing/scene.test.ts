import { describe, expect, it } from 'vitest';

import { ALL_EDGES, ALL_NODES, NODES, SEQUENCE, WORLD } from './checkout-deck';
import { FLOW_CROP, ORDERS_CROP, PAYMENTS_DRILL, PAYMENTS_DRILL_PHONE } from './crops';
import { edgeStroke, layoutScene, nodeBox } from './scene';

describe('nodeBox', () => {
  it('sizes cards, shapes and proxies', () => {
    expect(nodeBox(NODES.svc)).toEqual({ x: 300, y: 72, w: 184, h: 102 });
    expect(nodeBox(NODES.cancel)).toEqual({ x: 600, y: 420, w: 136, h: 40, anchor: 20 });
    const proxy = ORDERS_CROP.nodes[0];
    expect(proxy === undefined ? null : nodeBox(proxy)).toMatchObject({ h: 46, anchor: 23 });
  });
});

describe('the Checkout deck', () => {
  it('connects every edge and fits in its world', () => {
    const scene = layoutScene(ALL_NODES, ALL_EDGES);
    expect(scene.edges).toHaveLength(ALL_EDGES.length);
    for (const box of scene.boxes.values()) {
      expect(box.x + box.w).toBeLessThanOrEqual(WORLD.w);
      expect(box.y + box.h).toBeLessThanOrEqual(WORLD.h);
    }
  });

  it('plays the flow over real connectors to real cards', () => {
    const ids = new Set(ALL_EDGES.map((e) => e.id));
    const keys = new Set(ALL_NODES.map((n) => n.key));
    for (const hop of SEQUENCE) {
      expect(ids.has(hop.edge)).toBe(true);
      expect(keys.has(hop.node)).toBe(true);
    }
    expect(SEQUENCE.map((hop) => hop.n)).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('crops', () => {
  it('connect every connector to a card or proxy in the crop', () => {
    for (const crop of [ORDERS_CROP, FLOW_CROP, PAYMENTS_DRILL, PAYMENTS_DRILL_PHONE]) {
      expect(layoutScene(crop.nodes, crop.edges).edges).toHaveLength(crop.edges.length);
    }
  });

  it('keep every card inside their world, so nothing meets the frame edge', () => {
    for (const crop of [ORDERS_CROP, PAYMENTS_DRILL, PAYMENTS_DRILL_PHONE]) {
      for (const box of layoutScene(crop.nodes, crop.edges).boxes.values()) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.w).toBeLessThanOrEqual(crop.width);
        expect(box.y + box.h).toBeLessThanOrEqual(crop.height);
      }
    }
  });
});

describe('edgeStroke', () => {
  it('styles each connector state', () => {
    expect(edgeStroke('default', true)).toMatchObject({ dash: '12 3', width: 2 });
    expect(edgeStroke('current', true)).toEqual({
      colour: 'var(--sd-primary)',
      width: 3.25,
      opacity: 1,
    });
    expect(edgeStroke('dim', false).opacity).toBe(0.2);
    expect(edgeStroke('error', false)).toMatchObject({ dash: '7 4', colour: 'var(--sd-clay-ink)' });
    expect(edgeStroke('done', false).width).toBe(2.5);
    expect(edgeStroke('highlight', false).colour).toBe('var(--sd-ink)');
  });
});
