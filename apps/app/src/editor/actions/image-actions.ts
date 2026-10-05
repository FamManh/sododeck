import type { Id, SododeckFile } from '@sododeck/schema';
import { Captions, Accessibility, FlipHorizontal2, FlipVertical2 } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import type { Action, ActionContext } from './types';

type ImageObject = NonNullable<SododeckFile['images']>[number];

/** The selected images that are not locked (an image in a locked group is itself locked, 054). */
function freeImages(ctx: ActionContext): ImageObject[] {
  const selected = new Set<Id>(ctx.selection.images);
  return (ctx.deck.images ?? []).filter((image) => selected.has(image.id) && image.locked !== true);
}

const LOCKED = 'Locked';

/**
 * Flip horizontal / vertical (057 R6): one press leaves every selected, unlocked image facing the
 * same way. If any is not flipped on that axis they all become flipped; otherwise all unflip. The
 * button shows pressed only when every one is flipped. Locked images are skipped. No shortcut.
 */
function flipAction(axis: 'x' | 'y'): Action {
  const key = axis === 'x' ? 'flipX' : 'flipY';
  const allFlipped = (ctx: ActionContext) => {
    const free = freeImages(ctx);
    return free.length > 0 && free.every((image) => image[key] === true);
  };
  return {
    id: axis === 'x' ? 'image.flipX' : 'image.flipY',
    label: axis === 'x' ? 'Flip horizontal' : 'Flip vertical',
    icon: axis === 'x' ? FlipHorizontal2 : FlipVertical2,
    section: 'edit',
    where: { toolbar: ['image', 'images'], menu: ['image', 'images', 'mixed'] },
    applies: (ctx) => ctx.selection.images.length > 0,
    disabledReason: (ctx) => (freeImages(ctx).length === 0 ? LOCKED : null),
    pressed: allFlipped,
    run: (ctx) => {
      const free = freeImages(ctx);
      if (free.length === 0) return;
      ctx.editor.setImageFlip(
        free.map((image) => image.id),
        axis,
        !allFlipped(ctx),
      );
    },
  };
}

/**
 * The toolbar of one image (055): alt text and caption open a small popover each; stacking, lock
 * and delete come from the shared actions. Both texts stay editable on a locked image.
 */
export const IMAGE_ACTIONS: readonly Action[] = [
  {
    id: 'image.alt',
    label: 'Alt text',
    icon: Accessibility,
    section: 'edit',
    field: 'imageAlt',
    where: { toolbar: ['image'] },
    run: () => {
      useUiStore.getState().openToolbarField('imageAlt');
    },
  },
  {
    id: 'image.caption',
    label: 'Caption',
    icon: Captions,
    section: 'edit',
    field: 'imageCaption',
    where: { toolbar: ['image'] },
    run: () => {
      useUiStore.getState().openToolbarField('imageCaption');
    },
  },
  flipAction('x'),
  flipAction('y'),
];
