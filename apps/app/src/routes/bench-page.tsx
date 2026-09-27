import { fromJSON } from '@sododeck/model';
import { ToastProvider } from '@sododeck/ui/components/toast';
import { ReactFlowProvider } from '@xyflow/react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { generateBenchDeck } from '../bench/generate-deck';
import { Canvas } from '../editor/canvas';
import { Inspector } from '../editor/inspector';
import { JsonPanel } from '../editor/json-panel';
import { recordClick, startNewFlow } from '../editor/flows/flow-session';
import { EditorProvider } from '../model/editor-context';
import { useEditor } from '../model/use-editor';
import { readDeck, useDeckSnapshot } from '../model/use-deck-snapshot';
import { useUiStore } from '../state/ui-store';

declare global {
  interface Window {
    __sododeckBench?: { readyAt: number; nodes: number; edges: number };
    /** 006 flow scenarios: each resolves with ms from the action to the painted step badge. */
    __sododeckFlowBench?: {
      showFlow: (flowId: string) => Promise<number>;
      recordClick: (edgeId: string) => Promise<number>;
      /** Ends any session and hides the flow, removing a flow the last run recorded. */
      reset: () => void;
    };
    /** 008 SC-001: ms from typing in the inspector's Title field to the painted canvas node. */
    __sododeckInspectorBench?: { editTitle: (nodeId: string, title: string) => Promise<number> };
  }
}

/** Types `text` into an input the way React sees a keystroke. */
function typeInto(input: HTMLInputElement, text: string): void {
  // The prototype's setter, so React's value tracker sees a change.
  Reflect.set(HTMLInputElement.prototype, 'value', text, input);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Exposes the inspector edit the benchmark measures (008 SC-001). */
function InspectorBenchHooks() {
  useEffect(() => {
    window.__sododeckInspectorBench = {
      editTitle: async (nodeId, title) => {
        useUiStore.getState().select({ nodes: [nodeId] });
        await new Promise((r) => requestAnimationFrame(r));
        const input = document.querySelector<HTMLInputElement>(
          '[aria-label="Inspector"] input[aria-label="Title"]',
        );
        if (input === null) return NaN;
        input.focus();
        const start = performance.now();
        typeInto(input, title);
        const ms = await paintedAfter(start, `[data-testid="deck-node"][title="${title}"]`);
        input.blur();
        return ms;
      },
    };
    return () => {
      window.__sododeckInspectorBench = undefined;
    };
  }, []);
  return null;
}

/** Ms from `start` until `selector` is in the DOM and the frame after it is painted. */
function paintedAfter(start: number, selector: string): Promise<number> {
  return new Promise((resolve) => {
    const check = () => {
      if (document.querySelector(selector) === null) {
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
      reset: () => {
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

function BenchInspector() {
  return <Inspector deck={useDeckSnapshot(useEditor().doc)} />;
}

/**
 * Unlinked benchmark page: /bench?nodes=500&edges=1000&visibleOnly=1&json=deck&flows=1&inspector=1
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
  const inspector = params.get('inspector') === '1';

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
          {inspector && <InspectorBenchHooks />}
          <ReactFlowProvider>
            <div className="flex min-h-0 flex-1">
              <div className="min-w-0 flex-1">
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
              {inspector && (
                <div className="w-90 shrink-0 border-l border-border">
                  <BenchInspector />
                </div>
              )}
            </div>
            {jsonDeck && <JsonPanel />}
          </ReactFlowProvider>
        </ToastProvider>
      </EditorProvider>
    </main>
  );
}
