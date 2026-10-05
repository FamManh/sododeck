import { STICKY_COLLAPSED_HEIGHT, stickyCanvasPosition } from '@sododeck/model';
import { InlineTextarea } from '@sododeck/ui/components/inline-textarea';
import { MarkdownView } from '@sododeck/ui/components/markdown-view';
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
import { ChevronDown, ChevronRight, Ellipsis, Lock, Pin } from 'lucide-react';
import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';

import { useEditor } from '../../model/use-editor';
import { readDeck } from '../../model/use-deck-snapshot';
import { isFlowMode, useUiStore } from '../../state/ui-store';
import { useLiveField } from '../fields/use-live-field';
import { moveStickyInView, readViewState } from '../views/use-current-view';
import type { StickyFlowNode } from '../deck-to-flow';
import {
  applyStickyResize,
  cancelStickyResize,
  endStickyResize,
  resizeStickyByKey,
  startStickyResize,
  type StickyResizeSession,
} from '../editing/sticky-resize';
import type { Handle as ResizeHandleName } from '../editing/resize-limits';
import { refuseLocked } from '../lock';
import { NOTE_INSET, TAG_ROW_HEIGHT } from './fit-font-size';
import { finishDraft, notesAreReadOnly } from './sticky-actions';
import { StickyPaper } from './sticky-paper';
import { hiddenTagsLabel, noteTags } from './sticky-tags';
import { useFitFontSize } from './use-fit-font-size';

/** One handle per side, like a group frame's (050 R6). */
const SIDES = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
] as const;

const RESIZE_HANDLES: readonly ResizeHandleName[] = [
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
];

const modsOf = (event: ResizeDragEvent) => {
  const source = event.sourceEvent as Partial<MouseEvent> | null | undefined;
  return {
    shift: source?.shiftKey === true,
    alt: source?.altKey === true,
    mod: source?.metaKey === true || source?.ctrlKey === true,
  };
};

function stickyName(data: StickyFlowNode['data']): string {
  const label = data.label === 'Empty note' ? 'empty' : data.label;
  const parts = [`Note: ${label}`];
  if (data.pinnedToTitle !== null) parts.push(`pinned to ${data.pinnedToTitle}`);
  if (data.collapsed) parts.push('collapsed');
  if (data.locked) parts.push('locked');
  if (data.flowState === 'dimmed') parts.push('dimmed');
  return parts.join(', ');
}

/**
 * A note on the canvas (053): a sheet of paper at its stored size, markdown text that fits the
 * sheet (Auto) or is pinned, tags along the bottom, four connection handles like a group frame's,
 * and eight resize handles while it is selected, expanded and unlocked.
 */
