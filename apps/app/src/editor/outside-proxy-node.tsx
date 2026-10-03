import { useReducedMotion } from '@sododeck/ui/hooks/use-reduced-motion';
import { focusRing } from '@sododeck/ui/lib/focus';
import { ICON_STROKE_WIDTH, typeStyle } from '@sododeck/ui/lib/icons';
import { resolveMotion } from '@sododeck/ui/lib/motion';
import { cn } from '@sododeck/ui/lib/utils';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { memo } from 'react';

import { useEditor } from '../model/use-editor';
import { useUiStore } from '../state/ui-store';
import { focusCanvas } from './canvas-actions';
import { cardBox } from './canvas-geometry';
import { COLLAPSED_NODE_PREFIX, type PortFlowNode } from './deck-to-flow';
import { scopeOf, visibleGraph } from './visible-graph';
import { collapsedOf, readViewState } from './views/use-current-view';

const SIDES = [
  { id: 'top', position: Position.Top },
  { id: 'right', position: Position.Right },
  { id: 'bottom', position: Position.Bottom },
  { id: 'left', position: Position.Left },
] as const;

/**
 * A connection that leaves the drilled-in scope (034 R7): a dashed card for the real card
 * outside, standing where the connector ends. It is not part of the diagram, so it cannot be
 * moved, selected or connected; a click focuses it, double-click or Enter goes to the real card.
 */
export const OutsideProxyNode = memo(function OutsideProxyNode({
  id,
  data,
  width,
  height,
}: NodeProps<PortFlowNode>) {
  const editor = useEditor();
  const { setCenter, getZoom } = useReactFlow();
  const { dimMs } = resolveMotion(useReducedMotion());
  const Icon = typeStyle(data.kind).icon;

  const goToOutside = () => {
    // Up until the real card (or the collapsed group holding it) is on screen.
    let representative = data.outsideNodeId;
    for (;;) {
      const ui = useUiStore.getState();
      if (ui.drill.length === 0) break;
      ui.drillUp(ui.drill.length - 1);
      const next = useUiStore.getState();
      const deck = readViewState(editor.doc).deck;
      const graph = visibleGraph(deck, scopeOf(next.drill), collapsedOf(editor.doc));
      representative = graph.representative.get(data.outsideNodeId) ?? data.outsideNodeId;
      if (
        graph.nodes.includes(representative) ||
        graph.cards.some((c) => `${COLLAPSED_NODE_PREFIX}${c.groupId}` === representative)
      )
        break;
    }
    const ui = useUiStore.getState();
    if (representative.startsWith(COLLAPSED_NODE_PREFIX)) {
      ui.select({ groups: [representative.slice(COLLAPSED_NODE_PREFIX.length)] });
    } else {
      ui.select({ nodes: [data.outsideNodeId] });
    }
    ui.focus(representative);
    // The viewport is restored by the drill change; centre on the card once that has settled.
    requestAnimationFrame(() => {
      const state = useUiStore.getState();
      const deck = readViewState(editor.doc).deck;
      const graph = visibleGraph(deck, scopeOf(state.drill), collapsedOf(editor.doc));
      const card = graph.cards.find(
        (c) => `${COLLAPSED_NODE_PREFIX}${c.groupId}` === representative,
      );
      const index = deck.nodes.findIndex((node) => node.id === data.outsideNodeId);
      const node = deck.nodes[index];
      const box = card?.rect ?? (node === undefined ? undefined : cardBox(node, index, 'system'));
      if (box === undefined) return;
      void setCenter(box.x + box.width / 2, box.y + box.height / 2, {
        zoom: getZoom(),
        duration: dimMs,
      });
    });
    globalThis.setTimeout(() => {
      if (typeof document !== 'undefined') focusCanvas();
    }, 0);
  };

  return (
    <div style={{ width, height }} className="pointer-events-none">
      <button
        type="button"
        data-node-id={id}
        aria-label={`${data.outsideTitle}, outside, press Enter to go to it`}
        // Not draggable: keep a press from starting a node drag.
        onMouseDownCapture={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.stopPropagation();
          useUiStore.getState().focus(id);
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          goToOutside();
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          // Enter is "go", not the canvas's "open details" for a focused id it doesn't know.
          event.preventDefault();
          event.stopPropagation();
          goToOutside();
        }}
        className={cn(
          'pointer-events-auto flex size-full items-center gap-2 rounded-card border-[1.5px] border-dashed border-ink-secondary bg-canvas px-3 text-left',
          focusRing,
        )}
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-[8px] bg-surface-2 text-ink-secondary">
          <Icon aria-hidden strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[12.5px] leading-tight font-semibold text-ink">
            {data.outsideTitle}
          </span>
          <span className="text-[10px] leading-tight text-ink-muted">Outside</span>
        </span>
      </button>
      {SIDES.map(({ id: side, position }) => (
        <Handle
          key={side}
          id={side}
          type="source"
          position={position}
          isConnectable={false}
          aria-hidden
          className="pointer-events-none opacity-0"
        />
      ))}
    </div>
  );
});
