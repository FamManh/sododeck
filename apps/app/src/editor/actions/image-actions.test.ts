import { toJSON } from '@sododeck/model';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore, type MenuTarget } from '../../state/ui-store';
import { actionContext, sel } from '../../test/action-fixtures';
import { deckOf } from '../../test/render-canvas';
import { actionsFor } from './actions-for';
import { ACTIONS } from './index';
import type { ActionContext, Surface } from './types';

const ASSET = 'a'.repeat(64);
const facts = { type: 'image/png' as const, bytes: 1, width: 400, height: 200, data: '' };
const at = (x: number) => ({ position: { x, y: 0 }, size: { width: 400, height: 200 } });

/** `flipped` is mirrored left to right, `plain` is not, `locked` is locked, `lost` has no facts. */
const deck = deckOf({
  nodes: [{ id: 'n', type: 'service', title: 'N', position: { x: 0, y: 400 } }],
  images: [
    { id: 'flipped', asset: ASSET, ...at(0), flipX: true },
    { id: 'plain', asset: ASSET, ...at(500) },
    { id: 'locked', asset: ASSET, ...at(1000), locked: true },
    { id: 'cropped', asset: ASSET, ...at(1500), crop: { x: 0.5, y: 0, width: 0.5, height: 1 } },
  ],
  assets: { [ASSET]: { ...facts, name: 'a.png' } },
});

const images = (...ids: string[]): MenuTarget => ({
  kind: ids.length === 1 ? 'image' : 'images',
  ids: sel({ images: ids }),
});

function find(ctx: ActionContext, id: string, surface: Surface = 'toolbar') {
  return actionsFor(ACTIONS, ctx, surface)
    .flatMap((section) => section.actions)
    .find((action) => action.id === id);
}

beforeEach(() => {
  useUiStore.getState().resetForDeck();
});

describe('image.flipX / image.flipY (057)', () => {
  it('is offered on the toolbar for images and in the menu when the selection holds an image', () => {
    for (const id of ['image.flipX', 'image.flipY']) {
      expect(find(actionContext(images('plain'), 'edit', deck), id)).toBeDefined();
      expect(find(actionContext(images('plain', 'flipped'), 'edit', deck), id)).toBeDefined();
      expect(find(actionContext(images('plain'), 'edit', deck), id, 'menu')).toBeDefined();
      const mixed: MenuTarget = { kind: 'mixed', ids: sel({ nodes: ['n'], images: ['plain'] }) };
      expect(find(actionContext(mixed, 'edit', deck), id, 'menu')).toBeDefined();
      expect(find(actionContext(mixed, 'edit', deck), id)).toBeUndefined();
      const noImage: MenuTarget = { kind: 'mixed', ids: sel({ nodes: ['n'] }) };
      expect(find(actionContext(noImage, 'edit', deck), id, 'menu')).toBeUndefined();
    }
  });

  it('labels the buttons and has no shortcut', () => {
    const ctx = actionContext(images('plain'), 'edit', deck);
    expect(find(ctx, 'image.flipX')?.label).toBe('Flip horizontal');
    expect(find(ctx, 'image.flipY')?.label).toBe('Flip vertical');
    expect(find(ctx, 'image.flipX')?.shortcut).toBeUndefined();
  });

  it('flips them all when any is not flipped, in one undo step, and shows not pressed', () => {
    const ctx = actionContext(images('flipped', 'plain'), 'edit', deck);
    const action = find(ctx, 'image.flipX');
    expect(action?.pressed).toBe(false);
    action?.run();
    const flips = () => toJSON(ctx.doc).images?.map((image) => image.flipX);
    expect(flips()).toEqual([true, true, undefined, undefined]);
    ctx.editor.undo();
    expect(flips()).toEqual([true, undefined, undefined, undefined]);
  });

  it('unflips them all when all are flipped, and shows pressed', () => {
    const ctx = actionContext(images('flipped'), 'edit', deck);
    const action = find(ctx, 'image.flipX');
    expect(action?.pressed).toBe(true);
    action?.run();
    expect(toJSON(ctx.doc).images?.[0]).not.toHaveProperty('flipX');
    expect(find(actionContext(images('flipped'), 'edit', deck), 'image.flipY')?.pressed).toBe(
      false,
    );
  });

  it('skips locked images, and is disabled when every one is locked', () => {
    const ctx = actionContext(images('plain', 'locked'), 'edit', deck);
    const action = find(ctx, 'image.flipY');
    expect(action?.disabled).toBeNull();
    action?.run();
    expect(toJSON(ctx.doc).images?.map((image) => image.flipY)).toEqual([
      undefined,
      true,
      undefined,
      undefined,
    ]);
    expect(find(actionContext(images('locked'), 'edit', deck), 'image.flipY')?.disabled).toBe(
      'Locked',
    );
  });

  it('counts only unlocked images for the pressed state', () => {
    const ctx = actionContext(images('flipped', 'locked'), 'edit', deck);
    expect(find(ctx, 'image.flipX')?.pressed).toBe(true);
  });
});

