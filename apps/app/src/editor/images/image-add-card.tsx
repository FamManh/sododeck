import { Tooltip, TooltipContent, TooltipTrigger } from '@sododeck/ui/components/tooltip';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import { ImagePlus } from 'lucide-react';
import { useRef } from 'react';

import { isFlowMode, useUiStore } from '../../state/ui-store';
import { IMAGE_ACCEPT, IMAGE_DISABLED_REASON, IMAGE_TILE_HINT } from './image-add-text';
import { useAddImages } from './use-add-images';

/**
 * The Image tile of the Add flyout (055 US2): opens the file picker (several files allowed); the
 * picked pictures land at the view centre in a row, as one undo step. Disabled, with the reason,
 * where the canvas is view-only.
 */
export function ImageAddCard() {
  const input = useRef<HTMLInputElement>(null);
  const addPictures = useAddImages();
  const editable = useUiStore((s) => !isFlowMode(s) && s.flowSession === null);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Image"
            aria-disabled={editable ? undefined : true}
            aria-describedby={editable ? undefined : 'image-add-disabled'}
            onClick={() => {
              if (editable) input.current?.click();
            }}
            className={cn(
              'flex w-full items-start justify-between rounded-card border border-hairline bg-surface p-3 text-left transition-colors hover:border-border hover:shadow-rest',
              editable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
              focusRing,
            )}
          >
            <span className="flex flex-col">
              <span className="text-body font-medium text-ink">Image</span>
              <span className="text-caption text-ink-secondary">
                PNG, JPEG, WebP, GIF, SVG, AVIF
              </span>
            </span>
            <span
              aria-hidden
              className="inline-flex size-7 items-center justify-center rounded-[8px] bg-surface-2 text-ink-secondary"
            >
              <ImagePlus size={18} strokeWidth={ICON_STROKE_WIDTH} />
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{editable ? IMAGE_TILE_HINT : IMAGE_DISABLED_REASON}</TooltipContent>
      </Tooltip>
      {!editable && (
        <span id="image-add-disabled" className="sr-only">
          {IMAGE_DISABLED_REASON}
        </span>
      )}
      <input
        ref={input}
        type="file"
        multiple
        accept={IMAGE_ACCEPT}
        hidden
        data-testid="image-add-input"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          // The same file can be picked again right after.
          event.target.value = '';
          addPictures(files);
        }}
      />
    </>
  );
}
