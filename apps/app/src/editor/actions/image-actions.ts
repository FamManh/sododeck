import type { Id, SododeckFile } from '@sododeck/schema';
import { Captions, Accessibility, Crop, FlipHorizontal2, FlipVertical2, Undo2 } from 'lucide-react';

import { useUiStore } from '../../state/ui-store';
import { cropUnavailable, openCropMode } from '../images/crop-commands';
import type { Action, ActionContext } from './types';

type ImageObject = NonNullable<SododeckFile['images']>[number];

/** The selected images that are not locked (an image in a locked group is itself locked, 054). */
function freeImages(ctx: ActionContext): ImageObject[] {
  const selected = new Set<Id>(ctx.selection.images);
  return (ctx.deck.images ?? []).filter((image) => selected.has(image.id) && image.locked !== true);
}

const LOCKED = 'Locked';

/** The one selected image, when exactly one is selected. */
const onlyImage = (ctx: ActionContext): ImageObject | undefined =>
  ctx.selection.images.length === 1
    ? (ctx.deck.images ?? []).find((image) => image.id === ctx.selection.images[0])
    : undefined;

/** Crop (057 US1): opens crop mode on the one selected image. Double-click does the same. */
const CROP_ACTION: Action = {
  id: 'image.crop',
  label: 'Crop',
  icon: Crop,
  section: 'edit',
  where: { toolbar: ['image'], menu: ['image'] },
  disabledReason: (ctx) => {
    const image = onlyImage(ctx);
    return image === undefined ? 'Picture missing' : cropUnavailable(ctx.deck, image.id);
  },
  run: (ctx) => {
    const image = onlyImage(ctx);
    if (image !== undefined && cropUnavailable(ctx.deck, image.id) === null)
      openCropMode(ctx.deck, image.id);
  },
};

/** Reset crop (057 US3): the whole picture again, same scale, one undo step. */
const RESET_CROP_ACTION: Action = {
  id: 'image.resetCrop',
  label: 'Reset crop',
  icon: Undo2,
  section: 'edit',
  where: { toolbar: ['image'], menu: ['image'] },
  disabledReason: (ctx) => {
    const image = onlyImage(ctx);
    if (image?.locked === true) return LOCKED;
    return image?.crop === undefined ? 'Not cropped' : null;
  },
  run: (ctx) => {
    const image = onlyImage(ctx);
    if (image?.crop === undefined || image.locked === true) return;
    ctx.editor.setImageCrop(image.id, null);
    useUiStore.getState().announce('Crop reset');
  },
};

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
  CROP_ACTION,
  RESET_CROP_ACTION,
  flipAction('x'),
  flipAction('y'),
];
