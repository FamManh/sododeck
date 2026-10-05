import { describe, expect, it } from 'vitest';

import {
  connectTarget,
  hitTarget,
  TARGET_REACH,
  targetScene,
  type SceneNode,
} from './endpoint-target';

const card = (
  id: string,
  x: number,
  y: number,
  extra: Partial<SceneNode> = {},
  width = 200,
  height = 100,
): SceneNode => ({
  id,
  type: 'deck',
  position: { x, y },
  width,
  height,
  data: {},
  ...extra,
});

const frame = (
  groupId: string,
  x: number,
  y: number,
  width: number,
  height: number,
): SceneNode => ({
  id: `group:${groupId}`,
  type: 'group-boundary',
  position: { x, y },
  width,
  height,
  zIndex: -1,
  data: {},
});

describe('hitTarget (050 R4)', () => {
  it('reaches 16 screen px', () => {
    expect(TARGET_REACH).toBe(16);
  });

  it('returns the card under the pointer, with its box and flow id', () => {
    const scene = targetScene([card('a', 0, 0)]);
    expect(hitTarget({ x: 50, y: 50 }, scene, 1)).toEqual({
      id: 'a',
      kind: 'node',
      flowId: 'a',
      box: { x: 0, y: 0, width: 200, height: 100 },
    });
    expect(hitTarget({ x: 500, y: 500 }, scene, 1)).toBeNull();
  });

  it('the topmost card in paint order wins', () => {
    const scene = targetScene([card('below', 0, 0), card('above', 100, 50)]);
    expect(hitTarget({ x: 150, y: 80 }, scene, 1)?.id).toBe('above');
    // a higher zIndex paints on top even when listed first
    const raised = targetScene([card('raised', 100, 50, { zIndex: 5 }), card('plain', 0, 0)]);
    expect(hitTarget({ x: 150, y: 80 }, raised, 1)?.id).toBe('raised');
  });

  it('reaches 16 screen px outside a card, scaled by zoom', () => {
    const scene = targetScene([card('a', 0, 0)]);
    expect(hitTarget({ x: 215, y: 50 }, scene, 1)?.id).toBe('a');
    expect(hitTarget({ x: 217, y: 50 }, scene, 1)).toBeNull();
    // zoom 2: 16 screen px are 8 canvas px
    expect(hitTarget({ x: 207, y: 50 }, scene, 2)?.id).toBe('a');
    expect(hitTarget({ x: 209, y: 50 }, scene, 2)).toBeNull();
    // zoom 0.5: 32 canvas px
    expect(hitTarget({ x: 231, y: 50 }, scene, 0.5)?.id).toBe('a');
  });

  it('a card the pointer is inside wins over a nearby one on top', () => {
    const scene = targetScene([card('inside', 0, 0), card('near', 210, 0)]);
    expect(hitTarget({ x: 199, y: 50 }, scene, 1)?.id).toBe('inside');
  });

  it('a card over a group wins', () => {
    const scene = targetScene([frame('g', -40, -40, 400, 300), card('a', 0, 0)]);
    expect(hitTarget({ x: 50, y: 50 }, scene, 1)).toMatchObject({ id: 'a', kind: 'node' });
  });

  it('inside a group frame but not on a card returns the group', () => {
    const scene = targetScene([frame('g', -40, -40, 400, 300), card('a', 0, 0)]);
    expect(hitTarget({ x: 300, y: 220 }, scene, 1)).toEqual({
      id: 'g',
      kind: 'group',
      flowId: 'group:g',
      box: { x: -40, y: -40, width: 400, height: 300 },
    });
  });

  it('near the frame edge from outside returns the group', () => {
    const scene = targetScene([frame('g', 0, 0, 400, 300)]);
    expect(hitTarget({ x: 410, y: 150 }, scene, 1)?.id).toBe('g');
    expect(hitTarget({ x: 420, y: 150 }, scene, 1)).toBeNull();
  });

  it('the innermost of nested groups wins', () => {
    const scene = targetScene([
      frame('outer', 0, 0, 800, 600),
      frame('inner', 100, 100, 300, 200),
      frame('innermost', 150, 150, 100, 80),
    ]);
    expect(hitTarget({ x: 160, y: 160 }, scene, 1)?.id).toBe('innermost');
    expect(hitTarget({ x: 350, y: 250 }, scene, 1)?.id).toBe('inner');
    expect(hitTarget({ x: 700, y: 500 }, scene, 1)?.id).toBe('outer');
  });

  it('never returns hidden objects, ports or scope labels', () => {
    const scene = targetScene([
      card('hidden', 0, 0, { hidden: true }),
      { ...card('sticky:s', 0, 0, { hidden: true }), type: 'sticky' },
      { ...card('port:x', 0, 0), type: 'port' },
      { ...card('scope-label:g', 0, 0), type: 'scope-label' },
    ]);
    expect(hitTarget({ x: 50, y: 50 }, scene, 1)).toBeNull();
  });

  it('out-of-scope objects are not drawn, so never in the scene', () => {
    // The scene is built only from the drawn flow nodes: a card not drawn can't be hit.
    const scene = targetScene([card('drawn', 0, 0)]);
    expect(hitTarget({ x: 600, y: 600 }, scene, 1)).toBeNull();
  });

  it('collapsed-group cards return kind group with the collapsed box', () => {
    const scene = targetScene([
      {
        id: 'collapsed:g',
        type: 'collapsed-group',
        position: { x: 0, y: 0 },
        width: 240,
        height: 112,
        data: { groupId: 'g' },
      },
    ]);
    expect(hitTarget({ x: 20, y: 20 }, scene, 1)).toEqual({
      id: 'g',
      kind: 'group',
      flowId: 'collapsed:g',
      box: { x: 0, y: 0, width: 240, height: 112 },
    });
  });

  it('carries a shape card geometry, and reads measured sizes', () => {
    const scene = targetScene([
      {
        id: 'd',
        type: 'shape',
        position: { x: 0, y: 0 },
        measured: { width: 176, height: 112 },
        data: { geometry: 'diamond' },
      },
    ]);
    expect(hitTarget({ x: 88, y: 56 }, scene, 1)).toEqual({
      id: 'd',
      kind: 'node',
      flowId: 'd',
      box: { x: 0, y: 0, width: 176, height: 112 },
      geometry: 'diamond',
    });
  });
});

