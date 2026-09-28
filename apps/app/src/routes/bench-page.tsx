import { fromJSON } from '@sododeck/model';
import { ToastProvider } from '@sododeck/ui/components/toast';
import { ReactFlowProvider } from '@xyflow/react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

import { generateBenchDeck } from '../bench/generate-deck';
import { Canvas } from '../editor/canvas';
import { CommandPalette } from '../editor/command-palette/command-palette';
import { Inspector } from '../editor/inspector';
import { JsonPanel } from '../editor/json-panel';
import { exitFlow, nextStep, openFlow, play } from '../editor/flows/flow-mode';
import { recordClick, startNewFlow } from '../editor/flows/flow-session';
import { EditorProvider } from '../model/editor-context';
import { useEditor } from '../model/use-editor';
import { readDeck, useDeckSnapshot } from '../model/use-deck-snapshot';
import { useUiStore } from '../state/ui-store';
import { readViewState } from '../editor/views/use-current-view';

declare global {
  interface Window {
    __sododeckBench?: {
      readyAt: number;
      nodes: number;
      edges: number;
      collapseAll?: () => Promise<void>;
      toggleCollapse?: (groupId: string) => Promise<number>;
      prepareFocus?: (nodeId: string) => Promise<void>;
      focus?: (nodeId: string) => Promise<number>;
      resetViewModes?: () => void;
    };
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
    /** 008 SC-001: ms from typing in the inspector's Title field to the painted canvas node. */
    __sododeckInspectorBench?: { editTitle: (nodeId: string, title: string) => Promise<number> };
    /** 009 SC-008: ms from opening ⌘K and typing to painted results. */
    __sododeckPaletteBench?: {
      search: (query: string, matchText: string) => Promise<number>;
    };
    /** 011 SC-003: ms from a view switch to the painted canvas of that view. */
    __sododeckViewsBench?: {
      switchTo: (viewId: string, dimmed: boolean) => Promise<number>;
      /** 011 SC-001: pins these nodes in the current view, then ms from "Tidy layout" to applied. */
      tidy: (pinned: string[]) => Promise<number>;
      /** 011 SC-002: starts Tidy layout without waiting; `layoutRunning` tells when it ends. */
      startTidy: () => void;
      layoutRunning: () => boolean;
      /** Frame times recorded while the last started layout ran. */
      layoutFrames: () => number[];
    };
    __sododeckGroupsBench?: {
      collapseAll: () => Promise<void>;
      toggleCollapse: (groupId: string) => Promise<number>;
      prepareFocus: (nodeId: string) => Promise<void>;
      focus: (nodeId: string) => Promise<number>;
      reset: () => void;
    };
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

/** Exposes the command-palette benchmark (009 SC-008). */
function PaletteBenchHooks() {
  useEffect(() => {
    window.__sododeckPaletteBench = {
      search: async (query, matchText) => {
        useUiStore.getState().openPalette();
        await new Promise((resolve) =>
          requestAnimationFrame(() => {
            resolve(undefined);
          }),
        );
        const input = document.querySelector<HTMLInputElement>('[aria-label="Search the deck"]');
        if (input === null) return NaN;
        input.focus();
        const start = performance.now();
        typeInto(input, query);
        const ms = await paintedAfter(start, () =>
          Array.from(document.querySelectorAll('[role="option"]')).some((option) =>
            option.textContent.includes(matchText),
          ),
        );
        useUiStore.getState().closePalette();
        return ms;
      },
    };
    return () => {
      window.__sododeckPaletteBench = undefined;
    };
  }, []);
  return null;
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

/** Exposes the zoom-groups-focus benchmarks (010). */
function GroupsBenchHooks() {
  const editor = useEditor();
  const deck = useDeckSnapshot(editor.doc);

  useEffect(() => {
    const collapseAll = async () => {
      useUiStore.setState({ collapsed: new Set(deck.groups.map((group) => group.id)) });
      await paintedAfter(performance.now(), '[data-testid="collapsed-group-node"]');
    };
    const toggleCollapse = (groupId: string) => {
      const nextCollapsed = !useUiStore.getState().collapsed.has(groupId);
      const start = performance.now();
      useUiStore.getState().toggleCollapsed(groupId);
      return paintedAfter(
        start,
        nextCollapsed
          ? `[data-node-id="collapsed:${groupId}"]`
          : `[data-node-id="group:${groupId}"]`,
      );
    };
    const prepareFocus = async (nodeId: string) => {
      const ui = useUiStore.getState();
      ui.clearSelection();
      ui.setFocusMode(false);
      ui.select({ nodes: [nodeId] });
      ui.focus(nodeId);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        }),
      );
    };
    const focus = async (nodeId: string) => {
      const ui = useUiStore.getState();
      if (!ui.selection.nodes.includes(nodeId)) {
        await prepareFocus(nodeId);
      }
      const start = performance.now();
      ui.setFocusMode(true);
      return paintedAfter(
        start,
        () =>
          document.querySelector('[data-canvas][data-focus-mode]') !== null &&
          document.querySelector('.react-flow__node.in-focus') !== null,
      );
    };
    const reset = () => {
      const ui = useUiStore.getState();
      ui.clearSelection();
      ui.setFocusMode(false);
      ui.expandAll(deck.groups.map((group) => group.id));
    };
    window.__sododeckGroupsBench = {
      collapseAll,
      toggleCollapse,
      prepareFocus,
      focus,
      reset,
    };
    window.__sododeckBench = {
      ...(window.__sododeckBench ?? { readyAt: 0, nodes: 0, edges: 0 }),
      collapseAll,
      toggleCollapse,
      prepareFocus,
      focus,
      resetViewModes: reset,
    };
    return () => {
      window.__sododeckGroupsBench = undefined;
      if (window.__sododeckBench !== undefined) {
        delete window.__sododeckBench.collapseAll;
        delete window.__sododeckBench.toggleCollapse;
        delete window.__sododeckBench.prepareFocus;
        delete window.__sododeckBench.focus;
        delete window.__sododeckBench.resetViewModes;
      }
    };
  }, [deck, editor.doc]);
  return null;
}

