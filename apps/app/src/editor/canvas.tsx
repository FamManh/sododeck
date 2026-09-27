import type { SododeckFile } from '@sododeck/schema';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type NodeTypes,
  type XYPosition,
} from '@xyflow/react';
import { useMemo } from 'react';

import { useUiStore } from '../state/ui-store';
import { DeckNode } from './deck-node';
import { toFlowEdges, toFlowNodes } from './deck-to-flow';

const nodeTypes: NodeTypes = { deck: DeckNode };

export interface CanvasProps {
  deck: SododeckFile;
  positions: Record<string, XYPosition>;
  onlyRenderVisibleElements?: boolean;
  onReady?: () => void;
}

/**
 * Read-only canvas view of the deck. TODO(M1): edits (drag, connect, delete)
 * write to the Yjs document; React Flow never owns document state.
 */
export function Canvas({
  deck,
  positions,
  onlyRenderVisibleElements = false,
  onReady,
}: CanvasProps) {
  const selectedId = useUiStore((state) => state.selectedId);
  const select = useUiStore((state) => state.select);

  const nodes = useMemo(
    () => toFlowNodes(deck, positions, selectedId),
    [deck, positions, selectedId],
  );
  const edges = useMemo(() => toFlowEdges(deck), [deck]);

  return (
    <ReactFlow
      aria-label="Diagram canvas"
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      onlyRenderVisibleElements={onlyRenderVisibleElements}
      onNodeClick={(_, node) => {
        select(node.id);
      }}
      onPaneClick={() => {
        select(null);
      }}
      onInit={onReady}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.1}
      maxZoom={2}
      proOptions={{
        hideAttribution: true,
      }}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
      <Controls showInteractive={false} />
      <MiniMap pannable zoomable />
    </ReactFlow>
  );
}
