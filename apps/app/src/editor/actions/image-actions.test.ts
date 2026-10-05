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