let layoutFrames: number[] = [];

/** Exposes the view switch (011 SC-003); needs `views=1` (dims clients in Infra). */
function ViewsBenchHooks() {
  const editor = useEditor();
  useEffect(() => {
    window.__sododeckViewsBench = {
      switchTo: (viewId, dimmed) => {
        const start = performance.now();
        useUiStore.getState().switchView(viewId);
        const selector = '[data-testid="deck-node"][aria-label*="dimmed in this view"]';
        return paintedAfter(start, () => (document.querySelector(selector) !== null) === dimmed);
      },
      tidy: async (pinned) => {
        const viewId = readViewState(editor.doc).view.id;
        if (pinned.length > 0) editor.setPinned(viewId, pinned, true);
        await new Promise((r) => requestAnimationFrame(r));
        const button = document.querySelector<HTMLButtonElement>('button[title^="Tidy layout"]');
        if (button === null || button.disabled) return NaN;
        const start = performance.now();
        button.click();
        await new Promise<void>((resolve) => {
          const stop = useUiStore.subscribe((state) => {
            if (state.layoutRun.status === 'idle') {
              stop();
              resolve();
            }
          });
        });
        const ms = await paintedAfter(start, () => true);
        editor.undo();
        if (pinned.length > 0) editor.setPinned(viewId, pinned, false);
        return ms;
      },
      startTidy: () => {
        layoutFrames = [];
        document.querySelector<HTMLButtonElement>('button[title^="Tidy layout"]')?.click();
        // Frames count only while the layout runs (SC-002), not the frame that applies it.
        const tick = (t: number) => {
          if (useUiStore.getState().layoutRun.status === 'idle') return;
          layoutFrames.push(t);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      layoutFrames: () => layoutFrames,
      layoutRunning: () => useUiStore.getState().layoutRun.status !== 'idle',
    };
    return () => {
      window.__sododeckViewsBench = undefined;
    };
  }, [editor]);
  return null;
}

function BenchInspector() {
  return <Inspector deck={useDeckSnapshot(useEditor().doc)} />;
}

/**
 * Unlinked benchmark page: /bench?nodes=500&edges=1000&visibleOnly=1&json=deck&flows=1&inspector=1
 * &groups=1
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
  const groups = params.get('groups') === '1';
  const inspector = params.get('inspector') === '1';
  const stickies = Math.max(0, Number(params.get('stickies') ?? 0) || 0);
  const views = params.get('views') === '1';

  const [doc] = useState(() => {
    if (jsonDeck) {
      const { jsonPanel } = useUiStore.getState();
      useUiStore.setState({ jsonPanel: { ...jsonPanel, open: true, tab: 'deck' } });
    }
    return fromJSON(
      generateBenchDeck(nodeCount, edgeCount, 42, { flows, groups, stickies, views }).deck,
    );
  });

  return (
    <main className="flex h-dvh flex-col bg-canvas">
      <EditorProvider doc={doc}>
        <ToastProvider>
          <FlowBenchHooks />
          {groups && <GroupsBenchHooks />}
          {inspector && <InspectorBenchHooks />}
          <ViewsBenchHooks />
          <PaletteBenchHooks />
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
                          ...(window.__sododeckBench ?? {}),
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
            <CommandPalette
              screen="canvas"
              openRules={() => undefined}
              navigateToCanvas={() => undefined}
            />
          </ReactFlowProvider>
        </ToastProvider>
      </EditorProvider>
    </main>
  );
}
