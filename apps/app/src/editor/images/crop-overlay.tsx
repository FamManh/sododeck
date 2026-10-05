import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import { minCropFraction, pictureLayout, visibleRegion, type CropRect } from '@sododeck/model';
import type { Id, Size } from '@sododeck/schema';
import { useStore } from '@xyflow/react';
import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import { useEditor } from '../../model/use-editor';
import { useUiStore } from '../../state/ui-store';
import { CropBar } from './crop-bar';
import { cancelCrop, confirmCrop } from './crop-commands';
import {
  CROP_HANDLES,
  dragHandle,
  isArrowKey,
  nudge,
  pictureDelta,
  pictureHandle,
  type CropHandle,
} from './crop-session';
import { useCropInterruptions } from './use-crop-interruptions';

/** A crop handle's side on screen, at any zoom (DESIGN.md resize handle: 8 px). */
const HANDLE_PX = 8;

export interface CropOverlayProps {
  imageId: Id;
  url: string;
  /** The image's box (its stored size): the overlay is drawn relative to it. */
  width: number;
  height: number;
  natural: Size;
  /** The stored crop: where the whole picture is drawn around the box. */
  crop: CropRect | undefined;
  flipX: boolean;
  flipY: boolean;
  locked: boolean;
}

interface Drag {
  handle: CropHandle;
  pointerId: number;
  from: { x: number; y: number };
  start: CropRect;
}

/** Where a handle sits on the frame, as fractions of its width and height. */
const HANDLE_AT: Record<Exclude<CropHandle, 'frame'>, [number, number]> = {
  'top-left': [0, 0],
  top: [0.5, 0],
  'top-right': [1, 0],
  right: [1, 0.5],
  'bottom-right': [1, 1],
  bottom: [0.5, 1],
  'bottom-left': [0, 1],
  left: [0, 0.5],
};

const CURSOR: Record<Exclude<CropHandle, 'frame'>, string> = {
  'top-left': 'cursor-nwse-resize',
  top: 'cursor-ns-resize',
  'top-right': 'cursor-nesw-resize',
  right: 'cursor-ew-resize',
  'bottom-right': 'cursor-nwse-resize',
  bottom: 'cursor-ns-resize',
  'bottom-left': 'cursor-nesw-resize',
  left: 'cursor-ew-resize',
};

/**
 * Crop mode on one image (057 US1, contracts/ui.md): the whole picture at its current scale
 * around the visible part (it may reach past the image box), the area outside the crop frame
 * dimmed, a frame with eight handles and a move area, and the crop bar. Pointer and keys move only
 * the working frame in the UI store; Done, Enter or a press outside writes it once, Cancel and
 * Escape write nothing.
 */