export const StickyNode = memo(function StickyNode({
  id,
  data,
  selected,
  width,
  height,
}: NodeProps<StickyFlowNode>) {
  const editor = useEditor();
  const { getZoom } = useReactFlow();
  const editing = useUiStore((state) => state.stickyEditing === data.stickyId);
  const textField = useRef<HTMLTextAreaElement>(null);
  // React Flow keeps a new node hidden until it has measured it, and a hidden field can't take
  // focus, so a note just added by a click lost its `autoFocus`. Retry for a few frames.
  useEffect(() => {
    if (!editing) return;
    let frame = 0;
    let tries = 0;
    const tryFocus = () => {
      const el = textField.current;
      if (el === null || document.activeElement === el || tries++ > 10) return;
      el.focus({ preventScroll: true });
      frame = requestAnimationFrame(tryFocus);
    };
    frame = requestAnimationFrame(tryFocus);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [editing]);
  const setStickyEditing = useUiStore((state) => state.setStickyEditing);
  const flowMode = useUiStore((state) => isFlowMode(state));
  const editable = useUiStore((state) => !isFlowMode(state) && state.flowSession === null);
  const openConnectPopover = useUiStore((state) => state.openConnectPopover);
  // A dragged connector end would land on this note (053): the sheet is the hot target.
  const endTarget = useUiStore((state) =>
    state.endpointPreview?.targetKind === 'sticky' &&
    state.endpointPreview.targetId === data.stickyId
      ? state.endpointPreview.valid
      : null,
  );
  const readOnly = notesAreReadOnly();
  const field = useLiveField({
    label: 'Note text',
    value: data.text,
    onWrite: (text) => {
      editor.update('stickies', data.stickyId, { text });
    },
    multiline: true,
  });

  const { collapsed, locked } = data;
  const boxWidth = width ?? data.size.width;
  const boxHeight = height ?? (collapsed ? STICKY_COLLAPSED_HEIGHT : data.size.height);
  const pinned = data.pinnedToTitle !== null;

  // Text and its room (053 R3): what is typed shows live, so the size follows the keystrokes.
  const text = editing ? field.value : data.text;
  const innerWidth = Math.max(0, data.size.width - NOTE_INSET);
  const tags = noteTags(data.tagLooks, innerWidth);
  const rows = tags.rows + (pinned || locked ? 1 : 0);
  const { fit, measureRef } = useFitFontSize({
    text,
    width: innerWidth,
    height: Math.max(0, data.size.height - NOTE_INSET),
    align: data.align,
    fontSize: data.fontSize,
    rows,
    source: editing ? 'twin' : 'text',
  });
  const textStyle: CSSProperties = { fontSize: fit.fontSize, textAlign: data.align };

  // Resizing (053 R8): pointer only, on this note whatever else is selected; never collapsed,
  // locked, in flow mode or while recording.
  const resizable = selected && editable && !collapsed && !locked;
  const resize = useRef<StickyResizeSession | null>(null);
  const [activeHandle, setActiveHandle] = useState<ResizeHandleName | null>(null);
  // React Flow never ends a resize whose node unmounts: cancel it here so no guide or half-written
  // size is left behind.
  useEffect(
    () => () => {
      if (resize.current !== null) cancelStickyResize(editor, resize.current);
      resize.current = null;
    },
    [editor],
  );

  const finishEditing = () => {
    finishDraft(editor, data.stickyId);
    setStickyEditing(null);
  };

  const openEditing = () => {
    if (flowMode || readOnly) return;
    setStickyEditing(data.stickyId);
  };

  const toggleCollapsed = () => {
    editor.update('stickies', data.stickyId, { collapsed: collapsed ? null : true });
    useUiStore.getState().announce(collapsed ? 'Note expanded' : 'Note collapsed');
  };
  const toggleLabel = collapsed ? 'Expand note' : 'Collapse note';

  return (
    <div
      data-testid="sticky-node"
      data-node-id={id}
      {...(endTarget === null ? {} : { 'data-endpoint-target': endTarget })}
      role="group"
      aria-roledescription="note"
      aria-label={stickyName(data)}
      aria-selected={selected}
      aria-keyshortcuts="Enter C Alt+C Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight"
      tabIndex={0}
      style={{ width: boxWidth, height: boxHeight }}
      onDoubleClick={openEditing}
      onKeyDown={(event) => {
        // Keys typed in the text field or pressed on a handle are theirs.
        if (event.target !== event.currentTarget) return;
        if (flowMode || readOnly) return;
        if (event.altKey && event.code === 'KeyC') {
          event.preventDefault();
          toggleCollapsed();
          return;
        }
        if (event.altKey && event.key.startsWith('Arrow')) {
          // Alt + arrow resizes (⇧ for a larger step): the keyboard twin of the corner handles.
          event.preventDefault();
          if (locked) refuseLocked();
          else if (!resizeStickyByKey(editor, data.stickyId, event.key, event.shiftKey))
            useUiStore
              .getState()
              .announce(collapsed ? 'Expand the note to resize it' : 'Note size unchanged');
          return;
        }
        if (event.key.toLowerCase() === 'c' && !event.metaKey && !event.ctrlKey && !event.altKey) {
          // The keyboard way to connect, as on a card (C): pick the other end from a list.
          event.preventDefault();
          if (locked) refuseLocked();
          else openConnectPopover(data.stickyId);
          return;
        }
        const move =
          event.key === 'ArrowUp'
            ? { x: 0, y: -(event.shiftKey ? 32 : 8) }
            : event.key === 'ArrowDown'
              ? { x: 0, y: event.shiftKey ? 32 : 8 }
              : event.key === 'ArrowLeft'
                ? { x: -(event.shiftKey ? 32 : 8), y: 0 }
                : event.key === 'ArrowRight'
                  ? { x: event.shiftKey ? 32 : 8, y: 0 }
                  : null;
        if (move !== null) {
          event.preventDefault();
          // A locked note stays where it is (053).
          if (locked) {
            refuseLocked();
            return;
          }
          const sticky = readDeck(editor.doc).stickies.find((entry) => entry.id === data.stickyId);
          if (sticky === undefined) return;
          const point = stickyCanvasPosition(readViewState(editor.doc).deck, sticky).point;
          moveStickyInView(editor, data.stickyId, { x: point.x + move.x, y: point.y + move.y });
          return;
        }
        if (event.key === 'Enter' || event.key === 'F2') {
          event.preventDefault();
          openEditing();
        }
      }}
      className={cn('group/sticky relative rounded-[6px]', focusRing)}
    >
      <StickyPaper
        color={data.color}
        lifted={selected}
        className={cn(
          'size-full',
          selected && 'ring-1 ring-primary',
          endTarget === 'ok' && 'ring-2 ring-primary',
        )}
      >
        {collapsed ? (
          <div className="relative flex h-full items-center gap-1 px-3">
            <p className="min-w-0 flex-1 truncate text-body-sm font-medium">{data.label}</p>
            {locked && <LockGlyph stickyId={data.stickyId} />}
            {!flowMode && <ToggleButton label={toggleLabel} collapsed onClick={toggleCollapsed} />}
          </div>
        ) : (
          <div className="relative flex h-full flex-col gap-1.5 p-3">
            <div className="min-h-0 flex-1 overflow-hidden" style={textStyle}>
              {editing ? (
                // Edited where it is read, in the same type (founder, 2026-10-02): no field chrome.
                <InlineTextarea
                  ref={textField}
                  autoFocus
                  aria-label="Note text"
                  value={field.value}
                  onChange={(event) => {
                    field.onChange(event.target.value);
                  }}
                  onFocus={field.onFocus}
                  onBlur={() => {
                    field.onBlur();
                    finishEditing();
                  }}
                  onKeyDown={(event) => {
                    field.onKeyDown(event);
                    if (
                      event.key === 'Escape' ||
                      (event.key === 'Enter' && (event.metaKey || event.ctrlKey))
                    ) {
                      finishEditing();
                    }
                  }}
                  style={{
                    maxHeight: Math.max(
                      TAG_ROW_HEIGHT,
                      data.size.height - NOTE_INSET - rows * TAG_ROW_HEIGHT,
                    ),
                    fontSize: 'inherit',
                    textAlign: 'inherit',
                  }}
                  className="nodrag nowheel text-ink caret-primary"
                />
              ) : (
                <MarkdownView
                  ref={measureRef}
                  data-testid="sticky-text"
                  text={data.text}
                  style={textStyle}
                  className="gap-1 text-[length:inherit]"
                />
              )}
            </div>
            {fit.clipped && !editing && (
              <span
                role="img"
                aria-label="Text is cut off"
                title="Resize the note to see the rest"
                className="absolute right-2 bottom-2 rounded-segment bg-surface/80 text-ink-secondary"
                style={{ bottom: rows * TAG_ROW_HEIGHT + 12 }}
              >
                <Ellipsis aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
              </span>
            )}
            {tags.rows > 0 && (
              <ul aria-label="Tags" className="flex shrink-0 flex-wrap content-start gap-1">
                {tags.shown.map((tag, index) => (
                  <li
                    key={`${String(index)}:${tag.text}`}
                    title={tag.text}
                    style={
                      {
                        '--tag-chip': tag.chip,
                        '--tag-ink': tag.ink,
                        '--tag-dot': tag.dot,
                      } as CSSProperties
                    }
                    className="h-[18px] max-w-full truncate rounded-full bg-(--tag-chip) px-1.5 text-[10.5px] leading-[18px] font-medium text-(--tag-ink)"
                  >
                    {tag.text}
                  </li>
                ))}
                {tags.hidden > 0 && (
                  <li
                    title={data.tagLooks
                      .slice(tags.shown.length)
                      .map((tag) => tag.text)
                      .join(', ')}
                    className="h-[18px] rounded-full bg-surface-2 px-1.5 text-[10.5px] leading-[18px] font-medium text-ink-secondary"
                  >
                    {hiddenTagsLabel(tags.hidden)}
                  </li>
                )}
              </ul>
            )}
            {(pinned || locked) && (
              <div className="flex shrink-0 items-center gap-2 text-caption text-ink-secondary">
                {pinned && (
                  <span className="flex min-w-0 items-center gap-1">
                    <Pin
                      aria-hidden
                      strokeWidth={ICON_STROKE_WIDTH}
                      className="size-3.5 shrink-0"
                    />
                    <span className="truncate">{`Pinned to ${data.pinnedToTitle ?? ''}`}</span>
                  </span>
                )}
                {locked && <LockGlyph stickyId={data.stickyId} />}
              </div>
            )}
            {!flowMode && (
              <ToggleButton
                label={toggleLabel}
                collapsed={false}
                onClick={toggleCollapsed}
                className="absolute top-1 right-1 opacity-0 group-hover/sticky:opacity-100 group-focus-within/sticky:opacity-100"
              />
            )}
          </div>
        )}
        {/* While the text is edited the fit measures a hidden copy of it, which never shows. */}
        {editing && !collapsed && data.fontSize === undefined && (
          <div
            ref={measureRef}
            data-fit-twin=""
            aria-hidden
            className="pointer-events-none invisible absolute top-0 left-0 -z-10"
            style={{ width: innerWidth, textAlign: data.align }}
          >
            <MarkdownView text={text} className="gap-1 text-[length:inherit]" />
          </div>
        )}
      </StickyPaper>
      {resizable &&
        RESIZE_HANDLES.map((handle) => (
          <NodeResizeControl
            key={handle}
            nodeId={id}
            position={handle}
            className="sd-resize-handle"
            {...(activeHandle === handle ? { 'data-active': '' } : {})}
            onResizeStart={() => {
              setActiveHandle(handle);
              resize.current = startStickyResize(editor, data.stickyId, handle);
            }}
            onResize={(event, params) => {
              if (resize.current !== null)
                applyStickyResize(editor, resize.current, params, modsOf(event), getZoom());
            }}
            onResizeEnd={() => {
              if (resize.current !== null) endStickyResize(editor, resize.current);
              resize.current = null;
              setActiveHandle(null);
            }}
          />
        ))}
      {/* Connects like a group frame (050 R6): from the middle of any side, ↵ picks the other end
          from a list. Shown on hover or focus and while selected. A locked note starts no
          connector (it can still be the other end: the hit test reads its box). Drawn after the
          resize handles, so the middle of a side connects. */}
      {SIDES.map(({ id: side, position }) => (
        <FlowHandle
          key={side}
          id={side}
          type="source"
          position={position}
          isConnectable={editable && !locked}
          role="button"
          aria-label={`Connect from ${data.label}`}
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            event.stopPropagation();
            if (editable && !locked) openConnectPopover(data.stickyId);
          }}
          className={cn(
            'sd-handle opacity-0 transition-opacity focus-visible:opacity-100',
            editable && !locked
              ? 'pointer-events-auto group-hover/sticky:opacity-100 group-focus-within/sticky:opacity-100'
              : 'pointer-events-none',
            editable && !locked && selected && 'opacity-100',
            focusRing,
          )}
        />
      ))}
    </div>
  );
});

function ToggleButton({
  label,
  collapsed,
  onClick,
  className,
}: {
  label: string;
  collapsed: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={collapsed ? 'false' : 'true'}
      className={cn(
        'nodrag nowheel rounded-segment p-1 text-ink-secondary transition-colors hover:bg-surface-2',
        focusRing,
        className,
      )}
      onClick={() => {
        if (notesAreReadOnly()) return;
        onClick();
      }}
    >
      {collapsed ? (
        <ChevronRight aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
      ) : (
        <ChevronDown aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
      )}
    </button>
  );
}

/** The lock glyph of a locked note: also the unlock button, as a card's lock badge (043). */
function LockGlyph({ stickyId }: { stickyId: string }) {
  const editor = useEditor();
  return (
    <button
      type="button"
      aria-label="Unlock note"
      title="Locked · unlock to move, resize or delete"
      className={cn(
        'nodrag nopan inline-flex size-5 shrink-0 items-center justify-center rounded-segment text-ink-secondary hover:bg-surface-2',
        focusRing,
      )}
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        editor.setLocked([stickyId], false, 'stickies');
      }}
    >
      <Lock aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
    </button>
  );
}
