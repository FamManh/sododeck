import { fromJSON, toJSON } from '@sododeck/model';
import { ReactFlowProvider } from '@xyflow/react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { generateBenchDeck } from '../bench/generate-deck';
import { Canvas } from '../editor/canvas';

declare global {
  interface Window {
    __sododeckBench?: { readyAt: number; nodes: number; edges: number };
  }
}

/**
 * Unlinked benchmark page: /bench?nodes=500&edges=1000&visibleOnly=1
 * Goes through the real model (fromJSON → toJSON) and the real Canvas.
 */
export function BenchPage() {
  const [params] = useSearchParams();
  const nodeCount = Number(params.get('nodes') ?? 500);
  const edgeCount = Number(params.get('edges') ?? 1000);
  const visibleOnly = params.get('visibleOnly') === '1';

  const [{ deck, positions }] = useState(() => {
    const generated = generateBenchDeck(nodeCount, edgeCount);
    return { deck: toJSON(fromJSON(generated.deck)), positions: generated.positions };
  });

  return (
    <div className="h-dvh bg-canvas">
      <ReactFlowProvider>
        <Canvas
          deck={deck}
          positions={positions}
          onlyRenderVisibleElements={visibleOnly}
          onReady={() => {
            // Two frames after init ≈ first painted frame with nodes.
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                window.__sododeckBench = {
                  readyAt: performance.now(),
                  nodes: deck.nodes.length,
                  edges: deck.edges.length,
                };
              }),
            );
          }}
        />
      </ReactFlowProvider>
    </div>
  );
}
