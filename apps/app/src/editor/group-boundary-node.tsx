import { NodeResizeControl, type NodeProps, type ResizeDragEvent } from '@xyflow/react';
import { memo, useRef } from 'react';

import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import { ChevronDown } from 'lucide-react';

import { useEditor } from '../model/use-editor';
import { isFlowMode, useUiStore } from '../state/ui-store';
import { applyResize, endResize, startResize, type ResizeSession } from './editing/frame-resize';
import type { Handle } from './editing/resize-limits';
import { setGroupCollapsed } from './views/use-current-view';
import { GROUP_HANDLE_CLASS, type GroupFlowNode } from './deck-to-flow';
import { CardTitleInput } from './quick-edit/card-title-input';
import { describeChannel } from './style/card-style';

const HANDLES: readonly Handle[] = [
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
];

/** The 8 px band along each edge that drags the frame (016 R5); the label drags it too. */
const EDGE_BANDS = [
  'inset-x-0 top-0 h-2',
  'inset-x-0 bottom-0 h-2',
  'inset-y-0 left-0 w-2',
  'inset-y-0 right-0 w-2',
] as const;

const modsOf = (event: ResizeDragEvent) => {
  const source = event.sourceEvent as Partial<MouseEvent> | null | undefined;
  return { shift: source?.shiftKey === true, alt: source?.altKey === true };
};

/**
 * A group frame (DESIGN.md group-boundary, design 02; 016): a dashed boundary with a micro label
 * "TITLE n", at the position and size stored on the group. Empty space inside lets pointer events
 * through to the canvas; the label and an edge band drag it, and while it is selected eight
 * handles resize it (pointer only: the drawer's X / Y / W / H fields are the keyboard path).
 */
