import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import type { NodeProps } from '@xyflow/react';
import { ImageOff, Lock } from 'lucide-react';
import { memo } from 'react';

import { usePictureUrl } from '../../images/use-picture-url';
import { useEditor } from '../../model/use-editor';
import type { ImageFlowNode } from '../deck-to-flow';
import { imageName } from './image-name';

/**
 * A picture on the canvas (055): the picture fills the box (`object-fit: contain`), a caption sits
 * under it when set, and a bordered placeholder stands in when the picture cannot be found (text
 * and icon, not colour alone). The document holds only the record; bytes come from the picture
 * store through `usePictureUrl`.
 */
export const ImageNode = memo(function ImageNode({
  id,
  data,
  selected,
  width,
  height,
}: NodeProps<ImageFlowNode>) {
  const picture = usePictureUrl(data.asset);
  const missing = !data.known || picture.status === 'missing';
  const label = data.alt !== undefined && data.alt !== '' ? data.alt : data.fileName;
  const boxWidth = width ?? data.size.width;
  const boxHeight = height ?? data.size.height;

  return (
    <div
      data-testid="image-node"
      data-node-id={id}
      role="group"
      aria-roledescription="image"
      aria-label={imageName(data, missing)}
      aria-selected={selected}
      tabIndex={0}
      style={{ width: boxWidth, height: boxHeight }}
      className={cn('group/image relative rounded-[4px]', focusRing)}
    >
      {missing ? (
        <div
          data-testid="image-missing"
          className="flex size-full flex-col items-center justify-center gap-1 overflow-hidden rounded-[4px] border border-dashed border-border-strong bg-surface-2 px-2 text-center text-ink-secondary"
        >
          <ImageOff aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-5 shrink-0" />
          <span className="text-caption font-medium">Picture missing</span>
          {data.fileName !== '' && (
            <span className="max-w-full truncate text-caption">{data.fileName}</span>
          )}
        </div>
      ) : picture.status === 'ready' ? (
        <img
          src={picture.url}
          alt={label === '' ? 'Image' : label}
          draggable={false}
          className="size-full rounded-[4px] object-contain select-none"
        />
      ) : (
        <div
          aria-hidden
          className="size-full animate-pulse rounded-[4px] bg-surface-2"
          data-testid="image-loading"
        />
      )}
      {data.caption !== undefined && data.caption !== '' && (
        <p
          data-testid="image-caption"
          title={data.caption}
          className="absolute top-full right-0 left-0 mt-1 truncate text-center text-caption text-ink-secondary"
        >
          {data.caption}
        </p>
      )}
      {selected && (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-[5px] ring-1 ring-primary"
        />
      )}
      {data.locked && <LockGlyph imageId={data.imageId} />}
    </div>
  );
});

/** The lock glyph of a locked image: also the unlock button, as on a note. */
function LockGlyph({ imageId }: { imageId: string }) {
  const editor = useEditor();
  return (
    <button
      type="button"
      aria-label="Unlock image"
      title="Locked · unlock to move, resize or delete"
      className={cn(
        'nodrag nopan absolute top-1 right-1 inline-flex size-5 items-center justify-center rounded-segment bg-surface/90 text-ink-secondary hover:bg-surface-2',
        focusRing,
      )}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        editor.setLocked([imageId], false, 'images');
      }}
    >
      <Lock aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
    </button>
  );
}
