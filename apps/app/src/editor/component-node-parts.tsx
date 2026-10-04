/**
 * What a card (`deck-node.tsx`) and a shape (`shapes/shape-node.tsx`, 031) share: the per-node UI
 * state, the eight resize handles, the four connection handles and the notes around the node.
 * Both draw the same component data (`DeckNodeData`); only the body differs.
 */
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH } from '@sododeck/ui/lib/icons';
import { cn } from '@sododeck/ui/lib/utils';
import {
  Handle,
  NodeResizeControl,
  Position,
  useReactFlow,
  type ResizeDragEvent,
} from '@xyflow/react';
import { Ban, CornerDownRight, EyeOff, Plus } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { useEditor } from '../model/use-editor';
import type { ConnectionCheck } from './connection-rules';
import type { DeckNodeData, HandleSide } from './deck-to-flow';
import {
  applyCardResize,
  cancelCardResize,
  endCardResize,
  startCardResize,
  type CardResizeSession,
} from './editing/card-resize';
import type { Handle as ResizeHandleName } from './editing/resize-limits';
import type { Level } from './levels';

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

/** The eight resize handles of the single selected node (017 R4); the limits come from the node. */
export function ResizeControls({ id, level }: { id: string; level: Level }) {
  const editor = useEditor();
  const { getZoom } = useReactFlow();
  const resize = useRef<CardResizeSession | null>(null);
  const [activeHandle, setActiveHandle] = useState<ResizeHandleName | null>(null);
  // React Flow never ends a resize whose node unmounts (a zoom-level switch): cancel it here, so
  // no guide or half-written size is left behind (050 R9).
  useEffect(
    () => () => {
      if (resize.current !== null) cancelCardResize(editor, resize.current);
      resize.current = null;
    },
    [editor],
  );
  return RESIZE_HANDLES.map((handle) => (
    <NodeResizeControl
      key={handle}
      nodeId={id}
      position={handle}
      className="sd-resize-handle"
      {...(activeHandle === handle ? { 'data-active': '' } : {})}
      onResizeStart={() => {
        setActiveHandle(handle);
        resize.current = startCardResize(editor, id, handle, level);
      }}
      onResize={(event, params) => {
        if (resize.current !== null)
          applyCardResize(editor, resize.current, params, modsOf(event), getZoom());
      }}
      onResizeEnd={() => {
        if (resize.current !== null) endCardResize(editor, resize.current);
        resize.current = null;
        setActiveHandle(null);
      }}
    />
  ));
}

/**
 * The four connection handles (one per side) and, while a connection is drawn, the whole-node
 * drop target. `placeAt` puts a handle somewhere other than its side midpoint: a shape's handles
 * sit on its outline (031), and React Flow reads the connector ends from where they are.
 */
export function SideHandles({
  title,
  tabIndex,
  role,
  hotSide,
  connecting,
  showOnHover,
  onActivate,
  placeAt,
}: {
  title: string;
  tabIndex: number;
  role: string | null;
  hotSide: HandleSide | null;
  connecting: boolean;
  /** False at Landscape: the dense board draws no handles (R8). */
  showOnHover: boolean;
  onActivate: () => void;
  placeAt?: (side: HandleSide) => CSSProperties;
}) {
  const isEndpointTarget = hotSide !== null;
  return (
    <>
      {SIDES.map(({ id: side, position }) => {
        const hot = hotSide === side;
        return (
          <Handle
            key={side}
            id={side}
            type="source"
            position={position}
            role="button"
            aria-label={`Connect from ${title}`}
            tabIndex={tabIndex}
            style={placeAt?.(side)}
            {...(isEndpointTarget ? { 'data-endpoint-target': '' } : {})}
            {...(hot ? { 'data-endpoint-hot': '' } : {})}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                onActivate();
              }
            }}
            className={cn(
              'sd-handle opacity-0',
              showOnHover && 'group-hover/node:opacity-100 group-focus-within/node:opacity-100',
              focusRing,
              role !== null && 'opacity-100',
              hot && 'is-active',
              isEndpointTarget && 'opacity-100',
            )}
          />
        );
      })}
      {/* While a connection is drawn, the whole node is a drop target, not only its handles. */}
      {connecting && role !== 'source' && (
        <Handle
          id="body"
          type="target"
          position={Position.Top}
          isConnectableStart={false}
          aria-hidden
          className="sd-body-handle"
        />
      )}
    </>
  );
}

/**
 * The notes around a node: "Hidden in this view" above, the connect-target "+", the flow start
 * tag and a refused connection's reason below.
 */
export function NodeNotes({
  data,
  target,
  refusal,
}: {
  data: Pick<DeckNodeData, 'hiddenInView' | 'flowStart'>;
  target: ConnectionCheck | null;
  refusal: string | null;
}) {
  return (
    <>
      {data.hiddenInView === true && (
        <span
          role="note"
          className="pointer-events-none absolute bottom-full left-0 z-10 mb-1.5 flex w-max items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-caption text-ink-secondary shadow-rest"
        >
          <EyeOff aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3" />
          Hidden in this view
        </span>
      )}
      {target === 'ok' && (
        <span
          aria-hidden
          className="absolute -top-2.5 -right-2.5 flex size-5 items-center justify-center rounded-full bg-primary text-on-primary shadow-rest"
        >
          <Plus strokeWidth={2} className="size-3.5" />
        </span>
      )}
      {data.flowStart !== undefined && (
        <span
          role="note"
          className="pointer-events-none absolute top-full left-1/2 z-10 mt-2 flex w-max -translate-x-1/2 items-center gap-1 rounded-full bg-inverse px-2 py-0.5 text-caption text-on-inverse shadow-rest"
        >
          <CornerDownRight aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3" />
          {data.flowStart}
        </span>
      )}
      {refusal && (
        <span
          role="note"
          className="absolute top-full left-0 z-10 mt-2 flex w-max items-center gap-1.5 rounded-row border border-clay-ink bg-surface px-2 py-1 text-caption text-clay-ink shadow-hover"
        >
          <Ban aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
          {refusal}
        </span>
      )}
    </>
  );
}