describe('stickies as targets (053 US1)', () => {
  const note = (id: string, x: number, y: number, extra: Partial<SceneNode> = {}): SceneNode => ({
    id: `sticky:${id}`,
    type: 'sticky',
    position: { x, y },
    width: 200,
    height: 200,
    zIndex: 1,
    data: {},
    ...extra,
  });

  it('a note is a target with its bare id, flow id and box', () => {
    const scene = targetScene([note('n', 10, 20)]);
    expect(scene.stickies).toHaveLength(1);
    expect(hitTarget({ x: 100, y: 100 }, scene, 1)).toEqual({
      id: 'n',
      kind: 'sticky',
      flowId: 'sticky:n',
      box: { x: 10, y: 20, width: 200, height: 200 },
    });
  });

  it('a card under the pointer wins over a note nearby, a note wins over a group', () => {
    const scene = targetScene([
      frame('g', -100, -100, 900, 700),
      card('a', 0, 0),
      note('n', 400, 0),
    ]);
    expect(hitTarget({ x: 50, y: 50 }, scene, 1)?.id).toBe('a');
    expect(hitTarget({ x: 500, y: 100 }, scene, 1)).toMatchObject({ id: 'n', kind: 'sticky' });
    expect(hitTarget({ x: 700, y: 500 }, scene, 1)?.id).toBe('g');
  });

  it('a note the pointer is inside wins over a card only within reach', () => {
    const scene = targetScene([card('a', 0, 0), note('n', 205, 0)]);
    expect(hitTarget({ x: 300, y: 50 }, scene, 1)?.id).toBe('n');
  });

  it('reaches 16 screen px around a note', () => {
    const scene = targetScene([note('n', 0, 0)]);
    expect(hitTarget({ x: 215, y: 100 }, scene, 1)?.id).toBe('n');
    expect(hitTarget({ x: 217, y: 100 }, scene, 1)).toBeNull();
  });

  it('connectTarget returns a note but never the one the drag starts from', () => {
    const scene = targetScene([note('n', 0, 0), card('a', 400, 0)]);
    const hit = connectTarget(scene, 'a', { x: 100, y: 100 }, { zoom: 1, mod: false });
    expect(hit?.target).toMatchObject({ id: 'n', kind: 'sticky' });
    expect(
      connectTarget(scene, 'sticky:n', { x: 100, y: 100 }, { zoom: 1, mod: false }),
    ).toBeNull();
  });
});

describe('images as targets (055 US3)', () => {
  const picture = (
    id: string,
    x: number,
    y: number,
    extra: Partial<SceneNode> = {},
  ): SceneNode => ({
    id: `image:${id}`,
    type: 'image',
    position: { x, y },
    width: 120,
    height: 80,
    data: {},
    ...extra,
  });

  it('an image is a target with its bare id, flow id and box', () => {
    expect(hitTarget({ x: 50, y: 50 }, targetScene([picture('i', 10, 20)]), 1)).toEqual({
      id: 'i',
      kind: 'image',
      flowId: 'image:i',
      box: { x: 10, y: 20, width: 120, height: 80 },
    });
  });

  it('stacks with cards: the one painted on top wins where they overlap', () => {
    const above = targetScene([card('a', 0, 0), picture('i', 50, 20)]);
    expect(hitTarget({ x: 100, y: 50 }, above, 1)?.id).toBe('i');
    const below = targetScene([picture('i', 50, 20), card('a', 0, 0)]);
    expect(hitTarget({ x: 100, y: 50 }, below, 1)?.id).toBe('a');
  });

  it('an image wins over the group frame behind it', () => {
    const scene = targetScene([frame('g', -100, -100, 900, 700), picture('i', 10, 20)]);
    expect(hitTarget({ x: 50, y: 50 }, scene, 1)?.id).toBe('i');
  });

  it('ignores a hidden image', () => {
    expect(
      hitTarget({ x: 50, y: 50 }, targetScene([picture('i', 10, 20, { hidden: true })]), 1),
    ).toBeNull();
  });
});
