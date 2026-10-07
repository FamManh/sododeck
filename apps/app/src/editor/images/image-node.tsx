import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import {
  Handle as FlowHandle,
  NodeResizeControl,
  Position,
  useReactFlow,
  type NodeProps,
  type ResizeDragEvent,
} from '@xyflow/react';
import { ImageOff, Lock } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';

import { usePictureStore } from '../../images/picture-store';
import { usePictureUrl } from '../../images/use-picture-url';
import { readDeck } from '../../model/use-deck-snapshot';
import { useEditor } from '../../model/use-editor';
import { isFlowMode, useUiStore } from '../../state/ui-store';
import type { ImageFlowNode } from '../deck-to-flow';
import {
  applyImageResize,
  cancelImageResize,
  endImageResize,
  resizeImageByKey,
  startImageResize,
  type ImageResizeSession,
} from '../editing/image-resize';
import type { Handle as ResizeHandleName } from '../editing/resize-limits';
import { refuseLocked } from '../lock';
import { imageName } from './image-name';
import { cancelCrop, NOTHING_TO_CROP } from './crop-commands';
import { CropOverlay } from './crop-overlay';
import { PictureView } from './picture-view';

/** One handle per side, like a note's (053). */
const SIDES = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
] as const;

/** Corners only (contracts/ui.md): a side handle would stretch the picture. */
const RESIZE_HANDLES: readonly ResizeHandleName[] = [
  'top-left',
  'top-right',
  'bottom-right',
  'bottom-left',
];

const KEY_STEP = 8;
const KEY_STEP_LARGE = 32;