describe('image.crop (057)', () => {
  it('is offered on the toolbar and menu for one image only', () => {
    expect(find(actionContext(images('plain'), 'edit', deck), 'image.crop')).toBeDefined();
    expect(find(actionContext(images('plain'), 'edit', deck), 'image.crop', 'menu')).toBeDefined();
    expect(
      find(actionContext(images('plain', 'flipped'), 'edit', deck), 'image.crop'),
    ).toBeUndefined();
    expect(
      find(actionContext(images('plain', 'flipped'), 'edit', deck), 'image.crop', 'menu'),
    ).toBeUndefined();
  });

  it('is disabled for a locked image', () => {
    expect(find(actionContext(images('locked'), 'edit', deck), 'image.crop')?.disabled).toBe(
      'Locked',
    );
  });

  it('opens crop mode from the current crop, writing nothing', () => {
    const ctx = actionContext(images('cropped'), 'edit', deck);
    find(ctx, 'image.crop')?.run();
    expect(useUiStore.getState().cropSession).toEqual({
      imageId: 'cropped',
      crop: { x: 0.5, y: 0, width: 0.5, height: 1 },
      handle: null,
    });
    expect(ctx.editor.canUndo()).toBe(false);
    const whole = actionContext(images('plain'), 'edit', deck);
    find(whole, 'image.crop')?.run();
    expect(useUiStore.getState().cropSession?.crop).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });
});

describe('image.resetCrop (057)', () => {
  it('is disabled when not cropped or locked', () => {
    expect(find(actionContext(images('plain'), 'edit', deck), 'image.resetCrop')?.disabled).toBe(
      'Not cropped',
    );
    expect(find(actionContext(images('locked'), 'edit', deck), 'image.resetCrop')?.disabled).toBe(
      'Locked',
    );
    expect(
      find(actionContext(images('cropped'), 'edit', deck), 'image.resetCrop', 'menu')?.disabled,
    ).toBeNull();
  });

  it('shows the whole picture again at the same scale, one undo step, and says so', () => {
    const ctx = actionContext(images('cropped'), 'edit', deck);
    find(ctx, 'image.resetCrop')?.run();
    const image = toJSON(ctx.doc).images?.[3];
    expect(image).not.toHaveProperty('crop');
    // The right half is drawn 200 × 200 at x 1600 (centred in its 400 px box), scale 1: the whole
    // picture comes back 200 px to its left.
    expect(image?.position).toEqual({ x: 1400, y: 0 });
    expect(image?.size).toEqual({ width: 400, height: 200 });
    expect(useUiStore.getState().announcement.text).toBe('Crop reset');
    ctx.editor.undo();
    expect(toJSON(ctx.doc).images?.[3]?.crop).toEqual({ x: 0.5, y: 0, width: 0.5, height: 1 });
  });
});
