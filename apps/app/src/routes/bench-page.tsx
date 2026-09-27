import { fromJSON } from '@sododeck/model';
import { ToastProvider } from '@sododeck/ui/components/toast';
import { ReactFlowProvider } from '@xyflow/react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { generateBenchDeck } from '../bench/generate-deck';
import { Canvas } from '../editor/canvas';
import { JsonPanel } from '../editor/json-panel';
import { EditorProvider } from '../model/editor-context';
import { readDeck } from '../model/use-deck-snapshot';
import { useUiStore } from '../state/ui-store';

declare global {
  interface Window {
    __sododeckBench?: { readyAt: number; nodes: number; edges: number };
  }
}

/**
 * Unlinked benchmark page: /bench?nodes=500&edges=1000&visibleOnly=1&json=deck
 * Goes through the real read and write path: model document, editor, incremental snapshot and
 * the real Canvas (so dragging is measured too). `json=deck` adds the JSON panel under the
 * canvas with the Deck tab open (004 SC-003), as in the editor.
 */
export function BenchPage() {
  const [params] = useSearchParams();
  const nodeCount = Number(params.get('nodes') ?? 500);
  const edgeCount = Number(params.get('edges') ?? 1000);
  const visibleOnly = params.get('visibleOnly') === '1';
  const jsonDeck = params.get('json') === 'deck';

  const [doc] = useState(() => {
    if (jsonDeck) {
      const { jsonPanel } = useUiStore.getState();
      useUiStore.setState({ jsonPanel: { ...jsonPanel, open: true, tab: 'deck' } });
    }
    return fromJSON(generateBenchDeck(nodeCount, edgeCount).deck);
  });

  return (
    <main className="flex h-dvh flex-col bg-canvas">
      <EditorProvider doc={doc}>
        <ToastProvider>
          <ReactFlowProvider>
            <div className="min-h-0 flex-1">
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
            </div>
            {jsonDeck && <JsonPanel />}
          </ReactFlowProvider>
        </ToastProvider>
      </EditorProvider>
    </main>
  );
}
