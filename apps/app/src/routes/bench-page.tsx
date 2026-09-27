import { fromJSON } from '@sododeck/model';
import { ToastProvider } from '@sododeck/ui/components/toast';
import { ReactFlowProvider } from '@xyflow/react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { generateBenchDeck } from '../bench/generate-deck';
import { Canvas } from '../editor/canvas';
import { JsonPanel } from '../editor/json-panel';
import { exitFlow, nextStep, openFlow, play } from '../editor/flows/flow-mode';
import { recordClick, startNewFlow } from '../editor/flows/flow-session';
import { EditorProvider } from '../model/editor-context';
import { useEditor } from '../model/use-editor';
import { readDeck } from '../model/use-deck-snapshot';
import { useUiStore } from '../state/ui-store';

declare global {
  interface Window {
    __sododeckBench?: { readyAt: number; nodes: number; edges: number };
    /** 006 flow scenarios: each resolves with ms from the action to the painted step badge. */
    __sododeckFlowBench?: {
      showFlow: (flowId: string) => Promise<number>;
      recordClick: (edgeId: string) => Promise<number>;
      /** 007: opens flow mode; resolves when the current step's edge label is painted. */
      openFlow: (flowId: string) => Promise<number>;
      /** 007: next step; resolves when the new current step is painted. */
      nextStep: () => Promise<number>;
      /** 007: starts autoplay at the given speed. */
      play: (speed: 1 | 2) => void;
      /** Ends any session and hides the flow, removing a flow the last run recorded. */
      reset: () => void;
    };
  }
}

const CURRENT_LABEL = '[data-flow-mode] [data-testid="edge-label"][aria-current="step"]';

/** Ms from `start` until `ready` holds (or `selector` is in the DOM) and that frame is painted. */
function paintedAfter(start: number, ready: string | (() => boolean)): Promise<number> {
  const isReady = typeof ready === 'string' ? () => document.querySelector(ready) !== null : ready;
  return new Promise((resolve) => {
    const check = () => {
      if (!isReady()) {
        requestAnimationFrame(check);
        return;
      }
      requestAnimationFrame(() => {
        resolve(performance.now() - start);
      });
    };
    requestAnimationFrame(check);
  });
}

/** Exposes the flow actions the benchmark measures (006 research R15). */
function FlowBenchHooks() {
  const editor = useEditor();
  useEffect(() => {
    window.__sododeckFlowBench = {
      showFlow: (flowId) => {
        const start = performance.now();
        useUiStore.getState().setActiveFlow(flowId);
        return paintedAfter(start, '[role="img"][aria-label^="Step 1"]');
      },
      recordClick: (edgeId) => {
        startNewFlow('Bench flow', null);
        const start = performance.now();
        recordClick(editor, edgeId);
        return paintedAfter(start, '[role="img"][aria-label^="Step 1"]');
      },
      openFlow: (flowId) => {
        const start = performance.now();
        openFlow(editor, flowId);
        return paintedAfter(start, CURRENT_LABEL);
      },
      nextStep: () => {
        const before = document.querySelector(CURRENT_LABEL);
        const start = performance.now();
        nextStep(editor);
        return paintedAfter(start, () => {
          const now = document.querySelector(CURRENT_LABEL);
          return now !== null && now !== before;
        });
      },
      play: (speed) => {
        useUiStore.getState().setSpeed(speed);
        play(editor);
      },
      reset: () => {
        exitFlow();
        const ui = useUiStore.getState();
        const recorded = ui.flowSession?.flowId;
        if (recorded != null) editor.remove('flows', recorded);
        ui.endSession();
        ui.setActiveFlow(null);
      },
    };
    return () => {
      window.__sododeckFlowBench = undefined;
    };
  }, [editor]);
  return null;
}

/**
 * Unlinked benchmark page: /bench?nodes=500&edges=1000&visibleOnly=1&json=deck&flows=1
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
  const flows = params.get('flows') === '1';

  const [doc] = useState(() => {
    if (jsonDeck) {
      const { jsonPanel } = useUiStore.getState();
      useUiStore.setState({ jsonPanel: { ...jsonPanel, open: true, tab: 'deck' } });
    }
    return fromJSON(generateBenchDeck(nodeCount, edgeCount, 42, { flows }).deck);
  });

  return (
    <main className="flex h-dvh flex-col bg-canvas">
      <EditorProvider doc={doc}>
        <ToastProvider>
          <FlowBenchHooks />
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