const modsOf = (event: ResizeDragEvent) => {
  const source = event.sourceEvent as Partial<MouseEvent> | null | undefined;
  return {
    shift: source?.shiftKey === true,
    alt: source?.altKey === true,
    mod: source?.metaKey === true || source?.ctrlKey === true,
  };
};

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
  const editor = useEditor();
  const { getZoom } = useReactFlow();
  // A picture saved as a file next to the deck is never read or looked up here (068), unless the
  // picture store can fetch it by id (the embed's host-backed store, 067).
  const store = usePictureStore();
  const shownAsFile = data.filePath !== undefined && store?.readsFilePaths !== true;
  const picture = usePictureUrl(shownAsFile ? undefined : data.asset);
  const editable = useUiStore((state) => !isFlowMode(state) && state.flowSession === null);
  const openConnectPopover = useUiStore((state) => state.openConnectPopover);
  // A dragged connector end would land on this picture: it is the hot target.
  const endTarget = useUiStore((state) =>
    state.endpointPreview?.targetKind === 'image' && state.endpointPreview.targetId === data.imageId
      ? state.endpointPreview.valid
      : null,
  );
  const { locked } = data;
  const resizable = selected && editable && !locked;
  const resize = useRef<ImageResizeSession | null>(null);
  const [activeHandle, setActiveHandle] = useState<ResizeHandleName | null>(null);
  // React Flow never ends a resize whose node unmounts: cancel it so no half-written size stays.
  useEffect(
    () => () => {
      if (resize.current !== null) cancelImageResize(editor, resize.current);
      resize.current = null;
    },
    [editor],
  );
  const missing = !data.known || shownAsFile || picture.status === 'missing';
  // The store's own words for why a picture is missing (a host says why).
  const reason = picture.status === 'missing' ? store?.missingReason?.(data.asset) : undefined;
  // Crop mode (057): the overlay replaces the picture and the chrome until it is closed.
  const cropOpen = useUiStore((state) => state.cropSession?.imageId === data.imageId);
  const cropping = cropOpen && !missing && data.natural !== undefined;
  useEffect(() => {
    if (cropOpen && (missing || data.natural === undefined)) cancelCrop(NOTHING_TO_CROP);
  }, [cropOpen, missing, data.natural]);
  const label = data.alt !== undefined && data.alt !== '' ? data.alt : data.fileName;
  const boxWidth = width ?? data.size.width;
  const boxHeight = height ?? data.size.height;

  return (
    <div
      data-testid="image-node"
      data-node-id={id}
      {...(endTarget === null ? {} : { 'data-endpoint-target': endTarget })}
      role="group"
      aria-roledescription="image"
      aria-label={imageName(data, missing, reason)}
      aria-selected={selected}
      aria-keyshortcuts="C Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight"
      tabIndex={0}
      style={{ width: boxWidth, height: boxHeight }}
      onKeyDown={(event) => {
        // Keys pressed on a handle or the lock button are theirs.
        if (event.target !== event.currentTarget || !editable) return;
        if (event.altKey && event.key.startsWith('Arrow')) {
          // Alt + arrow resizes (⇧ for a larger step): the keyboard twin of the corner handles.
          event.preventDefault();
          if (locked) refuseLocked();
          else if (!resizeImageByKey(editor, data.imageId, event.key, event.shiftKey))
            useUiStore.getState().announce('Image size unchanged');
          return;
        }
        if (event.key.toLowerCase() === 'c' && !event.metaKey && !event.ctrlKey && !event.altKey) {
          // The keyboard way to connect, as on a card (C): pick the other end from a list.
          event.preventDefault();
          if (locked) refuseLocked();
          else openConnectPopover(data.imageId);
          return;
        }
        const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
        const move =
          event.key === 'ArrowUp'
            ? { x: 0, y: -step }
            : event.key === 'ArrowDown'
              ? { x: 0, y: step }
              : event.key === 'ArrowLeft'
                ? { x: -step, y: 0 }
                : event.key === 'ArrowRight'
                  ? { x: step, y: 0 }
                  : null;
        if (move === null) return;
        event.preventDefault();
        if (locked) {
          refuseLocked();
          return;
        }
        const image = readDeck(editor.doc).images?.find((entry) => entry.id === data.imageId);
        if (image === undefined) return;
        editor.moveImage(data.imageId, {
          x: image.position.x + move.x,
          y: image.position.y + move.y,
        });
      }}
      className={cn('group/image relative rounded-[4px]', focusRing)}
    >
      {cropping && data.natural !== undefined && picture.status === 'ready' ? (
        <CropOverlay
          imageId={data.imageId}
          url={picture.url}
          width={boxWidth}
          height={boxHeight}
          natural={data.natural}
          crop={data.crop}
          flipX={data.flipX}
          flipY={data.flipY}
          locked={locked}
        />
      ) : missing ? (
        <div
          data-testid="image-missing"
          className="flex size-full flex-col items-center justify-center gap-1 overflow-hidden rounded-[4px] border border-dashed border-border-strong bg-surface-2 px-2 text-center text-ink-secondary"
        >
          <ImageOff aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-5 shrink-0" />
          <span className="text-caption font-medium">Picture missing</span>
          {reason !== undefined && (
            <span className="max-w-full text-caption break-words">{reason}</span>
          )}
          {data.filePath !== undefined && (
            <>
              <span className="text-caption">Saved as a separate file</span>
              <span className="max-w-full truncate text-caption" title={data.filePath}>
                {data.filePath}
              </span>
            </>
          )}
          {data.fileName !== '' && (
            <span className="max-w-full truncate text-caption">{data.fileName}</span>
          )}
        </div>
      ) : picture.status === 'ready' &&
        data.natural !== undefined &&
        (data.crop !== undefined || data.flipX || data.flipY) ? (
        <PictureView
          url={picture.url}
          alt={label === '' ? 'Image' : label}
          width={boxWidth}
          height={boxHeight}
          natural={data.natural}
          crop={data.crop}
          flipX={data.flipX}
          flipY={data.flipY}
        />
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
      {!cropping && data.caption !== undefined && data.caption !== '' && (
        <p
          data-testid="image-caption"
          title={data.caption}
          className="absolute top-full right-0 left-0 mt-1 truncate text-center text-caption text-ink-secondary"
        >
          {data.caption}
        </p>
      )}
      {!cropping && (selected || endTarget === 'ok') && (
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute -inset-px rounded-[5px] ring-1 ring-primary',
            endTarget === 'ok' && 'ring-2',
          )}
        />
      )}
      {locked && !cropping && <LockGlyph imageId={data.imageId} />}
      {resizable &&
        !cropping &&
        RESIZE_HANDLES.map((handle) => (
          <NodeResizeControl
            key={handle}
            nodeId={id}
            position={handle}
            className="sd-resize-handle"
            {...(activeHandle === handle ? { 'data-active': '' } : {})}
            onResizeStart={() => {
              setActiveHandle(handle);
              resize.current = startImageResize(editor, data.imageId, handle);
            }}
            onResize={(event, params) => {
              if (resize.current !== null)
                applyImageResize(editor, resize.current, params, modsOf(event), getZoom());
            }}
            onResizeEnd={() => {
              if (resize.current !== null) endImageResize(editor, resize.current);
              resize.current = null;
              setActiveHandle(null);
            }}
          />
        ))}
      {/* Connects like a note (053): from the middle of any side, C picks the other end from a
          list. Drawn after the resize handles, so the middle of a side connects. */}
      {SIDES.map(({ id: side, position }) => (
        <FlowHandle
          key={side}
          id={side}
          type="source"
          position={position}
          isConnectable={editable && !locked && !cropping}
          role="button"
          aria-label={`Connect from ${label === '' ? 'image' : label}`}
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            event.stopPropagation();
            if (editable && !locked) openConnectPopover(data.imageId);
          }}
          className={cn(
            'sd-handle opacity-0 transition-opacity focus-visible:opacity-100',
            // Kept mounted in crop mode: connectors still measure their ends on it.
            cropping && 'invisible',
            editable && !locked
              ? 'pointer-events-auto group-hover/image:opacity-100 group-focus-within/image:opacity-100'
              : 'pointer-events-none',
            editable && !locked && selected && 'opacity-100',
            focusRing,
          )}
        />
      ))}
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