export const GroupBoundaryNode = memo(function GroupBoundaryNode({
  id,
  data,
  width,
  height,
}: NodeProps<GroupFlowNode>) {
  const selected = data.selected === true;
  const focus = useUiStore((state) => state.focus);
  const select = useUiStore((state) => state.select);
  const editor = useEditor();
  const announce = useUiStore((state) => state.announce);
  const flowMode = useUiStore((state) => isFlowMode(state));
  const groupId = id.startsWith('group:') ? id.slice('group:'.length) : id;
  const titleEdit = useUiStore((state) =>
    state.titleEdit?.target === 'group' && state.titleEdit.id === groupId ? state.titleEdit : null,
  );
  const editable = useUiStore((state) => !isFlowMode(state) && state.flowSession === null);
  const dropTarget = useUiStore((state) => state.dropTarget === groupId);
  const resize = useRef<ResizeSession | null>(null);

  // Colour (020 US5): mirrors DeckNode's rule (R5); the group label follows the text rule.
  const look = data.look;
  const showFill = look?.fill !== undefined;
  const showStroke = look?.stroke !== undefined;
  const customText = look !== undefined && look.text !== 'default' ? look.text : undefined;
  const colourDescription = [
    look?.fillRef !== undefined ? describeChannel('fill', look.fillRef) : null,
    look?.strokeRef !== undefined ? describeChannel('stroke', look.strokeRef) : null,
  ]
    .filter((part): part is string => part !== null)
    .join(', ');

  return (
    <div
      data-testid="group-boundary"
      data-level={data.level}
      style={{
        width,
        height,
        ...(look?.fill === undefined ? {} : { '--card-fill': look.fill }),
        ...(look?.stroke === undefined ? {} : { '--card-stroke': look.stroke }),
      }}
      {...(dropTarget ? { 'data-drop-target': '' } : {})}
      {...(showStroke ? { 'data-stroke': '' } : {})}
      {...(customText === undefined ? {} : { 'data-text': customText })}
      className={cn(
        // The Deck frame (frame 119): radius 20, a 1.5 px solid border, Surface 2 or the colour fill.
        'group pointer-events-none relative rounded-frame border-[1.5px] border-solid border-border-strong bg-surface-2',
        data.level === 'landscape' && 'bg-surface-2/80',
        // Drop target (screen 110): the dashed orange border is the cue, not the colour alone.
        // It wins over a custom colour (the drop cue must stay unambiguous).
        dropTarget && 'border-dashed border-primary bg-primary/7',
        !dropTarget && showFill && 'bg-(--card-fill)',
        !dropTarget && showStroke && 'border-(--card-stroke)',
      )}
    >
      {editable &&
        EDGE_BANDS.map((band) => (
          <div
            key={band}
            aria-hidden
            className={cn(GROUP_HANDLE_CLASS, 'pointer-events-auto absolute cursor-move', band)}
          />
        ))}
      {dropTarget && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-caption font-medium whitespace-nowrap text-on-primary">
          Drop into {data.title}
        </span>
      )}
      {selected &&
        editable &&
        HANDLES.map((handle) => (
          <NodeResizeControl
            key={handle}
            nodeId={id}
            position={handle}
            className="sd-resize-handle"
            onResizeStart={() => {
              resize.current = startResize(editor, groupId, handle);
            }}
            onResize={(event, params) => {
              if (resize.current !== null)
                applyResize(editor, resize.current, params, modsOf(event));
            }}
            onResizeEnd={() => {
              if (resize.current !== null) endResize(editor, resize.current);
              resize.current = null;
            }}
          />
        ))}
      {titleEdit !== null ? (
        <div
          data-node-id={id}
          tabIndex={-1}
          // Where the label sits, in its type, so renaming moves nothing (founder, 2026-10-02).
          className={cn(
            'pointer-events-auto absolute -top-3.5 left-4 w-56 px-1',
            data.level === 'landscape' && 'top-4 left-4 w-72 rounded-full bg-surface px-2 py-1',
          )}
        >
          <CardTitleInput
            edit={titleEdit}
            title={data.title}
            className={
              data.level === 'landscape'
                ? 'text-body font-medium text-ink'
                : 'text-[12.5px] font-semibold text-ink'
            }
          />
        </div>
      ) : (
        <button
          type="button"
          data-node-id={id}
          aria-label={`${data.title} group, ${String(data.count)} nodes`}
          aria-description={colourDescription === '' ? undefined : colourDescription}
          aria-expanded="true"
          tabIndex={data.focused ? 0 : -1}
          title="Double-click or ↵ to open"
          onClick={(event) => {
            if (flowMode) return;
            event.stopPropagation();
            select({ groups: [groupId] });
            focus(id);
          }}
          className={cn(
            // The label drags the frame (016 R5); a click still selects it.
            GROUP_HANDLE_CLASS,
            // The pill sits on the top edge (left 16, top -14): 28 tall, Surface, 1.5 px border and
            // a 2 px lip that goes with the others below 60 % zoom.
            'pointer-events-auto absolute -top-3.5 left-4 flex h-7 items-center gap-1.5 rounded-full border-[1.5px] border-border-strong bg-surface pr-1.5 pl-2 text-[12.5px] font-semibold text-ink shadow-[0_calc(var(--sd-deck-lip)*2/3)_0_0_var(--color-border-strong)]',
            data.level === 'landscape' && 'top-4 left-4 text-body',
            focusRing,
          )}
        >
          <ChevronDown aria-hidden className="size-3.5" />
          <span>{data.title}</span>
          <span
            aria-hidden
            className="flex size-[18px] items-center justify-center rounded-full bg-ink text-[10.5px] leading-none font-bold text-surface"
          >
            {data.count}
          </span>
        </button>
      )}
      <button
        type="button"
        aria-label={`Collapse ${data.title}`}
        onMouseDownCapture={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
          setGroupCollapsed(editor, groupId, true);
          if (!flowMode) select({ groups: [groupId] });
          focus(`collapsed:${groupId}`);
          announce(`${data.title} collapsed`);
        }}
        className={cn(
          'pointer-events-auto absolute top-2 right-3 rounded-full p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100',
          focusRing,
        )}
      >
        <ChevronDown className="size-4" />
      </button>
    </div>
  );
});
