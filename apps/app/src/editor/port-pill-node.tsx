import { focusRing } from '@sododeck/ui/lib/focus';
import { cn } from '@sododeck/ui/lib/utils';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { NodeProps } from '@xyflow/react';
import { memo } from 'react';

import { useEditor } from '../model/use-editor';
import { useUiStore } from '../state/ui-store';
import { focusCanvas } from './canvas-actions';
import { COLLAPSED_NODE_PREFIX, type PortFlowNode } from './deck-to-flow';
import { scopeOf, visibleGraph } from './visible-graph';
import { collapsedOf, readViewState } from './views/use-current-view';

export const PortPillNode = memo(function PortPillNode({
  id,
  data,
  width,
  height,
}: NodeProps<PortFlowNode>) {
  const editor = useEditor();
  const focus = useUiStore((state) => state.focus);
  const select = useUiStore((state) => state.select);
  const drillUp = useUiStore((state) => state.drillUp);

  const goToOutside = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    drillUp(useUiStore.getState().drill.length - 1);
    const ui = useUiStore.getState();
    const deck = readViewState(editor.doc).deck;
    const representative =
      visibleGraph(deck, scopeOf(ui.drill), collapsedOf(editor.doc)).representative.get(
        data.outsideNodeId,
      ) ?? data.outsideNodeId;
    if (representative.startsWith(COLLAPSED_NODE_PREFIX)) {
      const groupId = representative.slice(COLLAPSED_NODE_PREFIX.length);
      select({ groups: [groupId] });
      focus(representative);
    } else {
      select({ nodes: [data.outsideNodeId] });
      focus(representative);
    }
    globalThis.setTimeout(() => {
      if (typeof document !== 'undefined') focusCanvas();
    }, 0);
  };

  return (
    <div style={{ width, height }} className="pointer-events-none flex items-center justify-center">
      <button
        type="button"
        data-node-id={id}
        aria-label={`Go to ${data.outsideTitle}`}
        onMouseDownCapture={(event) => {
          event.stopPropagation();
        }}
        onMouseDown={(event) => {
          event.stopPropagation();
        }}
        onClick={goToOutside}
        className={cn(
          'pointer-events-auto rounded-full border border-dashed border-primary bg-surface px-3 py-1 text-body-sm text-primary-ink shadow-rest',
          focusRing,
        )}
      >
        Go to {data.outsideTitle}
      </button>
    </div>
  );
});
