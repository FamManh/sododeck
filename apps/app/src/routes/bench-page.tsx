import { fromJSON } from '@sododeck/model';
import { ReactFlowProvider } from '@xyflow/react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { generateBenchDeck } from '../bench/generate-deck';
import { Canvas } from '../editor/canvas';
import { EditorProvider } from '../model/editor-context';
import { readDeck } from '../model/use-deck-snapshot';

declare global {
  interface Window {
    __sododeckBench?: { readyAt: number; nodes: number; edges: number };
  }
}

/**
 * Unlinked benchmark page: /bench?nodes=500&edges=1000&visibleOnly=1
 * Goes through the real read and write path: model document, editor, incremental snapshot and
 * the real Canvas (so dragging is measured too).
 */
export function BenchPage() {
  const [params] = useSearchParams();
  const nodeCount = Number(params.get('nodes') ?? 500);
  const edgeCount = Number(params.get('edges') ?? 1000);
  const visibleOnly = params.get('visibleOnly') === '1';

  const [doc] = useState(() => fromJSON(generateBenchDeck(nodeCount, edgeCount).deck));

  return (
    <div className="h-dvh bg-canvas">
      <EditorProvider doc={doc}>
        <ReactFlowProvider>
          <Canvas
            onlyRenderVisibleElements={visibleOnly}
            onReady={() => {
              // Two frames after init ≈ first painted frame with nodes.
              requestAnimationFrame(() =>
                requestAnimationFrame(() => {
                  const deck = readDeck(doc);
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
      </EditorProvider>
    </div>
  );
}
