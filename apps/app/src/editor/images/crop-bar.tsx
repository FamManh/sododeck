import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import { isWholeCrop } from '@sododeck/model';
import { Undo2 } from 'lucide-react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { cancelCrop, confirmCrop } from './crop-commands';
import { WHOLE_CROP } from './crop-session';

/** DESIGN.md selection toolbar: 44 tall, 34 px buttons. */
const BAR_HEIGHT = 44;
const BAR_GAP = 8;

const BUTTON =
  'inline-flex h-[34px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-button px-2.5 text-body-sm whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0';

/**
 * The crop bar (057 contracts/ui.md): Reset, Cancel and Done in the selection toolbar's look,
 * above the whole picture while crop mode is open (the selection toolbar is hidden then). It is
 * drawn inside the picture's node at a constant screen size (`zoom`), so it follows the picture
 * and comes right after the handles in the Tab order. Reset only moves the working frame back to
 * the whole picture; nothing is written until Done.
 */
export function CropBar({ zoom }: { zoom: number }) {
  const editor = useEditor();
  const whole = useUiStore((s) => s.cropSession === null || isWholeCrop(s.cropSession.crop));
  return (
    <div
      role="toolbar"
      aria-label="Crop"
      data-crop-bar=""
      className="absolute left-1/2 flex h-11 items-center gap-0.5 rounded-card border border-hairline bg-surface p-1 text-ink shadow-hover"
      style={{
        bottom: '100%',
        transform: `translate(-50%, ${String(-BAR_GAP / zoom)}px) scale(${String(1 / zoom)})`,
        transformOrigin: 'bottom center',
        height: BAR_HEIGHT,
      }}
    >
      <button
        type="button"
        disabled={whole}
        className={cn(BUTTON, 'text-ink hover:bg-surface-2', focusRing)}
        onClick={() => {
          useUiStore.getState().updateCrop(WHOLE_CROP, null);
          useUiStore.getState().announce('Whole picture');
        }}
      >
        <Undo2 aria-hidden />
        Reset
      </button>
      <button
        type="button"
        className={cn(BUTTON, 'text-ink hover:bg-surface-2', focusRing)}
        onClick={() => {
          cancelCrop();
        }}
      >
        Cancel
      </button>
      <button
        type="button"
        className={cn(
          BUTTON,
          'bg-primary font-medium text-on-primary hover:bg-primary-hover',
          focusRing,
        )}
        onClick={() => {
          confirmCrop(editor);
        }}
      >
        Done
      </button>
    </div>
  );
}
