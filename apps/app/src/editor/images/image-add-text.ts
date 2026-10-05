import { IMAGE_TYPES } from '../../images/limits';

/** What the file picker lists: the six types the app takes (contracts/ui.md). */
export const IMAGE_ACCEPT = IMAGE_TYPES.join(',');

export const IMAGE_TILE_HINT = 'Add an image (or paste with ⌘V)';
export const IMAGE_DISABLED_REASON = 'Images cannot be added in flow mode or while recording';
