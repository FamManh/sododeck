import { useEditor } from '../../model/use-editor';
import { useDeckSnapshot } from '../../model/use-deck-snapshot';
import { useUiStore } from '../../state/ui-store';
import { LiveTextField } from '../inspector/table/live-text-field';

/** Alt text and caption: the two words a picture carries (055). */
export type ImageTextKey = 'alt' | 'caption';

const LABELS: Record<ImageTextKey, string> = { alt: 'Alt text', caption: 'Caption' };
const PLACEHOLDERS: Record<ImageTextKey, string> = {
  alt: 'Describe the picture for screen readers',
  caption: 'Shown under the picture',
};

/**
 * One text of an image, saved while typing (one undo step per focus). Alt text and caption stay
 * editable on a locked image: they change no geometry (`setImageText`). An empty value clears it.
 */
export function ImageTextField({
  imageId,
  field,
  disabled = false,
  hideLabel = false,
}: {
  imageId: string;
  field: ImageTextKey;
  disabled?: boolean;
  hideLabel?: boolean;
}) {
  const editor = useEditor();
  const image = useDeckSnapshot(editor.doc).images?.find((entry) => entry.id === imageId);
  if (image === undefined) return null;
  return (
    <LiveTextField
      label={LABELS[field]}
      value={image[field] ?? ''}
      placeholder={PLACEHOLDERS[field]}
      disabled={disabled}
      hideLabel={hideLabel}
      onWrite={(text) => {
        editor.setImageText(imageId, { [field]: text });
        useUiStore
          .getState()
          .announce(text === '' ? `${LABELS[field]} cleared` : `${LABELS[field]} set`);
      }}
    />
  );
}
