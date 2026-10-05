/**
 * Entering and leaving crop mode (057): shared by the Crop action, double-click, the crop bar and
 * the keys. The session is UI state (`cropSession`); confirm is the only document write, one
 * `setImageCrop` call, so a crop session is one undo step and a cancel leaves none (research R4).
 */
import { DeckEditError, isWholeCrop, type DeckEditor } from '@sododeck/model';
import type { Id, SododeckFile } from '@sododeck/schema';

import { useUiStore } from '../../state/ui-store';
import { WHOLE_CROP } from './crop-session';

/** Said when crop mode opens (contracts/ui.md). */
export const CROP_MODE_HINT =
  'Crop mode. Drag the handles or use the arrow keys. Enter to apply, Escape to cancel.';

/** Said when the picture of an image is not there (055 placeholder). */
export const NOTHING_TO_CROP = 'Picture missing, nothing to crop';

/**
 * Why image `imageId` cannot be cropped now, or `null`: "Locked" (an image in a locked group is
 * itself locked, 054) or "Picture missing" (no stored facts, so no natural size to crop by).
 */
export function cropUnavailable(deck: SododeckFile, imageId: Id): string | null {
  const image = deck.images?.find((entry) => entry.id === imageId);
  if (image === undefined) return 'Picture missing';
  if (image.locked === true) return 'Locked';
  if (deck.assets?.[image.asset] === undefined) return 'Picture missing';
  return null;
}

/**
 * Opens crop mode on one image: selects it alone (the session ends when the selection changes),
 * starts from its current crop or the whole picture, and says how it works.
 */
export function openCropMode(deck: SododeckFile, imageId: Id): void {
  const image = deck.images?.find((entry) => entry.id === imageId);
  if (image === undefined) return;
  const ui = useUiStore.getState();
  ui.select({ images: [imageId] });
  ui.openCrop(imageId, image.crop ?? WHOLE_CROP);
  ui.announce(CROP_MODE_HINT);
}

/**
 * Applies the working frame: one `setImageCrop` (a whole-picture frame removes the crop), then
 * leaves crop mode. A refusal (the image was locked or shrunk by another tab meanwhile) leaves
 * the document as it was and says so.
 */
export function confirmCrop(editor: DeckEditor): void {
  const ui = useUiStore.getState();
  const session = ui.cropSession;
  if (session === null) return;
  ui.closeCrop();
  try {
    editor.setImageCrop(session.imageId, isWholeCrop(session.crop) ? null : session.crop);
  } catch (error) {
    if (!(error instanceof DeckEditError)) throw error;
    ui.announce('Crop not applied');
    return;
  }
  ui.announce('Crop applied');
}

/** Leaves crop mode without writing anything. */
export function cancelCrop(message = 'Crop cancelled'): void {
  const ui = useUiStore.getState();
  if (ui.cropSession === null) return;
  ui.closeCrop();
  ui.announce(message);
}