export function CropOverlay({
  imageId,
  url,
  width,
  height,
  natural,
  crop: stored,
  flipX,
  flipY,
  locked,
}: CropOverlayProps) {
  const editor = useEditor();
  const zoom = useStore((s) => s.transform[2]);
  const working = useUiStore((s) =>
    s.cropSession?.imageId === imageId ? s.cropSession.crop : null,
  );
  const root = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  useCropInterruptions(imageId, locked);

  const flip = { flipX, flipY };
  const box = { x: 0, y: 0, width, height };
  const { picture } = pictureLayout(box, natural, stored, flip);
  const min = minCropFraction(box, natural, stored);

  // Focus starts on the frame (R8).
  useEffect(() => {
    frame.current?.focus({ preventScroll: true });
  }, []);

  // Enter applies and Escape cancels from anywhere in crop mode; a press outside the picture and
  // the bar applies. Capture phase, so the canvas keys (Escape clears the selection) never see them.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        cancelCrop();
      } else if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        event.stopPropagation();
        confirmCrop(editor);
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && root.current?.contains(event.target)) return;
      confirmCrop(editor);
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onPointer, true);
    };
  }, [editor]);

  if (working === null) return null;

  // The frame on screen: the working region, mirrored with the picture.
  const region = visibleRegion(natural, working, flip);
  const scale = picture.width / natural.width;
  const f = {
    x: region.x * scale,
    y: region.y * scale,
    width: region.width * scale,
    height: region.height * scale,
  };
  const pixels = `${String(Math.round(region.width))} × ${String(Math.round(region.height))}`;
  const handlePx = HANDLE_PX / zoom;

  const begin = (event: ReactPointerEvent<HTMLElement>) => {
    const handle = event.currentTarget.dataset.cropHandle as CropHandle | undefined;
    if (event.button !== 0 || handle === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Not every environment captures pointers (tests); the drag still follows this element.
    }
    drag.current = {
      handle,
      pointerId: event.pointerId,
      from: { x: event.clientX, y: event.clientY },
      start: working,
    };
    useUiStore.getState().updateCrop(working, handle);
  };
  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const current = drag.current;
    if (current?.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const delta = pictureDelta(
      { x: (event.clientX - current.from.x) / zoom, y: (event.clientY - current.from.y) / zoom },
      picture,
      flip,
    );
    const next = dragHandle(current.start, pictureHandle(current.handle, flip), delta, {
      keepRatio: event.shiftKey,
      min,
    });
    useUiStore.getState().updateCrop(next);
  };
  const end = (event: ReactPointerEvent<HTMLElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    event.stopPropagation();
    drag.current = null;
    useUiStore.getState().updateCrop(useUiStore.getState().cropSession?.crop ?? working, null);
  };
  const onKeyDown = (handle: CropHandle) => (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || !isArrowKey(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const next = nudge(working, handle, event.key, event.shiftKey, picture, flip, min);
    const ui = useUiStore.getState();
    ui.updateCrop(next, null);
    const r = visibleRegion(natural, next, flip);
    ui.announce(`${String(Math.round(r.width))} × ${String(Math.round(r.height))}`);
  };
  const pointer = { onPointerMove: move, onPointerUp: end, onPointerCancel: end };

  return (
    <div
      ref={root}
      data-crop-overlay=""
      className="nodrag nopan absolute"
      style={{ left: picture.x, top: picture.y, width: picture.width, height: picture.height }}
    >
      <img
        src={url}
        alt=""
        aria-hidden
        draggable={false}
        className="absolute inset-0 size-full max-w-none select-none"
        style={
          flipX || flipY
            ? { transform: `scale(${flipX ? '-1' : '1'}, ${flipY ? '-1' : '1'})` }
            : undefined
        }
      />
      {/* The dimmed area outside the frame, as four bands so the handles are never clipped. */}
      {[
        { left: 0, top: 0, width: picture.width, height: f.y },
        {
          left: 0,
          top: f.y + f.height,
          width: picture.width,
          height: picture.height - f.y - f.height,
        },
        { left: 0, top: f.y, width: f.x, height: f.height },
        { left: f.x + f.width, top: f.y, width: picture.width - f.x - f.width, height: f.height },
      ].map((band, i) => (
        <div key={i} aria-hidden className="pointer-events-none absolute bg-scrim" style={band} />
      ))}
      <div
        ref={frame}
        role="group"
        aria-label={`Crop area, ${pixels}`}
        tabIndex={0}
        data-testid="crop-frame"
        className={cn('absolute cursor-move border border-primary', focusRing)}
        style={{ left: f.x, top: f.y, width: f.width, height: f.height, borderWidth: 1 / zoom }}
        data-crop-handle="frame"
        onPointerDown={begin}
        onKeyDown={onKeyDown('frame')}
        {...pointer}
      >
        {CROP_HANDLES.map(({ id, label }) => {
          const [ax, ay] = HANDLE_AT[id];
          return (
            <div
              key={id}
              role="button"
              aria-label={label}
              tabIndex={0}
              className={cn(
                'absolute rounded-[2px] border-primary bg-surface hover:bg-primary-soft',
                CURSOR[id],
                focusRing,
              )}
              style={{
                left: ax * f.width - handlePx / 2,
                top: ay * f.height - handlePx / 2,
                width: handlePx,
                height: handlePx,
                borderWidth: 1.5 / zoom,
              }}
              data-crop-handle={id}
              onPointerDown={begin}
              onKeyDown={onKeyDown(id)}
              {...pointer}
            />
          );
        })}
      </div>
      <CropBar zoom={zoom} />
    </div>
  );
}
