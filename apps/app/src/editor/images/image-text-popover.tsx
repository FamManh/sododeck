import { useUiStore } from '../../state/ui-store';
import { ImageTextField, type ImageTextKey } from './image-text-field';

/** The toolbar popover of an image's alt text or caption (055); one image selected. */
export function ImageTextPopover({ field }: { field: ImageTextKey }) {
  const imageId = useUiStore((s) => s.selection.images[0]);
  if (imageId === undefined) return null;
  return <ImageTextField imageId={imageId} field={field} />;
}
